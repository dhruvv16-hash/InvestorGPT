import logging
from app.providers.base import MarketDataProvider

logger = logging.getLogger("investorgpt.provider_router")

class MarketDataProviderRouter(MarketDataProvider):
    """Router that handles fallback across multiple market data providers."""

    def __init__(self, providers: list[MarketDataProvider]):
        self.providers = providers

    async def get_price(self, ticker: str) -> dict:
        last_error = None
        for provider in self.providers:
            try:
                return await provider.get_price(ticker)
            except Exception as e:
                logger.warning(f"Provider {provider.__class__.__name__} failed get_price for {ticker}: {e}")
                last_error = e
                continue
        raise RuntimeError(f"All market data providers failed get_price for {ticker}: {last_error}")

    async def get_financial_statements(self, ticker: str, years: int = 10) -> dict:
        last_error = None
        for provider in self.providers:
            try:
                data = await provider.get_financial_statements(ticker, years)
                if data:
                    return data
            except Exception as e:
                logger.warning(f"Provider {provider.__class__.__name__} failed get_financial_statements for {ticker}: {e}")
                last_error = e
                continue
        logger.error(f"All providers failed or returned empty financial statements for {ticker}")
        return {}

    async def get_ohlcv(self, ticker: str, timeframe: str = "1d", limit: int = 100) -> list[dict]:
        last_error = None
        for provider in self.providers:
            try:
                data = await provider.get_ohlcv(ticker, timeframe, limit)
                if data:
                    return data
            except Exception as e:
                logger.warning(f"Provider {provider.__class__.__name__} failed get_ohlcv for {ticker}: {e}")
                last_error = e
                continue
        logger.error(f"All providers failed or returned empty OHLCV for {ticker}")
        return []
