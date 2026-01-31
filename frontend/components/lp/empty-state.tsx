import { BarChart3, Table2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}

export function EmptyState({
  title,
  description,
  icon,
  className,
  children,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-dashed border-input/60 bg-muted/20 py-12 px-6 text-center",
        className
      )}
    >
      {icon && (
        <div className="mb-3 text-muted-foreground [&_svg]:h-10 [&_svg]:w-10">
          {icon}
        </div>
      )}
      <p className="font-medium text-foreground">{title}</p>
      {description && (
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          {description}
        </p>
      )}
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}

export function EmptyStateChart({
  title,
  description,
}: {
  title?: string;
  description?: string;
}) {
  return (
    <EmptyState
      icon={<BarChart3 className="h-10 w-10" />}
      title={title ?? "No data yet"}
      description={
        description ?? "Metrics will appear here once you have activity."
      }
    />
  );
}

export function EmptyStateTable({
  title,
  description,
}: {
  title?: string;
  description?: string;
}) {
  return (
    <EmptyState
      icon={<Table2 className="h-10 w-10" />}
      title={title ?? "No payouts yet"}
      description={description ?? "Recent payouts will appear here."}
    />
  );
}
