"use client";

import { Activity } from "lucide-react";

interface GaugeProps {
  rsi: number;
}

export function TechnicalGauge({ rsi }: GaugeProps) {
  // Constrain RSI to [0, 100]
  const val = Math.max(0, Math.min(100, rsi));
  
  // Needle math: map 0-100 to 0-180 degrees (translated to radians for cos/sin)
  // 0% is left (180deg), 50% is top (90deg), 100% is right (0deg)
  const angleRad = Math.PI * (val / 100);
  const radius = 60;
  const cx = 100;
  const cy = 90;
  
  const needleX = cx - radius * Math.cos(angleRad);
  const needleY = cy - radius * Math.sin(angleRad);

  const getVerdict = (v: number) => {
    if (v < 30) return { label: "Oversold (Buy)", color: "text-emerald-400" };
    if (v > 70) return { label: "Overbought (Sell)", color: "text-rose-400" };
    return { label: "Neutral (Hold)", color: "text-neutral" };
  };

  const verdict = getVerdict(val);

  return (
    <div className="glass-card p-6 flex flex-col items-center justify-center text-center relative overflow-hidden">
      <div className="flex items-center gap-1.5 text-xs text-neutral font-bold uppercase tracking-wider mb-4 w-full justify-start border-b border-white/5 pb-2">
        <Activity className="w-4 h-4 text-accent" />
        <span>Technical Sentiment (RSI)</span>
      </div>

      <svg viewBox="0 0 200 120" className="w-full h-auto max-w-[180px]">
        <defs>
          <linearGradient id="gaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#10b981" />   {/* green */}
            <stop offset="30%" stopColor="#10b981" />
            <stop offset="45%" stopColor="#6b7280" />  {/* grey */}
            <stop offset="55%" stopColor="#6b7280" />
            <stop offset="70%" stopColor="#ef4444" />   {/* red */}
            <stop offset="100%" stopColor="#ef4444" />
          </linearGradient>
        </defs>

        {/* Gauge Arc background */}
        <path
          d="M 20 90 A 80 80 0 0 1 180 90"
          fill="none"
          stroke="#1f2937"
          strokeWidth="14"
          strokeLinecap="round"
        />

        {/* Color overlay */}
        <path
          d="M 20 90 A 80 80 0 0 1 180 90"
          fill="none"
          stroke="url(#gaugeGrad)"
          strokeWidth="12"
          strokeLinecap="round"
        />

        {/* Center Pin */}
        <circle cx={cx} cy={cy} r="6" fill="#8b5cf6" />
        <circle cx={cx} cy={cy} r="3" fill="#ffffff" />

        {/* Needle */}
        <line
          x1={cx}
          y1={cy}
          x2={needleX}
          y2={needleY}
          stroke="#8b5cf6"
          strokeWidth="3"
          strokeLinecap="round"
        />

        {/* Value Label */}
        <text
          x={cx}
          y={cy + 22}
          fill="#ffffff"
          fontSize="18"
          fontWeight="900"
          fontFamily="monospace"
          textAnchor="middle"
        >
          {val.toFixed(1)}
        </text>
      </svg>

      <div className="space-y-0.5 mt-2">
        <p className={`text-xs font-extrabold uppercase ${verdict.color}`}>
          {verdict.label}
        </p>
        <p className="text-[9px] text-neutral/80 max-w-[180px]">
          RSI (14) indicator. Under 30 is oversold, over 70 is overbought.
        </p>
      </div>
    </div>
  );
}
