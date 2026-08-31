import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "SupplyTwin — 77-second demo",
  description:
    "A recorded walkthrough of the running system: the live twin, a supplier-delay warning, and the plan the owner decides on.",
};

/**
 * The demo video, hosted on the product's own domain rather than a video
 * platform — one fewer account between a reader and the thing itself, and
 * the link keeps working without anyone signing in.
 */
export default function DemoPage(): React.JSX.Element {
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-12">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">
          Seventy-seven seconds, start to finish
        </h1>
        <p className="text-muted-foreground">
          Recorded against the running system — the twin, a supplier-delay
          warning raised 48 hours ahead, the alternative supplier it picked, and
          the plan the owner accepts. Nothing here is a mockup.
        </p>
      </div>

      <video
        controls
        preload="metadata"
        playsInline
        poster=""
        className="w-full rounded-xl border bg-black shadow-sm"
      >
        <source src="/demo.mp4" type="video/mp4" />
        Your browser cannot play this video.{" "}
        <a href="/demo.mp4" className="underline">
          Download it instead
        </a>
        .
      </video>

      <div className="flex flex-wrap items-center gap-3">
        <Link href="/">
          <Button size="lg">
            Try it yourself
            <ArrowRight />
          </Button>
        </Link>
        <a
          href="https://github.com/my5757980/supply-chain-digital-twin"
          target="_blank"
          rel="noreferrer"
        >
          <Button size="lg" variant="outline">
            Read the code
          </Button>
        </a>
      </div>

      <p className="text-sm text-muted-foreground">
        Built for the du SME Resilience &amp; Innovation Challenge — Theme 1,
        AI-Driven Supply Chain Digital Twins.
      </p>
    </main>
  );
}
