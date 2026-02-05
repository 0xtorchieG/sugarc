import Image from "next/image";
import { Container } from "./container";
import { Skeleton } from "@/components/ui/skeleton";

export function LoadingSkeleton() {
  return (
    <Container>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Image
            src="/icon.png"
            alt=""
            width={32}
            height={32}
            className="h-8 w-8 animate-pulse opacity-70"
            aria-hidden
          />
          <Skeleton className="h-8 w-48" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    </Container>
  );
}
