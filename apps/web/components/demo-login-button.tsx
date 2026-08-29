"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ApiError, demoLogin } from "@/lib/api";

/**
 * One click into a populated account, for anyone evaluating this who should
 * not have to sign up first to see whether it does anything.
 *
 * The account is fixed on the server, so this button cannot be pointed at
 * a real business. Where no demonstration account is configured — a local
 * checkout, for instance — the server refuses and we say so rather than
 * sending the visitor to a screen that will fail to load.
 */
export function DemoLoginButton(): React.JSX.Element {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick(): Promise<void> {
    setError(null);
    setPending(true);
    try {
      await demoLogin();
      router.push("/twin");
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 403
          ? "There's no example account on this server yet."
          : "Couldn't open the example. Please try again.",
      );
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <Button size="lg" variant="outline" onClick={handleClick} disabled={pending}>
        {pending ? "Opening…" : "See a live example"}
      </Button>
      {error ? <p className="text-sm text-muted-foreground">{error}</p> : null}
    </div>
  );
}
