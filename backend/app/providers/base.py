from abc import ABC, abstractmethod

class MarketDataProvider(ABC):
    """Abstract class for all market data providers."""

    @abstractmethod
    async def get_price(self, ticker: str) -> dict:
        """Returns {'price': float, 'currency': str, 'as_of': datetime, 'source': str, 'trust_score': int}"""
        pass

    @abstractmethod
    async def get_financial_statements(self, ticker: str, years: int = 10) -> dict:
        """Returns normalized financials dictionary."""
        pass

    @abstractmethod
    async def get_ohlcv(self, ticker: str, timeframe: str = "1d", limit: int = 100) -> list[dict]:
        """Returns historical OHLCV data."""
        pass

class NewsProvider(ABC):
    """Abstract class for news providers."""

    @abstractmethod
    async def get_news(self, ticker: str, limit: int = 10) -> list[dict]:
        pass
