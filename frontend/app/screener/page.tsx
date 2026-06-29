"use client";

import { useState } from "react";
import { Search, Loader2, Sparkles, Filter, ChevronRight, BarChart3 } from "lucide-react";
import { useRouter } from "next/navigation";

export default function ScreenerPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState("");

  const presetQueries = [
    "find undervalued tech stocks",
    "high growth companies with strong solvency",
    "tech stocks near oversold levels",
    "fortress balance sheets with high F-Score"
  ];

  const handleScreen = async (e?: React.FormEvent, searchQuery?: string) => {
    if (e) e.preventDefault();
    const finalQuery = searchQuery || query;
    if (!finalQuery.trim()) return;

    setQuery(finalQuery);
    setLoading(true);
    setError("");
    setSearched(true);

    try {
      const res = await fetch(`https://backend-gamma-mocha-34.vercel.app/api/v1/screener?query=${encodeURIComponent(finalQuery)}`);
      if (!res.ok) {
        throw new Error("Failed to run screener query.");
      }
      const data = await res.json();
      setResults(data.results || []);
    } catch (err: any) {
      setError(err.message || "An error occurred while screening.");
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
          <Sparkles className="w-6 h-6 text-accent" />
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-foreground font-mono">
            AI Natural Language Screener
          </h1>
        </div>
        <p className="text-xs text-neutral/70 font-medium">
          Screen the database using conversational queries. The NLP engine translates your intent into financial filter metrics.
        </p>
      </div>

      {/* Search Input Card */}
      <div className="glass-card p-6 space-y-4">
        <form onSubmit={handleScreen} className="flex gap-2">
          <div className="flex-1 flex items-center bg-black/40 border border-white/5 focus-within:border-accent/40 rounded-xl px-4 py-2.5 transition-all">
            <Search className="w-5 h-5 text-neutral mr-2.5 shrink-0" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. 'find undervalued tech stocks' or 'stocks with high F-Score and Z-Score'"
              className="w-full bg-transparent outline-none text-sm text-foreground placeholder-neutral/50 font-medium"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2.5 bg-accent hover:opacity-90 disabled:opacity-50 text-white font-bold text-sm rounded-xl flex items-center gap-2 cursor-pointer transition-all"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Filter className="w-4 h-4" />}
            <span>Screen</span>
          </button>
        </form>

        {/* Preset Suggestions */}
        <div className="space-y-2">
          <span className="text-[10px] text-neutral font-bold uppercase tracking-wider block">Suggested Queries:</span>
          <div className="flex flex-wrap gap-2">
            {presetQueries.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => handleScreen(undefined, q)}
                className="px-3 py-1.5 bg-white/[0.02] hover:bg-white/[0.06] border border-white/5 hover:border-white/10 rounded-lg text-[10px] font-mono font-bold text-neutral hover:text-foreground cursor-pointer transition-colors"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Screen Results */}
      {searched && (
        <div className="space-y-4">
          <h3 className="text-xs font-bold text-neutral uppercase tracking-wider">
            Results ({results.length} companies matched)
          </h3>

          {loading ? (
            <div className="glass-card p-12 flex flex-col items-center justify-center gap-4 text-center">
              <Loader2 className="w-8 h-8 animate-spin text-accent" />
              <p className="text-xs font-bold text-neutral">Processing natural language parameters...</p>
            </div>
          ) : error ? (
            <div className="glass-card p-6 border border-rose-500/20 text-rose-400 text-xs">
              {error}
            </div>
          ) : results.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {results.map((comp) => (
                <div
                  key={comp.id}
                  onClick={() => router.push(`/company/${comp.ticker}`)}
                  className="glass-card p-5 border border-white/5 hover:border-accent/40 cursor-pointer hover:scale-[1.01] transition-all space-y-4 relative overflow-hidden group"
                >
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-foreground font-mono">{comp.name}</h4>
                        <span className="px-1.5 py-0.5 text-[8px] font-bold font-mono rounded bg-white/[0.04] text-neutral">
                          {comp.ticker}
                        </span>
                      </div>
                      <p className="text-[10px] text-neutral/70">{comp.sector} · {comp.industry}</p>
                    </div>
                    
                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                      comp.recommendation === "BUY" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" :
                      comp.recommendation === "SELL" ? "bg-rose-500/10 text-rose-400 border border-rose-500/20" :
                      "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                    }`}>
                      {comp.recommendation}
                    </span>
                  </div>

                  <div className="grid grid-cols-4 gap-2 text-center text-[10px] font-mono border-t border-white/5 pt-3">
                    <div className="bg-black/20 p-2 rounded-lg">
                      <span className="text-neutral/70 block mb-0.5">Price</span>
                      <span className="font-bold text-foreground">${comp.current_price.toFixed(2)}</span>
                    </div>
                    <div className="bg-black/20 p-2 rounded-lg">
                      <span className="text-neutral/70 block mb-0.5">F-Score</span>
                      <span className="font-bold text-foreground">{comp.f_score}/9</span>
                    </div>
                    <div className="bg-black/20 p-2 rounded-lg">
                      <span className="text-neutral/70 block mb-0.5">Z-Score</span>
                      <span className="font-bold text-foreground">{comp.z_score.toFixed(2)}</span>
                    </div>
                    <div className="bg-black/20 p-2 rounded-lg">
                      <span className="text-neutral/70 block mb-0.5">DCF Upside</span>
                      <span className={`font-bold ${comp.upside_pct >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                        {comp.upside_pct >= 0 ? "+" : ""}{comp.upside_pct.toFixed(1)}%
                      </span>
                    </div>
                  </div>

                  <div className="absolute right-4 bottom-4 text-neutral opacity-0 group-hover:opacity-100 transition-opacity">
                    <ChevronRight className="w-4 h-4 text-accent" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="glass-card p-12 text-center text-neutral text-xs">
              No resolved companies match your screening criteria.
            </div>
          )}
        </div>
      )}
    </main>
  );
}
