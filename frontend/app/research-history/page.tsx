"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { 
  History, Loader2, RefreshCw, Trash2, ArrowRight, ShieldAlert,
  Award, TrendingUp
} from "lucide-react";

export default function ResearchHistoryPage() {
  const router = useRouter();
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [historyList, setHistoryList] = useState<any[]>([]);

  // Initialize user_id
  useEffect(() => {
    let uId = localStorage.getItem("investorgpt_user_id");
    if (!uId) {
      uId = "usr_" + Math.random().toString(36).substring(2, 15);
      localStorage.setItem("investorgpt_user_id", uId);
    }
    setUserId(uId);
  }, []);

  const fetchHistory = async () => {
    if (!userId) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/v1/research-history?user_id=${userId}`);
      if (!res.ok) {
        throw new Error("Failed to retrieve research logs.");
      }
      const json = await res.json();
      setHistoryList(json.history || []);
    } catch (err: any) {
      setError(err.message || "Failed to load history list.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userId) {
      fetchHistory();
    }
  }, [userId]);

  const handleDeleteHistory = async (analysisId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this research record?")) return;
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/v1/research-history/${analysisId}`, {
        method: "DELETE"
      });
      if (res.ok) {
        fetchHistory();
      }
    } catch (err) {
      console.error("Delete failed:", err);
    }
  };

  const handleOpenDashboard = (item: any) => {
    router.push(`/company/${item.ticker}?analysis_id=${item.analysis_id}`);
  };

  return (
    <main className="flex-1 flex flex-col p-4 md:p-8 max-w-7xl mx-auto w-full gap-8 relative min-h-screen">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] bg-primary/10 rounded-full blur-[100px] -z-10 pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-white/5 pb-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <History className="w-6 h-6 text-accent" />
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-foreground font-mono">
              Research History Logs
            </h1>
          </div>
          <p className="text-xs text-neutral/70 font-medium">
            Review previous institutional-grade stock analysis reports and recommendations.
          </p>
        </div>
      </div>

      {error && (
        <div className="glass-panel p-4 rounded-xl border border-bearish/20 bg-bearish/5 text-bearish text-xs flex items-center gap-2">
          <ShieldAlert className="w-4.5 h-4.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-2 justify-center py-24 text-xs font-bold text-neutral">
          <RefreshCw className="w-4 h-4 animate-spin text-accent" />
          <span>Loading analysis logs...</span>
        </div>
      )}

      {!loading && historyList.length > 0 && (
        <div className="glass-card p-6 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-[10px] font-mono text-left border-collapse">
              <thead>
                <tr className="border-b border-white/10 text-neutral">
                  <th className="py-2 pr-4 font-bold font-sans">Ticker</th>
                  <th className="py-2 px-2 font-bold font-sans">Company</th>
                  <th className="py-2 px-2">Exchange</th>
                  <th className="py-2 px-2 text-center">Recommendation</th>
                  <th className="py-2 px-2 text-center">Confidence</th>
                  <th className="py-2 px-2">Analyzed On</th>
                  <th className="py-2 pl-4 text-center font-bold font-sans">Actions</th>
                </tr>
              </thead>
              <tbody>
                {historyList.map((item) => {
                  const dateStr = new Date(item.created_at).toLocaleString();
                  return (
                    <tr 
                      key={item.analysis_id} 
                      onClick={() => handleOpenDashboard(item)}
                      className="border-b border-white/5 hover:bg-white/[0.02] cursor-pointer transition-colors"
                    >
                      <td className="py-4 pr-4 font-bold text-accent font-mono uppercase">{item.ticker}</td>
                      <td className="py-4 px-2 font-bold text-foreground font-sans">{item.company_name}</td>
                      <td className="py-4 px-2 text-neutral/70">{item.exchange}</td>
                      <td className="py-4 px-2 text-center">
                        <span className={`px-2 py-0.5 rounded text-[8px] font-extrabold uppercase ${
                          item.recommendation.includes("BUY") ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" :
                          item.recommendation.includes("SELL") ? "bg-rose-500/10 text-rose-400 border border-rose-500/20" :
                          "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                        }`}>
                          {item.recommendation}
                        </span>
                      </td>
                      <td className="py-4 px-2 text-center font-bold">{(item.confidence * 100).toFixed(0)}%</td>
                      <td className="py-4 px-2 text-neutral/50">{dateStr}</td>
                      <td className="py-4 pl-4 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleOpenDashboard(item)}
                            className="p-1 border border-white/5 hover:border-accent/40 rounded text-neutral hover:text-accent transition-all cursor-pointer"
                            title="Open Report Dashboard"
                          >
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => handleDeleteHistory(item.analysis_id, e)}
                            className="p-1 border border-white/5 hover:border-bearish/40 rounded text-neutral/40 hover:text-bearish transition-all cursor-pointer"
                            title="Delete Analysis Record"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && historyList.length === 0 && (
        <div className="glass-card p-12 text-center text-neutral space-y-4">
          <p className="text-xs font-bold font-sans">No research records found in logs history.</p>
          <button
            onClick={() => router.push("/")}
            className="px-4 py-2 border border-white/10 hover:border-accent/40 rounded-xl text-xs font-bold cursor-pointer transition-colors inline-block"
          >
            Start your first stock research analysis
          </button>
        </div>
      )}
    </main>
  );
}
