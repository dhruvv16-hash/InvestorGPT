import logging
from typing import Any, List
from sqlalchemy.orm import Session
from app.models.models import Company, Analysis, Financial, ValuationResult, TechnicalData

logger = logging.getLogger("investorgpt.screener_engine")

class ScreenerEngine:
    """Parses natural language queries and filters database companies based on financial and technical metrics."""

    def screen_companies(self, db: Session, query: str) -> List[dict[str, Any]]:
        logger.info(f"Screening companies with query: '{query}'")
        
        query_lower = query.lower().strip()
        
        # 1. Fetch all companies and their latest completed analysis details
        companies = db.query(Company).all()
        results = []

        for company in companies:
            # Get latest analysis for this company
            latest_analysis = (
                db.query(Analysis)
                .filter(Analysis.company_id == company.id, Analysis.state == "COMPLETED")
                .order_by(Analysis.created_at.desc())
                .first()
            )
            
            if not latest_analysis:
                continue

            analysis_id = latest_analysis.id
            
            # Fetch latest metrics
            financials = db.query(Financial).filter(Financial.analysis_id == analysis_id).all()
            techs = db.query(TechnicalData).filter(TechnicalData.analysis_id == analysis_id).all()
            vals = db.query(ValuationResult).filter(ValuationResult.analysis_id == analysis_id).all()
            
            # Extract key metrics
            current_price = next((float(f.value) for f in financials if f.metric_name == "current_price"), 0.0)
            f_score = next((int(f.value) for f in financials if f.metric_name == "f_score"), 0)
            z_score = next((float(f.value) for f in financials if f.metric_name == "z_score"), 0.0)
            rsi = next((float(t.value) for t in techs if t.indicator_name == "RSI"), 50.0)
            dcf_val = next((v for v in vals if v.model_name == "DCF"), None)
            
            fair_value = float(dcf_val.fair_value) if dcf_val and dcf_val.fair_value is not None else 0.0
            
            # Calculate metrics
            upside_pct = ((fair_value - current_price) / current_price * 100.0) if current_price > 0 else 0.0
            
            comp_data = {
                "id": company.id,
                "ticker": company.ticker,
                "name": company.name,
                "sector": company.sector or "UNKNOWN",
                "industry": company.industry or "UNKNOWN",
                "currency": company.currency,
                "current_price": current_price,
                "f_score": f_score,
                "z_score": z_score,
                "rsi": rsi,
                "fair_value": fair_value,
                "upside_pct": upside_pct,
                "recommendation": latest_analysis.recommendation or "HOLD",
                "confidence": float(latest_analysis.confidence or 0.5)
            }
            results.append(comp_data)

        # 2. Parse natural language rules from query and apply filters
        filtered_results = []
        
        # Determine query parameters
        want_tech = any(keyword in query_lower for keyword in ["tech", "software", "semiconductor", "ai", "nvidia", "apple"])
        want_undervalued = any(keyword in query_lower for keyword in ["undervalued", "cheap", "margin of safety", "discount"])
        want_safe = any(keyword in query_lower for keyword in ["safe", "stable", "strong", "quality", "f-score", "solvency"])
        want_oversold = any(keyword in query_lower for keyword in ["oversold", "dip", "rsi"])

        sector_keywords = ["energy", "financial", "healthcare", "materials", "consumer", "utility", "industrial", "telecom", "real estate"]
        active_sector_filters = [kw for kw in sector_keywords if kw in query_lower]

        for item in results:
            keep = True
            
            # Technology check
            if want_tech:
                is_tech_sector = any(kw in item["sector"].lower() or kw in item["industry"].lower() or kw in item["name"].lower()
                                     for kw in ["tech", "software", "semiconductor", "computer", "internet", "electronics", "ai"])
                is_known_tech = item["ticker"] in ["AAPL", "NVDA", "MSFT", "GOOGL", "AMZN"]
                if not (is_tech_sector or is_known_tech):
                    keep = False

            # Other sector checks
            if active_sector_filters and keep:
                matched_sector = False
                for kw in active_sector_filters:
                    if kw in item["sector"].lower() or kw in item["industry"].lower():
                        matched_sector = True
                        break
                if not matched_sector:
                    keep = False
            
            # Undervalued check
            if want_undervalued and keep:
                if item["upside_pct"] <= 5.0:  # must have at least 5% upside compared to DCF
                    keep = False

            # Financial strength / F-score check
            if want_safe and keep:
                if item["f_score"] < 5 and item["z_score"] < 1.8:  # not safe or low f_score
                    keep = False

            # Oversold check
            if want_oversold and keep:
                if item["rsi"] > 45.0:  # must be oversold or neutral-low RSI
                    keep = False

            if keep:
                filtered_results.append(item)

        # If no filters match, return everything but sorted by upside or confidence
        if not filtered_results and len(query_lower) < 5:
            filtered_results = results

        # Sort filtered results by upside pct descending
        filtered_results.sort(key=lambda x: x["upside_pct"], reverse=True)
        return filtered_results
