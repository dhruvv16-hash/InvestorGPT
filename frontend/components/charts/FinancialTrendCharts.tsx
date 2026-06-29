"use client";

import { useState } from "react";
import { BarChart3, TrendingUp } from "lucide-react";

interface ChartProps {
  financials: any[];
  years: string[];
  currency: string;
}

export function FinancialTrendCharts({ financials, years, currency }: ChartProps) {
  const [activeTab, setActiveTab] = useState<"bar" | "line">("bar");

  const getCurrencySymbol = (code: string) => {
    const clean = (code || "USD").toUpperCase().trim();
    return clean === "INR" ? "₹" : clean === "EUR" ? "€" : clean === "GBP" ? "£" : clean === "JPY" ? "¥" : "$";
  };

  const symbol = getCurrencySymbol(currency);

  // Extract values sorted by year ascending
  const sortedYears = [...years].reverse(); // oldest to newest

  const revenueData = sortedYears.map(y => {
    const val = financials.find(f => f.metric_name === "revenue" && f.fiscal_period === y)?.value;
    return val !== undefined && val !== null ? val / 1e9 : 0; // in Billions
  });

  const netIncomeData = sortedYears.map(y => {
    const val = financials.find(f => f.metric_name === "net_income" && f.fiscal_period === y)?.value;
    return val !== undefined && val !== null ? val / 1e9 : 0; // in Billions
  });

  const grossMarginData = sortedYears.map(y => {
    const rev = financials.find(f => f.metric_name === "revenue" && f.fiscal_period === y)?.value;
    const cogs = financials.find(f => f.metric_name === "cogs" && f.fiscal_period === y)?.value || 0;
    return rev ? ((rev - cogs) / rev) * 100 : 0;
  });

  const netMarginData = sortedYears.map(y => {
    const rev = financials.find(f => f.metric_name === "revenue" && f.fiscal_period === y)?.value;
    const net = financials.find(f => f.metric_name === "net_income" && f.fiscal_period === y)?.value || 0;
    return rev ? (net / rev) * 100 : 0;
  });

  // SVG parameters
  const width = 500;
  const height = 240;
  const padding = 40;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  // Max values for scaling
  const maxRevenue = Math.max(...revenueData, 1.0);
  const maxNetIncome = Math.max(...netIncomeData, 0.1);
  const maxBarValue = Math.max(maxRevenue, maxNetIncome) * 1.1;

  const maxMargin = Math.max(...grossMarginData, ...netMarginData, 10.0) * 1.1;

  return (
    <div className="space-y-4">
      {/* Chart View Toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => setActiveTab("bar")}
          className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase flex items-center gap-1.5 cursor-pointer transition-all border ${
            activeTab === "bar"
              ? "bg-accent/10 border-accent text-accent"
              : "bg-white/[0.01] border-white/5 text-neutral hover:text-foreground"
          }`}
        >
          <BarChart3 className="w-3.5 h-3.5" />
          <span>Revenue & Net Income</span>
        </button>
        <button
          onClick={() => setActiveTab("line")}
          className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase flex items-center gap-1.5 cursor-pointer transition-all border ${
            activeTab === "line"
              ? "bg-accent/10 border-accent text-accent"
              : "bg-white/[0.01] border-white/5 text-neutral hover:text-foreground"
          }`}
        >
          <TrendingUp className="w-3.5 h-3.5" />
          <span>Profit Margins (%)</span>
        </button>
      </div>

      {/* SVG Canvas */}
      <div className="bg-black/30 border border-white/5 rounded-2xl p-4 flex justify-center items-center">
        {sortedYears.length === 0 ? (
          <p className="text-xs text-neutral py-8">No historical data available for charts.</p>
        ) : activeTab === "bar" ? (
          <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto max-w-[500px]">
            {/* Gradients */}
            <defs>
              <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.2" />
              </linearGradient>
              <linearGradient id="netGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#059669" stopOpacity="0.2" />
              </linearGradient>
            </defs>

            {/* Grid lines */}
            {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
              const y = padding + chartHeight * (1 - ratio);
              const labelVal = (maxBarValue * ratio).toFixed(1);
              return (
                <g key={idx} className="opacity-20">
                  <line
                    x1={padding}
                    y1={y}
                    x2={width - padding}
                    y2={y}
                    stroke="#ffffff"
                    strokeWidth="0.5"
                    strokeDasharray="4 4"
                  />
                  <text
                    x={padding - 6}
                    y={y + 3}
                    fill="#ffffff"
                    fontSize="8"
                    fontFamily="monospace"
                    textAnchor="end"
                  >
                    {labelVal}B
                  </text>
                </g>
              );
            })}

            {/* Bars */}
            {sortedYears.map((year, idx) => {
              const numItems = sortedYears.length;
              const sectionWidth = chartWidth / numItems;
              const xStart = padding + sectionWidth * idx;
              
              const barWidth = sectionWidth * 0.35;
              const gap = sectionWidth * 0.08;

              // Scales
              const revHeight = (revenueData[idx] / maxBarValue) * chartHeight;
              const netHeight = (netIncomeData[idx] / maxBarValue) * chartHeight;

              const revX = xStart + (sectionWidth - barWidth * 2 - gap) / 2;
              const netX = revX + barWidth + gap;

              const yBase = height - padding;

              return (
                <g key={year} className="group/bar">
                  {/* Revenue Bar */}
                  <rect
                    x={revX}
                    y={yBase - revHeight}
                    width={barWidth}
                    height={Math.max(2, revHeight)}
                    rx="3"
                    fill="url(#revGrad)"
                    className="transition-all duration-300 hover:brightness-125"
                  />
                  <text
                    x={revX + barWidth / 2}
                    y={yBase - revHeight - 6}
                    fill="#c084fc"
                    fontSize="7"
                    fontFamily="monospace"
                    fontWeight="bold"
                    textAnchor="middle"
                    className="opacity-0 group-hover/bar:opacity-100 transition-opacity"
                  >
                    {symbol}{revenueData[idx].toFixed(2)}B
                  </text>

                  {/* Net Income Bar */}
                  <rect
                    x={netX}
                    y={yBase - netHeight}
                    width={barWidth}
                    height={Math.max(2, netHeight)}
                    rx="3"
                    fill="url(#netGrad)"
                    className="transition-all duration-300 hover:brightness-125"
                  />
                  <text
                    x={netX + barWidth / 2}
                    y={yBase - netHeight - 6}
                    fill="#34d399"
                    fontSize="7"
                    fontFamily="monospace"
                    fontWeight="bold"
                    textAnchor="middle"
                    className="opacity-0 group-hover/bar:opacity-100 transition-opacity"
                  >
                    {symbol}{netIncomeData[idx].toFixed(2)}B
                  </text>

                  {/* Year Label */}
                  <text
                    x={xStart + sectionWidth / 2}
                    y={height - padding + 15}
                    fill="#9ca3af"
                    fontSize="9"
                    fontWeight="bold"
                    fontFamily="monospace"
                    textAnchor="middle"
                  >
                    {year}
                  </text>
                </g>
              );
            })}

            {/* Bottom Axis */}
            <line
              x1={padding}
              y1={height - padding}
              x2={width - padding}
              y2={height - padding}
              stroke="#374151"
              strokeWidth="1"
            />
          </svg>
        ) : (
          <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto max-w-[500px]">
            {/* Grid lines */}
            {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
              const y = padding + chartHeight * (1 - ratio);
              const labelVal = (maxMargin * ratio).toFixed(0);
              return (
                <g key={idx} className="opacity-20">
                  <line
                    x1={padding}
                    y1={y}
                    x2={width - padding}
                    y2={y}
                    stroke="#ffffff"
                    strokeWidth="0.5"
                    strokeDasharray="4 4"
                  />
                  <text
                    x={padding - 6}
                    y={y + 3}
                    fill="#ffffff"
                    fontSize="8"
                    fontFamily="monospace"
                    textAnchor="end"
                  >
                    {labelVal}%
                  </text>
                </g>
              );
            })}

            {/* Lines and points */}
            {sortedYears.map((year, idx) => {
              const numItems = sortedYears.length;
              const sectionWidth = chartWidth / numItems;
              const xStart = padding + sectionWidth * idx;
              const xPos = xStart + sectionWidth / 2;

              const yBase = height - padding;

              // Margins positions
              const grossY = yBase - (grossMarginData[idx] / maxMargin) * chartHeight;
              const netY = yBase - (netMarginData[idx] / maxMargin) * chartHeight;

              // Calculate line connections
              let nextGrossX = xPos;
              let nextGrossY = grossY;
              let nextNetX = xPos;
              let nextNetY = netY;

              if (idx < numItems - 1) {
                const nextXStart = padding + sectionWidth * (idx + 1);
                const nextXPos = nextXStart + sectionWidth / 2;
                nextGrossX = nextXPos;
                nextGrossY = yBase - (grossMarginData[idx + 1] / maxMargin) * chartHeight;
                nextNetX = nextXPos;
                nextNetY = yBase - (netMarginData[idx + 1] / maxMargin) * chartHeight;
              }

              return (
                <g key={year}>
                  {/* Gross Margin Path Segment */}
                  {idx < numItems - 1 && (
                    <line
                      x1={xPos}
                      y1={grossY}
                      x2={nextGrossX}
                      y2={nextGrossY}
                      stroke="#f59e0b"
                      strokeWidth="2"
                    />
                  )}
                  {/* Net Margin Path Segment */}
                  {idx < numItems - 1 && (
                    <line
                      x1={xPos}
                      y1={netY}
                      x2={nextNetX}
                      y2={nextNetY}
                      stroke="#06b6d4"
                      strokeWidth="2"
                    />
                  )}

                  {/* Gross Margin Point */}
                  <circle
                    cx={xPos}
                    cy={grossY}
                    r="4"
                    fill="#f59e0b"
                    className="hover:scale-150 transition-transform cursor-pointer"
                  />
                  <text
                    x={xPos}
                    y={grossY - 8}
                    fill="#fbbf24"
                    fontSize="7"
                    fontFamily="monospace"
                    fontWeight="bold"
                    textAnchor="middle"
                  >
                    {grossMarginData[idx].toFixed(1)}%
                  </text>

                  {/* Net Margin Point */}
                  <circle
                    cx={xPos}
                    cy={netY}
                    r="4"
                    fill="#06b6d4"
                    className="hover:scale-150 transition-transform cursor-pointer"
                  />
                  <text
                    x={xPos}
                    y={netY + 12}
                    fill="#22d3ee"
                    fontSize="7"
                    fontFamily="monospace"
                    fontWeight="bold"
                    textAnchor="middle"
                  >
                    {netMarginData[idx].toFixed(1)}%
                  </text>

                  {/* Year Label */}
                  <text
                    x={xPos}
                    y={height - padding + 15}
                    fill="#9ca3af"
                    fontSize="9"
                    fontWeight="bold"
                    fontFamily="monospace"
                    textAnchor="middle"
                  >
                    {year}
                  </text>
                </g>
              );
            })}

            {/* Bottom Axis */}
            <line
              x1={padding}
              y1={height - padding}
              x2={width - padding}
              y2={height - padding}
              stroke="#374151"
              strokeWidth="1"
            />
          </svg>
        )}
      </div>

      {/* Legends */}
      <div className="flex justify-center gap-6 text-[9px] font-bold text-neutral uppercase">
        {activeTab === "bar" ? (
          <>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded bg-purple-500" />
              <span>Revenue ({symbol} Billions)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded bg-emerald-500" />
              <span>Net Income ({symbol} Billions)</span>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-1 bg-amber-500 rounded" />
              <span>Gross Profit Margin (%)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-1 bg-cyan-500 rounded" />
              <span>Net Profit Margin (%)</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
