import logging
from typing import Any

logger = logging.getLogger("investorgpt.risk_engine")

class RiskEngine:
    """Evaluates stock risk levels based on fundamental, valuation, and macro indicators."""

    def evaluate_risk(
        self,
        debt_to_equity: float,
        current_ratio: float,
        margin_of_safety: float,
        inflation_rate: float,
        sentiment_score: float
    ) -> dict[str, Any]:
        logger.info("Evaluating company risk profile")
        
        risks = []
        
        # 1. Leverage Risk
        if debt_to_equity > 1.5 or current_ratio < 1.0:
            leverage_score = 75
            leverage_level = "HIGH"
            leverage_desc = "High leverage or low liquidity ratio detected. Current ratio is under 1.0."
        elif debt_to_equity > 0.8:
            leverage_score = 45
            leverage_level = "MEDIUM"
            leverage_desc = "Moderate debt level in capital structure."
        else:
            leverage_score = 20
            leverage_level = "LOW"
            leverage_desc = "Strong balance sheet with minimal leverage."
        risks.append({"category": "Leverage", "score": leverage_score, "level": leverage_level, "description": leverage_desc})

        # 2. Valuation Risk
        if margin_of_safety < -0.15:
            val_score = 80
            val_level = "HIGH"
            val_desc = "Stock is highly overvalued relative to DCF fair value model."
        elif margin_of_safety < 0.10:
            val_score = 50
            val_level = "MEDIUM"
            val_desc = "Stock is trading near fair value. Narrow margin of safety."
        else:
            val_score = 25
            val_level = "LOW"
            val_desc = "Significant margin of safety. Undervalued."
        risks.append({"category": "Valuation", "score": val_score, "level": val_level, "description": val_desc})

        # 3. Macro Exposure Risk
        if inflation_rate > 5.0:
            macro_score = 70
            macro_level = "HIGH"
            macro_desc = "High inflation environment presents threat to margins."
        elif inflation_rate > 3.0:
            macro_score = 45
            macro_level = "MEDIUM"
            macro_desc = "Moderate inflationary pressures."
        else:
            macro_score = 15
            macro_level = "LOW"
            macro_desc = "Stable macroeconomic environment."
        risks.append({"category": "Macro", "score": macro_score, "level": macro_level, "description": macro_desc})

        # 4. Sentiment Risk
        if sentiment_score < -0.2:
            sent_score = 75
            sent_level = "HIGH"
            sent_desc = "Highly negative news sentiment and media coverage."
        elif sentiment_score < 0.2:
            sent_score = 50
            sent_level = "MEDIUM"
            sent_desc = "Mixed or neutral media sentiment."
        else:
            sent_score = 20
            sent_level = "LOW"
            sent_desc = "Strongly positive media sentiment."
        risks.append({"category": "Sentiment", "score": sent_score, "level": sent_level, "description": sent_desc})

        # Compute overall risk score (average)
        avg_score = sum(r["score"] for r in risks) / len(risks)
        if avg_score >= 60:
            overall_level = "HIGH"
        elif avg_score >= 35:
            overall_level = "MEDIUM"
        else:
            overall_level = "LOW"

        return {
            "overall_score": avg_score,
            "overall_level": overall_level,
            "categories": risks
        }
