import math
import numpy as np
import pandas as pd

def current_ratio(current_assets: float, current_liabilities: float) -> float:
    if current_liabilities == 0:
        raise ValueError("current_liabilities cannot be zero")
    return current_assets / current_liabilities

def quick_ratio(current_assets: float, inventory: float, current_liabilities: float) -> float:
    if current_liabilities == 0:
        raise ValueError("current_liabilities cannot be zero")
    return (current_assets - inventory) / current_liabilities

def roe(net_income: float, shareholder_equity: float) -> float:
    if shareholder_equity <= 0:
        return float("nan")
    return net_income / shareholder_equity

def roa(net_income: float, total_assets: float) -> float:
    if total_assets <= 0:
        return float("nan")
    return net_income / total_assets

def roic(nopat: float, invested_capital: float) -> float:
    if invested_capital <= 0:
        return float("nan")
    return nopat / invested_capital

def debt_to_equity(total_debt: float, shareholder_equity: float) -> float:
    if shareholder_equity <= 0:
        return float("nan")
    return total_debt / shareholder_equity

def interest_coverage(ebit: float, interest_expense: float) -> float:
    if interest_expense == 0:
        return float("inf") if ebit >= 0 else float("-inf")
    return ebit / interest_expense

def gross_margin(revenue: float, cogs: float) -> float:
    if revenue <= 0:
        return float("nan")
    return (revenue - cogs) / revenue

def operating_margin(operating_income: float, revenue: float) -> float:
    if revenue <= 0:
        return float("nan")
    return operating_income / revenue

def net_margin(net_income: float, revenue: float) -> float:
    if revenue <= 0:
        return float("nan")
    return net_income / revenue

def pe_ratio(price: float, eps: float) -> float:
    if eps <= 0:
        return float("nan")
    return price / eps

def peg_ratio(pe: float, eps_growth_rate_pct: float) -> float:
    if eps_growth_rate_pct <= 0:
        return float("nan")
    return pe / eps_growth_rate_pct

def asset_turnover(revenue: float, total_assets: float) -> float:
    if total_assets <= 0:
        return float("nan")
    return revenue / total_assets

def altman_z_score(
    working_capital: float,
    retained_earnings: float,
    ebit: float,
    market_value_equity: float,
    total_assets: float,
    total_liabilities: float,
    revenue: float
) -> float:
    """Altman Z-Score manufacturing formula:
    Z = 1.2*A + 1.4*B + 3.3*C + 0.6*D + 1.0*E
    """
    if total_assets <= 0 or total_liabilities <= 0:
        return float("nan")
    a = working_capital / total_assets
    b = retained_earnings / total_assets
    c = ebit / total_assets
    d = market_value_equity / total_liabilities
    e = revenue / total_assets
    return 1.2 * a + 1.4 * b + 3.3 * c + 0.6 * d + 1.0 * e

def piotroski_f_score(
    net_income_curr: float,
    net_income_prev: float,
    operating_cash_flow: float,
    roa_curr: float,
    roa_prev: float,
    long_term_debt_curr: float,
    long_term_debt_prev: float,
    total_assets_curr: float,
    total_assets_prev: float,
    current_ratio_curr: float,
    current_ratio_prev: float,
    shares_curr: float,
    shares_prev: float,
    gross_margin_curr: float,
    gross_margin_prev: float,
    asset_turnover_curr: float,
    asset_turnover_prev: float
) -> int:
    score = 0
    # Profitability criteria
    if net_income_curr > 0: score += 1
    if operating_cash_flow > 0: score += 1
    if not math.isnan(roa_curr) and not math.isnan(roa_prev) and roa_curr > roa_prev: score += 1
    if operating_cash_flow > net_income_curr: score += 1

    # Leverage, Liquidity, and Source of Funds criteria
    debt_ratio_curr = long_term_debt_curr / total_assets_curr if total_assets_curr > 0 else 0
    debt_ratio_prev = long_term_debt_prev / total_assets_prev if total_assets_prev > 0 else 0
    if debt_ratio_curr < debt_ratio_prev: score += 1
    if current_ratio_curr > current_ratio_prev: score += 1
    if shares_curr <= shares_prev: score += 1

    # Operating Efficiency criteria
    if gross_margin_curr > gross_margin_prev: score += 1
    if asset_turnover_curr > asset_turnover_prev: score += 1

    return score

def cagr(begin_value: float, end_value: float, years: float) -> float:
    if begin_value <= 0 or end_value <= 0 or years <= 0:
        return float("nan")
    return (end_value / begin_value) ** (1 / years) - 1

def cost_of_equity(risk_free_rate: float, beta: float, market_risk_premium: float) -> float:
    return risk_free_rate + beta * market_risk_premium

def cost_of_debt(interest_expense: float, total_debt: float, tax_rate: float) -> float:
    if total_debt <= 0:
        return 0.0
    pre_tax_cost = interest_expense / total_debt
    return pre_tax_cost * (1 - tax_rate)

def wacc(
    market_value_equity: float,
    total_debt: float,
    cost_of_equity_val: float,
    cost_of_debt_val: float,
    tax_rate: float
) -> float:
    total_capital = market_value_equity + total_debt
    if total_capital <= 0:
        return 0.0
    equity_weight = market_value_equity / total_capital
    debt_weight = total_debt / total_capital
    return (equity_weight * cost_of_equity_val) + (debt_weight * cost_of_debt_val)

# Technical Indicators
def sma(prices: pd.Series, period: int = 20) -> pd.Series:
    return prices.rolling(window=period).mean()

def ema(prices: pd.Series, period: int = 20) -> pd.Series:
    return prices.ewm(span=period, adjust=False).mean()

def rsi(prices: pd.Series, period: int = 14) -> pd.Series:
    delta = prices.diff()
    gain = (delta.where(delta > 0, 0)).rolling(window=period).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=period).mean()
    rs = gain / loss
    rs = rs.fillna(0)
    return 100 - (100 / (1 + rs))

def macd(prices: pd.Series, fast_period: int = 12, slow_period: int = 26, signal_period: int = 9) -> tuple[pd.Series, pd.Series, pd.Series]:
    fast_ema = ema(prices, fast_period)
    slow_ema = ema(prices, slow_period)
    macd_line = fast_ema - slow_ema
    signal_line = ema(macd_line, signal_period)
    hist = macd_line - signal_line
    return macd_line, signal_line, hist

def atr(high: pd.Series, low: pd.Series, close: pd.Series, period: int = 14) -> pd.Series:
    prev_close = close.shift(1)
    tr1 = high - low
    tr2 = (high - prev_close).abs()
    tr3 = (low - prev_close).abs()
    tr = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
    return tr.rolling(window=period).mean()

def bollinger_bands(prices: pd.Series, period: int = 20, num_std: float = 2.0) -> tuple[pd.Series, pd.Series, pd.Series]:
    middle = sma(prices, period)
    std = prices.rolling(window=period).std()
    upper = middle + (num_std * std)
    lower = middle - (num_std * std)
    return upper, middle, lower

def obv(prices: pd.Series, volume: pd.Series) -> pd.Series:
    obv_series = [0]
    for i in range(1, len(prices)):
        if prices.iloc[i] > prices.iloc[i-1]:
            obv_series.append(obv_series[-1] + volume.iloc[i])
        elif prices.iloc[i] < prices.iloc[i-1]:
            obv_series.append(obv_series[-1] - volume.iloc[i])
        else:
            obv_series.append(obv_series[-1])
    return pd.Series(obv_series, index=prices.index)
