from fastapi.testclient import TestClient
from app.main import app
import pytest

client = TestClient(app)

def test_supply_chain_retrieval():
    # Test valid ticker
    resp = client.get("/api/v1/supply-chain/AAPL")
    assert resp.status_code == 200
    data = resp.json()
    assert "nodes" in data
    assert "edges" in data
    assert data["center_node"] == "AAPL"
    assert "TSMC" in data["nodes"]

    # Test unknown ticker generates dynamic node template
    resp_unknown = client.get("/api/v1/supply-chain/XYZ")
    assert resp_unknown.status_code == 200
    data_unknown = resp_unknown.json()
    assert data_unknown["center_node"] == "XYZ"
    assert "XYZ" in data_unknown["nodes"]

def test_supply_chain_disruption():
    # Test 50% capacity cut on TSMC
    resp = client.post("/api/v1/supply-chain/disrupt", json={
        "disrupted_node_id": "TSMC",
        "disruption_pct": 50.0
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["disruption_source"] == "TSMC"
    assert data["applied_disruption_pct"] == 50.0
    
    # Check that AAPL (customer) has inherited shock
    nodes = data["nodes"]
    assert nodes["TSMC"]["disruption_pct"] == 50.0
    assert nodes["AAPL"]["disruption_pct"] > 0.0
    assert nodes["AAPL"]["status"] in ["WARNING_SHOCK", "CRITICAL_SHOCK"]

def test_strategy_generation():
    # Test generating custom strategy with Value and Growth
    resp = client.post("/api/v1/strategy/generate", json={
        "styles": ["VALUE", "GROWTH"]
    })
    assert resp.status_code == 200
    data = resp.json()
    assert "portfolio_stats" in data
    assert "allocation_weights" in data
    assert len(data["matching_stocks"]) > 0
    assert data["portfolio_stats"]["expected_cagr_pct"] > 0.0
