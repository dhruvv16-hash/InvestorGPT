import requests
import json
from typing import Any, Dict, List, Optional

class InvestorGPTClient:
    """A lightweight Python SDK for interacting programmatically with the InvestorGPT API Platform."""

    def __init__(self, base_url: str = "http://localhost:8000/api/v1"):
        self.base_url = base_url.rstrip("/")

    def _get(self, endpoint: str, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        url = f"{self.base_url}/{endpoint.lstrip('/')}"
        res = requests.get(url, params=params)
        res.raise_for_status()
        return res.json()

    def _post(self, endpoint: str, json_data: Dict[str, Any]) -> Dict[str, Any]:
        url = f"{self.base_url}/{endpoint.lstrip('/')}"
        res = requests.post(url, json=json_data)
        res.raise_for_status()
        return res.json()

    def _delete(self, endpoint: str) -> Dict[str, Any]:
        url = f"{self.base_url}/{endpoint.lstrip('/')}"
        res = requests.delete(url)
        res.raise_for_status()
        return res.json()

    # 1. Analysis Endpoints
    def start_analysis(self, query: str) -> Dict[str, Any]:
        """Triggers an analysis workflow for a stock ticker or query."""
        return self._post("analyze", {"query": query})

    def get_analysis_status(self, analysis_id: str) -> Dict[str, Any]:
        """Fetches the state, timeline, and calculated metrics for an analysis."""
        return self._get(f"analyze/{analysis_id}")

    # 2. Institutional Ownership & Alternative Signals
    def get_institutional_ownership(self, ticker: str) -> Dict[str, Any]:
        """Retrieves institutional holding distribution, top holders, and net buying flow."""
        return self._get(f"ownership/{ticker}")

    def get_alternative_signals(self, ticker: str) -> Dict[str, Any]:
        """Retrieves Google Trends popularity indexes, hiring count, and web traffic indexes."""
        return self._get(f"alternative-data/{ticker}")

    # 3. AI Projections & Debate Studio
    def get_earnings_forecast(self, ticker: str) -> Dict[str, Any]:
        """Gets Q+1 model-generated EPS & Revenue projections with bull/bear scenario parameters."""
        return self._get(f"forecasting/{ticker}")

    def get_ai_debate(self, ticker: str) -> Dict[str, Any]:
        """Simulates and fetches a 4-round Bull vs Bear debate transcript for a company."""
        return self._get(f"debate/{ticker}")

    # 4. Explainability & Milestones
    def get_score_breakdown(self, ticker: str) -> Dict[str, Any]:
        """Exposes the exact mathematical points tree behind the Investment Score."""
        return self._get(f"explainability/{ticker}")

    def get_timeline(self, ticker: str) -> Dict[str, Any]:
        """Fetches IPO, product pivots, and major acquisition events chronological milestones."""
        return self._get(f"timeline/{ticker}")

    # 5. Portfolio Optimization
    def get_portfolio(self, user_id: str) -> Dict[str, Any]:
        """Fetches asset holdings and P&L summary metrics."""
        return self._get("portfolio", {"user_id": user_id})

    def add_holding(self, user_id: str, ticker: str, shares: float, price: float) -> Dict[str, Any]:
        """Adds or updates a transaction in the user's portfolio holdings."""
        return self._post("portfolio/add", {
            "user_id": user_id,
            "ticker": ticker.upper(),
            "shares": shares,
            "price": price
        })

    def optimize_portfolio(self, user_id: str) -> Dict[str, Any]:
        """Calculates efficient frontiers (returns/vols) and target weights via MPT simulations."""
        return self._get("portfolio/optimize", {"user_id": user_id})

    # 6. NLP Screener
    def screen_stocks(self, query: str) -> List[Dict[str, Any]]:
        """Screens the database using conversational queries (e.g. 'undervalued tech')."""
        result = self._get("screener", {"query": query})
        return result.get("results", [])

    # 7. Watchlist Intelligence
    def get_watchlist(self, user_id: str) -> Dict[str, Any]:
        """Lists watched tickers and displays if price or RSI alerts have fired."""
        return self._get("watchlist", {"user_id": user_id})

    def add_watchlist_trigger(self, user_id: str, ticker: str, trigger_type: str, threshold: float) -> Dict[str, Any]:
        """Adds a watchlist trigger (e.g. PRICE_BELOW, RSI_BELOW)."""
        return self._post("watchlist/add", {
            "user_id": user_id,
            "ticker": ticker.upper(),
            "trigger_type": trigger_type,
            "threshold": threshold
        })

    def remove_watchlist_trigger(self, trigger_id: str) -> Dict[str, Any]:
        """Deletes a trigger from the user's active watchlist alerts."""
        return self._delete(f"watchlist/remove/{trigger_id}")

    # 8. Historical Backtesting
    def get_backtest(self, ticker: str, year: int = 2022) -> Dict[str, Any]:
        """Runs retroactive model projections and measures prediction variances."""
        return self._get(f"backtest/{ticker}", {"year": year})

    # 9. Valuation Calibration Engine
    def log_calibration_record(
        self,
        ticker: str,
        user_id: str,
        predicted_revenue: float,
        predicted_eps: float,
        predicted_fair_value: float
    ) -> Dict[str, Any]:
        """Logs a model valuation prediction for future calibration."""
        return self._post("calibration/log", {
            "ticker": ticker.upper(),
            "user_id": user_id,
            "predicted_revenue": predicted_revenue,
            "predicted_eps": predicted_eps,
            "predicted_fair_value": predicted_fair_value
        })

    def trigger_calibration(self, ticker: str) -> Dict[str, Any]:
        """Compares past logged predictions against subsequent actual reported numbers."""
        return self._post(f"calibration/calibrate?ticker={ticker.upper()}", {})

    def get_calibration_feedback(self, ticker: str) -> Dict[str, Any]:
        """Retrieves calibration metrics and heuristic adjustments for a ticker."""
        return self._get("calibration/feedback", {"ticker": ticker.upper()})


if __name__ == "__main__":
    # Quick sanity check / example demonstration usage
    client = InvestorGPTClient()
    print("InvestorGPT SDK Wrapper Client initialized.")
    print("Example usage:")
    print("  client = InvestorGPTClient()")
    print("  results = client.screen_stocks('find undervalued tech')")
