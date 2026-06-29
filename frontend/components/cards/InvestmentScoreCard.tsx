import { ShieldAlert, Info, HelpCircle } from "lucide-react";

interface Props {
  recommendation: string | null;
  confidence: number | null;
  currentPrice: number;
  fairValue: number | null;
  onSelectMetric: (metric: string) => void;
  currency?: string;
}

export function getCurrencySymbol(currency: string | undefined | null) {
  if (!currency) return "$";
  const clean = currency.toUpperCase().trim();
  if (clean === "INR") return "₹";
  if (clean === "EUR") return "€";
  if (clean === "GBP") return "£";
  if (clean === "JPY") return "¥";
  return "$";
}

const DECISION_LABEL: Record<string, string> = {
  STRONG_BUY: "Strong Buy",
  BUY: "Buy",
  HOLD: "Hold",
  SELL: "Sell",
  STRONG_SELL: "Strong Sell"
};

const DECISION_COLORS: Record<string, string> = {
  STRONG_BUY: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  BUY: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  HOLD: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  SELL: "bg-rose-500/10 text-rose-400 border-rose-500/20",
  STRONG_SELL: "bg-rose-500/10 text-rose-400 border-rose-500/30"
};

export function InvestmentScoreCard({
  recommendation,
  confidence,
  currentPrice,
  fairValue,
  onSelectMetric,
  currency
}: Props) {
  const decision = recommendation || "HOLD";
  const confidencePercent = Math.round((confidence || 0) * 100);

  // Compute upside
  const upsidePct = fairValue && currentPrice
    ? ((fairValue - currentPrice) / currentPrice) * 100
    : 0;

  // Compute dynamic consensus score
  let consensusScore = 50;
  if (decision === "STRONG_BUY") {
    consensusScore = Math.round(75 + confidencePercent * 0.25);
  } else if (decision === "BUY") {
    consensusScore = Math.round(60 + confidencePercent * 0.3);
  } else if (decision === "SELL") {
    consensusScore = Math.round(40 - confidencePercent * 0.2);
  } else if (decision === "STRONG_SELL") {
    consensusScore = Math.round(25 - confidencePercent * 0.25);
  } else {
    consensusScore = 50;
  }

  return (
    <div className="glass-card p-6 flex flex-col gap-6 relative overflow-hidden group">
      {/* Title */}
      <div className="flex items-center justify-between border-b border-white/5 pb-3">
        <h3 className="text-xs font-bold text-neutral uppercase tracking-wider">Committee Recommendation</h3>
        <span className="text-[10px] text-neutral/70 flex items-center gap-1">
          <Info className="w-3 h-3 text-accent" />
          Click metrics for proof
        </span>
      </div>

      {/* Main Score Display */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <span className={`inline-block px-3 py-1 text-xs font-bold rounded-lg border ${DECISION_COLORS[decision] || DECISION_COLORS.HOLD}`}>
            {DECISION_LABEL[decision] || decision}
          </span>
          <h2 className="text-4xl font-extrabold tracking-tight text-foreground font-mono">
            {consensusScore}<span className="text-neutral/40 text-lg">/100</span>
          </h2>
          <p className="text-xs text-neutral">Committee Consensus Score</p>
        </div>

        {/* Confidence Meter */}
        <button
          onClick={() => onSelectMetric("investment_score")}
          className="flex flex-col gap-2 p-3 bg-white/[0.02] hover:bg-white/[0.05] border border-white/5 rounded-xl text-left transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between gap-6 text-xs font-bold text-neutral uppercase tracking-wider">
            <span>Confidence</span>
            <span className="text-accent font-mono">{confidencePercent}%</span>
          </div>
          <div className="w-40 h-2 bg-black/40 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-accent to-primary"
              style={{ width: `${confidencePercent}%` }}
            />
          </div>
          <span className="text-[9px] text-neutral/60">Cross-verified consensus rate</span>
        </button>
      </div>

      {/* Fair Value Section */}
      <div className="grid grid-cols-2 gap-4 border-t border-white/5 pt-4">
        {/* Current Price */}
        <div className="space-y-1">
          <span className="text-[10px] text-neutral font-semibold uppercase">Current Price</span>
          <p className="text-lg font-bold font-mono text-foreground">{getCurrencySymbol(currency)}{currentPrice.toFixed(2)}</p>
        </div>

        {/* Fair Value */}
        <button
          onClick={() => onSelectMetric("fair_value")}
          className="space-y-1 text-left hover:opacity-80 transition-opacity cursor-pointer group/fv"
        >
          <span className="text-[10px] text-neutral font-semibold uppercase flex items-center gap-1 group-hover/fv:text-accent">
            Fair Value
            <HelpCircle className="w-3 h-3 text-neutral/50" />
          </span>
          <p className="text-lg font-bold font-mono text-emerald-400">
            {fairValue ? `${getCurrencySymbol(currency)}${fairValue.toFixed(2)}` : "Calculating..."}
          </p>
          {fairValue && (
            <p className={`text-[10px] font-semibold ${upsidePct >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
              {upsidePct >= 0 ? "+" : ""}{upsidePct.toFixed(1)}% {upsidePct >= 0 ? "Upside" : "Downside"}
            </p>
          )}
        </button>
      </div>
    </div>
  );
}
