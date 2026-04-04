"use client";

import { ErrorPage } from "@/components/error-page";

export default function CheckoutError({
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
      heading="Checkout error"
      message="Something went wrong during checkout. Your payment has not been processed."
    />
  );
}
