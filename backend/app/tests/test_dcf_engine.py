import pytest
from app.engines.valuation.dcf_engine import run_dcf_model, run_multi_scenario_dcf

def test_dcf_model_success():
    output = run_dcf_model(
        fcf_base=100.0,
        growth_rate=0.05,
        wacc=0.09,
        terminal_growth=0.02,
        years=5,
        net_debt=200.0,
        shares_outstanding=50.0
    )
    assert "fair_value" in output
    assert output["fair_value"] > 0
    assert len(output["projected_fcfs"]) == 5
    assert len(output["discounted_fcfs"]) == 5

def test_dcf_model_invalid_wacc():
    with pytest.raises(ValueError):
        run_dcf_model(
            fcf_base=100.0,
            growth_rate=0.05,
            wacc=0.02,
            terminal_growth=0.03,
            years=5,
            net_debt=200.0,
            shares_outstanding=50.0
        )

def test_multi_scenario_dcf():
    output = run_multi_scenario_dcf(
        fcf_base=100.0,
        base_growth=0.05,
        wacc=0.09,
        terminal_growth=0.02,
        years=5,
        net_debt=200.0,
        shares_outstanding=50.0
    )
    assert "scenarios" in output
    assert "blended_fair_value" in output
    assert "bear" in output["scenarios"]
    assert "base" in output["scenarios"]
    assert "bull" in output["scenarios"]
    assert output["scenarios"]["base"]["fair_value"] > 0
