import logging
from typing import Any, Dict, List
from sqlalchemy.orm import Session
from app.models.models import HistoricalValuationRecord
from app.providers.market.yahoo_provider import YahooProvider

logger = logging.getLogger("investorgpt.calibration_engine")

class CalibrationEngine:
    """Valuation Calibration Engine: monitors prediction errors and recommends heuristic adjustments."""

    def log_valuation(
        self,
        db: Session,
        ticker: str,
        user_id: str,
        predicted_rev: float,
        predicted_eps: float,
        predicted_val: float
    ) -> HistoricalValuationRecord:
        """Stores a newly calculated valuation record for future calibration."""
        logger.info(f"Logging valuation record for {ticker} by user {user_id}")
        record = HistoricalValuationRecord(
            ticker=ticker.upper(),
            user_id=user_id,
            predicted_revenue=predicted_rev,
            predicted_eps=predicted_eps,
            predicted_fair_value=predicted_val
        )
        db.add(record)
        db.commit()
        db.refresh(record)
        return record

    async def calibrate_records(self, db: Session, ticker: str) -> List[Dict[str, Any]]:
        """Compares past logged predictions against subsequent actual earnings results from yfinance."""
        logger.info(f"Calibrating logged valuation records for {ticker}")
        
        # 1. Fetch uncalibrated records
        records = db.query(HistoricalValuationRecord).filter(
            HistoricalValuationRecord.ticker == ticker.upper(),
            HistoricalValuationRecord.is_calibrated == 0
        ).all()
        
        if not records:
            return []

        # 2. Get actual results from yfinance
        provider = YahooProvider()
        try:
            financials = await provider.get_financial_statements(ticker.upper())
            rev_actuals = financials.get("revenue", {})
            eps_actuals = financials.get("diluted_eps", {})
        except Exception as e:
            logger.error(f"Failed to fetch actual metrics for calibration: {e}")
            return []

        calibrated = []
        for r in records:
            # Match actuals by closest year or mock/interpolate if within same calendar period
            # For simplicity in this demo, match by latest reported calendar year
            years = [y for y in rev_actuals.keys() if y.isdigit()]
            if not years:
                continue
                
            latest_y = max(years)
            actual_rev = rev_actuals.get(latest_y, 0.0)
            actual_eps = eps_actuals.get(latest_y, 0.0)
            if actual_rev > 0:
                pred_rev = float(r.predicted_revenue) if r.predicted_revenue is not None else 0.0
                pred_eps = float(r.predicted_eps) if r.predicted_eps is not None else 0.0
                error_rev = abs(pred_rev - actual_rev) / actual_rev
                error_eps = abs(pred_eps - actual_eps) / max(0.1, abs(actual_eps))
                mape = (error_rev + error_eps) / 2.0 * 100.0
                
                # Update record
                r.reported_revenue = actual_rev
                r.reported_eps = actual_eps
                r.forecast_error_mape = mape
                r.is_calibrated = 1
                
                db.commit()
                calibrated.append({
                    "id": r.id,
                    "ticker": r.ticker,
                    "predicted_fair_value": float(r.predicted_fair_value),
                    "forecast_error_mape": float(mape)
                })

        return calibrated

    def get_calibration_feedback(self, db: Session, ticker: str) -> Dict[str, Any]:
        """Analyzes historical error rates by ticker and suggests adjusted heuristics."""
        records = db.query(HistoricalValuationRecord).filter(
            HistoricalValuationRecord.ticker == ticker.upper(),
            HistoricalValuationRecord.is_calibrated == 1
        ).all()
        
        if not records:
            return {
                "average_mape": 0.0,
                "total_runs": 0,
                "recommendation": "Insufficient calibration history. Keep logging model outputs.",
                "adjusted_heuristics": {}
            }
            
        mapes = [float(r.forecast_error_mape) for r in records if r.forecast_error_mape is not None]
        avg_mape = sum(mapes) / len(mapes) if mapes else 0.0
        
        # Build recommendation based on error threshold
        if avg_mape > 25.0:
            rec = "Average error rate is high (>25%). Recommend increasing WACC margin by +1.0% to reflect macro risk and dampening growth CAGR expectations."
            adj = {"wacc_premium": 0.01, "growth_discount": -0.015}
        elif avg_mape > 15.0:
            rec = "Model error is moderate (15-25%). Recommend slight growth rate safety buffer."
            adj = {"growth_discount": -0.005}
        else:
            rec = "Model predictions are highly reliable (<15% error). Maintain current valuation weights."
            adj = {}

        return {
            "average_mape": round(avg_mape, 1),
            "total_runs": len(records),
            "recommendation": rec,
            "adjusted_heuristics": adj
        }
