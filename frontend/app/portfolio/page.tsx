"use client";

import { useEffect, useState } from "react";
import { 
  Briefcase, Save, Plus, Trash2, Loader2, RefreshCw, 
  TrendingUp, TrendingDown, ArrowRight, Activity, Percent
} from "lucide-react";
import { StockSearchInput } from "@/components/inputs/StockSearchInput";

export default function PortfolioPage() {
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  
  const [holdings, setHoldings] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>({
    total_cost: 0,
    total_value: 0,
    total_pnl: 0,
    total_pnl_pct: 0
  });

  const [preferredCurrency, setPreferredCurrency] = useState("USD");
  const [currencySymbol, setCurrencySymbol] = useState("$");

  // Form State
  const [showAddModal, setShowAddModal] = useState(false);
  const [ticker, setTicker] = useState("");
  const [shares, setShares] = useState("");
  const [price, setPrice] = useState("");
  const [formLoading, setFormLoading] = useState(false);

  // Portfolio Optimization State
  const [optimizationData, setOptimizationData] = useState<any>(null);
  const [loadingOptimize, setLoadingOptimize] = useState(false);
  const [errorOptimize, setErrorOptimize] = useState("");
  const [showOptimizeTab, setShowOptimizeTab] = useState(false);

  const fetchOptimization = async () => {
    if (!userId) return;
    setLoadingOptimize(true);
    setErrorOptimize("");
    try {
      const res = await fetch(`https://backend-gamma-mocha-34.vercel.app/api/v1/portfolio/optimize?user_id=${userId}`);
      if (!res.ok) {
        throw new Error("Failed to compute efficient frontier. Ensure all tickers are valid.");
      }
      const json = await res.json();
      setOptimizationData(json);
    } catch (err: any) {
      setErrorOptimize(err.message || "Optimization failed.");
    } finally {
      setLoadingOptimize(false);
    }
  };


  // Initialize user_id
  useEffect(() => {
    let uId = localStorage.getItem("investorgpt_user_id");
    if (!uId) {
      uId = "usr_" + Math.random().toString(36).substring(2, 15);
      localStorage.setItem("investorgpt_user_id", uId);
    }
    setUserId(uId);
  }, []);

  const fetchPortfolio = async () => {
    if (!userId) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`https://backend-gamma-mocha-34.vercel.app/api/v1/portfolio?preferred_currency=${preferredCurrency}&user_id=${userId}`);
      if (!res.ok) {
        throw new Error("Failed to load portfolio holdings.");
      }
      const json = await res.json();
      setHoldings(json.holdings || []);
      setSummary(json.summary || { total_cost: 0, total_value: 0, total_pnl: 0, total_pnl_pct: 0 });
      setCurrencySymbol(json.currency_symbol || "$");
    } catch (err: any) {
      setError(err.message || "Failed to load holdings.");
    } finally {
      setLoading(false);
    }
  };

  const handleExport = (format: "pdf" | "excel") => {
    if (!userId) return;
    const token = localStorage.getItem("investorgpt_token") || "";
    window.open(`https://backend-gamma-mocha-34.vercel.app/api/v1/portfolio/export/${format}?preferred_currency=${preferredCurrency}&token=${token}`);
  };

  useEffect(() => {
    if (userId) {
      fetchPortfolio();
    }
  }, [userId, preferredCurrency]);

  useEffect(() => {
    if (showOptimizeTab && holdings.length >= 2) {
      fetchOptimization();
    }
  }, [showOptimizeTab, holdings.length]);


  const handleAddHolding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticker.trim() || !shares || !price || parseFloat(shares) <= 0 || parseFloat(price) <= 0) return;
    
    setFormLoading(true);
    try {
      const res = await fetch("https://backend-gamma-mocha-34.vercel.app/api/v1/portfolio/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          ticker: ticker.trim().toUpperCase(),
          shares: parseFloat(shares),
          price: parseFloat(price)
        })
      });
      if (res.ok) {
        setShowAddModal(false);
        setTicker("");
        setShares("");
        setPrice("");
        fetchPortfolio();
      }
    } catch (err) {
      console.error("Add holding failed:", err);
    } finally {
      setFormLoading(false);
    }
  };

  const handleRemoveHolding = async (holdingId: string) => {
    if (!confirm("Are you sure you want to remove this stock from your holdings?")) return;
    try {
      const res = await fetch(`https://backend-gamma-mocha-34.vercel.app/api/v1/portfolio/remove/${holdingId}`, {
        method: "DELETE"
      });
      if (res.ok) {
        fetchPortfolio();
      }
    } catch (err) {
      console.error("Remove failed:", err);
    }
  };

  // Render SVG Allocation ring chart
  const renderSVGAllocation = () => {
    if (holdings.length === 0) return null;
    
    let cumAngle = 0;
    const r = 50;
    const cx = 80;
    const cy = 80;
    const circumference = 2 * Math.PI * r;
    
    const sorted = [...holdings].sort((a, b) => b.value - a.value);
    
    // Vibrant colors matching visual guidelines
    const colors = ["#3b82f6", "#10b981", "#f59e0b", "#a855f7", "#ec4899", "#14b8a6", "#6366f1"];
    
    return (
      <div className="flex flex-col md:flex-row items-center gap-8 py-4">
        {/* SVG Circle */}
        <div className="relative w-40 h-40">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 160 160">
            {sorted.map((h: any, idx: number) => {
              const pct = h.weight_pct / 100.0;
              const strokeLength = circumference * pct;
              const strokeOffset = circumference - strokeLength + (circumference * (cumAngle / 360.0));
              cumAngle += h.weight_pct * 3.6; // update accumulated angle
              
              const color = colors[idx % colors.length];
              return (
                <circle
                  key={h.id}
                  cx={cx}
                  cy={cy}
                  r={r}
                  fill="transparent"
                  stroke={color}
                  strokeWidth="16"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeOffset}
                  className="transition-all duration-500 hover:stroke-[20px] cursor-pointer"
                />
              );
            })}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-[10px] text-neutral font-bold uppercase tracking-wider">Asset Class</span>
            <span className="text-xs font-mono font-bold text-foreground">Equities</span>
          </div>
        </div>

        {/* Legend */}
        <div className="flex-1 grid grid-cols-2 gap-3 text-[10px] font-bold font-mono">
          {sorted.map((h: any, idx: number) => {
            const color = colors[idx % colors.length];
            return (
              <div key={h.id} className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                <span className="text-neutral">{h.ticker}</span>
                <span className="text-foreground ml-auto">{h.weight_pct.toFixed(1)}%</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <main className="flex-1 flex flex-col p-4 md:p-8 max-w-7xl mx-auto w-full gap-8 relative min-h-screen">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] bg-primary/10 rounded-full blur-[100px] -z-10 pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-white/5 pb-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Briefcase className="w-6 h-6 text-accent" />
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-foreground font-mono">
              Portfolio Tracker Playground
            </h1>
          </div>
          <p className="text-xs text-neutral/70 font-medium">
            Monitor asset allocations, compute average buy entries, and inspect real-time profit/loss statistics.
          </p>
        </div>

        <div className="flex gap-2 flex-wrap items-center w-full md:w-auto">
          {/* Currency Switcher */}
          <div className="flex items-center gap-1.5 px-3 py-2 border border-white/5 bg-white/[0.01] rounded-xl text-neutral">
            <span className="text-[10px] font-bold uppercase tracking-wider text-neutral/40">Display:</span>
            <select
              value={preferredCurrency}
              onChange={(e) => setPreferredCurrency(e.target.value)}
              className="bg-transparent text-xs font-bold text-accent outline-none border-none cursor-pointer pr-1"
            >
              <option value="USD" className="bg-[#0b0c10] text-foreground">USD ($)</option>
              <option value="INR" className="bg-[#0b0c10] text-foreground">INR (₹)</option>
              <option value="EUR" className="bg-[#0b0c10] text-foreground">EUR (€)</option>
              <option value="GBP" className="bg-[#0b0c10] text-foreground">GBP (£)</option>
              <option value="JPY" className="bg-[#0b0c10] text-foreground">JPY (¥)</option>
            </select>
          </div>

          <button
            onClick={() => handleExport("pdf")}
            disabled={holdings.length === 0}
            className="px-4 py-2 border border-white/5 hover:border-accent/40 text-neutral hover:text-accent font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <span>Export PDF</span>
          </button>
          <button
            onClick={() => handleExport("excel")}
            disabled={holdings.length === 0}
            className="px-4 py-2 border border-white/5 hover:border-accent/40 text-neutral hover:text-accent font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <span>Export Excel</span>
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-accent hover:opacity-90 text-white font-bold text-xs rounded-xl flex items-center gap-2 cursor-pointer transition-all"
          >
            <Plus className="w-4.5 h-4.5" />
            <span>Add Transaction</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="glass-panel p-4 rounded-xl border border-bearish/20 bg-bearish/5 text-bearish text-xs flex items-center gap-2">
          <span>{error}</span>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="glass-card p-5 space-y-1.5 border-l-2 border-accent">
          <span className="text-[10px] text-neutral uppercase font-bold tracking-wider">Portfolio Value</span>
          <p className="text-xl font-mono font-bold text-foreground">{currencySymbol}{summary.total_value.toFixed(2)}</p>
        </div>
        <div className="glass-card p-5 space-y-1.5">
          <span className="text-[10px] text-neutral uppercase font-bold tracking-wider">Total Cost</span>
          <p className="text-xl font-mono font-bold text-foreground">{currencySymbol}{summary.total_cost.toFixed(2)}</p>
        </div>
        <div className="glass-card p-5 space-y-1.5">
          <span className="text-[10px] text-neutral uppercase font-bold tracking-wider">Total Gains / Loss</span>
          <p className={`text-xl font-mono font-bold ${summary.total_pnl >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
            {summary.total_pnl >= 0 ? "+" : ""}{currencySymbol}{summary.total_pnl.toFixed(2)}
          </p>
        </div>
        <div className="glass-card p-5 space-y-1.5">
          <span className="text-[10px] text-neutral uppercase font-bold tracking-wider">Return Percentage</span>
          <p className={`text-xl font-mono font-bold ${summary.total_pnl >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
            {summary.total_pnl >= 0 ? "+" : ""}{summary.total_pnl_pct.toFixed(2)}%
          </p>
        </div>
      </div>

      {/* Tab Selector */}
      {holdings.length > 0 && (
        <div className="flex bg-black/40 rounded-xl p-1 border border-white/5 self-start text-xs font-bold font-mono">
          <button
            type="button"
            onClick={() => setShowOptimizeTab(false)}
            className={`px-4 py-2 rounded-lg transition-all cursor-pointer ${!showOptimizeTab ? "bg-accent text-white" : "text-neutral hover:text-foreground"}`}
          >
            Allocation & Holdings
          </button>
          <button
            type="button"
            onClick={() => setShowOptimizeTab(true)}
            disabled={holdings.length < 2}
            className={`px-4 py-2 rounded-lg transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${showOptimizeTab ? "bg-accent text-white" : "text-neutral hover:text-foreground"}`}
            title={holdings.length < 2 ? "Add at least 2 stocks to optimize" : ""}
          >
            Optimization Studio
          </button>
        </div>
      )}

      {/* Allocation & Detailed Table / Optimization Studio */}
      {holdings.length > 0 ? (
        !showOptimizeTab ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Pie Chart Panel */}
            <div className="lg:col-span-1 glass-card p-6 space-y-4">
              <h3 className="text-xs font-bold text-neutral uppercase tracking-wider">Holding Weight Allocation</h3>
              {renderSVGAllocation()}
            </div>

            {/* Holdings Grid */}
            <div className="lg:col-span-2 glass-card p-6 space-y-4 overflow-hidden">
              <h3 className="text-xs font-bold text-neutral uppercase tracking-wider">Asset Holdings Summary</h3>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[600px] text-[10px] font-mono text-left border-collapse">
                  <thead>
                    <tr className="border-b border-white/10 text-neutral">
                      <th className="py-2 pr-4 font-bold font-sans">Ticker</th>
                      <th className="py-2 px-2 text-right">Shares</th>
                      <th className="py-2 px-2 text-right">Avg Entry</th>
                      <th className="py-2 px-2 text-right">Current</th>
                      <th className="py-2 px-2 text-right">Total Cost</th>
                      <th className="py-2 px-2 text-right">Total Value</th>
                      <th className="py-2 px-2 text-right">P&L</th>
                      <th className="py-2 pl-4 text-center font-sans font-bold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {holdings.map((h) => (
                      <tr key={h.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                        <td className="py-3 pr-4 font-bold text-accent">{h.ticker}</td>
                        <td className="py-3 px-2 text-right">{h.shares.toFixed(2)}</td>
                        <td className="py-3 px-2 text-right">
                          <div>{currencySymbol}{h.avg_buy_price.toFixed(2)}</div>
                          {h.native_currency !== preferredCurrency && (
                            <div className="text-[7.5px] text-neutral/40">
                              {h.avg_buy_price_native.toFixed(2)} {h.native_currency}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-2 text-right">
                          <div>{currencySymbol}{h.current_price.toFixed(2)}</div>
                          {h.native_currency !== preferredCurrency && (
                            <div className="text-[7.5px] text-neutral/40">
                              {h.current_price_native.toFixed(2)} {h.native_currency}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-2 text-right">
                          <div>{currencySymbol}{h.cost.toFixed(2)}</div>
                          {h.native_currency !== preferredCurrency && (
                            <div className="text-[7.5px] text-neutral/40">
                              {(h.avg_buy_price_native * h.shares).toFixed(2)} {h.native_currency}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-2 text-right">
                          <div>{currencySymbol}{h.value.toFixed(2)}</div>
                          {h.native_currency !== preferredCurrency && (
                            <div className="text-[7.5px] text-neutral/40">
                              {(h.current_price_native * h.shares).toFixed(2)} {h.native_currency}
                            </div>
                          )}
                        </td>
                        <td className={`py-3 px-2 text-right font-bold ${h.pnl >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                          {h.pnl >= 0 ? "+" : ""}{h.pnl_pct.toFixed(1)}%
                        </td>
                        <td className="py-3 pl-4 text-center">
                          <button
                            onClick={() => handleRemoveHolding(h.id)}
                            className="text-neutral/40 hover:text-rose-400 transition-colors p-1 cursor-pointer"
                            title="Remove holding"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          /* Portfolio Optimization Studio */
          <div className="space-y-8">
            {loadingOptimize ? (
              <div className="glass-card p-12 flex flex-col items-center justify-center gap-4 text-center">
                <Loader2 className="w-8 h-8 animate-spin text-accent" />
                <p className="text-xs font-bold text-neutral">Running Portfolio Optimization & Efficient Frontier Simulations...</p>
              </div>
            ) : errorOptimize ? (
              <div className="glass-card p-6 border border-rose-500/20 text-rose-400 text-xs">
                {errorOptimize}
              </div>
            ) : optimizationData ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Efficient Frontier SVG Plot */}
                <div className="glass-card p-6 space-y-4">
                  <h3 className="text-xs font-bold text-neutral uppercase tracking-wider">Efficient Frontier (Risk vs Return)</h3>
                  
                  {/* Custom SVG Scatter plot */}
                  {(() => {
                    const pts = optimizationData.frontier_points;
                    if (!pts || pts.length === 0) return null;
                    
                    // Min/Max of volatility and return to scale chart
                    const vols = pts.map((p: any) => p.volatility);
                    const rets = pts.map((p: any) => p.return);
                    
                    const minVol = Math.min(...vols) * 0.9;
                    const maxVol = Math.max(...vols) * 1.1;
                    const minRet = Math.min(...rets) * 0.9;
                    const maxRet = Math.max(...rets) * 1.1;
                    
                    const width = 400;
                    const height = 280;
                    const padding = 45;
                    
                    const getX = (val: number) => padding + ((val - minVol) / (maxVol - minVol)) * (width - 2 * padding);
                    const getY = (val: number) => height - padding - ((val - minRet) / (maxRet - minRet)) * (height - 2 * padding);
                    
                    // Max Sharpe and Min Vol coordinates
                    const maxSharpeX = getX(optimizationData.max_sharpe.volatility);
                    const maxSharpeY = getY(optimizationData.max_sharpe.return);
                    
                    const minVolX = getX(optimizationData.min_volatility.volatility);
                    const minVolY = getY(optimizationData.min_volatility.return);
                    
                    return (
                      <div className="space-y-4">
                        <div className="bg-black/35 rounded-xl border border-white/5 p-4">
                          <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
                            {/* Grid Lines */}
                            <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#ffffff" strokeOpacity="0.15" />
                            <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="#ffffff" strokeOpacity="0.15" />
                            
                            {/* Simulated Portfolios */}
                            {pts.map((p: any, idx: number) => (
                              <circle
                                key={idx}
                                cx={getX(p.volatility)}
                                cy={getY(p.return)}
                                r="1.5"
                                fill="#3b82f6"
                                opacity="0.35"
                              />
                            ))}
                            
                            {/* Optimal Portfolios */}
                            {/* Max Sharpe (Golden Star) */}
                            <circle cx={maxSharpeX} cy={maxSharpeY} r="7" fill="#fbbf24" stroke="white" strokeWidth="1.5" className="animate-pulse" />
                            {/* Min Vol (Cyan Diamond) */}
                            <rect x={minVolX - 5} y={minVolY - 5} width="10" height="10" transform={`rotate(45 ${minVolX} ${minVolY})`} fill="#06b6d4" stroke="white" strokeWidth="1.5" />
                            
                            {/* Axis Labels */}
                            <text x={width / 2} y={height - 8} fill="#9ca3af" fontSize="10" textAnchor="middle" fontWeight="bold">Annualized Volatility (Risk)</text>
                            <text x="12" y={height / 2} fill="#9ca3af" fontSize="10" textAnchor="middle" transform={`rotate(-90 12 ${height / 2})`} fontWeight="bold">Expected Return</text>
                            
                            {/* Chart Labels */}
                            <text x={maxSharpeX + 10} y={maxSharpeY - 5} fill="#fbbf24" fontSize="8" fontWeight="bold" textAnchor="start">Max Sharpe</text>
                            <text x={minVolX + 10} y={minVolY + 12} fill="#06b6d4" fontSize="8" fontWeight="bold" textAnchor="start">Min Volatility</text>
                          </svg>
                        </div>
                        
                        {/* Legend */}
                        <div className="flex gap-4 text-[10px] font-bold font-mono justify-center">
                          <div className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-[#fbbf24] shrink-0" />
                            <span className="text-foreground">Max Sharpe (Gold)</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 bg-[#06b6d4] shrink-0 rotate-45" />
                            <span className="text-foreground">Min Volatility (Cyan)</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-[#3b82f6]/40 shrink-0" />
                            <span className="text-neutral">Simulated Portfolios</span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Correlation Matrix & Allocations */}
                <div className="space-y-6">
                  {/* Correlation Heatmap */}
                  <div className="glass-card p-6 space-y-4">
                    <h3 className="text-xs font-bold text-neutral uppercase tracking-wider">Asset Correlation Matrix</h3>
                    <div className="bg-black/35 rounded-xl border border-white/5 p-4 overflow-x-auto">
                      <div className="min-w-[280px]">
                        {/* Headers */}
                        <div className="grid" style={{ gridTemplateColumns: `repeat(${optimizationData.tickers.length + 1}, minmax(0, 1fr))` }}>
                          <div />
                          {optimizationData.tickers.map((t: string) => (
                            <div key={t} className="text-center font-bold text-[10px] font-mono text-neutral pb-2">{t}</div>
                          ))}
                        </div>
                        
                        {/* Rows */}
                        {optimizationData.tickers.map((t_row: string, i: number) => (
                          <div key={t_row} className="grid" style={{ gridTemplateColumns: `repeat(${optimizationData.tickers.length + 1}, minmax(0, 1fr))` }}>
                            <div className="font-bold text-[10px] font-mono text-neutral pr-2 py-2 flex items-center">{t_row}</div>
                            {optimizationData.tickers.map((t_col: string, j: number) => {
                              const r = optimizationData.correlation_matrix[i][j];
                              // Map correlation value to color scale
                              const bg = r >= 0 
                                ? `rgba(239, 68, 68, ${r * 0.7})`  // red scale for positive corr
                                : `rgba(59, 130, 246, ${Math.abs(r) * 0.7})`; // blue scale for negative corr
                                
                              return (
                                <div
                                  key={t_col}
                                  style={{ backgroundColor: bg }}
                                  className="text-center font-mono font-bold text-[10px] text-foreground border border-white/5 py-3 rounded-lg flex items-center justify-center"
                                  title={`${t_row} vs ${t_col}: ${r.toFixed(4)}`}
                                >
                                  {r.toFixed(2)}
                                </div>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Allocations Comparison */}
                  <div className="glass-card p-6 space-y-4">
                    <h3 className="text-xs font-bold text-neutral uppercase tracking-wider">Optimal Target Allocations</h3>
                    <div className="grid grid-cols-2 gap-4">
                      {/* Max Sharpe Card */}
                      <div className="bg-black/30 border border-white/5 p-4 rounded-xl space-y-3">
                        <div>
                          <span className="text-[9px] text-[#fbbf24] font-black uppercase tracking-wider block mb-1">Max Sharpe Portfolio</span>
                          <span className="text-[10px] text-neutral block font-mono">Exp Return: {(optimizationData.max_sharpe.return * 100).toFixed(1)}%</span>
                          <span className="text-[10px] text-neutral block font-mono">Risk (Vol): {(optimizationData.max_sharpe.volatility * 100).toFixed(1)}%</span>
                        </div>
                        <div className="border-t border-white/5 pt-2 space-y-1 text-[9px] font-mono">
                          {Object.entries(optimizationData.max_sharpe.weights).map(([ticker, w]: any) => (
                            <div key={ticker} className="flex justify-between">
                              <span className="text-neutral">{ticker}</span>
                              <span className="text-foreground font-bold">{(w * 100).toFixed(1)}%</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Min Volatility Card */}
                      <div className="bg-black/30 border border-white/5 p-4 rounded-xl space-y-3">
                        <div>
                          <span className="text-[9px] text-[#06b6d4] font-black uppercase tracking-wider block mb-1">Min Volatility Portfolio</span>
                          <span className="text-[10px] text-neutral block font-mono">Exp Return: {(optimizationData.min_volatility.return * 100).toFixed(1)}%</span>
                          <span className="text-[10px] text-neutral block font-mono">Risk (Vol): {(optimizationData.min_volatility.volatility * 100).toFixed(1)}%</span>
                        </div>
                        <div className="border-t border-white/5 pt-2 space-y-1 text-[9px] font-mono">
                          {Object.entries(optimizationData.min_volatility.weights).map(([ticker, w]: any) => (
                            <div key={ticker} className="flex justify-between">
                              <span className="text-neutral">{ticker}</span>
                              <span className="text-foreground font-bold">{(w * 100).toFixed(1)}%</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="glass-card p-8 text-center text-neutral font-bold text-xs">
                No optimization data resolved.
              </div>
            )}
          </div>
        )
      ) : (
        <div className="glass-card p-12 text-center text-neutral space-y-4">
          <p className="text-xs font-bold font-sans">No holdings added to portfolio yet.</p>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 border border-white/10 hover:border-accent/40 rounded-xl text-xs font-bold cursor-pointer transition-colors inline-block"
          >
            Add your first transaction
          </button>
        </div>
      )}

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <form onSubmit={handleAddHolding} className="glass-panel max-w-sm w-full p-6 border border-white/10 rounded-2xl space-y-4">
            <h3 className="text-sm font-bold text-foreground">Add Equities Transaction</h3>
            
            <div className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="text-neutral font-semibold">Stock Ticker Symbol</label>
                <StockSearchInput
                  value={ticker}
                  onChange={setTicker}
                  onSelect={(sym) => setTicker(sym.toUpperCase())}
                  placeholder="e.g. AAPL, NVDA, RELIANCE.NS"
                />
              </div>

              <div className="space-y-1">
                <label className="text-neutral font-semibold">Number of Shares</label>
                <input
                  type="number"
                  required
                  step="any"
                  value={shares}
                  onChange={(e) => setShares(e.target.value)}
                  placeholder="e.g. 10"
                  className="w-full px-3 py-2 bg-black/40 border border-white/5 focus:border-accent/40 rounded-xl outline-none text-foreground font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-neutral font-semibold">
                  Average Buy Price (
                  {(() => {
                    const t = ticker.toUpperCase().trim();
                    if (t.endsWith(".NS") || t.endsWith(".BO") || t.includes("PW") || t.includes("WALLAH")) return "₹ INR";
                    if (t.endsWith(".L")) return "£ GBP";
                    if (t.endsWith(".PA") || t.endsWith(".DE")) return "€ EUR";
                    if (t.endsWith(".T")) return "¥ JPY";
                    return "$ USD";
                  })()}
                  )
                </label>
                <input
                  type="number"
                  required
                  step="any"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="e.g. 175.50"
                  className="w-full px-3 py-2 bg-black/40 border border-white/5 focus:border-accent/40 rounded-xl outline-none text-foreground font-mono"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 text-xs pt-2">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 hover:bg-white/5 rounded-xl font-bold text-neutral cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={formLoading}
                className="px-4 py-2 bg-accent hover:opacity-90 disabled:opacity-50 text-white font-bold rounded-xl cursor-pointer"
              >
                {formLoading ? "Adding..." : "Add Transaction"}
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}
