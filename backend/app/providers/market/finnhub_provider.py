import os
import httpx
import logging
from datetime import datetime, timezone, timedelta
from app.providers.base import MarketDataProvider, NewsProvider
from app.providers.market.yahoo_provider import YahooProvider

logger = logging.getLogger("investorgpt.finnhub_provider")

class FinnhubProvider(MarketDataProvider, NewsProvider):
    SOURCE_NAME = "finnhub"
    TRUST_SCORE = 98

    def __init__(self):
        self.api_key = os.getenv("FINNHUB_API_KEY", "")
        self.yahoo_fallback = YahooProvider()

    async def get_price(self, ticker: str) -> dict:
        if not self.api_key:
            # Fall back to Yahoo Provider if no API Key is set
            return await self.yahoo_fallback.get_price(ticker)

        url = f"https://finnhub.io/api/v1/quote?symbol={ticker.upper()}&token={self.api_key}"
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                res = await client.get(url)
                if res.status_code == 200:
                    data = res.json()
                    # Finnhub returns c=current price, h=high, l=low, o=open, pc=previous close
                    current_price = data.get("c")
                    if current_price and current_price > 0:
                        # Get profile to resolve currency and other details
                        profile = await self.get_profile(ticker)
                        currency = profile.get("currency") or "USD"
                        return {
                            "price": float(current_price),
                            "currency": currency,
                            "as_of": datetime.now(timezone.utc),
                            "source": self.SOURCE_NAME,
                            "trust_score": self.TRUST_SCORE,
                            "shares_outstanding": profile.get("sharesOutstanding"),
                            "market_cap": profile.get("marketCapitalization"),
                            "sector": profile.get("finnhubIndustry"),
                            "industry": profile.get("finnhubIndustry"),
                            "name": profile.get("name") or ticker
                        }
        except Exception as e:
            logger.error(f"Finnhub quote fetch failed for {ticker}, falling back: {e}")
            
        return await self.yahoo_fallback.get_price(ticker)

    async def get_profile(self, ticker: str) -> dict:
        if not self.api_key:
            return {}
        url = f"https://finnhub.io/api/v1/stock/profile2?symbol={ticker.upper()}&token={self.api_key}"
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                res = await client.get(url)
                if res.status_code == 200:
                    return res.json()
        except Exception as e:
            logger.warning(f"Failed to fetch Finnhub profile for {ticker}: {e}")
        return {}

    async def get_news(self, ticker: str, limit: int = 10) -> list[dict]:
        if not self.api_key:
            # Return empty to allow fallback in routers
            return []
            
        to_date = datetime.now().strftime("%Y-%m-%d")
        from_date = (datetime.now() - timedelta(days=7)).strftime("%Y-%m-%d")
        url = f"https://finnhub.io/api/v1/company-news?symbol={ticker.upper()}&from={from_date}&to={to_date}&token={self.api_key}"
        
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                res = await client.get(url)
                if res.status_code == 200:
                    articles = []
                    for item in res.json()[:limit]:
                        articles.append({
                            "ticker": ticker.upper(),
                            "title": item.get("headline", ""),
                            "summary": item.get("summary", ""),
                            "publisher": item.get("source", "Finnhub"),
                            "link": item.get("url", "#"),
                            "timestamp": item.get("datetime", 0)
                        })
                    return articles
        except Exception as e:
            logger.warning(f"Failed to fetch Finnhub news for {ticker}: {e}")
        return []

    async def get_general_news(self, limit: int = 20) -> list[dict]:
        if not self.api_key:
            return await self._get_yahoo_rss_news(limit)
            
        url = f"https://finnhub.io/api/v1/news?category=general&token={self.api_key}"
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                res = await client.get(url)
                if res.status_code == 200:
                    articles = []
                    for item in res.json()[:limit]:
                        articles.append({
                            "ticker": "MARKET",
                            "title": item.get("headline", ""),
                            "summary": item.get("summary", ""),
                            "publisher": item.get("source", "Finnhub"),
                            "link": item.get("url", "#"),
                            "timestamp": item.get("datetime", 0)
                        })
                    if articles:
                        return articles
        except Exception as e:
            logger.warning(f"Failed to fetch Finnhub general news: {e}")
            
        return await self._get_yahoo_rss_news(limit)

    async def _get_yahoo_rss_news(self, limit: int = 20) -> list[dict]:
        import xml.etree.ElementTree as ET
        import time
        import email.utils
        url = "https://news.google.com/rss/search?q=finance+stock+market&hl=en-US"
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                res = await client.get(url)
                if res.status_code == 200:
                    root = ET.fromstring(res.content)
                    articles = []
                    for item in root.findall(".//item")[:limit]:
                        title = item.find("title").text if item.find("title") is not None else ""
                        link = item.find("link").text if item.find("link") is not None else "#"
                        pubDate = item.find("pubDate").text if item.find("pubDate") is not None else ""
                        source = item.find("source").text if item.find("source") is not None else "Google News"
                        
                        try:
                            parsed_date = email.utils.parsedate_to_datetime(pubDate)
                            timestamp = int(parsed_date.timestamp())
                        except Exception:
                            timestamp = int(time.time())
                            
                        articles.append({
                            "ticker": "MARKET",
                            "title": title,
                            "summary": title,
                            "publisher": source,
                            "link": link,
                            "timestamp": timestamp
                        })
                    return articles
        except Exception as e:
            logger.warning(f"Failed to fetch XML RSS news: {e}")
        return []

    async def get_financial_statements(self, ticker: str, years: int = 10) -> dict:
        # Finnhub financials require premium tier for full statements; fall back to Yahoo
        return await self.yahoo_fallback.get_financial_statements(ticker, years)

    async def get_ohlcv(self, ticker: str, timeframe: str = "1d", limit: int = 100) -> list[dict]:
        # Fall back to Yahoo historicals
        return await self.yahoo_fallback.get_ohlcv(ticker, timeframe, limit)
