"use client";

import { Award, ShieldAlert, BarChart3, HelpCircle, Activity, Sparkles } from "lucide-react";

export default function AcademyPage() {
  const calculations = [
    {
      title: "Piotroski F-Score",
      icon: <Award className="w-6 h-6 text-accent" />,
      subtitle: "Fundamental Stability & Operational Efficiency Score",
      formula: "F_Score = \\sum_{i=1}^{9} Criterion_i",
      description: "An integer score between 0 and 9 used to determine the strength of a firm's financial position based on 9 criteria across profitability, leverage/liquidity, and operating efficiency.",
      details: [
        { name: "Profitability (4 pts)", desc: "Positive Net Income (1), Positive Operating Cash Flow (1), Higher ROA vs prior year (1), Cash Flow > Net Income (1)." },
        { name: "Leverage & Funding (3 pts)", desc: "Lower Long-term Debt Ratio vs prior year (1), Higher Current Ratio vs prior year (1), No new share dilution (1)." },
        { name: "Operating Efficiency (2 pts)", desc: "Higher Gross Margin vs prior year (1), Higher Asset Turnover vs prior year (1)." }
      ]
    },
    {
      title: "Altman Z-Score",
      icon: <ShieldAlert className="w-6 h-6 text-primary" />,
      subtitle: "Corporate Bankruptcy Prediction Model",
      formula: "Z = 1.2 X_1 + 1.4 X_2 + 3.3 X_3 + 0.6 X_4 + 0.999 X_5",
      description: "A mathematical solvency index predicting the probability that a manufacturing company will enter bankruptcy within two years.",
      details: [
        { name: "X1: Working Capital / Total Assets", desc: "Measures net liquid assets relative to size." },
        { name: "X2: Retained Earnings / Total Assets", desc: "Measures cumulative profitability over time." },
        { name: "X3: EBIT / Total Assets", desc: "Measures productivity of assets before tax/interest." },
        { name: "X4: Market Value of Equity / Total Liabilities", desc: "Measures how much equity can drop before leverage exceeds assets." },
        { name: "X5: Revenue / Total Assets", desc: "Asset turnover ratio; efficiency of generating sales." },
        { name: "Boundaries", desc: "Safe Zone: Z > 2.99; Grey Zone: 1.81 <= Z <= 2.99; Distress Zone: Z < 1.81." }
      ]
    },
    {
      title: "Discounted Cash Flow (DCF)",
      icon: <BarChart3 className="w-6 h-6 text-blue-500" />,
      subtitle: "Intrinsic Valuation Model",
      formula: "Value = \\sum_{t=1}^{n} \\frac{FCF_t}{(1+WACC)^t} + \\frac{Terminal\\_Value}{(1+WACC)^n}",
      description: "Estimates the value of an investment based on its expected future cash flows discounted back to their present value using the Weighted Average Cost of Capital (WACC).",
      details: [
        { name: "Free Cash Flow (FCF)", desc: "Calculated as Operating Cash Flow minus Capital Expenditures (CapEx)." },
        { name: "WACC (Discount Rate)", desc: "Weighted average cost of equity and debt, representing the required rate of return." },
        { name: "Terminal Value (TV)", desc: "Estimated value of all future cash flows beyond the projection period, using perpetual growth formula: TV = [FCF_n * (1 + g)] / (WACC - g), where g is terminal growth rate." }
      ]
    },
    {
      title: "Sharpe Ratio & Efficient Frontier",
      icon: <Activity className="w-6 h-6 text-purple-500" />,
      subtitle: "Modern Portfolio Theory (MPT) Risk-Adjusted Return Metrics",
      formula: "Sharpe\\_Ratio = \\frac{R_p - R_f}{\\sigma_p}",
      description: "Measures the performance of an investment or portfolio compared to a risk-free asset, adjusted for its volatility (total risk).",
      details: [
        { name: "Rp: Portfolio Return", desc: "Annualized expected return of the combined assets." },
        { name: "Rf: Risk-Free Rate", desc: "The yield of a riskless investment, typically US treasury bonds (e.g. 2%)." },
        { name: "σp: Portfolio Standard Deviation", desc: "Annualized volatility of portfolio returns, incorporating asset correlations." },
        { name: "Efficient Frontier", desc: "The set of optimal portfolios that offer the highest expected return for a defined level of risk." }
      ]
    }
  ];

  return (
    <main className="flex-1 flex flex-col p-4 md:p-8 max-w-7xl mx-auto w-full gap-8 relative min-h-screen">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] bg-primary/10 rounded-full blur-[100px] -z-10 pointer-events-none" />

      {/* Header */}
      <div className="space-y-2 border-b border-white/5 pb-6">
        <div className="flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-accent" />
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-foreground font-mono">
            Research Notebook & Academy
          </h1>
        </div>
        <p className="text-xs text-neutral/70 font-medium">
          Understand the mathematical logic, financial formulas, and evaluation methodologies powering InvestorGPT.
        </p>
      </div>

      {/* Formulas Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {calculations.map((calc, idx) => (
          <div key={idx} className="glass-card p-6 space-y-6 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-black/40 border border-white/5 rounded-xl">
                  {calc.icon}
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-foreground">{calc.title}</h3>
                  <p className="text-[10px] text-neutral/60 font-semibold mt-0.5">{calc.subtitle}</p>
                </div>
              </div>

              <p className="text-xs text-neutral/80 leading-relaxed">{calc.description}</p>

              {/* Formula box */}
              <div className="bg-black/40 border border-white/5 rounded-xl p-4 text-center">
                <p className="text-xs font-mono font-bold text-accent">
                  {calc.formula}
                </p>
              </div>

              {/* Details list */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-foreground">Parameter & Calculation Breakdown</h4>
                <div className="space-y-2 text-[10px] leading-relaxed">
                  {calc.details.map((det, dIdx) => (
                    <div key={dIdx} className="bg-white/[0.01] border border-white/5 p-2.5 rounded-lg">
                      <span className="font-bold text-neutral block mb-0.5">{det.name}</span>
                      <span className="text-neutral/75">{det.desc}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
