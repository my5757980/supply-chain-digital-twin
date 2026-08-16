"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Building2,
  Check,
  FileSpreadsheet,
  Package,
  ShieldCheck,
  Truck,
  Waypoints,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Notice } from "@/components/ui/feedback";
import { cn } from "@/lib/utils";
import {
  createTenant,
  devLogin,
  createInventoryItem,
  createSupplier,
  uploadCsv,
  grantAiConsent,
  ApiError,
} from "@/lib/api";

type Step = "business" | "connect-data" | "consent";

const STEPS: { id: Step; label: string }[] = [
  { id: "business", label: "Your business" },
  { id: "connect-data", label: "Your stock" },
  { id: "consent", label: "Smart alerts" },
];

export default function OnboardingPage(): React.JSX.Element {
  const router = useRouter();
  const [step, setStep] = useState<Step>("business");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [businessName, setBusinessName] = useState("");
  const [sector, setSector] = useState("");
  const [ownerContact, setOwnerContact] = useState("");

  const [itemName, setItemName] = useState("");
  const [itemCode, setItemCode] = useState("");
  const [itemQuantity, setItemQuantity] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [itemsAdded, setItemsAdded] = useState(0);
  const [suppliersAdded, setSuppliersAdded] = useState(0);

  const stepIndex = STEPS.findIndex((s) => s.id === step);

  async function handleCreateBusiness(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const tenant = await createTenant({
        business_name: businessName,
        sector,
        owner_email_or_phone: ownerContact,
      });
      // Sign the owner in immediately so a first-time, non-technical user
      // never sees a separate login step. `owner_user_id` is a dev-mode
      // bootstrap field (see tenant.mapper.ts).
      await devLogin(tenant.owner_user_id);
      setStep("connect-data");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGrantConsent(): Promise<void> {
    setError(null);
    setSubmitting(true);
    try {
      await grantAiConsent();
      router.push("/twin");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "We couldn't save that. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAddItem(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    try {
      await createInventoryItem({
        sku: itemCode,
        name: itemName,
        quantity_on_hand: Number(itemQuantity),
      });
      setItemName("");
      setItemCode("");
      setItemQuantity("");
      setItemsAdded((n) => n + 1);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "We couldn't add that item.");
    }
  }

  async function handleAddSupplier(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    try {
      await createSupplier({ name: supplierName, kind: "primary" });
      setSupplierName("");
      setSuppliersAdded((n) => n + 1);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "We couldn't add that supplier.");
    }
  }

  async function handleCsvUpload(e: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    try {
      await uploadCsv(file, "inventory");
      setItemsAdded((n) => n + 1);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "We couldn't read that file.");
    }
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-border">
        <div className="mx-auto flex h-14 max-w-2xl items-center px-4 sm:px-6">
          <div className="flex items-center gap-2 font-semibold tracking-tight">
            <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Waypoints className="size-4" />
            </span>
            SupplyTwin
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        <nav aria-label="Progress" className="mb-8 flex items-center gap-2">
          {STEPS.map((s, index) => (
            <div key={s.id} className="flex flex-1 items-center gap-2">
              <div
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                  index < stepIndex && "bg-success text-white",
                  index === stepIndex && "bg-primary text-primary-foreground",
                  index > stepIndex && "bg-surface-muted text-muted-foreground",
                )}
              >
                {index < stepIndex ? <Check className="size-3.5" /> : index + 1}
              </div>
              <span
                className={cn(
                  "hidden text-sm sm:inline",
                  index === stepIndex ? "font-medium" : "text-muted-foreground",
                )}
              >
                {s.label}
              </span>
              {index < STEPS.length - 1 && <div className="h-px flex-1 bg-border" />}
            </div>
          ))}
        </nav>

        {error && (
          <div className="mb-5">
            <Notice tone="danger">{error}</Notice>
          </div>
        )}

        {step === "business" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="size-4 text-primary" />
                Tell us about your business
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <form className="flex flex-col gap-4" onSubmit={handleCreateBusiness}>
                <Field label="Business name">
                  <Input
                    placeholder="e.g. Al Noor Trading LLC"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    required
                  />
                </Field>
                <Field label="What do you sell?" hint="This helps us find local suppliers for you.">
                  <Input
                    placeholder="e.g. retail, food, logistics"
                    value={sector}
                    onChange={(e) => setSector(e.target.value)}
                    required
                  />
                </Field>
                <Field label="Your email or phone">
                  <Input
                    placeholder="owner@yourbusiness.ae"
                    value={ownerContact}
                    onChange={(e) => setOwnerContact(e.target.value)}
                    required
                  />
                </Field>
                <Button type="submit" disabled={submitting}>
                  {submitting ? "Setting up…" : "Continue"}
                  {!submitting && <ArrowRight />}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {step === "connect-data" && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="size-4 text-primary" />
                  Add what you have in stock
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <form className="flex flex-col gap-3" onSubmit={handleAddItem}>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Input
                      placeholder="Item name"
                      value={itemName}
                      onChange={(e) => setItemName(e.target.value)}
                      required
                    />
                    <Input
                      placeholder="Item code"
                      value={itemCode}
                      onChange={(e) => setItemCode(e.target.value)}
                      required
                    />
                  </div>
                  <Input
                    placeholder="How many do you have?"
                    type="number"
                    min={0}
                    value={itemQuantity}
                    onChange={(e) => setItemQuantity(e.target.value)}
                    required
                  />
                  <div className="flex items-center gap-3">
                    <Button type="submit" variant="outline" size="sm">
                      Add item
                    </Button>
                    {itemsAdded > 0 && (
                      <Badge tone="success">
                        <Check />
                        {itemsAdded} added
                      </Badge>
                    )}
                  </div>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileSpreadsheet className="size-4 text-primary" />
                  Or upload a spreadsheet
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-3">
                <p className="text-sm text-muted-foreground">
                  A spreadsheet file (.csv) with three columns: item code, item name, and how many
                  you have.
                </p>
                <input
                  className="mt-3 block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary-soft file:px-3 file:py-2 file:text-sm file:font-medium file:text-primary hover:file:bg-primary-soft/70"
                  type="file"
                  accept=".csv"
                  onChange={handleCsvUpload}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Truck className="size-4 text-primary" />
                  Add a supplier
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <form className="flex flex-col gap-3" onSubmit={handleAddSupplier}>
                  <Input
                    placeholder="Supplier name"
                    value={supplierName}
                    onChange={(e) => setSupplierName(e.target.value)}
                    required
                  />
                  <div className="flex items-center gap-3">
                    <Button type="submit" variant="outline" size="sm">
                      Add supplier
                    </Button>
                    {suppliersAdded > 0 && (
                      <Badge tone="success">
                        <Check />
                        {suppliersAdded} added
                      </Badge>
                    )}
                  </div>
                </form>
              </CardContent>
            </Card>

            <Button onClick={() => setStep("consent")} disabled={itemsAdded === 0}>
              {itemsAdded === 0 ? "Add at least one item to continue" : "Continue"}
              {itemsAdded > 0 && <ArrowRight />}
            </Button>
          </div>
        )}

        {step === "consent" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="size-4 text-primary" />
                One last thing — smart alerts
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              <p className="text-sm leading-relaxed">
                To warn you before a supplier lets you down, we send details about your stock and
                suppliers to a secure AI service that spots the warning signs.
              </p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                {[
                  "We only send what's needed to spot a problem.",
                  "Your data is never shared with other businesses.",
                  "Nothing is bought or ordered without you approving it first.",
                ].map((point) => (
                  <li key={point} className="flex items-start gap-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-success" />
                    {point}
                  </li>
                ))}
              </ul>
              <p className="text-sm text-muted-foreground">
                Without this, you&apos;ll still see your live supply chain — but we won&apos;t be
                able to warn you early.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => void handleGrantConsent()} disabled={submitting}>
                  {submitting ? "Saving…" : "Yes, turn on smart alerts"}
                </Button>
                <Button variant="ghost" onClick={() => router.push("/twin")} disabled={submitting}>
                  Not right now
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
