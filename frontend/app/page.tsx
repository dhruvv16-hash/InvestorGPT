"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

const HomeClient = dynamic(() => import("./HomeClient"), {
  ssr: false,
  loading: () => (
    <main className="flex-1 flex flex-col items-center justify-center p-4 md:p-8 relative min-h-screen bg-background">
      <div className="flex items-center gap-2">
        <Loader2 className="w-5 h-5 animate-spin text-accent" />
        <span className="text-sm text-neutral font-medium">Loading platform...</span>
      </div>
    </main>
  )
});

export default function Page() {
  return <HomeClient />;
}
