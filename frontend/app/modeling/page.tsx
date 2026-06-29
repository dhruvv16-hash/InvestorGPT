"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { StockSearchInput } from "@/components/inputs/StockSearchInput";
import { 
  ArrowLeft, BarChart3, Download, Save, Sparkles, MessageSquare, 
  Scale, HelpCircle, Activity, LayoutDashboard, Sliders, FileText, 
  Percent, Info, Flame, AlertCircle, RefreshCw, Layers, History,
  TrendingUp, ShieldAlert, Award, CheckCircle
} from "lucide-react";


const getCurrencySymbol = (currency?: string) => {
  if (!currency) return "$";
  const upper = currency.toUpperCase();
  if (upper === "INR") return "₹";
  if (upper === "EUR") return "€";
  if (upper === "GBP") return "£";
  if (upper === "JPY") return "¥";
  return "$";
};

function ModelingLabContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tickerFromUrl = searchParams.get("ticker") || "";

  // State variables
  const [ticker, setTicker] = useState(tickerFromUrl.toUpperCase());
  const [searchQuery, setSearchQuery] = useState(tickerFromUrl.toUpperCase());
  const [userId, setUserId] = useState("");
  const [activeTab, setActiveTab] = useState("dashboard"); // dashboard, forecast, statements, historical, dcf, relative, reverse_dcf, sensitivity, monte_carlo, comparison, chat
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  
  const [modelData, setModelData] = useState<any>(null);
  const [workspaceModels, setWorkspaceModels] = useState<any[]>([]);
  const [selectedModelId, setSelectedModelId] = useState("default");
  const [comparisonModelId, setComparisonModelId] = useState("");
  const [comparisonModelData, setComparisonModelData] = useState<any>(null);
  
  const currencySymbol = getCurrencySymbol(modelData?.currency || "USD");
  
  // Custom Slider Overrides
  const [revGrowth, setRevGrowth] = useState<number>(0.07);
  const [grossMargin, setGrossMargin] = useState<number>(0.40);
  const [ebitMargin, setEbitMargin] = useState<number>(0.15);
  const [taxRate, setTaxRate] = useState<number>(0.21);
  const [capexPct, setCapexPct] = useState<number>(0.05);
  const [discountRate, setDiscountRate] = useState<number>(0.09);
  const [terminalGrowth, setTerminalGrowth] = useState<number>(0.025);
  const [dilutionRate, setDilutionRate] = useState<number>(0.0);
  const [dividendPayout, setDividendPayout] = useState<number>(0.0);
  
  // Save Model Modal
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveName, setSaveName] = useState("");

  // AI Chat Assistant
  const [chatPrompt, setChatPrompt] = useState("");
  const [chatResponse, setChatResponse] = useState("");
  const [chatLoading, setChatLoading] = useState(false);

  // Macro & Industry & Business states
  const [macroSim, setMacroSim] = useState<any>(null);
  const [interestRateDelta, setInterestRateDelta] = useState<number>(0.0);
  const [oilPrice, setOilPrice] = useState<number>(75.0);
  const [macroLoading, setMacroLoading] = useState(false);
  const [industryData, setIndustryData] = useState<any>(null);
  const [businessData, setBusinessData] = useState<any>(null);
  const [managementData, setManagementData] = useState<any>(null);
  const [capitalData, setCapitalData] = useState<any>(null);
  const [accountingData, setAccountingData] = useState<any>(null);

  // Backtest & Calibration States
  const [backtestData, setBacktestData] = useState<any>(null);
  const [loadingBacktest, setLoadingBacktest] = useState(false);
  const [backtestYear, setBacktestYear] = useState<number>(2022);
  const [calibrationFeedback, setCalibrationFeedback] = useState<any>(null);
  const [loadingCalibration, setLoadingCalibration] = useState(false);
  const [calibratingRecords, setCalibratingRecords] = useState(false);
  const [calibrationStatus, setCalibrationStatus] = useState("");


  // Initialize userId
  useEffect(() => {
    let uId = localStorage.getItem("investorgpt_user_id");
    if (!uId) {
      uId = "usr_" + Math.random().toString(36).substring(2, 15);
      localStorage.setItem("investorgpt_user_id", uId);
    }
    setUserId(uId);
  }, []);

  // Fetch model data from backend
  const fetchModel = async (mId: string, overrides: any = null, isComparison: boolean = false) => {
    if (!isComparison) {
      setLoading(true);
      setError("");
    }
    const uId = userId || localStorage.getItem("investorgpt_user_id") || "guest";
    
    try {
      let url = `https://backend-gamma-mocha-34.vercel.app/api/v1/modeling/model/${mId}?ticker=${ticker}&user_id=${uId}`;
      if (overrides) {
        const queryParams = new URLSearchParams();
        Object.entries(overrides).forEach(([k, v]) => {
          if (v !== undefined && v !== null) {
            queryParams.append(k, String(v));
          }
        });
        url = `${url}&${queryParams.toString()}`;
      }
      
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error("Could not calculate financial model projections.");
      }
      
      const data = await res.json();
      
      if (isComparison) {
        setComparisonModelData(data);
      } else {
        setModelData(data);
        setSelectedModelId(mId);
        
        // Initialize sliders based on active assumptions
        if (data.assumptions) {
          setRevGrowth(data.assumptions.revenue_growth ?? 0.07);
          setGrossMargin(data.assumptions.gross_margin ?? 0.40);
          setEbitMargin(data.assumptions.ebit_margin ?? 0.15);
          setTaxRate(data.assumptions.tax_rate ?? 0.21);
          setCapexPct(data.assumptions.capex_pct ?? 0.05);
          setDiscountRate(data.assumptions.wacc ?? 0.09);
          setTerminalGrowth(data.assumptions.terminal_growth ?? 0.025);
          setDilutionRate(data.assumptions.dilution_rate ?? 0.0);
          setDividendPayout(data.assumptions.dividend_payout ?? 0.0);
        }
      }
    } catch (err: any) {
      if (!isComparison) {
        setError(err.message || "Failed to load model.");
      }
    } finally {
      if (!isComparison) {
        setLoading(false);
      }
    }
  };

  // Fetch workspace models list
  const fetchWorkspace = async () => {
    const uId = userId || localStorage.getItem("investorgpt_user_id") || "guest";
    try {
      const res = await fetch(`https://backend-gamma-mocha-34.vercel.app/api/v1/modeling/workspace?ticker=${ticker}&user_id=${uId}`);
      if (res.ok) {
        const data = await res.json();
        setWorkspaceModels(data.workspace || []);
      }
    } catch (err) {
      console.error("Workspace fetch failed:", err);
    }
  };

  // Fetch Macro Scenario Simulation
  const fetchMacroSimulation = async (irDelta: number, oilPriceVal: number) => {
    setMacroLoading(true);
    try {
      const res = await fetch("https://backend-gamma-mocha-34.vercel.app/api/v1/macro/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticker,
          interest_rate_delta_pct: irDelta,
          oil_price_usd: oilPriceVal
        })
      });
      if (res.ok) {
        const data = await res.json();
        setMacroSim(data);
      }
    } catch (err) {
      console.error("Macro simulation failed:", err);
    } finally {
      setMacroLoading(false);
    }
  };

  // Fetch Industry Intelligence
  const fetchIndustryData = async () => {
    try {
      const res = await fetch(`https://backend-gamma-mocha-34.vercel.app/api/v1/industry/${ticker}`);
      if (res.ok) {
        const data = await res.json();
        setIndustryData(data);
      }
    } catch (err) {
      console.error("Industry fetch failed:", err);
    }
  };

  // Fetch Business Model Details
  const fetchBusinessData = async () => {
    try {
      const res = await fetch(`https://backend-gamma-mocha-34.vercel.app/api/v1/business-model/${ticker}`);
      if (res.ok) {
        const data = await res.json();
        setBusinessData(data);
      }
    } catch (err) {
      console.error("Business model fetch failed:", err);
    }
  };

  // Fetch Management details
  const fetchManagementData = async () => {
    try {
      const res = await fetch(`https://backend-gamma-mocha-34.vercel.app/api/v1/management/${ticker}`);
      if (res.ok) {
        const data = await res.json();
        setManagementData(data);
      }
    } catch (err) {
      console.error("Management fetch failed:", err);
    }
  };

  // Fetch Capital Allocation details
  const fetchCapitalData = async () => {
    try {
      const res = await fetch(`https://backend-gamma-mocha-34.vercel.app/api/v1/capital-allocation/${ticker}`);
      if (res.ok) {
        const data = await res.json();
        setCapitalData(data);
      }
    } catch (err) {
      console.error("Capital allocation fetch failed:", err);
    }
  };

  // Fetch Accounting Quality details
  const fetchAccountingData = async () => {
    try {
      const res = await fetch(`https://backend-gamma-mocha-34.vercel.app/api/v1/earnings-quality/${ticker}`);
      if (res.ok) {
        const data = await res.json();
        setAccountingData(data);
      }
    } catch (err) {
      console.error("Accounting data fetch failed:", err);
    }
  };

  // Fetch Backtest Data
  const fetchBacktestData = async (year: number) => {
    setLoadingBacktest(true);
    try {
      const res = await fetch(`https://backend-gamma-mocha-34.vercel.app/api/v1/backtest/${ticker}?year=${year}`);
      if (res.ok) {
        const data = await res.json();
        setBacktestData(data);
      }
    } catch (err) {
      console.error("Backtest fetch failed:", err);
    } finally {
      setLoadingBacktest(false);
    }
  };

  // Log Valuation to Calibration Database
  const logValuationRecord = async () => {
    if (!modelData) return;
    setCalibrationStatus("Saving prediction record...");
    try {
      const res = await fetch("https://backend-gamma-mocha-34.vercel.app/api/v1/calibration/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticker: ticker,
          user_id: userId,
          predicted_revenue: modelData.three_statement[modelData.proj_years[0]]?.revenue || 0,
          predicted_eps: modelData.three_statement[modelData.proj_years[0]]?.eps || 0,
          predicted_fair_value: modelData.intrinsic_value
        })
      });
      if (res.ok) {
        setCalibrationStatus("Prediction logged! Evaluating errors...");
        await triggerCalibration();
      } else {
        setCalibrationStatus("Failed to log record.");
      }
    } catch (err) {
      console.error("Log valuation failed:", err);
      setCalibrationStatus("Error logging record.");
    }
  };

  // Trigger Calibration
  const triggerCalibration = async () => {
    setCalibratingRecords(true);
    try {
      const res = await fetch(`https://backend-gamma-mocha-34.vercel.app/api/v1/calibration/calibrate?ticker=${ticker}`, { method: "POST" });
      if (res.ok) {
        setCalibrationStatus("Calibration complete.");
        fetchCalibrationFeedback();
      }
    } catch (err) {
      console.error("Calibration run failed:", err);
    } finally {
      setCalibratingRecords(false);
    }
  };

  // Fetch Calibration Feedback Recommendations
  const fetchCalibrationFeedback = async () => {
    setLoadingCalibration(true);
    try {
      const res = await fetch(`https://backend-gamma-mocha-34.vercel.app/api/v1/calibration/feedback?ticker=${ticker}`);
      if (res.ok) {
        const data = await res.json();
        setCalibrationFeedback(data);
      }
    } catch (err) {
      console.error("Calibration feedback fetch failed:", err);
    } finally {
      setLoadingCalibration(false);
    }
  };


  // Trigger loads on mount or ticker change
  useEffect(() => {
    if (userId && ticker) {
      fetchModel("default");
      fetchWorkspace();
      fetchMacroSimulation(0.0, 75.0);
      fetchIndustryData();
      fetchBusinessData();
      fetchManagementData();
      fetchCapitalData();
      fetchAccountingData();
      fetchCalibrationFeedback();
      fetchBacktestData(2022);
    }
  }, [ticker, userId]);

  // Recalculate Model based on active slider positions
  const handleRecalculate = () => {
    const overrides = {
      revenue_growth: revGrowth,
      gross_margin: grossMargin,
      ebit_margin: ebitMargin,
      tax_rate: taxRate,
      capex_pct: capexPct,
      wacc: discountRate,
      terminal_growth: terminalGrowth,
      dilution_rate: dilutionRate,
      dividend_payout: dividendPayout
    };
    fetchModel(selectedModelId, overrides);
  };

  // Select preset scenarios
  const handleLoadScenario = (scenario: string) => {
    let preset: any = {};
    if (scenario === "bull") {
      preset = { 
        revenue_growth: 0.12, 
        gross_margin: 0.45, 
        ebit_margin: 0.18, 
        wacc: 0.08, 
        terminal_growth: 0.03,
        capex_pct: 0.04,
        dilution_rate: -0.01,
        dividend_payout: 0.20
      };
    } else if (scenario === "bear") {
      preset = { 
        revenue_growth: 0.03, 
        gross_margin: 0.35, 
        ebit_margin: 0.10, 
        wacc: 0.10, 
        terminal_growth: 0.02,
        capex_pct: 0.06,
        dilution_rate: 0.02,
        dividend_payout: 0.0
      };
    } else if (scenario === "recession") {
      preset = { 
        revenue_growth: -0.02, 
        gross_margin: 0.33, 
        ebit_margin: 0.08, 
        wacc: 0.11, 
        terminal_growth: 0.015,
        capex_pct: 0.04,
        dilution_rate: 0.03,
        dividend_payout: 0.0
      };
    } else if (scenario === "aiboom") {
      preset = { 
        revenue_growth: 0.22, 
        gross_margin: 0.48, 
        ebit_margin: 0.20, 
        wacc: 0.075, 
        terminal_growth: 0.03,
        capex_pct: 0.05,
        dilution_rate: -0.02,
        dividend_payout: 0.30
      };
    } else {
      fetchModel("default");
      return;
    }
    
    setRevGrowth(preset.revenue_growth);
    setGrossMargin(preset.gross_margin);
    setEbitMargin(preset.ebit_margin);
    setDiscountRate(preset.wacc);
    setTerminalGrowth(preset.terminal_growth);
    setCapexPct(preset.capex_pct);
    setDilutionRate(preset.dilution_rate);
    setDividendPayout(preset.dividend_payout);
    
    fetchModel(selectedModelId, preset);
  };

  // Save active parameters overrides to database
  const handleSaveModel = async () => {
    if (!saveName.trim()) return;
    const uId = userId || localStorage.getItem("investorgpt_user_id") || "guest";
    try {
      const res = await fetch("https://backend-gamma-mocha-34.vercel.app/api/v1/modeling/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticker,
          user_id: uId,
          name: saveName.trim(),
          assumptions: {
            revenue_growth: revGrowth,
            gross_margin: grossMargin,
            ebit_margin: ebitMargin,
            tax_rate: taxRate,
            capex_pct: capexPct,
            wacc: discountRate,
            terminal_growth: terminalGrowth,
            dilution_rate: dilutionRate,
            dividend_payout: dividendPayout
          }
        })
      });
      if (res.ok) {
        setShowSaveModal(false);
        setSaveName("");
        fetchWorkspace();
      }
    } catch (err) {
      console.error("Save model failed:", err);
    }
  };

  // Conversational AI prompt editor
  const handleAIChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatPrompt.trim()) return;
    setChatLoading(true);
    setChatResponse("");
    const uId = userId || localStorage.getItem("investorgpt_user_id") || "guest";
    
    try {
      const res = await fetch("https://backend-gamma-mocha-34.vercel.app/api/v1/modeling/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticker,
          user_id: uId,
          prompt: chatPrompt.trim(),
          current_assumptions: {
            revenue_growth: revGrowth,
            gross_margin: grossMargin,
            ebit_margin: ebitMargin,
            tax_rate: taxRate,
            capex_pct: capexPct,
            wacc: discountRate,
            terminal_growth: terminalGrowth,
            dilution_rate: dilutionRate,
            dividend_payout: dividendPayout,
            dcf_value: modelData?.dcf_value || modelData?.current_price || 0.0
          }
        })
      });
      
      if (res.ok) {
        const data = await res.json();
        setChatResponse(data.explanation || "Model recalculated.");
        if (data.new_assumptions) {
          fetchModel(selectedModelId, data.new_assumptions);
        }
      }
    } catch (err) {
      setChatResponse("AI mapping query failed. Falling back to default limits.");
    } finally {
      setChatLoading(false);
      setChatPrompt("");
    }
  };

  const handleTickerSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setTicker(searchQuery.trim().toUpperCase());
    }
  };

  // SVG Chart rendering helper
  const renderSVGProjections = () => {
    if (!modelData) return null;
    const years = [...modelData.hist_years, ...modelData.proj_years];
    const maxVal = Math.max(...years.map(y => modelData.three_statement[y]?.revenue || 0));
    
    const width = 500;
    const height = 200;
    const padding = 30;
    
    const points = years.map((y, idx) => {
      const val = modelData.three_statement[y]?.revenue || 0;
      const x = padding + (idx * (width - padding * 2) / (years.length - 1));
      const yPos = height - padding - (val * (height - padding * 2) / (maxVal || 1));
      return { x, y: yPos, val, year: y };
    });
    
    const pathD = points.map((p, idx) => `${idx === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
    
    return (
      <svg className="w-full h-48 bg-black/20 rounded-xl" viewBox={`0 0 ${width} ${height}`}>
        <path d={pathD} fill="none" stroke="#3b82f6" strokeWidth="2.5" />
        {points.map((p, idx) => (
          <g key={idx} className="group">
            <circle cx={p.x} cy={p.y} r="4" fill="#3b82f6" className="hover:r-6 cursor-pointer transition-all" />
            <text x={p.x} y={height - 8} fill="#64748b" fontSize="8" textAnchor="middle" fontWeight="bold">
              {p.year}
            </text>
          </g>
        ))}
      </svg>
    );
  };

  // Active models comparison fetcher
  useEffect(() => {
    if (activeTab === "comparison" && comparisonModelId) {
      fetchModel(comparisonModelId, null, true);
    }
  }, [comparisonModelId, activeTab]);

  return (
    <main className="flex-1 flex flex-col p-4 md:p-8 max-w-7xl mx-auto w-full gap-8 relative min-h-screen">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] bg-primary/10 rounded-full blur-[100px] -z-10 pointer-events-none" />

      {/* Header Panel */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-white/5 pb-6">
        <div className="space-y-2">
          <button
            onClick={() => router.push("/")}
            className="flex items-center gap-1.5 text-xs text-neutral hover:text-accent font-semibold transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Search
          </button>
          
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-foreground font-mono flex items-center gap-2">
              <Scale className="w-6 h-6 text-accent" />
              <span>Financial Modeling Lab</span>
            </h1>
            <span className="px-2 py-0.5 rounded bg-accent/10 border border-accent/20 text-accent font-mono text-[10px] font-bold">
              PRO STUDIO
            </span>
          </div>
          <p className="text-xs text-neutral/70 font-medium">
            Test business scenarios, adjust forecast margins, and calculate weighted consensus intrinsic values.
          </p>
        </div>

        {/* Ticker Search Box */}
        {modelData && (
          <div className="w-full md:w-48 shrink-0">
            <StockSearchInput
              value={searchQuery}
              onChange={setSearchQuery}
              onSelect={(sym) => {
                setSearchQuery(sym);
                setTicker(sym.toUpperCase());
              }}
              placeholder="Search symbol..."
            />
          </div>
        )}
      </div>

      {/* Error Banner */}
      {error && (
        <div className="glass-panel p-4 rounded-xl border border-bearish/20 bg-bearish/5 text-bearish text-xs flex items-center gap-2">
          <AlertCircle className="w-4.5 h-4.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Dual Listing Conversion Recommendation Banner */}
      {modelData && (
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
            <div className="glass-panel p-3.5 rounded-xl border border-accent/20 bg-accent/5 text-xs text-foreground/90 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 font-semibold">
              <div className="flex items-center gap-2">
                <Info className="w-4.5 h-4.5 text-accent shrink-0" />
                <span>
                  Viewing listing in <strong className="text-accent">{currencySymbol} ({modelData.currency || "USD"})</strong>. 
                  Would you like to switch to the {matched.label} priced in {matched.symbol} ({matched.currency})?
                </span>
              </div>
              <button
                onClick={() => {
                  setTicker(matched.native);
                  setSearchQuery(matched.native);
                }}
                className="px-3.5 py-1.5 bg-accent hover:opacity-90 text-white rounded-lg font-bold text-[10px] uppercase shrink-0 transition-opacity cursor-pointer"
              >
                Switch Ticker
              </button>
            </div>
          );
        })()
      )}

      {/* Model Summary Bar */}
      {modelData && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="glass-card p-4 flex flex-col justify-between">
            <span className="text-[10px] text-neutral uppercase font-bold tracking-wider">Current Price</span>
            <span className="text-xl font-mono font-bold text-foreground mt-1">{currencySymbol}{modelData.current_price?.toFixed(2)}</span>
          </div>
          <div className="glass-card p-4 flex flex-col justify-between border-l-2 border-accent">
            <span className="text-[10px] text-neutral uppercase font-bold tracking-wider">Consensus Intrinsic Value</span>
            <span className="text-xl font-mono font-bold text-accent mt-1">{currencySymbol}{modelData.intrinsic_value?.toFixed(2)}</span>
          </div>
          <div className="glass-card p-4 flex flex-col justify-between">
            <span className="text-[10px] text-neutral uppercase font-bold tracking-wider">Margin of Safety</span>
            <span className={`text-xl font-mono font-bold mt-1 {currencySymbol}{modelData.margin_of_safety >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
              {(modelData.margin_of_safety * 100).toFixed(1)}%
            </span>
          </div>
          <div className="glass-card p-4 flex flex-col justify-between">
            <span className="text-[10px] text-neutral uppercase font-bold tracking-wider">Expected WACC</span>
            <span className="text-xl font-mono font-bold text-foreground mt-1">{(discountRate * 100).toFixed(1)}%</span>
          </div>
          <div className="glass-card p-4 flex flex-col justify-between col-span-2 md:col-span-1">
            <span className="text-[10px] text-neutral uppercase font-bold tracking-wider">Version Profile</span>
            <div className="flex items-center justify-between mt-1">
              <span className="text-xs font-mono font-bold text-neutral truncate max-w-[80%]">{modelData.model_name}</span>
              <button
                onClick={() => setShowSaveModal(true)}
                className="p-1 hover:text-accent transition-colors cursor-pointer"
                title="Save current model scenario"
              >
                <Save className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Centered Large Search Page */}
      {!modelData && !loading && (
        <div className="flex-1 flex flex-col items-center justify-center max-w-2xl mx-auto w-full py-16 gap-8 text-center animate-fade-in">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/10 border border-accent/20 text-xs text-accent">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Interactive Multi-Scenario Projections</span>
          </div>

          {/* Heading */}
          <div className="space-y-4">
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight bg-gradient-to-r from-white to-neutral bg-clip-text text-transparent font-mono flex items-center justify-center gap-3">
              <Scale className="w-10 h-10 text-accent" />
              <span>Financial Modeling Lab</span>
            </h1>
            <p className="text-sm text-neutral max-w-md mx-auto">
              Construct 10-year forecasts, simulate custom growth rates, run Monte Carlo trials, and export structured Excel & PDF reports.
            </p>
          </div>

          {/* Big Autocomplete Input */}
          <div className="w-full relative group">
            <StockSearchInput
              large={true}
              value={searchQuery}
              onChange={setSearchQuery}
              onSelect={(sym) => {
                setSearchQuery(sym);
                setTicker(sym.toUpperCase());
              }}
              placeholder="Search stock ticker (e.g. RELIANCE.NS, AAPL, NVDA)..."
              className="shadow-2xl"
            />
          </div>

          {/* Quick-links */}
          <div className="space-y-2">
            <span className="text-[10px] text-neutral uppercase font-bold tracking-wider block">Popular Scenarios</span>
            <div className="flex flex-wrap gap-2 justify-center">
              {["NVDA", "AAPL", "MSFT", "RELIANCE.NS", "VEDL.NS"].map((tk) => (
                <button
                  key={tk}
                  onClick={() => {
                    setSearchQuery(tk);
                    setTicker(tk);
                  }}
                  className="px-3 py-1.5 bg-white/[0.02] border border-white/5 hover:border-accent/40 rounded-xl text-xs font-mono font-bold text-neutral hover:text-accent transition-all cursor-pointer"
                >
                  {tk}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Main Workspace Layout */}
      {modelData && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        
        {/* Left Sub-Tab Selector Sidebar */}
        <div className="lg:col-span-1 flex flex-col gap-2">
          <h3 className="text-[10px] font-bold text-neutral uppercase tracking-wider mb-2">Modeling Laboratory</h3>
          {[
            { id: "dashboard", label: "Overview Dashboard", icon: LayoutDashboard },
            { id: "forecast", label: "Forecast Builder", icon: Sliders },
            { id: "statements", label: "Three Statement Model", icon: Layers },
            { id: "historical", label: "Historical Financials", icon: History },
            { id: "dcf", label: "DCF Model Sheet", icon: FileText },
            { id: "relative", label: "Relative Valuation", icon: Scale },
            { id: "reverse_dcf", label: "Reverse DCF Sandbox", icon: Percent },
            { id: "sensitivity", label: "Sensitivity Analysis", icon: Percent },
            { id: "monte_carlo", label: "Monte Carlo Sandbox", icon: Activity },
            { id: "comparison", label: "Model Comparison", icon: Layers },
            { id: "macro", label: "Macro Scenario Sandbox", icon: TrendingUp },
            { id: "industry", label: "Industry Intelligence", icon: Layers },
            { id: "business", label: "Business Model & Moats", icon: Scale },
            { id: "management", label: "Management & Leadership", icon: Sparkles },
            { id: "capital", label: "Capital Allocation", icon: Scale },
            { id: "accounting", label: "Accounting & Fraud Screening", icon: History },
            { id: "audit", label: "Model Health & AI Reviewer", icon: ShieldAlert },
            { id: "calibration", label: "Calibration & Backtest", icon: Activity },
            { id: "chat", label: "AI Modeling Studio", icon: Sparkles }
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full px-4 py-3 rounded-xl border flex items-center gap-3 text-xs font-bold transition-all text-left cursor-pointer {currencySymbol}{
                  activeTab === tab.id
                    ? "bg-accent/10 border-accent/40 text-accent"
                    : "bg-white/[0.01] border-white/5 hover:border-white/10 text-neutral hover:text-foreground"
                }`}
              >
                <Icon className="w-4.5 h-4.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}

          {/* Model Scenario Version List */}
          {workspaceModels.length > 0 && (
            <div className="mt-6 space-y-2 border-t border-white/5 pt-4">
              <h4 className="text-[10px] font-bold text-neutral uppercase tracking-wider flex items-center gap-1">
                <History className="w-3.5 h-3.5" />
                <span>Saved Versions</span>
              </h4>
              <div className="flex flex-col gap-1 max-h-40 overflow-y-auto">
                {workspaceModels.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => fetchModel(m.id)}
                    className={`w-full text-left px-2 py-1.5 rounded hover:bg-white/[0.02] text-[10px] truncate transition-colors cursor-pointer {currencySymbol}{
                      selectedModelId === m.id ? "text-accent font-bold" : "text-neutral/70"
                    }`}
                  >
                    {m.name} <span className="text-[8px] text-neutral/40 font-mono">({new Date(m.timestamp).toLocaleDateString()})</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Export Actions */}
          {modelData && (
            <div className="grid grid-cols-2 gap-2 mt-4">
              <a
                href={`https://backend-gamma-mocha-34.vercel.app/api/v1/modeling/export/${selectedModelId}?ticker=${ticker}&user_id=${userId || "guest"}`}
                download
                className="px-2 py-3 border border-white/10 hover:border-accent/40 rounded-xl text-neutral hover:text-accent text-[10px] font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all bg-white/[0.01]"
              >
                <Download className="w-4 h-4 shrink-0" />
                <span>Export Excel</span>
              </a>
              <a
                href={`https://backend-gamma-mocha-34.vercel.app/api/v1/modeling/export/pdf/${selectedModelId}?ticker=${ticker}&user_id=${userId || "guest"}`}
                target="_blank"
                rel="noreferrer"
                className="px-2 py-3 border border-white/10 hover:border-accent/40 rounded-xl text-neutral hover:text-accent text-[10px] font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all bg-white/[0.01]"
              >
                <Download className="w-4 h-4 shrink-0" />
                <span>Export PDF</span>
              </a>
            </div>
          )}
        </div>

        {/* Right Tab Content Viewer */}
        <div className="lg:col-span-3 space-y-6">
          
          {loading && (
            <div className="flex items-center gap-2 justify-center py-12 text-xs font-bold text-neutral">
              <RefreshCw className="w-4 h-4 animate-spin text-accent" />
              <span>Calculating scenario models...</span>
            </div>
          )}

          {!loading && modelData && (
            <>
              {/* TAB 1: OVERVIEW DASHBOARD */}
              {activeTab === "dashboard" && (
                <div className="space-y-6">
                  {/* Summary row */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="glass-card p-6 space-y-4">
                      <h3 className="text-xs font-bold text-neutral uppercase tracking-wider">Revenue Forecast (10-Year Trend)</h3>
                      {renderSVGProjections()}
                    </div>

                    <div className="glass-card p-6 space-y-4">
                      <h3 className="text-xs font-bold text-neutral uppercase tracking-wider flex items-center gap-1">
                        <Flame className="w-4 h-4 text-orange-500 fill-orange-500" />
                        <span>Scenario Matrix Analysis</span>
                      </h3>
                      <div className="grid grid-cols-2 gap-4 text-xs">
                        <div className="p-3 bg-white/[0.02] border border-white/5 rounded-xl">
                          <span className="font-semibold text-neutral">Bull Case Fair Value</span>
                          <p className="text-lg font-mono font-bold text-emerald-400 mt-1">{currencySymbol}{(modelData.intrinsic_value * 1.25).toFixed(2)}</p>
                        </div>
                        <div className="p-3 bg-white/[0.02] border border-white/5 rounded-xl">
                          <span className="font-semibold text-neutral">Bear Case Fair Value</span>
                          <p className="text-lg font-mono font-bold text-rose-400 mt-1">{currencySymbol}{(modelData.intrinsic_value * 0.72).toFixed(2)}</p>
                        </div>
                        <div className="p-3 bg-white/[0.02] border border-white/5 rounded-xl">
                          <span className="font-semibold text-neutral">Reverse DCF Growth</span>
                          <p className="text-lg font-mono font-bold text-accent mt-1">{(modelData.reverse_dcf_growth * 100).toFixed(1)}%</p>
                        </div>
                        <div className="p-3 bg-white/[0.02] border border-white/5 rounded-xl">
                          <span className="font-semibold text-neutral">Consensus Target</span>
                          <p className="text-lg font-mono font-bold text-foreground mt-1">{currencySymbol}{modelData.intrinsic_value?.toFixed(2)}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Weighted Valuation Consensus Breakdown */}
                  {modelData.consensus_details && (
                    <div className="glass-card p-6 space-y-4">
                      <h3 className="text-xs font-bold text-neutral uppercase tracking-wider">Weighted Intrinsic Value Consensus Breakdown</h3>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs text-left border-collapse font-mono">
                          <thead>
                            <tr className="border-b border-white/5 text-neutral font-semibold">
                              <th className="py-2">Model Type</th>
                              <th className="py-2 text-right">Value</th>
                              <th className="py-2 text-right">Baseline Weight</th>
                              <th className="py-2 text-right text-accent">Active Weight</th>
                            </tr>
                          </thead>
                          <tbody>
                            {Object.entries(modelData.consensus_details.component_values).map(([k, val]: [string, any]) => {
                              const activeWeight = modelData.consensus_details.active_weights[k] || 0;
                              const baseWeight = modelData.consensus_details.weights[k] || 0;
                              return (
                                <tr key={k} className="border-b border-white/5 hover:bg-white/[0.01]">
                                  <td className="py-2.5 font-semibold text-neutral/80">{k.replace("_", " ").toUpperCase()}</td>
                                  <td className="py-2.5 text-right font-bold text-foreground">{currencySymbol}{val ? val.toFixed(2) : "N/A"}</td>
                                  <td className="py-2.5 text-right text-neutral/50">{(baseWeight * 100).toFixed(0)}%</td>
                                  <td className="py-2.5 text-right text-accent font-bold">{(activeWeight * 100).toFixed(1)}%</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Fair Value Tracker Version History Timeline */}
                  {modelData.tracker_timeline && modelData.tracker_timeline.length > 0 && (
                    <div className="glass-card p-6 space-y-4">
                      <h3 className="text-xs font-bold text-neutral uppercase tracking-wider flex items-center gap-1.5">
                        <History className="w-4 h-4 text-accent" />
                        <span>💼 Fair Value Tracker (Timeline)</span>
                      </h3>
                      <div className="relative border-l border-white/5 pl-4 ml-2 space-y-6">
                        {modelData.tracker_timeline.map((node: any, idx: number) => (
                          <div key={idx} className="relative">
                            <span className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-accent border border-background shadow" />
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                              <div>
                                <h4 className="text-xs font-bold text-foreground">{node.name}</h4>
                                <p className="text-[9px] text-neutral/40 font-mono mt-0.5">{new Date(node.timestamp).toLocaleString()}</p>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="text-xs font-mono font-bold text-accent">{currencySymbol}{node.intrinsic_value.toFixed(2)}</span>
                                <span className={`px-1.5 py-0.5 rounded text-[8px] font-extrabold font-mono ${node.margin_of_safety >= 0 ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-rose-500/10 text-rose-400 border border-rose-500/20"}`}>
                                  {(node.margin_of_safety * 100).toFixed(1)}% MOS
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: FORECAST BUILDER */}
              {activeTab === "forecast" && (
                <div className="glass-card p-6 space-y-8">
                  <div className="flex justify-between items-center border-b border-white/5 pb-4">
                    <h3 className="text-xs font-bold text-neutral uppercase tracking-wider">Projections Assumptions Builder</h3>
                    <div className="flex gap-2">
                      {["Base", "Bull", "Bear", "Recession", "AI Boom"].map((sc) => (
                        <button
                          key={sc}
                          onClick={() => handleLoadScenario(sc.toLowerCase().replace(" ", ""))}
                          className="px-2.5 py-1 rounded bg-white/[0.03] hover:bg-white/[0.06] border border-white/5 hover:border-accent/40 text-[10px] font-bold transition-all cursor-pointer"
                        >
                          {sc}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Sliders Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
                    
                    <div className="space-y-2">
                      <div className="flex justify-between font-bold">
                        <span>Revenue Growth CAGR</span>
                        <span className="text-accent font-mono">{(revGrowth * 100).toFixed(1)}%</span>
                      </div>
                      <input
                        type="range"
                        min="-0.10"
                        max="0.40"
                        step="0.01"
                        value={revGrowth}
                        onChange={(e) => setRevGrowth(parseFloat(e.target.value))}
                        className="w-full accent-accent bg-white/10 h-1 rounded-lg outline-none cursor-pointer"
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between font-bold">
                        <span>Operating Margin (EBIT)</span>
                        <span className="text-accent font-mono">{(ebitMargin * 100).toFixed(1)}%</span>
                      </div>
                      <input
                        type="range"
                        min="0.0"
                        max="0.70"
                        step="0.01"
                        value={ebitMargin}
                        onChange={(e) => setEbitMargin(parseFloat(e.target.value))}
                        className="w-full accent-accent bg-white/10 h-1 rounded-lg outline-none cursor-pointer"
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between font-bold">
                        <span>Gross Margin</span>
                        <span className="text-accent font-mono">{(grossMargin * 100).toFixed(1)}%</span>
                      </div>
                      <input
                        type="range"
                        min="0.0"
                        max="0.95"
                        step="0.01"
                        value={grossMargin}
                        onChange={(e) => setGrossMargin(parseFloat(e.target.value))}
                        className="w-full accent-accent bg-white/10 h-1 rounded-lg outline-none cursor-pointer"
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between font-bold">
                        <span>Discount Rate (WACC)</span>
                        <span className="text-accent font-mono">{(discountRate * 100).toFixed(1)}%</span>
                      </div>
                      <input
                        type="range"
                        min="0.05"
                        max="0.20"
                        step="0.005"
                        value={discountRate}
                        onChange={(e) => setDiscountRate(parseFloat(e.target.value))}
                        className="w-full accent-accent bg-white/10 h-1 rounded-lg outline-none cursor-pointer"
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between font-bold">
                        <span>Terminal Growth Rate</span>
                        <span className="text-accent font-mono">{(terminalGrowth * 100).toFixed(1)}%</span>
                      </div>
                      <input
                        type="range"
                        min="0.0"
                        max="0.05"
                        step="0.001"
                        value={terminalGrowth}
                        onChange={(e) => setTerminalGrowth(parseFloat(e.target.value))}
                        className="w-full accent-accent bg-white/10 h-1 rounded-lg outline-none cursor-pointer"
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between font-bold">
                        <span>Corporate Tax Rate</span>
                        <span className="text-accent font-mono">{(taxRate * 100).toFixed(1)}%</span>
                      </div>
                      <input
                        type="range"
                        min="0.0"
                        max="0.40"
                        step="0.01"
                        value={taxRate}
                        onChange={(e) => setTaxRate(parseFloat(e.target.value))}
                        className="w-full accent-accent bg-white/10 h-1 rounded-lg outline-none cursor-pointer"
                      />
                    </div>

                    {/* CapEx, Dilution, Dividend Sliders */}
                    <div className="space-y-2">
                      <div className="flex justify-between font-bold">
                        <span>CapEx as % of Revenue</span>
                        <span className="text-accent font-mono">{(capexPct * 100).toFixed(1)}%</span>
                      </div>
                      <input
                        type="range"
                        min="0.01"
                        max="0.20"
                        step="0.005"
                        value={capexPct}
                        onChange={(e) => setCapexPct(parseFloat(e.target.value))}
                        className="w-full accent-accent bg-white/10 h-1 rounded-lg outline-none cursor-pointer"
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between font-bold">
                        <span>Yearly Dilution/Buyback Rate</span>
                        <span className="text-accent font-mono">{(dilutionRate * 100).toFixed(1)}%</span>
                      </div>
                      <input
                        type="range"
                        min="-0.10"
                        max="0.10"
                        step="0.005"
                        value={dilutionRate}
                        onChange={(e) => setDilutionRate(parseFloat(e.target.value))}
                        className="w-full accent-accent bg-white/10 h-1 rounded-lg outline-none cursor-pointer"
                      />
                    </div>

                    <div className="space-y-2 col-span-1 md:col-span-2">
                      <div className="flex justify-between font-bold">
                        <span>Dividend Payout Ratio</span>
                        <span className="text-accent font-mono">{(dividendPayout * 100).toFixed(1)}%</span>
                      </div>
                      <input
                        type="range"
                        min="0.0"
                        max="0.90"
                        step="0.05"
                        value={dividendPayout}
                        onChange={(e) => setDividendPayout(parseFloat(e.target.value))}
                        className="w-full accent-accent bg-white/10 h-1 rounded-lg outline-none cursor-pointer"
                      />
                    </div>

                  </div>

                  {/* Assumption Builder Insights */}
                  {modelData.auto_data && (
                    <div className="space-y-3 pt-6 border-t border-white/5 text-xs">
                      <h4 className="font-bold text-neutral uppercase tracking-wider flex items-center gap-1">
                        <Info className="w-4 h-4 text-accent" />
                        <span>Automatic Assumption Builder Reasoning</span>
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {Object.entries(modelData.auto_data.explanations).map(([k, desc]: [string, any]) => {
                          const conf = modelData.auto_data.confidence[k] || 0.0;
                          return (
                            <div key={k} className="p-3 bg-white/[0.01] border border-white/5 rounded-xl space-y-1.5">
                              <div className="flex items-center justify-between font-bold">
                                <span className="text-neutral/80 font-mono text-[10px]">{k.replace("_", " ").toUpperCase()}</span>
                                <span className="text-[10px] text-emerald-400 font-mono">{(conf*100).toFixed(0)}% Conf</span>
                              </div>
                              <p className="text-[10px] text-neutral/70 font-sans leading-relaxed">{desc}</p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end pt-4 border-t border-white/5">
                    <button
                      onClick={handleRecalculate}
                      className="px-6 py-2.5 bg-gradient-to-r from-accent to-primary text-white font-bold rounded-xl text-xs cursor-pointer shadow-lg hover:opacity-90 transition-opacity"
                    >
                      Recalculate Model
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 3: THREE STATEMENT MODEL */}
              {activeTab === "statements" && (
                <div className="glass-card p-6 space-y-6 overflow-hidden">
                  <h3 className="text-xs font-bold text-neutral uppercase tracking-wider">Connected 3-Statement Model</h3>
                  
                  <div className="overflow-x-auto max-w-full">
                    <table className="min-w-[800px] w-full text-[10px] font-mono text-left border-collapse">
                      <thead>
                        <tr className="border-b border-white/10 text-neutral">
                          <th className="py-2 pr-4 font-bold font-sans">Financial Statement Item</th>
                          {modelData.hist_years.map((y: string) => (
                            <th key={y} className="py-2 px-2 text-right">{y}A</th>
                          ))}
                          {modelData.proj_years.map((y: string) => (
                            <th key={y} className="py-2 px-2 text-right text-accent">{y}E</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b border-white/5 font-sans font-bold text-blue-400">
                          <td colSpan={1 + modelData.hist_years.length + modelData.proj_years.length} className="py-2">
                            INCOME STATEMENT
                          </td>
                        </tr>
                        <tr className="border-b border-white/5 hover:bg-white/[0.02]">
                          <td className="py-2 pr-4 font-sans font-semibold">Revenue</td>
                          {modelData.hist_years.map((y: string) => (
                            <td key={y} className="py-2 px-2 text-right">{currencySymbol}{(modelData.three_statement[y]?.revenue / 1e9).toFixed(2)}B</td>
                          ))}
                          {modelData.proj_years.map((y: string) => (
                            <td key={y} className="py-2 px-2 text-right text-accent">{currencySymbol}{(modelData.three_statement[y]?.revenue / 1e9).toFixed(2)}B</td>
                          ))}
                        </tr>
                        <tr className="border-b border-white/5 hover:bg-white/[0.02]">
                          <td className="py-2 pr-4 font-sans font-semibold">Cost of Goods Sold (COGS)</td>
                          {modelData.hist_years.map((y: string) => (
                            <td key={y} className="py-2 px-2 text-right">{currencySymbol}{(modelData.three_statement[y]?.cogs / 1e9).toFixed(2)}B</td>
                          ))}
                          {modelData.proj_years.map((y: string) => (
                            <td key={y} className="py-2 px-2 text-right text-accent">{currencySymbol}{(modelData.three_statement[y]?.cogs / 1e9).toFixed(2)}B</td>
                          ))}
                        </tr>
                        <tr className="border-b border-white/5 hover:bg-white/[0.02] font-bold">
                          <td className="py-2 pr-4 font-sans">Gross Profit</td>
                          {modelData.hist_years.map((y: string) => (
                            <td key={y} className="py-2 px-2 text-right">{currencySymbol}{(modelData.three_statement[y]?.gross_profit / 1e9).toFixed(2)}B</td>
                          ))}
                          {modelData.proj_years.map((y: string) => (
                            <td key={y} className="py-2 px-2 text-right text-accent">{currencySymbol}{(modelData.three_statement[y]?.gross_profit / 1e9).toFixed(2)}B</td>
                          ))}
                        </tr>
                        <tr className="border-b border-white/5 hover:bg-white/[0.02]">
                          <td className="py-2 pr-4 font-sans font-semibold">Operating Profit (EBIT)</td>
                          {modelData.hist_years.map((y: string) => (
                            <td key={y} className="py-2 px-2 text-right">{currencySymbol}{(modelData.three_statement[y]?.ebit / 1e9).toFixed(2)}B</td>
                          ))}
                          {modelData.proj_years.map((y: string) => (
                            <td key={y} className="py-2 px-2 text-right text-accent">{currencySymbol}{(modelData.three_statement[y]?.ebit / 1e9).toFixed(2)}B</td>
                          ))}
                        </tr>
                        <tr className="border-b border-white/5 hover:bg-white/[0.02] font-bold bg-white/[0.01]">
                          <td className="py-2 pr-4 font-sans">Net Income</td>
                          {modelData.hist_years.map((y: string) => (
                            <td key={y} className="py-2 px-2 text-right">{currencySymbol}{(modelData.three_statement[y]?.net_income / 1e9).toFixed(2)}B</td>
                          ))}
                          {modelData.proj_years.map((y: string) => (
                            <td key={y} className="py-2 px-2 text-right text-accent">{currencySymbol}{(modelData.three_statement[y]?.net_income / 1e9).toFixed(2)}B</td>
                          ))}
                        </tr>

                        <tr className="border-b border-white/5 font-sans font-bold text-blue-400">
                          <td colSpan={1 + modelData.hist_years.length + modelData.proj_years.length} className="py-2 pt-4">
                            BALANCE SHEET
                          </td>
                        </tr>
                        <tr className="border-b border-white/5 hover:bg-white/[0.02]">
                          <td className="py-2 pr-4 font-sans font-semibold">Cash & Equivalents</td>
                          {modelData.hist_years.map((y: string) => (
                            <td key={y} className="py-2 px-2 text-right">{currencySymbol}{(modelData.three_statement[y]?.cash / 1e9).toFixed(2)}B</td>
                          ))}
                          {modelData.proj_years.map((y: string) => (
                            <td key={y} className="py-2 px-2 text-right text-accent">{currencySymbol}{(modelData.three_statement[y]?.cash / 1e9).toFixed(2)}B</td>
                          ))}
                        </tr>
                        <tr className="border-b border-white/5 hover:bg-white/[0.02] font-bold">
                          <td className="py-2 pr-4 font-sans">Total Assets</td>
                          {modelData.hist_years.map((y: string) => (
                            <td key={y} className="py-2 px-2 text-right">{currencySymbol}{(modelData.three_statement[y]?.total_assets / 1e9).toFixed(2)}B</td>
                          ))}
                          {modelData.proj_years.map((y: string) => (
                            <td key={y} className="py-2 px-2 text-right text-accent">{currencySymbol}{(modelData.three_statement[y]?.total_assets / 1e9).toFixed(2)}B</td>
                          ))}
                        </tr>
                        <tr className="border-b border-white/5 hover:bg-white/[0.02] font-bold">
                          <td className="py-2 pr-4 font-sans">Shareholders Equity</td>
                          {modelData.hist_years.map((y: string) => (
                            <td key={y} className="py-2 px-2 text-right">{currencySymbol}{(modelData.three_statement[y]?.equity / 1e9).toFixed(2)}B</td>
                          ))}
                          {modelData.proj_years.map((y: string) => (
                            <td key={y} className="py-2 px-2 text-right text-accent">{currencySymbol}{(modelData.three_statement[y]?.equity / 1e9).toFixed(2)}B</td>
                          ))}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 4: HISTORICAL FINANCIALS */}
              {activeTab === "historical" && (
                <div className="glass-card p-6 space-y-6 overflow-hidden">
                  <h3 className="text-xs font-bold text-neutral uppercase tracking-wider">Clean Historical Company Financials</h3>
                  
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left border-collapse font-mono min-w-[600px]">
                      <thead>
                        <tr className="border-b border-white/5 text-neutral font-semibold">
                          <th className="py-2 font-sans font-bold">Metric (Historical Years)</th>
                          {modelData.hist_years.map((y: string) => (
                            <th key={y} className="py-2 text-right">{y}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b border-white/5 hover:bg-white/[0.01]">
                          <td className="py-2.5 font-semibold text-neutral">Total Revenue</td>
                          {modelData.hist_years.map((y: string) => (
                            <td key={y} className="py-2.5 text-right">{currencySymbol}{(modelData.three_statement[y]?.revenue / 1e9).toFixed(2)}B</td>
                          ))}
                        </tr>
                        <tr className="border-b border-white/5 hover:bg-white/[0.01]">
                          <td className="py-2.5 font-semibold text-neutral">Gross Profit Margin</td>
                          {modelData.hist_years.map((y: string) => (
                            <td key={y} className="py-2.5 text-right">{(modelData.three_statement[y]?.gross_margin * 100).toFixed(1)}%</td>
                          ))}
                        </tr>
                        <tr className="border-b border-white/5 hover:bg-white/[0.01]">
                          <td className="py-2.5 font-semibold text-neutral">Operating Income (EBIT)</td>
                          {modelData.hist_years.map((y: string) => (
                            <td key={y} className="py-2.5 text-right">{currencySymbol}{(modelData.three_statement[y]?.ebit / 1e9).toFixed(2)}B</td>
                          ))}
                        </tr>
                        <tr className="border-b border-white/5 hover:bg-white/[0.01]">
                          <td className="py-2.5 font-semibold text-neutral">Net Income</td>
                          {modelData.hist_years.map((y: string) => (
                            <td key={y} className="py-2.5 text-right">{currencySymbol}{(modelData.three_statement[y]?.net_income / 1e9).toFixed(2)}B</td>
                          ))}
                        </tr>
                        <tr className="border-b border-white/5 hover:bg-white/[0.01]">
                          <td className="py-2.5 font-semibold text-neutral">Operating Cash Flow</td>
                          {modelData.hist_years.map((y: string) => (
                            <td key={y} className="py-2.5 text-right">{currencySymbol}{(modelData.three_statement[y]?.cfo / 1e9).toFixed(2)}B</td>
                          ))}
                        </tr>
                        <tr className="border-b border-white/5 hover:bg-white/[0.01]">
                          <td className="py-2.5 font-semibold text-neutral text-rose-400">Capital Expenditures</td>
                          {modelData.hist_years.map((y: string) => (
                            <td key={y} className="py-2.5 text-right text-rose-400">-${Math.abs(modelData.three_statement[y]?.cfi / 1e9).toFixed(2)}B</td>
                          ))}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 5: DCF MODEL */}
              {activeTab === "dcf" && (
                <div className="glass-card p-6 space-y-6 overflow-hidden">
                  <h3 className="text-xs font-bold text-neutral uppercase tracking-wider">Institutional Discounted Cash Flow Grid</h3>
                  
                  <div className="overflow-x-auto">
                    <table className="min-w-[600px] w-full text-[10px] font-mono text-left border-collapse">
                      <thead>
                        <tr className="border-b border-white/10 text-neutral">
                          <th className="py-2 pr-4 font-bold font-sans">FCF Component (in Millions)</th>
                          {modelData.proj_years.map((y: string, idx: number) => (
                            <th key={y} className="py-2 px-2 text-right text-accent">Year {idx+1} ({y})</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b border-white/5 hover:bg-white/[0.02]">
                          <td className="py-2 pr-4 font-sans font-semibold">NOPAT (EBIT * (1 - Tax))</td>
                          {modelData.proj_years.map((y: string) => {
                            const val = (modelData.three_statement[y]?.ebit * (1 - taxRate)) / 1e6;
                            return <td key={y} className="py-2 px-2 text-right">{currencySymbol}{val.toFixed(1)}M</td>;
                          })}
                        </tr>
                        <tr className="border-b border-white/5 hover:bg-white/[0.02]">
                          <td className="py-2 pr-4 font-sans font-semibold">(+) Depreciation & Amortization</td>
                          {modelData.proj_years.map((y: string) => {
                            const val = modelData.three_statement[y]?.dna / 1e6;
                            return <td key={y} className="py-2 px-2 text-right">{currencySymbol}{val.toFixed(1)}M</td>;
                          })}
                        </tr>
                        <tr className="border-b border-white/5 hover:bg-white/[0.02]">
                          <td className="py-2 pr-4 font-sans font-semibold">(-) Capital Expenditures</td>
                          {modelData.proj_years.map((y: string) => {
                            const val = (modelData.three_statement[y]?.revenue * capexPct) / 1e6;
                            return <td key={y} className="py-2 px-2 text-right">{currencySymbol}{val.toFixed(1)}M</td>;
                          })}
                        </tr>
                        <tr className="border-b border-white/5 hover:bg-white/[0.02] font-bold border-t border-white/10">
                          <td className="py-2 pr-4 font-sans">Free Cash Flow (FCF)</td>
                          {modelData.projected_fcfs.map((fcf: number, idx: number) => (
                            <td key={idx} className="py-2 px-2 text-right text-accent">{currencySymbol}{(fcf / 1e6).toFixed(1)}M</td>
                          ))}
                        </tr>
                        <tr className="border-b border-white/5 hover:bg-white/[0.02]">
                          <td className="py-2 pr-4 font-sans font-semibold">Discount Factor</td>
                          {modelData.projected_fcfs.map((_: number, idx: number) => (
                            <td key={idx} className="py-2 px-2 text-right">{(1 / ((1 + discountRate) ** (idx + 1))).toFixed(4)}</td>
                          ))}
                        </tr>
                        <tr className="border-b border-white/5 hover:bg-white/[0.02] font-bold">
                          <td className="py-2 pr-4 font-sans text-accent">Present Value of FCF</td>
                          {modelData.discounted_fcfs.map((dfcf: number, idx: number) => (
                            <td key={idx} className="py-2 px-2 text-right text-accent">{currencySymbol}{(dfcf / 1e6).toFixed(1)}M</td>
                          ))}
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-white/5 text-xs">
                    <div className="space-y-1.5">
                      <div className="flex justify-between"><span className="text-neutral">Sum of PV of FCFs:</span> <span className="font-mono">{currencySymbol}{(modelData.discounted_fcfs.reduce((a:number,b:number)=>a+b, 0) / 1e9).toFixed(3)}B</span></div>
                      <div className="flex justify-between"><span className="text-neutral">Discounted Terminal Value:</span> <span className="font-mono">{currencySymbol}{(modelData.discounted_tv / 1e9).toFixed(3)}B</span></div>
                      <div className="flex justify-between font-bold text-accent"><span className="font-sans">Enterprise Value:</span> <span className="font-mono">{currencySymbol}{(modelData.enterprise_value / 1e9).toFixed(3)}B</span></div>
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex justify-between"><span className="text-neutral">Net Debt (Debt - Cash):</span> <span className="font-mono">{currencySymbol}{(modelData.net_debt / 1e9).toFixed(3)}B</span></div>
                      <div className="flex justify-between"><span className="text-neutral">Shares Outstanding:</span> <span className="font-mono">{(modelData.assumptions.shares_outstanding / 1e9).toFixed(3)}B</span></div>
                      <div className="flex justify-between font-bold text-accent"><span className="font-sans">Intrinsic Value Per Share:</span> <span className="font-mono">{currencySymbol}{modelData.intrinsic_value?.toFixed(2)}</span></div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 6: RELATIVE VALUATION */}
              {activeTab === "relative" && (
                <div className="space-y-6">
                  {/* Peer Valuation Multiples */}
                  <div className="glass-card p-6 space-y-4">
                    <h3 className="text-xs font-bold text-neutral uppercase tracking-wider">Comparable Multiples (Peers vs Industry)</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-left border-collapse">
                        <thead>
                          <tr className="border-b border-white/5 text-neutral font-semibold">
                            <th className="py-2">Multiple Metric</th>
                            <th className="py-2 text-right">Company</th>
                            <th className="py-2 text-right">AMD</th>
                            <th className="py-2 text-right">INTC</th>
                            <th className="py-2 text-right text-accent">Industry Avg</th>
                          </tr>
                        </thead>
                        <tbody>
                          {modelData.relative_valuation.map((peer: any, idx: number) => (
                            <tr key={idx} className="border-b border-white/5 hover:bg-white/[0.01]">
                              <td className="py-2.5 font-semibold text-neutral">{peer.metric}</td>
                              <td className="py-2.5 text-right font-bold text-foreground font-mono">{peer.company?.toFixed(1) || "N/A"}x</td>
                              <td className="py-2.5 text-right font-mono text-neutral/80">{peer.AMD?.toFixed(1) || peer.AMD}x</td>
                              <td className="py-2.5 text-right font-mono text-neutral/80">{peer.INTC?.toFixed(1) || peer.INTC}x</td>
                              <td className="py-2.5 text-right font-mono text-accent font-bold">{peer.Industry?.toFixed(1) || peer.Industry}x</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Historical Multiple Averages */}
                  {modelData.historical_valuation && (
                    <div className="glass-card p-6 space-y-4">
                      <h3 className="text-xs font-bold text-neutral uppercase tracking-wider">Historical Multiples Valuation comparison</h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                        <div className="p-4 bg-white/[0.01] border border-white/5 rounded-xl space-y-2">
                          <span className="font-bold text-neutral">P/E Premium / Discount</span>
                          <div className="flex justify-between font-mono text-[10px]">
                            <span>Current P/E:</span>
                            <span>{modelData.historical_valuation.current.pe.toFixed(1)}x</span>
                          </div>
                          <div className="flex justify-between font-mono text-[10px]">
                            <span>3-Yr Avg:</span>
                            <span>{modelData.historical_valuation.averages.pe.toFixed(1)}x</span>
                          </div>
                          <div className={`text-lg font-mono font-bold mt-1 ${(modelData.historical_valuation.comparison.pe_premium_pct >= 0) ? "text-rose-400" : "text-emerald-400"}`}>
                            {(modelData.historical_valuation.comparison.pe_premium_pct * 100).toFixed(1)}% {modelData.historical_valuation.comparison.pe_premium_pct >= 0 ? "Premium" : "Discount"}
                          </div>
                        </div>

                        <div className="p-4 bg-white/[0.01] border border-white/5 rounded-xl space-y-2">
                          <span className="font-bold text-neutral">EV/EBITDA Premium / Discount</span>
                          <div className="flex justify-between font-mono text-[10px]">
                            <span>Current Multiple:</span>
                            <span>{modelData.historical_valuation.current.ev_ebitda.toFixed(1)}x</span>
                          </div>
                          <div className="flex justify-between font-mono text-[10px]">
                            <span>3-Yr Avg:</span>
                            <span>{modelData.historical_valuation.averages.ev_ebitda.toFixed(1)}x</span>
                          </div>
                          <div className={`text-lg font-mono font-bold mt-1 ${(modelData.historical_valuation.comparison.ev_ebitda_premium_pct >= 0) ? "text-rose-400" : "text-emerald-400"}`}>
                            {(modelData.historical_valuation.comparison.ev_ebitda_premium_pct * 100).toFixed(1)}% {modelData.historical_valuation.comparison.ev_ebitda_premium_pct >= 0 ? "Premium" : "Discount"}
                          </div>
                        </div>

                        <div className="p-4 bg-white/[0.01] border border-white/5 rounded-xl space-y-2">
                          <span className="font-bold text-neutral">EV/Sales Premium / Discount</span>
                          <div className="flex justify-between font-mono text-[10px]">
                            <span>Current Multiple:</span>
                            <span>{modelData.historical_valuation.current.ev_sales.toFixed(1)}x</span>
                          </div>
                          <div className="flex justify-between font-mono text-[10px]">
                            <span>3-Yr Avg:</span>
                            <span>{modelData.historical_valuation.averages.ev_sales.toFixed(1)}x</span>
                          </div>
                          <div className={`text-lg font-mono font-bold mt-1 ${(modelData.historical_valuation.comparison.ev_sales_premium_pct >= 0) ? "text-rose-400" : "text-emerald-400"}`}>
                            {(modelData.historical_valuation.comparison.ev_sales_premium_pct * 100).toFixed(1)}% {modelData.historical_valuation.comparison.ev_sales_premium_pct >= 0 ? "Premium" : "Discount"}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 7: REVERSE DCF SANDBOX */}
              {activeTab === "reverse_dcf" && (
                <div className="glass-card p-6 space-y-4">
                  <h3 className="text-xs font-bold text-neutral uppercase tracking-wider flex items-center gap-1">
                    <TrendingUp className="w-4.5 h-4.5 text-accent" />
                    <span>Reverse DCF (Market Implied Projections)</span>
                  </h3>
                  <p className="text-xs text-neutral/80 leading-relaxed font-sans">
                    Instead of guessing growth, **Reverse DCF** back-calculates what growth the market is pricing in at the current stock price.
                  </p>
                  
                  <div className="p-4 bg-accent/5 border border-accent/20 rounded-xl space-y-3 mt-4">
                    <div className="flex justify-between items-center text-xs font-bold font-mono">
                      <span>Current stock price:</span>
                      <span className="text-white">{currencySymbol}{modelData.current_price?.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs font-bold font-mono">
                      <span>Market Implied FCF Growth rate (CAGR):</span>
                      <span className="text-accent text-lg font-black">{(modelData.reverse_dcf_growth * 100).toFixed(2)}% / year</span>
                    </div>
                    <p className="text-[10px] text-neutral/50 font-sans pt-2 leading-relaxed">
                      Assumptions: 10 year forecast horizon, WACC of {(discountRate*100).toFixed(1)}%, terminal growth of {(terminalGrowth*100).toFixed(1)}%, and current net debt of {currencySymbol}{(modelData.net_debt / 1e9).toFixed(2)}B.
                    </p>
                  </div>
                </div>
              )}

              {/* TAB 8: SENSITIVITY GRID */}
              {activeTab === "sensitivity" && (
                <div className="glass-card p-6 space-y-6 overflow-hidden">
                  <h3 className="text-xs font-bold text-neutral uppercase tracking-wider">2D WACC vs. Growth Sensitivity Matrix</h3>
                  
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[500px] text-[10px] font-mono text-center border-collapse">
                      <thead>
                        <tr className="border-b border-white/10 text-neutral">
                          <th className="py-2 pr-4 text-left font-sans font-bold">WACC / Revenue Growth</th>
                          {modelData.sensitivity.growth_labels.map((g: string) => (
                            <th key={g} className="py-2 px-2">{g}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {modelData.sensitivity.matrix.map((row: any[], rIdx: number) => (
                          <tr key={rIdx} className="border-b border-white/5">
                            <td className="py-3 pr-4 text-left font-sans font-bold text-neutral">
                              {modelData.sensitivity.wacc_labels[rIdx]}
                            </td>
                            {row.map((cell: number, cIdx: number) => {
                              const isBase = rIdx === 2 && cIdx === 2;
                              return (
                                <td 
                                  key={cIdx} 
                                  className={`py-3 px-2 transition-colors ${
                                    isBase ? "bg-accent/25 font-bold border border-accent" : "hover:bg-white/[0.04]"
                                  }`}
                                >
                                  {currencySymbol}{cell?.toFixed(2)}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 9: MONTE CARLO SANDBOX */}
              {activeTab === "monte_carlo" && (
                <div className="glass-card p-6 space-y-6">
                  <h3 className="text-xs font-bold text-neutral uppercase tracking-wider">10,000 Monte Carlo Probability Projections</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="md:col-span-1 space-y-4">
                      <h4 className="text-xs font-bold text-neutral uppercase tracking-wider">Simulation Distribution</h4>
                      <div className="space-y-2 text-xs font-mono">
                        <div className="flex justify-between border-b border-white/5 pb-1">
                          <span className="text-neutral font-sans">95th Percentile (Bull):</span>
                          <span className="font-bold text-emerald-400">{currencySymbol}{modelData.monte_carlo.p95?.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between border-b border-white/5 pb-1">
                          <span className="text-neutral font-sans">75th Percentile:</span>
                          <span>{currencySymbol}{modelData.monte_carlo.p75?.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between border-b border-white/5 pb-1">
                          <span className="text-neutral font-sans">50th Percentile (Median):</span>
                          <span className="font-bold text-accent">{currencySymbol}{modelData.monte_carlo.p50?.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between border-b border-white/5 pb-1">
                          <span className="text-neutral font-sans">25th Percentile:</span>
                          <span>{currencySymbol}{modelData.monte_carlo.p25?.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between border-b border-white/5 pb-1">
                          <span className="text-neutral font-sans">5th Percentile (Bear):</span>
                          <span className="font-bold text-rose-400">{currencySymbol}{modelData.monte_carlo.p5?.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="md:col-span-2 space-y-3">
                      <h4 className="text-xs font-bold text-neutral uppercase tracking-wider">Probability Histogram Buckets</h4>
                      <div className="flex flex-col gap-2">
                        {modelData.monte_carlo.buckets.map((b: any, idx: number) => {
                          const maxCount = Math.max(...modelData.monte_carlo.buckets.map((b:any)=>b.count));
                          const pct = maxCount > 0 ? (b.count / maxCount) * 100 : 0;
                          return (
                            <div key={idx} className="flex items-center gap-3 text-[10px]">
                              <span className="w-24 font-mono text-neutral">{b.range}</span>
                              <div className="flex-1 h-3 bg-white/[0.02] rounded-full overflow-hidden border border-white/5">
                                <div className="h-full bg-accent/40 rounded-full" style={{ width: `${pct}%` }} />
                              </div>
                              <span className="w-8 font-mono text-right text-neutral/70">({b.count})</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 10: MODEL COMPARISON */}
              {activeTab === "comparison" && (
                <div className="glass-card p-6 space-y-6">
                  <div className="flex justify-between items-center border-b border-white/5 pb-4">
                    <h3 className="text-xs font-bold text-neutral uppercase tracking-wider">Model Comparison Studio</h3>
                    <div className="flex gap-2">
                      <select 
                        value={comparisonModelId}
                        onChange={(e) => setComparisonModelId(e.target.value)}
                        className="px-3 py-1 bg-black/40 border border-white/5 rounded-xl text-xs outline-none text-foreground font-mono"
                      >
                        <option value="">-- Select Saved Model --</option>
                        {workspaceModels.map(m => (
                          <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {comparisonModelData ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-left border-collapse font-mono">
                        <thead>
                          <tr className="border-b border-white/5 text-neutral font-semibold">
                            <th className="py-2">Assumption Metric</th>
                            <th className="py-2 text-right">Active Model</th>
                            <th className="py-2 text-right text-accent">Compared Model ({comparisonModelData.model_name})</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="border-b border-white/5 hover:bg-white/[0.01]">
                            <td className="py-2.5 font-semibold text-neutral">Consensus Intrinsic Value</td>
                            <td className="py-2.5 text-right font-bold text-foreground">{currencySymbol}{modelData.intrinsic_value.toFixed(2)}</td>
                            <td className="py-2.5 text-right font-bold text-accent">{currencySymbol}{comparisonModelData.intrinsic_value.toFixed(2)}</td>
                          </tr>
                          <tr className="border-b border-white/5 hover:bg-white/[0.01]">
                            <td className="py-2.5 font-semibold text-neutral">Revenue Growth CAGR</td>
                            <td className="py-2.5 text-right">{(revGrowth*100).toFixed(1)}%</td>
                            <td className="py-2.5 text-right text-accent">{(comparisonModelData.assumptions.revenue_growth*100).toFixed(1)}%</td>
                          </tr>
                          <tr className="border-b border-white/5 hover:bg-white/[0.01]">
                            <td className="py-2.5 font-semibold text-neutral">EBIT Margin</td>
                            <td className="py-2.5 text-right">{(ebitMargin*100).toFixed(1)}%</td>
                            <td className="py-2.5 text-right text-accent">{(comparisonModelData.assumptions.ebit_margin*100).toFixed(1)}%</td>
                          </tr>
                          <tr className="border-b border-white/5 hover:bg-white/[0.01]">
                            <td className="py-2.5 font-semibold text-neutral">Discount Rate (WACC)</td>
                            <td className="py-2.5 text-right">{(discountRate*100).toFixed(1)}%</td>
                            <td className="py-2.5 text-right text-accent">{(comparisonModelData.assumptions.wacc*100).toFixed(1)}%</td>
                          </tr>
                          <tr className="border-b border-white/5 hover:bg-white/[0.01]">
                            <td className="py-2.5 font-semibold text-neutral">CapEx as % of Revenue</td>
                            <td className="py-2.5 text-right">{(capexPct*100).toFixed(1)}%</td>
                            <td className="py-2.5 text-right text-accent">{(comparisonModelData.assumptions.capex_pct*100).toFixed(1)}%</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-xs text-neutral/50 text-center py-6">Select a saved scenario version in the dropdown to compare side-by-side.</p>
                  )}
                </div>
              )}

              {/* TAB 12: MACRO SCENARIO SANDBOX */}
              {activeTab === "macro" && (
                <div className="glass-card p-6 space-y-6">
                  <div className="flex items-center justify-between border-b border-white/5 pb-4">
                    <div>
                      <h3 className="text-xs font-bold text-neutral uppercase tracking-wider">Economic Scenario Sandbox</h3>
                      <p className="text-[10px] text-neutral mt-0.5 font-sans leading-none">Simulate global interest rate increases and oil price fluctuations to view their downstream valuation impact.</p>
                    </div>
                    {macroSim && (
                      <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider ${
                        macroSim.vulnerability_risk === "HIGH" ? "bg-rose-500/10 text-rose-400 border border-rose-500/20" :
                        macroSim.vulnerability_risk === "MEDIUM" ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" :
                        "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                      }`}>
                        Vulnerability: {macroSim.vulnerability_risk}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Controls */}
                    <div className="space-y-6">
                      <div className="space-y-2">
                        <div className="flex justify-between items-center text-xs font-bold text-neutral">
                          <span>US Interest Rate Shift</span>
                          <span className="font-mono text-accent">{interestRateDelta >= 0 ? "+" : ""}{interestRateDelta.toFixed(1)}%</span>
                        </div>
                        <input 
                          type="range" 
                          min="-3.0" 
                          max="3.0" 
                          step="0.5" 
                          value={interestRateDelta}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            setInterestRateDelta(val);
                            fetchMacroSimulation(val, oilPrice);
                          }}
                          className="w-full accent-accent"
                        />
                        <div className="flex justify-between text-[9px] text-neutral/40 font-mono">
                          <span>-3.0% (Cut)</span>
                          <span>Neutral (4.2% base)</span>
                          <span>+3.0% (Hike)</span>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between items-center text-xs font-bold text-neutral">
                          <span>Crude Oil Price per Barrel</span>
                          <span className="font-mono text-accent">${oilPrice.toFixed(0)}</span>
                        </div>
                        <input 
                          type="range" 
                          min="40" 
                          max="150" 
                          step="5" 
                          value={oilPrice}
                          onChange={(e) => {
                            const val = parseInt(e.target.value);
                            setOilPrice(val);
                            fetchMacroSimulation(interestRateDelta, val);
                          }}
                          className="w-full accent-accent"
                        />
                        <div className="flex justify-between text-[9px] text-neutral/40 font-mono">
                          <span>$40 (Low Demand)</span>
                          <span>$75 (Base)</span>
                          <span>$150 (Crisis)</span>
                        </div>
                      </div>
                    </div>

                    {/* Simulation Output */}
                    <div className="glass-panel p-6 rounded-2xl border border-white/5 space-y-4 relative min-h-[160px]">
                      {macroLoading && (
                        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm rounded-2xl flex items-center justify-center text-xs font-bold text-neutral z-10">
                          <RefreshCw className="w-4.5 h-4.5 animate-spin text-accent" />
                          <span className="ml-1.5">Simulating cashflows...</span>
                        </div>
                      )}
                      
                      {macroSim ? (
                        <div className="space-y-4">
                          <h4 className="text-[10px] font-bold text-neutral uppercase tracking-wider">Simulation Output Results</h4>
                          
                          <div className="grid grid-cols-2 gap-4">
                            <div className="p-3 bg-white/[0.01] rounded-xl border border-white/5 space-y-1">
                              <span className="text-[9px] text-neutral uppercase font-bold tracking-wider">Discount Rate (WACC)</span>
                              <div className="flex items-baseline gap-1.5 mt-0.5">
                                <span className="text-sm font-bold text-foreground font-mono">{macroSim.base_scenario.wacc_pct}%</span>
                                <span className="text-[10px] text-neutral">→</span>
                                <span className={`text-sm font-bold font-mono ${
                                  macroSim.simulated_scenario.wacc_pct > macroSim.base_scenario.wacc_pct ? "text-rose-400" : "text-emerald-400"
                                }`}>{macroSim.simulated_scenario.wacc_pct}%</span>
                              </div>
                            </div>

                            <div className="p-3 bg-white/[0.01] rounded-xl border border-white/5 space-y-1">
                              <span className="text-[9px] text-neutral uppercase font-bold tracking-wider">EBIT Margin</span>
                              <div className="flex items-baseline gap-1.5 mt-0.5">
                                <span className="text-sm font-bold text-foreground font-mono">{macroSim.base_scenario.ebit_margin_pct}%</span>
                                <span className="text-[10px] text-neutral">→</span>
                                <span className={`text-sm font-bold font-mono ${
                                  macroSim.simulated_scenario.ebit_margin_pct >= macroSim.base_scenario.ebit_margin_pct ? "text-emerald-400" : "text-rose-400"
                                }`}>{macroSim.simulated_scenario.ebit_margin_pct}%</span>
                              </div>
                            </div>
                          </div>

                          <div className="p-3.5 bg-accent/5 rounded-xl border border-accent/25 flex items-center justify-between">
                            <div className="space-y-0.5">
                              <span className="text-[9px] text-neutral uppercase font-bold tracking-wider block">Simulated Fair Value</span>
                              <span className="text-lg font-black font-mono text-accent mt-0.5">
                                {currencySymbol}{macroSim.simulated_scenario.intrinsic_value.toFixed(2)}
                              </span>
                            </div>
                            <div className="text-right">
                              <span className="text-[9px] text-neutral uppercase font-bold tracking-wider block">Valuation Impact</span>
                              <span className={`text-sm font-mono font-bold ${
                                macroSim.impact.intrinsic_value_change_pct >= 0 ? "text-emerald-400" : "text-rose-400"
                              }`}>
                                {macroSim.impact.intrinsic_value_change_pct >= 0 ? "+" : ""}{macroSim.impact.intrinsic_value_change_pct}%
                              </span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-neutral/50 text-center py-12">Modify the sliders to trigger economic simulations.</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 13: INDUSTRY INTELLIGENCE */}
              {activeTab === "industry" && (
                <div className="glass-card p-6 space-y-6 animate-fade-in">
                  <div className="border-b border-white/5 pb-4">
                    <h3 className="text-xs font-bold text-neutral uppercase tracking-wider">Industry Intelligence Dashboard</h3>
                    <p className="text-[10px] text-neutral mt-0.5 font-sans leading-none">Sector positioning, peer comparison median distributions, and calculated global market share.</p>
                  </div>

                  {industryData ? (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      {/* Left: Sector Statistics */}
                      <div className="lg:col-span-1 glass-panel p-4 rounded-xl border border-white/5 space-y-4">
                        <h4 className="text-[10px] font-bold text-neutral uppercase tracking-wider">Sector Benchmarks</h4>
                        <div className="space-y-3">
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-neutral/70 font-semibold">Active Sector</span>
                            <span className="font-bold text-foreground">{industryData.sector}</span>
                          </div>
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-neutral/70 font-semibold">Active Industry</span>
                            <span className="font-bold text-foreground truncate max-w-[60%]">{industryData.industry}</span>
                          </div>
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-neutral/70 font-semibold">TAM (Estimated USD)</span>
                            <span className="font-bold text-accent font-mono">${industryData.industry_stats.tam_usd_billions}B</span>
                          </div>
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-neutral/70 font-semibold">Industry Median CAGR</span>
                            <span className="font-bold text-foreground font-mono">{industryData.industry_stats.cagr_pct}%</span>
                          </div>
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-neutral/70 font-semibold">Median EBIT Margin</span>
                            <span className="font-bold text-foreground font-mono">{industryData.industry_stats.median_ebit_margin_pct}%</span>
                          </div>
                        </div>
                      </div>

                      {/* Middle: Market Share Distribution */}
                      <div className="lg:col-span-1 glass-panel p-4 rounded-xl border border-white/5 space-y-4">
                        <h4 className="text-[10px] font-bold text-neutral uppercase tracking-wider">Market Share Distribution</h4>
                        <div className="space-y-3">
                          {industryData.market_share_distribution.map((peer: any, idx: number) => (
                            <div key={idx} className="space-y-1.5">
                              <div className="flex justify-between text-[10px] font-mono">
                                <span className={peer.symbol === ticker.toUpperCase() ? "text-accent font-bold" : "text-foreground"}>
                                  {peer.symbol} <span className="text-[8px] text-neutral/40">({peer.name})</span>
                                </span>
                                <span className="font-bold text-neutral/70">{peer.share_pct}%</span>
                              </div>
                              <div className="w-full h-2 bg-white/[0.02] border border-white/5 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full ${
                                  peer.symbol === ticker.toUpperCase() ? "bg-accent" : "bg-neutral/40"
                                }`} style={{ width: `${peer.share_pct}%` }} />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Right: Drivers & Risks */}
                      <div className="lg:col-span-1 space-y-4">
                        <div className="glass-panel p-4 rounded-xl border border-white/5 space-y-2">
                          <h4 className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                            <TrendingUp className="w-3.5 h-3.5" />
                            <span>Growth Drivers</span>
                          </h4>
                          <ul className="list-disc list-inside text-[10px] text-neutral/80 space-y-1 font-sans">
                            {industryData.growth_drivers.map((drv: string, idx: number) => (
                              <li key={idx}>{drv}</li>
                            ))}
                          </ul>
                        </div>

                        <div className="glass-panel p-4 rounded-xl border border-white/5 space-y-2">
                          <h4 className="text-[10px] font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1">
                            <AlertCircle className="w-3.5 h-3.5" />
                            <span>Industry Risks</span>
                          </h4>
                          <ul className="list-disc list-inside text-[10px] text-neutral/80 space-y-1 font-sans">
                            {industryData.industry_risks.map((r: string, idx: number) => (
                              <li key={idx}>{r}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-neutral/50 text-center py-12">Loading industry indicators...</p>
                  )}
                </div>
              )}

              {/* TAB 14: BUSINESS MODEL & MOATS */}
              {activeTab === "business" && (
                <div className="glass-card p-6 space-y-6 animate-fade-in">
                  <div className="border-b border-white/5 pb-4">
                    <h3 className="text-xs font-bold text-neutral uppercase tracking-wider">Business Model & Moat Radar</h3>
                    <p className="text-[10px] text-neutral mt-0.5 font-sans leading-none">Revenue segment breakdown, operating segment margins, and proprietary moat scoring.</p>
                  </div>

                  {businessData ? (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      {/* Left: Revenue Segments */}
                      <div className="lg:col-span-1 glass-panel p-4 rounded-xl border border-white/5 space-y-4">
                        <h4 className="text-[10px] font-bold text-neutral uppercase tracking-wider">Revenue Breakdown</h4>
                        <div className="space-y-4">
                          {businessData.revenue_segments.map((seg: any, idx: number) => (
                            <div key={idx} className="space-y-1.5">
                              <div className="flex justify-between text-[10px] font-sans">
                                <span className="font-semibold text-foreground/90 truncate max-w-[80%]">{seg.name}</span>
                                <span className="font-bold text-accent font-mono">{seg.share_pct}%</span>
                              </div>
                              <div className="w-full h-2.5 bg-white/[0.02] border border-white/5 rounded-full overflow-hidden">
                                <div className="h-full bg-gradient-to-r from-accent to-primary rounded-full" style={{ width: `${seg.share_pct}%` }} />
                              </div>
                              <span className="text-[8px] text-neutral/50 font-mono block">Segment Margin: {seg.margin_pct}%</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Middle: Competitive Moat Score */}
                      <div className="lg:col-span-1 glass-panel p-4 rounded-xl border border-white/5 space-y-4">
                        <div className="flex justify-between items-center">
                          <h4 className="text-[10px] font-bold text-neutral uppercase tracking-wider">Moat Scorecard</h4>
                          <span className="px-2 py-0.5 rounded bg-accent/10 border border-accent/20 text-accent font-mono text-[9px] font-bold">
                            {businessData.moat_analysis.moat_classification}
                          </span>
                        </div>
                        
                        <div className="flex flex-col items-center justify-center py-3">
                          <span className="text-4xl font-black font-mono text-accent">
                            {businessData.moat_analysis.moat_score}
                          </span>
                          <span className="text-[9px] text-neutral uppercase font-bold tracking-widest mt-1">Moat Index / 100</span>
                        </div>

                        <div className="space-y-2 border-t border-white/5 pt-3">
                          {Object.entries(businessData.moat_analysis.breakdown).map(([category, val]: any, idx: number) => (
                            <div key={idx} className="flex justify-between items-center text-[10px] font-mono">
                              <span className="text-neutral/70">{category}</span>
                              <span className="font-bold text-foreground">{val}/100</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Right: Structural Competitive Moats */}
                      <div className="lg:col-span-1 glass-panel p-4 rounded-xl border border-white/5 space-y-4">
                        <h4 className="text-[10px] font-bold text-neutral uppercase tracking-wider">Moat Explanations</h4>
                        <div className="space-y-3">
                          {businessData.competitive_advantages.map((adv: string, idx: number) => (
                            <div key={idx} className="p-3 bg-white/[0.01] rounded-xl border border-white/5 space-y-1">
                              <span className="text-[9px] text-accent uppercase font-bold font-mono">Barrier #{idx+1}</span>
                              <p className="text-[10px] text-neutral/80 leading-relaxed font-sans">{adv}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-neutral/50 text-center py-12">Loading business model details...</p>
                  )}
                </div>
              )}

              {/* TAB: MANAGEMENT & LEADERSHIP */}
              {activeTab === "management" && (
                <div className="glass-card p-6 space-y-6 animate-fade-in">
                  <div className="flex justify-between items-center border-b border-white/5 pb-4">
                    <div>
                      <h3 className="text-xs font-bold text-neutral uppercase tracking-wider">Management & Leadership Intelligence</h3>
                      <p className="text-[10px] text-neutral mt-0.5 font-sans leading-none">Key executive directories, stakeholder alignment shares, and composite quality scoring.</p>
                    </div>
                    {managementData && (
                      <span className="px-2 py-0.5 rounded bg-accent/10 border border-accent/20 text-accent font-mono text-[9px] font-bold">
                        Score: {managementData.management_quality_score}/100
                      </span>
                    )}
                  </div>

                  {managementData ? (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      {/* Left: Executives Directory */}
                      <div className="lg:col-span-2 glass-panel p-4 rounded-xl border border-white/5 space-y-4">
                        <h4 className="text-[10px] font-bold text-neutral uppercase tracking-wider">Key Corporate Officers</h4>
                        <div className="space-y-3">
                          {managementData.key_executives.map((exec: any, idx: number) => (
                            <div key={idx} className="p-3 bg-white/[0.01] rounded-xl border border-white/5 flex justify-between items-center text-xs">
                              <div>
                                <span className="font-bold text-foreground block">{exec.name}</span>
                                <span className="text-neutral/70 block mt-0.5">{exec.role}</span>
                              </div>
                              <div className="text-right">
                                <span className="font-mono text-neutral block">Tenure: {exec.tenure_years} yrs</span>
                                <span className={`text-[9px] font-bold uppercase tracking-wider ${
                                  exec.alignment === "CRITICAL" ? "text-accent" : (exec.alignment === "HIGH" ? "text-emerald-400" : "text-amber-400")
                                }`}>Alignment: {exec.alignment}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Right: Allocation Philosophy & M&A */}
                      <div className="lg:col-span-1 space-y-4">
                        <div className="glass-panel p-4 rounded-xl border border-white/5 space-y-2">
                          <h4 className="text-[10px] font-bold text-accent uppercase tracking-wider">Allocation Philosophy</h4>
                          <p className="text-[10px] text-neutral/80 leading-relaxed font-sans">{managementData.capital_allocation_history}</p>
                        </div>
                        <div className="glass-panel p-4 rounded-xl border border-white/5 space-y-2">
                          <h4 className="text-[10px] font-bold text-neutral uppercase tracking-wider">M&A Track Record</h4>
                          <p className="text-[10px] text-neutral/80 leading-relaxed font-sans">{managementData.ma_track_record}</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-neutral/50 text-center py-12">Loading leadership directory...</p>
                  )}
                </div>
              )}

              {/* TAB: CAPITAL ALLOCATION */}
              {activeTab === "capital" && (
                <div className="glass-card p-6 space-y-6 animate-fade-in">
                  <div className="flex justify-between items-center border-b border-white/5 pb-4">
                    <div>
                      <h3 className="text-xs font-bold text-neutral uppercase tracking-wider">Capital Allocation Performance</h3>
                      <p className="text-[10px] text-neutral mt-0.5 font-sans leading-none">Analysis of buybacks, dividends, deleveraging speed, and invested capital efficiency (ROIC).</p>
                    </div>
                    {capitalData && (
                      <span className="px-2 py-0.5 rounded bg-accent/10 border border-accent/20 text-accent font-mono text-[9px] font-bold">
                        Score: {capitalData.capital_allocation_score}/100
                      </span>
                    )}
                  </div>

                  {capitalData ? (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      {/* Left: Allocation Ratios */}
                      <div className="lg:col-span-1 glass-panel p-4 rounded-xl border border-white/5 space-y-4">
                        <h4 className="text-[10px] font-bold text-neutral uppercase tracking-wider">Shareholder Returns & Investments</h4>
                        <div className="space-y-3">
                          <div className="flex justify-between items-center text-xs font-mono border-b border-white/5 pb-2">
                            <span className="text-neutral/70">Share Buybacks</span>
                            <span className="font-bold text-foreground">${capitalData.breakdown.buybacks_usd_b}B</span>
                          </div>
                          <div className="flex justify-between items-center text-xs font-mono border-b border-white/5 pb-2">
                            <span className="text-neutral/70">Dividends Paid</span>
                            <span className="font-bold text-foreground">${capitalData.breakdown.dividends_paid_usd_b}B</span>
                          </div>
                          <div className="flex justify-between items-center text-xs font-mono border-b border-white/5 pb-2">
                            <span className="text-neutral/70">R&D Reinvestment</span>
                            <span className="font-bold text-foreground">${capitalData.breakdown.rd_spending_usd_b}B</span>
                          </div>
                          <div className="flex justify-between items-center text-xs font-mono pb-1">
                            <span className="text-neutral/70">Net Debt Deleveraging</span>
                            <span className={`font-bold ${
                              capitalData.breakdown.debt_reduction_usd_b >= 0 ? "text-emerald-400" : "text-rose-400"
                            }`}>{capitalData.breakdown.debt_reduction_usd_b >= 0 ? "+" : ""}${capitalData.breakdown.debt_reduction_usd_b}B</span>
                          </div>
                        </div>
                      </div>

                      {/* Middle: Invested Capital Efficiency */}
                      <div className="lg:col-span-2 glass-panel p-4 rounded-xl border border-white/5 space-y-4">
                        <h4 className="text-[10px] font-bold text-neutral uppercase tracking-wider">Invested Capital Efficiency</h4>
                        <div className="grid grid-cols-3 gap-4">
                          <div className="p-3 bg-white/[0.01] rounded-xl border border-white/5 text-center">
                            <span className="text-[8px] text-neutral uppercase font-bold tracking-wider block">Return on Capital (ROIC)</span>
                            <span className="text-lg font-black font-mono text-accent block mt-1">{capitalData.invested_capital_efficiency.roic_pct}%</span>
                          </div>
                          <div className="p-3 bg-white/[0.01] rounded-xl border border-white/5 text-center">
                            <span className="text-[8px] text-neutral uppercase font-bold tracking-wider block">CapEx/Revenue</span>
                            <span className="text-lg font-black font-mono text-foreground block mt-1">{capitalData.invested_capital_efficiency.capex_to_revenue_pct}%</span>
                          </div>
                          <div className="p-3 bg-white/[0.01] rounded-xl border border-white/5 text-center">
                            <span className="text-[8px] text-neutral uppercase font-bold tracking-wider block">FCF Conversion</span>
                            <span className="text-lg font-black font-mono text-emerald-400 block mt-1">{capitalData.invested_capital_efficiency.free_cash_flow_conversion_pct}%</span>
                          </div>
                        </div>
                        <div className="p-3 bg-accent/5 rounded-xl border border-accent/20 text-xs text-neutral/80 font-sans leading-relaxed">
                          <span className="font-bold text-accent">Value Creation Assessment:</span> The company displays a **{capitalData.shareholder_value_creation}** value compounding track record relative to industry weighted benchmark rates.
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-neutral/50 text-center py-12">Loading allocation reports...</p>
                  )}
                </div>
              )}

              {/* TAB: ACCOUNTING QUALITY & FRAUD DETECTION */}
              {activeTab === "accounting" && (
                <div className="glass-card p-6 space-y-6 animate-fade-in">
                  <div className="flex justify-between items-center border-b border-white/5 pb-4">
                    <div>
                      <h3 className="text-xs font-bold text-neutral uppercase tracking-wider">Accounting Quality & Distress Screening</h3>
                      <p className="text-[10px] text-neutral mt-0.5 font-sans leading-none">Detection of aggressive accounting methods, bankruptcy risk zones, and balance sheet manipulation checks.</p>
                    </div>
                    {accountingData && (
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                        accountingData.risk_status === "SAFE" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" :
                        accountingData.risk_status === "GREY ZONE" ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" :
                        "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                      }`}>
                        Risk: {accountingData.risk_status}
                      </span>
                    )}
                  </div>

                  {accountingData ? (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      {/* Left: Score Breakdown */}
                      <div className="lg:col-span-1 glass-panel p-4 rounded-xl border border-white/5 space-y-4">
                        <h4 className="text-[10px] font-bold text-neutral uppercase tracking-wider">Financial Distress Scores</h4>
                        
                        <div className="space-y-4">
                          <div className="p-3 bg-white/[0.01] rounded-xl border border-white/5 flex justify-between items-center text-xs">
                            <div>
                              <span className="font-bold text-foreground block">Altman Z-Score</span>
                              <span className="text-[9px] text-neutral/60 block mt-0.5">Bankruptcy Probability</span>
                            </div>
                            <span className={`font-mono font-bold text-sm ${
                              accountingData.altman_z_score >= 3.0 ? "text-emerald-400" : (accountingData.altman_z_score >= 1.81 ? "text-amber-400" : "text-rose-400")
                            }`}>{accountingData.altman_z_score}</span>
                          </div>

                          <div className="p-3 bg-white/[0.01] rounded-xl border border-white/5 flex justify-between items-center text-xs">
                            <div>
                              <span className="font-bold text-foreground block">Beneish M-Score</span>
                              <span className="text-[9px] text-neutral/60 block mt-0.5">Manipulation Probability</span>
                            </div>
                            <span className={`font-mono font-bold text-sm ${
                              accountingData.beneish_m_score < -1.78 ? "text-emerald-400" : "text-rose-400"
                            }`}>{accountingData.beneish_m_score}</span>
                          </div>

                          <div className="p-3 bg-white/[0.01] rounded-xl border border-white/5 flex justify-between items-center text-xs">
                            <div>
                              <span className="font-bold text-foreground block">Piotroski F-Score</span>
                              <span className="text-[9px] text-neutral/60 block mt-0.5">Financial Strength</span>
                            </div>
                            <span className="font-mono font-bold text-sm text-accent">{accountingData.piotroski_f_score}/9</span>
                          </div>
                        </div>
                      </div>

                      {/* Right: Accruals & Accounting Quality Flags */}
                      <div className="lg:col-span-2 glass-panel p-4 rounded-xl border border-white/5 space-y-4">
                        <div className="flex justify-between items-center">
                          <h4 className="text-[10px] font-bold text-neutral uppercase tracking-wider">Accounting Quality Indicators</h4>
                          <span className="px-2 py-0.5 rounded bg-accent/10 border border-accent/20 text-accent font-mono text-[9px] font-bold">
                            Quality Index: {accountingData.earnings_quality_score}/100
                          </span>
                        </div>

                        <div className="space-y-3">
                          {accountingData.accounting_flags.map((flag: string, idx: number) => (
                            <div key={idx} className="p-3 bg-white/[0.01] rounded-xl border border-white/5 flex items-start gap-2.5 text-xs text-neutral/80">
                              <span className={`w-1.5 h-1.5 rounded-full shrink-0 mt-1.5 ${
                                accountingData.risk_status === "SAFE" ? "bg-emerald-400" : "bg-rose-400"
                              }`} />
                              <p className="leading-relaxed font-sans">{flag}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-neutral/50 text-center py-12">Running forensic screening checks...</p>
                  )}
                </div>
              )}

              {/* TAB: MODEL HEALTH & AI REVIEWER */}
              {activeTab === "audit" && (
                <div className="glass-card p-6 space-y-8 animate-fade-in">
                  <div className="flex justify-between items-center border-b border-white/5 pb-4">
                    <div>
                      <h3 className="text-xs font-bold text-neutral uppercase tracking-wider">Model Health & AI Reviewer</h3>
                      <p className="text-[10px] text-neutral mt-0.5 font-sans leading-none">Automated sanity checker, historical checks, and peer metrics validation.</p>
                    </div>
                  </div>

                  {modelData && modelData.health_score ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {/* Overall score radial/large card */}
                      <div className="glass-card p-6 border-l-4 border-accent flex flex-col items-center justify-center text-center gap-3">
                        <span className="text-[10px] text-neutral uppercase font-bold tracking-wider">Model Health Score</span>
                        <div className="w-24 h-24 rounded-full border-4 border-accent/20 flex items-center justify-center relative">
                          <span className="text-xl font-bold font-mono text-foreground">{modelData.health_score.overall_reliability}%</span>
                        </div>
                        <p className="text-[9px] text-neutral">Composite reliability rating based on data completeness and assumptions margin.</p>
                      </div>

                      {/* Details health sub scores */}
                      <div className="md:col-span-2 space-y-4">
                        <h4 className="text-xs font-bold text-foreground font-sans">Reliability Dimension Breakdown</h4>
                        <div className="grid grid-cols-2 gap-4 text-xs font-mono">
                          <div className="bg-black/30 border border-white/5 p-3 rounded-xl">
                            <span className="text-[9px] text-neutral/70 block mb-1">Data Completeness</span>
                            <span className="font-bold text-foreground">{modelData.health_score.data_completeness}%</span>
                          </div>
                          <div className="bg-black/30 border border-white/5 p-3 rounded-xl">
                            <span className="text-[9px] text-neutral/70 block mb-1">Forecast Confidence</span>
                            <span className="font-bold text-foreground">{modelData.health_score.forecast_confidence}%</span>
                          </div>
                          <div className="bg-black/30 border border-white/5 p-3 rounded-xl">
                            <span className="text-[9px] text-neutral/70 block mb-1">Assumption Quality</span>
                            <span className="font-bold text-foreground">{modelData.health_score.assumption_quality}%</span>
                          </div>
                          <div className="bg-black/30 border border-white/5 p-3 rounded-xl">
                            <span className="text-[9px] text-neutral/70 block mb-1">Historical Accuracy</span>
                            <span className="font-bold text-foreground">{modelData.health_score.historical_accuracy}%</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-neutral/50 text-center py-6">Model results required to compute health score.</p>
                  )}

                  {/* AI Reviewer Audit trail */}
                  {modelData && modelData.audit ? (
                    <div className="space-y-4 border-t border-white/5 pt-6">
                      <h4 className="text-xs font-bold text-foreground font-sans">AI Reviewer Audit Trail</h4>
                      <div className="space-y-2.5">
                        {modelData.audit.audit_trail.map((log: string, idx: number) => (
                          <div key={idx} className="flex items-center gap-2.5 text-xs text-neutral/80 bg-white/[0.01] border border-white/5 px-4 py-2.5 rounded-xl">
                            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                            <span className="font-mono">{log}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {/* Reality Checker Warning Cards */}
                  {modelData && modelData.audit ? (
                    <div className="space-y-4 border-t border-white/5 pt-6">
                      <h4 className="text-xs font-bold text-foreground font-sans">Model Validation Alerts</h4>
                      {modelData.audit.warnings && modelData.audit.warnings.length > 0 ? (
                        <div className="space-y-3">
                          {modelData.audit.warnings.map((warn: string, idx: number) => (
                            <div key={idx} className="p-4 bg-amber-500/5 border border-amber-500/20 text-amber-400 rounded-xl flex items-start gap-3 text-xs leading-relaxed font-mono">
                              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
                              <p>{warn}</p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="p-4 bg-emerald-500/5 border border-emerald-500/20 text-emerald-400 rounded-xl flex items-center gap-3 text-xs font-mono">
                          <CheckCircle className="w-4 h-4 text-emerald-400" />
                          <p>All reality checks completed. 0 warnings flagged. Projections match reality and competitor peer baselines.</p>
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              )}

              {/* TAB: CALIBRATION & BACKTEST */}
              {activeTab === "calibration" && (
                <div className="glass-card p-6 space-y-8 animate-fade-in">
                  {/* Calibration Header */}
                  <div className="flex justify-between items-center border-b border-white/5 pb-4">
                    <div>
                      <h3 className="text-xs font-bold text-neutral uppercase tracking-wider">Calibration & Backtest</h3>
                      <p className="text-[10px] text-neutral mt-0.5 font-sans leading-none">Validate forecast errors dynamically and analyze historical predictions.</p>
                    </div>
                  </div>

                  {/* Section 1: Valuation Calibration */}
                  <div className="space-y-4">
                    <h4 className="text-xs font-bold text-foreground">🧠 Valuation Calibration Engine</h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Log Action Card */}
                      <div className="bg-black/30 border border-white/5 p-5 rounded-xl space-y-4 flex flex-col justify-between">
                        <div className="space-y-2">
                          <span className="text-[10px] text-neutral font-bold uppercase tracking-wider block">Record Valuation Run</span>
                          <p className="text-[11px] text-neutral/80 font-sans leading-relaxed">
                            Log current projections to compare error rates post-earnings and auto-optimize default heuristics.
                          </p>
                        </div>
                        <div className="space-y-2">
                          <button
                            onClick={logValuationRecord}
                            disabled={calibratingRecords || !modelData}
                            className="w-full py-2 bg-accent hover:opacity-90 disabled:opacity-50 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all"
                          >
                            <span>Save Prediction Run</span>
                          </button>
                          {calibrationStatus && (
                            <span className="text-[9px] font-mono text-accent block text-center font-bold">{calibrationStatus}</span>
                          )}
                        </div>
                      </div>

                      {/* Feedback Output Card */}
                      <div className="bg-black/30 border border-white/5 p-5 rounded-xl space-y-3 flex flex-col justify-between">
                        <div>
                          <span className="text-[10px] text-neutral font-bold uppercase tracking-wider block mb-2">Calibration Feedback</span>
                          {loadingCalibration ? (
                            <span className="text-xs font-mono text-neutral">Loading calibration error metrics...</span>
                          ) : calibrationFeedback ? (
                            <div className="space-y-2 text-xs font-mono">
                              <div className="flex justify-between border-b border-white/5 pb-1.5">
                                <span className="text-neutral/70">Average MAPE Error:</span>
                                <span className="text-foreground font-bold">{calibrationFeedback.average_mape}%</span>
                              </div>
                              <div className="flex justify-between border-b border-white/5 pb-1.5">
                                <span className="text-neutral/70">Logged Valuation Runs:</span>
                                <span className="text-foreground font-bold">{calibrationFeedback.total_runs}</span>
                              </div>
                              <div className="text-[10px] text-accent/90 font-sans leading-relaxed mt-2 p-2 bg-accent/5 rounded-lg border border-accent/10">
                                <strong>Heuristics:</strong> {calibrationFeedback.recommendation}
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs font-mono text-neutral/50">No calibration history logged.</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Section 2: Historical Backtesting */}
                  <div className="space-y-4 border-t border-white/5 pt-6">
                    <h4 className="text-xs font-bold text-foreground font-sans">⏮️ Retroactive Backtest Simulator</h4>
                    <p className="text-[10px] text-neutral leading-relaxed">
                      Evaluate predictions if InvestorGPT valued {ticker} in the past. Runs calculations using only data available as of the retroactive year.
                    </p>

                    {/* Backtest Year Selector */}
                    <div className="flex items-center gap-3 bg-black/40 border border-white/5 rounded-xl px-4 py-2.5 max-w-sm">
                      <span className="text-xs text-neutral font-bold">Select Base Year:</span>
                      <select
                        value={backtestYear}
                        onChange={(e) => setBacktestYear(parseInt(e.target.value))}
                        className="bg-transparent text-xs text-foreground outline-none font-bold"
                      >
                        <option value="2021">2021</option>
                        <option value="2022">2022</option>
                        <option value="2023">2023</option>
                        <option value="2024">2024</option>
                      </select>
                      <button
                        onClick={() => fetchBacktestData(backtestYear)}
                        disabled={loadingBacktest}
                        className="ml-auto px-4 py-1.5 bg-accent text-white font-bold text-[10px] rounded-lg transition-colors cursor-pointer"
                      >
                        {loadingBacktest ? "Running..." : "Run Simulator"}
                      </button>
                    </div>

                    {/* Backtest comparisons results */}
                    {loadingBacktest ? (
                      <p className="text-xs font-mono text-neutral text-center py-6">Reconstructing historical database and recalculating discount formulas...</p>
                    ) : backtestData ? (
                      <div className="space-y-4 animate-fade-in">
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-xs font-mono">
                          <div className="bg-black/20 p-3 rounded-lg border border-white/5">
                            <span className="text-neutral/70 block mb-1">Simulated Fair Value ({backtestData.backtest_base_year})</span>
                            <span className="text-sm font-bold text-accent">${backtestData.predicted_fair_value.toFixed(2)}</span>
                          </div>
                          <div className="bg-black/20 p-3 rounded-lg border border-white/5">
                            <span className="text-neutral/70 block mb-1">Actual Market Price Today</span>
                            <span className="text-sm font-bold text-foreground">${backtestData.actual_price_today.toFixed(2)}</span>
                          </div>
                        </div>

                        {/* Variance Table */}
                        <div className="overflow-x-auto border border-white/5 rounded-xl">
                          <table className="w-full min-w-[550px] text-[10px] font-mono text-left border-collapse bg-black/25">
                            <thead>
                              <tr className="border-b border-white/10 text-neutral bg-white/[0.02]">
                                <th className="py-2.5 px-4 font-sans font-bold">Year</th>
                                <th className="py-2.5 px-2 text-right">Predicted Revenue</th>
                                <th className="py-2.5 px-2 text-right">Actual Revenue</th>
                                <th className="py-2.5 px-2 text-right">Revenue Variance</th>
                                <th className="py-2.5 px-2 text-right">Predicted EPS</th>
                                <th className="py-2.5 px-2 text-right">Actual EPS</th>
                                <th className="py-2.5 px-4 text-right">EPS Variance</th>
                              </tr>
                            </thead>
                            <tbody>
                              {backtestData.comparisons.map((row: any, idx: number) => (
                                <tr key={idx} className="border-b border-white/5 hover:bg-white/[0.01]">
                                  <td className="py-3 px-4 font-bold text-foreground">{row.year}</td>
                                  <td className="py-3 px-2 text-right">${(row.predicted_revenue/1e6).toFixed(1)}M</td>
                                  <td className="py-3 px-2 text-right">${(row.actual_revenue/1e6).toFixed(1)}M</td>
                                  <td className={`py-3 px-2 text-right font-bold ${row.revenue_variance_pct >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                                    {row.revenue_variance_pct >= 0 ? "+" : ""}{row.revenue_variance_pct}%
                                  </td>
                                  <td className="py-3 px-2 text-right">${row.predicted_eps.toFixed(2)}</td>
                                  <td className="py-3 px-2 text-right">${row.actual_eps.toFixed(2)}</td>
                                  <td className={`py-3 px-4 text-right font-bold ${row.eps_variance_pct >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                                    {row.eps_variance_pct >= 0 ? "+" : ""}{row.eps_variance_pct}%
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              )}

              {/* TAB 11: AI MODELING STUDIO */}
              {activeTab === "chat" && (
                <div className="glass-card p-6 space-y-6">
                  <div className="flex items-center gap-2 border-b border-white/5 pb-4">
                    <Sparkles className="w-5 h-5 text-accent" />
                    <div>
                      <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">AI Investment Banking Copilot</h3>
                      <p className="text-[10px] text-neutral mt-0.5 font-sans leading-none">Describe financial overrides conversationally to adjust the active model parameters.</p>
                    </div>
                  </div>

                  {chatResponse && (
                    <div className="p-4 bg-accent/5 border border-accent/20 rounded-2xl text-xs leading-relaxed space-y-2">
                      <span className="font-bold text-accent">Copilot Output:</span>
                      <p>{chatResponse}</p>
                    </div>
                  )}

                  <form onSubmit={handleAIChat} className="flex gap-2">
                    <input
                      type="text"
                      value={chatPrompt}
                      onChange={(e) => setChatPrompt(e.target.value)}
                      placeholder="e.g. 'Model a recession starting next year' or 'Gross margin drops to 38%'"
                      className="flex-1 px-4 py-3 bg-black/40 border border-white/5 focus:border-accent/40 rounded-xl text-xs outline-none text-foreground placeholder:text-neutral/50 font-sans"
                      disabled={chatLoading}
                    />
                    <button
                      type="submit"
                      disabled={chatLoading || !chatPrompt.trim()}
                      className="px-6 py-3 bg-gradient-to-r from-accent to-primary text-white font-bold rounded-xl text-xs flex items-center gap-2 shrink-0 cursor-pointer disabled:opacity-50"
                    >
                      {chatLoading ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Processing...</span>
                        </>
                      ) : (
                        <span>Apply</span>
                      )}
                    </button>
                  </form>
                </div>
              )}
            </>
          )}
        </div>
      </div>
      )}

      {/* Save Model Modal Dialog */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass-panel max-w-sm w-full p-6 border border-white/10 rounded-2xl space-y-4">
            <h3 className="text-sm font-bold text-foreground">Save Model Scenario Version</h3>
            <p className="text-xs text-neutral/70">Enter a descriptive name for this set of assumptions (e.g. "Recession Base", "Bull Chip Boom").</p>
            
            <input
              type="text"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              placeholder="Descriptive scenario name..."
              className="w-full px-3 py-2 bg-black/40 border border-white/5 focus:border-accent/40 rounded-xl text-xs outline-none text-foreground"
            />
            
            <div className="flex justify-end gap-2 text-xs pt-2">
              <button
                onClick={() => setShowSaveModal(false)}
                className="px-4 py-2 hover:bg-white/5 rounded-xl font-bold text-neutral cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveModel}
                disabled={!saveName.trim()}
                className="px-4 py-2 bg-accent hover:opacity-90 disabled:opacity-50 text-white font-bold rounded-xl cursor-pointer"
              >
                Save Version
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default function ModelingLabPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen text-xs font-bold text-neutral">
        <RefreshCw className="w-4 h-4 animate-spin text-accent" />
        <span>Loading Modeling Lab...</span>
      </div>
    }>
      <ModelingLabContent />
    </Suspense>
  );
}
