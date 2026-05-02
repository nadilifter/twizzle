"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import { handleChunkLoadError, isChunkLoadError } from "@/lib/chunk-reload";

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
  heading?: string;
  message?: string;
}

export function ErrorPage({
  error,
  reset,
  heading = "Something went wrong",
  message = "An unexpected error occurred. Our team has been notified.",
}: ErrorPageProps) {
  useEffect(() => {
    if (isChunkLoadError(error) && handleChunkLoadError(error, "boundary")) return;
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
      <h2 className="text-xl font-semibold">{heading}</h2>
      <p className="text-sm text-muted-foreground">{message}</p>
      <button
        onClick={() => reset()}
        className="rounded-md border px-4 py-2 text-sm hover:bg-accent"
      >
        Try again
      </button>
    </div>
  );
}
