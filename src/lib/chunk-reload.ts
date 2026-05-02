import * as Sentry from "@sentry/nextjs";

export const CHUNK_RELOAD_KEY = "uplifter:chunk-reload-attempted";

export type ChunkReloadSource = "boundary" | "window_error" | "unhandled_rejection";

const RACE_WINDOW_MS = 5_000;
const FLUSH_TIMEOUT_MS = 2_000;

const CHUNK_MESSAGE_PATTERNS: RegExp[] = [
  /Loading chunk [\w-]+ failed/i,
  /Loading CSS chunk [\w-]+ failed/i,
  /Failed to fetch dynamically imported module/i,
  /error loading dynamically imported module/i,
  /Importing a module script failed/i,
];

function extractMessage(error: unknown): string {
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message: unknown }).message;
    if (typeof message === "string") return message;
  }
  return "";
}

function extractName(error: unknown): string {
  if (error && typeof error === "object" && "name" in error) {
    const name = (error as { name: unknown }).name;
    if (typeof name === "string") return name;
  }
  return "";
}

function extractCode(error: unknown): string {
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as { code: unknown }).code;
    if (typeof code === "string") return code;
  }
  return "";
}

export function isChunkLoadError(error: unknown): boolean {
  if (error == null) return false;
  if (extractName(error) === "ChunkLoadError") return true;
  if (extractCode(error) === "CSS_CHUNK_LOAD_FAILED") return true;
  const message = extractMessage(error);
  if (!message) return false;
  return CHUNK_MESSAGE_PATTERNS.some((pattern) => pattern.test(message));
}

function readFlag(): number | null {
  try {
    const raw = window.sessionStorage.getItem(CHUNK_RELOAD_KEY);
    if (!raw) return null;
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function writeFlag(): void {
  try {
    window.sessionStorage.setItem(CHUNK_RELOAD_KEY, Date.now().toString());
  } catch {
    // Private browsing / storage disabled — proceed anyway. Without the flag we
    // risk a reload loop, but the alternative is leaving the user stuck on a
    // broken page; reload is still the better default.
  }
}

export function handleChunkLoadError(error: unknown, source: ChunkReloadSource): boolean {
  if (typeof window === "undefined") return false;

  const errorName = extractName(error) || "Error";
  const errorMessage = extractMessage(error);

  const flagSetAt = readFlag();
  if (flagSetAt !== null) {
    if (Date.now() - flagSetAt < RACE_WINDOW_MS) {
      // A reload was just triggered by another path (boundary vs window listener).
      // Suppress the duplicate; the reload is already in flight.
      return false;
    }
    Sentry.captureException(error, {
      tags: { chunk_reload: "loop_blocked" },
      extra: { source, errorName, errorMessage },
    });
    return false;
  }

  Sentry.captureMessage(`Chunk load error from ${source}; reloading`, {
    level: "info",
    tags: { chunk_reload: source },
    extra: { errorName, errorMessage },
  });

  writeFlag();

  Sentry.flush(FLUSH_TIMEOUT_MS)
    .catch(() => undefined)
    .then(() => window.location.reload());
  return true;
}
