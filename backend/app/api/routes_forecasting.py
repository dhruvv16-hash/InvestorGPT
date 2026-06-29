from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import logging
from app.database.db import get_db
from app.engines.forecasting_engine import ForecastingEngine

logger = logging.getLogger("investorgpt.routes_forecasting")
router = APIRouter(prefix="/forecasting", tags=["AI Earnings Forecasting"])

@router.get("/{ticker}")
async def get_earnings_forecast(
    ticker: str,
    db: Session = Depends(get_db)
):
    ticker_clean = ticker.upper().strip()
    if not ticker_clean:
        raise HTTPException(status_code=400, detail="Invalid ticker symbol.")
    
    try:
        engine = ForecastingEngine()
        result = engine.forecast_q1(ticker_clean)
        return result
    except Exception as e:
        logger.error(f"Failed to generate earnings forecast for {ticker_clean}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
