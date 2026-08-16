"use client";

import { useCallback, useEffect, useState } from "react";
import { Lock, Plus, Zap } from "lucide-react";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Field, Select } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, Notice, Skeleton } from "@/components/ui/feedback";
import {
  ApiError,
  createAutoTriggerRule,
  getSession,
  listAutoTriggerRules,
  listSuppliers,
  type AutoTriggerRule,
  type SessionUser,
  type Supplier,
} from "@/lib/api";

const DEFAULT_MIN_CONFIDENCE = 0.85;

/** The owner picks how sure we must be, not a raw threshold number
 * (Constitution Principle VI). */
const CONFIDENCE_CHOICES = [
  { label: "Only when we're very sure", value: DEFAULT_MIN_CONFIDENCE },
  { label: "When we're fairly sure", value: 0.7 },
  { label: "Any time we spot a risk", value: 0 },
];

function confidenceLabel(minConfidence: number | undefined): string {
  if (minConfidence === undefined) return "Any time we spot a risk";
  const match = CONFIDENCE_CHOICES.find((c) => c.value === minConfidence);
  return match ? match.label : `When we're at least ${Math.round(minConfidence * 100)}% sure`;
}

export default function AutoTriggerRulesPage(): React.JSX.Element {
  const [session, setSession] = useState<SessionUser | null>(null);
  const [rules, setRules] = useState<AutoTriggerRule[] | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [scopeSupplierId, setScopeSupplierId] = useState("");
  const [minConfidence, setMinConfidence] = useState(DEFAULT_MIN_CONFIDENCE);

  const refreshRules = useCallback(() => {
    listAutoTriggerRules()
      .then(setRules)
      .catch(() => setLoadError("We couldn't load your automatic actions."));
  }, []);

  useEffect(() => {
    getSession()
      .then((user) => {
        setSession(user);
        if (user.role === "owner") {
          refreshRules();
          listSuppliers()
            .then(setSuppliers)
            .catch(() => setSuppliers([]));
        }
      })
      .catch(() => setLoadError("Please sign in to view this page."));
  }, [refreshRules]);

  async function handleCreate(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await createAutoTriggerRule({
        enabled: true,
        scope_supplier_id: scopeSupplierId || undefined,
        conditions: { min_confidence: minConfidence },
      });
      setScopeSupplierId("");
      refreshRules();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "We couldn't save that. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loadError) {
    return (
      <AppShell>
        <Notice tone="danger">{loadError}</Notice>
      </AppShell>
    );
  }

  if (!session) {
    return (
      <AppShell>
        <Skeleton className="h-48" />
      </AppShell>
    );
  }

  // A staff-role user must not see rule-editing controls at all.
  if (session.role !== "owner") {
    return (
      <AppShell>
        <PageHeader title="Automatic actions" />
        <Card>
          <EmptyState
            icon={Lock}
            title="Only the business owner can change this"
            description="Automatic actions decide when we can act without asking first, so they're limited to the owner. Ask them if you need this changed."
          />
        </Card>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader
        title="Automatic actions"
        description="Normally we suggest a plan and wait for you. Turn this on and we'll go ahead automatically in the situations you choose — you can always change it afterwards."
      />

      {error && (
        <div className="mb-5">
          <Notice tone="danger">{error}</Notice>
        </div>
      )}

      <div className="grid gap-5 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="size-4 text-primary" />
              Add an automatic action
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <form className="flex flex-col gap-4" onSubmit={handleCreate}>
              <Field label="Which supplier?">
                <Select
                  value={scopeSupplierId}
                  onChange={(e) => setScopeSupplierId(e.target.value)}
                >
                  <option value="">All of my suppliers</option>
                  {suppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field
                label="When should we act?"
                hint="The surer we have to be, the fewer things we'll do on your behalf."
              >
                <Select
                  value={minConfidence}
                  onChange={(e) => setMinConfidence(Number(e.target.value))}
                >
                  {CONFIDENCE_CHOICES.map((choice) => (
                    <option key={choice.value} value={choice.value}>
                      {choice.label}
                    </option>
                  ))}
                </Select>
              </Field>

              <Button type="submit" disabled={submitting}>
                {submitting ? "Saving…" : "Turn this on"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Your automatic actions</CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {!rules && <Skeleton className="h-20" />}

            {rules && rules.length === 0 && (
              <EmptyState
                icon={Zap}
                title="None yet"
                description="We'll always ask you before doing anything."
              />
            )}

            {rules && rules.length > 0 && (
              <ul className="divide-y divide-border">
                {rules.map((rule) => {
                  const supplier = suppliers.find((s) => s.id === rule.scope_supplier_id);
                  return (
                    <li
                      key={rule.id}
                      className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0"
                    >
                      <div className="space-y-0.5 text-sm">
                        <p className="font-medium">
                          {supplier ? supplier.name : "All of my suppliers"}
                        </p>
                        <p className="text-muted-foreground">
                          {confidenceLabel(rule.conditions?.min_confidence)}
                        </p>
                      </div>
                      <Badge tone={rule.enabled ? "success" : "neutral"}>
                        {rule.enabled ? "On" : "Off"}
                      </Badge>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
