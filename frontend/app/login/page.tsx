"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Sparkles, Loader2, ArrowRight, TrendingUp } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError("Please fill out all fields.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("https://backend-gamma-mocha-34.vercel.app/api/v1/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username.trim(),
          password: password.trim(),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || "Authentication failed");
      }

      const data = await res.json();
      localStorage.setItem("investorgpt_token", data.token);
      localStorage.setItem("investorgpt_user_id", data.user_id);
      localStorage.setItem("investorgpt_username", data.username);
      
      // Dispatch auth change event
      window.dispatchEvent(new Event("auth-state-change"));
      
      router.replace("/");
    } catch (err: any) {
      setError(err.message || "Failed to log in. Please try again.");
      setLoading(false);
    }
  };

  return (
    <main className="flex-1 flex items-center justify-center p-4 md:p-8 min-h-screen relative overflow-hidden bg-[#090a0f]">
      {/* Background ambient glows */}
      <div className="absolute top-1/4 left-1/4 w-[300px] h-[300px] bg-primary/10 rounded-full blur-[100px] -z-10 pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[350px] h-[350px] bg-accent/10 rounded-full blur-[120px] -z-10 pointer-events-none" />

      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          {/* Logo */}
          <div className="inline-flex w-10 h-10 rounded-xl premium-logo-glow items-center justify-center font-bold text-white font-mono shadow-lg shadow-blue-500/20 mb-2">
            <div className="premium-logo-glow-inner">
              <TrendingUp className="w-5.5 h-5.5 text-accent animate-pulse" />
            </div>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">
            Access <span className="bg-gradient-to-r from-accent to-primary bg-clip-text text-transparent">InvestorGPT</span>
          </h1>
          <p className="text-xs text-neutral/70 font-semibold">
            Institutional-Grade Multi-Agent Stock Research Suite
          </p>
        </div>

        <div className="glass-card p-6 border border-white/5 shadow-2xl relative">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="text-xs font-semibold text-bearish bg-bearish/10 border border-bearish/20 p-3 rounded-xl">
                {error}
              </div>
            )}

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-neutral uppercase tracking-wider block">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your username"
                className="w-full px-4 py-3 bg-white/[0.02] border border-white/10 rounded-xl text-foreground placeholder:text-neutral/40 text-xs font-semibold outline-none focus:border-accent/50 transition-all"
                disabled={loading}
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-neutral uppercase tracking-wider block">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3 bg-white/[0.02] border border-white/10 rounded-xl text-foreground placeholder:text-neutral/40 text-xs font-semibold outline-none focus:border-accent/50 transition-all"
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 mt-2 bg-gradient-to-r from-accent to-primary hover:opacity-90 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Signing In...</span>
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-neutral/50 font-semibold">
          Don't have an account?{" "}
          <Link href="/register" className="text-accent hover:underline">
            Register for Free
          </Link>
        </p>
      </div>
    </main>
  );
}
