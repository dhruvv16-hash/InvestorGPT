"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2, Sparkles, TrendingUp, ShieldAlert, Award, Trash2, Flame } from "lucide-react";

export default function HomeClient() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [localCompanies, setLocalCompanies] = useState<any[]>([]);
  const [userId, setUserId] = useState("");
  const [recentSearches, setRecentSearches] = useState<any[]>([]);
  const [trendingSearches, setTrendingSearches] = useState<any[]>([]);
  const router = useRouter();

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
    // Initialize or load user_id
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

  const triggerAnalysis = async (symbol: string) => {
    setLoading(true);
    setError("");
    setSuggestions([]);
    setShowSuggestions(false);

    try {
      // Direct POST to backend API to initialize analysis
      const res = await fetch("http://127.0.0.1:8000/api/v1/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: symbol }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || "Failed to start analysis");
      }

      const data = await res.json();
      // Route user to the company page with the poll URL / analysis_id
      router.push(`/company/${data.company.ticker}?analysis_id=${data.analysis_id}`);
    } catch (err: any) {
      setError(err.message || "Something went wrong. Make sure backend is running.");
      setLoading(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    logSearchClick(query.trim(), query.trim(), "GLOBAL");
    triggerAnalysis(query.trim());
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);

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
      // Match if symbol or name contains any token (enables fuzzy-like matched typing)
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
    setQuery(s.symbol);
    logSearchClick(s.symbol, s.name, s.exchange);
    triggerAnalysis(s.symbol);
  };

  const handleQuickSearch = (ticker: string) => {
    setQuery(ticker);
    logSearchClick(ticker, ticker, "GLOBAL");
    triggerAnalysis(ticker);
  };

  const trendingTickers = ["NVDA", "AAPL", "MSFT", "GOOGL", "RELIANCE.NS", "TSLA"];

  return (
    <main className="flex-1 flex flex-col items-center justify-center p-4 md:p-8 relative min-h-screen">
      {/* Top Navbar */}
      <div className="absolute top-6 right-6 flex items-center gap-3">
        <button
          onClick={() => router.push("/modeling")}
          className="px-4 py-2 border border-white/10 hover:border-accent/40 rounded-xl text-neutral hover:text-accent text-xs font-bold transition-all bg-white/[0.01] cursor-pointer"
        >
          Financial Modeling Lab
        </button>
        <button
          onClick={() => router.push("/compare")}
          className="px-4 py-2 border border-white/10 hover:border-accent/40 rounded-xl text-neutral hover:text-accent text-xs font-bold transition-all bg-white/[0.01] cursor-pointer"
        >
          Compare Stocks
        </button>
      </div>

      {/* Background ambient glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] md:w-[600px] h-[350px] md:h-[600px] bg-primary/20 rounded-full blur-[100px] -z-10 pointer-events-none" />
      <div className="absolute bottom-10 left-10 w-[250px] h-[250px] bg-accent/15 rounded-full blur-[80px] -z-10 pointer-events-none" />

      <div className="w-full max-w-3xl text-center space-y-8 animate-float">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass-card border border-white/5 text-xs text-accent">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Autonomous Multi-Agent Equity Research Team</span>
        </div>

        {/* Title */}
        <div className="space-y-4">
          <h1 className="text-4xl md:text-7xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
            Investor<span className="bg-gradient-to-r from-accent to-primary bg-clip-text text-transparent">GPT</span>
          </h1>
          <p className="text-sm md:text-lg text-neutral max-w-xl mx-auto font-medium">
            Generate institutional-quality, explainable, and fully verified research reports instantly. Powered by collaborative agent committees.
          </p>
        </div>

        {/* Search Bar */}
        <form onSubmit={handleSearch} className="max-w-2xl mx-auto relative group">
          <div className="relative glass-panel rounded-2xl border border-white/10 group-hover:border-accent/40 group-focus-within:border-accent/60 transition-all duration-300 shadow-2xl p-1">
            <input
              type="text"
              value={query}
              onChange={handleInputChange}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 250)}
              placeholder="Analyze NVIDIA, Reliance, or enter symbol..."
              className="w-full pl-12 pr-32 py-4 bg-transparent border-0 outline-none text-foreground placeholder:text-neutral/70 font-medium text-sm md:text-base focus:ring-0"
              disabled={loading}
            />
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral group-hover:text-accent transition-colors" />
            
            <button
              type="submit"
              disabled={loading || !query.trim()}
              className="absolute right-2 top-1/2 -translate-y-1/2 px-6 py-2.5 bg-gradient-to-r from-accent to-primary hover:opacity-90 disabled:opacity-50 text-white font-bold text-xs md:text-sm rounded-xl transition-all duration-200 shadow-lg flex items-center gap-2 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Analyzing...</span>
                </>
              ) : (
                <span>Run Analysis</span>
              )}
            </button>
          </div>

          {/* Autocomplete Suggestions / Recent / Trending Dropdown */}
          {showSuggestions && (
            <div className="absolute left-0 right-0 mt-2 bg-[#0c0d12]/95 border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-50 text-left backdrop-blur-md max-h-80 overflow-y-auto">
              {query.trim().length > 0 ? (
                suggestions.length > 0 ? (
                  suggestions.map((s) => (
                    <button
                      key={s.symbol}
                      type="button"
                      onClick={() => handleSelectSuggestion(s)}
                      className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/[0.04] transition-colors border-b border-white/5 last:border-0 text-xs md:text-sm font-semibold text-left cursor-pointer"
                    >
                      <div className="flex flex-col gap-0.5 max-w-[80%]">
                        <div className="flex items-center gap-2">
                          <span className="text-foreground truncate">{s.name}</span>
                          {s.is_local && (
                            <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[8px] font-bold uppercase tracking-wider shrink-0">
                              Analyzed
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-neutral/70">{s.exchange} · {s.type}</span>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-white/[0.04] text-[10px] font-mono font-bold text-accent shrink-0">
                        {s.symbol}
                      </span>
                    </button>
                  ))
                ) : (
                  <p className="p-4 text-xs text-neutral/50 font-semibold">No matches found.</p>
                )
              ) : (
                <div className="p-4 space-y-4 text-xs font-semibold">
                  {/* Recent Searches */}
                  {recentSearches.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-[10px] font-bold tracking-wider text-neutral/50 uppercase">
                        <span>Recent Searches</span>
                        <button
                          type="button"
                          onClick={handleClearRecent}
                          className="hover:text-rose-400 transition-colors cursor-pointer flex items-center gap-1"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Clear All</span>
                        </button>
                      </div>
                      <div className="flex flex-col gap-1">
                        {recentSearches.map((r) => (
                          <button
                            key={r.symbol}
                            type="button"
                            onClick={() => handleSelectSuggestion(r)}
                            className="w-full px-3 py-2 flex items-center justify-between hover:bg-white/[0.03] rounded-lg transition-colors text-neutral hover:text-foreground cursor-pointer text-left font-semibold"
                          >
                            <div className="flex items-center gap-2 truncate">
                              <span className="font-mono text-accent shrink-0">{r.symbol}</span>
                              <span className="truncate text-foreground/90">{r.name}</span>
                            </div>
                            <span className="text-[10px] text-neutral/50 shrink-0 font-medium">{r.exchange}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Trending Searches */}
                  <div className="space-y-2">
                    <div className="text-[10px] font-bold tracking-wider text-neutral/50 uppercase flex items-center gap-1">
                      <Flame className="w-3.5 h-3.5 text-orange-500 fill-orange-500" />
                      <span>Trending Searches</span>
                    </div>
                    {trendingSearches.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {trendingSearches.map((t) => (
                          <button
                            key={t.symbol}
                            type="button"
                            onClick={() => handleSelectSuggestion(t)}
                            className="px-3.5 py-2 rounded-xl bg-white/[0.02] border border-white/5 hover:border-accent/40 text-xs font-mono font-medium hover:bg-white/[0.05] transition-all cursor-pointer flex items-center gap-1.5 text-neutral hover:text-foreground"
                          >
                            <span>{t.symbol}</span>
                            {t.count > 0 && <span className="text-[9px] text-neutral/40 font-bold font-sans">({t.count})</span>}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[10px] text-neutral/40 font-medium">No trending stocks logged yet.</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {error && (
            <p className="text-bearish text-sm mt-3 font-medium bg-bearish/10 border border-bearish/20 py-2 px-4 rounded-xl inline-block">
              {error}
            </p>
          )}
        </form>

        {/* Quick Tickers */}
        <div className="space-y-3">
          <p className="text-xs text-neutral font-semibold tracking-wider uppercase">Trending Symbols</p>
          <div className="flex flex-wrap justify-center gap-2 max-w-lg mx-auto">
            {trendingTickers.map((ticker) => (
              <button
                key={ticker}
                onClick={() => handleQuickSearch(ticker)}
                className="px-3.5 py-1.5 rounded-lg bg-white/[0.03] border border-white/5 hover:border-accent/40 text-xs font-mono font-medium hover:bg-white/[0.06] transition-all cursor-pointer"
              >
                {ticker}
              </button>
            ))}
          </div>
        </div>

        {/* Features Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-12 text-left max-w-4xl mx-auto">
          <div className="glass-card p-6 flex flex-col gap-2">
            <Award className="w-6 h-6 text-accent" />
            <h3 className="text-sm font-bold text-foreground">Zero Math Hallucination</h3>
            <p className="text-xs text-neutral">Calculations run in deterministic Python code, never in the LLM.</p>
          </div>
          <div className="glass-card p-6 flex flex-col gap-2">
            <TrendingUp className="w-6 h-6 text-primary" />
            <h3 className="text-sm font-bold text-foreground">Explainable Reasoning</h3>
            <p className="text-xs text-neutral">Every figure is traceable to its source and formulas are viewable.</p>
          </div>
          <div className="glass-card p-6 flex flex-col gap-2">
            <ShieldAlert className="w-6 h-6 text-accent" />
            <h3 className="text-sm font-bold text-foreground">Multi-Agent Voting</h3>
            <p className="text-xs text-neutral">Consensus decision-making engine mimics investment committees.</p>
          </div>
        </div>
      </div>
    </main>
  );
}
