import logging
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.database.db import get_db
from app.engines.valuation.calibration_engine import CalibrationEngine

logger = logging.getLogger("investorgpt.routes_calibration")
router = APIRouter(prefix="/calibration", tags=["Calibration"])

# Pydantic Schemas
class CalibrationLogRequest(BaseModel):
    ticker: str
    user_id: str
    predicted_revenue: float
    predicted_eps: float
    predicted_fair_value: float

@router.post("/log")
def log_valuation_record(req: CalibrationLogRequest, db: Session = Depends(get_db)):
    """Logs a model valuation prediction for future recalibration."""
    engine = CalibrationEngine()
    try:
        record = engine.log_valuation(
            db=db,
            ticker=req.ticker,
            user_id=req.user_id,
            predicted_rev=req.predicted_revenue,
            predicted_eps=req.predicted_eps,
            predicted_val=req.predicted_fair_value
        )
        return {"status": "success", "id": record.id}
    except Exception as e:
        logger.error(f"Failed to log valuation record: {e}")
        raise HTTPException(status_code=500, detail="Internal server error saving calibration record.")

@router.post("/calibrate")
async def trigger_calibration(
    ticker: str = Query(..., description="The stock ticker to calibrate"),
    db: Session = Depends(get_db)
):
    """Triggers retro-matching of saved predictions with yfinance actual earnings releases."""
    engine = CalibrationEngine()
    try:
        calibrated = await engine.calibrate_records(db, ticker)
        return {"status": "success", "calibrated_count": len(calibrated), "records": calibrated}
    except Exception as e:
        logger.error(f"Failed to run calibration for {ticker}: {e}")
        raise HTTPException(status_code=500, detail="Internal error running calibration process.")

@router.get("/feedback")
def get_calibration_feedback(
    ticker: str = Query(..., description="The stock ticker to get calibration feedback for"),
    db: Session = Depends(get_db)
):
    """Retrieves computed error rates and heuristic recommendations."""
    engine = CalibrationEngine()
    try:
        feedback = engine.get_calibration_feedback(db, ticker)
        return feedback
    except Exception as e:
        logger.error(f"Failed to fetch calibration feedback for {ticker}: {e}")
        raise HTTPException(status_code=500, detail="Internal error retrieving feedback.")
