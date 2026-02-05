"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";

/**
 * Sugarc landing mood board: Dithered pistachio ice cream → liquidity flowing.
 * - Dithering = premium grain texture (pistachio flecks)
 * - Flowing shapes = cashflow, liquidity in motion
 */
export function DitheringBackground({ className }: { className?: string }) {
  const id = useId();
  const safeId = id.replace(/:/g, "");
  const noiseId = `grain-${safeId}`;
  const flowGrad1 = `flow-grad-1-${safeId}`;
  const flowGrad2 = `flow-grad-2-${safeId}`;

  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none fixed inset-0 -z-[1] overflow-hidden isolate",
        className
      )}
    >
      {/* Layer 1: Rich pistachio gradient base */}
      <div
        className="absolute inset-0"
        style={{
          background: `
            linear-gradient(
              160deg,
              hsl(50 30% 97%) 0%,
              hsl(70 28% 94%) 15%,
              hsl(85 30% 88%) 35%,
              hsl(88 35% 78%) 55%,
              hsl(88 38% 65%) 75%,
              hsl(88 40% 52%) 100%
            )
          `,
        }}
      />

      {/* Layer 2: Grainy dither — pistachio ice cream texture (speckled, premium) */}
      <div
        className="absolute inset-0 mix-blend-multiply"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundSize: "140px 140px",
          opacity: 0.5,
          filter: "contrast(180%) brightness(120%)",
        }}
      />

      {/* Layer 3: Abstract liquidity flows — cashflow in motion */}
      <svg
        className="absolute inset-0 h-full w-full opacity-60"
        viewBox="0 0 1200 800"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <linearGradient id={flowGrad1} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="hsl(88 35% 85%)" stopOpacity="0.6" />
            <stop offset="50%" stopColor="hsl(88 38% 65%)" stopOpacity="0.4" />
            <stop offset="100%" stopColor="hsl(88 40% 50%)" stopOpacity="0.5" />
          </linearGradient>
          <linearGradient id={flowGrad2} x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="hsl(88 30% 90%)" stopOpacity="0.5" />
            <stop offset="100%" stopColor="hsl(88 38% 58%)" stopOpacity="0.35" />
          </linearGradient>
        </defs>
        {/* Flowing ribbon 1 — liquidity stream */}
        <path
          d="M-100 180 C150 120 350 220 550 200 C750 180 950 240 1150 220 L1300 240 L1300 260 L1150 240 C950 260 750 200 550 220 C350 240 150 200 -100 200 Z"
          fill={`url(#${flowGrad1})`}
          className="flow-ribbon"
          style={{ animationDelay: "0s" }}
        />
        {/* Flowing ribbon 2 */}
        <path
          d="M-100 480 C200 420 450 500 650 480 C850 460 1000 520 1200 500 L1350 520 L1350 540 L1200 520 C1000 540 850 480 650 500 C450 520 200 480 -100 500 Z"
          fill={`url(#${flowGrad2})`}
          className="flow-ribbon"
          style={{ animationDelay: "-6s" }}
        />
        {/* Flowing ribbon 3 — subtle */}
        <path
          d="M-100 620 C180 580 400 640 600 620 C800 600 1000 660 1200 640 L1350 660 L1350 680 L1200 660 C1000 680 800 620 600 640 C400 660 180 620 -100 640 Z"
          fill={`url(#${flowGrad1})`}
          className="flow-ribbon"
          style={{ animationDelay: "-3s", opacity: 0.45 }}
        />
      </svg>

      {/* Layer 4: Soft gradient veil for depth */}
      <div
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(
              ellipse 90% 80% at 50% 30%,
              transparent 0%,
              hsl(88 25% 95% / 0.15) 50%,
              transparent 100%
            )
          `,
        }}
      />

      {/* Layer 5: Subtle vignette */}
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(
            ellipse 85% 75% at 50% 50%,
            transparent 50%,
            hsl(28 25% 12% / 0.04) 100%
          )`,
        }}
      />
    </div>
  );
}
