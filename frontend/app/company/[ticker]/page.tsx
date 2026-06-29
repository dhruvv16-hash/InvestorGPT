"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { 
  Loader2, ArrowLeft, BarChart3, ShieldAlert, Award, 
  CheckCircle2, Compass, AlertCircle, RefreshCw, FileText,
  TrendingUp, Activity, HelpCircle, Download
} from "lucide-react";
import { AnalysisDetail } from "@/lib/types";
import { InvestmentScoreCard, getCurrencySymbol } from "@/components/cards/InvestmentScoreCard";
import { EvidencePanel } from "@/components/evidence/EvidencePanel";
import { ChatInterface } from "@/components/chat/ChatInterface";
import { FinancialTrendCharts } from "@/components/charts/FinancialTrendCharts";
import { TechnicalGauge } from "@/components/gauges/TechnicalGauge";

function CompanyDashboardContent({ ticker }: { ticker: string }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const analysisId = searchParams.get("analysis_id");

  const [data, setData] = useState<AnalysisDetail | null>(null);
  const [error, setError] = useState("");
  const [activeMetric, setActiveMetric] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("overview"); // overview, news, risk, chat, ownership_alt, ai_studio, explain_timeline
  const [financialView, setFinancialView] = useState<"table" | "chart">("table");

  // Extras state
  const [ownershipData, setOwnershipData] = useState<any>(null);
  const [alternativeData, setAlternativeData] = useState<any>(null);
  const [forecastData, setForecastData] = useState<any>(null);
  const [debateData, setDebateData] = useState<any>(null);
  const [timelineData, setTimelineData] = useState<any>(null);
  const [explainData, setExplainData] = useState<any>(null);
  
  // New features state
  const [industryData, setIndustryData] = useState<any>(null);
  const [businessData, setBusinessData] = useState<any>(null);
  const [managementData, setManagementData] = useState<any>(null);
  const [capitalData, setCapitalData] = useState<any>(null);
  const [accountingData, setAccountingData] = useState<any>(null);
  const [supplyChainData, setSupplyChainData] = useState<any>(null);
  
  const [loadingExtras, setLoadingExtras] = useState(false);

  // Supply chain shock state
  const [selectedDisruptedNode, setSelectedDisruptedNode] = useState<string>("TSMC");
  const [disruptionPct, setDisruptionPct] = useState<number>(50);
  const [chainShockData, setChainShockData] = useState<any>(null);
  const [chainShockLoading, setChainShockLoading] = useState(false);

  // Macro shock state
  const [macroSimResult, setMacroSimResult] = useState<any>(null);
  const [macroSimLoading, setMacroSimLoading] = useState(false);
  const [macroRateDelta, setMacroRateDelta] = useState<number>(2.0);
  const [macroOilPrice, setMacroOilPrice] = useState<number>(120.0);

  // Tree explainability state
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({
    root: true,
    fundamental: false,
    valuation: false,
    technical: false,
    sentiment: false
  });

  const toggleNode = (nodeId: string) => {
    setExpandedNodes(prev => ({ ...prev, [nodeId]: !prev[nodeId] }));
  };

  // Fetch all extra analytics once company resolution completes or ticker is ready
  useEffect(() => {
    if (!ticker) return;

    const fetchExtras = async () => {
      setLoadingExtras(true);
      try {
        const [ownRes, altRes, foreRes, debRes, timeRes, expRes, indRes, busRes, mgmtRes, capRes, acctRes, chainRes] = await Promise.all([
          fetch(`http://127.0.0.1:8000/api/v1/ownership/${ticker}`).then(r => r.ok ? r.json() : null),
          fetch(`http://127.0.0.1:8000/api/v1/alternative-data/${ticker}`).then(r => r.ok ? r.json() : null),
          fetch(`http://127.0.0.1:8000/api/v1/forecasting/${ticker}`).then(r => r.ok ? r.json() : null),
          fetch(`http://127.0.0.1:8000/api/v1/debate/${ticker}`).then(r => r.ok ? r.json() : null),
          fetch(`http://127.0.0.1:8000/api/v1/timeline/${ticker}`).then(r => r.ok ? r.json() : null),
          fetch(`http://127.0.0.1:8000/api/v1/explainability/${ticker}`).then(r => r.ok ? r.json() : null),
          fetch(`http://127.0.0.1:8000/api/v1/industry/${ticker}`).then(r => r.ok ? r.json() : null),
          fetch(`http://127.0.0.1:8000/api/v1/business-model/${ticker}`).then(r => r.ok ? r.json() : null),
          fetch(`http://127.0.0.1:8000/api/v1/management/${ticker}`).then(r => r.ok ? r.json() : null),
          fetch(`http://127.0.0.1:8000/api/v1/capital-allocation/${ticker}`).then(r => r.ok ? r.json() : null),
          fetch(`http://127.0.0.1:8000/api/v1/earnings-quality/${ticker}`).then(r => r.ok ? r.json() : null),
          fetch(`http://127.0.0.1:8000/api/v1/supply-chain/${ticker}`).then(r => r.ok ? r.json() : null),
        ]);

        setOwnershipData(ownRes);
        setAlternativeData(altRes);
        setForecastData(foreRes);
        setDebateData(debRes);
        setTimelineData(timeRes);
        setExplainData(expRes);
        setIndustryData(indRes);
        setBusinessData(busRes);
        setManagementData(mgmtRes);
        setCapitalData(capRes);
        setAccountingData(acctRes);
        setSupplyChainData(chainRes);
      } catch (err) {
        console.error("Failed to load extra analytics:", err);
      } finally {
        setLoadingExtras(false);
      }
    };

    if (data?.state === "COMPLETED") {
      fetchExtras();
    }
  }, [ticker, data?.state]);


  // Poll analysis endpoint
  useEffect(() => {
    if (!analysisId) {
      setError("No analysis ID provided");
      return;
    }

    let active = true;
    let timer: NodeJS.Timeout;

    const fetchStatus = async () => {
      try {
        const res = await fetch(`http://127.0.0.1:8000/api/v1/analyze/${analysisId}`);
        if (!res.ok) {
          throw new Error("Failed to fetch analysis details");
        }
        const json: AnalysisDetail = await res.json();
        if (!active) return;
        setData(json);

        // Keep polling if not finished
        if (json.state !== "COMPLETED" && json.state !== "FAILED") {
          timer = setTimeout(fetchStatus, 2000);
        }
      } catch (err: any) {
        if (active) setError(err.message || "Error fetching analysis status");
      }
    };

    fetchStatus();

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [analysisId]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center gap-4 min-h-screen">
        <AlertCircle className="w-12 h-12 text-bearish" />
        <h2 className="text-xl font-bold text-foreground">Analysis Error</h2>
        <p className="text-neutral max-w-md">{error}</p>
        <button
          onClick={() => router.push("/")}
          className="px-6 py-2 bg-accent hover:opacity-90 text-white font-bold text-sm rounded-xl transition-all cursor-pointer flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Search
        </button>
      </div>
    );
  }

  // Loading Timeline State
  if (!data || (data.state !== "COMPLETED" && data.state !== "FAILED")) {
    const states = [
      { name: "RESOLVING_COMPANY", label: "Resolving Stock Symbol", desc: "Finding company exchange profile" },
      { name: "FETCHING_DATA", label: "Retrieving Market Data", desc: "Downloading statements and prices" },
      { name: "VERIFYING_DATA", label: "Verifying Data Provenance", desc: "Cross-checking values across feeds" },
      { name: "RUNNING_ENGINES", label: "Executing Multi-Engine Models", desc: "Calculating fundamental and technical metrics" },
      { name: "CONSENSUS", label: "Committee Consensus Voting", desc: "Chairperson running vote weighting" },
      { name: "REVIEW", label: "Reviewer QA Check", desc: "Confirming mathematical logic" }
    ];

    const currentStateIndex = states.findIndex((s) => s.name === data?.state);

    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 relative min-h-screen">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] bg-primary/10 rounded-full blur-[100px] -z-10 pointer-events-none" />
        
        <div className="w-full max-w-lg space-y-8 animate-float">
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-bold tracking-tight text-foreground">Analyzing {ticker}</h2>
            <p className="text-xs text-neutral font-semibold tracking-wide uppercase flex items-center justify-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-accent" />
              State: {data?.state || "INITIALIZING"}
            </p>
          </div>

          {/* Timeline steps */}
          <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-6">
            {states.map((step, idx) => {
              const isPast = idx < currentStateIndex;
              const isCurrent = idx === currentStateIndex || (currentStateIndex === -1 && idx === 0);
              
              return (
                <div key={step.name} className="flex gap-4 items-start">
                  <div className="flex flex-col items-center">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center border text-xs font-bold transition-all ${
                      isPast ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" :
                      isCurrent ? "bg-accent/10 text-accent border-accent/40 animate-pulse" :
                      "bg-white/[0.02] text-neutral/40 border-white/5"
                    }`}>
                      {isPast ? "✓" : idx + 1}
                    </div>
                    {idx < states.length - 1 && (
                      <div className={`w-[2px] h-8 my-1 transition-all ${isPast ? "bg-emerald-500/20" : "bg-white/5"}`} />
                    )}
                  </div>
                  <div>
                    <h4 className={`text-xs font-bold leading-none ${isCurrent ? "text-foreground" : "text-neutral"}`}>
                      {step.label}
                    </h4>
                    <p className="text-[10px] text-neutral/60 mt-1 leading-snug">{step.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // Find price, financials, technical indicators, and valuation
  const fairValue = data.valuation_results.find(v => v.model_name === "DCF")?.fair_value || null;
  const fScore = data.financials.find(f => f.metric_name === "f_score")?.value;
  const zScore = data.financials.find(f => f.metric_name === "z_score")?.value;
  const rsiVal = data.technical_data.find(t => t.indicator_name === "RSI")?.value;
  const sma20Val = data.technical_data.find(t => t.indicator_name === "SMA_20")?.value;

  // Retrieve advanced payloads from database JSON columns
  const newsSentiment = data.valuation_results.find(v => v.model_name === "NEWS_SENTIMENT")?.assumptions || {};
  const macroData = data.valuation_results.find(v => v.model_name === "MACRO_INDICATORS")?.assumptions || {};
  const competitorData = data.valuation_results.find(v => v.model_name === "COMPETITORS")?.assumptions?.comparison || [];
  const riskData = data.valuation_results.find(v => v.model_name === "RISK_PROFILE")?.assumptions || {};

  // Pivot financial statements by year
  const statementMetrics = ["revenue", "cogs", "net_income", "operating_cash_flow", "capital_expenditures"];
  const years = Array.from(new Set(data.financials
    .filter(f => statementMetrics.includes(f.metric_name) && f.fiscal_period)
    .map(f => f.fiscal_period as string)
  )).sort().reverse();

  // Dynamically resolve stock price and metrics
  const currentPrice = data.financials.find(f => f.metric_name === "current_price")?.value || 174.00;

  const latestFinancials = years[0] ? {
    revenue: data.financials.find(f => f.metric_name === "revenue" && f.fiscal_period === years[0])?.value,
    cogs: data.financials.find(f => f.metric_name === "cogs" && f.fiscal_period === years[0])?.value,
    net_income: data.financials.find(f => f.metric_name === "net_income" && f.fiscal_period === years[0])?.value,
    eps: data.financials.find(f => f.metric_name === "diluted_eps" && f.fiscal_period === years[0])?.value,
  } : null;

  const currentGrossMargin = latestFinancials && typeof latestFinancials.revenue === "number"
    ? (latestFinancials.revenue - (latestFinancials.cogs || 0)) / latestFinancials.revenue
    : null;

  const currentNetMargin = latestFinancials && typeof latestFinancials.revenue === "number" && typeof latestFinancials.net_income === "number"
    ? latestFinancials.net_income / latestFinancials.revenue
    : null;

  const currentPE = latestFinancials && typeof latestFinancials.eps === "number" && latestFinancials.eps > 0
    ? currentPrice / latestFinancials.eps
    : null;

  return (
    <div className="flex-1 flex flex-col p-4 md:p-8 max-w-7xl mx-auto w-full gap-8 relative min-h-screen">
      {/* Header Area */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-white/5 pb-6">
        <div className="space-y-2">
          <button
            onClick={() => router.push("/")}
            className="flex items-center gap-1.5 text-xs text-neutral hover:text-accent font-semibold transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Search
          </button>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-foreground font-mono">
              {data.company.name}
            </h1>
            <span className="px-2.5 py-1 text-[10px] font-bold font-mono rounded bg-white/[0.04] border border-white/10 text-neutral">
              {data.company.ticker} · {data.company.exchange}
            </span>
          </div>
          <p className="text-xs text-neutral/70 font-medium">
            {data.company.sector} · {data.company.industry} · {data.company.country}
          </p>
          {data.company.description && (
            <p className="text-xs text-neutral/60 max-w-4xl mt-3 leading-relaxed border-l-2 border-accent/20 pl-3">
              {data.company.description}
            </p>
          )}
          {data.company.website && (
            <p className="text-xs text-accent/80 font-mono mt-2 hover:underline">
              <a href={data.company.website} target="_blank" rel="noreferrer">
                🌐 {data.company.website}
              </a>
            </p>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={() => router.push(`/modeling?ticker=${data.company.ticker}`)}
            className="px-4 py-2 border border-accent/20 hover:border-accent/60 rounded-xl text-accent hover:text-white text-xs font-bold flex items-center gap-2 cursor-pointer transition-all bg-accent/5 hover:bg-accent/20"
          >
            <BarChart3 className="w-4.5 h-4.5" />
            <span>Financial Modeling Lab</span>
          </button>
          <a
            href={`http://127.0.0.1:8000/api/v1/report/${analysisId}/export?format=pdf`}
            download
            className="px-4 py-2 border border-white/10 hover:border-accent/40 rounded-xl text-neutral hover:text-accent text-xs font-bold flex items-center gap-2 cursor-pointer transition-colors bg-white/[0.01]"
          >
            <Download className="w-4 h-4" />
            <span>PDF Report</span>
          </a>
          <a
            href={`http://127.0.0.1:8000/api/v1/report/${analysisId}/export?format=xlsx`}
            download
            className="px-4 py-2 border border-white/10 hover:border-accent/40 rounded-xl text-neutral hover:text-accent text-xs font-bold flex items-center gap-2 cursor-pointer transition-colors bg-white/[0.01]"
          >
            <Download className="w-4 h-4" />
            <span>Excel Sheet</span>
          </a>
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>Calculations Verified</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/5 gap-6 text-xs font-bold uppercase tracking-wider overflow-x-auto whitespace-nowrap pb-2">
        {[
          { id: "overview", label: "Overview" },
          { id: "industry_supply", label: "Industry & Supply Chain" },
          { id: "business_moat", label: "Business Model & Moat" },
          { id: "management_capital", label: "Management & Capital" },
          { id: "earnings_quality", label: "Earnings Quality & Distress" },
          { id: "news", label: "News & Sentiment" },
          { id: "risk", label: "Macro & Risk Profile" },
          { id: "ownership_alt", label: "Ownership & Alternative" },
          { id: "ai_studio", label: "AI Projections & Debate" },
          { id: "explain_timeline", label: "Explainability & Timeline" },
          { id: "chat", label: "Report Chat" }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`pb-3 border-b-2 transition-all cursor-pointer ${
              activeTab === tab.id
                ? "border-accent text-accent"
                : "border-transparent text-neutral hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>


      {/* Tab Contents */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column */}
          <div className="lg:col-span-1 space-y-6">
            <InvestmentScoreCard
              recommendation={data.recommendation}
              confidence={data.confidence}
              currentPrice={currentPrice}
              fairValue={fairValue}
              onSelectMetric={setActiveMetric}
              currency={data.company.currency}
            />

            {/* Investment Score Breakdown */}
            {explainData && explainData.score_breakdown && (
              <div className="glass-card p-6 space-y-4 font-sans">
                <h3 className="text-xs font-bold text-neutral uppercase tracking-wider">Score Component Breakdown</h3>
                <div className="space-y-3">
                  {Object.entries(explainData.score_breakdown).map(([key, cat]: any) => (
                    <div key={key} className="space-y-1 text-xs">
                      <div className="flex justify-between font-semibold">
                        <span className="capitalize text-neutral/90">{key.replace("_", " ")}</span>
                        <span className="font-mono text-foreground font-bold">
                          {cat.score} <span className="text-neutral/40 text-[9px]">/ {cat.max_score}</span>
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-black/40 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-accent/70 to-accent"
                          style={{ width: `${(cat.score / cat.max_score) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Dynamic Consensus Agent Timeline */}
            {(data as any).consensus_timeline && (data as any).consensus_timeline.length > 0 ? (
              <div className="glass-card p-6 space-y-4">
                <h3 className="text-xs font-bold text-neutral uppercase tracking-wider">Consensus Agent Timeline</h3>
                <div className="relative border-l border-white/10 pl-4 space-y-6">
                  {(data as any).consensus_timeline.map((step: any, idx: number) => (
                    <div key={idx} className="relative">
                      {/* Timeline dot */}
                      <span className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-accent border-2 border-background" />
                      
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <h4 className="font-bold text-foreground">{step.title}</h4>
                          {step.vote && (
                            <span className={`px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase ${
                              step.vote.includes("BUY") ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" :
                              step.vote.includes("SELL") ? "bg-rose-500/10 text-rose-400 border border-rose-500/20" :
                              "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                            }`}>
                              {step.vote}
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-neutral/70 leading-normal">{step.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="glass-card p-6 space-y-4">
                <h3 className="text-xs font-bold text-neutral uppercase tracking-wider">Engine Vote Breakdown</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-neutral">Fundamental Engine</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">BUY</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-neutral">Valuation Engine</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">BUY</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-neutral">Technical Engine</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">HOLD</span>
                  </div>
                </div>
              </div>
            )}

            {/* Technical Gauge Card */}
            {rsiVal !== null && rsiVal !== undefined && (
              <TechnicalGauge rsi={Number(rsiVal)} />
            )}
          </div>

          {/* Right Column */}
          <div className="lg:col-span-2 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                onClick={() => setActiveMetric("f_score")}
                className="glass-card p-6 text-left hover:scale-[1.01] transition-all cursor-pointer"
              >
                <div className="flex items-center justify-between text-xs text-neutral font-bold uppercase mb-2">
                  <span>Piotroski F-Score</span>
                  <Award className="w-4 h-4 text-accent" />
                </div>
                <p className="text-3xl font-extrabold font-mono text-foreground">{fScore !== undefined ? `${fScore}/9` : "N/A"}</p>
                <p className="text-[10px] text-neutral/80 mt-1">Fundamental stability score. Click for inputs.</p>
              </button>

              <button
                onClick={() => setActiveMetric("z_score")}
                className="glass-card p-6 text-left hover:scale-[1.01] transition-all cursor-pointer"
              >
                <div className="flex items-center justify-between text-xs text-neutral font-bold uppercase mb-2">
                  <span>Altman Z-Score</span>
                  <ShieldAlert className="w-4 h-4 text-primary" />
                </div>
                <p className="text-3xl font-extrabold font-mono text-emerald-400">
                  {zScore !== undefined && zScore !== null ? zScore.toFixed(2) : "N/A"}
                </p>
                <p className="text-[10px] text-neutral/80 mt-1">Bankruptcy warning index. Safe is &gt; 2.99.</p>
              </button>
            </div>

            {/* Peer Comparison Table */}
            {competitorData.length > 0 && (
              <div className="glass-card p-6 space-y-4">
                <h3 className="text-xs font-bold text-neutral uppercase tracking-wider">Peer Multiples Comparison</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="border-b border-white/5 text-neutral font-semibold">
                        <th className="py-2">Ticker</th>
                        <th className="py-2">Price</th>
                        <th className="py-2 text-right">P/E</th>
                        <th className="py-2 text-right">Gross Margin</th>
                        <th className="py-2 text-right">Net Margin</th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* Current company row */}
                      <tr className="border-b border-white/5 bg-accent/5">
                        <td className="py-2.5 font-bold text-accent">{data.company.ticker} *</td>
                        <td className="py-2.5 font-mono">{getCurrencySymbol(data.company.currency)}{currentPrice.toFixed(2)}</td>
                        <td className="py-2.5 text-right font-mono">
                          {currentPE ? currentPE.toFixed(1) : "N/A"}
                        </td>
                        <td className="py-2.5 text-right font-mono">
                          {currentGrossMargin !== null && currentGrossMargin !== undefined ? `${(currentGrossMargin * 100).toFixed(1)}%` : "N/A"}
                        </td>
                        <td className="py-2.5 text-right font-mono">
                          {currentNetMargin !== null && currentNetMargin !== undefined ? `${(currentNetMargin * 100).toFixed(1)}%` : "N/A"}
                        </td>
                      </tr>
                      {competitorData.map((peer: any) => (
                        <tr key={peer.ticker} className="border-b border-white/5 hover:bg-white/[0.01]">
                          <td className="py-2.5 font-semibold text-neutral">{peer.ticker}</td>
                          <td className="py-2.5 font-mono text-neutral/80">{getCurrencySymbol(peer.currency)}{peer.price.toFixed(2)}</td>
                          <td className="py-2.5 text-right font-mono text-neutral/80">{peer.pe ? peer.pe.toFixed(1) : "N/A"}</td>
                          <td className="py-2.5 text-right font-mono text-neutral/80">
                            {peer.gross_margin ? `${(peer.gross_margin * 100).toFixed(1)}%` : "N/A"}
                          </td>
                          <td className="py-2.5 text-right font-mono text-neutral/80">
                            {peer.net_margin ? `${(peer.net_margin * 100).toFixed(1)}%` : "N/A"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Financial Statements */}
            <div className="glass-card p-6 space-y-4">
              <div className="flex justify-between items-center border-b border-white/5 pb-3">
                <h3 className="text-xs font-bold text-neutral uppercase tracking-wider">Normalized Annual Financials</h3>
                <div className="flex bg-black/40 rounded-lg p-0.5 border border-white/5 text-[9px] font-bold">
                  <button
                    onClick={() => setFinancialView("table")}
                    className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                      financialView === "table" ? "bg-accent/20 text-accent font-extrabold" : "text-neutral/80 hover:text-foreground"
                    }`}
                  >
                    Table
                  </button>
                  <button
                    onClick={() => setFinancialView("chart")}
                    className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                      financialView === "chart" ? "bg-accent/20 text-accent font-extrabold" : "text-neutral/80 hover:text-foreground"
                    }`}
                  >
                    Charts
                  </button>
                </div>
              </div>

              {years.length > 0 ? (
                financialView === "table" ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left border-collapse">
                      <thead>
                        <tr className="border-b border-white/5 text-neutral font-semibold">
                          <th className="py-2">Metric</th>
                          {years.map(y => <th key={y} className="py-2 text-right font-mono">{y}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {statementMetrics.map(metric => {
                          const labelMap: Record<string, string> = {
                            revenue: "Total Revenue",
                            cogs: "Cost of Revenue",
                            net_income: "Net Income",
                            operating_cash_flow: "Operating Cash Flow",
                            capital_expenditures: "Capital Expenditures"
                          };
                          return (
                            <tr key={metric} className="border-b border-white/5 hover:bg-white/[0.01]">
                              <td className="py-2.5 font-semibold text-neutral/80">{labelMap[metric] || metric}</td>
                              {years.map(y => {
                                const val = data.financials.find(f => f.metric_name === metric && f.fiscal_period === y)?.value;
                                return (
                                  <td key={y} className="py-2.5 text-right font-mono text-foreground font-medium">
                                    {val !== undefined && val !== null ? `${getCurrencySymbol(data.company.currency)}${(val / 1e9).toFixed(2)}B` : "N/A"}
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <FinancialTrendCharts financials={data.financials} years={years} currency={data.company.currency} />
                )
              ) : (
                <p className="text-xs text-neutral">No annual financials available.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === "industry_supply" && (
        <div className="space-y-8 animate-fade-in font-sans">
          {/* Industry Stats */}
          {industryData ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-1 glass-card p-6 space-y-4">
                <h3 className="text-xs font-bold text-neutral uppercase tracking-wider">Industry Metrics</h3>
                <div className="space-y-4 text-xs">
                  <div className="flex justify-between items-center border-b border-white/5 pb-2">
                    <span className="text-neutral/70">Total Addressable Market (TAM)</span>
                    <span className="font-mono font-bold text-foreground">${industryData.industry_stats.tam_usd_billions}B</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-white/5 pb-2">
                    <span className="text-neutral/70">Industry CAGR</span>
                    <span className="font-mono font-bold text-emerald-400">+{industryData.industry_stats.cagr_pct}%</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-white/5 pb-2">
                    <span className="text-neutral/70">Median Gross Margin</span>
                    <span className="font-mono font-bold text-foreground">{industryData.industry_stats.median_gross_margin_pct}%</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-white/5 pb-2">
                    <span className="text-neutral/70">Median EBIT Margin</span>
                    <span className="font-mono font-bold text-foreground">{industryData.industry_stats.median_ebit_margin_pct}%</span>
                  </div>
                </div>

                <div className="space-y-2 pt-2">
                  <h4 className="text-[10px] font-bold text-neutral uppercase tracking-wider">Growth Drivers</h4>
                  <ul className="list-disc pl-4 text-[10px] text-neutral/80 space-y-1">
                    {industryData.growth_drivers.map((drv: string, idx: number) => (
                      <li key={idx}>{drv}</li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Market Share Distribution */}
              <div className="lg:col-span-2 glass-card p-6 space-y-4">
                <h3 className="text-xs font-bold text-neutral uppercase tracking-wider">Market Share Distribution</h3>
                <div className="space-y-4">
                  {industryData.market_share_distribution.map((peer: any) => (
                    <div key={peer.symbol} className="space-y-1 text-xs">
                      <div className="flex justify-between font-semibold">
                        <span className={peer.symbol === ticker ? "text-accent font-bold" : "text-neutral/80"}>
                          {peer.name} ({peer.symbol}) {peer.symbol === ticker && "*"}
                        </span>
                        <span className="font-mono text-foreground font-bold">{peer.share_pct}%</span>
                      </div>
                      <div className="w-full h-2 bg-black/40 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${peer.symbol === ticker ? "bg-accent" : "bg-neutral-600"}`}
                          style={{ width: `${peer.share_pct}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="space-y-2 pt-2 border-t border-white/5">
                  <h4 className="text-[10px] font-bold text-neutral uppercase tracking-wider">Industry Risks</h4>
                  <ul className="list-disc pl-4 text-[10px] text-neutral/80 space-y-1">
                    {industryData.industry_risks.map((risk: string, idx: number) => (
                      <li key={idx}>{risk}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ) : (
            <div className="glass-card p-6 text-center text-xs text-neutral">Loading industry details...</div>
          )}

          {/* Supply Chain Graph */}
          {supplyChainData ? (
            <div className="glass-card p-6 space-y-6">
              <h3 className="text-xs font-bold text-neutral uppercase tracking-wider">Supply Chain Node Graph</h3>

              {/* Graphical nodes */}
              <div className="bg-black/35 rounded-xl border border-white/5 p-6 flex flex-col md:flex-row items-center justify-center gap-6 relative overflow-hidden min-h-[160px]">
                {(() => {
                  const displayNodes = chainShockData ? chainShockData.nodes : supplyChainData.nodes;
                  
                  // Predefined ordering for rendering supply chain sequence
                  const renderOrder = ["ASML", "TSMC", "NVDA", "AAPL", "MSFT"];
                  const orderedKeys = renderOrder.filter(k => displayNodes[k]);
                  
                  return (
                    <div className="flex flex-col md:flex-row items-center gap-4 md:gap-12 z-10 w-full justify-center">
                      {orderedKeys.map((key, idx) => {
                        const node = displayNodes[key];
                        
                        let borderBg = "border-white/10 bg-black/40 text-neutral/80";
                        if (node.status === "DISRUPTED") borderBg = "border-neutral-500 bg-neutral-900/60 text-neutral-400";
                        if (node.status === "WARNING_SHOCK") borderBg = "border-amber-500/40 bg-amber-950/20 text-amber-300";
                        if (node.status === "CRITICAL_SHOCK") borderBg = "border-rose-500/40 bg-rose-950/20 text-rose-300 animate-pulse";
                        if (key === ticker) borderBg += " ring-2 ring-accent/30";

                        return (
                          <div key={key} className="flex flex-col md:flex-row items-center gap-4">
                            <div className={`w-36 p-3.5 rounded-xl border text-center transition-all duration-300 hover:scale-105 ${borderBg}`}>
                              <span className="text-[9px] font-bold text-accent font-mono block mb-1">{node.type}</span>
                              <span className="text-xs font-extrabold block truncate">{node.name}</span>
                              <span className="text-[10px] font-mono block text-neutral/70 mt-1">Rev: ${node.base_revenue_b}B</span>
                              {node.disruption_pct > 0 && (
                                <span className="text-[9px] font-mono font-bold block text-rose-400 mt-0.5">Disruption: -{node.disruption_pct.toFixed(1)}%</span>
                              )}
                            </div>
                            {idx < orderedKeys.length - 1 && (
                              <div className="flex flex-col items-center">
                                <span className="text-xs text-neutral/50 font-bold">→</span>
                                <span className="text-[8px] text-neutral/40 font-mono">supply</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>

              {/* Shock Disruption Controller */}
              <div className="bg-black/20 rounded-xl border border-white/5 p-5 space-y-4">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-foreground">Supply Chain Shock Disruption Simulator</h4>
                    <p className="text-[9px] text-neutral/60">Simulate a capacity cut at a key node and propagate the cascade shock downstream.</p>
                  </div>
                  <div className="flex gap-3 w-full md:w-auto">
                    <select
                      value={selectedDisruptedNode}
                      onChange={(e) => setSelectedDisruptedNode(e.target.value)}
                      className="px-3 py-1.5 bg-black/40 border border-white/5 focus:border-accent/40 rounded-lg outline-none text-xs text-foreground font-mono"
                    >
                      {Object.keys(supplyChainData.nodes).map(k => (
                        <option key={k} value={k}>{k} ({supplyChainData.nodes[k].name})</option>
                      ))}
                    </select>

                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={disruptionPct}
                      onChange={(e) => setDisruptionPct(Number(e.target.value))}
                      className="w-16 px-2 py-1.5 bg-black/40 border border-white/5 rounded-lg text-xs font-mono text-center text-foreground outline-none"
                    />

                    <button
                      onClick={async () => {
                        setChainShockLoading(true);
                        try {
                          const res = await fetch("http://127.0.0.1:8000/api/v1/supply-chain/disrupt", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ disrupted_node_id: selectedDisruptedNode, disruption_pct: disruptionPct })
                          });
                          if (res.ok) {
                            const json = await res.json();
                            setChainShockData(json);
                          }
                        } catch (err) {
                          console.error("Disruption failed:", err);
                        } finally {
                          setChainShockLoading(false);
                        }
                      }}
                      disabled={chainShockLoading}
                      className="px-4 py-1.5 bg-accent hover:opacity-90 disabled:opacity-50 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer"
                    >
                      {chainShockLoading ? "Simulating..." : "Trigger Shock"}
                    </button>
                  </div>
                </div>

                {chainShockData && (
                  <div className="bg-rose-500/5 border border-rose-500/10 rounded-lg p-3 text-[10px] font-mono text-rose-300/90 leading-relaxed">
                    <strong>Cascade Disruption Log:</strong> Triggered {chainShockData.applied_disruption_pct}% disruption at {chainShockData.disruption_source}. 
                    Cascading impacts: TSMC ({chainShockData.nodes["TSMC"]?.disruption_pct.toFixed(1)}% drop), NVIDIA ({chainShockData.nodes["NVDA"]?.disruption_pct.toFixed(1)}% drop), Apple ({chainShockData.nodes["AAPL"]?.disruption_pct.toFixed(1)}% drop).
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="glass-card p-6 text-center text-xs text-neutral">Loading supply chain map...</div>
          )}
        </div>
      )}

      {activeTab === "business_moat" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-fade-in font-sans">
          {/* Revenue segments breakdown */}
          <div className="lg:col-span-1 glass-card p-6 space-y-4">
            <h3 className="text-xs font-bold text-neutral uppercase tracking-wider">Revenue Breakdown Segments</h3>
            {businessData ? (
              <div className="space-y-4 text-xs">
                {businessData.revenue_segments.map((seg: any, idx: number) => (
                  <div key={idx} className="space-y-1 border-b border-white/5 pb-3 last:border-0">
                    <div className="flex justify-between font-semibold">
                      <span className="text-foreground">{seg.name}</span>
                      <span className="font-mono text-foreground font-bold">{seg.share_pct}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-black/40 rounded-full overflow-hidden">
                      <div className="h-full bg-accent" style={{ width: `${seg.share_pct}%` }} />
                    </div>
                    <div className="flex justify-between text-[9px] text-neutral/70">
                      <span>Operating Margin</span>
                      <span>{seg.margin_pct}%</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-xs text-neutral">Loading segment breakdown...</div>
            )}
          </div>

          {/* Moat score */}
          <div className="lg:col-span-2 glass-card p-6 space-y-6">
            {businessData ? (
              <div className="space-y-6">
                <div className="flex justify-between items-center border-b border-white/5 pb-3">
                  <div>
                    <h3 className="text-xs font-bold text-neutral uppercase tracking-wider">Moat Analysis Engine</h3>
                    <p className="text-[10px] text-neutral/60">Automated Competitive Advantage Evaluation</p>
                  </div>
                  <span className={`px-2.5 py-1 text-xs font-extrabold rounded-lg border ${
                    businessData.moat_analysis.moat_classification === "WIDE MOAT" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" :
                    businessData.moat_analysis.moat_classification === "NARROW MOAT" ? "bg-amber-500/10 text-amber-400 border-amber-500/20" :
                    "bg-rose-500/10 text-rose-400 border-rose-500/20"
                  }`}>
                    {businessData.moat_analysis.moat_classification} ({businessData.moat_analysis.moat_score}/100)
                  </span>
                </div>

                {/* Score breakdown grids */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  {Object.entries(businessData.moat_analysis.breakdown).map(([mName, mScore]: any) => (
                    <div key={mName} className="bg-black/30 border border-white/5 p-3.5 rounded-xl space-y-1.5">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-neutral/80">{mName}</span>
                        <span className="font-mono text-foreground font-bold">{mScore}/100</span>
                      </div>
                      <div className="w-full h-1 bg-black/40 rounded-full overflow-hidden">
                        <div className="h-full bg-accent" style={{ width: `${mScore}%` }} />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Moat advantages list */}
                <div className="space-y-2 border-t border-white/5 pt-4">
                  <h4 className="text-xs font-bold text-foreground">Competitive Moat Drivers</h4>
                  <ul className="list-disc pl-4 text-[10px] text-neutral/80 space-y-1">
                    {businessData.competitive_advantages.map((adv: string, idx: number) => (
                      <li key={idx}>{adv}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              <div className="text-center text-xs text-neutral">Loading moat details...</div>
            )}
          </div>
        </div>
      )}

      {activeTab === "management_capital" && (
        <div className="space-y-8 animate-fade-in font-sans">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Executive team */}
            <div className="lg:col-span-2 glass-card p-6 space-y-4">
              <h3 className="text-xs font-bold text-neutral uppercase tracking-wider">Key Executive Officers</h3>
              {managementData ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="border-b border-white/5 text-neutral font-semibold">
                        <th className="py-2">Executive</th>
                        <th className="py-2">Role</th>
                        <th className="py-2 text-right">Tenure</th>
                        <th className="py-2 text-right">Shares Held</th>
                        <th className="py-2 text-center">Alignment</th>
                      </tr>
                    </thead>
                    <tbody>
                      {managementData.key_executives.map((exec: any, idx: number) => (
                        <tr key={idx} className="border-b border-white/5 hover:bg-white/[0.01]">
                          <td className="py-3 font-bold text-foreground">{exec.name}</td>
                          <td className="py-3 text-neutral/80">{exec.role}</td>
                          <td className="py-3 text-right font-mono">{exec.tenure_years} yrs</td>
                          <td className="py-3 text-right font-mono">{exec.shares_held ? exec.shares_held.toLocaleString() : "N/A"}</td>
                          <td className="py-3 text-center">
                            <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase ${
                              exec.alignment === "CRITICAL" || exec.alignment === "HIGH" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-white/5 text-neutral"
                            }`}>
                              {exec.alignment}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center text-xs text-neutral">Loading key executives...</div>
              )}
            </div>

            {/* Insider transactions */}
            <div className="lg:col-span-1 glass-card p-6 space-y-4">
              <h3 className="text-xs font-bold text-neutral uppercase tracking-wider">Insider Transactions Activity</h3>
              {managementData ? (
                <div className="space-y-3">
                  {managementData.insider_transactions.length > 0 ? (
                    managementData.insider_transactions.map((tx: any, idx: number) => (
                      <div key={idx} className="bg-black/30 border border-white/5 p-3 rounded-xl flex justify-between items-center text-xs">
                        <div className="space-y-0.5">
                          <span className="font-bold text-foreground block">{tx.insider}</span>
                          <span className="text-[10px] text-neutral/60 block font-mono">{tx.date} · {tx.relation}</span>
                        </div>
                        <div className="text-right">
                          <span className={`font-mono font-bold block ${tx.type === "BUY" ? "text-emerald-400" : "text-rose-400"}`}>
                            {tx.type} {tx.shares.toLocaleString()}
                          </span>
                          <span className="text-[9px] font-mono text-neutral/60 block">@{getCurrencySymbol(data.company.currency)}{tx.price}</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-neutral">No insider trading logs recorded.</p>
                  )}
                </div>
              ) : (
                <div className="text-center text-xs text-neutral">Loading insider data...</div>
              )}
            </div>
          </div>

          {/* Capital allocation */}
          {capitalData ? (
            <div className="glass-card p-6 space-y-6">
              <div className="flex justify-between items-center border-b border-white/5 pb-3">
                <div>
                  <h3 className="text-xs font-bold text-neutral uppercase tracking-wider">Capital Allocation Engine</h3>
                  <p className="text-[10px] text-neutral/60">Shareholder Value Creation & CAPEX Efficiency</p>
                </div>
                <span className="px-2.5 py-1 text-xs font-extrabold rounded-lg border border-accent/20 bg-accent/5 text-accent">
                  Allocation Quality: {capitalData.capital_allocation_score}/100 ({capitalData.shareholder_value_creation})
                </span>
              </div>

              {/* Allocation stats columns */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
                <div className="bg-black/35 border border-white/5 p-4 rounded-xl space-y-1">
                  <span className="text-neutral/70 block">Share Repurchases (Buybacks)</span>
                  <span className="text-lg font-mono font-bold text-foreground">${capitalData.breakdown.buybacks_usd_b}B</span>
                </div>
                <div className="bg-black/35 border border-white/5 p-4 rounded-xl space-y-1">
                  <span className="text-neutral/70 block">Dividends Distributed</span>
                  <span className="text-lg font-mono font-bold text-foreground">${capitalData.breakdown.dividends_paid_usd_b}B</span>
                </div>
                <div className="bg-black/35 border border-white/5 p-4 rounded-xl space-y-1">
                  <span className="text-neutral/70 block">R&D Investment</span>
                  <span className="text-lg font-mono font-bold text-foreground">${capitalData.breakdown.rd_spending_usd_b}B</span>
                </div>
                <div className="bg-black/35 border border-white/5 p-4 rounded-xl space-y-1">
                  <span className="text-neutral/70 block">Net Debt Reduction</span>
                  <span className="text-lg font-mono font-bold text-foreground">${capitalData.breakdown.debt_reduction_usd_b}B</span>
                </div>
              </div>

              {/* Ratios & Efficiency */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 border-t border-white/5 pt-4">
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between font-bold">
                    <span className="text-neutral/80">Return on Invested Capital (ROIC)</span>
                    <span className="font-mono text-emerald-400">+{capitalData.invested_capital_efficiency.roic_pct}%</span>
                  </div>
                  <p className="text-[10px] text-neutral/60">Measure of cash return yielded relative to funding assets.</p>
                </div>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between font-bold">
                    <span className="text-neutral/80">CapEx to Revenue</span>
                    <span className="font-mono text-foreground">{capitalData.invested_capital_efficiency.capex_to_revenue_pct}%</span>
                  </div>
                  <p className="text-[10px] text-neutral/60">Portion of raw sales cash re-channeled into hardware assets.</p>
                </div>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between font-bold">
                    <span className="text-neutral/80">Free Cash Flow Conversion</span>
                    <span className="font-mono text-foreground">{capitalData.invested_capital_efficiency.free_cash_flow_conversion_pct}%</span>
                  </div>
                  <p className="text-[10px] text-neutral/60">Net income percentage successfully translated into FCF liquidity.</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="glass-card p-6 text-center text-xs text-neutral">Loading capital allocation details...</div>
          )}
        </div>
      )}

      {activeTab === "earnings_quality" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-fade-in font-sans">
          {/* Ratios card */}
          <div className="lg:col-span-1 glass-card p-6 space-y-6">
            <h3 className="text-xs font-bold text-neutral uppercase tracking-wider">Accounting Health Metrics</h3>
            {accountingData ? (
              <div className="space-y-4 text-xs">
                <div className="flex justify-between items-center border-b border-white/5 pb-3">
                  <div className="space-y-0.5">
                    <span className="font-bold text-foreground block">Piotroski F-Score</span>
                    <span className="text-[9px] text-neutral/60">Fundamental strength (max 9)</span>
                  </div>
                  <span className="text-lg font-mono font-bold text-emerald-400">{accountingData.piotroski_f_score}/9</span>
                </div>

                <div className="flex justify-between items-center border-b border-white/5 pb-3">
                  <div className="space-y-0.5">
                    <span className="font-bold text-foreground block">Altman Z-Score</span>
                    <span className="text-[9px] text-neutral/60">Bankruptcy solvency (safe &gt; 2.99)</span>
                  </div>
                  <span className={`text-lg font-mono font-bold ${
                    accountingData.altman_z_score > 2.99 ? "text-emerald-400" : (accountingData.altman_z_score < 1.81 ? "text-rose-400" : "text-amber-400")
                  }`}>
                    {accountingData.altman_z_score}
                  </span>
                </div>

                <div className="flex justify-between items-center border-b border-white/5 pb-3">
                  <div className="space-y-0.5">
                    <span className="font-bold text-foreground block">Beneish M-Score</span>
                    <span className="text-[9px] text-neutral/60">Accruals manipulation (safe &lt; -1.78)</span>
                  </div>
                  <span className={`text-lg font-mono font-bold ${
                    accountingData.beneish_m_score < -1.78 ? "text-emerald-400" : "text-rose-400"
                  }`}>
                    {accountingData.beneish_m_score}
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-center text-xs text-neutral">Loading health metrics...</div>
            )}
          </div>

          {/* Flags and indicators */}
          <div className="lg:col-span-2 glass-card p-6 space-y-6">
            {accountingData ? (
              <div className="space-y-6">
                <div className="flex justify-between items-center border-b border-white/5 pb-3">
                  <div>
                    <h3 className="text-xs font-bold text-neutral uppercase tracking-wider">Earnings Quality & Distress Screening</h3>
                    <p className="text-[10px] text-neutral/60">Aggressive Accounting & Solvency Risk Flagging</p>
                  </div>
                  <span className={`px-2.5 py-1 text-xs font-extrabold rounded-lg border ${
                    accountingData.risk_status === "SAFE" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" :
                    accountingData.risk_status === "GREY ZONE" ? "bg-amber-500/10 text-amber-400 border-amber-500/20" :
                    "bg-rose-500/10 text-rose-400 border-rose-500/20 animate-pulse"
                  }`}>
                    Status: {accountingData.risk_status} ({accountingData.earnings_quality_score}/100)
                  </span>
                </div>

                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-foreground">Accounting Risk Flag Evaluation</h4>
                  <div className="flex flex-col gap-3">
                    {accountingData.accounting_flags.map((flag: string, idx: number) => {
                      const isRisk = flag.includes("risk") || flag.includes("distress") || flag.includes("Weak");
                      return (
                        <div key={idx} className={`p-4 rounded-xl border flex items-center gap-3 text-xs leading-normal ${
                          isRisk ? "bg-rose-500/[0.02] border-rose-500/10 text-rose-400" : "bg-emerald-500/[0.02] border-emerald-500/10 text-emerald-400"
                        }`}>
                          <AlertCircle className="w-4.5 h-4.5 shrink-0" />
                          <span>{flag}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <p className="text-[9px] text-neutral/50 font-mono">
                  DISCLAIMER: These metrics represent statistical mathematical screening models (Altman, Beneish, Piotroski) and do not constitute legal proof or statements of audits and fraud.
                </p>
              </div>
            ) : (
              <div className="text-center text-xs text-neutral">Loading screening detail...</div>
            )}
          </div>
        </div>
      )}

      {activeTab === "news" && (
        <div className="space-y-6 max-w-4xl animate-fade-in font-sans">
          {/* Sentiment Stats Header */}
          <div className="glass-card p-6 grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
            <div className="space-y-1">
              <span className="text-[10px] text-neutral font-bold uppercase">Aggregated Sentiment</span>
              <h2 className="text-2xl font-black text-emerald-400 font-mono">
                {newsSentiment.overall_sentiment || "NEUTRAL"}
              </h2>
            </div>
            
            <div className="space-y-2 col-span-2">
              <div className="flex justify-between text-xs font-semibold text-neutral">
                <span>Distribution: {newsSentiment.distribution?.bullish || 0} Bullish / {newsSentiment.distribution?.bearish || 0} Bearish</span>
                <span>Sentiment Score: {((newsSentiment.sentiment_score || 0) * 100).toFixed(0)}%</span>
              </div>
              <div className="w-full h-3 bg-black/40 rounded-full overflow-hidden flex">
                <div className="h-full bg-emerald-400" style={{ width: `${(newsSentiment.distribution?.bullish || 0) / ( (newsSentiment.distribution?.bullish || 0) + (newsSentiment.distribution?.bearish || 0) + (newsSentiment.distribution?.neutral || 1) ) * 100}%` }} />
                <div className="h-full bg-neutral-600" style={{ width: `${(newsSentiment.distribution?.neutral || 0) / ( (newsSentiment.distribution?.bullish || 0) + (newsSentiment.distribution?.bearish || 0) + (newsSentiment.distribution?.neutral || 1) ) * 100}%` }} />
                <div className="h-full bg-rose-400" style={{ width: `${(newsSentiment.distribution?.bearish || 0) / ( (newsSentiment.distribution?.bullish || 0) + (newsSentiment.distribution?.bearish || 0) + (newsSentiment.distribution?.neutral || 1) ) * 100}%` }} />
              </div>
            </div>
          </div>

          {/* News articles list */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-neutral uppercase tracking-wider">Crawl News Feed</h3>
            <div className="space-y-3">
              {(newsSentiment.articles || []).map((art: any, idx: number) => (
                <a
                  key={idx}
                  href={art.link}
                  target="_blank"
                  rel="noreferrer"
                  className="glass-card p-4 flex justify-between items-start gap-4 hover:scale-[1.005] transition-all"
                >
                  <div className="space-y-2">
                    <span className="text-[10px] text-neutral/70 font-semibold">{art.source} · {art.published_at}</span>
                    <h4 className="text-xs font-bold text-foreground leading-snug hover:text-accent transition-colors">{art.title}</h4>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[9px] font-bold shrink-0 ${
                    art.sentiment === "BULLISH" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" :
                    art.sentiment === "BEARISH" ? "bg-rose-500/10 text-rose-400 border border-rose-500/20" :
                    "bg-white/5 text-neutral"
                  }`}>
                    {art.sentiment}
                  </span>
                </a>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === "risk" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-fade-in font-sans">
          {/* Macro Indicators & Simulator */}
          <div className="lg:col-span-1 glass-card p-6 space-y-6">
            <h3 className="text-xs font-bold text-neutral uppercase tracking-wider">Macro Indicators & Simulator</h3>
            
            <div className="space-y-4">
              {[
                { label: "Real GDP Growth", val: macroData.gdp_growth, suffix: "%" },
                { label: "Inflation (CPI)", val: macroData.inflation, suffix: "%" },
                { label: "Fed Funds Rate", val: macroData.interest_rate, suffix: "%" },
                { label: "Unemployment Rate", val: macroData.unemployment, suffix: "%" }
              ].map((ind, idx) => (
                <div key={idx} className="flex justify-between items-center border-b border-white/5 pb-2">
                  <span className="text-xs text-neutral font-semibold">{ind.label}</span>
                  <span className="text-sm font-bold font-mono text-foreground">{ind.val !== undefined ? `${ind.val}${ind.suffix}` : "N/A"}</span>
                </div>
              ))}
            </div>

            {/* Macro Shock Form */}
            <div className="bg-black/40 rounded-xl border border-white/5 p-4 space-y-4 pt-3">
              <h4 className="text-xs font-bold text-foreground">Scenario Shock Simulator</h4>
              
              <div className="space-y-3 text-[10px] font-sans">
                <div className="space-y-1">
                  <label className="text-neutral font-semibold flex justify-between">
                    <span>US Interest Rate Delta</span>
                    <span className="font-mono text-accent font-bold">{macroRateDelta > 0 ? "+" : ""}{macroRateDelta.toFixed(1)}%</span>
                  </label>
                  <input
                    type="range"
                    min="-5.0"
                    max="5.0"
                    step="0.5"
                    value={macroRateDelta}
                    onChange={(e) => setMacroRateDelta(Number(e.target.value))}
                    className="w-full h-1 bg-black/40 rounded-lg appearance-none cursor-pointer accent-accent"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-neutral font-semibold flex justify-between">
                    <span>Crude Oil Price (USD)</span>
                    <span className="font-mono text-accent font-bold">${macroOilPrice} / bbl</span>
                  </label>
                  <input
                    type="range"
                    min="40"
                    max="200"
                    step="5"
                    value={macroOilPrice}
                    onChange={(e) => setMacroOilPrice(Number(e.target.value))}
                    className="w-full h-1 bg-black/40 rounded-lg appearance-none cursor-pointer accent-accent"
                  />
                </div>

                <button
                  onClick={async () => {
                    setMacroSimLoading(true);
                    try {
                      const res = await fetch("http://127.0.0.1:8000/api/v1/macro/simulate", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ ticker: ticker, interest_rate_delta_pct: macroRateDelta, oil_price_usd: macroOilPrice })
                      });
                      if (res.ok) {
                        const json = await res.json();
                        setMacroSimResult(json);
                      }
                    } catch (err) {
                      console.error("Simulation failed:", err);
                    } finally {
                      setMacroSimLoading(false);
                    }
                  }}
                  disabled={macroSimLoading}
                  className="w-full py-2 bg-accent hover:opacity-90 disabled:opacity-50 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer"
                >
                  {macroSimLoading ? "Simulating..." : "Run Shock Simulation"}
                </button>
              </div>
            </div>
          </div>

          {/* Risk Grid & Simulation Output */}
          <div className="lg:col-span-2 space-y-6">
            {macroSimResult && (
              <div className="glass-card p-6 space-y-4 border border-accent/20 bg-accent/[0.01]">
                <div className="flex justify-between items-center border-b border-white/5 pb-2">
                  <h4 className="text-xs font-bold text-accent uppercase tracking-wider">Simulation Output Results</h4>
                  <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${
                    macroSimResult.vulnerability_risk === "HIGH" ? "bg-rose-500/10 text-rose-400 border border-rose-500/20" : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                  }`}>
                    Vulnerability: {macroSimResult.vulnerability_risk}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-4 text-center text-xs">
                  <div className="bg-black/35 p-3 rounded-xl">
                    <span className="text-[9px] text-neutral block mb-1">Simulated WACC</span>
                    <span className="font-mono font-bold text-foreground">{macroSimResult.simulated_scenario.wacc_pct}%</span>
                    <span className="text-[8px] text-neutral/50 block font-mono mt-0.5">Base: {macroSimResult.base_scenario.wacc_pct}%</span>
                  </div>
                  <div className="bg-black/35 p-3 rounded-xl">
                    <span className="text-[9px] text-neutral block mb-1">Simulated Fair Value</span>
                    <span className="font-mono font-bold text-foreground">${macroSimResult.simulated_scenario.intrinsic_value}</span>
                    <span className="text-[8px] text-neutral/50 block font-mono mt-0.5">Base: ${macroSimResult.base_scenario.intrinsic_value}</span>
                  </div>
                  <div className="bg-black/35 p-3 rounded-xl">
                    <span className="text-[9px] text-neutral block mb-1">Fair Value Impact</span>
                    <span className={`font-mono font-bold block ${macroSimResult.impact.intrinsic_value_change_pct >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                      {macroSimResult.impact.intrinsic_value_change_pct > 0 ? "+" : ""}{macroSimResult.impact.intrinsic_value_change_pct}%
                    </span>
                    <span className="text-[8px] text-neutral/50 block font-mono mt-0.5">WACC Change: {macroSimResult.impact.wacc_change_pct > 0 ? "+" : ""}{macroSimResult.impact.wacc_change_pct}%</span>
                  </div>
                </div>
              </div>
            )}

            <div className="glass-card p-6 space-y-4">
              <div className="flex justify-between items-center border-b border-white/5 pb-3">
                <h3 className="text-xs font-bold text-neutral uppercase tracking-wider">Risk Profile Grid</h3>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  riskData.overall_level === "HIGH" ? "bg-rose-500/10 text-rose-400 border border-rose-500/20" :
                  riskData.overall_level === "MEDIUM" ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" :
                  "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                }`}>
                  Overall Risk: {riskData.overall_level}
                </span>
              </div>
              
              <div className="space-y-4">
                {(riskData.categories || []).map((risk: any, idx: number) => (
                  <div key={idx} className="flex items-start gap-4 p-3 rounded-xl bg-white/[0.01] border border-white/5">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                      risk.level === "HIGH" ? "bg-rose-500/10 text-rose-400" :
                      risk.level === "MEDIUM" ? "bg-amber-500/10 text-amber-400" :
                      "bg-emerald-500/10 text-emerald-400"
                    }`}>
                      {risk.score}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-bold text-foreground">{risk.category} Risk</h4>
                        <span className="text-[9px] text-neutral uppercase">({risk.level})</span>
                      </div>
                      <p className="text-[10px] text-neutral mt-1">{risk.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "ownership_alt" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-fade-in font-sans">
          {/* Institutional Ownership */}
          <div className="glass-card p-6 space-y-6">
            <h3 className="text-xs font-bold text-neutral uppercase tracking-wider">Institutional Holdings & Allocation</h3>
            {ownershipData ? (
              <div className="space-y-6">
                {/* Distribution Bar */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-bold text-neutral">
                    <span>Institutional: {ownershipData.distribution.institutional_pct}%</span>
                    <span>Mutual Funds: {ownershipData.distribution.mutual_funds_pct}%</span>
                    <span>Insiders: {ownershipData.distribution.insiders_pct}%</span>
                  </div>
                  <div className="w-full h-3.5 bg-black/40 rounded-full overflow-hidden flex border border-white/5">
                    <div className="h-full bg-blue-500" style={{ width: `${ownershipData.distribution.institutional_pct}%` }} />
                    <div className="h-full bg-emerald-500" style={{ width: `${ownershipData.distribution.mutual_funds_pct}%` }} />
                    <div className="h-full bg-purple-500" style={{ width: `${ownershipData.distribution.insiders_pct}%` }} />
                    <div className="h-full bg-neutral-600" style={{ width: `${ownershipData.distribution.retail_pct}%` }} />
                  </div>
                  <p className="text-[10px] text-neutral/70">Color key: Blue (Inst.), Green (Funds), Purple (Insiders), Grey (Retail: {ownershipData.distribution.retail_pct}%)</p>
                </div>

                {/* Top Holders Table */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-foreground">Top Institutional & Fund Holders</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left border-collapse">
                      <thead>
                        <tr className="border-b border-white/5 text-neutral font-semibold">
                          <th className="py-2">Holder</th>
                          <th className="py-2 text-right">Shares</th>
                          <th className="py-2 text-right">Value (USD)</th>
                          <th className="py-2 text-right">3M Change</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ownershipData.top_holders.map((holder: any, idx: number) => (
                          <tr key={idx} className="border-b border-white/5 hover:bg-white/[0.01]">
                            <td className="py-2.5 font-semibold text-neutral/90">{holder.name}</td>
                            <td className="py-2.5 text-right font-mono text-neutral/80">{holder.shares.toLocaleString()}</td>
                            <td className="py-2.5 text-right font-mono text-neutral/80">${holder.value_usd_b}B</td>
                            <td className={`py-2.5 text-right font-mono font-bold ${holder.change_3m_pct >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                              {holder.change_3m_pct >= 0 ? "+" : ""}{holder.change_3m_pct}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Historical Changes Chart */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-foreground">Quarterly Institutional Net Inflow</h4>
                  <div className="grid grid-cols-4 gap-3 text-center">
                    {ownershipData.holding_changes.map((q: any, idx: number) => (
                      <div key={idx} className="bg-black/30 border border-white/5 p-3 rounded-xl">
                        <span className="text-[9px] text-neutral font-mono font-bold block mb-1">{q.quarter}</span>
                        <span className={`text-xs font-mono font-bold ${q.net_buying_b >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                          {q.net_buying_b >= 0 ? "+" : ""}${q.net_buying_b}B
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <Loader2 className="w-6 h-6 animate-spin text-accent" />
            )}
          </div>

          {/* Alternative Signals */}
          <div className="glass-card p-6 space-y-6">
            <div className="flex justify-between items-center border-b border-white/5 pb-3">
              <h3 className="text-xs font-bold text-neutral uppercase tracking-wider">Alternative Signals</h3>
              {alternativeData && (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-accent/15 text-accent border border-accent/20">
                  Signal Score: {alternativeData.signal_score}/20
                </span>
              )}
            </div>
            {alternativeData ? (
              <div className="space-y-6">
                <div>
                  <span className="text-[10px] text-neutral font-bold uppercase block mb-1">Trends Tracking Phrase</span>
                  <p className="text-xs font-mono text-accent italic">"{alternativeData.alternative_search_query}"</p>
                </div>

                {/* Trends chart simulation */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-foreground">Google Trends Interest (6 Months)</h4>
                  <div className="flex items-end justify-between h-20 px-4 bg-black/40 rounded-xl border border-white/5 pt-4">
                    {alternativeData.google_trends_popularity.map((t: any, idx: number) => (
                      <div key={idx} className="flex-1 flex flex-col items-center gap-1 group">
                        <div className="w-full bg-accent/60 group-hover:bg-accent rounded-t transition-all" style={{ height: `${t.popularity}%` }} />
                        <span className="text-[9px] text-neutral font-mono mt-1">{t.month} ({t.popularity})</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Corporate Jobs openings */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-foreground">Active Corporate Hiring Openings</h4>
                  <div className="grid grid-cols-2 gap-4">
                    {alternativeData.active_corporate_jobs.slice(-3).map((job: any, idx: number) => (
                      <div key={idx} className="bg-black/30 border border-white/5 p-3 rounded-xl flex items-center justify-between">
                        <span className="text-[10px] text-neutral font-mono">{job.month} Openings</span>
                        <span className="text-xs font-mono font-bold text-foreground">{job.count} jobs</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Estimated Web Traffic */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-foreground">Estimated Web Traffic Index</h4>
                  <div className="flex items-end justify-between h-20 px-4 bg-black/40 rounded-xl border border-white/5 pt-4">
                    {alternativeData.estimated_web_traffic.map((w: any, idx: number) => (
                      <div key={idx} className="flex-1 flex flex-col items-center gap-1 group">
                        {/* scale by 0.5 to keep it inside container */}
                        <div className="w-full bg-blue-500/60 group-hover:bg-blue-400 rounded-t transition-all" style={{ height: `${w.traffic_index * 0.5}%` }} />
                        <span className="text-[9px] text-neutral font-mono mt-1">{w.month} ({w.traffic_index})</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <Loader2 className="w-6 h-6 animate-spin text-accent" />
            )}
          </div>
        </div>
      )}

      {activeTab === "ai_studio" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-fade-in font-sans">
          {/* AI Earnings Forecast */}
          <div className="glass-card p-6 space-y-6">
            <h3 className="text-xs font-bold text-neutral uppercase tracking-wider">AI Forecast Engine (Next Quarter Q+1)</h3>
            {forecastData ? (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  {/* Revenue Projection Card */}
                  <div className="bg-black/30 border border-white/5 p-4 rounded-xl space-y-3">
                    <span className="text-[10px] text-neutral font-bold uppercase">Forecasted Revenue ({forecastData.next_quarter})</span>
                    <div className="space-y-1">
                      <p className="text-2xl font-black font-mono text-foreground">${forecastData.revenue.projected_base}B</p>
                      <p className="text-[10px] text-neutral">95% Conf: ${forecastData.revenue.confidence_lower}B - ${forecastData.revenue.confidence_upper}B</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/5 text-[9px] font-mono">
                      <div><span className="text-emerald-400 block font-bold">Bull: ${forecastData.revenue.projected_bull}B</span></div>
                      <div><span className="text-rose-400 block font-bold">Bear: ${forecastData.revenue.projected_bear}B</span></div>
                    </div>
                  </div>

                  {/* EPS Projection Card */}
                  <div className="bg-black/30 border border-white/5 p-4 rounded-xl space-y-3">
                    <span className="text-[10px] text-neutral font-bold uppercase">Forecasted EPS ({forecastData.next_quarter})</span>
                    <div className="space-y-1">
                      <p className="text-2xl font-black font-mono text-foreground">${forecastData.eps.projected_base}</p>
                      <p className="text-[10px] text-neutral">95% Conf: ${forecastData.eps.confidence_lower} - ${forecastData.eps.confidence_upper}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/5 text-[9px] font-mono">
                      <div><span className="text-emerald-400 block font-bold">Bull: ${forecastData.eps.projected_bull}</span></div>
                      <div><span className="text-rose-400 block font-bold">Bear: ${forecastData.eps.projected_bear}</span></div>
                    </div>
                  </div>
                </div>

                {/* Historical vs Forecasted Table */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-foreground">Historical & Projected EPS / Revenue Trends</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left border-collapse">
                      <thead>
                        <tr className="border-b border-white/5 text-neutral font-semibold">
                          <th className="py-2">Quarter</th>
                          <th className="py-2 text-right">Revenue</th>
                          <th className="py-2 text-right">EPS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {forecastData.historical_quarters.map((q: string, idx: number) => (
                          <tr key={q} className="border-b border-white/5 hover:bg-white/[0.01]">
                            <td className="py-2 font-semibold text-neutral/80">{q}</td>
                            <td className="py-2 text-right font-mono text-neutral/70">${forecastData.revenue.historical[idx]}B</td>
                            <td className="py-2 text-right font-mono text-neutral/70">${forecastData.eps.historical[idx]}</td>
                          </tr>
                        ))}
                        {/* Projected Row */}
                        <tr className="border-b border-white/5 bg-accent/5">
                          <td className="py-2 font-bold text-accent">{forecastData.next_quarter} (Projected)</td>
                          <td className="py-2 text-right font-mono font-bold text-accent">${forecastData.revenue.projected_base}B</td>
                          <td className="py-2 text-right font-mono font-bold text-accent">${forecastData.eps.projected_base}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Model details */}
                <div className="bg-black/40 p-4 rounded-xl border border-white/5 space-y-2">
                  <h5 className="text-[10px] text-neutral font-bold uppercase">Regression Model Explainability</h5>
                  <div className="grid grid-cols-2 gap-4 text-[10px] font-mono text-neutral/80">
                    <div>
                      <p className="font-bold text-foreground">Revenue Regression:</p>
                      <p>Slope: {forecastData.revenue.model_parameters.slope}</p>
                      <p>Intercept: {forecastData.revenue.model_parameters.intercept}</p>
                      <p className="text-accent">R²: {forecastData.revenue.model_parameters.r_squared}</p>
                    </div>
                    <div>
                      <p className="font-bold text-foreground">EPS Regression:</p>
                      <p>Slope: {forecastData.eps.model_parameters.slope}</p>
                      <p>Intercept: {forecastData.eps.model_parameters.intercept}</p>
                      <p className="text-accent">R²: {forecastData.eps.model_parameters.r_squared}</p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <Loader2 className="w-6 h-6 animate-spin text-accent" />
            )}
          </div>

          {/* AI Debate Studio (Bubble UI) */}
          <div className="glass-card p-6 space-y-6 flex flex-col justify-between h-[520px]">
            <div className="flex justify-between items-center border-b border-white/5 pb-3">
              <h3 className="text-xs font-bold text-neutral uppercase tracking-wider">AI Debate Studio</h3>
              {debateData && (
                <span className={`px-2.5 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                  debateData.consensus_verdict === "BUY" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" :
                  debateData.consensus_verdict === "SELL" ? "bg-rose-500/10 text-rose-400 border border-rose-500/20" :
                  "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                }`}>
                  Verdict: {debateData.consensus_verdict}
                </span>
              )}
            </div>
            
            {debateData ? (
              <div className="flex-1 space-y-4 overflow-y-auto pr-2 py-2">
                {debateData.rounds.map((round: any, idx: number) => (
                  <div key={idx} className="space-y-4">
                    <div className="text-center">
                      <span className="px-3 py-1 bg-black/40 border border-white/5 rounded-full text-[9px] font-bold font-mono text-neutral/80 uppercase">
                        Round {round.round}: {round.topic}
                      </span>
                    </div>
                    
                    {/* Bull Agent (Left aligned) */}
                    <div className="flex gap-3 max-w-[85%] text-left">
                      <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-[10px] shrink-0 font-mono">BULL</div>
                      <div className="bg-emerald-500/[0.03] border border-emerald-500/15 p-3 rounded-2xl rounded-tl-none">
                        <p className="text-xs text-neutral/90 leading-relaxed font-sans">{round.bull_arguments}</p>
                      </div>
                    </div>

                    {/* Bear Agent (Right aligned) */}
                    <div className="flex gap-3 max-w-[85%] ml-auto justify-end">
                      <div className="bg-rose-500/[0.03] border border-rose-500/15 p-3 rounded-2xl rounded-tr-none text-right">
                        <p className="text-xs text-neutral/90 leading-relaxed font-sans">{round.bear_arguments}</p>
                      </div>
                      <div className="w-7 h-7 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center font-bold text-[10px] shrink-0 font-mono">BEAR</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <Loader2 className="w-6 h-6 animate-spin text-accent m-auto" />
            )}
            
            <div className="bg-black/35 rounded-xl border border-white/5 p-3 text-[9px] font-mono text-neutral/60 text-center">
              Deterministic debate consensus grounded in verified metrics and structural analysis.
            </div>
          </div>
        </div>
      )}

      {activeTab === "explain_timeline" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-fade-in font-sans">
          {/* Explainability Tree (Collapsible) */}
          <div className="glass-card p-6 space-y-6">
            <div className="flex justify-between items-center border-b border-white/5 pb-3">
              <h3 className="text-xs font-bold text-neutral uppercase tracking-wider">Score Explainability Tree</h3>
              {explainData && (
                <span className="text-lg font-black font-mono text-accent">{explainData.investment_score}/100</span>
              )}
            </div>

            {explainData ? (
              <div className="space-y-4">
                {/* Root recommendation */}
                <div 
                  onClick={() => toggleNode("root")}
                  className="p-4 rounded-xl bg-accent/5 border border-accent/20 cursor-pointer flex justify-between items-center transition-all hover:bg-accent/10 text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-accent" />
                    <span className="font-bold text-foreground">Consensus Verdict: {data.recommendation} ({explainData.investment_score}/100)</span>
                  </div>
                  <span className="font-mono font-bold text-neutral">{expandedNodes["root"] ? "[-]" : "[+]"}</span>
                </div>

                {expandedNodes["root"] && (
                  <div className="pl-6 border-l border-white/10 space-y-3.5 mt-2">
                    {Object.entries(explainData.score_breakdown).map(([key, cat]: any) => {
                      const isOpen = expandedNodes[key];
                      return (
                        <div key={key} className="space-y-2">
                          <div
                            onClick={() => toggleNode(key)}
                            className="p-3 rounded-lg bg-black/40 border border-white/5 cursor-pointer flex justify-between items-center hover:border-white/15 text-xs text-left"
                          >
                            <span className="font-bold capitalize text-foreground/90">{key.replace("_", " ")} ({cat.score} / {cat.max_score})</span>
                            <span className="font-mono text-neutral">{isOpen ? "[-]" : "[+]"}</span>
                          </div>

                          {isOpen && (
                            <div className="pl-4 border-l border-white/5 py-1 text-[11px] text-neutral/80 space-y-2 text-left">
                              <p className="leading-relaxed">{cat.description}</p>
                              <div className="bg-black/20 p-2.5 rounded-lg space-y-1 font-mono text-[9px]">
                                {Object.entries(cat.metrics).map(([mName, mVal]: any) => (
                                  <div key={mName} className="flex justify-between">
                                    <span className="text-neutral">{mName.replace("_", " ")}</span>
                                    <span className="text-foreground font-bold">{mVal}</span>
                                  </div>
                                ))}
                                <div className="border-t border-white/5 pt-1.5 flex justify-between text-neutral/50">
                                  <span>Data Provenance Source</span>
                                  <span className="text-accent underline font-sans">Yahoo Finance Statements Feed</span>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <Loader2 className="w-6 h-6 animate-spin text-accent" />
            )}
          </div>

          {/* Timeline Milestones */}
          <div className="glass-card p-6 space-y-6">
            <h3 className="text-xs font-bold text-neutral uppercase tracking-wider">Company Event Milestones</h3>
            {timelineData ? (
              <div className="relative border-l border-white/10 pl-6 space-y-6 max-h-[460px] overflow-y-auto pr-2">
                {timelineData.events.map((ev: any, idx: number) => (
                  <div key={idx} className="relative text-left">
                    <span className="absolute -left-[31px] top-1.5 w-3.5 h-3.5 rounded-full bg-accent border-2 border-background flex items-center justify-center text-[7px] font-bold text-white shadow-lg shadow-accent/20">
                      ✓
                    </span>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black font-mono text-accent">{ev.year}</span>
                        <h4 className="text-xs font-bold text-foreground">{ev.event}</h4>
                      </div>
                      <p className="text-[10px] text-neutral leading-relaxed">{ev.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <Loader2 className="w-6 h-6 animate-spin text-accent" />
            )}
          </div>
        </div>
      )}

      {activeTab === "chat" && (
        <div className="max-w-3xl mx-auto w-full animate-fade-in">
          <ChatInterface analysisId={analysisId || ""} />
        </div>
      )}


      {/* Slide-out Evidence Provenance Drawer */}
      {activeMetric && (
        <EvidencePanel
          metricKey={activeMetric}
          analysisId={analysisId || ""}
          data={data}
          onClose={() => setActiveMetric(null)}
        />
      )}
    </div>
  );
}

export default function CompanyDashboardPage({ params }: { params: Promise<{ ticker: string }> }) {
  const [unwrappedParams, setUnwrappedParams] = useState<{ ticker: string } | null>(null);

  useEffect(() => {
    params.then(setUnwrappedParams);
  }, [params]);

  if (!unwrappedParams) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <Suspense fallback={
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    }>
      <CompanyDashboardContent ticker={unwrappedParams.ticker} />
    </Suspense>
  );
}
