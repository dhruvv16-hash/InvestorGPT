def run_dcf_model(
    fcf_base: float,
    growth_rate: float,
    wacc: float,
    terminal_growth: float,
    years: int,
    net_debt: float,
    shares_outstanding: float
) -> dict:
    """Calculates intrinsic value per share using Discounted Cash Flow model.
    WACC must be greater than terminal growth rate.
    """
    if wacc <= terminal_growth:
        raise ValueError("WACC must be greater than terminal growth rate")
    if shares_outstanding <= 0:
        raise ValueError("shares_outstanding must be greater than zero")

    projected_fcfs = []
    current_fcf = fcf_base
    for _ in range(years):
        current_fcf = current_fcf * (1 + growth_rate)
        projected_fcfs.append(current_fcf)

    discounted_fcfs = [fcf / ((1 + wacc) ** (t + 1)) for t, fcf in enumerate(projected_fcfs)]

    # Terminal Value TV
    terminal_value = (projected_fcfs[-1] * (1 + terminal_growth)) / (wacc - terminal_growth)
    discounted_tv = terminal_value / ((1 + wacc) ** years)

    enterprise_value = sum(discounted_fcfs) + discounted_tv
    equity_value = enterprise_value - net_debt
    fair_value = equity_value / shares_outstanding

    return {
        "fair_value": max(0.0, fair_value),
        "enterprise_value": enterprise_value,
        "equity_value": equity_value,
        "projected_fcfs": projected_fcfs,
        "discounted_fcfs": discounted_fcfs,
        "terminal_value": terminal_value,
        "discounted_tv": discounted_tv,
        "assumptions": {
            "fcf_base": fcf_base,
            "growth_rate": growth_rate,
            "wacc": wacc,
            "terminal_growth": terminal_growth,
            "years": years,
            "net_debt": net_debt,
            "shares_outstanding": shares_outstanding
        }
    }

def run_multi_scenario_dcf(
    fcf_base: float,
    base_growth: float,
    wacc: float,
    terminal_growth: float,
    years: int,
    net_debt: float,
    shares_outstanding: float
) -> dict:
    """Generates three scenarios (Bear, Base, Bull) for DCF valuation."""
    scenarios = {
        "bear": {"growth": base_growth * 0.7, "wacc": wacc * 1.1},
        "base": {"growth": base_growth, "wacc": wacc},
        "bull": {"growth": base_growth * 1.3, "wacc": wacc * 0.9}
    }

    results = {}
    for name, params in scenarios.items():
        try:
            results[name] = run_dcf_model(
                fcf_base=fcf_base,
                growth_rate=params["growth"],
                wacc=params["wacc"],
                terminal_growth=terminal_growth,
                years=years,
                net_debt=net_debt,
                shares_outstanding=shares_outstanding
            )
        except Exception as e:
            results[name] = {"error": str(e), "fair_value": 0.0}

    # Blended valuation
    if "base" in results and "fair_value" in results["base"]:
        blended_value = (
            results["bear"]["fair_value"] * 0.2 +
            results["base"]["fair_value"] * 0.5 +
            results["bull"]["fair_value"] * 0.3
        )
    else:
        blended_value = 0.0

    return {
        "scenarios": results,
        "blended_fair_value": blended_value
    }

def calculate_dcf_sensitivity(
    fcf_base: float,
    growth_rate: float,
    wacc: float,
    terminal_growth: float,
    years: int,
    net_debt: float,
    shares_outstanding: float
) -> dict:
    """Generates a 2D sensitivity matrix of WACC vs Terminal Growth Rate."""
    # Adjust WACC by [-2%, -1%, 0%, +1%, +2%] and Terminal Growth by [-1%, -0.5%, 0%, +0.5%, +1%]
    wacc_adjustments = [-0.02, -0.01, 0.0, 0.01, 0.02]
    growth_adjustments = [-0.01, -0.005, 0.0, 0.005, 0.01]
    
    wacc_vals = [wacc + adj for adj in wacc_adjustments]
    growth_vals = [terminal_growth + adj for adj in growth_adjustments]
    
    matrix = []
    for w in wacc_vals:
        row = []
        for g in growth_vals:
            if w <= g or w <= 0 or g <= 0:
                row.append(None)
            else:
                try:
                    res = run_dcf_model(
                        fcf_base=fcf_base,
                        growth_rate=growth_rate,
                        wacc=w,
                        terminal_growth=g,
                        years=years,
                        net_debt=net_debt,
                        shares_outstanding=shares_outstanding
                    )
                    row.append(res["fair_value"])
                except Exception:
                    row.append(None)
        matrix.append(row)
        
    return {
        "wacc_labels": [f"{w*100:.1f}%" for w in wacc_vals],
        "growth_labels": [f"{g*100:.1f}%" for g in growth_vals],
        "matrix": matrix
    }

