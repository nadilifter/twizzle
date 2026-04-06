"use client";

import { ErrorPage } from "@/components/error-page";

export default function SiteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorPage
      error={error}
      reset={reset}
      message="We couldn't load this page. Please try again."
    />
  );
}
