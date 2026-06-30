from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database.db import get_db
from app.dependencies import get_event_bus, get_current_user
from app.orchestration.event_bus import EventBus
from app.orchestration.workflow_orchestrator import WorkflowOrchestrator
from app.schemas.schemas import AnalyzeRequest, AnalyzeResponse, AnalysisDetailResponse
from app.models.models import Analysis, Company, Financial, TechnicalData, ValuationResult, User

router = APIRouter(tags=["Analysis"])

@router.post("/analyze", response_model=AnalyzeResponse, status_code=status.HTTP_202_ACCEPTED)
async def start_analysis(
    req: AnalyzeRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    event_bus: EventBus = Depends(get_event_bus)
):
    orchestrator = WorkflowOrchestrator(db, event_bus)
    try:
        analysis_id = await orchestrator.run_analysis(req.query)
        
        # Query created analysis and set user_id ownership
        analysis = db.query(Analysis).filter(Analysis.id == analysis_id).first()
        if analysis:
            analysis.user_id = current_user.id
            db.commit()
            
        company = db.query(Company).filter(Company.id == analysis.company_id).first()

        return AnalyzeResponse(
            analysis_id=analysis_id,
            state=analysis.state,
            company={
                "ticker": company.ticker,
                "exchange": company.exchange,
                "country": company.country,
                "currency": company.currency,
                "sector": company.sector,
                "industry": company.industry,
                "name": company.name,
                "description": company.description,
                "website": company.website
            },
            poll_url=f"/api/v1/analyze/{analysis_id}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

@router.get("/analyze/{analysis_id}", response_model=AnalysisDetailResponse)
async def get_analysis_status(
    analysis_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    analysis = db.query(Analysis).filter(Analysis.id == analysis_id).first()
    if not analysis:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Analysis with ID {analysis_id} not found"
        )
        
    if analysis.user_id and analysis.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access to this analysis is restricted to the owner."
        )
    
    company = db.query(Company).filter(Company.id == analysis.company_id).first()
    
    # Query all computed/fetched records
    financials = db.query(Financial).filter(Financial.analysis_id == analysis_id).all()
    tech_data = db.query(TechnicalData).filter(TechnicalData.analysis_id == analysis_id).all()
    valuation_results = db.query(ValuationResult).filter(ValuationResult.analysis_id == analysis_id).all()

    # 1. Parse valuation results and calculate sensitivity matrix for DCF
    serialized_valuations = []
    from app.engines.valuation.dcf_engine import calculate_dcf_sensitivity
    
    for v in valuation_results:
        val_dict = {
            "model_name": v.model_name,
            "fair_value": float(v.fair_value) if v.fair_value is not None else None,
            "assumptions": v.assumptions,
            "confidence": float(v.confidence)
        }
        
        if v.model_name == "DCF" and v.assumptions:
            try:
                fcf_base = float(v.assumptions.get("fcf_base", 0.0))
                growth_rate = float(v.assumptions.get("growth_rate", 0.0))
                wacc = float(v.assumptions.get("wacc", 0.0))
                terminal_growth = float(v.assumptions.get("terminal_growth", 0.0))
                years = int(v.assumptions.get("years", 5))
                net_debt = float(v.assumptions.get("net_debt", 0.0))
                shares = float(v.assumptions.get("shares_outstanding", 1.0))
                
                if shares > 0:
                    sens = calculate_dcf_sensitivity(
                        fcf_base=fcf_base,
                        growth_rate=growth_rate,
                        wacc=wacc,
                        terminal_growth=terminal_growth,
                        years=years,
                        net_debt=net_debt,
                        shares_outstanding=shares
                    )
                    val_dict["sensitivity_matrix"] = sens
            except Exception as e:
                import logging
                logging.getLogger("investorgpt.api").error(f"Failed to calculate sensitivity: {e}")
                
        serialized_valuations.append(val_dict)

    # 2. Build dynamic consensus timeline events
    consensus_timeline = []
    
    consensus_timeline.append({
        "title": "Data Ingestion & Ingestion",
        "description": f"Successfully ingested market price, annual balance sheets, cash flow statements, and daily technical data from Yahoo Finance API for {company.name} ({company.ticker}).",
        "status": "COMPLETED",
        "vote": None
    })
    
    f_score = next((int(f.value) for f in financials if f.metric_name == "f_score"), None)
    if f_score is not None:
        fund_vote = "BUY" if f_score >= 7 else "HOLD" if f_score >= 4 else "SELL"
        consensus_timeline.append({
            "title": "Fundamental Agent Analysis",
            "description": f"Evaluated current and past-year financials to compute a Piotroski F-Score of {f_score}/9, indicating {'strong' if f_score >= 7 else 'moderate' if f_score >= 4 else 'weak'} financial health.",
            "status": "COMPLETED",
            "vote": fund_vote
        })
        
    dcf_val = next((v for v in valuation_results if v.model_name == "DCF"), None)
    if dcf_val and dcf_val.fair_value is not None:
        price_val = next((float(f.value) for f in financials if f.metric_name == "current_price"), None)
        if price_val:
            upside = ((float(dcf_val.fair_value) - price_val) / price_val) * 100
            val_vote = "BUY" if upside > 15.0 else "SELL" if upside < -5.0 else "HOLD"
            consensus_timeline.append({
                "title": "Intrinsic Valuation Agent",
                "description": f"Constructed a multi-scenario DCF model with base WACC of {dcf_val.assumptions.get('wacc', 0.0)*100:.1f}%. Calculated fair value of {company.currency} {float(dcf_val.fair_value):.2f} ({upside:+.1f}% margin of safety).",
                "status": "COMPLETED",
                "vote": val_vote
            })
            
    rsi_val = next((float(t.value) for t in tech_data if t.indicator_name == "RSI"), None)
    if rsi_val is not None:
        tech_vote = "BUY" if rsi_val < 30.0 else "SELL" if rsi_val > 70.0 else "HOLD"
        consensus_timeline.append({
            "title": "Momentum & Technical Agent",
            "description": f"Evaluated Daily RSI (14) at {rsi_val:.2f}, indicating a {'short-term oversold state (bullish)' if rsi_val < 30.0 else 'short-term overbought state (bearish)' if rsi_val > 70.0 else 'neutral momentum state'}.",
            "status": "COMPLETED",
            "vote": tech_vote
        })
        
    sentiment_val = next((v for v in valuation_results if v.model_name == "NEWS_SENTIMENT"), None)
    if sentiment_val:
        sent_label = sentiment_val.assumptions.get("overall_sentiment") if sentiment_val.assumptions else None
        if sent_label:
            sent_vote = "BUY" if sent_label == "BULLISH" else "SELL" if sent_label == "BEARISH" else "HOLD"
            consensus_timeline.append({
                "title": "News & Sentiment Agent",
                "description": f"Crawled recent news and computed overall sentiment as {sent_label} with a score of {sentiment_val.assumptions.get('sentiment_score', 0.0)*100:.0f}%.",
                "status": "COMPLETED",
                "vote": sent_vote
            })
            
    if analysis.recommendation:
        consensus_timeline.append({
            "title": "Committee Consensus Decision",
            "description": f"Combined weighted engine votes to issue a final {analysis.recommendation} recommendation with {round((analysis.confidence or 0.0)*100)}% consensus weight.",
            "status": "COMPLETED",
            "vote": analysis.recommendation
        })

    return AnalysisDetailResponse(
        analysis_id=analysis.id,
        state=analysis.state,
        company={
            "ticker": company.ticker,
            "exchange": company.exchange,
            "country": company.country,
            "currency": company.currency,
            "sector": company.sector,
            "industry": company.industry,
            "name": company.name,
            "description": company.description,
            "website": company.website
        },
        recommendation=analysis.recommendation,
        confidence=analysis.confidence,
        financials=[
            {
                "metric_name": f.metric_name,
                "value": float(f.value) if f.value is not None else None,
                "fiscal_period": f.fiscal_period,
                "source": f.source,
                "confidence": float(f.confidence),
                "retrieved_at": f.retrieved_at.isoformat()
            } for f in financials
        ],
        technical_data=[
            {
                "timeframe": t.timeframe,
                "indicator_name": t.indicator_name,
                "value": float(t.value) if t.value is not None else None,
                "computed_at": t.computed_at.isoformat()
            } for t in tech_data
        ],
        valuation_results=serialized_valuations,
        consensus_timeline=consensus_timeline
    )

@router.get("/report/{analysis_id}/export")
async def export_report(
    analysis_id: str,
    format: str = "pdf",
    db: Session = Depends(get_db)
):
    analysis = db.query(Analysis).filter(Analysis.id == analysis_id).first()
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")
    company = db.query(Company).filter(Company.id == analysis.company_id).first()
    financials = db.query(Financial).filter(Financial.analysis_id == analysis_id).all()

    from app.services.export_service import ExportService
    exporter = ExportService()

    if format.lower() == "pdf":
        path = exporter.generate_pdf_report(analysis, company, financials)
        filename = f"{company.ticker}_research_report.pdf"
        media_type = "application/pdf"
    else:
        path = exporter.generate_excel_report(analysis, company, financials)
        filename = f"{company.ticker}_financial_data.xlsx"
        media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

    from fastapi.responses import FileResponse
    return FileResponse(path, filename=filename, media_type=media_type)




