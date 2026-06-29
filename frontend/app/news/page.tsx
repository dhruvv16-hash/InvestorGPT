"use client";

import { useEffect, useState } from "react";
import { 
  Newspaper, Loader2, RefreshCw, AlertCircle, TrendingUp, 
  TrendingDown, Minus, ExternalLink
} from "lucide-react";

export default function MarketNewsPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [articles, setArticles] = useState<any[]>([]);
  const [filter, setFilter] = useState("ALL"); // ALL, BULLISH, BEARISH, NEUTRAL

  const fetchNews = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("http://127.0.0.1:8000/api/v1/news");
      if (!res.ok) {
        throw new Error("Could not retrieve market news articles.");
      }
      const json = await res.json();
      setArticles(json.news || []);
    } catch (err: any) {
      setError(err.message || "Failed to load market news.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNews();
  }, []);

  const filteredArticles = articles.filter(a => {
    if (filter === "ALL") return true;
    return a.sentiment === filter;
  });

  return (
    <main className="flex-1 flex flex-col p-4 md:p-8 max-w-5xl mx-auto w-full gap-8 relative min-h-screen">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] bg-primary/10 rounded-full blur-[100px] -z-10 pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-white/5 pb-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Newspaper className="w-6 h-6 text-accent" />
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-foreground font-mono">
              Market News Feed
            </h1>
          </div>
          <p className="text-xs text-neutral/70 font-medium">
            Live financial headlines with automated rule-based sentiment tags.
          </p>
        </div>

        {/* Filter Controls */}
        <div className="flex items-center gap-1.5 bg-white/[0.02] border border-white/5 p-1 rounded-xl text-[10px] font-bold font-mono">
          {["ALL", "BULLISH", "BEARISH", "NEUTRAL"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-2.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                filter === f 
                  ? "bg-accent text-white" 
                  : "text-neutral/60 hover:text-foreground"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="glass-panel p-4 rounded-xl border border-bearish/20 bg-bearish/5 text-bearish text-xs flex items-center gap-2">
          <AlertCircle className="w-4.5 h-4.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-2 justify-center py-24 text-xs font-bold text-neutral">
          <RefreshCw className="w-4 h-4 animate-spin text-accent" />
          <span>Fetching market news...</span>
        </div>
      )}

      {!loading && (
        <div className="flex flex-col gap-4">
          {filteredArticles.map((art, idx) => {
            const dateStr = new Date(art.timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + " - " + new Date(art.timestamp * 1000).toLocaleDateString();
            
            return (
              <div 
                key={idx} 
                className="glass-card p-5 border-l-4 transition-all hover:bg-white/[0.02] flex flex-col md:flex-row md:items-center justify-between gap-4"
                style={{ 
                  borderLeftColor: 
                    art.sentiment === "BULLISH" ? "#10b981" : 
                    art.sentiment === "BEARISH" ? "#ec4899" : "#64748b" 
                }}
              >
                <div className="space-y-2 max-w-[85%]">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2 py-0.5 rounded bg-white/[0.04] text-[8px] font-mono font-bold text-neutral">
                      {art.ticker}
                    </span>
                    <span className="text-[10px] text-neutral/50 font-mono">
                      {art.publisher} · {dateStr}
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-foreground leading-snug">
                    {art.title}
                  </h3>
                </div>

                <div className="flex items-center gap-4 shrink-0">
                  {/* Sentiment Badge */}
                  <span className={`px-2 py-1 rounded text-[8px] font-extrabold uppercase flex items-center gap-1 ${
                    art.sentiment === "BULLISH" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" :
                    art.sentiment === "BEARISH" ? "bg-rose-500/10 text-rose-400 border border-rose-500/20" :
                    "bg-white/[0.02] border border-white/5 text-neutral/50"
                  }`}>
                    {art.sentiment === "BULLISH" ? <TrendingUp className="w-3 h-3" /> :
                     art.sentiment === "BEARISH" ? <TrendingDown className="w-3 h-3" /> :
                     <Minus className="w-3 h-3" />}
                    <span>{art.sentiment}</span>
                  </span>

                  <a
                    href={art.link}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2 border border-white/5 hover:border-accent/40 rounded-xl text-neutral/50 hover:text-accent transition-colors"
                  >
                    <ExternalLink className="w-4.5 h-4.5" />
                  </a>
                </div>
              </div>
            );
          })}

          {filteredArticles.length === 0 && (
            <div className="glass-card p-12 text-center text-neutral text-xs font-bold font-sans">
              No news articles found matching filter context.
            </div>
          )}
        </div>
      )}
    </main>
  );
}
