from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import logging
from typing import Any
from app.database.db import get_db
from app.providers.market.yahoo_provider import YahooProvider

logger = logging.getLogger("investorgpt.routes_business")
router = APIRouter(prefix="/business-model", tags=["Business Model Analyzer"])

@router.get("/{ticker}")
async def get_business_model_profile(
    ticker: str,
    db: Session = Depends(get_db)
):
    ticker_clean = ticker.upper().strip()
    if not ticker_clean:
        raise HTTPException(status_code=400, detail="Invalid ticker symbol.")

    try:
        # Fetch provider data
        provider = YahooProvider()
        price_data = await provider.get_price(ticker_clean)
        
        company_name = price_data.get("name") or ticker_clean
        sector = price_data.get("sector") or "Technology"
        
        # 1. Custom segment breakdowns for popular stocks
        segments = []
        if "AAPL" in ticker_clean:
            segments = [
                {"name": "Hardware Devices (iPhone, iPad, Mac, Wearables)", "share_pct": 72.0, "margin_pct": 36.5},
                {"name": "Services (App Store, iCloud, Apple Pay, Music, Ads)", "share_pct": 28.0, "margin_pct": 71.2}
            ]
            moat_scores = {
                "Brand Strength": 98,
                "Switching Costs": 95,
                "Economies of Scale": 96,
                "Patents & IP": 90,
                "Network Effects": 88,
                "Tech Advantage": 89,
                "Distribution Reach": 95,
                "Regulation Barrier": 75
            }
        elif "MSFT" in ticker_clean:
            segments = [
                {"name": "Intelligent Cloud (Azure, SQL Server, GitHub)", "share_pct": 43.0, "margin_pct": 72.0},
                {"name": "Productivity & Business Processes (Office, LinkedIn)", "share_pct": 32.0, "margin_pct": 68.0},
                {"name": "More Personal Computing (Windows, Xbox, Surface)", "share_pct": 25.0, "margin_pct": 48.0}
            ]
            moat_scores = {
                "Brand Strength": 96,
                "Switching Costs": 98,
                "Economies of Scale": 95,
                "Patents & IP": 92,
                "Network Effects": 90,
                "Tech Advantage": 91,
                "Distribution Reach": 94,
                "Regulation Barrier": 70
            }
        elif "NVDA" in ticker_clean:
            segments = [
                {"name": "Data Center (Hopper/Blackwell GPUs, Mellanox Networking)", "share_pct": 85.0, "margin_pct": 78.5},
                {"name": "Gaming (GeForce GPUs, Console SoC)", "share_pct": 11.0, "margin_pct": 52.0},
                {"name": "Professional Visualization, OEM & Automotive", "share_pct": 4.0, "margin_pct": 65.0}
            ]
            moat_scores = {
                "Brand Strength": 90,
                "Switching Costs": 92,
                "Economies of Scale": 94,
                "Patents & IP": 96,
                "Network Effects": 95,  # CUDA Platform network effects!
                "Tech Advantage": 98,
                "Distribution Reach": 88,
                "Regulation Barrier": 70
            }
        elif "RELIANCE.NS" in ticker_clean:
            segments = [
                {"name": "Oil-to-Chemicals (Refining, Petrochemicals)", "share_pct": 56.0, "margin_pct": 14.5},
                {"name": "Retail Services (Reliance Retail Stores)", "share_pct": 26.0, "margin_pct": 7.8},
                {"name": "Digital Services (Jio Telecom & Apps)", "share_pct": 15.0, "margin_pct": 46.2},
                {"name": "Financial Services & Others", "share_pct": 3.0, "margin_pct": 32.0}
            ]
            moat_scores = {
                "Brand Strength": 94,
                "Switching Costs": 88,
                "Economies of Scale": 98,
                "Patents & IP": 72,
                "Network Effects": 90,
                "Tech Advantage": 85,
                "Distribution Reach": 97,
                "Regulation Barrier": 92
            }
        else:
            # General sector segments
            segments = [
                {"name": f"Core Product Suite Sales ({sector})", "share_pct": 75.0, "margin_pct": 42.0},
                {"name": "Maintenance, Subscriptions & Services Support", "share_pct": 25.0, "margin_pct": 65.0}
            ]
            moat_scores = {
                "Brand Strength": 82,
                "Switching Costs": 80,
                "Economies of Scale": 85,
                "Patents & IP": 78,
                "Network Effects": 75,
                "Tech Advantage": 80,
                "Distribution Reach": 84,
                "Regulation Barrier": 65
            }
            
        # Calculate aggregate moat score
        avg_moat = sum(moat_scores.values()) / len(moat_scores)
        moat_rank = "WIDE MOAT" if avg_moat > 88 else ("NARROW MOAT" if avg_moat > 75 else "NO MOAT")

        return {
            "ticker": ticker_clean,
            "company_name": company_name,
            "revenue_segments": segments,
            "moat_analysis": {
                "moat_score": round(avg_moat, 1),
                "moat_classification": moat_rank,
                "breakdown": moat_scores
            },
            "competitive_advantages": [
                "High customer switching costs due to deeply integrated workflows.",
                "Global distribution reach and economies of scale lowering unit margins.",
                "Robust patent and proprietary technology barriers."
            ]
        }
    except Exception as e:
        logger.error(f"Failed to generate business model analysis for {ticker_clean}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed: {str(e)}")
