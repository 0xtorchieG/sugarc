"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/lp", label: "LP" },
  { href: "/smb", label: "SMB" },
] as const;

function truncateAddress(address: string) {
  if (!address || address.length < 12) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function CopyIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function UserPlaceholderIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="12" cy="8" r="4" />
      <path d="M20 21a8 8 0 0 0-16 0" />
    </svg>
  );
}

export function Header() {
  const pathname = usePathname();
  const { isAuthenticated, isRestoring, wallet, balance, logout } = useAuth();
  const [copied, setCopied] = useState(false);

  async function copyAddress() {
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
                      className="flex items-center gap-2 pl-2 pr-3"
                    >
                      <Avatar className="h-7 w-7">
                        <AvatarFallback className="bg-muted text-muted-foreground">
                          <UserPlaceholderIcon />
                        </AvatarFallback>
                      </Avatar>
                      <span className="hidden font-mono text-muted-foreground sm:inline">
                        {wallet ? truncateAddress(wallet.address) : "…"}
                      </span>
                      {balance !== null && (
                        <span className="hidden text-muted-foreground sm:inline">
                          {balance} USDC
                        </span>
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel className="font-normal">
                      <div className="flex flex-col gap-1">
                        <p className="text-xs text-muted-foreground">Wallet</p>
                        {wallet && (
                          <div className="flex items-center gap-1.5">
                            <p className="font-mono text-xs break-all flex-1 min-w-0">
                              {wallet.address}
                            </p>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                copyAddress();
                              }}
                              title={copied ? "Copied!" : "Copy address"}
                            >
                              {copied ? (
                                <CheckIcon className="text-green-600" />
                              ) : (
                                <CopyIcon />
                              )}
                            </Button>
                          </div>
                        )}
                        {balance !== null && (
                          <p className="text-sm font-medium">USDC {balance}</p>
                        )}
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link href="/lp">Liquidity Provider</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/smb">SMB Dashboard</Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-red-600 focus:text-red-600"
                      onSelect={(e) => {
                        e.preventDefault();
                        logout();
                      }}
                    >
                      Log out
                    </DropdownMenuItem>
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
