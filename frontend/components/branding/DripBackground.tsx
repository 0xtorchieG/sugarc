"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";

/**
 * Full-screen "dripping pistachio ice cream" background — Sugarc mood: sweet, premium.
 * Cream scoop at top, pistachio drips down the sides and bottom. No image assets.
 * Rendered once in AppShell so it appears on all routes.
 */
export function DripBackground({ className }: { className?: string }) {
  const id = useId();
  const safeId = id.replace(/:/g, "");
  const gradientId = `drip-grad-${safeId}`;
  const shadowId = `drip-shadow-${safeId}`;
  const noiseId = `drip-noise-${safeId}`;

  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none fixed inset-0 -z-[1] overflow-hidden",
        className
      )}
    >
      {/* Base: cream scoop at top → soft pistachio melt toward bottom */}
      <div
        className="absolute inset-0"
        style={{
          background: `
            linear-gradient(
              180deg,
              hsl(48 26% 98%) 0%,
              hsl(52 22% 96%) 25%,
              hsl(65 20% 94%) 50%,
              hsl(82 24% 90%) 72%,
              hsl(88 30% 85%) 88%,
              hsl(88 34% 78%) 100%
            )
          `,
        }}
      />

      {/* Organic drip shapes — left, right, and bottom (pistachio syrup) */}
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 1200 800"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="hsl(88 30% 92%)" stopOpacity="0.95" />
            <stop offset="100%" stopColor="hsl(88 38% 48%)" stopOpacity="0.92" />
          </linearGradient>
          <filter id={shadowId} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="hsl(88 30% 30%)" floodOpacity="0.15" />
          </filter>
        </defs>
        {/* Left side drips */}
        {/* Left side — organic drips */}
        <path
          d="M0 80 C-15 200 10 350 5 500 C0 650 15 780 0 820 L20 820 C25 650 30 500 25 350 C20 200 0 80 0 80 Z"
          fill={`url(#${gradientId})`}
          filter={`url(#${shadowId})`}
          opacity={0.88}
        />
        <path
          d="M-5 350 C25 450 15 580 20 720 C22 800 0 820 0 820 L5 820 C8 720 5 580 0 450 C-3 380 -5 350 -5 350 Z"
          fill={`url(#${gradientId})`}
          filter={`url(#${shadowId})`}
          opacity={0.82}
        />
        {/* Right side */}
        <path
          d="M1200 120 C1215 250 1190 400 1195 550 C1200 700 1185 800 1200 820 L1180 820 C1175 700 1170 550 1175 400 C1180 250 1200 120 1200 120 Z"
          fill={`url(#${gradientId})`}
          filter={`url(#${shadowId})`}
          opacity={0.88}
        />
        <path
          d="M1205 400 C1175 500 1185 620 1180 760 C1178 820 1200 820 1200 820 L1195 820 C1192 760 1195 620 1200 500 C1203 430 1205 400 1205 400 Z"
          fill={`url(#${gradientId})`}
          filter={`url(#${shadowId})`}
          opacity={0.82}
        />
        {/* Bottom — melting drips */}
        <path
          d="M380 750 C420 680 480 720 500 780 C520 820 500 820 500 820 L400 820 C380 800 360 780 380 750 Z"
          fill={`url(#${gradientId})`}
          filter={`url(#${shadowId})`}
          opacity={0.85}
        />
        <path
          d="M520 820 C560 750 620 780 640 820 C660 850 640 820 640 820 L540 820 C520 820 500 810 520 820 Z"
          fill={`url(#${gradientId})`}
          filter={`url(#${shadowId})`}
          opacity={0.85}
        />
        <path
          d="M660 800 C700 730 760 770 780 820 C800 850 780 820 780 820 L680 820 C660 820 640 810 660 800 Z"
          fill={`url(#${gradientId})`}
          filter={`url(#${shadowId})`}
          opacity={0.85}
        />
        <path
          d="M800 780 C840 710 900 750 920 800 C940 830 920 820 920 820 L820 820 C800 810 780 800 800 780 Z"
          fill={`url(#${gradientId})`}
          filter={`url(#${shadowId})`}
          opacity={0.85}
        />
      </svg>

      {/* Subtle grain overlay */}
      <svg className="absolute inset-0 h-full w-full opacity-[0.03]" aria-hidden>
        <defs>
          <filter id={noiseId}>
            <feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="3" result="n" />
            <feColorMatrix in="n" type="saturate" values="0" />
          </filter>
        </defs>
        <rect width="100%" height="100%" filter={`url(#${noiseId})`} />
      </svg>
    </div>
  );
}
