import logging
from typing import Any

logger = logging.getLogger("investorgpt.debate_engine")

class DebateEngine:
    """Consensus-driven buy/sell debate engine that pits a Bull Agent against a Bear Agent."""

    def generate_debate(self, ticker: str, company_name: str, metrics: dict[str, Any]) -> dict[str, Any]:
        logger.info(f"Generating AI debate for {ticker}")
        
        ticker_clean = ticker.upper().strip()

        # Extract metrics with defaults for robustness
        f_score = metrics.get("f_score", 6)
        z_score = metrics.get("z_score", 2.5)
        rsi = metrics.get("rsi", 52.0)
        dcf_value = metrics.get("dcf_value", 100.0)
        current_price = metrics.get("current_price", 95.0)
        trend = "Bullish" if current_price > metrics.get("sma_20", current_price) else "Bearish"

        upside_pct = ((dcf_value - current_price) / current_price * 100.0) if current_price > 0 else 5.0
        margin_status = f"{upside_pct:.1f}% under intrinsic valuation" if upside_pct > 0 else f"{abs(upside_pct):.1f}% overvalued compared to DCF"

        # Generate debate rounds referencing the computed numbers
        debate_rounds = [
            {
                "round": 1,
                "topic": "Fundamental Strengths & Solvency Health",
                "bull_arguments": f"Look at the balance sheet numbers! {company_name} secures a strong Piotroski F-score of {f_score}/9, which proves operations are stable, margins are expanding, and liquidity is well-managed. Furthermore, with an Altman Z-score of {z_score:.2f}, the company is firmly in the safety zone, with virtually zero bankruptcy risk. This is a fortress balance sheet.",
                "bear_arguments": f"An F-score of {f_score}/9 is backward-looking. A Z-score of {z_score:.2f} is decent, but let's not overlook leverage or capital efficiency. If capital expenditures rise to support new growth, free cash flow will contract, and those pristine ratios will deteriorate quickly."
            },
            {
                "round": 2,
                "topic": "Intrinsic Valuation & Margin of Safety",
                "bull_arguments": f"Our Discounted Cash Flow model indicates a fair value of {dcf_value:.2f}, trading at {margin_status} relative to the current price of {current_price:.2f}. This is a massive margin of safety for value investors, pricing in almost no negative assumptions.",
                "bear_arguments": f"The DCF model is highly sensitive to terminal growth and WACC assumptions. A slight increase in the discount rate or a drop in forecasted revenue growth would erase the entire apparent safety margin. The market is pricing this fairly given macroeconomic risks."
            },
            {
                "round": 3,
                "topic": "Technical Momentum & Market Sentiment",
                "bull_arguments": f"Technicals support a buy here. The current trend is {trend}, and the Daily RSI is at {rsi:.1f}. This shows healthy consolidation without entering overbought territory, preparing for a strong breakout above immediate resistance levels.",
                "bear_arguments": f"An RSI of {rsi:.1f} is purely neutral, indicating a lack of clear momentum. If the price fails to hold the 20-day SMA, momentum will turn sharply bearish. I would not chase the current chart structure."
            },
            {
                "round": 4,
                "topic": "Synthesis & Final Verdict",
                "bull_arguments": "To summarize, the combination of excellent solvency, undervalued cash flow projections, and a stable technical setup makes this an asymmetric risk-reward profile. The consensus-weighted case points to a strong BUY.",
                "bear_arguments": "Conversely, the sensitivity of the valuation, potential competitive threats, and macroeconomic headwinds warrant caution. At best, this is a HOLD; capital preservation should be the priority."
            }
        ]

        return {
            "ticker": ticker_clean,
            "company_name": company_name,
            "metrics_used": {
                "f_score": f_score,
                "z_score": z_score,
                "rsi": rsi,
                "dcf_value": dcf_value,
                "current_price": current_price,
                "trend": trend,
                "upside_pct": upside_pct
            },
            "rounds": debate_rounds,
            "consensus_verdict": "BUY" if upside_pct > 10.0 and f_score >= 6 else "HOLD" if f_score >= 4 else "SELL"
        }
