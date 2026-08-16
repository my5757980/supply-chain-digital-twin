"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CircleCheck, CircleMinus, CircleSlash, Clock, LineChart } from "lucide-react";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState, Notice, Skeleton } from "@/components/ui/feedback";
import { listPredictions, type DisruptionPrediction } from "@/lib/api";

const STATUS: Record<
  DisruptionPrediction["status"],
  { label: string; tone: "info" | "success" | "neutral"; icon: React.ComponentType<{ className?: string }> }
> = {
  active: { label: "Still watching", tone: "info", icon: Clock },
  resolved_true_positive: { label: "Happened as predicted", tone: "success", icon: CircleCheck },
  resolved_false_positive: { label: "Didn't happen", tone: "neutral", icon: CircleSlash },
  expired: { label: "No longer relevant", tone: "neutral", icon: CircleMinus },
};

const TYPE_LABELS: Record<DisruptionPrediction["type"], string> = {
  supplier_delay: "Supplier delay",
  port_congestion: "Port congestion",
  demand_spike: "Demand spike",
};

export default function PredictionHistoryPage(): React.JSX.Element {
  const [predictions, setPredictions] = useState<DisruptionPrediction[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listPredictions()
      .then(setPredictions)
      .catch(() => setError("We couldn't load your history."));
  }, []);

  const resolved = predictions?.filter((p) => p.status.startsWith("resolved_")) ?? [];
  const correct = resolved.filter((p) => p.status === "resolved_true_positive").length;
  const accuracy = resolved.length > 0 ? Math.round((correct / resolved.length) * 100) : null;

  return (
    <AppShell>
      <Link
        href="/alerts"
        className="mb-5 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to alerts
      </Link>

      <PageHeader
        title="Track record"
        description="Every warning we've given you — including the ones that turned out to be nothing. You should be able to judge how much to trust us."
      />

      {error && <Notice tone="danger">{error}</Notice>}

      {accuracy !== null && (
        <Card className="mb-6">
          <CardContent className="flex items-center gap-4">
            <div className="flex size-10 items-center justify-center rounded-md bg-primary-soft text-primary">
              <LineChart className="size-5" />
            </div>
            <div>
              <p className="text-2xl font-semibold tabular-nums">{accuracy}%</p>
              <p className="text-sm text-muted-foreground">
                of our resolved warnings were right ({correct} of {resolved.length})
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {!predictions && !error && (
        <div className="space-y-3">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
      )}

      {predictions && predictions.length === 0 && (
        <Card>
          <EmptyState
            icon={Clock}
            title="No warnings yet"
            description="Once we've spotted something, every prediction will be listed here with what actually happened."
          />
        </Card>
      )}

      <div className="space-y-3">
        {predictions?.map((prediction) => {
          const status = STATUS[prediction.status];
          const Icon = status.icon;
          return (
            <Card key={prediction.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <p className="font-medium">{TYPE_LABELS[prediction.type]}</p>
                  <p className="text-sm text-muted-foreground">
                    Predicted to affect you by{" "}
                    {new Date(prediction.predicted_impact_at).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                </div>
                <Badge tone={status.tone}>
                  <Icon />
                  {status.label}
                </Badge>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {predictions && predictions.length > 0 && (
        <p className="mt-6 text-xs text-muted-foreground">
          We deliberately show warnings that didn&apos;t come true — hiding them would make our
          track record look better than it is.
        </p>
      )}
    </AppShell>
  );
}
