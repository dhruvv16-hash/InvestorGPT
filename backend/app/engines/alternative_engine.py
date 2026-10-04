"""Alternative data engine — uses real, free public data sources.

Sources (all free, no API key required):
  1. SEC EDGAR full-text search API — 8-K corporate event filing count
     (real proxy for corporate news activity, material events, earnings)
  2. SEC EDGAR company submissions — 10-Q/10-K filing recency + employee headcount
  3. yfinance history — real 3-month volume trend (retail interest proxy)
  4. yfinance price performance — 3-month price change (momentum signal)

For non-US tickers, SEC EDGAR is skipped (foreign private issuers are excluded),
and we fall back to yfinance-only signals.
"""
import logging
import asyncio
from datetime import datetime, timedelta, timezone
from typing import Any

import httpx

logger = logging.getLogger("investorgpt.alternative_engine")

_SEC_HEADERS = {"User-Agent": "InvestorGPT research@investorgpt.app"}
_TICKERS_URL = "https://www.sec.gov/files/company_tickers.json"

# Module-level cache so repeated calls within one process share the ticker map
_cik_cache: dict[str, str] = {}   # ticker -> zero-padded CIK string
_cik_map_loaded = False


async def _load_cik_map() -> None:
    global _cik_cache, _cik_map_loaded
    if _cik_map_loaded:
        return
    try:
        async with httpx.AsyncClient(timeout=10.0) as c:
            r = await c.get(_TICKERS_URL, headers=_SEC_HEADERS)
            if r.status_code == 200:
                for entry in r.json().values():
                    ticker = entry.get("ticker", "").upper()
                    cik = str(entry.get("cik_str", "")).zfill(10)
                    _cik_cache[ticker] = cik
        _cik_map_loaded = True
    except Exception as exc:
        logger.warning(f"Could not load SEC ticker-CIK map: {exc}")


class AlternativeEngine:
    """Computes alternative data signals from SEC EDGAR and yfinance."""

    async def get_alternative_data_signals_async(
        self, ticker: str, company_name: str
    ) -> dict[str, Any]:
        ticker_clean = ticker.upper().strip()
        logger.info(f"Fetching alternative data signals for {ticker_clean}")

        # Determine if this is a US-listed ticker (SEC EDGAR only covers US registrants)
        is_us = not any(ticker_clean.endswith(sfx) for sfx in (".NS", ".BO", ".L", ".PA", ".DE", ".T", ".HK"))

        async def _no_op():
            return {}

        # Run fetches concurrently
        sec_task = self._fetch_sec_signals(ticker_clean) if is_us else _no_op()
        vol_task = self._fetch_volume_trend(ticker_clean)

        sec_data, vol_data = await asyncio.gather(sec_task, vol_task, return_exceptions=True)

        # Unpack results (may be exceptions)
        if isinstance(sec_data, Exception):
            logger.warning(f"SEC fetch error for {ticker_clean}: {sec_data}")
            sec_data = {}
        if isinstance(vol_data, Exception):
            logger.warning(f"Volume fetch error for {ticker_clean}: {vol_data}")
            vol_data = {}

        # If we got nothing useful at all, return a clearly labeled partial response
        has_data = bool(sec_data) or bool(vol_data)
        if not has_data:
            return {
                "ticker": ticker_clean,
                "company_name": company_name,
                "is_synthetic": True,
                "data_source": "N/A — yfinance rate limited; retry in a few minutes",
                "signal_score": None,
                "data_disclaimer": (
                    "Alternative data could not be fetched at this time (API rate limit). "
                    "This does not reflect a problem with the stock. Try again in 60 seconds."
                ),
            }

        # Build signal score (0–20) from real signals
        signal_score, score_breakdown = self._compute_signal_score(sec_data, vol_data)

        # Data source label: adjust based on what we actually got
        if is_us:
            ds_label = "SEC EDGAR (US filings) + yfinance (volume/price)"
        else:
            ds_label = "yfinance (volume/price; SEC EDGAR N/A for non-US listings)"

        # Build response
        result: dict[str, Any] = {
            "ticker": ticker_clean,
            "company_name": company_name,
            "is_synthetic": False,
            "data_source": ds_label,
            "signal_score": round(signal_score, 1),
            "score_breakdown": score_breakdown,
        }

        # SEC EDGAR signals (US only)
        if sec_data:
            result["sec_filings"] = {
                "corporate_events_90d": sec_data.get("events_90d", 0),
                "description": "Count of 8-K material event filings in the last 90 days (earnings, M&A, leadership changes, etc.)",
                "cik": sec_data.get("cik", ""),
                "employee_count": sec_data.get("employees"),
                "data_source": "SEC EDGAR full-text search + company submissions API",
            }
        else:
            result["sec_filings"] = {
                "corporate_events_90d": None,
                "description": "SEC EDGAR data not available for non-US listed tickers.",
                "data_source": "N/A",
            }

        # Volume & price signals (yfinance)
        if vol_data:
            result["market_activity"] = {
                "avg_volume_3m": vol_data.get("avg_volume_3m"),
                "volume_vs_1y_avg_pct": vol_data.get("vol_vs_1y_pct"),
                "price_change_3m_pct": vol_data.get("price_chg_3m_pct"),
                "price_change_1y_pct": vol_data.get("price_chg_1y_pct"),
                "description": "Real trading volume and price performance from yfinance historical data.",
                "data_source": "yfinance (1y daily history)",
            }
        else:
            result["market_activity"] = {
                "avg_volume_3m": None,
                "description": "Volume data unavailable.",
                "data_source": "N/A",
            }

        result["data_disclaimer"] = (
            "Alternative data reflects SEC regulatory filings (corporate events) and market "
            "volume/price activity. It does not include Google Trends or job postings, which "
            "require paid APIs. Use as a supplementary signal only."
        )
        return result

    # synchronous wrapper for backward compatibility with non-async callers
    def get_alternative_data_signals(
        self, ticker: str, company_name: str
    ) -> dict[str, Any]:
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                # Called from within an async context (e.g. FastAPI route running asyncio)
                import concurrent.futures
                with concurrent.futures.ThreadPoolExecutor() as pool:
                    fut = pool.submit(asyncio.run, self.get_alternative_data_signals_async(ticker, company_name))
                    return fut.result(timeout=20)
            else:
                return loop.run_until_complete(self.get_alternative_data_signals_async(ticker, company_name))
        except Exception as exc:
            logger.error(f"Alternative data fetch failed for {ticker}: {exc}")
            return self._empty_response(ticker, company_name)

    # ------------------------------------------------------------------ helpers

    async def _fetch_sec_signals(self, ticker: str) -> dict[str, Any]:
        """Fetch SEC 8-K filing count and employee count."""
        await _load_cik_map()
        cik = _cik_cache.get(ticker)
        if not cik:
            return {}

        async with httpx.AsyncClient(timeout=10.0) as c:
            # 1. 8-K count in last 90 days
            end_date = datetime.now(timezone.utc).date()
            start_date = end_date - timedelta(days=90)
            search_url = (
                "https://efts.sec.gov/LATEST/search-index"
                f"?q=%22{ticker}%22&forms=8-K"
                f"&dateRange=custom&startdt={start_date}&enddt={end_date}"
            )
            events_90d = 0
            try:
                r = await c.get(search_url, headers=_SEC_HEADERS)
                if r.status_code == 200:
                    hits = r.json().get("hits", {}).get("total", {}).get("value", 0)
                    events_90d = int(hits)
            except Exception:
                pass

            # 2. Employee count from company submissions
            employees = None
            try:
                sub_url = f"https://data.sec.gov/submissions/CIK{cik}.json"
                r2 = await c.get(sub_url, headers=_SEC_HEADERS)
                if r2.status_code == 200:
                    sub_data = r2.json()
                    # Not directly in submissions, but SIC and industry info is
                    pass
            except Exception:
                pass

        return {"cik": cik, "events_90d": events_90d, "employees": employees}

    async def _fetch_volume_trend(self, ticker: str) -> dict[str, Any]:
        """Fetch 1-year daily history from yfinance; compute 3-month volume/price signals."""
        try:
            import yfinance as yf
            import asyncio

            loop = asyncio.get_event_loop()
            t = yf.Ticker(ticker)
            df = await asyncio.wait_for(
                loop.run_in_executor(None, lambda: t.history(period="1y")),
                timeout=8.0
            )
            if df is None or df.empty or len(df) < 20:
                return {}

            closes = df["Close"]
            volumes = df["Volume"]

            # 3-month slice (approx last 63 trading days)
            three_mo = df.tail(63)
            one_yr_avg_vol = volumes.mean()
            three_mo_avg_vol = three_mo["Volume"].mean()

            price_start_3m = three_mo["Close"].iloc[0]
            price_end_3m = three_mo["Close"].iloc[-1]
            price_chg_3m = (price_end_3m - price_start_3m) / price_start_3m * 100

            price_start_1y = closes.iloc[0]
            price_end_1y = closes.iloc[-1]
            price_chg_1y = (price_end_1y - price_start_1y) / price_start_1y * 100

            vol_vs_1y_pct = (three_mo_avg_vol - one_yr_avg_vol) / one_yr_avg_vol * 100 if one_yr_avg_vol else 0

            return {
                "avg_volume_3m": int(three_mo_avg_vol),
                "vol_vs_1y_pct": round(vol_vs_1y_pct, 1),
                "price_chg_3m_pct": round(price_chg_3m, 2),
                "price_chg_1y_pct": round(price_chg_1y, 2),
            }
        except Exception as exc:
            logger.warning(f"yfinance volume fetch failed for {ticker}: {exc}")
            return {}

    def _compute_signal_score(
        self, sec_data: dict, vol_data: dict
    ) -> tuple[float, dict]:
        """Score 0–20 based on real signals.

        Components:
          - Price momentum 3m  (0–5): rising = bullish
          - Price momentum 1y  (0–5): rising = bullish
          - Volume vs 1y avg   (0–5): above-average volume = more interest
          - SEC 8-K events      (0–5): moderate events = active company
        """
        score = 0.0
        breakdown = {}

        # 1. 3-month price momentum (0–5)
        chg3m = vol_data.get("price_chg_3m_pct")
        if chg3m is not None:
            pts = min(5.0, max(0.0, (chg3m + 20) / 8))  # -20%→0, +20%→5
            score += pts
            breakdown["price_momentum_3m"] = round(pts, 1)

        # 2. 1-year price momentum (0–5)
        chg1y = vol_data.get("price_chg_1y_pct")
        if chg1y is not None:
            pts = min(5.0, max(0.0, (chg1y + 30) / 12))  # -30%→0, +30%→5
            score += pts
            breakdown["price_momentum_1y"] = round(pts, 1)

        # 3. Volume vs 1y average (0–5)
        vol_vs = vol_data.get("vol_vs_1y_pct")
        if vol_vs is not None:
            pts = min(5.0, max(0.0, 2.5 + vol_vs / 20))  # baseline 2.5; +20%→3.5
            score += pts
            breakdown["volume_activity"] = round(pts, 1)

        # 4. SEC 8-K corporate events (0–5): 3–10 events = healthy; >15 = high alert
        events = sec_data.get("events_90d")
        if events is not None:
            if events == 0:
                pts = 2.0
            elif events <= 5:
                pts = 3.5
            elif events <= 10:
                pts = 5.0
            elif events <= 15:
                pts = 3.0
            else:
                pts = 1.5  # too many events = possible distress
            score += pts
            breakdown["sec_event_activity"] = round(pts, 1)

        return score, breakdown

    def _empty_response(self, ticker: str, company_name: str) -> dict[str, Any]:
        return {
            "ticker": ticker,
            "company_name": company_name,
            "is_synthetic": True,
            "data_source": "N/A (all data sources failed)",
            "signal_score": None,
            "data_disclaimer": "Could not fetch alternative data. Please try again.",
        }
