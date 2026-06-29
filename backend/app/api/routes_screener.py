from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
import logging
from app.database.db import get_db
from app.engines.screener_engine import ScreenerEngine

logger = logging.getLogger("investorgpt.routes_screener")
router = APIRouter(prefix="/screener", tags=["AI NLP Screener"])

@router.get("")
async def run_screener(
    query: str = Query(..., description="The natural language screening query, e.g., 'undervalued AI stocks'"),
    db: Session = Depends(get_db)
):
    if not query.strip():
        raise HTTPException(status_code=400, detail="Query string cannot be empty.")
    
    try:
        engine = ScreenerEngine()
        results = engine.screen_companies(db, query)
        return {
            "query": query,
            "results_count": len(results),
            "results": results
        }
    except Exception as e:
        logger.error(f"Screener execution failed for query '{query}': {e}")
        raise HTTPException(status_code=500, detail=str(e))
