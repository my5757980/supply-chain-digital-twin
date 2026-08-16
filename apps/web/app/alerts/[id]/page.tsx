"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  CalendarClock,
  Check,
  CircleAlert,
  ListChecks,
  Pencil,
  Store,
  X,
  Zap,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Notice, Skeleton } from "@/components/ui/feedback";
import { ApiError, decideOnAlert, getAlert, type AlertDetail } from "@/lib/api";

const DECISION_LABELS: Record<string, string> = {
  accepted: "You accepted this plan",
  modified: "You're handling this your own way",
  dismissed: "You dismissed this plan",
};

const SEVERITY: Record<string, { label: string; tone: "danger" | "warning" | "info" | "neutral" }> = {
  critical: { label: "Act now", tone: "danger" },
  high: { label: "Act soon", tone: "warning" },
  medium: { label: "Keep an eye on it", tone: "info" },
  low: { label: "Just so you know", tone: "neutral" },
};

export default function AlertDetailPage(): React.JSX.Element {
  const params = useParams<{ id: string }>();
  const [alert, setAlert] = useState<AlertDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [notes, setNotes] = useState("");

  const refresh = useCallback(() => {
    getAlert(params.id)
      .then(setAlert)
      .catch(() => setError("We couldn't load this alert."));
  }, [params.id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function submitDecision(decision: "accepted" | "modified" | "dismissed"): Promise<void> {
    setError(null);
    setSubmitting(true);
    try {
      await decideOnAlert(params.id, {
        decision,
        ...(decision === "modified" ? { modification_notes: notes } : {}),
      });
      setShowNotes(false);
      setNotes("");
      refresh();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "We couldn't save that. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (!alert) {
    return (
      <AppShell>
        {error ? <Notice tone="danger">{error}</Notice> : <Skeleton className="h-64" />}
      </AppShell>
    );
  }

  const impactDate = new Date(alert.prediction.predicted_impact_at).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const recommendation = alert.recommendation;
  const alternativeName =
    recommendation?.recommended_supplier_name ??
    recommendation?.recommended_directory_entry_name ??
    null;
  const isOwnBackup = recommendation?.recommended_supplier_name != null;
  const decisionPending = recommendation?.owner_decision === "pending";
  const severity = SEVERITY[alert.severity] ?? { label: alert.severity, tone: "neutral" as const };

  return (
    <AppShell>
      <Link
        href="/alerts"
        className="mb-5 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to alerts
      </Link>

      <div className="mb-6 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={severity.tone}>{severity.label}</Badge>
          {recommendation?.auto_triggered && (
            <Badge tone="primary">
              <Zap />
              Handled automatically
            </Badge>
          )}
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">{alert.title}</h1>
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <CalendarClock className="size-4" />
          Expected to affect you by {impactDate}
        </p>
      </div>

      {error && (
        <div className="mb-5">
          <Notice tone="danger">{error}</Notice>
        </div>
      )}

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CircleAlert className="size-4 text-warning" />
              What&apos;s happening
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-3 text-sm leading-relaxed">{alert.summary}</CardContent>
        </Card>

        {!recommendation && (
          <Card>
            <CardHeader>
              <CardTitle>We&apos;re preparing your plan</CardTitle>
            </CardHeader>
            <CardContent className="pt-3 text-sm text-muted-foreground">
              In the meantime, it&apos;s worth calling your supplier directly to confirm the delay.
            </CardContent>
          </Card>
        )}

        {recommendation && (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Store className="size-4 text-primary" />
                  Where to source instead
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-3">
                {alternativeName ? (
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-semibold">{alternativeName}</span>
                    <Badge tone={isOwnBackup ? "success" : "info"}>
                      {isOwnBackup ? "Your own backup" : "Verified local supplier"}
                    </Badge>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    We couldn&apos;t find an alternative supplier automatically — the steps below
                    will help you handle this yourself.
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ListChecks className="size-4 text-primary" />
                  Your step-by-step plan
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-3">
                <ol className="space-y-3">
                  {recommendation.steps.map((step, index) => (
                    <li key={index} className="flex gap-3 text-sm">
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary">
                        {index + 1}
                      </span>
                      <span className="pt-0.5 leading-relaxed">{step}</span>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>
                  {decisionPending ? "What would you like to do?" : "Your decision"}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-3">
                {!decisionPending && (
                  <p className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
                    <Check className="size-4 text-success" />
                    {DECISION_LABELS[recommendation.owner_decision]}
                  </p>
                )}

                {showNotes ? (
                  <div className="flex flex-col gap-3">
                    <Input
                      placeholder="What are you doing instead?"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      autoFocus
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button
                        onClick={() => void submitDecision("modified")}
                        disabled={submitting || notes.trim().length === 0}
                      >
                        Save my plan
                      </Button>
                      <Button variant="ghost" onClick={() => setShowNotes(false)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={() => void submitDecision("accepted")} disabled={submitting}>
                      <Check />
                      {decisionPending ? "Accept this plan" : "Accept instead"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setShowNotes(true)}
                      disabled={submitting}
                    >
                      <Pencil />
                      I&apos;ll do something different
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => void submitDecision("dismissed")}
                      disabled={submitting}
                    >
                      <X />
                      Dismiss
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}

        <p className="text-xs text-muted-foreground">
          {alert.channels_sent.length > 0 &&
            `We told you here${alert.channels_sent.includes("email") ? " and by email" : ""}.`}
        </p>
      </div>
    </AppShell>
  );
}
