import logging

logger = logging.getLogger("investorgpt.consensus")

DECISION_RANK = {"STRONG_SELL": -3, "SELL": -2, "HOLD": 0, "BUY": 2, "STRONG_BUY": 3}

class ConsensusEngine:
    """Consensus Engine (Chairperson) that combines individual engine votes into a single weighted recommendation."""

    def compute_consensus(self, votes: list[dict]) -> dict:
        """Each vote dict must contain:
        - engine: str
        - decision: str ("STRONG_SELL", "SELL", "HOLD", "BUY", "STRONG_BUY")
        - confidence: float (0.0 to 1.0)
        - weight: float
        """
        logger.info(f"Computing consensus for {len(votes)} engine votes")
        
        weighted_score = sum(
            DECISION_RANK[v["decision"]] * v["confidence"] * v["weight"] for v in votes
        )
        total_weight = sum(v["weight"] for v in votes)
        normalized_score = weighted_score / total_weight if total_weight else 0.0

        if normalized_score >= 2.0:
            decision = "STRONG_BUY"
        elif normalized_score >= 0.5:
            decision = "BUY"
        elif normalized_score <= -2.0:
            decision = "STRONG_SELL"
        elif normalized_score <= -0.5:
            decision = "SELL"
        else:
            decision = "HOLD"

        agreement = 1 - (max(v["confidence"] for v in votes) - min(v["confidence"] for v in votes)) if votes else 1.0
        
        return {
            "decision": decision,
            "score": normalized_score,
            "agreement": agreement,
            "votes": votes,
        }
