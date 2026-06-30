"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  Home, Search, Activity, Scale, Briefcase, BarChart3, 
  Newspaper, History, Settings, Sparkles, Menu, X, Bell, Award, Compass, TrendingUp
} from "lucide-react";



export default function Sidebar() {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [username, setUsername] = useState("Premium User");

  // Load preferences from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("sidebar_collapsed");
    if (saved === "true") {
      setIsCollapsed(true);
    }
    const savedUsername = localStorage.getItem("investorgpt_username");
    if (savedUsername) {
      setUsername(savedUsername);
    }

    // Set up mobile drawer event listener
    const handleToggleMobile = () => {
      setIsMobileOpen(prev => !prev);
    };

    window.addEventListener("toggle-mobile-sidebar", handleToggleMobile);
    return () => {
      window.removeEventListener("toggle-mobile-sidebar", handleToggleMobile);
    };
  }, []);

  const toggleCollapse = () => {
    const nextState = !isCollapsed;
    setIsCollapsed(nextState);
    localStorage.setItem("sidebar_collapsed", String(nextState));
  };

  const menuItems = [
    { name: "Dashboard", href: "/", icon: Home, active: pathname === "/" },
    { name: "Company Research", href: "/company", icon: Search, active: pathname.startsWith("/company") },
    { name: "AI Screener", href: "/screener", icon: Sparkles, active: pathname.startsWith("/screener") },
    { name: "Strategy Builder", href: "/strategy", icon: Compass, active: pathname.startsWith("/strategy") },
    { name: "Watchlist Intel", href: "/watchlist", icon: Bell, active: pathname.startsWith("/watchlist") },
    { name: "Research Academy", href: "/academy", icon: Award, active: pathname.startsWith("/academy") },
    { name: "Financial Modeling Lab", href: "/modeling", icon: Scale, active: pathname.startsWith("/modeling"), badge: "PRO" },
    { name: "Compare Companies", href: "/compare", icon: BarChart3, active: pathname.startsWith("/compare") },
    { name: "Technical Analysis", href: "/technical", icon: Activity, active: pathname.startsWith("/technical") },
    { name: "Portfolio", href: "/portfolio", icon: Briefcase, active: pathname.startsWith("/portfolio") },
    { name: "Market News", href: "/news", icon: Newspaper, active: pathname.startsWith("/news") },
    { name: "Research History", href: "/research-history", icon: History, active: pathname.startsWith("/research-history") },
    { name: "Settings", href: "/settings", icon: Settings, active: pathname.startsWith("/settings") },
  ];


  return (
    <>
      {/* Mobile Drawer Backdrop */}
      {isMobileOpen && (
        <div 
          onClick={() => setIsMobileOpen(false)}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden cursor-pointer"
        />
      )}

      {/* Main Sidebar Panel */}
      <aside 
        className={`bg-[#0a0b0e]/95 border-r border-white/5 flex flex-col h-screen shrink-0 sticky top-0 backdrop-blur-md z-50 
          transition-all duration-300 ease-in-out
          fixed inset-y-0 left-0 lg:sticky
          ${isMobileOpen ? "translate-x-0 w-64" : "-translate-x-full lg:translate-x-0"} 
          ${isCollapsed ? "lg:w-16" : "lg:w-64"}
        `}
      >
        {/* Sidebar Header */}
        <div className={`p-4 border-b border-white/5 flex items-center justify-between ${isCollapsed ? "lg:justify-center" : ""}`}>
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-8 h-8 rounded-xl premium-logo-glow flex items-center justify-center font-bold text-white font-mono shadow-lg shadow-blue-500/20 shrink-0">
              <div className="premium-logo-glow-inner">
                <TrendingUp className="w-4.5 h-4.5 text-accent animate-pulse" />
              </div>
            </div>
            {!isCollapsed && (
              <div className="animate-fade-in">
                <h2 className="text-sm font-extrabold text-white tracking-wide font-mono leading-none">InvestorGPT</h2>
                <span className="text-[9px] text-neutral/50 font-bold uppercase tracking-widest mt-1 block">Studio Suite</span>
              </div>
            )}
          </div>

          {/* Desktop Toggle Button */}
          <button
            onClick={toggleCollapse}
            className="hidden lg:flex p-1.5 hover:bg-white/5 rounded-lg text-neutral hover:text-foreground transition-colors cursor-pointer"
            title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          >
            <Menu className="w-4 h-4" />
          </button>

          {/* Mobile Close Button */}
          {isMobileOpen && (
            <button
              onClick={() => setIsMobileOpen(false)}
              className="lg:hidden p-1.5 hover:bg-white/5 rounded-lg text-neutral hover:text-foreground transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Navigation List */}
        <nav className="flex-1 p-3 space-y-1.5 overflow-y-auto">
          {menuItems.map((item, idx) => {
            const Icon = item.icon;

            // Render Navigatable Link Item
            return (
              <div key={idx} className="relative sidebar-item-container flex w-full">
                <Link
                  href={item.href}
                  onClick={() => setIsMobileOpen(false)}
                  className={`flex items-center rounded-xl text-xs font-bold transition-all p-2.5 w-full ${
                    isCollapsed ? "lg:justify-center" : "justify-between"
                  } ${
                    item.active 
                      ? "bg-accent/15 border border-accent/20 text-accent active-item-glow" 
                      : "text-neutral/70 hover:text-foreground hover:bg-white/[0.02]"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 shrink-0 ${item.active ? "text-accent animate-pulse" : "text-neutral/50"}`} />
                    {!isCollapsed && <span>{item.name}</span>}
                  </div>
                  {!isCollapsed && item.badge && (
                    <span className="text-[8px] bg-accent/20 border border-accent/30 text-accent px-1.5 py-0.5 rounded-md font-bold tracking-wider animate-pulse">
                      {item.badge}
                    </span>
                  )}
                </Link>
                {isCollapsed && (
                  <div className="sidebar-tooltip">
                    <div className="sidebar-tooltip-arrow" />
                    {item.name}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Sidebar Footer */}
        <div className="p-3 border-t border-white/5 bg-[#0a0b0e] space-y-2">
          {/* Premium Status */}
          <div className={`flex items-center gap-3 p-2 rounded-xl border border-accent/10 premium-gradient-card ${
            isCollapsed ? "lg:justify-center" : ""
          }`}>
            <Sparkles className="w-4.5 h-4.5 text-accent shrink-0 animate-pulse" />
            {!isCollapsed && (
              <div className="truncate">
                <h4 className="text-[10px] font-bold text-foreground">Premium Active</h4>
                <p className="text-[8px] text-neutral/50 font-mono">Institutional Tier</p>
              </div>
            )}
          </div>

          {/* User Profile & Logout */}
          <div className={`flex items-center gap-2.5 p-2 bg-white/[0.01] hover:bg-white/[0.03] border border-white/5 rounded-xl transition-all ${
            isCollapsed ? "lg:justify-center" : "justify-between"
          }`}>
            <div className="flex items-center gap-2 overflow-hidden">
              <div className="w-6.5 h-6.5 rounded-lg bg-accent/20 border border-accent/30 text-accent font-bold text-xs flex items-center justify-center font-mono uppercase shrink-0">
                {username.substring(0, 2)}
              </div>
              {!isCollapsed && (
                <div className="truncate">
                  <h4 className="text-[10px] font-bold text-white leading-tight truncate">{username}</h4>
                  <span className="text-[7.5px] text-neutral/40 font-mono uppercase tracking-wider block">ID: Active</span>
                </div>
              )}
            </div>
            {!isCollapsed && (
              <button
                onClick={() => {
                  const token = localStorage.getItem("investorgpt_token");
                  if (token) {
                    fetch(`https://backend-gamma-mocha-34.vercel.app/api/v1/logout?token=${token}`, { method: "POST" });
                  }
                  localStorage.removeItem("investorgpt_token");
                  localStorage.removeItem("investorgpt_user_id");
                  localStorage.removeItem("investorgpt_username");
                  window.dispatchEvent(new Event("auth-state-change"));
                  window.location.href = "/login";
                }}
                className="text-[9px] hover:text-rose-400 text-neutral/40 font-bold uppercase transition-colors shrink-0 cursor-pointer"
                title="Log Out"
              >
                Exit
              </button>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
