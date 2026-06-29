from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Dict, Any
import random
from app.database.db import get_db
from app.models.models import Company, Analysis, Financial, ValuationResult

router = APIRouter(prefix="/strategy", tags=["Strategy Builder"])

class StrategyRequest(BaseModel):
    styles: List[str]  # e.g., ["DIVIDEND", "VALUE", "LARGE_CAP", "GROWTH", "SOLVENT"]

@router.post("/generate")
def generate_strategy(req: StrategyRequest, db: Session = Depends(get_db)):
    if not req.styles:
        raise HTTPException(status_code=400, detail="Must select at least one investment style.")

    # 1. Fetch all companies and latest analysis metrics
    companies = db.query(Company).all()
    candidates = []

    for company in companies:
        latest_analysis = (
            db.query(Analysis)
            .filter(Analysis.company_id == company.id, Analysis.state == "COMPLETED")
            .order_by(Analysis.created_at.desc())
            .first()
        )
        if not latest_analysis:
            continue

        financials = db.query(Financial).filter(Financial.analysis_id == latest_analysis.id).all()
        vals = db.query(ValuationResult).filter(ValuationResult.analysis_id == latest_analysis.id).all()

        current_price = next((float(f.value) for f in financials if f.metric_name == "current_price"), 100.0)
        f_score = next((int(f.value) for f in financials if f.metric_name == "f_score"), 0)
        z_score = next((float(f.value) for f in financials if f.metric_name == "z_score"), 0.0)
        
        dcf_val = next((v for v in vals if v.model_name == "DCF"), None)
        fair_value = float(dcf_val.fair_value) if dcf_val and dcf_val.fair_value is not None else 0.0
        upside = ((fair_value - current_price) / current_price * 100.0) if current_price > 0 else 0.0
        
        market_cap = next((float(f.value) for f in financials if f.metric_name == "market_cap"), 1e10)

        # Mock check for dividends (e.g., Apple has dividends, Reliance has dividends)
        has_dividend = company.ticker in ["AAPL", "RELIANCE.NS", "MSFT"]
        
        # Growth indicator
        is_growth = company.ticker in ["NVDA", "AMD"] or company.sector == "Technology"
        
        candidates.append({
            "ticker": company.ticker,
            "name": company.name,
            "sector": company.sector or "Technology",
            "market_cap": market_cap,
            "current_price": current_price,
            "f_score": f_score,
            "z_score": z_score,
            "dcf_upside": upside,
            "has_dividend": has_dividend,
            "is_growth": is_growth,
            "recommendation": latest_analysis.recommendation
        })

    # 2. Filter based on selected styles
    filtered = []
    for c in candidates:
        match = True
        
        for style in req.styles:
            style_upper = style.upper().strip()
            
            if style_upper == "DIVIDEND":
                if not c["has_dividend"]:
                    match = False
            elif style_upper == "VALUE":
                if c["dcf_upside"] < 5.0:  # must have positive DCF upside
                    match = False
            elif style_upper == "LARGE_CAP":
                if c["market_cap"] < 3e10:  # $30B threshold
                    match = False
            elif style_upper == "GROWTH":
                if not c["is_growth"]:
                    match = False
            elif style_upper == "SOLVENT":
                if c["f_score"] < 5 and c["z_score"] < 2.0:
                    match = False
                    
        if match:
            filtered.append(c)

    # If no matches, fall back to general large-cap technology stocks
    if not filtered:
        filtered = [c for c in candidates if c["ticker"] in ["AAPL", "MSFT", "NVDA"]]

    # 3. Calculate recommended allocation weights
    # Weight based on reciprocal of volatility or simple equal weight
    num_matches = len(filtered)
    equal_weight = 1.0 / num_matches if num_matches > 0 else 0.0
    
    # Calculate weighted expected return & stats
    avg_upside = sum(c["dcf_upside"] for c in filtered) / max(1, num_matches)
    
    allocations = {}
    for c in filtered:
        allocations[c["ticker"]] = round(equal_weight, 4)

    # Mock historical backtest CAGR based on styles selected
    backtest_cagr = 12.5
    style_set = set(s.upper() for s in req.styles)
    if "GROWTH" in style_set and "VALUE" in style_set:
        backtest_cagr = 18.2
    elif "GROWTH" in style_set:
        backtest_cagr = 22.4
    elif "DIVIDEND" in style_set:
        backtest_cagr = 9.8
    elif "VALUE" in style_set:
        backtest_cagr = 14.5

    return {
        "styles_applied": req.styles,
        "portfolio_stats": {
            "expected_cagr_pct": backtest_cagr,
            "average_upside_pct": round(avg_upside, 2),
            "estimated_sharpe_ratio": 1.45 if "SOLVENT" in style_set else 1.25,
            "diversification_rating": "EXCELLENT" if num_matches >= 4 else "MODERATE"
        },
        "allocation_weights": allocations,
        "matching_stocks": [
            {
                "ticker": c["ticker"],
                "name": c["name"],
                "sector": c["sector"],
                "current_price": c["current_price"],
                "upside_pct": round(c["dcf_upside"], 1),
                "f_score": c["f_score"],
                "recommendation": c["recommendation"]
            } for c in filtered
        ]
    }
