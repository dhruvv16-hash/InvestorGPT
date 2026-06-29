from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import logging
from app.database.db import get_db
from app.models.models import Company
from app.engines.timeline_engine import TimelineEngine

logger = logging.getLogger("investorgpt.routes_timeline")
router = APIRouter(prefix="/timeline", tags=["Company Event Timeline"])

@router.get("/{ticker}")
async def get_timeline(
    ticker: str,
    db: Session = Depends(get_db)
):
    ticker_clean = ticker.upper().strip()
    if not ticker_clean:
        raise HTTPException(status_code=400, detail="Invalid ticker symbol.")
    
    try:
        company = db.query(Company).filter(Company.ticker == ticker_clean).first()
        company_name = company.name if company else ticker_clean
        
        engine = TimelineEngine()
        result = engine.get_company_timeline(ticker_clean, company_name)
        return result
    except Exception as e:
        logger.error(f"Failed to fetch timeline for {ticker_clean}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
