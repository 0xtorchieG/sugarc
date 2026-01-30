import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-input/40 bg-background">
      <div className="container mx-auto max-w-6xl px-4 py-6">
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <p className="text-sm text-muted-foreground">
            Sugarc — Tokenized invoice factoring on Arc
          </p>
          <nav className="flex gap-6 text-sm">
            <Link href="/" className="text-muted-foreground hover:text-foreground">
              Home
            </Link>
            <Link href="/auth" className="text-muted-foreground hover:text-foreground">
              Connect
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
