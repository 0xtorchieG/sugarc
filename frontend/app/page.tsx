import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/layout/container";

export default function Home() {
  return (
    <Container>
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-8 py-12 text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          🍬 Sugarc
        </h1>
        <p className="max-w-md text-lg text-muted-foreground">
          Tokenized invoice factoring on Arc — instant SMB cashflow, real
          on-chain yield.
        </p>
        <div className="flex flex-col gap-4 sm:flex-row">
          <Button asChild size="lg">
            <Link href="/lp">I&apos;m a Liquidity Provider</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/smb">I&apos;m an SMB</Link>
          </Button>
        </div>
        <div className="pt-4">
          <Button asChild variant="outline" size="lg">
            <Link href="/auth">Connect wallet</Link>
          </Button>
        </div>
      </div>
    </Container>
  );
}
