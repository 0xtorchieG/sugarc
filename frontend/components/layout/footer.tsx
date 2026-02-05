"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";

export function Footer() {
  const pathname = usePathname();
  const isHome = pathname === "/";

  return (
    <footer
      className={
        isHome
          ? "border-t border-white/20 bg-white/20 backdrop-blur-sm"
          : "border-t border-input/40 bg-background"
      }
    >
      <div className="container mx-auto max-w-6xl px-4 py-6">
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/icon.png"
              alt="Sugarc"
              width={24}
              height={24}
              className="h-6 w-6"
            />
            <span className="text-sm text-muted-foreground">
              Sugarc — Tokenized invoice factoring on Arc
            </span>
          </Link>
          <nav className="flex gap-6 text-sm">
            <Link href="/" className="text-muted-foreground hover:text-foreground">
              Home
            </Link>
            <Link href="/auth" className="text-muted-foreground hover:text-foreground">
              Connect
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
