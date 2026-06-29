import math
import pandas as pd
import pytest
from app.engines import calculation_engine

def test_current_ratio():
    assert calculation_engine.current_ratio(10, 5) == 2.0
    with pytest.raises(ValueError):
        calculation_engine.current_ratio(10, 0)

def test_quick_ratio():
    assert calculation_engine.quick_ratio(10, 2, 4) == 2.0
    with pytest.raises(ValueError):
        calculation_engine.quick_ratio(10, 2, 0)

def test_roe():
    assert calculation_engine.roe(100, 500) == 0.2
    assert math.isnan(calculation_engine.roe(100, 0))
    assert math.isnan(calculation_engine.roe(100, -10))

def test_roa():
    assert calculation_engine.roa(50, 500) == 0.1
    assert math.isnan(calculation_engine.roa(50, 0))

def test_cagr():
    assert math.isclose(calculation_engine.cagr(100, 200, 5), 0.148698, rel_tol=1e-5)
    assert math.isnan(calculation_engine.cagr(100, 200, 0))
    assert math.isnan(calculation_engine.cagr(0, 200, 5))

def test_altman_z_score():
    score = calculation_engine.altman_z_score(
        working_capital=1000,
        retained_earnings=2000,
        ebit=500,
        market_value_equity=10000,
        total_assets=5000,
        total_liabilities=3000,
        revenue=6000
    )
    # Z = 1.2*A + 1.4*B + 3.3*C + 0.6*D + 1.0*E
    # A = 1000/5000 = 0.2 -> 1.2 * 0.2 = 0.24
    # B = 2000/5000 = 0.4 -> 1.4 * 0.4 = 0.56
    # C = 500/5000 = 0.1 -> 3.3 * 0.1 = 0.33
    # D = 10000/3000 = 3.3333 -> 0.6 * 3.3333 = 2.0
    # E = 6000/5000 = 1.2 -> 1.0 * 1.2 = 1.2
    # Sum = 0.24 + 0.56 + 0.33 + 2.0 + 1.2 = 4.33
    assert math.isclose(score, 4.33, rel_tol=1e-3)

def test_piotroski_f_score():
    score = calculation_engine.piotroski_f_score(
        net_income_curr=100,
        net_income_prev=50,
        operating_cash_flow=150,
        roa_curr=0.1,
        roa_prev=0.05,
        long_term_debt_curr=100,
        long_term_debt_prev=150,
        total_assets_curr=1000,
        total_assets_prev=1000,
        current_ratio_curr=2.0,
        current_ratio_prev=1.5,
        shares_curr=100,
        shares_prev=100,
        gross_margin_curr=0.4,
        gross_margin_prev=0.3,
        asset_turnover_curr=1.0,
        asset_turnover_prev=0.9
    )
    # All 9 criteria should pass:
    # 1. Net income > 0 (yes) -> +1
    # 2. Operating cash flow > 0 (yes) -> +1
    # 3. ROA_curr > ROA_prev (0.1 > 0.05) -> +1
    # 4. Operating cash flow > Net income (150 > 100) -> +1
    # 5. Debt/assets_curr < Debt/assets_prev (100/1000 < 150/1000) -> +1
    # 6. Current ratio_curr > Current ratio_prev (2.0 > 1.5) -> +1
    # 7. Shares_curr <= Shares_prev (100 <= 100) -> +1
    # 8. Gross margin_curr > Gross margin_prev (0.4 > 0.3) -> +1
    # 9. Asset turnover_curr > Asset turnover_prev (1.0 > 0.9) -> +1
    assert score == 9

def test_technical_rsi():
    prices = pd.Series([10, 11, 12, 11, 10, 11, 12, 13, 14, 13, 12, 13, 14, 15, 16])
    rsi_series = calculation_engine.rsi(prices, period=5)
    assert not rsi_series.empty
    assert 0 <= rsi_series.iloc[-1] <= 100
