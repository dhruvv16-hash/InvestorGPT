from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
import logging
from typing import Any
from app.database.db import get_db
from app.providers.market.yahoo_provider import YahooProvider
from app.engines.valuation.modeling_engine import (
    calculate_wacc,
    run_three_statement_model,
    generate_automatic_assumptions
)

logger = logging.getLogger("investorgpt.routes_macro")
router = APIRouter(prefix="/macro", tags=["Economic Scenario Engine"])

class MacroSimulationRequest(BaseModel):
    ticker: str
    interest_rate_delta_pct: float  # e.g., +2.0 or -1.5
    oil_price_usd: float  # e.g., 120.0 (Base oil price is $75.0)

@router.post("/simulate")
async def simulate_macro_shock(
    req: MacroSimulationRequest,
    db: Session = Depends(get_db)
):
    ticker_clean = req.ticker.upper().strip()
    if not ticker_clean:
        raise HTTPException(status_code=400, detail="Invalid ticker symbol.")

    try:
        # 1. Load market provider details
        provider = YahooProvider()
        price_data = await provider.get_price(ticker_clean)
        
        current_price = price_data.get("price", 100.0)
        market_cap = price_data.get("market_cap") or 1e11
        shares = price_data.get("shares_outstanding") or 1e8
        sector = price_data.get("sector") or "Technology"
        
        # Default mock debt if unavailable
        total_debt = market_cap * 0.15
        beta = 1.1

        # 2. Fetch financials
        hist_financials = await provider.get_financial_statements(ticker_clean)
        hist_years = sorted([y for y in hist_financials.get("revenue", {}).keys() if y.isdigit()])
        base_year = hist_years[-1] if hist_years else "2025"
        
        if hist_years:
            total_debt = hist_financials.get("long_term_debt", {}).get(base_year, total_debt)

        # 3. Base Run (Default conditions: 4.2% Risk-Free Rate, 5.5% Cost of Debt, $75 Oil)
        base_rf = 0.042
        base_cod = 0.055
        base_wacc = calculate_wacc(
            market_cap=market_cap,
            total_debt=total_debt,
            beta=beta,
            risk_free_rate=base_rf,
            cost_of_debt=base_cod
        )
        
        base_assumptions = generate_automatic_assumptions(hist_financials)["assumptions"]
        base_assumptions["wacc"] = base_wacc
        base_assumptions["shares_outstanding"] = shares
        base_assumptions["terminal_growth"] = 0.025
        
        base_results = run_three_statement_model(hist_financials, base_assumptions)
        base_intrinsic_value = base_results["intrinsic_value"]

        # 4. Shock Run (Simulated macro changes)
        shock_rf = base_rf + (req.interest_rate_delta_pct / 100.0)
        shock_cod = base_cod + (req.interest_rate_delta_pct / 100.0)
        
        simulated_wacc = calculate_wacc(
            market_cap=market_cap,
            total_debt=total_debt,
            beta=beta,
            risk_free_rate=shock_rf,
            cost_of_debt=shock_cod
        )

        # Oil Margin impact calculations
        oil_delta = req.oil_price_usd - 75.0
        
        # Sector adjustments
        ebit_margin_adjustment = 0.0
        sec_lower = sector.lower()
        
        if "energy" in sec_lower or "oil" in sec_lower or "gas" in sec_lower:
            # Energy sector benefits from rising oil prices
            ebit_margin_adjustment = oil_delta * 0.0015
        elif any(kw in sec_lower for kw in ["transport", "industrial", "consumer", "retail", "materials", "semiconductor", "automotive"]):
            # Transport / manufacturing suffer from high energy/fuel costs
            ebit_margin_adjustment = -oil_delta * 0.0010
            
        shock_assumptions = generate_automatic_assumptions(hist_financials)["assumptions"]
        # Apply ebit margin adjustment
        shock_assumptions["ebit_margin"] = max(0.02, min(0.60, shock_assumptions["ebit_margin"] + ebit_margin_adjustment))
        shock_assumptions["wacc"] = simulated_wacc
        shock_assumptions["shares_outstanding"] = shares
        shock_assumptions["terminal_growth"] = 0.025

        shock_results = run_three_statement_model(hist_financials, shock_assumptions)
        simulated_intrinsic_value = shock_results["intrinsic_value"]

        # 5. Vulnerability assessment
        vulnerability = "MEDIUM"
        v_score = abs(req.interest_rate_delta_pct) * 15 + abs(oil_delta) * 0.4
        if v_score > 40:
            vulnerability = "HIGH"
        elif v_score < 15:
            vulnerability = "LOW"

        return {
            "ticker": ticker_clean,
            "currency": price_data.get("currency", "USD"),
            "current_price": current_price,
            "base_scenario": {
                "wacc_pct": round(base_wacc * 100, 2),
                "intrinsic_value": round(base_intrinsic_value, 2),
                "ebit_margin_pct": round(base_assumptions["ebit_margin"] * 100, 2)
            },
            "simulated_scenario": {
                "wacc_pct": round(simulated_wacc * 100, 2),
                "intrinsic_value": round(simulated_intrinsic_value, 2),
                "ebit_margin_pct": round(shock_assumptions["ebit_margin"] * 100, 2)
            },
            "impact": {
                "wacc_change_pct": round((simulated_wacc - base_wacc) * 100, 2),
                "intrinsic_value_change_pct": round(((simulated_intrinsic_value - base_intrinsic_value) / max(1.0, base_intrinsic_value)) * 100, 2)
            },
            "vulnerability_risk": vulnerability,
            "sector": sector
        }
    except Exception as e:
        logger.error(f"Macro simulation failed for {ticker_clean}: {e}")
        raise HTTPException(status_code=500, detail=f"Simulation failed: {str(e)}")
