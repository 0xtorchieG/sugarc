import { Container } from "@/components/layout/container";

export default function LPDashboardPage() {
  return (
    <Container>
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Liquidity Provider Dashboard</h1>
        <p className="text-muted-foreground">
          Your supplied liquidity, yield, and activity will appear here.
        </p>
        <div className="rounded-lg border border-input/40 bg-muted/30 p-8 text-center text-muted-foreground">
          LP dashboard content — placeholder
        </div>
      </div>
    </Container>
  );
}
