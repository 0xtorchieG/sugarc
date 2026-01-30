"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/lp", label: "LP" },
  { href: "/smb", label: "SMB" },
] as const;

const showRoleSwitcher =
  process.env.NODE_ENV === "development" ||
  process.env.NEXT_PUBLIC_DEV_ROLE_SWITCHER === "true";

export function Header() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-input/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Link
          href="/"
          className="flex items-center gap-2 font-semibold text-foreground"
        >
          🍬 Sugarc
        </Link>
        <nav className="flex items-center gap-1 sm:gap-2">
          {navLinks.map(({ href, label }) => (
            <Button
              key={href}
              variant={pathname === href ? "default" : "outline"}
              size="sm"
              className={cn(pathname === href && "pointer-events-none")}
              asChild
            >
              <Link href={href}>{label}</Link>
            </Button>
          ))}
          {showRoleSwitcher && (
            <span className="ml-2 hidden text-xs text-muted-foreground sm:inline">
              [dev]
            </span>
          )}
        </nav>
      </div>
    </header>
  );
}
