"use client";

import React, { useState, useEffect, useRef } from "react";
import { Search, Loader2 } from "lucide-react";

interface StockSearchInputProps {
  value: string;
  onChange: (val: string) => void;
  onSelect: (symbol: string) => void;
  placeholder?: string;
  className?: string;
  large?: boolean;
}

export function StockSearchInput({
  value,
  onChange,
  onSelect,
  placeholder = "Search stock ticker...",
  className = "",
  large = false
}: StockSearchInputProps) {
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [localCompanies, setLocalCompanies] = useState<any[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const debounceRef = useRef<any>(null);
  const cacheRef = useRef<Record<string, any[]>>({});
  const abortControllerRef = useRef<AbortController | null>(null);

  // Pre-fetch local companies for instant suggestions on first render
  useEffect(() => {
    fetch("https://backend-gamma-mocha-34.vercel.app/api/v1/companies")
      .then(res => res.json())
      .then(data => setLocalCompanies(data.companies || []))
      .catch(err => console.error("Prefetch error:", err));

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleFocus = () => {
    const term = value.trim();
    if (term.length < 1) {
      const defaultLocal = localCompanies.slice(0, 5).map(c => ({
        symbol: c.symbol,
        name: c.name,
        exchange: c.exchange || "NSE",
        is_local: true
      }));
      setSuggestions(defaultLocal);
      setShowSuggestions(defaultLocal.length > 0);
    } else {
      const filteredLocal = localCompanies.filter(c => 
        c.symbol.toLowerCase().includes(term.toLowerCase()) || 
        c.name.toLowerCase().includes(term.toLowerCase())
      ).map(c => ({
        symbol: c.symbol,
        name: c.name,
        exchange: c.exchange || "NSE",
        is_local: true
      }));
      setSuggestions(filteredLocal);
      setShowSuggestions(filteredLocal.length > 0);
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    onChange(val);
    const term = val.trim();
    
    if (term.length < 1) {
      setSuggestions([]);
      return;
    }

    // 1. Instantly filter pre-fetched local companies (0ms latency)
    const filteredLocal = localCompanies.filter(c => 
      c.symbol.toLowerCase().includes(term.toLowerCase()) || 
      c.name.toLowerCase().includes(term.toLowerCase())
    ).map(c => ({
      symbol: c.symbol,
      name: c.name,
      exchange: c.exchange || "NSE",
      is_local: true
    }));

    setSuggestions(filteredLocal);
    setShowSuggestions(true);

    // 2. Debounced API fetch for remote symbols
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const cachedKey = term.toLowerCase();
      if (cacheRef.current[cachedKey]) {
        mergeSuggestions(filteredLocal, cacheRef.current[cachedKey]);
        return;
      }

      if (abortControllerRef.current) abortControllerRef.current.abort();
      abortControllerRef.current = new AbortController();

      setLoading(true);
      try {
        const res = await fetch(
          `https://backend-gamma-mocha-34.vercel.app/api/v1/search?q=${encodeURIComponent(term)}`,
          { signal: abortControllerRef.current.signal }
        );
        if (res.ok) {
          const json = await res.json();
          const quotes = json.quotes || [];
          cacheRef.current[cachedKey] = quotes;
          mergeSuggestions(filteredLocal, quotes);
        }
      } catch (err: any) {
        if (err && err.name !== "AbortError" && err.message !== "The user aborted a request.") {
          console.error("Remote search query failed:", err);
          mergeSuggestions(filteredLocal, []);
        }
      } finally {
        setLoading(false);
      }
    }, 200);
  };

  const mergeSuggestions = (local: any[], remote: any[]) => {
    const seen = new Set(local.map(l => l.symbol.toUpperCase().trim()));
    const merged = [...local];
    
    const dualMapping: Record<string, { native: string, name: string, exchange: string }> = {
      "INFY": { native: "INFY.NS", name: "Infosys Limited", exchange: "NSE" },
      "WIT": { native: "WIPRO.NS", name: "Wipro Limited", exchange: "NSE" },
      "RDY": { native: "DRREDDY.NS", name: "Dr. Reddy's Laboratories", exchange: "NSE" },
      "IBN": { native: "ICICIBANK.NS", name: "ICICI Bank Limited", exchange: "NSE" },
      "HDB": { native: "HDFCBANK.NS", name: "HDFC Bank Limited", exchange: "NSE" },
    };

    remote.forEach(r => {
      const sym = r.symbol.toUpperCase().trim();
      if (!seen.has(sym)) {
        seen.add(sym);
        merged.push({
          symbol: r.symbol,
          name: r.name,
          exchange: r.exchange,
          is_local: false
        });
      }
      
      const mapped = dualMapping[sym];
      if (mapped && !seen.has(mapped.native)) {
        seen.add(mapped.native);
        merged.push({
          symbol: mapped.native,
          name: mapped.name,
          exchange: mapped.exchange,
          is_local: false
        });
      }
    });
    setSuggestions(merged.slice(0, 8)); // Cap at 8 elements for readability
  };

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={handleTextChange}
          onFocus={handleFocus}
          placeholder={placeholder}
          className={`w-full bg-black/40 border border-white/5 focus:border-accent/40 rounded-xl outline-none text-foreground font-mono transition-all uppercase ${
            large 
              ? "pl-12 pr-10 py-4 text-base" 
              : "pl-9 pr-8 py-2 text-xs"
          }`}
        />
        <Search className={`absolute text-neutral/50 ${
          large 
            ? "left-4 top-4.5 w-5 h-5" 
            : "left-3 top-2.5 w-4 h-4"
        }`} />
        {loading && (
          <Loader2 className={`absolute text-accent animate-spin ${
            large 
              ? "right-4 top-4.5 w-5 h-5" 
              : "right-3 top-2.5 w-4 h-4"
          }`} />
        )}
      </div>
      
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-1.5 bg-black/95 border border-white/10 rounded-2xl overflow-hidden z-50 shadow-2xl max-h-60 overflow-y-auto backdrop-blur-md">
          {suggestions.map((s, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                onSelect(s.symbol);
                setShowSuggestions(false);
              }}
              className="w-full px-4 py-3 hover:bg-white/[0.03] text-left text-xs font-mono flex flex-col border-b border-white/5 cursor-pointer transition-colors"
            >
              <div className="flex items-center justify-between w-full">
                <span className="text-foreground font-bold">{s.symbol}</span>
                {s.is_local && (
                  <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/10 text-[7px] font-extrabold uppercase font-sans">
                    LOCAL ANALYSIS
                  </span>
                )}
              </div>
              <span className="text-neutral/60 text-[10px] truncate mt-0.5">{s.name} ({s.exchange})</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
