import pytest
from app.agents.company_resolver import CompanyResolverAgent

@pytest.mark.asyncio
async def test_company_resolver_local():
    resolver = CompanyResolverAgent()
    # Test resolving Apple using direct COMMON_COMPANIES dictionary mapping
    profile = await resolver.resolve("Apple")
    assert profile["ticker"] == "AAPL"
    assert profile["exchange"] in ["NASDAQ", "NMS"]
    assert profile["currency"] == "USD"
    assert "Apple" in profile["name"]
