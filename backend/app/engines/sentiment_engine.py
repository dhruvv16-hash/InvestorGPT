import logging
from typing import Any

logger = logging.getLogger("investorgpt.sentiment_engine")

# Lexicon lists for financial sentiment
BULLISH_KEYWORDS = [
    "growth", "strong", "outperform", "rally", "record", "beating", "upgrade", "higher", 
    "gain", "demand", "positive", "expand", "profit", "surpass", "upside", "win", "climb"
]

BEARISH_KEYWORDS = [
    "fall", "decline", "downgrade", "underperform", "drop", "risk", "disappoint", "slump",
    "missed", "lower", "negative", "loss", "contract", "deficit", "debt", "shrink", "downside"
]

class SentimentEngine:
    """lexicon-based financial text sentiment scoring engine."""

    def analyze_articles(self, articles: list[dict[str, Any]]) -> dict[str, Any]:
        """Analyzes a list of news articles and returns sentiment distribution."""
        logger.info(f"Analyzing sentiment for {len(articles)} articles")
        
        bullish_count = 0
        bearish_count = 0
        neutral_count = 0
        
        scored_articles = []
        for art in articles:
            title_lower = art["title"].lower()
            
            # Simple keyword match scoring
            bull_score = sum(1 for kw in BULLISH_KEYWORDS if kw in title_lower)
            bear_score = sum(1 for kw in BEARISH_KEYWORDS if kw in title_lower)
            
            if bull_score > bear_score:
                sentiment = "BULLISH"
                bullish_count += 1
            elif bear_score > bull_score:
                sentiment = "BEARISH"
                bearish_count += 1
            else:
                sentiment = "NEUTRAL"
                neutral_count += 1
                
            scored_articles.append({
                **art,
                "sentiment": sentiment,
                "score": bull_score - bear_score
            })
            
        total = len(articles)
        sentiment_score = 0.0
        if total > 0:
            # Score scaled from -1.0 (all bearish) to +1.0 (all bullish)
            sentiment_score = (bullish_count - bearish_count) / total

        # Map score to category
        if sentiment_score >= 0.2:
            label = "BULLISH"
        elif sentiment_score <= -0.2:
            label = "BEARISH"
        else:
            label = "NEUTRAL"

        return {
            "overall_sentiment": label,
            "sentiment_score": sentiment_score,
            "distribution": {
                "bullish": bullish_count,
                "bearish": bearish_count,
                "neutral": neutral_count
            },
            "articles": scored_articles
        }
