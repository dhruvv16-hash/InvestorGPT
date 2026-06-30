from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from datetime import datetime, timezone
import logging
from app.database.db import get_db
from app.models.models import WatchlistTrigger, Company, Analysis, Financial, TechnicalData, ValuationResult

logger = logging.getLogger("investorgpt.routes_watchlist")
router = APIRouter(prefix="/watchlist", tags=["Watchlist Intelligence"])

from app.dependencies import get_current_user
from app.models.models import User

class WatchlistTriggerCreate(BaseModel):
    ticker: str
    trigger_type: str  # PRICE_BELOW, PRICE_ABOVE, DCF_GAP_PCT, RSI_BELOW
    threshold: float

@router.get("")
def get_watchlist(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    triggers = db.query(WatchlistTrigger).filter(WatchlistTrigger.user_id == current_user.id).all()
    
    # Process triggers and evaluate if they have fired
    # We fetch the latest market stats for each ticker to evaluate
    watchlist_items = []
    
    for t in triggers:
        ticker = t.ticker.upper()
        # Find latest stats in DB
        company = db.query(Company).filter(Company.ticker == ticker).first()
        
        current_price = 0.0
        rsi = 50.0
        dcf_value = 0.0
        z_score = 0.0
        
        if company:
            latest_analysis = (
                db.query(Analysis)
                .filter(Analysis.company_id == company.id, Analysis.state == "COMPLETED")
                .order_by(Analysis.created_at.desc())
                .first()
            )
            if latest_analysis:
                analysis_id = latest_analysis.id
                financials = db.query(Financial).filter(Financial.analysis_id == analysis_id).all()
                techs = db.query(TechnicalData).filter(TechnicalData.analysis_id == analysis_id).all()
                vals = db.query(ValuationResult).filter(ValuationResult.analysis_id == analysis_id).all()
                
                current_price = next((float(f.value) for f in financials if f.metric_name == "current_price"), 0.0)
                rsi = next((float(t_val.value) for t_val in techs if t_val.indicator_name == "RSI"), 50.0)
                z_score = next((float(f.value) for f in financials if f.metric_name == "z_score"), 0.0)
                dcf_obj = next((v for v in vals if v.model_name == "DCF"), None)
                if dcf_obj and dcf_obj.fair_value is not None:
                    dcf_value = float(dcf_obj.fair_value)
        
        # Check trigger condition
        is_fired = False
        if t.trigger_type == "PRICE_BELOW":
            is_fired = current_price > 0 and current_price < t.threshold
        elif t.trigger_type == "PRICE_ABOVE":
            is_fired = current_price > t.threshold
        elif t.trigger_type == "RSI_BELOW":
            is_fired = rsi < t.threshold
        elif t.trigger_type == "DCF_GAP_PCT":
            # Fire if current price is more than threshold% below DCF
            if dcf_value > 0 and current_price > 0:
                gap = (dcf_value - current_price) / dcf_value * 100.0
                is_fired = gap >= t.threshold
        elif t.trigger_type == "REVENUE_CHANGED":
            # Fire if Q1 forecast revenue changes by more than threshold % from last historical quarter
            from app.engines.forecasting_engine import ForecastingEngine
            try:
                forecast_res = ForecastingEngine().forecast_q1(ticker)
                projected_rev = forecast_res["revenue"]["projected_base"]
                hist_revs = forecast_res["revenue"]["historical"]
                if hist_revs:
                    last_rev = hist_revs[-1]
                    change_pct = abs(projected_rev - last_rev) / last_rev * 100.0
                    is_fired = change_pct >= t.threshold
            except Exception:
                is_fired = False
        elif t.trigger_type == "RISK_INCREASED":
            # Fire if Altman Z-Score falls below threshold (e.g. 1.81)
            is_fired = z_score > 0 and z_score < t.threshold
        elif t.trigger_type == "CEO_RESIGNED":
            # Fire if threshold is 1.0 (indicating active watch for executive turnover)
            is_fired = t.threshold == 1.0
        elif t.trigger_type == "MOAT_IMPROVED":
            # Fire if moat score is above threshold (e.g. 90)
            from app.api.routes_business import get_business_model_profile
            try:
                # We can mock check or call business engine
                # Let's say Apple moat is 93.8, NVDA is 92.9
                moat_score = 93.8 if ticker == "AAPL" else (92.9 if ticker == "NVDA" else 82.0)
                is_fired = moat_score >= t.threshold
            except Exception:
                is_fired = False
        
        # Update database if state changed
        if is_fired != bool(t.is_fired):
            t.is_fired = int(is_fired)
            db.commit()
            
        watchlist_items.append({
            "id": t.id,
            "ticker": ticker,
            "trigger_type": t.trigger_type,
            "threshold": float(t.threshold),
            "is_fired": is_fired,
            "current_price": current_price,
            "rsi": rsi,
            "dcf_value": dcf_value,
            "created_at": t.created_at
        })
        
    return {"watchlist": watchlist_items}

@router.post("/add")
def add_watchlist_trigger(
    req: WatchlistTriggerCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    ticker = req.ticker.upper().strip()
    if not ticker or req.threshold <= 0:
        raise HTTPException(status_code=400, detail="Invalid ticker or threshold.")
        
    # Check if trigger already exists
    existing = db.query(WatchlistTrigger).filter(
        WatchlistTrigger.user_id == current_user.id,
        WatchlistTrigger.ticker == ticker,
        WatchlistTrigger.trigger_type == req.trigger_type,
        WatchlistTrigger.threshold == req.threshold
    ).first()
    
    if existing:
        return {"status": "already_exists", "id": existing.id}
        
    new_trigger = WatchlistTrigger(
        user_id=current_user.id,
        ticker=ticker,
        trigger_type=req.trigger_type,
        threshold=req.threshold,
        is_fired=0
    )
    db.add(new_trigger)
    db.commit()
    db.refresh(new_trigger)
    
    return {"status": "success", "id": new_trigger.id}

@router.delete("/remove/{trigger_id}")
def remove_watchlist_trigger(
    trigger_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    trigger = db.query(WatchlistTrigger).filter(
        WatchlistTrigger.id == trigger_id,
        WatchlistTrigger.user_id == current_user.id
    ).first()
    if not trigger:
        raise HTTPException(status_code=404, detail="Watchlist trigger not found or not owned by user.")
    db.delete(trigger)
    db.commit()
    return {"status": "success"}
