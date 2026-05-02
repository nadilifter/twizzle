"use client";

import { useEffect } from "react";
import { handleChunkLoadError, isChunkLoadError } from "@/lib/chunk-reload";

export function ChunkErrorListener() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const onError = (event: ErrorEvent) => {
      const err = event.error ?? event.message;
      if (isChunkLoadError(err)) {
        handleChunkLoadError(err, "window_error");
      }
    };

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (isChunkLoadError(event.reason)) {
        handleChunkLoadError(event.reason, "unhandled_rejection");
      }
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);

    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };
  }, []);

  return null;
}
