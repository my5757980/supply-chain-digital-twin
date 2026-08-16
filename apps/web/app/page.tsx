import Link from "next/link";
import { ArrowRight, BellRing, ClipboardCheck, Radar, Waypoints } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const FEATURES = [
  {
    icon: Radar,
    title: "See everything in one place",
    body: "Your stock, suppliers, orders and deliveries on a single live screen — no more chasing updates on WhatsApp.",
  },
  {
    icon: BellRing,
    title: "Know 48 hours early",
    body: "We watch for the warning signs of a delay and tell you in plain language, before it turns into a stockout.",
  },
  {
    icon: ClipboardCheck,
    title: "Know what to do next",
    body: "Every warning comes with a step-by-step plan and an alternative supplier. You decide — nothing happens without you.",
  },
];

export default function HomePage(): React.JSX.Element {
  return (
    <div className="min-h-screen">
      <header className="border-b border-border">
        <div className="mx-auto flex h-14 max-w-5xl items-center px-4 sm:px-6">
          <div className="flex items-center gap-2 font-semibold tracking-tight">
            <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Waypoints className="size-4" />
            </span>
            SupplyTwin
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 sm:px-6">
        <section className="flex flex-col items-center gap-6 py-16 text-center sm:py-24">
          <Badge tone="primary">Built for UAE small businesses</Badge>
          <h1 className="max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
            Know your supplier is going to be late — before they do.
          </h1>
          <p className="max-w-xl text-lg text-muted-foreground">
            SupplyTwin builds a live picture of your supply chain, spots trouble two days ahead,
            and tells you exactly what to do about it.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link href="/onboarding">
              <Button size="lg">
                Set up your business
                <ArrowRight />
              </Button>
            </Link>
            <Link href="/twin">
              <Button size="lg" variant="outline">
                View a live twin
              </Button>
            </Link>
          </div>
          <p className="text-sm text-muted-foreground">
            Takes about two minutes. No card, no IT team needed.
          </p>
        </section>

        <section className="grid gap-4 pb-16 sm:grid-cols-3">
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="rounded-lg border border-border bg-surface p-5 shadow-card"
            >
              <div className="flex size-9 items-center justify-center rounded-md bg-primary-soft text-primary">
                <feature.icon className="size-4.5" />
              </div>
              <h2 className="mt-4 font-semibold">{feature.title}</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{feature.body}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="border-t border-border py-6">
        <p className="mx-auto max-w-5xl px-4 text-sm text-muted-foreground sm:px-6">
          Built for the du SME Resilience &amp; Innovation Challenge — ResilienceTech track.
        </p>
      </footer>
    </div>
  );
}
