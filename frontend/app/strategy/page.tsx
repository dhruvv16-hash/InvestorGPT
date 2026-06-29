"use client";

import { useState } from "react";
import { Compass, Sparkles, Loader2, Play, Check, Percent, BarChart3, AlertCircle } from "lucide-react";
import { useRouter } from "next/navigation";

export default function StrategyBuilderPage() {
  const router = useRouter();
  const [selectedStyles, setSelectedStyles] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [strategyData, setStrategyData] = useState<any>(null);
  const [error, setError] = useState("");

  const stylesList = [
    { id: "DIVIDEND", label: "Dividend Focus", desc: "Select companies with strong histories of capital distribution." },
    { id: "VALUE", label: "Value / Safety Margin", desc: "Require a positive gap between DCF fair value and market price." },
    { id: "LARGE_CAP", label: "Large Cap Fortress", desc: "Target top-tier market cap industry leaders." },
    { id: "GROWTH", label: "Growth Compounding", desc: "Filter for high-revenue growth and technology-exposed sectors." },
    { id: "SOLVENT", label: "Solvency & Quality", desc: "Only include companies with strong Altman Z-Scores & F-Scores." }
  ];

  const handleToggleStyle = (styleId: string) => {
    setSelectedStyles(prev => 
      prev.includes(styleId) 
        ? prev.filter(s => s !== styleId) 
        : [...prev, styleId]
    );
  };

  const handleRunStrategy = async () => {
    if (selectedStyles.length === 0) {
      setError("Please select at least one strategy style constraint.");
      return;
    }

    setLoading(true);
    setError("");
    setStrategyData(null);

    try {
      const res = await fetch("https://backend-gamma-mocha-34.vercel.app/api/v1/strategy/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ styles: selectedStyles })
      });

      if (!res.ok) {
        throw new Error("Failed to generate investment strategy.");
      }

      const json = await res.json();
      setStrategyData(json);
    } catch (err: any) {
      setError(err.message || "An error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex-1 flex flex-col p-4 md:p-8 max-w-7xl mx-auto w-full gap-8 relative min-h-screen">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] bg-primary/10 rounded-full blur-[100px] -z-10 pointer-events-none" />

      {/* Header */}
      <div className="space-y-2 border-b border-white/5 pb-6">
        <div className="flex items-center gap-2">
          <Compass className="w-6 h-6 text-accent" />
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-foreground font-mono">
            Strategy Builder Lab
          </h1>
        </div>
        <p className="text-xs text-neutral/70 font-medium">
          Mix and match strategic allocation parameters to build custom investment mandates backed by committee consensus criteria.
        </p>
      </div>

      {error && (
        <div className="glass-panel p-4 rounded-xl border border-bearish/20 bg-bearish/5 text-bearish text-xs flex items-center gap-2">
          <AlertCircle className="w-4.5 h-4.5" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Input Panel */}
        <div className="lg:col-span-1 glass-card p-6 space-y-6">
          <div className="space-y-1">
            <h3 className="text-xs font-bold text-neutral uppercase tracking-wider">Strategy Criteria</h3>
            <p className="text-[10px] text-neutral/60 font-semibold">Select rule constraints to build your customized portfolio</p>
          </div>

          <div className="flex flex-col gap-3">
            {stylesList.map((style) => {
              const isSelected = selectedStyles.includes(style.id);
              return (
                <button
                  key={style.id}
                  type="button"
                  onClick={() => handleToggleStyle(style.id)}
                  className={`p-4 rounded-xl text-left border transition-all cursor-pointer flex justify-between items-start gap-4 ${
                    isSelected 
                      ? "border-accent/40 bg-accent/[0.03] text-foreground" 
                      : "border-white/5 bg-black/20 text-neutral/80 hover:border-white/15"
                  }`}
                >
                  <div className="space-y-1">
                    <span className="text-xs font-bold block">{style.label}</span>
                    <span className="text-[9px] text-neutral/60 leading-normal block">{style.desc}</span>
                  </div>
                  <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 mt-0.5 ${
                    isSelected ? "bg-accent border-accent text-white" : "border-white/20"
                  }`}>
                    {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>
                </button>
              );
            })}
          </div>

          <button
            onClick={handleRunStrategy}
            disabled={loading || selectedStyles.length === 0}
            className="w-full py-3 bg-gradient-to-r from-accent to-primary hover:opacity-90 disabled:opacity-50 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Simulating Strategy...</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-white" />
                <span>Generate Strategy Portfolio</span>
              </>
            )}
          </button>
        </div>

        {/* Right Column: Results Panel */}
        <div className="lg:col-span-2 space-y-6">
          {loading ? (
            <div className="glass-card p-16 flex flex-col items-center justify-center gap-4 text-center h-full">
              <Loader2 className="w-8 h-8 animate-spin text-accent" />
              <p className="text-xs font-bold text-neutral">Filtering companies & evaluating portfolio allocation math...</p>
            </div>
          ) : strategyData ? (
            <div className="space-y-6 animate-fade-in">
              {/* Stats & Allocation */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Stats Card */}
                <div className="glass-card p-5 space-y-4">
                  <h3 className="text-xs font-bold text-neutral uppercase tracking-wider">Strategy Stats</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-black/35 p-3 rounded-xl">
                      <span className="text-[9px] text-neutral block mb-0.5">Expected Return (CAGR)</span>
                      <span className="text-lg font-mono font-bold text-emerald-400">+{strategyData.portfolio_stats.expected_cagr_pct}%</span>
                    </div>
                    <div className="bg-black/35 p-3 rounded-xl">
                      <span className="text-[9px] text-neutral block mb-0.5">Avg DCF Upside</span>
                      <span className="text-lg font-mono font-bold text-accent">+{strategyData.portfolio_stats.average_upside_pct}%</span>
                    </div>
                    <div className="bg-black/35 p-3 rounded-xl">
                      <span className="text-[9px] text-neutral block mb-0.5">Sharpe Ratio</span>
                      <span className="text-lg font-mono font-bold text-foreground">{strategyData.portfolio_stats.estimated_sharpe_ratio}</span>
                    </div>
                    <div className="bg-black/35 p-3 rounded-xl">
                      <span className="text-[9px] text-neutral block mb-0.5">Diversification</span>
                      <span className="text-xs font-bold text-foreground flex items-center gap-1 mt-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-400" />
                        {strategyData.portfolio_stats.diversification_rating}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Allocation weights */}
                <div className="glass-card p-5 space-y-4">
                  <h3 className="text-xs font-bold text-neutral uppercase tracking-wider">Recommended Weights</h3>
                  <div className="space-y-3">
                    {Object.entries(strategyData.allocation_weights).map(([ticker, weight]: any) => (
                      <div key={ticker} className="space-y-1 text-xs">
                        <div className="flex justify-between font-mono">
                          <span className="font-bold text-accent">{ticker}</span>
                          <span className="text-foreground">{(weight * 100).toFixed(1)}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-black/40 rounded-full overflow-hidden">
                          <div className="h-full bg-accent" style={{ width: `${weight * 100}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Match Table */}
              <div className="glass-card p-6 space-y-4">
                <h3 className="text-xs font-bold text-neutral uppercase tracking-wider">Matching Portfolio Stocks</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="border-b border-white/10 text-neutral font-semibold">
                        <th className="py-2">Company</th>
                        <th className="py-2">Sector</th>
                        <th className="py-2 text-right">Price</th>
                        <th className="py-2 text-right">DCF Upside</th>
                        <th className="py-2 text-right">F-Score</th>
                        <th className="py-2 text-center">Rec</th>
                      </tr>
                    </thead>
                    <tbody>
                      {strategyData.matching_stocks.map((stock: any) => (
                        <tr
                          key={stock.ticker}
                          onClick={() => router.push(`/company/${stock.ticker}`)}
                          className="border-b border-white/5 hover:bg-white/[0.02] cursor-pointer transition-colors"
                        >
                          <td className="py-3">
                            <div className="flex flex-col gap-0.5">
                              <span className="font-bold text-foreground font-mono">{stock.ticker}</span>
                              <span className="text-[10px] text-neutral/70 truncate max-w-[150px]">{stock.name}</span>
                            </div>
                          </td>
                          <td className="py-3 text-neutral/80">{stock.sector}</td>
                          <td className="py-3 text-right font-mono">${stock.current_price.toFixed(2)}</td>
                          <td className={`py-3 text-right font-mono font-bold ${stock.upside_pct >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                            {stock.upside_pct >= 0 ? "+" : ""}{stock.upside_pct.toFixed(1)}%
                          </td>
                          <td className="py-3 text-right font-mono font-bold text-foreground">{stock.f_score}/9</td>
                          <td className="py-3 text-center">
                            <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${
                              stock.recommendation === "BUY" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" :
                              stock.recommendation === "SELL" ? "bg-rose-500/10 text-rose-400 border border-rose-500/20" :
                              "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                            }`}>
                              {stock.recommendation}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div className="glass-card p-12 text-center text-neutral space-y-4 h-full flex flex-col justify-center items-center">
              <Compass className="w-12 h-12 text-neutral/20" />
              <div className="space-y-1">
                <p className="text-xs font-bold font-sans">No strategy simulated yet.</p>
                <p className="text-[10px] text-neutral/50 max-w-sm">Select rules from the left panel and click 'Generate Strategy' to view simulated assets and allocations.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
