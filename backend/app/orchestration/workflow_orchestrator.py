import asyncio
import logging
from datetime import datetime, timezone
from sqlalchemy.orm import Session

from app.models.models import Company, Analysis, Financial, ValuationResult, TechnicalData, Task
from app.agents.company_resolver import CompanyResolverAgent
from app.agents.consensus import ConsensusEngine
from app.agents.reviewer import ReviewerAgent
from app.providers.market.yahoo_provider import YahooProvider
from app.providers.provider_router import MarketDataProviderRouter
from app.engines import calculation_engine
from app.engines.valuation.dcf_engine import run_multi_scenario_dcf
from app.orchestration.event_bus import EventBus

from app.engines.competitor_engine import CompetitorEngine
from app.engines.macro_engine import MacroEngine
from app.engines.news_engine import NewsEngine
from app.engines.sentiment_engine import SentimentEngine
from app.engines.risk_engine import RiskEngine
from app.config import settings

logger = logging.getLogger("investorgpt.orchestrator")

class WorkflowOrchestrator:
    """Coordinates the end-to-end analysis lifecycle for a query."""

    def __init__(self, db: Session, event_bus: EventBus):
        self.db = db
        self.event_bus = event_bus
        self.resolver = CompanyResolverAgent()
        self.consensus_engine = ConsensusEngine()
        self.reviewer = ReviewerAgent()
        
        self.competitor_engine = CompetitorEngine()
        self.macro_engine = MacroEngine()
        self.news_engine = NewsEngine()
        self.sentiment_engine = SentimentEngine()
        self.risk_engine = RiskEngine()
        
        # Setup provider router with Yahoo Finance
        self.yahoo_provider = YahooProvider()
        self.market_router = MarketDataProviderRouter([self.yahoo_provider])

    async def run_analysis(self, query: str) -> str:
        """Run a complete end-to-end stock analysis from a search query.
        Returns the created analysis UUID.
        """
        logger.info(f"Starting new analysis workflow for query: {query}")

        # 1. Resolve Company
        try:
            profile = await self.resolver.resolve(query, db=self.db)
        except Exception as e:
            logger.error(f"Failed to resolve company for query '{query}': {e}")
            raise ValueError(f"Could not resolve company for query '{query}'") from e

        # Get or create Company in DB
        company = self.db.query(Company).filter(
            Company.ticker == profile["ticker"],
            Company.exchange == profile["exchange"]
        ).first()

        if not company:
            company = Company(
                ticker=profile["ticker"],
                exchange=profile["exchange"],
                country=profile["country"],
                currency=profile["currency"],
                sector=profile["sector"],
                industry=profile["industry"],
                name=profile["name"],
                description=profile.get("description"),
                website=profile.get("website")
            )
            self.db.add(company)
            self.db.commit()
            self.db.refresh(company)
        else:
            # Update missing or UNKNOWN fields for existing companies
            updated = False
            if profile.get("description") and not company.description:
                company.description = profile["description"]
                updated = True
            if profile.get("website") and not company.website:
                company.website = profile["website"]
                updated = True
            if profile.get("sector") and (not company.sector or company.sector == "UNKNOWN"):
                company.sector = profile["sector"]
                updated = True
            if profile.get("industry") and (not company.industry or company.industry == "UNKNOWN"):
                company.industry = profile["industry"]
                updated = True
            if profile.get("name") and (not company.name or company.name == profile["ticker"]):
                company.name = profile["name"]
                updated = True
            if updated:
                self.db.commit()
                self.db.refresh(company)

        # 2. Create Analysis record
        analysis = Analysis(
            company_id=company.id,
            state="CREATED",
            version=1
        )
        self.db.add(analysis)
        self.db.commit()
        self.db.refresh(analysis)

        # Start the background pipeline
        # To avoid blocking the API client, we can run this asynchronously
        asyncio.create_task(self._execute_pipeline(analysis.id, company))
        return analysis.id

    async def resume_analysis(self, analysis_id: str, query: str) -> str:
        """Resume analysis for an existing Analysis record (used by worker)."""
        logger.info(f"Worker resuming analysis for {analysis_id} with query: {query}")
        
        # 1. Resolve Company
        try:
            profile = await self.resolver.resolve(query, db=self.db)
        except Exception as e:
            logger.error(f"Failed to resolve company for query '{query}': {e}")
            await self._update_state(analysis_id, "FAILED")
            raise ValueError(f"Could not resolve company for query '{query}'") from e
            
        company = self.db.query(Company).filter(
            Company.ticker == profile["ticker"],
            Company.exchange == profile["exchange"]
        ).first()

        if not company:
            company = Company(
                ticker=profile["ticker"],
                exchange=profile["exchange"],
                country=profile["country"],
                currency=profile["currency"],
                sector=profile["sector"],
                industry=profile["industry"],
                name=profile["name"],
                description=profile.get("description"),
                website=profile.get("website")
            )
            self.db.add(company)
            self.db.commit()
            self.db.refresh(company)
            
        # Update Analysis record with company_id
        analysis = self.db.query(Analysis).filter(Analysis.id == analysis_id).first()
        if analysis:
            analysis.company_id = company.id
            self.db.commit()
            
        # Execute pipeline synchronously in the worker
        await self._execute_pipeline(analysis_id, company)
        return analysis_id

    async def _update_state(self, analysis_id: str, state: str):
        analysis = self.db.query(Analysis).filter(Analysis.id == analysis_id).first()
        if analysis:
            analysis.state = state
            self.db.commit()
            await self.event_bus.publish("AnalysisStateChanged", {"analysis_id": analysis_id, "state": state})

    async def _execute_pipeline(self, analysis_id: str, company: Company):
        from app.database.db import SessionLocal
        self.db = SessionLocal()
        try:
            company = self.db.merge(company)
            logger.info(f"Executing pipeline for analysis {analysis_id} (ticker: {company.ticker})")
            # Stage: FETCHING_DATA
            await self._update_state(analysis_id, "FETCHING_DATA")
            
            # Fetch price, financials, ohlcv, news, macro concurrently
            price_task = self.market_router.get_price(company.ticker)
            financials_task = self.market_router.get_financial_statements(company.ticker)
            ohlcv_task = self.market_router.get_ohlcv(company.ticker, timeframe="1d", limit=100)
            news_task = self.news_engine.get_news(company.ticker, company.name, limit=5)
            macro_task = self.macro_engine.get_macro_indicators(company.country)

            price_data, financials, ohlcv, news_articles, macro_data = await asyncio.gather(
                price_task, financials_task, ohlcv_task, news_task, macro_task
            )

            # Stage: VERIFYING_DATA
            await self._update_state(analysis_id, "VERIFYING_DATA")
            # In Phase 1, we trust the normalized yfinance data (Trust score 96)
            confidence = 0.95

            # Save current price to DB
            self.db.add(Financial(
                analysis_id=analysis_id,
                metric_name="current_price",
                value=price_data["price"],
                source="yahoo_finance",
                confidence=1.0,
                retrieved_at=datetime.now(timezone.utc)
            ))

            # Save raw financials to DB
            for metric, dates in financials.items():
                for year, val in dates.items():
                    # Check if already exists for this analysis to avoid duplicate UNIQUE constraint error
                    existing = self.db.query(Financial).filter(
                        Financial.analysis_id == analysis_id,
                        Financial.metric_name == metric,
                        Financial.fiscal_period == year
                    ).first()
                    if not existing:
                        f_record = Financial(
                            analysis_id=analysis_id,
                            metric_name=metric,
                            value=val,
                            fiscal_period=year,
                            source="yahoo_finance",
                            confidence=confidence,
                            retrieved_at=datetime.now(timezone.utc)
                        )
                        self.db.add(f_record)
            self.db.commit()

            # Check if financials are synthetic (Yahoo API failed) - flag this analysis
            financials_are_synthetic = financials.get("__is_synthetic__", False)
            if financials_are_synthetic:
                logger.warning(
                    f"Synthetic financial data used for {company.ticker}. "
                    f"F-Score, Z-Score, and DCF calculations will be based on generated data, "
                    f"not real financial statements."
                )

            # Stage: RUNNING_ENGINES
            await self._update_state(analysis_id, "RUNNING_ENGINES")

            # Extract latest year values
            latest_year = max(financials.get("revenue", {}).keys()) if financials.get("revenue") else None
            prev_year = str(int(latest_year) - 1) if latest_year else None
            
            # Extract lists of closes/volumes for technical metrics
            import pandas as pd
            df_ohlcv = pd.DataFrame(ohlcv)
            
            tech_votes = {}
            fundamental_votes = {}
            valuation_votes = {}

            # Perform computations if we have data
            if latest_year and prev_year:
                rev_curr = financials["revenue"].get(latest_year, 0)
                rev_prev = financials["revenue"].get(prev_year, 0)
                net_curr = financials["net_income"].get(latest_year, 0)
                net_prev = financials["net_income"].get(prev_year, 0)
                assets_curr = financials["total_assets"].get(latest_year, 0)
                assets_prev = financials["total_assets"].get(prev_year, 0)
                debt_curr = financials["long_term_debt"].get(latest_year, 0)
                debt_prev = financials["long_term_debt"].get(prev_year, 0)
                curr_ratio_curr = financials["current_assets"].get(latest_year, 0) / financials["current_liabilities"].get(latest_year, 1)
                curr_ratio_prev = financials["current_assets"].get(prev_year, 0) / financials["current_liabilities"].get(prev_year, 1)
                shares_curr = price_data.get("shares_outstanding") or getattr(company, "shares_outstanding", None) or 1_000_000_000
                if price_data.get("is_synthetic"):
                    logger.warning(
                        f"Yahoo price fallback (synthetic) used for {company.ticker}. "
                        f"DCF and margin-of-safety calculations may be significantly inaccurate."
                    )
                shares_prev = shares_curr  # assume constant for simplification
                gross_margin_curr = (rev_curr - financials["cogs"].get(latest_year, 0)) / rev_curr if rev_curr else 0
                gross_margin_prev = (rev_prev - financials["cogs"].get(prev_year, 0)) / rev_prev if rev_prev else 0
                asset_turnover_curr = rev_curr / assets_curr if assets_curr else 0
                asset_turnover_prev = rev_prev / assets_prev if assets_prev else 0
                
                # Piotroski F-score
                f_score = calculation_engine.piotroski_f_score(
                    net_income_curr=net_curr,
                    net_income_prev=net_prev,
                    operating_cash_flow=financials["operating_cash_flow"].get(latest_year, 0),
                    roa_curr=net_curr/assets_curr if assets_curr else 0,
                    roa_prev=net_prev/assets_prev if assets_prev else 0,
                    long_term_debt_curr=debt_curr,
                    long_term_debt_prev=debt_prev,
                    total_assets_curr=assets_curr,
                    total_assets_prev=assets_prev,
                    current_ratio_curr=curr_ratio_curr,
                    current_ratio_prev=curr_ratio_prev,
                    shares_curr=shares_curr,
                    shares_prev=shares_prev,
                    gross_margin_curr=gross_margin_curr,
                    gross_margin_prev=gross_margin_prev,
                    asset_turnover_curr=asset_turnover_curr,
                    asset_turnover_prev=asset_turnover_prev
                )

                # Altman Z-score
                working_capital_val = financials.get("working_capital", {}).get(latest_year, 0)
                retained_earnings_val = financials.get("retained_earnings", {}).get(latest_year, 0)
                ebit_val = financials["ebit"].get(latest_year, 0)
                market_val_equity = price_data["price"] * shares_curr
                liabilities_val = financials["total_liabilities"].get(latest_year, 0)
                
                z_score = calculation_engine.altman_z_score(
                    working_capital=working_capital_val,
                    retained_earnings=retained_earnings_val,
                    ebit=ebit_val,
                    market_value_equity=market_val_equity,
                    total_assets=assets_curr,
                    total_liabilities=liabilities_val,
                    revenue=rev_curr
                )

                # Store fundamental ratios in DB
                self.db.add(Financial(analysis_id=analysis_id, metric_name="f_score", value=f_score, source="calculated", confidence=1.0, retrieved_at=datetime.now(timezone.utc)))
                self.db.add(Financial(analysis_id=analysis_id, metric_name="z_score", value=z_score, source="calculated", confidence=1.0, retrieved_at=datetime.now(timezone.utc)))
                
                # Fundamental engine vote
                # F-score >= 6 is strong Buy, <= 3 is Sell. Z-score < 1.81 is distress.
                if f_score >= 6 and z_score > 1.81:
                    fundamental_votes = {"decision": "BUY", "confidence": 0.90}
                elif f_score <= 3 or z_score < 1.1:
                    fundamental_votes = {"decision": "SELL", "confidence": 0.85}
                else:
                    fundamental_votes = {"decision": "HOLD", "confidence": 0.75}

                # Valuation Engine: DCF
                # We project using average of growth rate (capped between 2% and 15%)
                hist_growth = calculation_engine.cagr(rev_prev, rev_curr, 1) if rev_prev else 0.05
                projected_growth = max(0.02, min(0.15, hist_growth))
                
                # Assume WACC = 9% and terminal growth = 2.5%
                wacc_rate = 0.09
                term_growth = 0.025
                
                cash_val = financials.get("cash", {}).get(latest_year, 0)
                net_debt_val = debt_curr - cash_val
                
                ocf_val = financials.get("operating_cash_flow", {}).get(latest_year, 0)
                capex_val = abs(financials.get("capital_expenditures", {}).get(latest_year, 0))
                
                fcf_base_val = ocf_val - capex_val
                if not ocf_val:
                    fcf_base_val = net_curr * 0.8

                dcf_output = run_multi_scenario_dcf(
                    fcf_base=fcf_base_val,
                    base_growth=projected_growth,
                    wacc=wacc_rate,
                    terminal_growth=term_growth,
                    years=5,
                    net_debt=net_debt_val,
                    shares_outstanding=shares_curr
                )

                fair_value = dcf_output["blended_fair_value"]
                
                # Save valuation result to DB
                v_record = ValuationResult(
                    analysis_id=analysis_id,
                    model_name="DCF",
                    fair_value=fair_value,
                    assumptions={
                        "fcf_base": fcf_base_val,
                        "growth_rate": projected_growth,
                        "wacc": wacc_rate,
                        "terminal_growth": term_growth,
                        "net_debt": net_debt_val,
                        "shares_outstanding": shares_curr
                    },
                    confidence=0.85
                )
                self.db.add(v_record)

                # Valuation engine vote based on margin of safety
                margin_of_safety = (fair_value - price_data["price"]) / price_data["price"] if price_data["price"] else 0
                if margin_of_safety >= 0.15:
                    valuation_votes = {"decision": "BUY", "confidence": 0.90}
                elif margin_of_safety <= -0.15:
                    valuation_votes = {"decision": "SELL", "confidence": 0.85}
                else:
                    valuation_votes = {"decision": "HOLD", "confidence": 0.80}
            else:
                # Default fundamental/valuation votes if financials are missing
                fundamental_votes = {"decision": "HOLD", "confidence": 0.50}
                valuation_votes = {"decision": "HOLD", "confidence": 0.50}
                fair_value = price_data["price"]
                margin_of_safety = 0.0

            # Technical Analysis Engine
            if not df_ohlcv.empty:
                closes = df_ohlcv["close"]
                rsi_vals = calculation_engine.rsi(closes)
                latest_rsi = rsi_vals.iloc[-1] if not rsi_vals.empty else 50.0

                sma_20 = calculation_engine.sma(closes, 20)
                latest_sma_20 = sma_20.iloc[-1] if not sma_20.empty else price_data["price"]

                # Save technical data to DB
                self.db.add(TechnicalData(analysis_id=analysis_id, timeframe="1d", indicator_name="RSI", value=latest_rsi, computed_at=datetime.now(timezone.utc)))
                self.db.add(TechnicalData(analysis_id=analysis_id, timeframe="1d", indicator_name="SMA_20", value=latest_sma_20, computed_at=datetime.now(timezone.utc)))
                
                # Technical engine vote based on RSI and Price vs SMA_20
                if latest_rsi < 35:
                    tech_votes = {"decision": "BUY", "confidence": 0.85}
                elif latest_rsi > 70:
                    tech_votes = {"decision": "SELL", "confidence": 0.85}
                elif price_data["price"] > latest_sma_20:
                    tech_votes = {"decision": "BUY", "confidence": 0.70}
                else:
                    tech_votes = {"decision": "SELL", "confidence": 0.70}
            else:
                tech_votes = {"decision": "HOLD", "confidence": 0.50}

            # News Sentiment Analysis
            sentiment_data = self.sentiment_engine.analyze_articles(news_articles)
            self.db.add(ValuationResult(
                analysis_id=analysis_id,
                model_name="NEWS_SENTIMENT",
                fair_value=None,
                assumptions=sentiment_data,
                confidence=0.80
            ))
            
            # Save sentiment score to financials table
            self.db.add(Financial(
                analysis_id=analysis_id,
                metric_name="sentiment_score",
                value=sentiment_data["sentiment_score"],
                source="calculated",
                confidence=1.0,
                retrieved_at=datetime.now(timezone.utc)
            ))

            # Macroeconomics Ingestion
            self.db.add(ValuationResult(
                analysis_id=analysis_id,
                model_name="MACRO_INDICATORS",
                fair_value=None,
                assumptions=macro_data,
                confidence=0.90
            ))

            # Competitor Multiples Comparison
            competitor_data = await self.competitor_engine.get_peer_comparison(company.ticker, company.industry or "")
            self.db.add(ValuationResult(
                analysis_id=analysis_id,
                model_name="COMPETITORS",
                fair_value=None,
                assumptions={"comparison": competitor_data},
                confidence=0.85
            ))

            # Risk Assessment
            risk_data = self.risk_engine.evaluate_risk(
                debt_to_equity=debt_curr/assets_curr if latest_year and assets_curr else 0.5,
                current_ratio=curr_ratio_curr if latest_year else 1.5,
                margin_of_safety=margin_of_safety,
                inflation_rate=macro_data["inflation"],
                sentiment_score=sentiment_data["sentiment_score"]
            )
            self.db.add(ValuationResult(
                analysis_id=analysis_id,
                model_name="RISK_PROFILE",
                fair_value=None,
                assumptions=risk_data,
                confidence=0.85
            ))

            self.db.commit()

            # Stage: CONSENSUS
            await self._update_state(analysis_id, "CONSENSUS")

            # --- Derive votes from all 8 engines ---

            # News Sentiment vote: score > 0.1 = BUY, < -0.1 = SELL, else HOLD
            sent_score = sentiment_data.get("sentiment_score", 0.0)
            if sent_score > 0.1:
                sentiment_votes = {"decision": "BUY", "confidence": min(0.90, 0.65 + sent_score)}
            elif sent_score < -0.1:
                sentiment_votes = {"decision": "SELL", "confidence": min(0.90, 0.65 + abs(sent_score))}
            else:
                sentiment_votes = {"decision": "HOLD", "confidence": 0.60}

            # Macro vote: strong GDP + low inflation = bullish, stagflation = bearish
            macro_gdp = macro_data.get("gdp_growth", 2.5)
            macro_inf = macro_data.get("inflation", 3.5)
            if macro_gdp >= 2.5 and macro_inf <= 4.0:
                macro_votes = {"decision": "BUY", "confidence": 0.65}
            elif macro_gdp < 0 or macro_inf > 7.0:
                macro_votes = {"decision": "SELL", "confidence": 0.70}
            else:
                macro_votes = {"decision": "HOLD", "confidence": 0.60}

            # Risk vote: map overall_level to a decision
            risk_level = risk_data.get("overall_level", "MEDIUM")
            if risk_level == "LOW":
                risk_votes = {"decision": "BUY", "confidence": 0.75}
            elif risk_level == "HIGH":
                risk_votes = {"decision": "SELL", "confidence": 0.80}
            else:
                risk_votes = {"decision": "HOLD", "confidence": 0.60}

            # Competitor vote: use peer comparison median PE vs company PE
            # competitor_data is a list of peer dicts with "pe" field
            competitor_votes = {"decision": "HOLD", "confidence": 0.55}
            if isinstance(competitor_data, list) and competitor_data:
                peer_pes = [p.get("pe") for p in competitor_data if isinstance(p.get("pe"), (int, float)) and p["pe"] > 0]
                if peer_pes:
                    import statistics
                    median_pe = statistics.median(peer_pes)
                    company_pe = financials.get("pe_ratio", {}) or {}
                    if isinstance(company_pe, dict):
                        company_pe_val = next(iter(company_pe.values()), None) if company_pe else None
                    else:
                        company_pe_val = float(company_pe) if company_pe else None
                    if company_pe_val and company_pe_val > 0:
                        if company_pe_val < median_pe * 0.85:
                            competitor_votes = {"decision": "BUY", "confidence": 0.70}
                        elif company_pe_val > median_pe * 1.25:
                            competitor_votes = {"decision": "SELL", "confidence": 0.65}

            # Build full vote array with weights from settings
            votes = [
                {"engine": "fundamental",     **fundamental_votes,  "weight": settings.DEFAULT_WEIGHT_FUNDAMENTAL},
                {"engine": "valuation",        **valuation_votes,    "weight": settings.DEFAULT_WEIGHT_VALUATION},
                {"engine": "technical",        **tech_votes,         "weight": settings.DEFAULT_WEIGHT_TECHNICAL},
                {"engine": "risk",             **risk_votes,         "weight": settings.DEFAULT_WEIGHT_RISK},
                {"engine": "news_sentiment",   **sentiment_votes,    "weight": settings.DEFAULT_WEIGHT_NEWS},
                {"engine": "macro",            **macro_votes,        "weight": settings.DEFAULT_WEIGHT_MACRO},
                {"engine": "sentiment_score",  **sentiment_votes,    "weight": settings.DEFAULT_WEIGHT_SENTIMENT},
                {"engine": "competitor",       **competitor_votes,   "weight": settings.DEFAULT_WEIGHT_COMPETITOR},
            ]
            consensus_result = self.consensus_engine.compute_consensus(votes)
            decision = consensus_result["decision"]

            # Stage: REVIEW
            await self._update_state(analysis_id, "REVIEW")
            report_data = {
                "total_assets": assets_curr if latest_year else None,
                "dcf_assumptions": {
                    "wacc": wacc_rate if latest_year else 0,
                    "terminal_growth": term_growth if latest_year else 0
                }
            }
            review_result = self.reviewer.review(report_data)
            if review_result["status"] == "REJECTED":
                raise ValueError(f"Reviewer rejected report: {review_result['reasons']}")

            # Stage: REPORT_GENERATION
            await self._update_state(analysis_id, "REPORT_GENERATION")

            # Finalize Analysis record
            analysis = self.db.query(Analysis).filter(Analysis.id == analysis_id).first()
            if analysis:
                analysis.recommendation = decision
                analysis.confidence = float(sum(v["confidence"] * v["weight"] for v in votes))
                analysis.completed_at = datetime.now(timezone.utc)
                self.db.commit()

            # Stage: COMPLETED
            await self._update_state(analysis_id, "COMPLETED")
            logger.info(f"Pipeline completed successfully for analysis {analysis_id}. Result: {decision}")

        except Exception as e:
            logger.exception(f"Pipeline failed for analysis {analysis_id}: {e}")
            await self._update_state(analysis_id, "FAILED")
        finally:
            self.db.close()
