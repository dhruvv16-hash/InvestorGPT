from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import logging
from app.database.db import get_db
from app.models.models import Company, Analysis, Financial, TechnicalData, ValuationResult
from app.engines.debate_engine import DebateEngine

logger = logging.getLogger("investorgpt.routes_debate")
router = APIRouter(prefix="/debate", tags=["AI Debate Studio"])

@router.get("/{ticker}")
async def get_debate_studio(
    ticker: str,
    db: Session = Depends(get_db)
):
    ticker_clean = ticker.upper().strip()
    if not ticker_clean:
        raise HTTPException(status_code=400, detail="Invalid ticker symbol.")
        
    try:
        # Resolve company
        company = db.query(Company).filter(Company.ticker == ticker_clean).first()
        company_name = company.name if company else ticker_clean
        
        # Load latest analysis metrics for context
        metrics = {
            "f_score": 6,
            "z_score": 2.5,
            "rsi": 52.0,
            "dcf_value": 100.0,
            "current_price": 95.0,
            "sma_20": 94.0
        }
        
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
                
                price_val = next((float(f.value) for f in financials if f.metric_name == "current_price"), None)
                if price_val: metrics["current_price"] = price_val
                
                f_val = next((int(f.value) for f in financials if f.metric_name == "f_score"), None)
                if f_val: metrics["f_score"] = f_val
                
                z_val = next((float(f.value) for f in financials if f.metric_name == "z_score"), None)
                if z_val: metrics["z_score"] = z_val
                
                rsi_val = next((float(t.value) for t in techs if t.indicator_name == "RSI"), None)
                if rsi_val: metrics["rsi"] = rsi_val
                
                sma_val = next((float(t.value) for t in techs if t.indicator_name == "SMA_20"), None)
                if sma_val: metrics["sma_20"] = sma_val
                
                dcf_obj = next((v for v in vals if v.model_name == "DCF"), None)
                if dcf_obj and dcf_obj.fair_value is not None:
                    metrics["dcf_value"] = float(dcf_obj.fair_value)

        engine = DebateEngine()
        result = engine.generate_debate(ticker_clean, company_name, metrics)
        return result
    except Exception as e:
        logger.error(f"Failed to generate debate studio for {ticker_clean}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
