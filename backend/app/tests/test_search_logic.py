import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.models.models import Company, RecentSearch, SearchClickLog
from app.database.db import get_db

client = TestClient(app)

def test_search_scoring_relevance(db_session=None):
    # Verify search query results order by relevance score
    response = client.get("/api/v1/search?q=AAPL")
    assert response.status_code == 200
    json_data = response.json()
    assert "quotes" in json_data
    quotes = json_data["quotes"]
    assert len(quotes) > 0
    # The first match must be AAPL because it is an exact symbol match
    assert quotes[0]["symbol"] == "AAPL"

def test_click_and_popularity_feedback():
    # 1. POST a search click log
    click_payload = {
        "symbol": "AAPL",
        "name": "Apple Inc.",
        "exchange": "NMS",
        "user_id": "test_user_123"
    }
    response = client.post("/api/v1/search/click", json=click_payload)
    assert response.status_code == 200
    assert response.json()["status"] == "success"

    # 2. Get recent searches
    res_recent = client.get("/api/v1/search/recent?user_id=test_user_123")
    assert res_recent.status_code == 200
    recents = res_recent.json()["recent"]
    assert len(recents) > 0
    assert recents[0]["symbol"] == "AAPL"

def test_trending_searches():
    response = client.get("/api/v1/search/trending")
    assert response.status_code == 200
    json_data = response.json()
    assert "trending" in json_data
    trending = json_data["trending"]
    assert len(trending) > 0
    assert "symbol" in trending[0]
    assert "count" in trending[0]

def test_clear_recent_searches():
    # Clear recent searches
    response = client.delete("/api/v1/search/recent?user_id=test_user_123")
    assert response.status_code == 200
    assert response.json()["status"] == "success"

    # Verify recent searches are empty
    res_recent = client.get("/api/v1/search/recent?user_id=test_user_123")
    assert res_recent.status_code == 200
    assert len(res_recent.json()["recent"]) == 0
