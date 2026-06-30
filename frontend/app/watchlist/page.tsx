"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, Sparkles, Loader2, Plus, Trash2, ShieldAlert, AlertTriangle } from "lucide-react";
import { useRouter } from "next/navigation";
import { StockSearchInput } from "@/components/inputs/StockSearchInput";

export default function WatchlistPage() {
  const router = useRouter();
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [watchlist, setWatchlist] = useState<any[]>([]);

  // Form State
  const [showAddModal, setShowAddModal] = useState(false);
  const [ticker, setTicker] = useState("");
  const [triggerType, setTriggerType] = useState("PRICE_BELOW");
  const [threshold, setThreshold] = useState("");
  const [formLoading, setFormLoading] = useState(false);

  // Initialize User ID
  useEffect(() => {
    let uId = localStorage.getItem("investorgpt_user_id");
    if (!uId) {
      uId = "usr_" + Math.random().toString(36).substring(2, 15);
      localStorage.setItem("investorgpt_user_id", uId);
    }
    setUserId(uId);
  }, []);

  const fetchWatchlist = async () => {
    if (!userId) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`https://backend-gamma-mocha-34.vercel.app/api/v1/watchlist?user_id=${userId}`);
      if (!res.ok) {
        throw new Error("Failed to load watchlist intelligence.");
      }
      const data = await res.json();
      setWatchlist(data.watchlist || []);
    } catch (err: any) {
      setError(err.message || "Failed to load watchlist.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userId) {
      fetchWatchlist();
    }
  }, [userId]);

  const handleAddTrigger = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticker.trim() || !threshold || parseFloat(threshold) <= 0) return;

    setFormLoading(true);
    try {
      const res = await fetch("https://backend-gamma-mocha-34.vercel.app/api/v1/watchlist/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          ticker: ticker.trim().toUpperCase(),
          trigger_type: triggerType,
          threshold: parseFloat(threshold)
        })
      });
      if (res.ok) {
        setShowAddModal(false);
        setTicker("");
        setThreshold("");
        fetchWatchlist();
      }
    } catch (err) {
      console.error("Failed to add trigger:", err);
    } finally {
      setFormLoading(false);
    }
  };

  const handleRemoveTrigger = async (triggerId: string) => {
    if (!confirm("Are you sure you want to remove this alert trigger?")) return;
    try {
      const res = await fetch(`https://backend-gamma-mocha-34.vercel.app/api/v1/watchlist/remove/${triggerId}`, {
        method: "DELETE"
      });
      if (res.ok) {
        fetchWatchlist();
      }
    } catch (err) {
      console.error("Remove trigger failed:", err);
    }
  };

  return (
    <main className="flex-1 flex flex-col p-4 md:p-8 max-w-7xl mx-auto w-full gap-8 relative min-h-screen">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] bg-primary/10 rounded-full blur-[100px] -z-10 pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-white/5 pb-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Bell className="w-6 h-6 text-accent" />
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-foreground font-mono">
              Watchlist Intelligence
            </h1>
          </div>
          <p className="text-xs text-neutral/70 font-medium">
            Monitor stock price gaps, DCF disparities, and momentum dips with automated calculation triggers.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 bg-accent hover:opacity-90 text-white font-bold text-xs rounded-xl flex items-center gap-2 cursor-pointer transition-all w-full md:w-auto justify-center"
        >
          <Plus className="w-4 h-4" />
          <span>Add Custom Alert</span>
        </button>
      </div>

      {error && (
        <div className="glass-panel p-4 rounded-xl border border-bearish/20 bg-bearish/5 text-bearish text-xs">
          {error}
        </div>
      )}

      {/* Watchlist Triggers Grid */}
      {loading ? (
        <div className="glass-card p-12 flex flex-col items-center justify-center gap-4 text-center">
          <Loader2 className="w-8 h-8 animate-spin text-accent" />
          <p className="text-xs font-bold text-neutral">Loading watchlist signals and evaluating trigger rules...</p>
        </div>
      ) : watchlist.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {watchlist.map((item) => {
            const triggerLabels: Record<string, string> = {
              PRICE_BELOW: "Price Drops Below",
              PRICE_ABOVE: "Price Exceeds",
              DCF_GAP_PCT: "DCF Safety Gap ≥",
              RSI_BELOW: "RSI Momentum Below",
              REVENUE_CHANGED: "Q1 Revenue Forecast Shift ≥",
              RISK_INCREASED: "Altman Z-Score <",
              CEO_RESIGNED: "CEO Resigned Watch (Threshold)",
              MOAT_IMPROVED: "Competitive Moat Score ≥"
            };

            const triggerUnits: Record<string, string> = {
              PRICE_BELOW: `$${item.threshold}`,
              PRICE_ABOVE: `$${item.threshold}`,
              DCF_GAP_PCT: `${item.threshold}%`,
              RSI_BELOW: `${item.threshold}`,
              REVENUE_CHANGED: `${item.threshold}%`,
              RISK_INCREASED: `${item.threshold}`,
              CEO_RESIGNED: `${item.threshold}`,
              MOAT_IMPROVED: `${item.threshold}`
            };

            return (
              <div
                key={item.id}
                className={`glass-card p-5 border relative overflow-hidden transition-all flex flex-col justify-between gap-4 ${
                  item.is_fired 
                    ? "border-amber-500/30 bg-amber-500/[0.02]" 
                    : "border-white/5 hover:border-white/10"
                }`}
              >
                {/* Status Indicator */}
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <span
                      onClick={() => router.push(`/company/${item.ticker}`)}
                      className="text-sm font-extrabold font-mono text-accent hover:underline cursor-pointer"
                    >
                      {item.ticker}
                    </span>
                    <p className="text-[10px] text-neutral">
                      Rule: {triggerLabels[item.trigger_type] || item.trigger_type} <strong>{triggerUnits[item.trigger_type]}</strong>
                    </p>
                  </div>

                  <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase flex items-center gap-1 ${
                    item.is_fired 
                      ? "bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse" 
                      : "bg-white/5 text-neutral"
                  }`}>
                    {item.is_fired ? (
                      <>
                        <ShieldAlert className="w-2.5 h-2.5" />
                        Fired
                      </>
                    ) : "Active"}
                  </span>
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-3 gap-2 text-center text-[9px] font-mono border-t border-white/5 pt-3">
                  <div>
                    <span className="text-neutral/70 block mb-0.5">Price</span>
                    <span className="font-bold text-foreground">${item.current_price.toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-neutral/70 block mb-0.5">RSI</span>
                    <span className="font-bold text-foreground">{item.rsi.toFixed(1)}</span>
                  </div>
                  <div>
                    <span className="text-neutral/70 block mb-0.5">DCF Fair</span>
                    <span className="font-bold text-foreground">${item.dcf_value.toFixed(2)}</span>
                  </div>
                </div>

                {/* Footer buttons */}
                <div className="flex justify-between items-center pt-2">
                  <span className="text-[8px] text-neutral/50 font-mono">Added {new Date(item.created_at).toLocaleDateString()}</span>
                  <button
                    onClick={() => handleRemoveTrigger(item.id)}
                    className="text-neutral/40 hover:text-rose-400 p-1 cursor-pointer transition-colors"
                    title="Delete trigger"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="glass-card p-12 text-center text-neutral space-y-4">
          <BellOff className="w-8 h-8 text-neutral/35 mx-auto" />
          <p className="text-xs font-bold font-sans">No watchlist alert triggers defined yet.</p>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 border border-white/10 hover:border-accent/40 rounded-xl text-xs font-bold cursor-pointer transition-colors inline-block"
          >
            Create your first trigger alert
          </button>
        </div>
      )}

      {/* Add Alert Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <form onSubmit={handleAddTrigger} className="glass-panel max-w-sm w-full p-6 border border-white/10 rounded-2xl space-y-4">
            <h3 className="text-sm font-bold text-foreground">Create Watchlist Trigger</h3>
            
            <div className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="text-neutral font-semibold">Stock Ticker Symbol</label>
                <StockSearchInput
                  value={ticker}
                  onChange={setTicker}
                  onSelect={(sym) => setTicker(sym.toUpperCase())}
                  placeholder="e.g. AAPL, NVDA"
                />
              </div>

              <div className="space-y-1">
                <label className="text-neutral font-semibold">Trigger Rule Metric</label>
                <select
                  value={triggerType}
                  onChange={(e) => setTriggerType(e.target.value)}
                  className="w-full px-3 py-2 bg-black/40 border border-white/5 focus:border-accent/40 rounded-xl outline-none text-foreground"
                >
                  <option value="PRICE_BELOW">Price Falls Below ($)</option>
                  <option value="PRICE_ABOVE">Price Exceeds ($)</option>
                  <option value="DCF_GAP_PCT">Price is below DCF by % (Margin of Safety)</option>
                  <option value="RSI_BELOW">RSI Oversold Momentum drops below</option>
                  <option value="REVENUE_CHANGED">Q1 Projected Revenue Change &gt;= (%)</option>
                  <option value="RISK_INCREASED">Altman Z-Score drops below</option>
                  <option value="CEO_RESIGNED">CEO Resignation Watch (Threshold: 1.0)</option>
                  <option value="MOAT_IMPROVED">Competitive Moat Score &gt;=</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-neutral font-semibold">Threshold Value</label>
                <input
                  type="number"
                  required
                  step="any"
                  value={threshold}
                  onChange={(e) => setThreshold(e.target.value)}
                  placeholder="e.g. 150.0 or 15%"
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
                {formLoading ? "Saving..." : "Create Trigger"}
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}
