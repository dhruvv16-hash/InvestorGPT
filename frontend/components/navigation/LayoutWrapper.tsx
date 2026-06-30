"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Sidebar from "@/components/navigation/Sidebar";
import MobileHeader from "@/components/navigation/MobileHeader";

export default function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  // Global fetch interceptor to append authorization token to backend API calls
  useEffect(() => {
    const originalFetch = window.fetch;
    window.fetch = async (input, init) => {
      let url = "";
      if (typeof input === "string") {
        url = input;
      } else if (input instanceof URL) {
        url = input.href;
      } else if (input && typeof input === "object" && "url" in input) {
        url = (input as any).url;
      }

      const isBackendCall = url.includes("backend-gamma-mocha-34.vercel.app") || url.includes("/api/v1");
      
      if (isBackendCall) {
        const token = localStorage.getItem("investorgpt_token");
        if (token) {
          init = init || {};
          const headers = new Headers(init.headers || {});
          if (!headers.has("Authorization")) {
            headers.set("Authorization", `Bearer ${token}`);
          }
          init.headers = headers;
        }
      }
      return originalFetch(input, init);
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  useEffect(() => {
    const checkAuth = () => {
      const token = localStorage.getItem("investorgpt_token");
      const isAuthPage = pathname === "/login" || pathname === "/register";

      if (!token) {
        setIsAuthenticated(false);
        if (!isAuthPage) {
          router.replace("/login");
        }
      } else {
        setIsAuthenticated(true);
        if (isAuthPage) {
          router.replace("/");
        }
      }
    };

    checkAuth();
    // Watch custom storage changes
    window.addEventListener("storage", checkAuth);
    window.addEventListener("auth-state-change", checkAuth);
    return () => {
      window.removeEventListener("storage", checkAuth);
      window.removeEventListener("auth-state-change", checkAuth);
    };
  }, [pathname, router]);

  if (isAuthenticated === null) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-screen bg-[#0a0b0e]">
        <div className="flex items-center gap-3 bg-white/[0.02] border border-white/5 px-6 py-4 rounded-2xl shadow-xl backdrop-blur-md">
          <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-neutral font-mono font-bold uppercase tracking-wider">Loading Platform Session...</span>
        </div>
      </div>
    );
  }

  const isAuthPage = pathname === "/login" || pathname === "/register";

  if (isAuthPage) {
    return <div className="flex-1 flex flex-col min-h-screen w-full bg-[#090a0f]">{children}</div>;
  }

  return (
    <>
      <Sidebar />
      <div className="flex-1 flex flex-col min-h-screen overflow-y-auto w-full">
        <MobileHeader />
        {children}
      </div>
    </>
  );
}
