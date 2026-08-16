import * as React from "react";
import { AlertTriangle, Info } from "lucide-react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  action?: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
      <div className="flex size-11 items-center justify-center rounded-full bg-surface-muted">
        <Icon className="size-5 text-muted-foreground" />
      </div>
      <div className="space-y-1">
        <p className="font-medium">{title}</p>
        <p className="mx-auto max-w-sm text-sm text-muted-foreground">{description}</p>
      </div>
      {action}
    </div>
  );
}

/** Loading placeholder that mirrors the shape of the content it replaces,
 * so the layout doesn't jump when data lands. */
export function Skeleton({ className }: { className?: string }): React.JSX.Element {
  return <div className={cn("animate-pulse rounded-md bg-surface-muted", className)} />;
}

export function Notice({
  tone = "info",
  children,
}: {
  tone?: "info" | "warning" | "danger";
  children: React.ReactNode;
}): React.JSX.Element {
  const styles = {
    info: "border-info/30 bg-info-soft text-info",
    warning: "border-warning/30 bg-warning-soft text-warning",
    danger: "border-danger/30 bg-danger-soft text-danger",
  }[tone];
  const Icon = tone === "info" ? Info : AlertTriangle;

  return (
    <div className={cn("flex items-start gap-2.5 rounded-md border p-3 text-sm", styles)}>
      <Icon className="mt-0.5 size-4 shrink-0" />
      <div className="[&_a]:underline">{children}</div>
    </div>
  );
}
