"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2 } from "lucide-react";
import { StockSearchInput } from "@/components/inputs/StockSearchInput";

export default function CompanyResearchSearchPage() {
  const router = useRouter();
  const [ticker, setTicker] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const triggerAnalysis = async (symbol: string) => {
    setLoading(true);
    setError("");

    try {
      const res = await fetch("https://backend-gamma-mocha-34.vercel.app/api/v1/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: symbol }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || "Failed to start analysis");
      }

      const data = await res.json();
      router.push(`/company/${data.company.ticker}?analysis_id=${data.analysis_id}`);
    } catch (err: any) {
      setError(err.message || "Failed to initialize company analysis.");
      setLoading(false);
    }
  };

  return (
    <main className="flex-1 flex flex-col items-center justify-center p-4 md:p-8 relative min-h-screen">
      {/* Background ambient glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] md:w-[600px] h-[350px] md:h-[600px] bg-accent/15 rounded-full blur-[100px] -z-10 pointer-events-none" />

      <div className="w-full max-w-xl text-center space-y-8 animate-float">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass-card border border-white/5 text-xs text-accent">
          <Search className="w-3.5 h-3.5 animate-pulse" />
          <span>Company Research Station</span>
        </div>

        {/* Title */}
        <div className="space-y-3">
          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-foreground font-mono">
            RESEARCH <span className="bg-gradient-to-r from-accent to-primary bg-clip-text text-transparent">CENTER</span>
          </h1>
          <p className="text-xs text-neutral max-w-md mx-auto">
            Input a stock symbol or name to query the multi-agent consensus network.
          </p>
        </div>

        {/* Search Input Card */}
        <div className="glass-card p-6 space-y-4 text-left border border-white/10 relative z-50">
          <h3 className="text-xs font-bold text-neutral uppercase tracking-wider">Search Target Equity</h3>
          
          <div className="flex flex-col gap-4">
            <div className="flex gap-2 relative z-50">
              <StockSearchInput
                value={ticker}
                onChange={setTicker}
                onSelect={(symbol) => {
                  setTicker(symbol);
                  triggerAnalysis(symbol);
                }}
                placeholder="e.g. AAPL, MSFT, RELIANCE.NS"
              />
              <button
                onClick={() => ticker.trim() && triggerAnalysis(ticker.trim())}
                disabled={loading || !ticker.trim()}
                className="px-5 py-3 bg-gradient-to-r from-accent to-primary hover:opacity-90 disabled:opacity-50 text-white font-bold text-xs rounded-xl transition-all shadow-lg flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                {loading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <span>Analyze</span>
                )}
              </button>
            </div>
            
            {error && (
              <p className="text-bearish text-xs font-semibold bg-bearish/10 border border-bearish/20 p-3 rounded-xl">
                {error}
              </p>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
