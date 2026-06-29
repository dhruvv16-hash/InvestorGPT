from fastapi import APIRouter, Depends, status
from sqlalchemy import text
from sqlalchemy.orm import Session
from app.database.db import get_db
from app.models.models import RecentSearch, SearchClickLog
import logging
from datetime import datetime, timezone

logger = logging.getLogger("investorgpt.routes_settings")
router = APIRouter(prefix="/settings", tags=["Platform Settings"])

@router.post("/clear-cache")
def clear_platform_cache(db: Session = Depends(get_db)):
    try:
        # Clear recent searches and search click logs to reset dropdown recommendations
        db.query(RecentSearch).delete()
        db.query(SearchClickLog).delete()
        db.commit()
        return {"status": "success", "message": "Search cache and click statistics cleared."}
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to clear database cache: {e}")
        return {"status": "error", "detail": str(e)}

@router.get("/health")
def check_platform_health(db: Session = Depends(get_db)):
    try:
        # 1. DB connection check
        db.execute(text("SELECT 1"))
        
        # 2. Query company count
        from app.models.models import Company
        company_count = db.query(Company).count()
        
        return {
            "status": "healthy",
            "database": "connected",
            "indexed_companies": company_count,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return {
            "status": "unhealthy",
            "detail": str(e)
        }
