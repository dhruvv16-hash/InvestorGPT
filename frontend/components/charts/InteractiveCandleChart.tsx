"use client";

import { useEffect, useRef, useState } from "react";
import { ZoomIn, ZoomOut, MoveLeft, MoveRight, Layers } from "lucide-react";

interface HistoryPoint {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  sma20: number;
  sma50: number;
  bb_upper: number;
  bb_middle: number;
  bb_lower: number;
  tenkan: number;
  kijun: number;
  spanA: number;
  spanB: number;
}

interface InteractiveCandleChartProps {
  history: HistoryPoint[];
}

export function InteractiveCandleChart({ history }: InteractiveCandleChartProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  
  // Controls state
  const [zoomLevel, setZoomLevel] = useState(45); // number of candles visible (20 - 90)
  const [panOffset, setPanOffset] = useState(0);  // shift from end of array
  
  const [showSma20, setShowSma20] = useState(true);
  const [showSma50, setShowSma50] = useState(false);
  const [showBollinger, setShowBollinger] = useState(false);
  const [showIchimoku, setShowIchimoku] = useState(false);
  
  // Hover tracking
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [hoverX, setHoverX] = useState<number | null>(null);
  const [hoverY, setHoverY] = useState<number | null>(null);

  // Mouse drag pan tracking
  const isDragging = useRef(false);
  const startX = useRef(0);
  const startPanOffset = useRef(0);

  // Re-render canvas on state change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !history || history.length === 0) return;
    
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    // Clear and adjust resolution
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    
    const width = rect.width;
    const height = rect.height;
    const paddingRight = 60; // space for y-axis labels
    const paddingBottom = 25; // space for dates
    const paddingTop = 20;
    const chartWidth = width - paddingRight;
    const chartHeight = height - paddingBottom - paddingTop;
    
    ctx.clearRect(0, 0, width, height);
    
    // Slice data to only render visible window based on zoomLevel and panOffset
    // Ensure we don't go out of bounds
    const maxOffset = Math.max(0, history.length - zoomLevel);
    const clampedOffset = Math.min(panOffset, maxOffset);
    const endIdx = history.length - clampedOffset;
    const startIdx = Math.max(0, endIdx - zoomLevel);
    const visibleData = history.slice(startIdx, endIdx);
    
    if (visibleData.length === 0) return;
    
    // Find min and max for scaling
    // Include indicators in min/max boundary to prevent clipping
    let allPrices: number[] = [];
    visibleData.forEach(d => {
      allPrices.push(d.high, d.low);
      if (showSma20) allPrices.push(d.sma20);
      if (showSma50) allPrices.push(d.sma50);
      if (showBollinger) allPrices.push(d.bb_upper, d.bb_lower);
      if (showIchimoku) allPrices.push(d.spanA, d.spanB);
    });
    
    const minVal = Math.min(...allPrices) * 0.99;
    const maxVal = Math.max(...allPrices) * 1.01;
    const valRange = maxVal - minVal;
    
    // Grid lines (horizontal)
    ctx.strokeStyle = "rgba(255, 255, 255, 0.03)";
    ctx.lineWidth = 1;
    ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
    ctx.font = "9px monospace";
    ctx.textAlign = "left";
    
    const gridRows = 5;
    for (let i = 0; i <= gridRows; i++) {
      const yVal = minVal + (valRange * i) / gridRows;
      const y = paddingTop + chartHeight - ((yVal - minVal) / valRange) * chartHeight;
      
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(chartWidth, y);
      ctx.stroke();
      
      // Price labels
      ctx.fillText(`$${yVal.toFixed(2)}`, chartWidth + 5, y + 3);
    }
    
    const candleWidth = chartWidth / visibleData.length;
    
    // 1. Draw Ichimoku Cloud (senkou spans A/B shaded region)
    if (showIchimoku) {
      ctx.fillStyle = "rgba(168, 85, 247, 0.05)"; // very light purple
      ctx.beginPath();
      
      visibleData.forEach((d, idx) => {
        const x = idx * candleWidth + candleWidth / 2;
        const y = paddingTop + chartHeight - ((d.spanA - minVal) / valRange) * chartHeight;
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      
      for (let idx = visibleData.length - 1; idx >= 0; idx--) {
        const d = visibleData[idx];
        const x = idx * candleWidth + candleWidth / 2;
        const y = paddingTop + chartHeight - ((d.spanB - minVal) / valRange) * chartHeight;
        ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
    }
    
    // 2. Draw Bollinger Bands fill channel
    if (showBollinger) {
      ctx.fillStyle = "rgba(59, 130, 246, 0.04)"; // very light blue
      ctx.beginPath();
      visibleData.forEach((d, idx) => {
        const x = idx * candleWidth + candleWidth / 2;
        const y = paddingTop + chartHeight - ((d.bb_upper - minVal) / valRange) * chartHeight;
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      for (let idx = visibleData.length - 1; idx >= 0; idx--) {
        const d = visibleData[idx];
        const x = idx * candleWidth + candleWidth / 2;
        const y = paddingTop + chartHeight - ((d.bb_lower - minVal) / valRange) * chartHeight;
        ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
    }
    
    // 3. Draw Candlesticks
    visibleData.forEach((d, idx) => {
      const isGreen = d.close >= d.open;
      const x = idx * candleWidth;
      const midX = x + candleWidth / 2;
      
      const yOpen = paddingTop + chartHeight - ((d.open - minVal) / valRange) * chartHeight;
      const yClose = paddingTop + chartHeight - ((d.close - minVal) / valRange) * chartHeight;
      const yHigh = paddingTop + chartHeight - ((d.high - minVal) / valRange) * chartHeight;
      const yLow = paddingTop + chartHeight - ((d.low - minVal) / valRange) * chartHeight;
      
      const bodyTop = Math.min(yOpen, yClose);
      const bodyBottom = Math.max(yOpen, yClose);
      const bodyHeight = Math.max(1.5, bodyBottom - bodyTop);
      
      // Draw wick
      ctx.strokeStyle = isGreen ? "#10b981" : "#ef4444";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(midX, yHigh);
      ctx.lineTo(midX, yLow);
      ctx.stroke();
      
      // Draw body
      ctx.fillStyle = isGreen ? "#10b981" : "#ef4444";
      ctx.fillRect(x + candleWidth * 0.15, bodyTop, candleWidth * 0.7, bodyHeight);
    });
    
    // Helper to draw indicator lines
    const drawLineIndicator = (
      points: number[], 
      color: string, 
      width: number = 1.5, 
      dashed: boolean = false
    ) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      if (dashed) ctx.setLineDash([3, 3]);
      else ctx.setLineDash([]);
      
      ctx.beginPath();
      points.forEach((yVal, idx) => {
        const x = idx * candleWidth + candleWidth / 2;
        const y = paddingTop + chartHeight - ((yVal - minVal) / valRange) * chartHeight;
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
      ctx.setLineDash([]); // reset
    };
    
    // Draw Indicators
    if (showSma20) {
      drawLineIndicator(visibleData.map(d => d.sma20), "#3b82f6", 1.8);
    }
    if (showSma50) {
      drawLineIndicator(visibleData.map(d => d.sma50), "#f59e0b", 1.8, true);
    }
    if (showBollinger) {
      drawLineIndicator(visibleData.map(d => d.bb_upper), "rgba(59, 130, 246, 0.4)", 1.2);
      drawLineIndicator(visibleData.map(d => d.bb_lower), "rgba(59, 130, 246, 0.4)", 1.2);
    }
    if (showIchimoku) {
      drawLineIndicator(visibleData.map(d => d.tenkan), "#14b8a6", 1.2);
      drawLineIndicator(visibleData.map(d => d.kijun), "#ec4899", 1.2);
    }
    
    // Date labels on x-axis
    ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
    ctx.textAlign = "center";
    const labelSpacing = Math.ceil(visibleData.length / 4);
    visibleData.forEach((d, idx) => {
      if (idx % labelSpacing === 0) {
        const x = idx * candleWidth + candleWidth / 2;
        ctx.fillText(d.date.substring(5), x, height - 8);
      }
    });
    
    // Draw Hover Crosshairs
    if (hoverIndex !== null && hoverIndex < visibleData.length && hoverX !== null && hoverY !== null) {
      const midX = hoverIndex * candleWidth + candleWidth / 2;
      
      // Vertical crosshair
      ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(midX, 0);
      ctx.lineTo(midX, height - paddingBottom);
      ctx.stroke();
      
      // Horizontal crosshair
      ctx.beginPath();
      ctx.moveTo(0, hoverY);
      ctx.lineTo(chartWidth, hoverY);
      ctx.stroke();
      ctx.setLineDash([]);
      
      // Highlight hover index candle
      const point = visibleData[hoverIndex];
      ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
      ctx.fillRect(hoverIndex * candleWidth, paddingTop, candleWidth, chartHeight);
    }
    
  }, [history, zoomLevel, panOffset, showSma20, showSma50, showBollinger, showIchimoku, hoverIndex, hoverX, hoverY]);

  // Event handlers
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !history || history.length === 0) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const paddingRight = 60;
    const chartWidth = rect.width - paddingRight;
    
    if (x < 0 || x > chartWidth) {
      setHoverIndex(null);
      return;
    }
    
    // Map X to data index
    const maxOffset = Math.max(0, history.length - zoomLevel);
    const clampedOffset = Math.min(panOffset, maxOffset);
    const endIdx = history.length - clampedOffset;
    const startIdx = Math.max(0, endIdx - zoomLevel);
    const visibleLength = endIdx - startIdx;
    
    const candleWidth = chartWidth / visibleLength;
    const idx = Math.floor(x / candleWidth);
    
    if (idx >= 0 && idx < visibleLength) {
      setHoverIndex(idx);
      setHoverX(x);
      setHoverY(y);
    }
  };

  const handleMouseLeave = () => {
    setHoverIndex(null);
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    isDragging.current = true;
    startX.current = e.clientX;
    startPanOffset.current = panOffset;
  };

  const handleMouseUp = () => {
    isDragging.current = false;
  };

  const handleGlobalMouseMove = (e: MouseEvent) => {
    if (!isDragging.current || !history || history.length === 0) return;
    
    const deltaX = e.clientX - startX.current;
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const paddingRight = 60;
    const chartWidth = rect.width - paddingRight;
    
    const candleWidth = chartWidth / zoomLevel;
    const shift = Math.round(deltaX / candleWidth);
    
    const newOffset = startPanOffset.current + shift;
    const maxOffset = Math.max(0, history.length - zoomLevel);
    setPanOffset(Math.max(0, Math.min(newOffset, maxOffset)));
  };

  useEffect(() => {
    window.addEventListener("mousemove", handleGlobalMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleGlobalMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [zoomLevel, panOffset]);

  // Adjust zoom Level helper
  const handleZoom = (direction: "in" | "out") => {
    setZoomLevel(prev => {
      const step = 8;
      if (direction === "in") return Math.max(20, prev - step);
      return Math.min(90, prev + step);
    });
  };

  // Adjust pan offset manually
  const handlePan = (direction: "left" | "right") => {
    setPanOffset(prev => {
      const step = 5;
      const maxOffset = Math.max(0, history.length - zoomLevel);
      if (direction === "left") return Math.min(maxOffset, prev + step);
      return Math.max(0, prev - step);
    });
  };

  // Get active hover point data
  const getHoveredData = () => {
    if (hoverIndex === null || !history || history.length === 0) return null;
    
    const maxOffset = Math.max(0, history.length - zoomLevel);
    const clampedOffset = Math.min(panOffset, maxOffset);
    const endIdx = history.length - clampedOffset;
    const startIdx = Math.max(0, endIdx - zoomLevel);
    const visibleData = history.slice(startIdx, endIdx);
    
    if (hoverIndex < visibleData.length) {
      return visibleData[hoverIndex];
    }
    return null;
  };

  const activePoint = getHoveredData();

  return (
    <div className="flex flex-col gap-4 w-full">
      
      {/* Floating Hover Info Panel */}
      <div className="h-10 bg-black/45 rounded-xl border border-white/5 px-4 flex items-center gap-4 text-[9px] font-mono text-neutral overflow-x-auto whitespace-nowrap scrollbar-thin">
        {activePoint ? (
          <>
            <span className="text-accent font-bold font-sans">{activePoint.date}</span>
            <span>O: <b className="text-foreground">${activePoint.open.toFixed(2)}</b></span>
            <span>H: <b className="text-foreground">${activePoint.high.toFixed(2)}</b></span>
            <span>L: <b className="text-foreground">${activePoint.low.toFixed(2)}</b></span>
            <span>C: <b className="text-foreground">${activePoint.close.toFixed(2)}</b></span>
            
            {showSma20 && (
              <span className="text-blue-400">SMA20: <b>${activePoint.sma20.toFixed(2)}</b></span>
            )}
            {showSma50 && (
              <span className="text-amber-400">SMA50: <b>${activePoint.sma50.toFixed(2)}</b></span>
            )}
            {showBollinger && (
              <span className="text-blue-300">BB(U): <b>${activePoint.bb_upper.toFixed(2)}</b></span>
            )}
            {showIchimoku && (
              <span className="text-pink-400">SpanA: <b>${activePoint.spanA.toFixed(2)}</b></span>
            )}
          </>
        ) : (
          <span className="italic text-neutral/55">Hover cursor over chart to inspect candlestick and indicator values...</span>
        )}
      </div>

      {/* Canvas Wrap */}
      <div className="relative w-full h-64 bg-black/35 rounded-2xl border border-white/5 overflow-hidden select-none">
        <canvas
          ref={canvasRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          onMouseDown={handleMouseDown}
          className="w-full h-full cursor-crosshair"
        />
      </div>

      {/* Chart Toolbars */}
      <div className="flex flex-wrap justify-between items-center gap-3">
        {/* Navigation & Zoom controls */}
        <div className="flex gap-1.5 text-xs font-mono">
          <button
            onClick={() => handlePan("left")}
            className="p-2 bg-white/[0.02] border border-white/5 hover:border-white/10 rounded-xl cursor-pointer"
            title="Pan Left"
          >
            <MoveLeft className="w-3.5 h-3.5 text-neutral" />
          </button>
          <button
            onClick={() => handlePan("right")}
            className="p-2 bg-white/[0.02] border border-white/5 hover:border-white/10 rounded-xl cursor-pointer"
            title="Pan Right"
          >
            <MoveRight className="w-3.5 h-3.5 text-neutral" />
          </button>
          <button
            onClick={() => handleZoom("in")}
            className="p-2 bg-white/[0.02] border border-white/5 hover:border-white/10 rounded-xl cursor-pointer ml-2"
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5 text-neutral" />
          </button>
          <button
            onClick={() => handleZoom("out")}
            className="p-2 bg-white/[0.02] border border-white/5 hover:border-white/10 rounded-xl cursor-pointer"
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5 text-neutral" />
          </button>
        </div>

        {/* Indicators checklist toggles */}
        <div className="flex items-center gap-4 text-[10px] font-bold font-mono">
          <label className="flex items-center gap-1.5 cursor-pointer text-blue-400">
            <input
              type="checkbox"
              checked={showSma20}
              onChange={() => setShowSma20(!showSma20)}
              className="rounded accent-blue-500 cursor-pointer"
            />
            <span>SMA 20</span>
          </label>

          <label className="flex items-center gap-1.5 cursor-pointer text-amber-500">
            <input
              type="checkbox"
              checked={showSma50}
              onChange={() => setShowSma50(!showSma50)}
              className="rounded accent-amber-500 cursor-pointer"
            />
            <span>SMA 50</span>
          </label>

          <label className="flex items-center gap-1.5 cursor-pointer text-blue-300">
            <input
              type="checkbox"
              checked={showBollinger}
              onChange={() => setShowBollinger(!showBollinger)}
              className="rounded accent-blue-400 cursor-pointer"
            />
            <span>Bollinger Bands</span>
          </label>

          <label className="flex items-center gap-1.5 cursor-pointer text-purple-400">
            <input
              type="checkbox"
              checked={showIchimoku}
              onChange={() => setShowIchimoku(!showIchimoku)}
              className="rounded accent-purple-500 cursor-pointer"
            />
            <span>Ichimoku Cloud</span>
          </label>
        </div>
      </div>
    </div>
  );
}
