import { describe, it, expect } from "vitest";
import { generateIsuShorthand } from "../isu-shorthand";

// ── Jumps ─────────────────────────────────────────────────────────────────────

describe("jump — all turn counts", () => {
  it("single Toe Loop → 1T", () => {
    expect(generateIsuShorthand({ kind: "jump", turns: 1, type: "T" })).toBe("1T");
  });
  it("double Toe Loop → 2T", () => {
    expect(generateIsuShorthand({ kind: "jump", turns: 2, type: "T" })).toBe("2T");
  });
  it("triple Toe Loop → 3T", () => {
    expect(generateIsuShorthand({ kind: "jump", turns: 3, type: "T" })).toBe("3T");
  });
  it("quad Toe Loop → 4T", () => {
    expect(generateIsuShorthand({ kind: "jump", turns: 4, type: "T" })).toBe("4T");
  });
});

describe("jump — every triple type", () => {
  it("triple Salchow → 3S", () => {
    expect(generateIsuShorthand({ kind: "jump", turns: 3, type: "S" })).toBe("3S");
  });
  it("triple Loop → 3Lo", () => {
    expect(generateIsuShorthand({ kind: "jump", turns: 3, type: "Lo" })).toBe("3Lo");
  });
  it("triple Flip → 3F", () => {
    expect(generateIsuShorthand({ kind: "jump", turns: 3, type: "F" })).toBe("3F");
  });
  it("triple Lutz → 3Lz", () => {
    expect(generateIsuShorthand({ kind: "jump", turns: 3, type: "Lz" })).toBe("3Lz");
  });
  it("quad Lutz → 4Lz", () => {
    expect(generateIsuShorthand({ kind: "jump", turns: 4, type: "Lz" })).toBe("4Lz");
  });
});

describe("jump — Axel at every turn count", () => {
  it("single Axel → 1A", () => {
    expect(generateIsuShorthand({ kind: "jump", turns: 1, type: "A" })).toBe("1A");
  });
  it("double Axel → 2A", () => {
    expect(generateIsuShorthand({ kind: "jump", turns: 2, type: "A" })).toBe("2A");
  });
  it("triple Axel → 3A", () => {
    expect(generateIsuShorthand({ kind: "jump", turns: 3, type: "A" })).toBe("3A");
  });
  it("quad Axel → 4A", () => {
    expect(generateIsuShorthand({ kind: "jump", turns: 4, type: "A" })).toBe("4A");
  });
});

// ── Jump combos ───────────────────────────────────────────────────────────────

describe("jumpCombo", () => {
  it("3T+3T", () => {
    expect(
      generateIsuShorthand({
        kind: "jumpCombo",
        elements: [
          { turns: 3, type: "T" },
          { turns: 3, type: "T" },
        ],
      })
    ).toBe("3T+3T");
  });

  it("3T+2T", () => {
    expect(
      generateIsuShorthand({
        kind: "jumpCombo",
        elements: [
          { turns: 3, type: "T" },
          { turns: 2, type: "T" },
        ],
      })
    ).toBe("3T+2T");
  });

  it("3F+2T+2Lo", () => {
    expect(
      generateIsuShorthand({
        kind: "jumpCombo",
        elements: [
          { turns: 3, type: "F" },
          { turns: 2, type: "T" },
          { turns: 2, type: "Lo" },
        ],
      })
    ).toBe("3F+2T+2Lo");
  });

  it("single-element combo (no plus sign)", () => {
    expect(
      generateIsuShorthand({
        kind: "jumpCombo",
        elements: [{ turns: 3, type: "Lz" }],
      })
    ).toBe("3Lz");
  });

  it("empty elements array throws rather than silently emitting empty string", () => {
    expect(() => generateIsuShorthand({ kind: "jumpCombo", elements: [] })).toThrow(
      "jumpCombo requires at least one element"
    );
  });
});

// ── Spins — every family ───────────────────────────────────────────────────────

describe("spin — every family (sampler level)", () => {
  it("USp1", () => {
    expect(generateIsuShorthand({ kind: "spin", family: "USp", level: 1 })).toBe("USp1");
  });
  it("SSp2", () => {
    expect(generateIsuShorthand({ kind: "spin", family: "SSp", level: 2 })).toBe("SSp2");
  });
  it("LSp3", () => {
    expect(generateIsuShorthand({ kind: "spin", family: "LSp", level: 3 })).toBe("LSp3");
  });
  it("CoSp4", () => {
    expect(generateIsuShorthand({ kind: "spin", family: "CoSp", level: 4 })).toBe("CoSp4");
  });
  it("FSSp4", () => {
    expect(generateIsuShorthand({ kind: "spin", family: "FSSp", level: 4 })).toBe("FSSp4");
  });
  it("FCoSp2", () => {
    expect(generateIsuShorthand({ kind: "spin", family: "FCoSp", level: 2 })).toBe("FCoSp2");
  });
  it("FUSpB", () => {
    expect(generateIsuShorthand({ kind: "spin", family: "FUSp", level: "B" })).toBe("FUSpB");
  });
  it("FLSp3", () => {
    expect(generateIsuShorthand({ kind: "spin", family: "FLSp", level: 3 })).toBe("FLSp3");
  });
  it("FCSp1", () => {
    expect(generateIsuShorthand({ kind: "spin", family: "FCSp", level: 1 })).toBe("FCSp1");
  });
  it("CSp4", () => {
    expect(generateIsuShorthand({ kind: "spin", family: "CSp", level: 4 })).toBe("CSp4");
  });
});

describe("spin — FSSp at all levels", () => {
  it("FSSpB", () => {
    expect(generateIsuShorthand({ kind: "spin", family: "FSSp", level: "B" })).toBe("FSSpB");
  });
  it("FSSp1", () => {
    expect(generateIsuShorthand({ kind: "spin", family: "FSSp", level: 1 })).toBe("FSSp1");
  });
  it("FSSp2", () => {
    expect(generateIsuShorthand({ kind: "spin", family: "FSSp", level: 2 })).toBe("FSSp2");
  });
  it("FSSp3", () => {
    expect(generateIsuShorthand({ kind: "spin", family: "FSSp", level: 3 })).toBe("FSSp3");
  });
  // FSSp4 already covered above
});

describe("spin — CoSp at all levels", () => {
  it("CoSpB", () => {
    expect(generateIsuShorthand({ kind: "spin", family: "CoSp", level: "B" })).toBe("CoSpB");
  });
  it("CoSp1", () => {
    expect(generateIsuShorthand({ kind: "spin", family: "CoSp", level: 1 })).toBe("CoSp1");
  });
  it("CoSp2", () => {
    expect(generateIsuShorthand({ kind: "spin", family: "CoSp", level: 2 })).toBe("CoSp2");
  });
  it("CoSp3", () => {
    expect(generateIsuShorthand({ kind: "spin", family: "CoSp", level: 3 })).toBe("CoSp3");
  });
});

// ── Step sequences ─────────────────────────────────────────────────────────────

describe("stepSequence — all levels", () => {
  it("StSqB", () => {
    expect(generateIsuShorthand({ kind: "stepSequence", level: "B" })).toBe("StSqB");
  });
  it("StSq1", () => {
    expect(generateIsuShorthand({ kind: "stepSequence", level: 1 })).toBe("StSq1");
  });
  it("StSq2", () => {
    expect(generateIsuShorthand({ kind: "stepSequence", level: 2 })).toBe("StSq2");
  });
  it("StSq3", () => {
    expect(generateIsuShorthand({ kind: "stepSequence", level: 3 })).toBe("StSq3");
  });
  it("StSq4", () => {
    expect(generateIsuShorthand({ kind: "stepSequence", level: 4 })).toBe("StSq4");
  });
});

// ── Choreographic & spiral sequences ──────────────────────────────────────────

describe("chorSequence", () => {
  it("always returns ChSq1", () => {
    expect(generateIsuShorthand({ kind: "chorSequence" })).toBe("ChSq1");
  });
});

describe("spiralSequence", () => {
  it("always returns SpSq", () => {
    expect(generateIsuShorthand({ kind: "spiralSequence" })).toBe("SpSq");
  });
});

// ── Death spirals ──────────────────────────────────────────────────────────────

describe("deathSpiral — all entry types", () => {
  it("FoIDS2", () => {
    expect(generateIsuShorthand({ kind: "deathSpiral", type: "FoI", level: 2 })).toBe("FoIDS2");
  });
  it("FoODS3", () => {
    expect(generateIsuShorthand({ kind: "deathSpiral", type: "FoO", level: 3 })).toBe("FoODS3");
  });
  it("BoIDS1", () => {
    expect(generateIsuShorthand({ kind: "deathSpiral", type: "BoI", level: 1 })).toBe("BoIDS1");
  });
  it("BoODS4", () => {
    expect(generateIsuShorthand({ kind: "deathSpiral", type: "BoO", level: 4 })).toBe("BoODS4");
  });
  it("FoIDSB (level B)", () => {
    expect(generateIsuShorthand({ kind: "deathSpiral", type: "FoI", level: "B" })).toBe("FoIDSB");
  });
});

// ── Lifts ──────────────────────────────────────────────────────────────────────

describe("lift — sampler across families", () => {
  it("1Li1", () => {
    expect(generateIsuShorthand({ kind: "lift", family: "1Li", level: 1 })).toBe("1Li1");
  });
  it("2Li2", () => {
    expect(generateIsuShorthand({ kind: "lift", family: "2Li", level: 2 })).toBe("2Li2");
  });
  it("3Li3", () => {
    expect(generateIsuShorthand({ kind: "lift", family: "3Li", level: 3 })).toBe("3Li3");
  });
  it("4Li4", () => {
    expect(generateIsuShorthand({ kind: "lift", family: "4Li", level: 4 })).toBe("4Li4");
  });
  it("5ALi3", () => {
    expect(generateIsuShorthand({ kind: "lift", family: "5ALi", level: 3 })).toBe("5ALi3");
  });
  it("5BLi2", () => {
    expect(generateIsuShorthand({ kind: "lift", family: "5BLi", level: 2 })).toBe("5BLi2");
  });
  it("BoLiB", () => {
    expect(generateIsuShorthand({ kind: "lift", family: "BoLi", level: "B" })).toBe("BoLiB");
  });
  it("CuLi4", () => {
    expect(generateIsuShorthand({ kind: "lift", family: "CuLi", level: 4 })).toBe("CuLi4");
  });
  it("StLiB", () => {
    expect(generateIsuShorthand({ kind: "lift", family: "StLi", level: "B" })).toBe("StLiB");
  });
  it("PiF1", () => {
    expect(generateIsuShorthand({ kind: "lift", family: "PiF", level: 1 })).toBe("PiF1");
  });
});

// ── Throws ─────────────────────────────────────────────────────────────────────

describe("throw — across types", () => {
  it("3ThLo", () => {
    expect(generateIsuShorthand({ kind: "throw", turns: 3, type: "Lo" })).toBe("3ThLo");
  });
  it("2ThF", () => {
    expect(generateIsuShorthand({ kind: "throw", turns: 2, type: "F" })).toBe("2ThF");
  });
  it("1ThS", () => {
    expect(generateIsuShorthand({ kind: "throw", turns: 1, type: "S" })).toBe("1ThS");
  });
  it("4ThT", () => {
    expect(generateIsuShorthand({ kind: "throw", turns: 4, type: "T" })).toBe("4ThT");
  });
  it("3ThLz", () => {
    expect(generateIsuShorthand({ kind: "throw", turns: 3, type: "Lz" })).toBe("3ThLz");
  });
  it("3ThA (Axel throw)", () => {
    expect(generateIsuShorthand({ kind: "throw", turns: 3, type: "A" })).toBe("3ThA");
  });
});
