import { cn } from "@/lib/utils";

export function Container({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("container mx-auto max-w-6xl px-4 py-6 sm:px-6", className)}>
      {children}
    </div>
  );
}
