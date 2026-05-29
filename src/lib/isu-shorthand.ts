/**
 * ISU Shorthand Abbreviation Generator
 * =====================================
 *
 * Produces standard ISU/Skate Canada element codes from structured inputs.
 * Examples: 3T, 4Lz, FSSp4, ChSq1, StSq3, 3ThLo.
 *
 * This module is PURE — no Prisma, no React, no side effects.
 * Safe to import from both client and server code.
 *
 * References: ISU Communication 2337 (Single & Pairs element codes),
 * ISU Communication 2267 (Ice Dance), Skate Canada STAR program.
 */

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------

export type TurnCount = 1 | 2 | 3 | 4;

/** Single-jump type abbreviations per ISU nomenclature. */
export type JumpType = "T" | "S" | "Lo" | "F" | "Lz" | "A";

/** Spin level — "B" denotes Basic (no-level), 1–4 are graded levels. */
export type Level = 1 | 2 | 3 | 4 | "B";

/** All ISU spin families in Singles + Pairs. */
export type SpinFamily =
  | "USp" // upright spin
  | "SSp" // sit spin
  | "LSp" // layback spin (ladies Singles only)
  | "CoSp" // combination spin (no flying entry)
  | "FSSp" // flying sit spin
  | "FCoSp" // flying combination spin
  | "FUSp" // flying upright spin
  | "FLSp" // flying layback spin
  | "FCSp" // flying camel spin
  | "CSp"; // camel spin

/** Death-spiral entry-edge codes: Fo=forward-outside, Bo=backward-outside,
 *  FoI=forward-inside, BoI=backward-inside. */
export type DeathSpiralType = "FoI" | "FoO" | "BoI" | "BoO";

/** Pairs and Ice Dance lift family codes. */
export type LiftFamily =
  | "1Li" // group-1 lift
  | "2Li" // group-2 lift
  | "3Li" // group-3 lift
  | "4Li" // group-4 lift
  | "5ALi" // group-5A lift
  | "5BLi" // group-5B lift
  | "BoLi" // border lift (dance)
  | "CuLi" // curve lift (dance)
  | "StLi" // stationary lift (dance)
  | "PiF"; // pair in flight (pairs)

// ---------------------------------------------------------------------------
// Discriminated union — the canonical input shape
// ---------------------------------------------------------------------------

export type IsuElementInput =
  | { kind: "jump"; turns: TurnCount; type: JumpType }
  | { kind: "jumpCombo"; elements: { turns: TurnCount; type: JumpType }[] }
  | { kind: "spin"; family: SpinFamily; level: Level }
  | { kind: "stepSequence"; level: Level }
  | { kind: "chorSequence" }
  | { kind: "spiralSequence" }
  | { kind: "deathSpiral"; type: DeathSpiralType; level: Level }
  | { kind: "lift"; family: LiftFamily; level: Level }
  | { kind: "throw"; turns: TurnCount; type: JumpType };

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

/**
 * Returns the canonical ISU shorthand string for a structured element input.
 *
 * Empty jump combos return "" — callers should validate that elements.length > 0
 * before calling if they want to surface an error to the user.
 */
export function generateIsuShorthand(input: IsuElementInput): string {
  switch (input.kind) {
    // 3T, 4Lz, 2A
    case "jump":
      return `${input.turns}${input.type}`;

    // 3T+2T, 3F+2T+2Lo
    // Empty combo returns "" — documented: callers must guard if they need an error.
    case "jumpCombo":
      if (input.elements.length === 0) return "";
      return input.elements.map((e) => `${e.turns}${e.type}`).join("+");

    // FSSp4, CoSp3, LSpB
    case "spin":
      return `${input.family}${input.level}`;

    // StSq3, StSqB
    case "stepSequence":
      return `StSq${input.level}`;

    // ChSq1 — always the same literal per ISU (no level variant exists in competition use)
    case "chorSequence":
      return "ChSq1";

    // SpSq — no level suffix; legacy / synchro element
    case "spiralSequence":
      return "SpSq";

    // FoIDS2, BoODS4
    case "deathSpiral":
      return `${input.type}DS${input.level}`;

    // 4Li3, 5ALiB, CuLi2
    case "lift":
      return `${input.family}${input.level}`;

    // 3ThLo, 2ThF — ISU uses "${n}Th${jumpType}" (not "3ThrowLo")
    case "throw":
      return `${input.turns}Th${input.type}`;

    default: {
      // Exhaustive check — TypeScript will error here if a case is added to
      // IsuElementInput without a corresponding switch arm.
      const _exhaustive: never = input;
      throw new Error(
        `generateIsuShorthand: unhandled kind "${(_exhaustive as IsuElementInput).kind}"`
      );
    }
  }
}
