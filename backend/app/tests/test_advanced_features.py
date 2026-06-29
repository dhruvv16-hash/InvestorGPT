import pytest
import datetime
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.database.db import Base
from app.models.models import Company, Analysis, Financial, ValuationResult, TechnicalData, WatchlistTrigger
from app.engines.ownership_engine import OwnershipEngine
from app.engines.alternative_engine import AlternativeEngine
from app.engines.forecasting_engine import ForecastingEngine
from app.engines.debate_engine import DebateEngine
from app.engines.timeline_engine import TimelineEngine
from app.engines.portfolio_optimization import PortfolioOptimizationEngine
from app.engines.screener_engine import ScreenerEngine

# Create clean in-memory sqlite engine for testing database queries
TEST_SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(TEST_SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(scope="function")
def db_session():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)

def test_ownership_engine():
    engine = OwnershipEngine()
    res = engine.get_ownership_profile("AAPL", "Apple Inc.", 3000000000000)
    
    assert res["ticker"] == "AAPL"
    assert "top_holders" in res
    assert "distribution" in res
    assert res["distribution"]["institutional_pct"] == 58.2
    assert len(res["top_holders"]) > 0

def test_alternative_engine():
    engine = AlternativeEngine()
    res = engine.get_alternative_data_signals("NVDA", "NVIDIA Corp.")
    
    assert res["ticker"] == "NVDA"
    assert "google_trends_popularity" in res
    assert "active_corporate_jobs" in res
    assert res["signal_score"] == 19.5

def test_forecasting_engine():
    engine = ForecastingEngine()
    res = engine.forecast_q1("AAPL")
    
    assert res["ticker"] == "AAPL"
    assert res["next_quarter"] == "2026Q3"
    assert "revenue" in res
    assert "eps" in res
    
    # Regression model parameters checks
    assert "model_parameters" in res["revenue"]
    assert res["revenue"]["projected_base"] > 0
    assert res["eps"]["projected_base"] > 0

def test_debate_engine():
    engine = DebateEngine()
    metrics = {
        "f_score": 7,
        "z_score": 3.1,
        "rsi": 28.0,
        "dcf_value": 200.0,
        "current_price": 160.0,
        "sma_20": 170.0
    }
    res = engine.generate_debate("AAPL", "Apple Inc.", metrics)
    
    assert res["ticker"] == "AAPL"
    assert len(res["rounds"]) == 4
    assert res["consensus_verdict"] == "BUY"  # upside is positive and F-score >= 6

def test_timeline_engine():
    engine = TimelineEngine()
    res = engine.get_company_timeline("RELIANCE.NS", "Reliance Industries")
    
    assert res["ticker"] == "RELIANCE.NS"
    assert len(res["events"]) > 0
    assert any(e["year"] == "2016" for e in res["events"])

@pytest.mark.asyncio
async def test_portfolio_optimization():
    engine = PortfolioOptimizationEngine()
    holdings = [
        {"ticker": "AAPL", "value": 1000},
        {"ticker": "NVDA", "value": 1500}
    ]
    # Execute optimization; will run Monte Carlo with generated metrics if download fails
    res = await engine.optimize_portfolio(holdings)
    
    assert "tickers" in res
    assert "correlation_matrix" in res
    assert "max_sharpe" in res
    assert "min_volatility" in res
    assert len(res["frontier_points"]) == 500
    
    # Sum of target weights should be exactly 100% (1.0)
    max_sharpe_sum = sum(res["max_sharpe"]["weights"].values())
    min_vol_sum = sum(res["min_volatility"]["weights"].values())
    
    assert pytest.approx(max_sharpe_sum) == 1.0
    assert pytest.approx(min_vol_sum) == 1.0

def test_screener_engine(db_session):
    # Setup test company and analysis data
    company = Company(
        ticker="AAPL",
        exchange="NASDAQ",
        country="USA",
        currency="USD",
        sector="Technology",
        industry="Consumer Electronics",
        name="Apple Inc."
    )
    db_session.add(company)
    db_session.commit()
    db_session.refresh(company)

    analysis = Analysis(
        company_id=company.id,
        state="COMPLETED",
        version=1,
        recommendation="BUY",
        confidence=0.88
    )
    db_session.add(analysis)
    db_session.commit()
    db_session.refresh(analysis)

    now = datetime.datetime.now(datetime.timezone.utc)
    # Add ratios
    db_session.add(Financial(analysis_id=analysis.id, metric_name="current_price", value=150.0, source="yahoo", confidence=1.0, retrieved_at=now))
    db_session.add(Financial(analysis_id=analysis.id, metric_name="f_score", value=7.0, source="calculated", confidence=1.0, retrieved_at=now))
    db_session.add(Financial(analysis_id=analysis.id, metric_name="z_score", value=3.2, source="calculated", confidence=1.0, retrieved_at=now))
    db_session.add(TechnicalData(analysis_id=analysis.id, timeframe="1d", indicator_name="RSI", value=32.0, computed_at=now))
    db_session.add(TechnicalData(analysis_id=analysis.id, timeframe="1d", indicator_name="SMA_20", value=148.0, computed_at=now))
    db_session.add(ValuationResult(analysis_id=analysis.id, model_name="DCF", fair_value=175.0, assumptions={"growth_rate": 0.05}, confidence=1.0))
    db_session.commit()

    engine = ScreenerEngine()
    
    # 1. Test tech stocks filter (should match AAPL)
    res_tech = engine.screen_companies(db_session, "find tech stocks")
    assert len(res_tech) == 1
    assert res_tech[0]["ticker"] == "AAPL"

    # 2. Test undervalued stocks filter (should match AAPL since price 150 < fair 175)
    res_val = engine.screen_companies(db_session, "undervalued tech")
    assert len(res_val) == 1

    # 3. Test filter for something non-existent
    res_none = engine.screen_companies(db_session, "undervalued energy stocks")
    assert len(res_none) == 0
