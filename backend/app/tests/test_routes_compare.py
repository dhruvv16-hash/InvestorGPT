import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_compare_endpoint_success():
    # Test with AAPL and MSFT which should be present or fall back gracefully
    response = client.post(
        "/api/v1/compare",
        json={"tickers": ["AAPL", "MSFT"]}
    )
    assert response.status_code == 200
    json_data = response.json()
    assert "comparison" in json_data
    comparison = json_data["comparison"]
    assert len(comparison) > 0
    for comp in comparison:
        assert "ticker" in comp
        assert "name" in comp
        assert "price" in comp
        assert "currency" in comp

def test_compare_endpoint_invalid_request():
    response = client.post(
        "/api/v1/compare",
        json={"tickers": []}
    )
    assert response.status_code == 400

def test_search_endpoint_success():
    response = client.get("/api/v1/search?q=Apple")
    assert response.status_code == 200
    json_data = response.json()
    assert "quotes" in json_data
    quotes = json_data["quotes"]
    assert len(quotes) > 0
    assert "symbol" in quotes[0]
    assert "name" in quotes[0]
    assert "exchange" in quotes[0]
    assert "is_local" in quotes[0]

def test_compare_export_endpoint_success():
    response = client.get("/api/v1/compare/export?tickers=AAPL,MSFT&format=pdf")
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
    
    response_xlsx = client.get("/api/v1/compare/export?tickers=AAPL,MSFT&format=xlsx")
    assert response_xlsx.status_code == 200
    assert "spreadsheet" in response_xlsx.headers["content-type"] or "excel" in response_xlsx.headers["content-type"] or "sheet" in response_xlsx.headers["content-type"]

def test_list_companies_endpoint_success():
    response = client.get("/api/v1/companies")
    assert response.status_code == 200
    json_data = response.json()
    assert "companies" in json_data
    assert isinstance(json_data["companies"], list)



