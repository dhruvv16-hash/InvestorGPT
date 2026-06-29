import pytest
from app.engines.competitor_engine import CompetitorEngine
from app.engines.macro_engine import MacroEngine
from app.engines.sentiment_engine import SentimentEngine
from app.engines.risk_engine import RiskEngine

@pytest.mark.asyncio
async def test_competitor_engine():
    engine = CompetitorEngine()
    peers = await engine.get_peers("NVDA", "Semiconductors")
    assert "AMD" in peers
    assert "NVDA" not in peers

@pytest.mark.asyncio
async def test_macro_engine():
    engine = MacroEngine()
    # Test fallback data
    macro = await engine.get_macro_indicators("India")
    assert macro["gdp_growth"] == 6.8
    assert macro["inflation"] == 4.5
    assert macro["interest_rate"] == 6.50
    assert macro["unemployment"] == 7.2

def test_sentiment_engine():
    engine = SentimentEngine()
    articles = [
        {"title": "Company reports record strong growth in revenue", "link": "", "published_at": "", "source": ""},
        {"title": "Earnings fall below expectations after sales drop", "link": "", "published_at": "", "source": ""},
        {"title": "General market news with no bias", "link": "", "published_at": "", "source": ""}
    ]
    result = engine.analyze_articles(articles)
    assert result["distribution"]["bullish"] == 1
    assert result["distribution"]["bearish"] == 1
    assert result["distribution"]["neutral"] == 1
    assert result["overall_sentiment"] == "NEUTRAL"
    assert result["sentiment_score"] == 0.0

def test_risk_engine():
    engine = RiskEngine()
    # Test high risk profile
    high_risk = engine.evaluate_risk(
        debt_to_equity=2.5,
        current_ratio=0.8,
        margin_of_safety=-0.25,
        inflation_rate=6.2,
        sentiment_score=-0.4
    )
    assert high_risk["overall_level"] == "HIGH"
    
    # Test low risk profile
    low_risk = engine.evaluate_risk(
        debt_to_equity=0.2,
        current_ratio=2.5,
        margin_of_safety=0.35,
        inflation_rate=2.1,
        sentiment_score=0.4
    )
    assert low_risk["overall_level"] == "LOW"
