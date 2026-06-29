import asyncio
import time
import logging
from typing import Any
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.database.db import get_db
from app.dependencies import get_event_bus
from app.orchestration.event_bus import EventBus
from app.engines.competitor_engine import CompetitorEngine
from app.orchestration.workflow_orchestrator import WorkflowOrchestrator
from app.models.models import Company, Analysis

logger = logging.getLogger("investorgpt.routes_compare")
router = APIRouter(tags=["Comparison"])

class CompareRequest(BaseModel):
    tickers: list[str]

async def ensure_analysis_completed(ticker: str, db: Session, event_bus: EventBus):
    ticker_clean = ticker.strip().upper()
    if not ticker_clean:
        return
        
    # Check if company exists and has a completed analysis
    company = db.query(Company).filter(Company.ticker == ticker_clean).first()
    analysis = None
    if company:
        analysis = db.query(Analysis).filter(
            Analysis.company_id == company.id,
            Analysis.state == "COMPLETED"
        ).order_by(Analysis.created_at.desc()).first()
        
    if analysis:
        return
        
    # Trigger new analysis
    orchestrator = WorkflowOrchestrator(db, event_bus)
    try:
        logger.info(f"Triggering on-the-fly analysis for compared ticker: {ticker_clean}")
        analysis_id = await orchestrator.run_analysis(ticker_clean)
        
        # Poll for completion (up to 15 seconds)
        start_time = time.time()
        while time.time() - start_time < 15.0:
            db.expire_all()
            a = db.query(Analysis).filter(Analysis.id == analysis_id).first()
            if a and a.state in ["COMPLETED", "FAILED"]:
                break
            await asyncio.sleep(0.5)
    except Exception as e:
        logger.warning(f"Could not trigger/wait analysis for {ticker_clean}: {e}")

@router.post("/compare", status_code=status.HTTP_200_OK)
async def compare_companies(
    req: CompareRequest,
    db: Session = Depends(get_db),
    event_bus: EventBus = Depends(get_event_bus)
):
    if not req.tickers:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Must provide at least one ticker symbol"
        )
    
    # 1. Run/wait for analyses to complete in parallel
    await asyncio.gather(*[ensure_analysis_completed(t, db, event_bus) for t in req.tickers], return_exceptions=True)
    
    engine = CompetitorEngine()
    comparison = []
    
    # 2. Extract detailed metrics for each ticker
    for ticker in req.tickers:
        res = await engine.get_detailed_metrics(ticker, db)
        if res:
            comparison.append(res)
        else:
            # Fallback to basic metrics if analysis failed or timed out
            logger.info(f"Analysis fallback triggered for compared ticker: {ticker}")
            fallback_res = await engine._fetch_peer_metrics(ticker)
            if fallback_res:
                comparison.append({
                    **fallback_res,
                    "f_score": None,
                    "z_score": None,
                    "fair_value": None,
                    "rsi": None,
                    "sma_20": None,
                    "sentiment": None,
                    "risk_level": None,
                    "operating_cash_flow": None,
                    "capital_expenditures": None
                })
            
    return {"comparison": comparison}

@router.get("/compare/export")
async def export_comparison(
    tickers: str,
    format: str = "pdf",
    db: Session = Depends(get_db)
):
    ticker_list = [t.strip().upper() for t in tickers.split(",") if t.strip()]
    if not ticker_list:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Must provide at least one ticker symbol"
        )
        
    engine = CompetitorEngine()
    comparison = []
    
    for ticker in ticker_list:
        res = await engine.get_detailed_metrics(ticker, db)
        if res:
            comparison.append(res)
        else:
            fallback_res = await engine._fetch_peer_metrics(ticker)
            if fallback_res:
                comparison.append({
                    **fallback_res,
                    "f_score": None,
                    "z_score": None,
                    "fair_value": None,
                    "rsi": None,
                    "sma_20": None,
                    "sentiment": None,
                    "risk_level": None,
                    "operating_cash_flow": None,
                    "capital_expenditures": None
                })
                
    if not comparison:
        raise HTTPException(status_code=404, detail="No comparison data resolved")
        
    from app.services.export_service import ExportService
    exporter = ExportService()
    
    from fastapi.responses import FileResponse
    if format.lower() == "pdf":
        path = exporter.generate_comparison_report_pdf(comparison)
        return FileResponse(path, filename="stock_comparison_report.pdf", media_type="application/pdf")
    else:
        path = exporter.generate_comparison_report_excel(comparison)
        return FileResponse(
            path,
            filename="stock_comparison_report.xlsx",
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )

