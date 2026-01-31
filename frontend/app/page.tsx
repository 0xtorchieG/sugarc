"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Container } from "@/components/layout/container";
import { cn } from "@/lib/utils";

const HERO = {
  headline: "Sugarc",
  subtext:
    "Tokenized invoice factoring on Arc — instant SMB cashflow, real on-chain yield. Choose your path below.",
};

const ROLE_SMB = {
  title: "I'm an SMB",
  tagline: "Upload invoice → get USDC today",
  bullets: [
    "Submit your invoice and get verified in minutes",
    "Receive USDC instantly from the liquidity pool",
    "Repay on your terms; we handle the rest",
  ],
  target: "/smb",
  primary: true,
};

const ROLE_LP = {
  title: "I'm a Liquidity Provider",
  tagline: "Deposit USDC → earn yield from repayments",
  bullets: [
    "Deposit USDC into the pool and start earning",
    "Yield comes from SMB repayments (invoice factoring)",
    "Withdraw when you want; no lock-up required",
  ],
  target: "/lp",
  primary: false,
};

const HOW_IT_WORKS = [
  {
    step: 1,
    title: "SMB submits invoice",
    description: "Business uploads an invoice; we verify and approve for funding.",
  },
  {
    step: 2,
    title: "Pool funds instantly",
    description: "USDC is sent from the liquidity pool to the SMB right away.",
  },
  {
    step: 3,
    title: "Repayment yields LP return",
    description: "When the SMB repays, LPs earn yield on their deposit.",
  },
];

const MOCK_STATS = {
  totalLiquidity: "$2.4M",
  invoicesFunded: "847",
  avgApr: "12.3%",
};

function RoleCard({
  title,
  tagline,
  bullets,
  target,
  primary,
  onContinue,
}: {
  title: string;
  tagline: string;
  bullets: string[];
  target: string;
  primary: boolean;
  onContinue: (target: string) => void;
}) {
  return (
    <Card
      className={cn(
        "flex flex-col transition-all hover:shadow-md",
        primary
          ? "border-primary/40 bg-primary/5"
          : "border-border bg-card hover:border-primary/20"
      )}
    >
      <CardHeader className="pb-2">
        <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
        <p className="text-sm font-medium text-primary">{tagline}</p>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4 pt-0">
        <ul className="space-y-2 text-sm text-muted-foreground">
          {bullets.map((b, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="mt-0.5 text-primary" aria-hidden>
                •
              </span>
              {b}
            </li>
          ))}
        </ul>
        <Button
          className="mt-auto w-full sm:w-auto"
          variant={primary ? "default" : "outline"}
          size="lg"
          onClick={() => onContinue(target)}
        >
          Continue
        </Button>
      </CardContent>
    </Card>
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
    <Container>
      {/* Hero */}
      <section className="relative py-12 sm:py-16">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            {HERO.headline}
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">{HERO.subtext}</p>
        </div>
      </section>

      {/* Role cards */}
      <section className="py-8">
        <div className="grid gap-6 sm:grid-cols-2 lg:gap-8">
          <RoleCard
            title={ROLE_SMB.title}
            tagline={ROLE_SMB.tagline}
            bullets={ROLE_SMB.bullets}
            target={ROLE_SMB.target}
            primary={ROLE_SMB.primary}
            onContinue={handleContinue}
          />
          <RoleCard
            title={ROLE_LP.title}
            tagline={ROLE_LP.tagline}
            bullets={ROLE_LP.bullets}
            target={ROLE_LP.target}
            primary={ROLE_LP.primary}
            onContinue={handleContinue}
          />
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-border/80 py-12">
        <h2 className="mb-8 text-center text-2xl font-semibold tracking-tight">
          How it works
        </h2>
        <div className="grid gap-8 sm:grid-cols-3">
          {HOW_IT_WORKS.map(({ step, title, description }) => (
            <div
              key={step}
              className="flex flex-col items-center text-center sm:items-start sm:text-left"
            >
              <span
                className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground"
                aria-hidden
              >
                {step}
              </span>
              <h3 className="font-semibold text-foreground">{title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Live stats strip */}
      <section className="border-t border-border/80 py-8">
        <div className="flex flex-wrap items-center justify-center gap-8 sm:gap-12">
          <div className="text-center">
            <p className="text-2xl font-bold text-foreground sm:text-3xl">
              {MOCK_STATS.totalLiquidity}
            </p>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Total liquidity
            </p>
          </div>
          <div className="h-8 w-px bg-border" aria-hidden />
          <div className="text-center">
            <p className="text-2xl font-bold text-foreground sm:text-3xl">
              {MOCK_STATS.invoicesFunded}
            </p>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Invoices funded
            </p>
          </div>
          <div className="h-8 w-px bg-border" aria-hidden />
          <div className="text-center">
            <p className="text-2xl font-bold text-primary sm:text-3xl">
              {MOCK_STATS.avgApr}
            </p>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Avg. APR
            </p>
          </div>
        </div>
      </section>
    </Container>
  );
}
