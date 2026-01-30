import { ConnectButton } from "thirdweb/react";
import { client } from "@/lib/thirdweb";
import { Button } from "@/components/ui/button";

const clientId = process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID;

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8">
      <h1 className="text-3xl font-bold mb-4">🍬 Sugarc</h1>
      <p className="text-muted-foreground mb-6">
        Tokenized invoice factoring on Arc
      </p>
      {clientId ? (
        <ConnectButton client={client} theme="dark" />
      ) : (
        <Button variant="outline" disabled>
          Set NEXT_PUBLIC_THIRDWEB_CLIENT_ID to connect
        </Button>
      )}
    </main>
  );
}
