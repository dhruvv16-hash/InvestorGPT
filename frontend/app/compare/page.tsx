"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Plus, Trash2, Scale, AlertCircle, Download, Flame } from "lucide-react";
import { getCurrencySymbol } from "@/components/cards/InvestmentScoreCard";
import { StockSearchInput } from "@/components/inputs/StockSearchInput";

export default function ComparePage() {
  const router = useRouter();
  const [tickers, setTickers] = useState<string[]>(["NVDA", "AMD"]);
  const [newTicker, setNewTicker] = useState("");
  const [comparison, setComparison] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [localCompanies, setLocalCompanies] = useState<any[]>([]);
  const [userId, setUserId] = useState("");
  const [recentSearches, setRecentSearches] = useState<any[]>([]);
  const [trendingSearches, setTrendingSearches] = useState<any[]>([]);

  const debounceTimeoutRef = useRef<any>(null);
  const searchCacheRef = useRef<Record<string, any[]>>({});
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchRecentSearches = async (uId: string) => {
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/v1/search/recent?user_id=${uId}`);
      if (res.ok) {
        const json = await res.json();
        setRecentSearches(json.recent || []);
      }
    } catch (err) {
      console.error("Failed to fetch recent searches:", err);
    }
  };

  const fetchTrendingSearches = async () => {
    try {
      const res = await fetch("http://127.0.0.1:8000/api/v1/search/trending");
      if (res.ok) {
        const json = await res.json();
        setTrendingSearches(json.trending || []);
      }
    } catch (err) {
      console.error("Failed to fetch trending searches:", err);
    }
  };

  useEffect(() => {
    let uId = localStorage.getItem("investorgpt_user_id");
    if (!uId) {
      uId = "usr_" + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      localStorage.setItem("investorgpt_user_id", uId);
    }
    setUserId(uId);

    const fetchLocalCompanies = async () => {
      try {
        const res = await fetch("http://127.0.0.1:8000/api/v1/companies");
        if (res.ok) {
          const json = await res.json();
          setLocalCompanies(json.companies || []);
        }
      } catch (err) {
        console.error("Failed to pre-fetch local companies:", err);
      }
    };

    fetchLocalCompanies();
    fetchRecentSearches(uId);
    fetchTrendingSearches();

    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const logSearchClick = async (symbol: string, name: string, exchange: string) => {
    const uId = userId || localStorage.getItem("investorgpt_user_id");
    if (!uId) return;
    try {
      await fetch("http://127.0.0.1:8000/api/v1/search/click", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: symbol,
          name: name || symbol,
          exchange: exchange || "GLOBAL",
          user_id: uId
        })
      });
      fetchRecentSearches(uId);
      fetchTrendingSearches();
    } catch (err) {
      console.error("Failed to log search click:", err);
    }
  };

  const handleClearRecent = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const uId = userId || localStorage.getItem("investorgpt_user_id");
    if (!uId) return;
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/v1/search/recent?user_id=${uId}`, {
        method: "DELETE"
      });
      if (res.ok) {
        setRecentSearches([]);
      }
    } catch (err) {
      console.error("Failed to clear recent searches:", err);
    }
  };

  const handleAdd = () => {
    if (!newTicker.trim()) return;
    const clean = newTicker.trim().toUpperCase();
    if (!tickers.includes(clean)) {
      setTickers([...tickers, clean]);
      logSearchClick(clean, clean, "GLOBAL");
    }
    setNewTicker("");
    setSuggestions([]);
    setShowSuggestions(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setNewTicker(val);

    const term = val.trim();
    if (term.length < 1) {
      setSuggestions([]);
      return;
    }

    // 1. Instantly filter local companies in memory (0ms delay)
    const tokens = term.toLowerCase().split(/\s+/).filter(Boolean);
    const filteredLocal = localCompanies.filter(c => {
      const symbol = c.symbol.toLowerCase();
      const name = c.name.toLowerCase();
      // Match if symbol or name contains any token
      return tokens.some(t => symbol.includes(t) || name.includes(t));
    });

    // Set suggestions instantly to local matches
    setSuggestions(filteredLocal);

    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    // 2. Check client-side cache first (0ms delay for cached remote queries)
    const cachedTerm = term.toLowerCase();
    if (searchCacheRef.current[cachedTerm]) {
      const cachedQuotes = searchCacheRef.current[cachedTerm];
      const seen = new Set(filteredLocal.map(c => c.symbol.toUpperCase().trim()));
      const merged = [...filteredLocal];
      
      for (const q of cachedQuotes) {
        const sym = q.symbol.toUpperCase().trim();
        if (!seen.has(sym)) {
          seen.add(sym);
          merged.push(q);
        }
      }
      setSuggestions(merged);
      return;
    }

    // 3. Debounce and cancel previous remote requests for ultra low latency
    debounceTimeoutRef.current = setTimeout(async () => {
      // Abort any outstanding request before making a new one
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();
      const signal = abortControllerRef.current.signal;

      try {
        const res = await fetch(
          `http://127.0.0.1:8000/api/v1/search?q=${encodeURIComponent(term)}`,
          { signal }
        );
        if (res.ok) {
          const data = await res.json();
          const quotes = data.quotes || [];
          
          // Cache the remote-only quotes
          const remoteOnly = quotes.filter((q: any) => !q.is_local);
          searchCacheRef.current[cachedTerm] = remoteOnly;

          // Merge local and remote results, keeping local at top and deduplicating by ticker
          const seen = new Set(filteredLocal.map(c => c.symbol.toUpperCase().trim()));
          const merged = [...filteredLocal];
          
          for (const q of quotes) {
            const sym = q.symbol.toUpperCase().trim();
            if (!seen.has(sym)) {
              seen.add(sym);
              merged.push(q);
            }
          }
          setSuggestions(merged);
        }
      } catch (err: any) {
        if (err.name !== "AbortError") {
          console.error("Suggestions fetch failed:", err);
        }
      }
    }, 150); // 150ms debounce to avoid spamming the backend during fast typing
  };

  const handleSelectSuggestion = (s: any) => {
    const clean = s.symbol.trim().toUpperCase();
    if (!tickers.includes(clean)) {
      setTickers([...tickers, clean]);
      logSearchClick(s.symbol, s.name, s.exchange);
    }
    setNewTicker("");
    setSuggestions([]);
    setShowSuggestions(false);
  };

  const handleRemove = (symbol: string) => {
    setTickers(tickers.filter(t => t !== symbol));
  };

  const handleCompare = async () => {
    if (tickers.length === 0) return;
    setLoading(true);
    setError("");
    setComparison([]);

    try {
      const res = await fetch("http://127.0.0.1:8000/api/v1/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tickers }),
      });

      if (!res.ok) {
        throw new Error("Failed to resolve and compare tickers");
      }

      const json = await res.json();
      setComparison(json.comparison || []);
    } catch (err: any) {
      setError(err.message || "Something went wrong comparing symbols.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex-1 flex flex-col p-4 md:p-8 max-w-5xl mx-auto w-full gap-8 relative min-h-screen">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] bg-primary/10 rounded-full blur-[100px] -z-10 pointer-events-none" />

      {/* Header */}
      <div className="space-y-2 border-b border-white/5 pb-6">
        <button
          onClick={() => router.push("/")}
          className="flex items-center gap-1.5 text-xs text-neutral hover:text-accent font-semibold transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Search
        </button>
        <div className="flex items-center gap-3">
          <Scale className="w-6 h-6 text-accent" />
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-foreground font-mono">
            Company Comparison Engine
          </h1>
        </div>
        <p className="text-xs text-neutral/70 font-medium">
          Compare key multiples and margins side by side across global listings.
        </p>
      </div>

      {/* Input Selection Block */}
      <div className="glass-card p-6 space-y-4">
        <h3 className="text-xs font-bold text-neutral uppercase tracking-wider">Select Tickers to Compare</h3>
        
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex gap-2 flex-1 relative z-50">
            <StockSearchInput
              value={newTicker}
              onChange={setNewTicker}
              onSelect={(symbol) => {
                const clean = symbol.trim().toUpperCase();
                if (!tickers.includes(clean)) {
                  setTickers([...tickers, clean]);
                  logSearchClick(symbol, symbol, "GLOBAL");
                }
                setNewTicker("");
              }}
              placeholder="e.g. AAPL, MSFT, TSLA"
            />

            <button
              onClick={handleAdd}
              className="px-4 py-2.5 bg-white/[0.03] border border-white/5 hover:border-accent/40 rounded-xl text-xs text-neutral hover:text-accent font-bold flex items-center gap-1.5 cursor-pointer transition-colors h-[38px]"
            >
              <Plus className="w-4 h-4" /> Add
            </button>
          </div>

          <button
            onClick={handleCompare}
            disabled={loading || tickers.length === 0}
            className="px-6 py-2.5 bg-gradient-to-r from-accent to-primary hover:opacity-90 disabled:opacity-40 text-white font-bold text-xs rounded-xl shadow-lg flex items-center justify-center gap-2 cursor-pointer transition-opacity"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Compare Side-by-Side
          </button>
        </div>

        {/* Current list */}
        <div className="flex flex-wrap gap-2 pt-2">
          {tickers.map(ticker => (
            <div
              key={ticker}
              className="inline-flex items-center gap-1.5 pl-3 pr-1.5 py-1.5 rounded-lg bg-white/[0.02] border border-white/5 text-xs font-mono font-medium"
            >
              <span>{ticker}</span>
              <button
                onClick={() => handleRemove(ticker)}
                className="p-0.5 rounded hover:bg-rose-500/10 text-neutral hover:text-rose-400 cursor-pointer transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {error && (
        <div className="bg-bearish/10 border border-bearish/20 p-4 rounded-xl text-bearish text-xs flex items-center gap-2">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Comparison Grid Results */}
      {comparison.length > 0 && (
        <div className="glass-panel p-6 rounded-2xl border border-white/10 shadow-2xl space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-white/5 pb-4">
            <h3 className="text-xs font-bold text-neutral uppercase tracking-wider">Comparison Matrix</h3>
            <div className="flex items-center gap-2">
              <a
                href={`http://127.0.0.1:8000/api/v1/compare/export?tickers=${tickers.join(",")}&format=pdf`}
                download
                className="px-3 py-1.5 border border-white/10 hover:border-accent/40 rounded-lg text-neutral hover:text-accent text-[10px] font-bold flex items-center gap-1.5 cursor-pointer transition-colors bg-white/[0.01]"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export PDF</span>
              </a>
              <a
                href={`http://127.0.0.1:8000/api/v1/compare/export?tickers=${tickers.join(",")}&format=xlsx`}
                download
                className="px-3 py-1.5 border border-white/10 hover:border-accent/40 rounded-lg text-neutral hover:text-accent text-[10px] font-bold flex items-center gap-1.5 cursor-pointer transition-colors bg-white/[0.01]"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Excel</span>
              </a>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse min-w-[600px]">
              <thead>
              <tr className="border-b border-white/5 text-neutral font-semibold">
                <th className="py-3">Metric</th>
                {comparison.map(comp => (
                  <th key={comp.ticker} className="py-3 font-mono">{comp.ticker}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* Name */}
              <tr className="border-b border-white/5 hover:bg-white/[0.01]">
                <td className="py-3 font-semibold text-neutral/80">Company Name</td>
                {comparison.map(comp => (
                  <td key={comp.ticker} className="py-3 font-medium text-foreground">{comp.name}</td>
                ))}
              </tr>

              {/* Section: Valuation & Scores */}
              <tr className="bg-white/[0.02] border-b border-white/5">
                <td colSpan={comparison.length + 1} className="py-2 px-3 font-bold text-accent uppercase tracking-wider text-[10px]">
                  Valuation & Scores
                </td>
              </tr>
              {/* DCF Fair Value */}
              <tr className="border-b border-white/5 hover:bg-white/[0.01]">
                <td className="py-3 pl-3 font-semibold text-neutral/80">DCF Fair Value</td>
                {comparison.map(comp => (
                  <td key={comp.ticker} className="py-3 font-mono font-bold text-emerald-400">
                    {comp.fair_value ? `${getCurrencySymbol(comp.currency)}${comp.fair_value.toFixed(2)}` : "N/A"}
                  </td>
                ))}
              </tr>
              {/* DCF Upside/Downside */}
              <tr className="border-b border-white/5 hover:bg-white/[0.01]">
                <td className="py-3 pl-3 font-semibold text-neutral/80">DCF Margin of Safety</td>
                {comparison.map(comp => {
                  const upside = comp.fair_value && comp.price ? ((comp.fair_value - comp.price) / comp.price) * 100 : null;
                  return (
                    <td key={comp.ticker} className={`py-3 font-mono font-semibold ${upside !== null ? (upside >= 0 ? "text-emerald-400" : "text-rose-400") : "text-neutral/50"}`}>
                      {upside !== null ? `${upside >= 0 ? "+" : ""}${upside.toFixed(1)}%` : "N/A"}
                    </td>
                  );
                })}
              </tr>
              {/* Piotroski F-Score */}
              <tr className="border-b border-white/5 hover:bg-white/[0.01]">
                <td className="py-3 pl-3 font-semibold text-neutral/80">Piotroski F-Score</td>
                {comparison.map(comp => (
                  <td key={comp.ticker} className="py-3 font-mono font-medium text-foreground">
                    {comp.f_score !== null ? `${comp.f_score}/9` : "N/A"}
                  </td>
                ))}
              </tr>
              {/* Altman Z-Score */}
              <tr className="border-b border-white/5 hover:bg-white/[0.01]">
                <td className="py-3 pl-3 font-semibold text-neutral/80">Altman Z-Score</td>
                {comparison.map(comp => (
                  <td key={comp.ticker} className="py-3 font-mono font-medium text-foreground">
                    {comp.z_score !== null ? comp.z_score.toFixed(2) : "N/A"}
                  </td>
                ))}
              </tr>

              {/* Section: Market & Sentiment */}
              <tr className="bg-white/[0.02] border-b border-white/5">
                <td colSpan={comparison.length + 1} className="py-2 px-3 font-bold text-accent uppercase tracking-wider text-[10px]">
                  Market & Sentiment
                </td>
              </tr>
              {/* Price */}
              <tr className="border-b border-white/5 hover:bg-white/[0.01]">
                <td className="py-3 pl-3 font-semibold text-neutral/80">Stock Price</td>
                {comparison.map(comp => (
                  <td key={comp.ticker} className="py-3 font-mono font-semibold text-foreground">{getCurrencySymbol(comp.currency)}{comp.price.toFixed(2)}</td>
                ))}
              </tr>
              {/* Market Cap */}
              <tr className="border-b border-white/5 hover:bg-white/[0.01]">
                <td className="py-3 pl-3 font-semibold text-neutral/80">Market Cap</td>
                {comparison.map(comp => (
                  <td key={comp.ticker} className="py-3 font-mono text-foreground">
                    {comp.market_cap ? `${getCurrencySymbol(comp.currency)}${(comp.market_cap / 1e9).toFixed(2)}B` : "N/A"}
                  </td>
                ))}
              </tr>
              {/* PE */}
              <tr className="border-b border-white/5 hover:bg-white/[0.01]">
                <td className="py-3 pl-3 font-semibold text-neutral/80">P/E Ratio</td>
                {comparison.map(comp => (
                  <td key={comp.ticker} className="py-3 font-mono font-medium text-foreground">
                    {comp.pe ? comp.pe.toFixed(1) : "N/A"}
                  </td>
                ))}
              </tr>
              {/* RSI */}
              <tr className="border-b border-white/5 hover:bg-white/[0.01]">
                <td className="py-3 pl-3 font-semibold text-neutral/80">RSI (14)</td>
                {comparison.map(comp => (
                  <td key={comp.ticker} className="py-3 font-mono text-foreground font-medium">
                    {comp.rsi !== null ? comp.rsi.toFixed(1) : "N/A"}
                  </td>
                ))}
              </tr>
              {/* Sentiment */}
              <tr className="border-b border-white/5 hover:bg-white/[0.01]">
                <td className="py-3 pl-3 font-semibold text-neutral/80">News Sentiment</td>
                {comparison.map(comp => (
                  <td key={comp.ticker} className={`py-3 font-semibold ${comp.sentiment === "BULLISH" ? "text-emerald-400" : comp.sentiment === "BEARISH" ? "text-rose-400" : "text-neutral/70"}`}>
                    {comp.sentiment || "NEUTRAL"}
                  </td>
                ))}
              </tr>
              {/* Risk Level */}
              <tr className="border-b border-white/5 hover:bg-white/[0.01]">
                <td className="py-3 pl-3 font-semibold text-neutral/80">Risk Level</td>
                {comparison.map(comp => (
                  <td key={comp.ticker} className={`py-3 font-semibold ${comp.risk_level === "HIGH" ? "text-rose-400" : comp.risk_level === "LOW" ? "text-emerald-400" : "text-amber-400"}`}>
                    {comp.risk_level || "MEDIUM"}
                  </td>
                ))}
              </tr>

              {/* Section: Operations & Cash Flow */}
              <tr className="bg-white/[0.02] border-b border-white/5">
                <td colSpan={comparison.length + 1} className="py-2 px-3 font-bold text-accent uppercase tracking-wider text-[10px]">
                  Operations & Cash Flow
                </td>
              </tr>
              {/* Revenue */}
              <tr className="border-b border-white/5 hover:bg-white/[0.01]">
                <td className="py-3 pl-3 font-semibold text-neutral/80">Annual Revenue</td>
                {comparison.map(comp => (
                  <td key={comp.ticker} className="py-3 font-mono text-foreground">
                    {comp.revenue ? `${getCurrencySymbol(comp.currency)}${(comp.revenue / 1e9).toFixed(2)}B` : "N/A"}
                  </td>
                ))}
              </tr>
              {/* Gross Margin */}
              <tr className="border-b border-white/5 hover:bg-white/[0.01]">
                <td className="py-3 pl-3 font-semibold text-neutral/80">Gross Margin</td>
                {comparison.map(comp => (
                  <td key={comp.ticker} className="py-3 font-mono font-semibold text-emerald-400">
                    {comp.gross_margin ? `${(comp.gross_margin * 100).toFixed(1)}%` : "N/A"}
                  </td>
                ))}
              </tr>
              {/* Net Margin */}
              <tr className="border-b border-white/5 hover:bg-white/[0.01]">
                <td className="py-3 pl-3 font-semibold text-neutral/80">Net Margin</td>
                {comparison.map(comp => (
                  <td key={comp.ticker} className="py-3 font-mono font-semibold text-emerald-400">
                    {comp.net_margin ? `${(comp.net_margin * 100).toFixed(1)}%` : "N/A"}
                  </td>
                ))}
              </tr>
              {/* Operating Cash Flow */}
              <tr className="border-b border-white/5 hover:bg-white/[0.01]">
                <td className="py-3 pl-3 font-semibold text-neutral/80">Operating Cash Flow</td>
                {comparison.map(comp => (
                  <td key={comp.ticker} className="py-3 font-mono text-foreground">
                    {comp.operating_cash_flow ? `${getCurrencySymbol(comp.currency)}${(comp.operating_cash_flow / 1e9).toFixed(2)}B` : "N/A"}
                  </td>
                ))}
              </tr>
              {/* Capex */}
              <tr className="border-b border-white/5 hover:bg-white/[0.01]">
                <td className="py-3 pl-3 font-semibold text-neutral/80">Capital Expenditures</td>
                {comparison.map(comp => (
                  <td key={comp.ticker} className="py-3 font-mono text-rose-400">
                    {comp.capital_expenditures ? `-${getCurrencySymbol(comp.currency)}${Math.abs(comp.capital_expenditures / 1e9).toFixed(2)}B` : "N/A"}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
          </div>
        </div>
      )}
    </main>
  );
}
