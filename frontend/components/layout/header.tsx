"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronDown,
  Copy,
  LayoutDashboard,
  LogOut,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/lp", label: "LP" },
  { href: "/smb", label: "SMB" },
] as const;

function truncateAddress(address: string) {
  if (!address || address.length < 12) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function UserPlaceholderIcon({ className }: { className?: string }) {
  return (
    <Wallet
      className={cn("h-4 w-4 text-muted-foreground", className)}
      aria-hidden
    />
  );
}

export function Header() {
  const pathname = usePathname();
  const { isAuthenticated, isRestoring, wallet, balance, logout } = useAuth();
  const [copied, setCopied] = useState(false);

  async function copyAddress(e: React.MouseEvent | React.KeyboardEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!wallet?.address) return;
    try {
      await navigator.clipboard.writeText(wallet.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  }

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

          {!isRestoring && (
            <>
              {!isAuthenticated ? (
                <Button size="sm" asChild>
                  <Link href="/auth">Log in</Link>
                </Button>
              ) : (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex min-w-0 items-center gap-2 overflow-hidden pl-2 pr-2 sm:pl-2 sm:pr-3"
                      aria-label="Account menu"
                    >
                      <Avatar className="h-7 w-7 shrink-0">
                        <AvatarFallback className="bg-muted text-muted-foreground">
                          <UserPlaceholderIcon />
                        </AvatarFallback>
                      </Avatar>
                      <span className="hidden min-w-0 sm:inline-block">
                        <span className="block text-left text-xs font-medium leading-tight text-foreground">
                          Circle Wallet
                        </span>
                        <span className="block truncate text-left font-mono text-[11px] leading-tight text-muted-foreground">
                          {wallet ? truncateAddress(wallet.address) : "…"}
                        </span>
                      </span>
                      {balance !== null && (
                        <span className="hidden rounded-full bg-primary/10 px-2 py-0.5 font-mono text-xs text-primary md:inline">
                          {balance} USDC
                        </span>
                      )}
                      <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-72 p-0" sideOffset={8}>
                    {/* Identity */}
                    <div className="flex flex-col gap-3 p-4 pb-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10 shrink-0">
                          <AvatarFallback className="bg-muted text-muted-foreground">
                            <UserPlaceholderIcon className="h-5 w-5" />
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-foreground">
                            Connected Circle Wallet
                          </p>
                          <div className="mt-1 flex items-center gap-2">
                            <span className="min-w-0 truncate font-mono text-xs text-muted-foreground">
                              {wallet ? truncateAddress(wallet.address) : "…"}
                            </span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
                              onClick={copyAddress}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") copyAddress(e);
                              }}
                              title={copied ? "Copied!" : "Copy address"}
                              aria-label={copied ? "Copied" : "Copy address"}
                            >
                              {copied ? (
                                <span className="text-primary" aria-hidden>
                                  ✓
                                </span>
                              ) : (
                                <Copy className="h-3.5 w-3.5" aria-hidden />
                              )}
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Balance */}
                    {balance !== null && (
                      <div className="px-4 pb-3">
                        <Card className="border-border/80 bg-muted/30">
                          <CardContent className="p-3">
                            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                              USDC balance
                            </p>
                            <p className="mt-1 text-xl font-semibold tabular-nums text-primary">
                              {balance}
                            </p>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              Available to deposit / fund invoices
                            </p>
                          </CardContent>
                        </Card>
                      </div>
                    )}

                    <DropdownMenuSeparator />

                    {/* Quick actions */}
                    <div className="p-1">
                      <DropdownMenuItem asChild>
                        <Link href="/lp" className="flex cursor-pointer items-center gap-2">
                          <Wallet className="h-4 w-4 shrink-0" />
                          Liquidity Provider
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href="/smb" className="flex cursor-pointer items-center gap-2">
                          <LayoutDashboard className="h-4 w-4 shrink-0" />
                          SMB Dashboard
                        </Link>
                      </DropdownMenuItem>
                    </div>

                    <DropdownMenuSeparator />

                    {/* Log out */}
                    <div className="p-1">
                      <DropdownMenuItem
                        className="cursor-pointer text-destructive focus:bg-destructive/10 focus:text-destructive"
                        onSelect={(e) => {
                          e.preventDefault();
                          logout();
                        }}
                      >
                        <LogOut className="mr-2 h-4 w-4 shrink-0" />
                        Log out
                      </DropdownMenuItem>
                    </div>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
