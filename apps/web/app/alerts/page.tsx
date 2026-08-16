"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, History, ShieldCheck } from "lucide-react";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState, Notice, Skeleton } from "@/components/ui/feedback";
import { listAlerts, twinEventsUrl, type Alert } from "@/lib/api";

/** Tell the owner how urgent it is in words they'd use themselves, not the
 * internal severity level (Constitution Principle VI). */
const SEVERITY: Record<Alert["severity"], { label: string; tone: "danger" | "warning" | "info" | "neutral" }> = {
  critical: { label: "Act now", tone: "danger" },
  high: { label: "Act soon", tone: "warning" },
  medium: { label: "Keep an eye on it", tone: "info" },
  low: { label: "Just so you know", tone: "neutral" },
};

const HANDLED: Alert["status"][] = ["acted_on", "dismissed", "expired"];

export default function AlertsInboxPage(): React.JSX.Element {
  const [alerts, setAlerts] = useState<Alert[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    listAlerts()
      .then(setAlerts)
      .catch(() => setError("We couldn't load your alerts. Please sign in again."));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const source = new EventSource(twinEventsUrl(), { withCredentials: true });
    source.addEventListener("alert.created", () => refresh());
    source.addEventListener("alert.escalated", () => refresh());
    return () => source.close();
  }, [refresh]);

  const needsAttention = alerts?.filter((a) => !HANDLED.includes(a.status)) ?? [];
  const handled = alerts?.filter((a) => HANDLED.includes(a.status)) ?? [];

  return (
    <AppShell>
      <PageHeader
        title="Alerts"
        description="Warnings about your supply chain, most urgent first."
        action={
          <Link href="/alerts/history">
            <Button variant="outline" size="sm">
              <History />
              History
            </Button>
          </Link>
        }
      />

      {error && <Notice tone="danger">{error}</Notice>}

      {!alerts && !error && (
        <div className="space-y-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      )}

      {alerts && alerts.length === 0 && (
        <Card>
          <EmptyState
            icon={ShieldCheck}
            title="Nothing to worry about right now"
            description="We're watching your suppliers in the background. If we spot trouble, you'll see it here first — and by email."
          />
        </Card>
      )}

      {needsAttention.length > 0 && (
        <div className="space-y-3">
          {needsAttention.map((alert) => (
            <AlertRow key={alert.id} alert={alert} />
          ))}
        </div>
      )}

      {handled.length > 0 && (
        <div className="mt-8 space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground">Already handled</h2>
          {handled.map((alert) => (
            <AlertRow key={alert.id} alert={alert} dimmed />
          ))}
        </div>
      )}
    </AppShell>
  );
}

function AlertRow({ alert, dimmed }: { alert: Alert; dimmed?: boolean }): React.JSX.Element {
  const severity = SEVERITY[alert.severity];
  return (
    <Link href={`/alerts/${alert.id}`} className="block">
      <Card
        className={`transition-all hover:border-primary/40 hover:shadow-raised ${dimmed ? "opacity-70" : ""}`}
      >
        <CardContent className="flex items-start gap-4">
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-semibold">{alert.title}</p>
              {alert.status === "escalated" && <Badge tone="danger">Still waiting on you</Badge>}
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">{alert.summary}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Badge tone={severity.tone}>{severity.label}</Badge>
            <ChevronRight className="size-4 text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
