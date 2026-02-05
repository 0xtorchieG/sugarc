import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/layout/container";

export default function NotFound() {
  return (
    <Container>
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-6 py-12 text-center">
        <Image
          src="/icon.png"
          alt="Sugarc"
          width={64}
          height={64}
          className="h-16 w-16 opacity-60"
        />
        <h1 className="text-6xl font-bold text-muted-foreground">404</h1>
        <h2 className="text-xl font-semibold">Page not found</h2>
        <p className="max-w-sm text-muted-foreground">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Button asChild>
          <Link href="/">Go home</Link>
        </Button>
      </div>
    </Container>
  );
}
