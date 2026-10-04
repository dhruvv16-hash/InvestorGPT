import logging
import numpy as np
from datetime import datetime
from typing import Any
import yfinance as yf

logger = logging.getLogger("investorgpt.forecasting_engine")


class ForecastingEngine:
    """Forecasts next-quarter EPS and Revenue using real historical data from yfinance.

    Data source: yfinance quarterly_income_stmt (Total Revenue + Diluted EPS).
    Falls back to hardcoded history only if yfinance returns empty data.
    Regression model: linear on the last N quarters of real data.
    """

    def forecast_q1(self, ticker: str) -> dict[str, Any]:
        logger.info(f"Generating earnings forecast for {ticker}")
        ticker_clean = ticker.upper().strip()

        # --- 1. Fetch real quarterly data from yfinance ---
        real_rev, real_eps, real_quarters, currency = self._fetch_real_quarters(ticker_clean)

        if real_rev and len(real_rev) >= 3:
            # We have real data
            rev_history = real_rev
            eps_history = real_eps
            quarters = real_quarters
            is_synthetic = False
            data_source = f"yfinance quarterly_income_stmt ({ticker_clean})"
            data_disclaimer = None
        else:
            # Fall back to hardcoded, but label it honestly
            logger.warning(f"No real quarterly data for {ticker_clean}; using hardcoded fallback.")
            rev_history, eps_history, quarters, currency = self._hardcoded_fallback(ticker_clean)
            is_synthetic = True
            data_source = "InvestorGPT hardcoded fallback (yfinance returned no quarterly data)"
            data_disclaimer = (
                "Historical figures are HARDCODED demo values. "
                "They do not reflect actual filed earnings."
            )

        # --- 2. Run linear regressions ---
        rev_results = self._run_regression(rev_history)
        eps_results = self._run_regression(eps_history)

        # --- 3. Derive next quarter label ---
        next_quarter = self._next_quarter_label(quarters[-1] if quarters else "2026Q2")

        result: dict[str, Any] = {
            "ticker": ticker_clean,
            "next_quarter": next_quarter,
            "historical_quarters": quarters,
            "currency": currency,
            "is_synthetic": is_synthetic,
            "data_source": data_source,
            "revenue": {
                "historical": [round(v, 4) for v in rev_history],
                "projected_base": round(rev_results["base"], 4),
                "projected_bull": round(rev_results["bull"], 4),
                "projected_bear": round(rev_results["bear"], 4),
                "confidence_lower": round(rev_results["conf_lower"], 4),
                "confidence_upper": round(rev_results["conf_upper"], 4),
                "model_parameters": {
                    "slope": round(rev_results["slope"], 6),
                    "intercept": round(rev_results["intercept"], 4),
                    "r_squared": round(rev_results["r_squared"], 4),
                },
            },
            "eps": {
                "historical": [round(v, 4) for v in eps_history],
                "projected_base": round(eps_results["base"], 4),
                "projected_bull": round(eps_results["bull"], 4),
                "projected_bear": round(eps_results["bear"], 4),
                "confidence_lower": round(eps_results["conf_lower"], 4),
                "confidence_upper": round(eps_results["conf_upper"], 4),
                "model_parameters": {
                    "slope": round(eps_results["slope"], 6),
                    "intercept": round(eps_results["intercept"], 4),
                    "r_squared": round(eps_results["r_squared"], 4),
                },
            },
        }
        if data_disclaimer:
            result["data_disclaimer"] = data_disclaimer
        return result

    # ------------------------------------------------------------------ helpers

    def _fetch_real_quarters(
        self, ticker: str
    ) -> tuple[list[float], list[float], list[str], str]:
        """Return (rev_history, eps_history, quarter_labels, currency) from yfinance.

        Revenue is returned in the stock's native currency (raw billions scaled).
        Returns empty lists on failure.
        """
        try:
            t = yf.Ticker(ticker)
            qi = t.quarterly_income_stmt

            if qi is None or qi.empty:
                return [], [], [], "USD"

            # Row names we need
            rev_row = next(
                (r for r in qi.index if r == "Total Revenue"), None
            )
            eps_row = next(
                (r for r in qi.index if r == "Diluted EPS"), None
            )

            if rev_row is None or eps_row is None:
                return [], [], [], "USD"

            rev_series = qi.loc[rev_row].sort_index()
            eps_series = qi.loc[eps_row].sort_index()

            # Drop NaN, align both series to same timestamps
            combined = (
                rev_series.to_frame("rev")
                .join(eps_series.to_frame("eps"))
                .dropna()
            )
            if len(combined) < 3:
                return [], [], [], "USD"

            # Build quarter labels from timestamps
            quarters = [self._ts_to_quarter(ts) for ts in combined.index]
            # Revenue: convert raw dollars → billions for readability
            rev_scale = 1e9
            rev_history = [float(v) / rev_scale for v in combined["rev"]]
            eps_history = [float(v) for v in combined["eps"]]

            # Determine currency from ticker info
            info = t.info or {}
            currency = info.get("currency", "USD")

            return rev_history, eps_history, quarters, currency

        except Exception as exc:
            logger.warning(f"yfinance quarterly fetch failed for {ticker}: {exc}")
            return [], [], [], "USD"

    def _ts_to_quarter(self, ts) -> str:
        """Convert a pandas Timestamp to 'YYYYQn' string."""
        try:
            dt = ts.to_pydatetime() if hasattr(ts, "to_pydatetime") else ts
            q = (dt.month - 1) // 3 + 1
            return f"{dt.year}Q{q}"
        except Exception:
            return str(ts)

    def _next_quarter_label(self, last_quarter: str) -> str:
        """Increment quarter label by one, e.g. '2026Q2' → '2026Q3'."""
        try:
            year, q = int(last_quarter[:4]), int(last_quarter[5])
            if q == 4:
                return f"{year + 1}Q1"
            return f"{year}Q{q + 1}"
        except Exception:
            return "Next Quarter"

    def _hardcoded_fallback(
        self, ticker: str
    ) -> tuple[list[float], list[float], list[str], str]:
        """Hardcoded quarterly data for common tickers when yfinance fails."""
        quarters = ["2025Q1", "2025Q2", "2025Q3", "2025Q4", "2026Q1", "2026Q2"]
        if "AAPL" in ticker:
            return [90.75, 85.78, 94.93, 119.58, 90.8, 86.2], [1.53, 1.40, 1.64, 2.18, 1.58, 1.44], quarters, "USD"
        if "NVDA" in ticker:
            return [26.04, 30.04, 35.08, 38.5, 42.1, 45.3], [5.98, 6.60, 7.84, 8.42, 9.15, 9.80], quarters, "USD"
        if "RELIANCE" in ticker:
            return [2400.0, 2450.0, 2520.0, 2600.0, 2580.0, 2650.0], [23.5, 24.1, 25.2, 26.8, 25.9, 27.2], quarters, "INR"
        # Generic fallback
        return [1.2, 1.25, 1.31, 1.45, 1.38, 1.42], [0.45, 0.48, 0.52, 0.61, 0.55, 0.58], quarters, "USD"

    def _run_regression(self, y_data: list[float]) -> dict[str, float]:
        """Linear regression on y_data; forecasts index n (Q+1)."""
        n = len(y_data)
        x = np.arange(n)
        y = np.array(y_data, dtype=float)

        slope, intercept = np.polyfit(x, y, 1)
        y_pred = slope * x + intercept

        ss_res = np.sum((y - y_pred) ** 2)
        ss_tot = np.sum((y - np.mean(y)) ** 2)
        r_squared = 1.0 - (ss_res / ss_tot) if ss_tot > 0 else 1.0

        base = slope * n + intercept
        std_err = np.std(y - y_pred) if n > 1 else 0.05 * abs(np.mean(y))
        margin = 1.96 * std_err

        return {
            "base": base,
            "bull": base + 1.2 * std_err,
            "bear": base - 1.2 * std_err,
            "conf_lower": base - margin,
            "conf_upper": base + margin,
            "slope": slope,
            "intercept": intercept,
            "r_squared": r_squared,
        }
