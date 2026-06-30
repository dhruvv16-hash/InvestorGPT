import asyncio
import logging
from typing import Any
from app.providers.market.yahoo_provider import YahooProvider

logger = logging.getLogger("investorgpt.competitor_engine")

PEER_GROUPS = {
    "semiconductors": ["AMD", "AVGO", "INTC", "QCOM"],
    "consumer electronics": ["AAPL", "MSFT", "GOOGL", "AMZN"],
    "auto manufacturers": ["TSLA", "TM", "F", "GM"],
    "financial services": ["JPM", "BAC", "MS", "GS"],
}

class CompetitorEngine:
    """Identifies and extracts financial comparisons for peer companies."""

    def __init__(self):
        self.provider = YahooProvider()

    async def get_peers(self, ticker: str, industry: str) -> list[str]:
        """Resolve a list of 3-4 peer symbols for a company, matching regional context."""
        cleaned_industry = industry.lower().strip()
        ticker_upper = ticker.upper()
        
        # 1. Indian company (.NS or .BO)
        is_indian = ticker_upper.endswith(".NS") or ticker_upper.endswith(".BO") or "RELIANCE" in ticker_upper or "PINELABS" in ticker_upper
        if is_indian:
            if any(k in cleaned_industry for k in ["tech", "software", "information", "computer", "digital"]):
                peers = ["TCS.NS", "INFY.NS", "WIPRO.NS", "HCLTECH.NS"]
            elif any(k in cleaned_industry for k in ["bank", "financial", "credit", "finance", "invest"]):
                peers = ["HDFCBANK.NS", "ICICIBANK.NS", "SBIN.NS", "AXISBANK.NS"]
            elif any(k in cleaned_industry for k in ["auto", "car", "vehicle", "manufactur"]):
                peers = ["TATAMOTORS.NS", "MARUTI.NS", "M&M.NS"]
            else:
                peers = ["RELIANCE.NS", "TCS.NS", "HDFCBANK.NS", "INFY.NS"]
            return [p for p in peers if p.upper() != ticker_upper]

        # 2. UK company (.L)
        elif ticker_upper.endswith(".L"):
            peers = ["BP.L", "AZN.L", "HSBA.L", "GSK.L"]
            return [p for p in peers if p.upper() != ticker_upper]

        # 3. Match US industry peer groups
        for key, peers in PEER_GROUPS.items():
            if key in cleaned_industry:
                return [p for p in peers if p.upper() != ticker_upper]
                
        # Default peers if industry is not matched
        default_peers = ["AAPL", "MSFT", "GOOGL", "AMZN"]
        return [p for p in default_peers if p.upper() != ticker_upper]

    async def get_peer_comparison(self, ticker: str, industry: str) -> list[dict[str, Any]]:
        """Fetch comparison metrics for peers."""
        peer_symbols = await self.get_peers(ticker, industry)
        logger.info(f"Comparing {ticker} against peers: {peer_symbols}")

        tasks = []
        for symbol in peer_symbols:
            tasks.append(self._fetch_peer_metrics(symbol))
            
        results = await asyncio.gather(*tasks, return_exceptions=True)
        comparison = []
        for res in results:
            if isinstance(res, dict) and "ticker" in res:
                comparison.append(res)
        return comparison

    async def _fetch_peer_metrics(self, symbol: str) -> dict[str, Any] | None:
        try:
            # Fetch price profile
            price_data = await self.provider.get_price(symbol)
            # Fetch financials
            financials = await self.provider.get_financial_statements(symbol, years=1)
            
            latest_year = max(financials.get("revenue", {}).keys()) if financials.get("revenue") else None
            
            pe = float("nan")
            gross_margin = float("nan")
            net_margin = float("nan")
            revenue = float("nan")

            if latest_year:
                rev = financials["revenue"].get(latest_year, 0)
                net = financials["net_income"].get(latest_year, 0)
                cogs = financials["cogs"].get(latest_year, 0)
                
                revenue = rev
                gross_margin = (rev - cogs) / rev if rev else 0
                net_margin = net / rev if rev else 0
                
                # Fetch shares outstanding to compute EPS and PE
                shares = price_data.get("shares_outstanding")
                if shares and net:
                    eps = net / shares
                    if eps > 0:
                        pe = price_data["price"] / eps

            return {
                "ticker": symbol,
                "name": price_data.get("name", symbol),
                "price": price_data["price"],
                "currency": price_data.get("currency", "USD"),
                "market_cap": price_data.get("market_cap"),
                "pe": pe if not isinstance(pe, float) or not pe != pe else None,  # Handle NaN check
                "gross_margin": gross_margin if not isinstance(gross_margin, float) or not gross_margin != gross_margin else None,
                "net_margin": net_margin if not isinstance(net_margin, float) or not net_margin != net_margin else None,
                "revenue": revenue if not isinstance(revenue, float) or not revenue != revenue else None
            }
        except Exception as e:
            logger.warning(f"Failed to fetch comparison metrics for peer {symbol}: {e}")
            return None

    async def get_detailed_metrics(self, symbol: str, db: Any) -> dict[str, Any] | None:
        """Fetch all detailed calculated metrics from the database for a completed analysis."""
        from app.models.models import Company, Analysis, Financial, ValuationResult, TechnicalData
        
        try:
            # Query the company and the latest completed analysis
            company = db.query(Company).filter(Company.ticker == symbol.upper().strip()).first()
            if not company:
                return None
                
            analysis = db.query(Analysis).filter(
                Analysis.company_id == company.id,
                Analysis.state == "COMPLETED"
            ).order_by(Analysis.created_at.desc()).first()
            
            if not analysis:
                return None
                
            financials = db.query(Financial).filter(Financial.analysis_id == analysis.id).all()
            valuations = db.query(ValuationResult).filter(ValuationResult.analysis_id == analysis.id).all()
            technicals = db.query(TechnicalData).filter(TechnicalData.analysis_id == analysis.id).all()
            
            # Extract basic data
            price = next((float(f.value) for f in financials if f.metric_name == "current_price"), None)
            if price is None:
                # Fallback to provider if current price is not saved in DB
                price_data = await self.provider.get_price(symbol)
                price = price_data["price"]
                
            market_cap = next((float(f.value) for f in financials if f.metric_name == "market_cap"), None)
            if market_cap is None:
                try:
                    price_data = await self.provider.get_price(symbol)
                    market_cap = price_data.get("market_cap")
                except Exception:
                    pass
            
            latest_year = max(f.fiscal_period for f in financials if f.fiscal_period and f.metric_name == "revenue") if any(f.metric_name == "revenue" for f in financials) else None
            
            revenue = None
            gross_margin = None
            net_margin = None
            pe = None
            ocf = None
            capex = None
            
            if latest_year:
                rev = next((float(f.value) for f in financials if f.metric_name == "revenue" and f.fiscal_period == latest_year), None)
                net = next((float(f.value) for f in financials if f.metric_name == "net_income" and f.fiscal_period == latest_year), None)
                cogs = next((float(f.value) for f in financials if f.metric_name == "cogs" and f.fiscal_period == latest_year), None)
                eps = next((float(f.value) for f in financials if f.metric_name == "diluted_eps" and f.fiscal_period == latest_year), None)
                ocf = next((float(f.value) for f in financials if f.metric_name == "operating_cash_flow" and f.fiscal_period == latest_year), None)
                capex = next((float(f.value) for f in financials if f.metric_name == "capital_expenditures" and f.fiscal_period == latest_year), None)
                
                revenue = rev
                if rev:
                    gross_margin = (rev - (cogs or 0)) / rev
                    net_margin = net / rev if net is not None else None
                if eps and eps > 0 and price:
                    pe = price / eps

            # Advanced scores
            f_score = next((int(f.value) for f in financials if f.metric_name == "f_score"), None)
            z_score = next((float(f.value) for f in financials if f.metric_name == "z_score"), None)
            
            # Valuation
            dcf = next((v for v in valuations if v.model_name == "DCF"), None)
            fair_value = float(dcf.fair_value) if dcf and dcf.fair_value is not None else None
            
            # Technicals
            rsi = next((float(t.value) for t in technicals if t.indicator_name == "RSI"), None)
            sma_20 = next((float(t.value) for t in technicals if t.indicator_name == "SMA_20"), None)
            
            # Sentiment & Risk
            news_sentiment = next((v for v in valuations if v.model_name == "NEWS_SENTIMENT"), None)
            sentiment = news_sentiment.assumptions.get("overall_sentiment") if news_sentiment and news_sentiment.assumptions else None
            
            risk_profile = next((v for v in valuations if v.model_name == "RISK_PROFILE"), None)
            risk_level = risk_profile.assumptions.get("overall_level") if risk_profile and risk_profile.assumptions else None

            return {
                "ticker": company.ticker,
                "name": company.name,
                "price": price,
                "currency": company.currency,
                "market_cap": market_cap,
                "pe": pe,
                "gross_margin": gross_margin,
                "net_margin": net_margin,
                "revenue": revenue,
                "f_score": f_score,
                "z_score": z_score,
                "fair_value": fair_value,
                "rsi": rsi,
                "sma_20": sma_20,
                "sentiment": sentiment,
                "risk_level": risk_level,
                "operating_cash_flow": ocf,
                "capital_expenditures": capex
            }
        except Exception as e:
            logger.error(f"Failed to fetch detailed metrics for {symbol}: {e}")
            return None
