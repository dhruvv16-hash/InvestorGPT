import logging
from typing import Any

logger = logging.getLogger("investorgpt.reviewer")

class ReviewerAgent:
    """Reviewer Agent that validates financial logic, sanity checks, and calculations before report publication."""

    def review(self, data: dict[str, Any]) -> dict[str, Any]:
        logger.info("Reviewer Agent starting report QA checks...")
        failures = []

        # Sanity check: WACC should be greater than terminal growth
        dcf_assumptions = data.get("dcf_assumptions")
        if dcf_assumptions:
            wacc = dcf_assumptions.get("wacc", 0)
            terminal_growth = dcf_assumptions.get("terminal_growth", 0)
            if terminal_growth >= wacc:
                failures.append("Invalid DCF assumptions: terminal growth >= WACC")

        # Sanity check: Shareholder equity or assets should not be negative in normal conditions
        assets = data.get("total_assets")
        if assets and assets < 0:
            failures.append("Data anomaly: Total assets cannot be negative")

        # In case of failures, report REJECTED
        if failures:
            logger.warning(f"Reviewer Agent checks failed: {failures}")
            return {"status": "REJECTED", "reasons": failures}
            
        logger.info("Reviewer Agent checks approved.")
        return {"status": "APPROVED", "reasons": []}
