import uuid
import logging
import httpx
from datetime import datetime, timezone, timedelta
from difflib import SequenceMatcher
from fastapi import APIRouter, Depends, status, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database.db import get_db
from app.models.models import Company, RecentSearch, SearchClickLog
from app.schemas.schemas import SearchClickRequest

logger = logging.getLogger("investorgpt.search")

router = APIRouter(tags=["Search"])

_REMOTE_SEARCH_CACHE = {}

def calculate_match_score(query: str, symbol: str, name: str, popularity_score: int, is_local: bool) -> int:
    q_clean = query.strip().lower()
    symbol_clean = symbol.strip().lower()
    name_clean = name.strip().lower()
    
    score = 0
    
    # 1. Exact Symbol Match
    if symbol_clean == q_clean:
        score += 100
    # 2. Symbol Starts With
    elif symbol_clean.startswith(q_clean):
        score += 80
    # 3. Symbol Contains
    elif q_clean in symbol_clean:
        score += 40
        
    # 4. Company Name Starts With
    if name_clean.startswith(q_clean):
        score += 50
    # 5. Company Name Contains
    elif q_clean in name_clean:
        score += 20
        
    # 6. Fuzzy Match ratios (SequenceMatcher)
    ratio = SequenceMatcher(None, q_clean, symbol_clean).ratio()
    name_ratio = SequenceMatcher(None, q_clean, name_clean).ratio()
    score += int(ratio * 30) + int(name_ratio * 20)
    
    # 7. Popularity score addition
    score += popularity_score
    
    # 8. Local Analyzed bonus (Prioritizes local analyzed stocks)
    if is_local:
        score += 50
        
    return score

@router.get("/search")
async def search_companies(
    q: str,
    db: Session = Depends(get_db)
):
    q_clean = q.strip().lower()
    if not q_clean:
        return {"quotes": []}
    
    # 1. Fetch local companies (In-memory search list)
    local_quotes = []
    try:
        companies = db.query(Company).all()
        for c in companies:
            score = calculate_match_score(q_clean, c.ticker, c.name, c.popularity_score or 0, is_local=True)
            # Only include if there is some baseline match (fuzzy ratio > 0.25 or is contained)
            if q_clean in c.ticker.lower() or q_clean in c.name.lower() or score > 40:
                local_quotes.append({
                    "symbol": c.ticker,
                    "name": c.name,
                    "exchange": c.exchange,
                    "type": "EQUITY",
                    "is_local": True,
                    "score": score
                })
    except Exception as e:
        logger.error(f"Local memory search failed: {e}")

    # 2. Fetch remote Yahoo Finance API (cached, 2.5s timeout)
    remote_quotes = []
    if q_clean in _REMOTE_SEARCH_CACHE:
        remote_quotes = [dict(q) for q in _REMOTE_SEARCH_CACHE[q_clean]]
    else:
        url = f"https://query2.finance.yahoo.com/v1/finance/search?q={q_clean}"
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
        try:
            async with httpx.AsyncClient(timeout=2.5) as client:
                res = await client.get(url, headers=headers)
                if res.status_code == 200:
                    data = res.json()
                    for quote in data.get("quotes", []):
                        if "symbol" in quote:
                            sym = quote["symbol"]
                            name = quote.get("longname") or quote.get("shortname") or sym
                            exch = quote.get("exchange", "UNKNOWN")
                            q_type = quote.get("quoteType", "UNKNOWN")
                            
                            # Calculate score for remote stock (no popularity, is_local=False)
                            score = calculate_match_score(q_clean, sym, name, popularity_score=0, is_local=False)
                            
                            remote_quotes.append({
                                "symbol": sym,
                                "name": name,
                                "exchange": exch,
                                "type": q_type,
                                "is_local": False,
                                "score": score
                            })
                    if len(_REMOTE_SEARCH_CACHE) < 1000:
                        _REMOTE_SEARCH_CACHE[q_clean] = [dict(q) for q in remote_quotes]
        except Exception as e:
            logger.warning(f"Yahoo search timed out or failed for '{q_clean}': {e}")
            
    # 3. Merge and deduplicate, prioritizing local database entries (which are already analyzed)
    seen_symbols = set()
    merged_quotes = []
    
    # Sort local quotes by score desc
    local_quotes.sort(key=lambda x: x["score"], reverse=True)
    for quote in local_quotes:
        sym = quote["symbol"].upper().strip()
        if sym not in seen_symbols:
            seen_symbols.add(sym)
            merged_quotes.append(quote)
            
    # Sort remote quotes by score desc
    remote_quotes.sort(key=lambda x: x["score"], reverse=True)
    for quote in remote_quotes:
        sym = quote["symbol"].upper().strip()
        if sym not in seen_symbols:
            seen_symbols.add(sym)
            merged_quotes.append(quote)
            
    # Final sort of merged results based on score to make fuzzy local matches override remote matches
    merged_quotes.sort(key=lambda x: x["score"], reverse=True)
    
    # Strip score metadata before sending to client
    for quote in merged_quotes:
        quote.pop("score", None)
        
    return {"quotes": merged_quotes[:10]}

@router.post("/search/click", status_code=status.HTTP_200_OK)
def log_search_click(
    req: SearchClickRequest,
    db: Session = Depends(get_db)
):
    try:
        ticker = req.symbol.upper().strip()
        name = req.name.strip()
        exch = req.exchange.strip()
        user_id = req.user_id.strip()
        
        if not ticker or not user_id:
            raise HTTPException(status_code=400, detail="Missing symbol or user_id")
            
        # 1. If company is local, increment popularity_score
        company = db.query(Company).filter(Company.ticker.ilike(ticker)).first()
        if company:
            company.popularity_score = (company.popularity_score or 0) + 1
            db.add(company)
            
        # 2. Add click log for trending analytics
        click_log = SearchClickLog(ticker=ticker)
        db.add(click_log)
        
        # 3. Upsert into recent_searches for user
        recent = db.query(RecentSearch).filter(
            RecentSearch.user_id == user_id,
            RecentSearch.ticker.ilike(ticker)
        ).first()
        
        if recent:
            # Update timestamp
            recent.timestamp = datetime.now(timezone.utc)
            db.add(recent)
        else:
            # Create new
            new_recent = RecentSearch(
                user_id=user_id,
                ticker=ticker,
                name=name,
                exchange=exch
            )
            db.add(new_recent)
            
        # 4. Limit recent searches count to 5 per user
        all_recents = db.query(RecentSearch).filter(
            RecentSearch.user_id == user_id
        ).order_by(RecentSearch.timestamp.desc()).all()
        
        if len(all_recents) > 5:
            # Delete old recents
            for old_r in all_recents[5:]:
                db.delete(old_r)
                
        db.commit()
        return {"status": "success"}
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to log search click: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/search/recent")
def get_recent_searches(
    user_id: str,
    db: Session = Depends(get_db)
):
    try:
        recents = db.query(RecentSearch).filter(
            RecentSearch.user_id == user_id
        ).order_by(RecentSearch.timestamp.desc()).limit(5).all()
        
        return {
            "recent": [
                {
                    "symbol": r.ticker,
                    "name": r.name,
                    "exchange": r.exchange
                } for r in recents
            ]
        }
    except Exception as e:
        logger.error(f"Failed to retrieve recent searches: {e}")
        return {"recent": []}

@router.delete("/search/recent")
def clear_recent_searches(
    user_id: str,
    db: Session = Depends(get_db)
):
    try:
        db.query(RecentSearch).filter(RecentSearch.user_id == user_id).delete()
        db.commit()
        return {"status": "success"}
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to clear recent searches: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/search/trending")
def get_trending_searches(
    db: Session = Depends(get_db)
):
    try:
        # Get click counts in last 7 days (broad range to ensure we return data)
        time_limit = datetime.now(timezone.utc) - timedelta(days=7)
        clicks = db.query(
            SearchClickLog.ticker,
            func.count(SearchClickLog.id).label("count")
        ).filter(
            SearchClickLog.timestamp >= time_limit
        ).group_by(
            SearchClickLog.ticker
        ).order_by(
            func.count(SearchClickLog.id).desc()
        ).limit(6).all()
        
        trending = []
        for c in clicks:
            # Resolve name and exchange if in database
            company = db.query(Company).filter(Company.ticker.ilike(c.ticker)).first()
            name = company.name if company else c.ticker
            exchange = company.exchange if company else "GLOBAL"
            trending.append({
                "symbol": c.ticker,
                "name": name,
                "exchange": exchange,
                "count": c.count
            })
            
        # Fallback to local companies sorted by popularity if not enough search click logs exist
        if len(trending) < 3:
            local_companies = db.query(Company).order_by(
                Company.popularity_score.desc()
            ).limit(6).all()
            
            seen = set(t["symbol"].upper() for t in trending)
            for c in local_companies:
                sym = c.ticker.upper()
                if sym not in seen:
                    trending.append({
                        "symbol": c.ticker,
                        "name": c.name,
                        "exchange": c.exchange,
                        "count": c.popularity_score or 0
                    })
                    
        return {"trending": trending[:6]}
    except Exception as e:
        logger.error(f"Failed to retrieve trending searches: {e}")
        return {"trending": []}

@router.get("/companies")
async def list_companies(db: Session = Depends(get_db)):
    try:
        companies = db.query(Company).all()
        return {
            "companies": [
                {
                    "symbol": c.ticker,
                    "name": c.name,
                    "exchange": c.exchange,
                    "type": "EQUITY",
                    "is_local": True
                } for c in companies
            ]
        }
    except Exception as e:
        logger.error(f"Failed to list companies: {e}")
        return {"companies": []}
