"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Boxes,
  PackageSearch,
  ShoppingCart,
  Truck,
  Users,
} from "lucide-react";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState, Notice, Skeleton } from "@/components/ui/feedback";
import { getTwin, twinEventsUrl, type TwinSnapshot } from "@/lib/api";

/** Constitution Principle VI: never show a raw enum value to an SME owner. */
const DATA_SOURCE_LABELS: Record<string, string> = {
  manual: "the details you typed in",
  csv_upload: "your uploaded spreadsheet",
  pos_integration: "your till system",
  erp_integration: "your business software",
};

const SUPPLIER_STATUS: Record<string, { label: string; tone: "success" | "warning" | "danger" }> = {
  active: { label: "On track", tone: "success" },
  delayed: { label: "Running late", tone: "warning" },
  at_risk: { label: "At risk", tone: "danger" },
};

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  hint?: string;
}): React.JSX.Element {
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-2xl font-semibold tabular-nums">{value}</p>
          {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>
        <div className="flex size-9 items-center justify-center rounded-md bg-primary-soft text-primary">
          <Icon className="size-4.5" />
        </div>
      </CardContent>
    </Card>
  );
}

export default function TwinPage(): React.JSX.Element {
  const [twin, setTwin] = useState<TwinSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState(false);

  const refresh = useCallback(() => {
    getTwin()
      .then(setTwin)
      .catch(() => setError("We couldn't load your supply chain. Please sign in again."));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Live updates without a manual refresh (spec.md US1, Scenario 2).
  useEffect(() => {
    const source = new EventSource(twinEventsUrl(), { withCredentials: true });
    source.addEventListener("open", () => setLive(true));
    source.addEventListener("error", () => setLive(false));
    source.addEventListener("twin.updated", () => refresh());
    return () => source.close();
  }, [refresh]);

  const lowStock = twin
    ? twin.inventory_summary.filter(
        (i) => i.reorder_threshold != null && i.quantity_on_hand <= i.reorder_threshold,
      ).length
    : 0;

  return (
    <AppShell>
      <PageHeader
        title="Your supply chain"
        description={
          twin
            ? `Last updated ${new Date(twin.computed_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
            : "Loading your latest position…"
        }
        action={
          <Badge tone={live ? "success" : "neutral"}>
            <span
              className={live ? "size-1.5 rounded-full bg-success animate-pulse-dot" : "size-1.5 rounded-full bg-muted-foreground"}
            />
            {live ? "Live" : "Connecting…"}
          </Badge>
        }
      />

      {error && (
        <div className="mb-6">
          <Notice tone="danger">{error}</Notice>
        </div>
      )}

      {!twin && !error && (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </div>
          <Skeleton className="h-56" />
        </div>
      )}

      {twin && (
        <div className="space-y-6">
          {twin.stale_data_warnings.length > 0 && (
            <Notice tone="warning">
              Some of your information hasn&apos;t updated in a while, so it may be out of date:{" "}
              {twin.stale_data_warnings
                .map((w) => DATA_SOURCE_LABELS[w.affected_area] ?? "one of your data sources")
                .join(", ")}
              .
            </Notice>
          )}

          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard
              icon={Boxes}
              label="Items in stock"
              value={twin.inventory_summary.length}
              hint={lowStock > 0 ? `${lowStock} running low` : "All above reorder level"}
            />
            <StatCard icon={Users} label="Suppliers" value={twin.suppliers.length} />
            <StatCard icon={ShoppingCart} label="Open orders" value={twin.open_orders_count} />
          </div>

          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Inventory</CardTitle>
              <Link href="/onboarding">
                <Button variant="ghost" size="sm">
                  Add item
                </Button>
              </Link>
            </CardHeader>
            <CardContent className="pt-4">
              {twin.inventory_summary.length === 0 ? (
                <EmptyState
                  icon={PackageSearch}
                  title="No stock added yet"
                  description="Add what you have in stock so we can watch it for you."
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                        <th className="pb-2 font-medium">Item</th>
                        <th className="pb-2 font-medium">Code</th>
                        <th className="pb-2 text-right font-medium">In stock</th>
                      </tr>
                    </thead>
                    <tbody>
                      {twin.inventory_summary.map((item) => {
                        const low =
                          item.reorder_threshold != null &&
                          item.quantity_on_hand <= item.reorder_threshold;
                        return (
                          <tr key={item.id} className="border-b border-border last:border-0">
                            <td className="py-2.5 font-medium">{item.name}</td>
                            <td className="py-2.5 text-muted-foreground">{item.sku}</td>
                            <td className="py-2.5 text-right">
                              <span className="inline-flex items-center gap-2">
                                {low && <Badge tone="warning">Low</Badge>}
                                <span className="tabular-nums">{item.quantity_on_hand}</span>
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Suppliers</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              {twin.suppliers.length === 0 ? (
                <EmptyState
                  icon={Truck}
                  title="No suppliers yet"
                  description="Add your suppliers — especially your backups. We use them to find you an alternative when something goes wrong."
                />
              ) : (
                <ul className="divide-y divide-border">
                  {twin.suppliers.map((supplier) => {
                    const status = SUPPLIER_STATUS[supplier.status] ?? {
                      label: supplier.status,
                      tone: "neutral" as const,
                    };
                    return (
                      <li
                        key={supplier.id}
                        className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
                      >
                        <div>
                          <p className="font-medium">{supplier.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {supplier.kind === "backup" ? "Backup supplier" : "Main supplier"}
                            {supplier.location ? ` · ${supplier.location}` : ""}
                          </p>
                        </div>
                        <Badge tone={status.tone}>
                          {supplier.status !== "active" && <AlertTriangle />}
                          {status.label}
                        </Badge>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </AppShell>
  );
}
