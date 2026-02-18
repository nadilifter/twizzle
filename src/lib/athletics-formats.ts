/**
 * Shared formatting, parsing, and validation utilities for athletics
 * seed marks and results across all result types.
 */

export type ResultType = "TIME" | "DISTANCE" | "HEIGHT" | "SCORE" | "PLACEMENT"

export interface TimeSeedFields {
  seedHours: number | null
  seedMinutes: number | null
  seedSeconds: number | null
  seedMs: number | null
  seedHandTimed: boolean
}

export interface SeedMarkFields extends TimeSeedFields {
  seedDistance: number | null
  seedPoints: number | null
  seedPlacement: string | null
}

// ---------------------------------------------------------------------------
// TIME formatting
// ---------------------------------------------------------------------------

export function formatTimeSeed(
  hours: number | null,
  minutes: number | null,
  seconds: number | null,
  ms: number | null,
  handTimed: boolean
): string {
  const h = hours ?? 0
  const m = minutes ?? 0
  const s = seconds ?? 0
  const milliseconds = ms ?? 0

  if (handTimed) {
    const tenths = Math.floor(milliseconds / 100)
    if (h > 0) return `${h}:${pad2(m)}:${pad2(s)}.${tenths}h`
    if (m > 0) return `${m}:${pad2(s)}.${tenths}h`
    return `${s}.${tenths}h`
  }

  const centiseconds = pad2(Math.floor(milliseconds / 10))
  if (h > 0) return `${h}:${pad2(m)}:${pad2(s)}.${centiseconds}`
  if (m > 0) return `${m}:${pad2(s)}.${centiseconds}`
  return `${s}.${centiseconds}`
}

/**
 * Convert time component fields to total milliseconds for comparison
 * (e.g. against a qualifying mark stored in ms).
 */
export function timeSeedToMs(
  hours: number | null,
  minutes: number | null,
  seconds: number | null,
  ms: number | null,
): number {
  return (
    (hours ?? 0) * 3600000 +
    (minutes ?? 0) * 60000 +
    (seconds ?? 0) * 1000 +
    (ms ?? 0)
  )
}

// ---------------------------------------------------------------------------
// Placement formatting
// ---------------------------------------------------------------------------

const PLACEMENT_REGEX = /^\d+$|^\d+h\d+$/

export function isValidPlacement(value: string): boolean {
  return PLACEMENT_REGEX.test(value.trim())
}

export function formatPlacement(value: string): string {
  return value.trim()
}

// ---------------------------------------------------------------------------
// Unified display formatter
// ---------------------------------------------------------------------------

export function formatSeedMarkForDisplay(
  entry: SeedMarkFields,
  resultType: ResultType,
): string {
  switch (resultType) {
    case "TIME":
      if (
        entry.seedHours == null &&
        entry.seedMinutes == null &&
        entry.seedSeconds == null &&
        entry.seedMs == null
      ) return "-"
      return formatTimeSeed(
        entry.seedHours,
        entry.seedMinutes,
        entry.seedSeconds,
        entry.seedMs,
        entry.seedHandTimed,
      )

    case "DISTANCE":
      return entry.seedDistance != null ? `${Number(entry.seedDistance).toFixed(2)}m` : "-"

    case "HEIGHT":
      return entry.seedDistance != null ? `${Number(entry.seedDistance).toFixed(2)}m` : "-"

    case "SCORE":
      return entry.seedPoints != null ? `${Number(entry.seedPoints)} pts` : "-"

    case "PLACEMENT":
      return entry.seedPlacement ?? "-"

    default:
      return "-"
  }
}

// ---------------------------------------------------------------------------
// Result value display (for CompetitionResult.value)
// ---------------------------------------------------------------------------

export function formatResultValue(
  value: number,
  resultType: string,
  precision: number,
  handTimed = false,
  heat?: number | null,
): string {
  if (resultType === "TIME") {
    const totalMs = Math.round(value)
    const hours = Math.floor(totalMs / 3600000)
    const minutes = Math.floor((totalMs % 3600000) / 60000)
    const seconds = Math.floor((totalMs % 60000) / 1000)
    const ms = totalMs % 1000

    if (handTimed) {
      const tenths = Math.floor(ms / 100)
      if (hours > 0) return `${hours}:${pad2(minutes)}:${pad2(seconds)}.${tenths}h`
      if (minutes > 0) return `${minutes}:${pad2(seconds)}.${tenths}h`
      return `${seconds}.${tenths}h`
    }

    const centiseconds = pad2(Math.floor(ms / 10))
    if (hours > 0) return `${hours}:${pad2(minutes)}:${pad2(seconds)}.${centiseconds}`
    if (minutes > 0) return `${minutes}:${pad2(seconds)}.${centiseconds}`
    return `${seconds}.${centiseconds}s`
  }

  if (resultType === "DISTANCE" || resultType === "HEIGHT") {
    const meters = value / 1000
    return `${meters.toFixed(precision)}m`
  }

  if (resultType === "PLACEMENT") {
    const pos = Math.round(value)
    if (heat != null) return `${heat}h${pos}`
    return String(pos)
  }

  return value.toFixed(precision)
}

// ---------------------------------------------------------------------------
// Presence check
// ---------------------------------------------------------------------------

export function hasSeedValue(
  entry: Partial<SeedMarkFields>,
  resultType: ResultType,
): boolean {
  switch (resultType) {
    case "TIME":
      return (
        entry.seedHours != null ||
        entry.seedMinutes != null ||
        entry.seedSeconds != null ||
        entry.seedMs != null
      )
    case "DISTANCE":
    case "HEIGHT":
      return entry.seedDistance != null
    case "SCORE":
      return entry.seedPoints != null
    case "PLACEMENT":
      return entry.seedPlacement != null && entry.seedPlacement !== ""
    default:
      return false
  }
}

/**
 * Extract a single numeric value from structured seed fields for
 * qualifying-mark comparison. Returns null when no seed is present.
 *
 * TIME  -> total milliseconds
 * DISTANCE/HEIGHT -> metres (as number)
 * SCORE -> raw points
 * PLACEMENT -> numeric position (heat component ignored)
 */
export function seedValueForComparison(
  entry: Partial<SeedMarkFields>,
  resultType: ResultType,
): number | null {
  switch (resultType) {
    case "TIME":
      if (!hasSeedValue(entry, "TIME")) return null
      return timeSeedToMs(
        entry.seedHours ?? null,
        entry.seedMinutes ?? null,
        entry.seedSeconds ?? null,
        entry.seedMs ?? null,
      )
    case "DISTANCE":
    case "HEIGHT":
      return entry.seedDistance != null ? Number(entry.seedDistance) : null
    case "SCORE":
      return entry.seedPoints != null ? Number(entry.seedPoints) : null
    case "PLACEMENT": {
      if (!entry.seedPlacement) return null
      const match = entry.seedPlacement.match(/(\d+)$/)
      return match ? parseInt(match[1], 10) : null
    }
    default:
      return null
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function pad2(n: number): string {
  return n.toString().padStart(2, "0")
}
