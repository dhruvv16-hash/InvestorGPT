"use client";

import { useEffect, useState } from "react";
import { 
  Settings, Save, Trash2, Loader2, Sparkles, RefreshCw, 
  CheckCircle2, AlertCircle
} from "lucide-react";

export default function SettingsPage() {
  const [ollamaUrl, setOllamaUrl] = useState("http://localhost:11434");
  const [defaultWacc, setDefaultWacc] = useState(9.0);
  const [defaultTerminalGrowth, setDefaultTerminalGrowth] = useState(2.5);
  const [currencyCode, setCurrencyCode] = useState("USD");
  
  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");
  const [clearStatus, setClearStatus] = useState("");

  // Load preferences from localStorage on mount
  useEffect(() => {
    const savedOllama = localStorage.getItem("settings_ollama_url");
    if (savedOllama) setOllamaUrl(savedOllama);

    const savedWacc = localStorage.getItem("settings_default_wacc");
    if (savedWacc) setDefaultWacc(parseFloat(savedWacc));

    const savedTg = localStorage.getItem("settings_default_tg");
    if (savedTg) setDefaultTerminalGrowth(parseFloat(savedTg));

    const savedCurr = localStorage.getItem("settings_default_currency");
    if (savedCurr) setCurrencyCode(savedCurr);
  }, []);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaveStatus("");
    
    localStorage.setItem("settings_ollama_url", ollamaUrl);
    localStorage.setItem("settings_default_wacc", String(defaultWacc));
    localStorage.setItem("settings_default_tg", String(defaultTerminalGrowth));
    localStorage.setItem("settings_default_currency", currencyCode);
    
    setSaveStatus("Settings saved successfully!");
    setTimeout(() => setSaveStatus(""), 3000);
  };

  const handleClearCache = async () => {
    if (!confirm("Are you sure you want to clear the platform search history cache and trending stats? This cannot be undone.")) return;
    setLoading(true);
    setClearStatus("");
    try {
      const res = await fetch("http://127.0.0.1:8000/api/v1/settings/clear-cache", {
        method: "POST"
      });
      if (res.ok) {
        setClearStatus("Database cache and search logs cleared successfully.");
      } else {
        setClearStatus("Failed to clear database cache.");
      }
    } catch (err) {
      setClearStatus("Error connecting to backend server.");
    } finally {
      setLoading(false);
      setTimeout(() => setClearStatus(""), 4000);
    }
  };

  return (
    <main className="flex-1 flex flex-col p-4 md:p-8 max-w-3xl mx-auto w-full gap-8 relative min-h-screen">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] bg-primary/10 rounded-full blur-[100px] -z-10 pointer-events-none" />

      {/* Header */}
      <div className="flex items-center gap-2 border-b border-white/5 pb-6">
        <Settings className="w-6 h-6 text-accent" />
        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-foreground font-mono">
          Platform Configuration Settings
        </h1>
      </div>

      <div className="grid grid-cols-1 gap-8">
        
        {/* Form panel */}
        <form onSubmit={handleSave} className="glass-card p-6 space-y-6">
          <div className="border-b border-white/5 pb-3">
            <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">AI Copilot Parameters</h3>
            <p className="text-[10px] text-neutral mt-0.5 font-sans leading-none">Configure local Ollama execution models.</p>
          </div>

          <div className="space-y-4 text-xs">
            <div className="space-y-1">
              <label className="text-neutral font-semibold">Ollama API Base URL</label>
              <input
                type="text"
                value={ollamaUrl}
                onChange={(e) => setOllamaUrl(e.target.value)}
                placeholder="e.g. http://localhost:11434"
                className="w-full px-3 py-2 bg-black/40 border border-white/5 focus:border-accent/40 rounded-xl outline-none text-foreground font-mono"
              />
            </div>
            
            <div className="border-b border-white/5 pb-3 pt-4">
              <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">Default Model Assumptions</h3>
              <p className="text-[10px] text-neutral mt-0.5 font-sans leading-none">Global defaults for calculated baseline valuation runs.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-neutral font-semibold">Baseline WACC (%)</label>
                <input
                  type="number"
                  step="0.1"
                  min="3.0"
                  max="25.0"
                  value={defaultWacc}
                  onChange={(e) => setDefaultWacc(parseFloat(e.target.value))}
                  className="w-full px-3 py-2 bg-black/40 border border-white/5 focus:border-accent/40 rounded-xl outline-none text-foreground font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-neutral font-semibold">Terminal Growth Rate (%)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0.0"
                  max="8.0"
                  value={defaultTerminalGrowth}
                  onChange={(e) => setDefaultTerminalGrowth(parseFloat(e.target.value))}
                  className="w-full px-3 py-2 bg-black/40 border border-white/5 focus:border-accent/40 rounded-xl outline-none text-foreground font-mono"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-white/5 text-xs font-bold font-mono">
            {saveStatus && (
              <span className="text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" />
                <span>{saveStatus}</span>
              </span>
            )}
            <button
              type="submit"
              className="px-6 py-2.5 bg-accent hover:opacity-90 text-white rounded-xl cursor-pointer ml-auto flex items-center gap-2 shadow-lg"
            >
              <Save className="w-4 h-4" />
              <span>Save Configuration</span>
            </button>
          </div>
        </form>

        {/* Database Utilities Panel */}
        <div className="glass-card p-6 space-y-6">
          <div className="border-b border-white/5 pb-3">
            <h3 className="text-xs font-bold text-foreground uppercase tracking-wider text-rose-400">Database Utilities</h3>
            <p className="text-[10px] text-neutral mt-0.5 font-sans leading-none">Administrative cache operations and database resets.</p>
          </div>

          <div className="space-y-4 text-xs leading-relaxed text-neutral">
            <p>
              Clearing the cache deletes all global stock click counters, flame trending suggestions metrics, and saved recent user queries in SQLite. 
              This is helpful to rebuild recommendations statistics from scratch.
            </p>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-white/5 text-xs font-bold font-mono">
            {clearStatus && (
              <span className={`flex items-center gap-1 ${clearStatus.includes("error") || clearStatus.includes("Failed") ? "text-rose-400" : "text-emerald-400"}`}>
                <AlertCircle className="w-4 h-4" />
                <span>{clearStatus}</span>
              </span>
            )}
            
            <button
              onClick={handleClearCache}
              disabled={loading}
              className="px-6 py-2.5 bg-rose-600/10 hover:bg-rose-600/25 border border-rose-600/20 hover:border-rose-600 text-rose-400 rounded-xl cursor-pointer ml-auto flex items-center gap-2 transition-all disabled:opacity-50"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Clearing...</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  <span>Clear Search Cache</span>
                </>
              )}
            </button>
          </div>
        </div>
        
      </div>
    </main>
  );
}
