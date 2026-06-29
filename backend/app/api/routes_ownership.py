from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import logging
from app.database.db import get_db
from app.providers.market.yahoo_provider import YahooProvider
from app.engines.ownership_engine import OwnershipEngine

logger = logging.getLogger("investorgpt.routes_ownership")
router = APIRouter(prefix="/ownership", tags=["Institutional Ownership"])

@router.get("/{ticker}")
async def get_ownership_profile(
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
        market_cap = price_data.get("market_cap") or 1e10

        engine = OwnershipEngine()
        result = engine.get_ownership_profile(ticker_clean, company_name, market_cap)
        return result
    except Exception as e:
        logger.error(f"Failed to load ownership dataset for {ticker_clean}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
