// Pure ISU shorthand abbreviation generator — Phase 4.2.
// No Prisma, React, or side-effectful imports; safe for client and server.

export type JumpType = "T" | "S" | "Lo" | "F" | "Lz" | "A";
export type TurnCount = 1 | 2 | 3 | 4;
export type Level = 1 | 2 | 3 | 4 | "B";

export type SpinFamily =
  | "USp"
  | "SSp"
  | "LSp"
  | "CoSp"
  | "FSSp"
  | "FCoSp"
  | "FUSp"
  | "FLSp"
  | "FCSp"
  | "CSp";

export type LiftFamily =
  | "1Li"
  | "2Li"
  | "3Li"
  | "4Li"
  | "5ALi"
  | "5BLi"
  | "BoLi"
  | "CuLi"
  | "StLi"
  | "PiF";

export type DeathSpiralType = "FoI" | "FoO" | "BoI" | "BoO";

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

function jumpCode(turns: TurnCount, type: JumpType): string {
  return `${turns}${type}`;
}

export function generateIsuShorthand(input: IsuElementInput): string {
  switch (input.kind) {
    case "jump":
      return jumpCode(input.turns, input.type);

    case "jumpCombo": {
      // Empty combos have no valid ISU representation — fail loudly rather
      // than silently emitting an empty string onto a program sheet.
      if (input.elements.length === 0) {
        throw new Error("jumpCombo requires at least one element");
      }
      return input.elements.map((el) => jumpCode(el.turns, el.type)).join("+");
    }

    case "spin":
      return `${input.family}${input.level}`;

    case "stepSequence":
      return `StSq${input.level}`;

    case "chorSequence":
      // ChSq1 is the fixed ISU code for a choreographic step sequence;
      // the trailing "1" is part of the official designation, not a level.
      return "ChSq1";

    case "spiralSequence":
      // SpSq has no level suffix in current ISU rules (legacy / synchro use).
      return "SpSq";

    case "deathSpiral":
      // e.g. FoIDS2 — entry type prefix + DS + level
      return `${input.type}DS${input.level}`;

    case "lift":
      return `${input.family}${input.level}`;

    case "throw":
      // e.g. 3ThLo — turns + Th + jump type
      return `${input.turns}Th${input.type}`;

    default: {
      const _exhaustive: never = input;
      throw new Error(`Unhandled ISU element kind: ${JSON.stringify(_exhaustive)}`);
    }
  }
}
