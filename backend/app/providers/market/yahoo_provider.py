import asyncio
import logging
from datetime import datetime, timezone
import pandas as pd
import yfinance as yf
from app.providers.base import MarketDataProvider

logger = logging.getLogger("investorgpt.yahoo_provider")

class YahooProvider(MarketDataProvider):
    SOURCE_NAME = "yahoo_finance"
    TRUST_SCORE = 96

    async def get_price(self, ticker: str) -> dict:
        # Wrap blocking yfinance call in asyncio executor
        loop = asyncio.get_event_loop()
        try:
            ticker_obj = yf.Ticker(ticker)
            info = await loop.run_in_executor(None, lambda: ticker_obj.info)
            
            price = info.get("currentPrice") or info.get("regularMarketPrice") or info.get("previousClose")
            currency = info.get("currency") or "USD"
            
            if price is None:
                # Try getting latest close from history if info failed
                hist = await loop.run_in_executor(None, lambda: ticker_obj.history(period="1d"))
                if not hist.empty:
                    price = float(hist["Close"].iloc[-1])
                else:
                    raise ValueError(f"Could not find price for {ticker}")

            return {
                "price": float(price),
                "currency": currency,
                "as_of": datetime.now(timezone.utc),
                "source": self.SOURCE_NAME,
                "trust_score": self.TRUST_SCORE,
                "shares_outstanding": info.get("sharesOutstanding"),
                "market_cap": info.get("marketCap"),
                "sector": info.get("sector"),
                "industry": info.get("industry"),
                "name": info.get("longName") or ticker
            }
        except Exception as e:
            logger.error(f"Error fetching price from Yahoo for {ticker}: {e}")
            raise

    async def get_financial_statements(self, ticker: str, years: int = 10) -> dict:
        loop = asyncio.get_event_loop()
        try:
            ticker_obj = yf.Ticker(ticker)
            
            # Fetch dfs in executors
            financials_df = await loop.run_in_executor(None, lambda: ticker_obj.financials)
            balance_sheet_df = await loop.run_in_executor(None, lambda: ticker_obj.balance_sheet)
            cashflow_df = await loop.run_in_executor(None, lambda: ticker_obj.cashflow)

            if financials_df.empty or balance_sheet_df.empty or cashflow_df.empty:
                logger.warning(f"Financial statements from Yahoo are incomplete for {ticker}")
                return {}

            # Helper to safely extract a metric from DataFrame across possible row labels
            def extract_metric(df: pd.DataFrame, possible_labels: list[str]) -> dict[str, float]:
                extracted = {}
                # Match row labels case-insensitively
                df_lower = df.copy()
                df_lower.index = df_lower.index.str.lower().str.strip()
                
                label_matched = None
                for label in possible_labels:
                    if label.lower().strip() in df_lower.index:
                        label_matched = label.lower().strip()
                        break
                
                if label_matched is not None:
                    row = df_lower.loc[label_matched]
                    # row is indexed by date (datetime objects or strings)
                    # Convert dates to YYYY format
                    for col_date, val in row.items():
                        if pd.isna(val):
                            continue
                        try:
                            # col_date can be Timestamp
                            year_str = str(col_date.year) if hasattr(col_date, "year") else str(col_date)[:4]
                            extracted[year_str] = float(val)
                        except Exception:
                            continue
                return extracted

            # Define mapping of metric names to yfinance labels
            # yfinance index terms might vary slightly, so we list possible synonyms
            mappings = {
                "revenue": ["Total Revenue", "Gross Revenue", "Revenue"],
                "cogs": ["Cost Of Revenue", "Cost Of Goods Sold", "COGS"],
                "net_income": ["Net Income", "Net Income Common Stockholders", "Net Income From Continuing Ops"],
                "operating_income": ["Operating Income", "Operating Income / EBIT", "Operating Profit"],
                "ebit": ["EBIT", "Earnings Before Interest And Taxes"],
                "ebitda": ["EBITDA", "Normalized EBITDA"],
                "current_assets": ["Total Current Assets", "Current Assets"],
                "current_liabilities": ["Total Current Liabilities", "Current Liabilities"],
                "inventory": ["Inventory", "Total Inventory"],
                "total_assets": ["Total Assets"],
                "total_liabilities": ["Total Liabilities Net Minority Interest", "Total Liabilities Net Minor Interest", "Total Liabilities", "TotalLiabilities"],
                "shareholder_equity": ["Stockholders Equity", "Total Stockholders Equity", "Common Stock Equity"],
                "long_term_debt": ["Long Term Debt", "Total Long Term Debt"],
                "interest_expense": ["Interest Expense", "Interest Expense Net Of Interest Income"],
                "operating_cash_flow": ["Operating Cash Flow", "Cash Flow From Operating Activities", "Total Cash From Operating Activities"],
                "capital_expenditures": ["Capital Expenditures", "Capital Expenditure", "Purchase of Property Plant and Equipment"],
                "retained_earnings": ["Retained Earnings"],
                "diluted_eps": ["Diluted EPS", "Basic EPS", "EPS"],
                "cash": ["Cash And Cash Equivalents", "Cash Cash Equivalents And Short Term Investments", "Cash", "Cash Equivalents"]
            }

            normalized = {}
            for metric_key, labels in mappings.items():
                # Pick the right dataframe
                if metric_key in ["revenue", "cogs", "net_income", "operating_income", "ebit", "ebitda", "interest_expense", "diluted_eps"]:
                    df = financials_df
                elif metric_key in ["current_assets", "current_liabilities", "inventory", "total_assets", "total_liabilities", "shareholder_equity", "long_term_debt", "retained_earnings", "cash"]:
                    df = balance_sheet_df
                else:
                    df = cashflow_df
                
                normalized[metric_key] = extract_metric(df, labels)

            # Let's compute Working Capital (Current Assets - Current Liabilities) for Z-score
            working_capital = {}
            for yr in normalized["current_assets"].keys():
                if yr in normalized["current_liabilities"]:
                    working_capital[yr] = normalized["current_assets"][yr] - normalized["current_liabilities"][yr]
            normalized["working_capital"] = working_capital

            return normalized
        except Exception as e:
            logger.error(f"Error fetching financials from Yahoo for {ticker}: {e}")
            return {}

    async def get_ohlcv(self, ticker: str, timeframe: str = "1d", limit: int = 100) -> list[dict]:
        loop = asyncio.get_event_loop()
        try:
            ticker_obj = yf.Ticker(ticker)
            
            # Map timeframes to yfinance inputs
            interval_map = {"1d": "1d", "1wk": "1wk", "1mo": "1mo", "1h": "1h", "15m": "15m"}
            interval = interval_map.get(timeframe, "1d")
            
            # Request enough history to satisfy limit
            period = "3mo" if timeframe in ["1h", "15m"] else "2y"
            
            df = await loop.run_in_executor(None, lambda: ticker_obj.history(period=period, interval=interval))
            if df.empty:
                return []
            
            # Sort by date descending and limit
            df = df.iloc[-limit:]
            
            ohlcv = []
            for date, row in df.iterrows():
                ohlcv.append({
                    "date": date.to_pydatetime() if hasattr(date, "to_pydatetime") else date,
                    "open": float(row["Open"]),
                    "high": float(row["High"]),
                    "low": float(row["Low"]),
                    "close": float(row["Close"]),
                    "volume": float(row["Volume"])
                })
            return ohlcv
        except Exception as e:
            logger.error(f"Error fetching OHLCV from Yahoo for {ticker}: {e}")
            return []
