"use client";

import Link from "next/link";
import { Menu, BarChart3, Scale, Search } from "lucide-react";

export default function MobileHeader() {
  const handleToggle = () => {
    window.dispatchEvent(new CustomEvent("toggle-mobile-sidebar"));
  };

  return (
    <div className="lg:hidden flex items-center justify-between p-4 border-b border-white/5 bg-[#0a0b0e]/95 backdrop-blur-md sticky top-0 z-30">
      <div className="flex items-center gap-3">
        <button
          onClick={handleToggle}
          className="p-1.5 hover:bg-white/5 rounded-lg text-neutral hover:text-foreground transition-colors cursor-pointer"
          aria-label="Toggle Menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <span className="font-extrabold text-sm font-mono tracking-wider bg-gradient-to-r from-accent to-primary bg-clip-text text-transparent">
          InvestorGPT
        </span>
      </div>

      <div className="flex items-center gap-2">
        <Link href="/" className="px-2.5 py-1 text-[10px] font-bold bg-white/5 hover:bg-white/10 rounded-lg transition-colors">
          Research
        </Link>
        <Link href="/modeling" className="px-2.5 py-1 text-[10px] font-bold bg-accent/10 border border-accent/20 text-accent rounded-lg transition-colors">
          Modeling
        </Link>
        <Link href="/compare" className="px-2.5 py-1 text-[10px] font-bold bg-white/5 hover:bg-white/10 rounded-lg transition-colors">
          Compare
        </Link>
      </div>
    </div>
  );
}
