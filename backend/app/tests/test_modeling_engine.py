import math
from app.engines.valuation.modeling_engine import (
    calculate_wacc,
    run_three_statement_model,
    run_reverse_dcf,
    generate_monte_carlo,
    run_consensus_intrinsic_value
)

def test_wacc_calculator():
    wacc = calculate_wacc(market_cap=1e10, total_debt=2e9, beta=1.2)
    assert wacc > 0.05
    assert wacc < 0.20

def test_three_statement_model_balancing():
    # Setup dummy historical statements
    dummy_hist = {
        "revenue": {"2022": 1e9, "2023": 1.1e9, "2024": 1.2e9, "2025": 1.3e9},
        "cogs": {"2022": 6e8, "2023": 6.5e8, "2024": 7e8, "2025": 7.5e8},
        "net_income": {"2022": 1e8, "2023": 1.2e8, "2024": 1.4e8, "2025": 1.6e8},
        "operating_income": {"2022": 1.5e8, "2023": 1.8e8, "2024": 2.1e8, "2025": 2.4e8},
        "ebit": {"2022": 1.5e8, "2023": 1.8e8, "2024": 2.1e8, "2025": 2.4e8},
        "ebitda": {"2022": 1.8e8, "2023": 2.1e8, "2024": 2.5e8, "2025": 2.9e8},
        "current_assets": {"2022": 4e8, "2023": 4.5e8, "2024": 5e8, "2025": 5.5e8},
        "current_liabilities": {"2022": 2e8, "2023": 2.2e8, "2024": 2.4e8, "2025": 2.6e8},
        "inventory": {"2022": 5e7, "2023": 5.5e7, "2024": 6e7, "2025": 6.5e7},
        "total_assets": {"2022": 1e9, "2023": 1.1e9, "2024": 1.2e9, "2025": 1.3e9},
        "total_liabilities": {"2022": 5e8, "2023": 5.2e8, "2024": 5.4e8, "2025": 5.6e8},
        "shareholder_equity": {"2022": 5e8, "2023": 5.8e8, "2024": 6.6e8, "2025": 7.4e8},
        "long_term_debt": {"2022": 2e8, "2023": 2e8, "2024": 2e8, "2025": 2e8},
        "interest_expense": {"2022": 1e7, "2023": 1e7, "2024": 1e7, "2025": 1e7},
        "operating_cash_flow": {"2022": 1.2e8, "2023": 1.4e8, "2024": 1.6e8, "2025": 1.8e8},
        "capital_expenditures": {"2022": -5e7, "2023": -5.5e7, "2024": -6e7, "2025": -6.5e7},
        "retained_earnings": {"2022": 3e8, "2023": 4e8, "2024": 5e8, "2025": 6e8},
        "diluted_eps": {"2022": 1.0, "2023": 1.2, "2024": 1.4, "2025": 1.6},
        "cash": {"2022": 1.5e8, "2023": 1.8e8, "2024": 2.1e8, "2025": 2.4e8}
    }
    
    overrides = {
        "revenue_growth": 0.10,
        "ebit_margin": 0.18,
        "gross_margin": 0.42,
        "tax_rate": 0.21,
        "wacc": 0.085,
        "terminal_growth": 0.02
    }
    
    results = run_three_statement_model(dummy_hist, overrides)
    assert "model" in results
    assert len(results["proj_years"]) == 10
    
    # Verify balance sheet balances (Assets == Liabilities + Equity) for all years
    for y in results["proj_years"]:
        step = results["model"][y]
        assets = step["total_assets"]
        liab_eq = step["total_liabilities_equity"]
        # Allow small floating point tolerance
        assert abs(assets - liab_eq) < 1.0

def test_reverse_dcf_convergence():
    growth = run_reverse_dcf(
        current_price=100.0,
        fcf_base=1e7,
        wacc=0.09,
        terminal_growth=0.025,
        years=10,
        net_debt=2e7,
        shares_outstanding=1e6
    )
    assert -0.50 <= growth <= 1.0

def test_monte_carlo_distribution():
    res = generate_monte_carlo(
        fcf_base=1e7,
        base_growth=0.08,
        wacc=0.09,
        terminal_growth=0.025,
        years=10,
        net_debt=2e7,
        shares_outstanding=1e6,
        simulations=500
    )
    assert "p50" in res
    assert len(res["buckets"]) > 0

def test_automatic_assumptions():
    from app.engines.valuation.modeling_engine import generate_automatic_assumptions
    dummy_hist = {
        "revenue": {"2022": 1e9, "2023": 1.1e9, "2024": 1.2e9, "2025": 1.3e9},
        "cogs": {"2022": 6e8, "2023": 6.5e8, "2024": 7e8, "2025": 7.5e8},
        "net_income": {"2022": 1e8, "2023": 1.2e8, "2024": 1.4e8, "2025": 1.6e8},
        "ebit": {"2022": 1.5e8, "2023": 1.8e8, "2024": 2.1e8, "2025": 2.4e8}
    }
    res = generate_automatic_assumptions(dummy_hist)
    assert "assumptions" in res
    assert "confidence" in res
    assert "explanations" in res
    assert res["assumptions"]["revenue_growth"] > 0

def test_historical_valuation():
    from app.engines.valuation.modeling_engine import calculate_historical_valuation
    dummy_hist = {
        "revenue": {"2022": 1e9, "2023": 1.1e9, "2024": 1.2e9, "2025": 1.3e9},
        "net_income": {"2022": 1e8, "2023": 1.2e8, "2024": 1.4e8, "2025": 1.6e8},
        "long_term_debt": {"2022": 2e8, "2023": 2e8, "2024": 2e8, "2025": 2e8},
        "cash": {"2022": 1e8, "2023": 1.5e8, "2024": 2e8, "2025": 2.5e8}
    }
    res = calculate_historical_valuation(dummy_hist, current_price=100.0, shares_outstanding=1e7)
    assert "averages" in res
    assert "comparison" in res

