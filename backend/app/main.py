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
from app.api.routes_auth import router as auth_router
from app.api.routes_supply_chain import router as supply_chain_router
from app.api.routes_strategy import router as strategy_router


# Auto-create SQLite database tables if missing
from app.database.db import engine, Base
import app.models.models as models
from sqlalchemy import text
Base.metadata.create_all(bind=engine)

# Programmatically check and add user_id column to analyses if missing
try:
    with engine.connect() as conn:
        res = conn.execute(text("PRAGMA table_info(analyses)"))
        columns = [row[1] for row in res.fetchall()]
        if "user_id" not in columns:
            conn.execute(text("ALTER TABLE analyses ADD COLUMN user_id VARCHAR(36)"))
            conn.commit()
except Exception as e:
    logger.warning(f"Auto-migration user_id check failed: {e}")

# Database Seeding: Populate popular stocks on startup if the database is clean
try:
    from app.database.db import SessionLocal
    from app.models.models import Company
    db_seed = SessionLocal()
    
    seed_companies = [
        Company(ticker="AAPL", exchange="NASDAQ", country="United States", currency="USD", sector="Technology", industry="Consumer Electronics", name="Apple Inc.", description="Apple Inc. designs, manufactures, and markets smartphones, personal computers, tablets, wearables, and accessories worldwide.", website="https://www.apple.com"),
        Company(ticker="NVDA", exchange="NASDAQ", country="United States", currency="USD", sector="Technology", industry="Semiconductors", name="NVIDIA Corporation", description="NVIDIA Corporation designs graphics processing units for the gaming and professional markets, as well as system on a chip units.", website="https://www.nvidia.com"),
        Company(ticker="MSFT", exchange="NASDAQ", country="United States", currency="USD", sector="Technology", industry="Software - Infrastructure", name="Microsoft Corporation", description="Microsoft Corporation develops, licenses, and supports software, services, devices, and solutions worldwide.", website="https://www.microsoft.com"),
        Company(ticker="TSLA", exchange="NASDAQ", country="United States", currency="USD", sector="Consumer Discretionary", industry="Auto Manufacturers", name="Tesla, Inc.", description="Tesla, Inc. designs, develops, manufactures, sells, and leases fully electric vehicles, energy generation and storage systems.", website="https://www.tesla.com"),
        Company(ticker="RELIANCE.NS", exchange="NSE", country="India", currency="INR", sector="Energy", industry="Oil & Gas", name="Reliance Industries Limited", description="Reliance Industries Limited engages in hydrocarbon exploration and production, refining, retail, and digital services.", website="https://www.ril.com"),
        Company(ticker="AMZN", exchange="NASDAQ", country="United States", currency="USD", sector="Consumer Discretionary", industry="Internet Retail", name="Amazon.com, Inc.", description="Amazon.com, Inc. engages in the retail sale of consumer products and services globally.", website="https://www.amazon.com"),
        Company(ticker="GOOGL", exchange="NASDAQ", country="United States", currency="USD", sector="Technology", industry="Internet Content & Information", name="Alphabet Inc.", description="Alphabet Inc. offers search, ads, maps, YouTube, Google Play, Cloud, and other hardware products.", website="https://www.google.com"),
        Company(ticker="META", exchange="NASDAQ", country="United States", currency="USD", sector="Technology", industry="Internet Content & Information", name="Meta Platforms, Inc.", description="Meta Platforms, Inc. focuses on building products that enable people to connect and share.", website="https://www.meta.com"),
        Company(ticker="AMD", exchange="NASDAQ", country="United States", currency="USD", sector="Technology", industry="Semiconductors", name="Advanced Micro Devices, Inc.", description="Advanced Micro Devices, Inc. operates as a semiconductor company worldwide.", website="https://www.amd.com"),
        Company(ticker="TSM", exchange="NYSE", country="Taiwan", currency="USD", sector="Technology", industry="Semiconductors", name="Taiwan Semiconductor Manufacturing Company Limited", description="TSMC manufactures and sells integrated circuits and other semiconductor devices.", website="https://www.tsmc.com"),
        Company(ticker="AVGO", exchange="NASDAQ", country="United States", currency="USD", sector="Technology", industry="Semiconductors", name="Broadcom Inc.", description="Broadcom Inc. designs, develops, and supplies semiconductor and infrastructure software solutions.", website="https://www.broadcom.com"),
        Company(ticker="ASML", exchange="NASDAQ", country="Netherlands", currency="USD", sector="Technology", industry="Semiconductor Equipment & Materials", name="ASML Holding N.V.", description="ASML Holding N.V. develops, produces, markets, sells, and services advanced semiconductor equipment systems.", website="https://www.asml.com"),
        Company(ticker="NFLX", exchange="NASDAQ", country="United States", currency="USD", sector="Consumer Discretionary", industry="Entertainment", name="Netflix, Inc.", description="Netflix, Inc. provides entertainment services with paid memberships in approximately 190 countries.", website="https://www.netflix.com"),
        Company(ticker="JPM", exchange="NYSE", country="United States", currency="USD", sector="Financial Services", industry="Banks - Diversified", name="JPMorgan Chase & Co.", description="JPMorgan Chase & Co. operates as a financial services company worldwide.", website="https://www.jpmorganchase.com"),
        Company(ticker="LLY", exchange="NYSE", country="United States", currency="USD", sector="Healthcare", industry="Drug Manufacturers - General", name="Eli Lilly and Company", description="Eli Lilly and Company discovers, develops, and markets human pharmaceuticals worldwide.", website="https://www.lilly.com"),
        Company(ticker="WMT", exchange="NYSE", country="United States", currency="USD", sector="Consumer Defensive", industry="Discount Stores", name="Walmart Inc.", description="Walmart Inc. operates supercenters, supermarkets, hypermarkets, and warehouse clubs worldwide.", website="https://www.walmart.com"),
        Company(ticker="XOM", exchange="NYSE", country="United States", currency="USD", sector="Energy", industry="Oil & Gas", name="Exxon Mobil Corporation", description="Exxon Mobil Corporation explores for, produces, and sells crude oil and natural gas.", website="https://www.exxonmobil.com"),
        Company(ticker="JNJ", exchange="NYSE", country="United States", currency="USD", sector="Healthcare", industry="Drug Manufacturers - General", name="Johnson & Johnson", description="Johnson & Johnson researches and develops, manufactures, and sells various products in the healthcare field.", website="https://www.jnj.com"),
        Company(ticker="V", exchange="NYSE", country="United States", currency="USD", sector="Financial Services", industry="Credit Services", name="Visa Inc.", description="Visa Inc. operates as a payments technology company worldwide.", website="https://www.visa.com"),
        Company(ticker="PG", exchange="NYSE", country="United States", currency="USD", sector="Consumer Defensive", industry="Household & Personal Products", name="The Procter & Gamble Company", description="The Procter & Gamble Company provides branded consumer packaged goods worldwide.", website="https://www.pg.com"),
        Company(ticker="INFY.NS", exchange="NSE", country="India", currency="INR", sector="Technology", industry="Information Technology Services", name="Infosys Limited", description="Infosys Limited provides consulting, technology, outsourcing, and next-generation digital services.", website="https://www.infosys.com"),
        Company(ticker="TCS.NS", exchange="NSE", country="India", currency="INR", sector="Technology", industry="Information Technology Services", name="Tata Consultancy Services Limited", description="Tata Consultancy Services Limited provides information technology services and business solutions.", website="https://www.tcs.com"),
        Company(ticker="HDFCBANK.NS", exchange="NSE", country="India", currency="INR", sector="Financial Services", industry="Banks - Regional", name="HDFC Bank Limited", description="HDFC Bank Limited provides banking and financial services to individuals and businesses in India.", website="https://www.hdfcbank.com"),
        Company(ticker="ICICIBANK.NS", exchange="NSE", country="India", currency="INR", sector="Financial Services", industry="Banks - Regional", name="ICICI Bank Limited", description="ICICI Bank Limited provides banking products and financial services.", website="https://www.icicibank.com"),
        Company(ticker="WIPRO.NS", exchange="NSE", country="India", currency="INR", sector="Technology", industry="Information Technology Services", name="Wipro Limited", description="Wipro Limited operates as an information technology, consulting, and business process services company.", website="https://www.wipro.com"),
        Company(ticker="TATAMOTORS.NS", exchange="NSE", country="India", currency="INR", sector="Consumer Discretionary", industry="Auto Manufacturers", name="Tata Motors Limited", description="Tata Motors Limited designs, manufactures, and sells passenger cars, utility vehicles, and trucks.", website="https://www.tatamotors.com"),
        Company(ticker="SBIN.NS", exchange="NSE", country="India", currency="INR", sector="Financial Services", industry="Banks - Regional", name="State Bank of India", description="State Bank of India provides banking and financial services in India and internationally.", website="https://www.sbi.co.in"),
        Company(ticker="ITC.NS", exchange="NSE", country="India", currency="INR", sector="Consumer Defensive", industry="Tobacco", name="ITC Limited", description="ITC Limited manufactures and sells cigarettes, foods, packaging, and hotel services in India.", website="https://www.itcportal.com"),
        Company(ticker="BHARTIARTL.NS", exchange="NSE", country="India", currency="INR", sector="Telecommunications", industry="Telecom Services", name="Bharti Airtel Limited", description="Bharti Airtel Limited operates as a telecommunications company in 18 countries.", website="https://www.airtel.in"),
        Company(ticker="HINDUNILVR.NS", exchange="NSE", country="India", currency="INR", sector="Consumer Defensive", industry="Household & Personal Products", name="Hindustan Unilever Limited", description="Hindustan Unilever Limited manufactures and sells home care, personal care, and food products.", website="https://www.hul.co.in")
    ]
    
    seeded_count = 0
    for seed in seed_companies:
        exists = db_seed.query(Company).filter(Company.ticker == seed.ticker).first()
        if not exists:
            db_seed.add(seed)
            seeded_count += 1
            
    if seeded_count > 0:
        db_seed.commit()
        logger.info(f"Successfully seeded {seeded_count} new benchmark companies into database.")
    
    db_seed.close()
except Exception as e:
    logger.warning(f"Database seeding failed: {e}")

app.include_router(auth_router, prefix="/api/v1")
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




