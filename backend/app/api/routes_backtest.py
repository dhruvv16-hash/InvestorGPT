import logging
from fastapi import APIRouter, HTTPException, Query
from app.engines.valuation.backtest_engine import BacktestEngine

logger = logging.getLogger("investorgpt.routes_backtest")
router = APIRouter(prefix="/backtest", tags=["Backtesting"])

@router.get("/{ticker}")
async def run_historical_backtest(
    ticker: str,
    year: int = Query(2022, description="The retroactive historical base year to run valuation on")
):
    """Runs retroactive financial modeling valuation on historical data and measures forecasting variance."""
    engine = BacktestEngine()
    try:
        results = await engine.run_backtest(ticker.upper(), backtest_year=year)
        return results
    except ValueError as ve:
        logger.warning(f"Backtest warning for {ticker}: {ve}")
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        logger.error(f"Failed to execute backtest for {ticker}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error running backtest.")
