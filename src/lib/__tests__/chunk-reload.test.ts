// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as Sentry from "@sentry/nextjs";
import { CHUNK_RELOAD_KEY, handleChunkLoadError, isChunkLoadError } from "../chunk-reload";

vi.mock("@sentry/nextjs", () => ({
  captureMessage: vi.fn(),
  captureException: vi.fn(),
  flush: vi.fn(() => Promise.resolve(true)),
}));

describe("isChunkLoadError", () => {
  it("matches Webpack ChunkLoadError by name", () => {
    const err = Object.assign(new Error("anything"), { name: "ChunkLoadError" });
    expect(isChunkLoadError(err)).toBe(true);
  });

  it("matches Webpack CSS chunk failure by code", () => {
    const err = Object.assign(new Error("anything"), { code: "CSS_CHUNK_LOAD_FAILED" });
    expect(isChunkLoadError(err)).toBe(true);
  });

  it("matches Webpack 'Loading chunk N failed' message", () => {
    expect(isChunkLoadError(new Error("Loading chunk 42 failed."))).toBe(true);
  });

  it("matches Webpack 'Loading CSS chunk N failed' message", () => {
    expect(isChunkLoadError(new Error("Loading CSS chunk vendors failed."))).toBe(true);
  });

  it("matches Chrome/Edge native ESM error", () => {
    expect(
      isChunkLoadError(
        new Error("Failed to fetch dynamically imported module: https://example.com/foo.js")
      )
    ).toBe(true);
  });

  it("matches Firefox native ESM error", () => {
    expect(isChunkLoadError(new Error("error loading dynamically imported module"))).toBe(true);
  });

  it("matches Safari native ESM error", () => {
    expect(isChunkLoadError(new Error("Importing a module script failed."))).toBe(true);
  });

  it("matches duck-typed objects with a chunk message (e.g. PromiseRejectionEvent.reason)", () => {
    expect(isChunkLoadError({ message: "Loading chunk 7 failed." })).toBe(true);
  });

  it("matches plain string reasons that look like chunk errors", () => {
    expect(isChunkLoadError("Failed to fetch dynamically imported module")).toBe(true);
  });

  it("does not match unrelated errors", () => {
    expect(isChunkLoadError(new TypeError("undefined is not a function"))).toBe(false);
  });

  it("does not match null/undefined/empty inputs", () => {
    expect(isChunkLoadError(null)).toBe(false);
    expect(isChunkLoadError(undefined)).toBe(false);
    expect(isChunkLoadError("")).toBe(false);
    expect(isChunkLoadError({})).toBe(false);
  });
});

describe("handleChunkLoadError", () => {
  let reloadSpy: ReturnType<typeof vi.fn>;
  let originalLocation: Location;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(Sentry.flush).mockReturnValue(Promise.resolve(true));
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

  it("on first call: sends captureMessage with chunk_reload tag, sets sessionStorage, flushes then reloads, returns true", async () => {
    const err = new Error("Loading chunk 3 failed.");
    const result = handleChunkLoadError(err, "boundary");

    expect(result).toBe(true);
    expect(window.sessionStorage.getItem(CHUNK_RELOAD_KEY)).not.toBeNull();
    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      expect.stringContaining("boundary"),
      expect.objectContaining({
        level: "info",
        tags: { chunk_reload: "boundary" },
      })
    );
    expect(Sentry.flush).toHaveBeenCalledWith(2_000);
    expect(Sentry.captureException).not.toHaveBeenCalled();

    await vi.waitFor(() => expect(reloadSpy).toHaveBeenCalledTimes(1));
  });

  it("still reloads even if Sentry.flush rejects", async () => {
    vi.mocked(Sentry.flush).mockReturnValue(Promise.reject(new Error("network down")));
    handleChunkLoadError(new Error("Loading chunk 3 failed."), "boundary");
    await vi.waitFor(() => expect(reloadSpy).toHaveBeenCalledTimes(1));
  });

  it("suppresses duplicate calls within the race window (in-flight reload)", () => {
    window.sessionStorage.setItem(CHUNK_RELOAD_KEY, Date.now().toString());
    const err = new Error("Loading chunk 3 failed.");
    const result = handleChunkLoadError(err, "window_error");

    expect(result).toBe(false);
    expect(reloadSpy).not.toHaveBeenCalled();
    expect(Sentry.captureMessage).not.toHaveBeenCalled();
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it("on stale flag (older than race window): captures loop_blocked exception and returns false", () => {
    window.sessionStorage.setItem(CHUNK_RELOAD_KEY, String(Date.now() - 10_000));
    const err = new Error("Loading chunk 3 failed.");
    const result = handleChunkLoadError(err, "window_error");

    expect(result).toBe(false);
    expect(reloadSpy).not.toHaveBeenCalled();
    expect(Sentry.captureMessage).not.toHaveBeenCalled();
    expect(Sentry.captureException).toHaveBeenCalledWith(
      err,
      expect.objectContaining({
        tags: { chunk_reload: "loop_blocked" },
      })
    );
  });

  it("passes the source through the captureMessage tag", () => {
    handleChunkLoadError(new Error("Loading chunk 1 failed."), "unhandled_rejection");
    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ tags: { chunk_reload: "unhandled_rejection" } })
    );
  });
});
