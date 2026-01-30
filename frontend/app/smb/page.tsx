import { Container } from "@/components/layout/container";
import { ProtectedRoute } from "@/components/auth/protected-route";

export default function SMBDashboardPage() {
  return (
    <ProtectedRoute>
      <Container>
        <div className="space-y-6">
          <h1 className="text-2xl font-semibold">SMB Dashboard</h1>
          <p className="text-muted-foreground">
            Your invoices, factoring requests, and payouts will appear here.
          </p>
          <div className="rounded-lg border border-input/40 bg-muted/30 p-8 text-center text-muted-foreground">
            SMB dashboard content — placeholder
          </div>
        </div>
      </Container>
    </ProtectedRoute>
  );
}
