import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings

# Configure logging
logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("investorgpt")

app = FastAPI(
    title="InvestorGPT API",
    description="Autonomous, Explainable, Multi-Agent Investment Research Platform Backend API",
    version="1.0.0",
)

# CORS middleware config
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify exact origins
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {
        "name": "InvestorGPT API",
        "version": "1.0.0",
        "status": "healthy",
        "environment": settings.ENVIRONMENT,
    }

from app.api.routes_analyze import router as analyze_router
from app.api.routes_compare import router as compare_router
from app.api.routes_chat import router as chat_router
from app.api.routes_search import router as search_router
from app.api.routes_modeling import router as modeling_router
from app.api.routes_portfolio import router as portfolio_router
from app.api.routes_technical import router as technical_router
from app.api.routes_news import router as news_router
from app.api.routes_history import router as history_router
from app.api.routes_settings import router as settings_router
from app.api.routes_macro import router as macro_router
from app.api.routes_industry import router as industry_router
from app.api.routes_business import router as business_router
from app.api.routes_management import router as management_router
from app.api.routes_capital import router as capital_router
from app.api.routes_accounting import router as accounting_router
from app.api.routes_ownership import router as ownership_router
from app.api.routes_alternative import router as alternative_router
from app.api.routes_forecasting import router as forecasting_router
from app.api.routes_debate import router as debate_router
from app.api.routes_watchlist import router as watchlist_router
from app.api.routes_timeline import router as timeline_router
from app.api.routes_screener import router as screener_router
from app.api.routes_explainability import router as explainability_router
from app.api.routes_backtest import router as backtest_router
from app.api.routes_calibration import router as calibration_router
from app.api.routes_supply_chain import router as supply_chain_router
from app.api.routes_strategy import router as strategy_router


# Auto-create SQLite database tables if missing
from app.database.db import engine, Base
import app.models.models as models
Base.metadata.create_all(bind=engine)

app.include_router(analyze_router, prefix="/api/v1")
app.include_router(compare_router, prefix="/api/v1")
app.include_router(chat_router, prefix="/api/v1")
app.include_router(search_router, prefix="/api/v1")
app.include_router(modeling_router, prefix="/api/v1")
app.include_router(portfolio_router, prefix="/api/v1")
app.include_router(technical_router, prefix="/api/v1")
app.include_router(news_router, prefix="/api/v1")
app.include_router(history_router, prefix="/api/v1")
app.include_router(settings_router, prefix="/api/v1")
app.include_router(macro_router, prefix="/api/v1")
app.include_router(industry_router, prefix="/api/v1")
app.include_router(business_router, prefix="/api/v1")
app.include_router(management_router, prefix="/api/v1")
app.include_router(capital_router, prefix="/api/v1")
app.include_router(accounting_router, prefix="/api/v1")
app.include_router(ownership_router, prefix="/api/v1")
app.include_router(alternative_router, prefix="/api/v1")
app.include_router(forecasting_router, prefix="/api/v1")
app.include_router(debate_router, prefix="/api/v1")
app.include_router(watchlist_router, prefix="/api/v1")
app.include_router(timeline_router, prefix="/api/v1")
app.include_router(screener_router, prefix="/api/v1")
app.include_router(explainability_router, prefix="/api/v1")
app.include_router(backtest_router, prefix="/api/v1")
app.include_router(calibration_router, prefix="/api/v1")
app.include_router(supply_chain_router, prefix="/api/v1")
app.include_router(strategy_router, prefix="/api/v1")




