from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database.db import get_db
from app.models.models import Analysis, Company
import logging

logger = logging.getLogger("investorgpt.routes_history")
router = APIRouter(prefix="/research-history", tags=["Research History"])

@router.get("")
def get_research_history(user_id: str, db: Session = Depends(get_db)):
    # We query all completed analyses joined with company details
    analyses = db.query(Analysis).join(Company).filter(
        Analysis.state == "COMPLETED"
    ).order_by(Analysis.created_at.desc()).all()
    
    results = []
    for a in analyses:
        results.append({
            "analysis_id": a.id,
            "ticker": a.company.ticker,
            "company_name": a.company.name,
            "exchange": a.company.exchange,
            "recommendation": a.recommendation,
            "confidence": float(a.confidence) if a.confidence is not None else None,
            "created_at": a.created_at.isoformat()
        })
    return {"history": results}

@router.delete("/{analysis_id}")
def delete_research_history(analysis_id: str, db: Session = Depends(get_db)):
    analysis = db.query(Analysis).filter(Analysis.id == analysis_id).first()
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis record not found.")
    
    db.delete(analysis)
    db.commit()
    return {"status": "success"}
