"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { 
  Activity, ShieldAlert, RefreshCw, Eye, Sparkles, TrendingUp
} from "lucide-react";
import { TechnicalGauge } from "@/components/gauges/TechnicalGauge";
import { InteractiveCandleChart } from "@/components/charts/InteractiveCandleChart";
import { StockSearchInput } from "@/components/inputs/StockSearchInput";

function TechnicalAnalysisContent() {
  const searchParams = useSearchParams();
  const tickerFromUrl = searchParams.get("ticker") || "NVDA";
  
  const [ticker, setTicker] = useState(tickerFromUrl.toUpperCase());
  const [searchQuery, setSearchQuery] = useState(tickerFromUrl.toUpperCase());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState<any>(null);

  const fetchTechnical = async (symbol: string) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`https://backend-gamma-mocha-34.vercel.app/api/v1/technical/${symbol}`);
      if (!res.ok) {
        throw new Error(`Symbol ${symbol} not found or insufficient history.`);
      }
      const json = await res.json();
      setData(json);
      setTicker(symbol.toUpperCase());
    } catch (err: any) {
      setError(err.message || "Failed to load technical indicators.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTechnical(tickerFromUrl);
  }, [tickerFromUrl]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      fetchTechnical(searchQuery.trim());
    }
  };

  return (
    <main className="flex-1 flex flex-col p-4 md:p-8 max-w-7xl mx-auto w-full gap-8 relative min-h-screen">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] bg-primary/10 rounded-full blur-[100px] -z-10 pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-white/5 pb-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Activity className="w-6 h-6 text-accent" />
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-foreground font-mono">
              Technical Analysis Dashboard
            </h1>
          </div>
          <p className="text-xs text-neutral/70 font-medium">
            Lightweight interactive charts, moving average crossovers, Bollinger squeezes, Ichimoku clouds, and ADX trends.
          </p>
        </div>

        {/* Search */}
        <div className="w-full md:w-48 shrink-0 relative z-50">
          <StockSearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            onSelect={(sym) => {
              setSearchQuery(sym);
              fetchTechnical(sym);
            }}
            placeholder="Search symbol..."
          />
        </div>
      </div>

      {error && (
        <div className="glass-panel p-4 rounded-xl border border-bearish/20 bg-bearish/5 text-bearish text-xs flex items-center gap-2">
          <ShieldAlert className="w-4.5 h-4.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Dual Listing Conversion Recommendation Banner */}
      {!loading && data && (
        (() => {
          const upperTicker = ticker.toUpperCase();
          const dualMapping: Record<string, { native: string, currency: string, symbol: string, label: string }> = {
            "INFY": { native: "INFY.NS", currency: "INR", symbol: "₹", label: "NSE native equivalent (INFY.NS)" },
            "WIT": { native: "WIPRO.NS", currency: "INR", symbol: "₹", label: "NSE native equivalent (WIPRO.NS)" },
            "RDY": { native: "DRREDDY.NS", currency: "INR", symbol: "₹", label: "NSE native equivalent (DRREDDY.NS)" },
            "IBN": { native: "ICICIBANK.NS", currency: "INR", symbol: "₹", label: "NSE native equivalent (ICICIBANK.NS)" },
            "HDB": { native: "HDFCBANK.NS", currency: "INR", symbol: "₹", label: "NSE native equivalent (HDFCBANK.NS)" },
            "INFY.NS": { native: "INFY", currency: "USD", symbol: "$", label: "NYSE ADR equivalent (INFY)" },
            "WIPRO.NS": { native: "WIT", currency: "USD", symbol: "$", label: "NYSE ADR equivalent (WIT)" },
            "DRREDDY.NS": { native: "RDY", currency: "USD", symbol: "$", label: "NYSE ADR equivalent (RDY)" },
            "ICICIBANK.NS": { native: "IBN", currency: "USD", symbol: "$", label: "NYSE ADR equivalent (IBN)" },
            "HDFCBANK.NS": { native: "HDB", currency: "USD", symbol: "$", label: "NYSE ADR equivalent (HDB)" }
          };

          const matched = dualMapping[upperTicker];
          if (!matched) return null;

          return (
            <div className="glass-panel p-3.5 rounded-xl border border-accent/20 bg-accent/5 text-xs text-foreground/90 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 font-semibold animate-fade-in">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-accent shrink-0" />
                <span>
                  Viewing listing in <strong className="text-accent">{upperTicker}</strong>. 
                  Would you like to switch to the {matched.label} priced in {matched.symbol} ({matched.currency})?
                </span>
              </div>
              <button
                onClick={() => {
                  setTicker(matched.native);
                  setSearchQuery(matched.native);
                  fetchTechnical(matched.native);
                }}
                className="px-3.5 py-1.5 bg-accent hover:opacity-90 text-white rounded-lg font-bold text-[10px] uppercase shrink-0 transition-opacity cursor-pointer"
              >
                Switch Ticker
              </button>
            </div>
          );
        })()
      )}

      {loading && (
        <div className="flex items-center gap-2 justify-center py-24 text-xs font-bold text-neutral">
          <RefreshCw className="w-4 h-4 animate-spin text-accent" />
          <span>Computing indicators...</span>
        </div>
      )}

      {!loading && data && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Panel: Gauges & Signal */}
          <div className="lg:col-span-1 space-y-6">
            <div className="glass-card p-6 flex flex-col items-center justify-between border-t-2 border-accent text-center">
              <span className="text-[10px] text-neutral uppercase font-bold tracking-wider">Overall Trend Signal</span>
              <span className={`text-2xl font-black font-mono mt-2 tracking-wide uppercase ${
                data.signal.includes("BUY") ? "text-emerald-400" :
                data.signal.includes("SELL") ? "text-rose-400" : "text-amber-400"
              }`}>
                {data.signal}
              </span>
              <p className="text-xs text-neutral/70 mt-3 leading-relaxed px-4">{data.explanation}</p>
            </div>

            <div className="glass-card p-6 flex flex-col items-center">
              <span className="text-[10px] text-neutral uppercase font-bold tracking-wider mb-4">Relative Strength Index (RSI)</span>
              <TechnicalGauge rsi={data.rsi} />
              <div className="flex justify-between w-full text-[10px] font-mono text-neutral/60 px-4 mt-2">
                <span>0 (Oversold)</span>
                <span className="font-bold text-foreground">RSI: {data.rsi.toFixed(1)}</span>
                <span>100 (Overbought)</span>
              </div>
            </div>

            <div className="glass-card p-6 space-y-4">
              <span className="text-[10px] text-neutral uppercase font-bold tracking-wider block">Key Price Levels</span>
              <div className="space-y-2 text-xs font-mono">
                <div className="flex justify-between border-b border-white/5 pb-2">
                  <span className="text-neutral font-sans">Resistance Pivot (30-day High):</span>
                  <span className="font-bold text-rose-400">${data.pivots.resistance.toFixed(2)}</span>
                </div>
                <div className="flex justify-between border-b border-white/5 pb-2">
                  <span className="text-neutral font-sans">Current Close Price:</span>
                  <span className="font-bold">${data.current_price.toFixed(2)}</span>
                </div>
                <div className="flex justify-between pb-1">
                  <span className="text-neutral font-sans">Support Pivot (30-day Low):</span>
                  <span className="font-bold text-emerald-400">${data.pivots.support.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Panel: Interactive Chart & Grid */}
          <div className="lg:col-span-2 space-y-6">
            <div className="glass-card p-6 space-y-4">
              <span className="text-[10px] text-neutral uppercase font-bold tracking-wider block">
                Interactive Technical Chart ({ticker})
              </span>
              <InteractiveCandleChart history={data.history} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Bollinger Bands & Squeeze Alerts */}
              <div className="glass-card p-6 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-neutral uppercase font-bold tracking-wider">Bollinger Volatility</span>
                  {data.bollinger.is_squeeze ? (
                    <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[7px] font-extrabold uppercase animate-pulse">
                      SQUEEZE ACTIVE
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded bg-white/[0.04] text-neutral/50 text-[7px] font-extrabold uppercase">
                      NORMAL
                    </span>
                  )}
                </div>
                <div className="space-y-2 text-xs font-mono">
                  <div className="flex justify-between border-b border-white/5 pb-1">
                    <span className="text-neutral font-sans">Upper Band (20, 2):</span>
                    <span>${data.bollinger.upper.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between border-b border-white/5 pb-1">
                    <span className="text-neutral font-sans">Middle Band (SMA 20):</span>
                    <span>${data.bollinger.middle.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between pb-1">
                    <span className="text-neutral font-sans">Lower Band (20, 2):</span>
                    <span>${data.bollinger.lower.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* MACD Oscillator */}
              <div className="glass-card p-6 space-y-3">
                <span className="text-[10px] text-neutral uppercase font-bold tracking-wider block">MACD Momentum</span>
                <div className="space-y-2 text-xs font-mono">
                  <div className="flex justify-between border-b border-white/5 pb-1">
                    <span className="text-neutral font-sans">MACD Line (12, 26):</span>
                    <span className={data.macd.macd >= 0 ? "text-emerald-400" : "text-rose-400"}>
                      {data.macd.macd.toFixed(4)}
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-white/5 pb-1">
                    <span className="text-neutral font-sans">Signal Line (9 EMA):</span>
                    <span>{data.macd.signal.toFixed(4)}</span>
                  </div>
                  <div className="flex justify-between pb-1">
                    <span className="text-neutral font-sans">MACD Histogram:</span>
                    <span className={data.macd.histogram >= 0 ? "text-emerald-400" : "text-rose-400"}>
                      {data.macd.histogram.toFixed(4)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Ichimoku Cloud Details */}
              <div className="glass-card p-6 space-y-3">
                <span className="text-[10px] text-neutral uppercase font-bold tracking-wider block">Ichimoku Cloud Coordinates</span>
                <div className="space-y-2 text-xs font-mono">
                  <div className="flex justify-between border-b border-white/5 pb-1">
                    <span className="text-neutral font-sans">Tenkan-sen (Conversion):</span>
                    <span>${data.ichimoku.tenkan.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between border-b border-white/5 pb-1">
                    <span className="text-neutral font-sans">Kijun-sen (Baseline):</span>
                    <span>${data.ichimoku.kijun.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between border-b border-white/5 pb-1">
                    <span className="text-neutral font-sans">Senkou Span A:</span>
                    <span>${data.ichimoku.span_a.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between pb-1">
                    <span className="text-neutral font-sans">Senkou Span B:</span>
                    <span>${data.ichimoku.span_b.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* ADX Trend Index */}
              <div className="glass-card p-6 space-y-3">
                <span className="text-[10px] text-neutral uppercase font-bold tracking-wider block">ADX Trend Strength</span>
                <div className="space-y-2 text-xs font-mono">
                  <div className="flex justify-between border-b border-white/5 pb-1">
                    <span className="text-neutral font-sans">ADX Index Score:</span>
                    <span className="font-bold text-accent">{data.adx.adx.toFixed(1)}</span>
                  </div>
                  <div className="flex justify-between border-b border-white/5 pb-1">
                    <span className="text-neutral font-sans">Trend Strength:</span>
                    <span className={`font-extrabold uppercase ${
                      data.adx.trend.includes("STRONG") ? "text-emerald-400" :
                      data.adx.trend.includes("DEVELOPING") ? "text-amber-400" : "text-neutral/60"
                    }`}>
                      {data.adx.trend}
                    </span>
                  </div>
                  <div className="text-[10px] text-neutral/50 font-sans leading-relaxed pt-1">
                    An ADX above 25 signals a strong trending market, while values under 20 indicate trendless consolidations.
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default function TechnicalAnalysisPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen text-xs font-bold text-neutral">
        <RefreshCw className="w-4 h-4 animate-spin text-accent" />
        <span>Loading Technical Analysis...</span>
      </div>
    }>
      <TechnicalAnalysisContent />
    </Suspense>
  );
}
