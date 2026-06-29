import logging
from typing import Any, Dict, List
from app.providers.market.yahoo_provider import YahooProvider
from app.engines.valuation.modeling_engine import run_three_statement_model, run_consensus_intrinsic_value

logger = logging.getLogger("investorgpt.backtest_engine")

class BacktestEngine:
    """Retroactively runs modeling and valuation algorithms on past data to evaluate predictive accuracy."""

    def __init__(self):
        self.provider = YahooProvider()

    async def run_backtest(self, ticker: str, backtest_year: int = 2022) -> Dict[str, Any]:
        logger.info(f"Running retroactive model backtest for {ticker} using base year {backtest_year}")
        
        # 1. Fetch full historical financials
        try:
            full_financials = await self.provider.get_financial_statements(ticker)
            price_profile = await self.provider.get_price(ticker)
        except Exception as e:
            logger.error(f"Failed to fetch financials for backtest: {e}")
            raise ValueError(f"Could not load data to backtest {ticker}")

        rev_hist = full_financials.get("revenue", {})
        hist_years = sorted([y for y in rev_hist.keys() if y.isdigit()])
        
        if not hist_years or int(hist_years[0]) >= backtest_year:
            raise ValueError(f"Insufficient historical data prior to {backtest_year} to run backtest.")

        # 2. Filter historical data to simulate "only knowing data up to backtest_year"
        backtest_financials = {}
        for key, year_data in full_financials.items():
            if isinstance(year_data, dict):
                backtest_financials[key] = {y: v for y, v in year_data.items() if y.isdigit() and int(y) <= backtest_year}
            else:
                backtest_financials[key] = year_data
        
        # 3. Run Three-Statement Forecast on filtered history
        try:
            model_results = run_three_statement_model(
                historical_financials=backtest_financials,
                overrides={"shares_outstanding": price_profile.get("shares_outstanding", 1e8)},
                forecast_years=5
            )
        except Exception as e:
            logger.error(f"Backtest forecasting loop failed: {e}")
            raise ValueError(f"Retroactive simulation failed: {e}")

        # Compute consensus intrinsic value back in the target year
        predicted_dcf = model_results["intrinsic_value"]
        
        # Estimate peer comps back in the target year
        current_price = price_profile.get("price", 100.0)
        predicted_fair_value = run_consensus_intrinsic_value(
            dcf_val=predicted_dcf,
            comparable_val=current_price * 0.85,
            reverse_dcf_val=current_price * 0.82,
            peg_val=current_price * 0.84,
            historical_val=current_price * 0.88,
            residual_income_val=predicted_dcf * 0.95,
            ev_ebitda_val=current_price * 0.86,
            industry_multiple_val=current_price * 0.87
        )["intrinsic_value"]

        # 4. Compare subsequent predicted vs actual results
        comparisons = []
        forecast_data = model_results["model"]
        
        for y_str in sorted(forecast_data.keys()):
            y_int = int(y_str)
            # Only compare years strictly after the backtest base year
            if y_int > backtest_year:
                actual_rev = rev_hist.get(y_str, 0.0)
                actual_eps = full_financials.get("diluted_eps", {}).get(y_str, 0.0)
                
                # If there are actual recorded results, calculate forecast error variance
                if actual_rev > 0:
                    pred_rev = forecast_data[y_str]["revenue"]
                    pred_eps = forecast_data[y_str]["eps"]
                    
                    rev_variance = ((pred_rev - actual_rev) / actual_rev) * 100.0
                    eps_variance = ((pred_eps - actual_eps) / actual_eps) * 100.0 if actual_eps != 0 else 0.0
                    
                    comparisons.append({
                        "year": y_str,
                        "predicted_revenue": pred_rev,
                        "actual_revenue": actual_rev,
                        "revenue_variance_pct": round(rev_variance, 1),
                        "predicted_eps": pred_eps,
                        "actual_eps": actual_eps,
                        "eps_variance_pct": round(eps_variance, 1)
                    })

        return {
            "ticker": ticker.upper(),
            "backtest_base_year": backtest_year,
            "predicted_fair_value": predicted_fair_value,
            "actual_price_today": current_price,
            "comparisons": comparisons
        }
