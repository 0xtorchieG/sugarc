"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ArrowRight, Wallet, FileText } from "lucide-react";

const TAGLINE =
  "Because waiting 30/60/90 days isn't sweet. Melt invoices into liquidity — instantly.";

const ROLE_SMB = {
  title: "I'm an SMB",
  tagline: "Upload invoice → get USDC today",
  target: "/smb",
  icon: FileText,
};

const ROLE_LP = {
  title: "I'm a Liquidity Provider",
  tagline: "Deposit USDC → earn yield from repayments",
  target: "/lp",
  icon: Wallet,
};

function RoleCard({
  title,
  tagline,
  target,
  icon: Icon,
  onContinue,
}: {
  title: string;
  tagline: string;
  target: string;
  icon: React.ElementType;
  onContinue: (target: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onContinue(target)}
      className={cn(
        "group relative flex w-full flex-col items-start gap-2 rounded-xl border border-white/60 bg-white/80 p-5 text-left backdrop-blur-xl",
        "transition-all duration-300 ease-out",
        "hover:border-primary/30 hover:bg-white/95 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-0.5",
        "active:scale-[0.99]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
      )}
    >
      <div className="flex w-full items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary",
              "transition-colors duration-300 group-hover:bg-primary/20"
            )}
          >
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">{title}</h3>
            <p className="text-sm text-muted-foreground">{tagline}</p>
          </div>
        </div>
        <ArrowRight
          className={cn(
            "h-5 w-5 text-primary opacity-60",
            "transition-all duration-300 group-hover:translate-x-1 group-hover:opacity-100"
          )}
        />
      </div>
    </button>
  );
}

export default function Home() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();

  const handleContinue = (target: string) => {
    if (isAuthenticated) {
      router.push(target);
    } else {
      router.push(`/auth?returnTo=${encodeURIComponent(target)}`);
    }
  };

  return (
    <div className="relative flex min-h-[calc(100vh-3.5rem)] flex-col items-center justify-center px-4 py-12 sm:py-16">
      <div className="mx-auto flex w-full max-w-lg flex-col items-center text-center">
        {/* Title — pistachio gradient, premium weight */}
        <h1
          className={cn(
            "text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl",
            "bg-gradient-to-br from-foreground via-foreground to-primary bg-clip-text text-transparent",
            "drop-shadow-sm"
          )}
        >
          Sugarc
        </h1>

        {/* Tagline — liquidity, cashflow */}
        <p className="mt-5 max-w-md text-base leading-relaxed text-muted-foreground sm:text-lg">
          {TAGLINE}
        </p>

        {/* Login / Navigation Card */}
        <Card
          className={cn(
            "mt-12 w-full max-w-md overflow-hidden animate-fade-in-up",
            "border border-white/70 bg-white/90 shadow-2xl shadow-foreground/5 backdrop-blur-xl",
            "transition-all duration-300 hover:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.08)]"
          )}
        >
          <CardContent className="p-6 sm:p-8">
            <p className="mb-6 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Get started
            </p>

            <div className="space-y-3">
              <RoleCard
                title={ROLE_SMB.title}
                tagline={ROLE_SMB.tagline}
                target={ROLE_SMB.target}
                icon={ROLE_SMB.icon}
                onContinue={handleContinue}
              />
              <RoleCard
                title={ROLE_LP.title}
                tagline={ROLE_LP.tagline}
                target={ROLE_LP.target}
                icon={ROLE_LP.icon}
                onContinue={handleContinue}
              />
            </div>

            {!isAuthenticated && (
              <div className="mt-6 pt-6 border-t border-border/50">
                <Button
                  asChild
                  size="lg"
                  className={cn(
                    "w-full font-semibold",
                    "transition-all duration-300 hover:scale-[1.01] hover:shadow-md"
                  )}
                >
                  <Link href="/auth">
                    Log in with Google
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <p className="mt-3 text-xs text-muted-foreground">
                  One-click sign-in. We&apos;ll create your wallet automatically.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <p className="mt-10 text-xs font-medium tracking-wide text-muted-foreground/90">
          Tokenized invoice factoring on Arc · Instant liquidity for SMBs
        </p>
      </div>
    </div>
  );
}
