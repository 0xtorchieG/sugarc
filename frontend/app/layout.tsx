import type { Metadata } from "next";
import { ThirdwebProvider } from "thirdweb/react";
import { client } from "@/lib/thirdweb";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sugarc",
  description: "Tokenized invoice factoring on Arc",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <ThirdwebProvider client={client}>{children}</ThirdwebProvider>
      </body>
    </html>
  );
}
