"use client";

import { ErrorPage } from "@/components/error-page";

export default function AuthError({
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
