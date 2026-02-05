import type { Metadata } from "next";
import { AuthProvider } from "@/contexts/auth-context";
import { AppShell } from "@/components/layout/app-shell";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sugarc",
  description: "Tokenized invoice factoring on Arc — melt invoices into liquidity, instantly.",
  icons: {
    icon: "/icon.png",
    apple: "/apple-icon.png",
  },
  manifest: "/manifest.json",
  openGraph: {
    title: "Sugarc",
    description: "Tokenized invoice factoring on Arc — melt invoices into liquidity, instantly.",
    images: ["/logo-banner.png"],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <AppShell>{children}</AppShell>
        </AuthProvider>
      </body>
    </html>
  );
}
