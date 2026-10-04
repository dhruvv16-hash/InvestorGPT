import asyncio
import json
import logging
import time
import redis
from app.config import settings
from app.database.db import SessionLocal
from app.orchestration.workflow_orchestrator import WorkflowOrchestrator
from app.orchestration.event_bus import EventBus
from app.models.models import Analysis

logging.basicConfig(level=settings.LOG_LEVEL)
logger = logging.getLogger("investorgpt.worker")

async def process_job(redis_client, job_data_str: str):
    job_data = json.loads(job_data_str)
    analysis_id = job_data.get("analysis_id")
    query = job_data.get("query")
    
    if not analysis_id or not query:
        logger.error(f"Invalid job data: {job_data}")
        return

    logger.info(f"Worker picked up analysis_id: {analysis_id} for query: {query}")
    
    db = SessionLocal()
    event_bus = EventBus()
    
    # Update state to RUNNING
    analysis = db.query(Analysis).filter(Analysis.id == analysis_id).first()
    if analysis:
        analysis.state = "RUNNING"
        db.commit()
    
    orchestrator = WorkflowOrchestrator(db, event_bus)
    
    try:
        await orchestrator.resume_analysis(analysis_id, query)
    except Exception as e:
        logger.exception(f"Worker failed processing analysis_id {analysis_id}: {e}")
        analysis = db.query(Analysis).filter(Analysis.id == analysis_id).first()
        if analysis:
            analysis.state = "FAILED"
            db.commit()
    finally:
        db.close()

def main():
    logger.info("Starting background analysis worker...")
    redis_client = redis.Redis.from_url(settings.REDIS_URL)
    
    # We use an event loop to run async tasks inside a sync while loop
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    
    while True:
        try:
            # BLPOP blocks until a job is available or timeout is reached
            result = redis_client.blpop("analysis_jobs", timeout=5)
            if result:
                _, job_data_str = result
                loop.run_until_complete(process_job(redis_client, job_data_str))
        except Exception as e:
            logger.error(f"Redis connection or processing error: {e}")
            time.sleep(5)

if __name__ == "__main__":
    main()
