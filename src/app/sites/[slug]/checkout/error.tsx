"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function CheckoutError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
      <h2 className="text-xl font-semibold">Checkout error</h2>
      <p className="text-sm text-muted-foreground">
        Something went wrong during checkout. Your payment has not been processed.
      </p>
      <button
        onClick={() => reset()}
        className="rounded-md border px-4 py-2 text-sm hover:bg-accent"
      >
        Try again
      </button>
    </div>
  );
}
