from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.database.db import Base, get_db
from app.main import app
import pytest

# Setup in-memory SQLite database for test routing isolation
SQLALCHEMY_DATABASE_URL = "sqlite:///./test_new_features.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(scope="module", autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)
    app.dependency_overrides.clear()

def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)

def test_portfolio_operations():
    # 1. Add Apple stock holding
    resp = client.post("/api/v1/portfolio/add", json={
        "user_id": "test_user_1",
        "ticker": "AAPL",
        "shares": 10.0,
        "price": 170.0
    })
    assert resp.status_code == 200
    assert resp.json()["status"] == "success"
    
    # 2. Get holdings
    resp = client.get("/api/v1/portfolio?user_id=test_user_1")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["holdings"]) == 1
    assert data["holdings"][0]["ticker"] == "AAPL"
    assert data["holdings"][0]["shares"] == 10.0
    assert data["holdings"][0]["avg_buy_price"] == 170.0
    
    # 3. Add same stock to accumulate
    resp = client.post("/api/v1/portfolio/add", json={
        "user_id": "test_user_1",
        "ticker": "AAPL",
        "shares": 5.0,
        "price": 185.0
    })
    assert resp.status_code == 200
    assert resp.json()["action"] == "updated"
    
    # Verify average entry price logic: (10*170 + 5*185) / 15 = 175.0
    resp = client.get("/api/v1/portfolio?user_id=test_user_1")
    data = resp.json()
    assert data["holdings"][0]["shares"] == 15.0
    assert data["holdings"][0]["avg_buy_price"] == 175.0
    
    # 4. Remove holding
    holding_id = data["holdings"][0]["id"]
    resp = client.delete(f"/api/v1/portfolio/remove/{holding_id}")
    assert resp.status_code == 200
    assert resp.json()["status"] == "success"

def test_on_the_fly_technical_analysis():
    resp = client.get("/api/v1/technical/MSFT")
    assert resp.status_code == 200
    data = resp.json()
    assert data["ticker"] == "MSFT"
    assert data["rsi"] > 0
    assert data["current_price"] > 0
    assert "bollinger" in data
    assert "macd" in data
    assert "ichimoku" in data
    assert "adx" in data
    assert "is_squeeze" in data["bollinger"]
    assert len(data["history"]) > 0

def test_market_news_sentiment():
    resp = client.get("/api/v1/news?tickers=AAPL,MSFT")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["news"]) > 0
    assert "sentiment" in data["news"][0]
    assert "publisher" in data["news"][0]

def test_history_and_settings_purge():
    # 1. Clear database cache
    resp = client.post("/api/v1/settings/clear-cache")
    assert resp.status_code == 200
    assert resp.json()["status"] == "success"
    
    # 2. Get history (should be clean)
    resp = client.get("/api/v1/research-history?user_id=test_user_1")
    assert resp.status_code == 200
    assert "history" in resp.json()

def test_portfolio_document_exports():
    # Setup a holding for testing downloads
    client.post("/api/v1/portfolio/add", json={
        "user_id": "test_export_user",
        "ticker": "AAPL",
        "shares": 10.0,
        "price": 170.0
    })
    
    # Test Excel download
    resp_xlsx = client.get("/api/v1/portfolio/export/excel?user_id=test_export_user")
    assert resp_xlsx.status_code == 200
    assert "spreadsheetml.sheet" in resp_xlsx.headers["content-type"]
    
    # Test PDF download
    resp_pdf = client.get("/api/v1/portfolio/export/pdf?user_id=test_export_user")
    assert resp_pdf.status_code == 200
    assert "application/pdf" in resp_pdf.headers["content-type"]

def test_modeling_pdf_export():
    resp = client.get("/api/v1/modeling/export/pdf/default?ticker=AAPL&user_id=test_export_user")
    assert resp.status_code == 200
    assert "application/pdf" in resp.headers["content-type"]

def test_modeling_currency_resolution():
    # Test US Stock
    resp_us = client.get("/api/v1/modeling/model/default?ticker=AAPL&user_id=test_export_user")
    assert resp_us.status_code == 200
    assert resp_us.json()["currency"] == "USD"
    
    # Test Indian Stock
    resp_in = client.get("/api/v1/modeling/model/default?ticker=RELIANCE.NS&user_id=test_export_user")
    assert resp_in.status_code == 200
    assert resp_in.json()["currency"] == "INR"

def test_health_telemetry_check():
    resp = client.get("/api/v1/settings/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "healthy"
    assert data["database"] == "connected"
    assert "indexed_companies" in data

def test_macro_simulation_route():
    resp = client.post("/api/v1/macro/simulate", json={
        "ticker": "AAPL",
        "interest_rate_delta_pct": 2.0,
        "oil_price_usd": 120.0
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["ticker"] == "AAPL"
    assert data["base_scenario"]["wacc_pct"] > 0
    assert data["simulated_scenario"]["wacc_pct"] > 0

def test_industry_intelligence_route():
    resp = client.get("/api/v1/industry/AAPL")
    assert resp.status_code == 200
    data = resp.json()
    assert data["ticker"] == "AAPL"
    assert data["sector"] == "Technology"
    assert data["industry_stats"]["tam_usd_billions"] > 0
    assert len(data["market_share_distribution"]) > 0

def test_business_model_profile_route():
    resp = client.get("/api/v1/business-model/AAPL")
    assert resp.status_code == 200
    data = resp.json()
    assert data["ticker"] == "AAPL"
    assert len(data["revenue_segments"]) > 0
    assert data["moat_analysis"]["moat_score"] > 0

def test_management_profile_route():
    resp = client.get("/api/v1/management/AAPL")
    assert resp.status_code == 200
    data = resp.json()
    assert data["ticker"] == "AAPL"
    assert data["management_quality_score"] > 0
    assert len(data["key_executives"]) > 0

def test_capital_allocation_route():
    resp = client.get("/api/v1/capital-allocation/AAPL")
    assert resp.status_code == 200
    data = resp.json()
    assert data["ticker"] == "AAPL"
    assert data["capital_allocation_score"] > 0
    assert "buybacks_usd_b" in data["breakdown"]

def test_earnings_quality_route():
    resp = client.get("/api/v1/earnings-quality/AAPL")
    assert resp.status_code == 200
    data = resp.json()
    assert data["ticker"] == "AAPL"
    assert data["earnings_quality_score"] > 0
    assert data["piotroski_f_score"] > 0
    assert data["altman_z_score"] > 0
    assert data["beneish_m_score"] < 0
    assert len(data["accounting_flags"]) > 0

def test_backtest_route():
    resp = client.get("/api/v1/backtest/AAPL?year=2024")
    assert resp.status_code == 200
    data = resp.json()
    assert data["ticker"] == "AAPL"
    assert data["backtest_base_year"] == 2024
    assert data["predicted_fair_value"] > 0
    assert len(data["comparisons"]) >= 0

def test_calibration_routes():
    # 1. Log record
    resp_log = client.post("/api/v1/calibration/log", json={
        "ticker": "AAPL",
        "user_id": "test_calibration_user",
        "predicted_revenue": 380000000000.0,
        "predicted_eps": 6.5,
        "predicted_fair_value": 185.0
    })
    assert resp_log.status_code == 200
    assert resp_log.json()["status"] == "success"
    
    # 2. Trigger calibration
    resp_cal = client.post("/api/v1/calibration/calibrate?ticker=AAPL")
    assert resp_cal.status_code == 200
    assert resp_cal.json()["status"] == "success"
    
    # 3. Get feedback
    resp_feed = client.get("/api/v1/calibration/feedback?ticker=AAPL")
    assert resp_feed.status_code == 200
    assert "average_mape" in resp_feed.json()
    assert "recommendation" in resp_feed.json()

