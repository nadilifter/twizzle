// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createElement } from "react";
import { render } from "@testing-library/react";
import * as Sentry from "@sentry/nextjs";
import { ChunkErrorListener } from "../chunk-error-listener";
import { CHUNK_RELOAD_KEY } from "@/lib/chunk-reload";

vi.mock("@sentry/nextjs", () => ({
  captureMessage: vi.fn(),
  captureException: vi.fn(),
  flush: vi.fn(() => Promise.resolve(true)),
}));

describe("ChunkErrorListener", () => {
  let reloadSpy: ReturnType<typeof vi.fn>;
  let originalLocation: Location;

  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
    originalLocation = window.location;
    reloadSpy = vi.fn();
    Object.defineProperty(window, "location", {
      configurable: true,
      writable: true,
      value: { ...originalLocation, reload: reloadSpy },
    });
  });

  afterEach(() => {
    Object.defineProperty(window, "location", {
      configurable: true,
      writable: true,
      value: originalLocation,
    });
  });

  it("triggers reload on a window 'error' event with a chunk-load error", async () => {
    render(createElement(ChunkErrorListener));
    const event = new ErrorEvent("error", {
      error: Object.assign(new Error("Loading chunk 9 failed."), { name: "ChunkLoadError" }),
      message: "Loading chunk 9 failed.",
    });
    window.dispatchEvent(event);

    await vi.waitFor(() => expect(reloadSpy).toHaveBeenCalledTimes(1));
    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ tags: { chunk_reload: "window_error" } })
    );
    expect(window.sessionStorage.getItem(CHUNK_RELOAD_KEY)).not.toBeNull();
  });

  it("triggers reload on an 'unhandledrejection' event with a chunk-load reason", async () => {
    render(createElement(ChunkErrorListener));
    const reason = new Error("Failed to fetch dynamically imported module");
    const event = new Event("unhandledrejection") as PromiseRejectionEvent;
    Object.defineProperty(event, "reason", { value: reason });
    Object.defineProperty(event, "promise", { value: Promise.resolve() });
    window.dispatchEvent(event);

    await vi.waitFor(() => expect(reloadSpy).toHaveBeenCalledTimes(1));
    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ tags: { chunk_reload: "unhandled_rejection" } })
    );
  });

  it("ignores non-chunk errors", () => {
    render(createElement(ChunkErrorListener));
    const event = new ErrorEvent("error", {
      error: new TypeError("oops"),
      message: "oops",
    });
    window.dispatchEvent(event);

    expect(reloadSpy).not.toHaveBeenCalled();
    expect(Sentry.captureMessage).not.toHaveBeenCalled();
  });

  it("removes listeners on unmount", async () => {
    const { unmount } = render(createElement(ChunkErrorListener));
    unmount();

    const swallow = (e: Event) => e.preventDefault();
    window.addEventListener("error", swallow);
    try {
      const event = new ErrorEvent("error", {
        error: Object.assign(new Error("Loading chunk 1 failed."), { name: "ChunkLoadError" }),
        message: "Loading chunk 1 failed.",
        cancelable: true,
      });
      window.dispatchEvent(event);
    } finally {
      window.removeEventListener("error", swallow);
    }

    // Give any rogue async reload a chance to fire — it shouldn't.
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(reloadSpy).not.toHaveBeenCalled();
  });

  it("renders nothing", () => {
    const { container } = render(createElement(ChunkErrorListener));
    expect(container.firstChild).toBeNull();
  });
});
