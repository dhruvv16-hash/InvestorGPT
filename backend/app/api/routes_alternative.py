from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import logging
from app.database.db import get_db
from app.providers.market.yahoo_provider import YahooProvider
from app.engines.alternative_engine import AlternativeEngine

logger = logging.getLogger("investorgpt.routes_alternative")
router = APIRouter(prefix="/alternative-data", tags=["Alternative Data Engine"])

@router.get("/{ticker}")
async def get_alternative_data_signals(
    ticker: str,
    db: Session = Depends(get_db)
):
    ticker_clean = ticker.upper().strip()
    if not ticker_clean:
        raise HTTPException(status_code=400, detail="Invalid ticker symbol.")

    try:
        provider = YahooProvider()
        price_data = await provider.get_price(ticker_clean)
        company_name = price_data.get("name") or ticker_clean

        engine = AlternativeEngine()
        result = engine.get_alternative_data_signals(ticker_clean, company_name)
        return result
    except Exception as e:
        logger.error(f"Failed to load alternative data signals for {ticker_clean}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
