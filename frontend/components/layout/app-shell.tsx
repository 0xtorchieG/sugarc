"use client";

import { usePathname } from "next/navigation";
import { Header } from "./header";
import { Footer } from "./footer";
import { DripBackground, DitheringBackground } from "@/components/branding";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isHome = pathname === "/";

  return (
    <div className="relative flex min-h-screen flex-col">
      {isHome ? <DitheringBackground /> : <DripBackground />}
      <div className="relative z-10 flex min-h-screen flex-col">
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
      </div>
    </div>
  );
}
