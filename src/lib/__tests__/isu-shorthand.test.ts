import { describe, it, expect } from "vitest";
import { generateIsuShorthand } from "../isu-shorthand";

// ---------------------------------------------------------------------------
// Jumps
// ---------------------------------------------------------------------------

describe("jumps — single elements", () => {
  it("produces 1T for a single toe loop", () => {
    expect(generateIsuShorthand({ kind: "jump", turns: 1, type: "T" })).toBe("1T");
  });

  it("produces 2S for a double Salchow", () => {
    expect(generateIsuShorthand({ kind: "jump", turns: 2, type: "S" })).toBe("2S");
  });

  it("produces 3Lo for a triple loop", () => {
    expect(generateIsuShorthand({ kind: "jump", turns: 3, type: "Lo" })).toBe("3Lo");
  });

  it("produces 3F for a triple flip", () => {
    expect(generateIsuShorthand({ kind: "jump", turns: 3, type: "F" })).toBe("3F");
  });

  it("produces 3Lz for a triple Lutz", () => {
    expect(generateIsuShorthand({ kind: "jump", turns: 3, type: "Lz" })).toBe("3Lz");
  });

  it("produces 3T for a triple toe loop", () => {
    expect(generateIsuShorthand({ kind: "jump", turns: 3, type: "T" })).toBe("3T");
  });

  it("produces 3S for a triple Salchow", () => {
    expect(generateIsuShorthand({ kind: "jump", turns: 3, type: "S" })).toBe("3S");
  });

  it("produces 1A for a single Axel", () => {
    expect(generateIsuShorthand({ kind: "jump", turns: 1, type: "A" })).toBe("1A");
  });

  it("produces 2A for a double Axel", () => {
    expect(generateIsuShorthand({ kind: "jump", turns: 2, type: "A" })).toBe("2A");
  });

  it("produces 3A for a triple Axel", () => {
    expect(generateIsuShorthand({ kind: "jump", turns: 3, type: "A" })).toBe("3A");
  });

  it("produces 4A for a quad Axel", () => {
    expect(generateIsuShorthand({ kind: "jump", turns: 4, type: "A" })).toBe("4A");
  });

  it("produces 4T for a quad toe loop", () => {
    expect(generateIsuShorthand({ kind: "jump", turns: 4, type: "T" })).toBe("4T");
  });

  it("produces 4F for a quad flip", () => {
    expect(generateIsuShorthand({ kind: "jump", turns: 4, type: "F" })).toBe("4F");
  });

  it("produces 4Lz for a quad Lutz", () => {
    expect(generateIsuShorthand({ kind: "jump", turns: 4, type: "Lz" })).toBe("4Lz");
  });
});

// ---------------------------------------------------------------------------
// Jump combinations
// ---------------------------------------------------------------------------

describe("jumpCombo", () => {
  it("produces 3T+2T for a classic double-jump combination", () => {
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

  it("produces 3T+3T for a triple-triple toe combination", () => {
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

  it("produces 3F+2T+2Lo for a three-jump combination", () => {
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

  it("produces a single-element string for a one-element combo", () => {
    expect(
      generateIsuShorthand({
        kind: "jumpCombo",
        elements: [{ turns: 3, type: "A" }],
      })
    ).toBe("3A");
  });

  it("returns empty string for an empty elements array (documented: callers must guard)", () => {
    expect(generateIsuShorthand({ kind: "jumpCombo", elements: [] })).toBe("");
  });
});

// ---------------------------------------------------------------------------
// Spins
// ---------------------------------------------------------------------------

describe("spins — all families", () => {
  it("produces USpB for a basic upright spin", () => {
    expect(generateIsuShorthand({ kind: "spin", family: "USp", level: "B" })).toBe("USpB");
  });

  it("produces USp1 for an upright spin level 1", () => {
    expect(generateIsuShorthand({ kind: "spin", family: "USp", level: 1 })).toBe("USp1");
  });

  it("produces USp2 for an upright spin level 2", () => {
    expect(generateIsuShorthand({ kind: "spin", family: "USp", level: 2 })).toBe("USp2");
  });

  it("produces SSp1 for a sit spin level 1", () => {
    expect(generateIsuShorthand({ kind: "spin", family: "SSp", level: 1 })).toBe("SSp1");
  });

  it("produces SSp4 for a sit spin level 4", () => {
    expect(generateIsuShorthand({ kind: "spin", family: "SSp", level: 4 })).toBe("SSp4");
  });

  it("produces LSpB for a basic layback spin", () => {
    expect(generateIsuShorthand({ kind: "spin", family: "LSp", level: "B" })).toBe("LSpB");
  });

  it("produces LSp3 for a layback spin level 3", () => {
    expect(generateIsuShorthand({ kind: "spin", family: "LSp", level: 3 })).toBe("LSp3");
  });

  it("produces CoSp3 for a combination spin level 3", () => {
    expect(generateIsuShorthand({ kind: "spin", family: "CoSp", level: 3 })).toBe("CoSp3");
  });

  it("produces CoSp4 for a combination spin level 4", () => {
    expect(generateIsuShorthand({ kind: "spin", family: "CoSp", level: 4 })).toBe("CoSp4");
  });

  it("produces FSSp4 for a flying sit spin level 4", () => {
    expect(generateIsuShorthand({ kind: "spin", family: "FSSp", level: 4 })).toBe("FSSp4");
  });

  it("produces FSSpB for a basic flying sit spin", () => {
    expect(generateIsuShorthand({ kind: "spin", family: "FSSp", level: "B" })).toBe("FSSpB");
  });

  it("produces FCoSp2 for a flying combination spin level 2", () => {
    expect(generateIsuShorthand({ kind: "spin", family: "FCoSp", level: 2 })).toBe("FCoSp2");
  });

  it("produces FUSp1 for a flying upright spin level 1", () => {
    expect(generateIsuShorthand({ kind: "spin", family: "FUSp", level: 1 })).toBe("FUSp1");
  });

  it("produces FLSp3 for a flying layback spin level 3", () => {
    expect(generateIsuShorthand({ kind: "spin", family: "FLSp", level: 3 })).toBe("FLSp3");
  });

  it("produces FCSp2 for a flying camel spin level 2", () => {
    expect(generateIsuShorthand({ kind: "spin", family: "FCSp", level: 2 })).toBe("FCSp2");
  });

  it("produces CSp4 for a camel spin level 4", () => {
    expect(generateIsuShorthand({ kind: "spin", family: "CSp", level: 4 })).toBe("CSp4");
  });
});

// ---------------------------------------------------------------------------
// Step sequences
// ---------------------------------------------------------------------------

describe("stepSequence", () => {
  it("produces StSqB for a basic step sequence", () => {
    expect(generateIsuShorthand({ kind: "stepSequence", level: "B" })).toBe("StSqB");
  });

  it("produces StSq1 for step sequence level 1", () => {
    expect(generateIsuShorthand({ kind: "stepSequence", level: 1 })).toBe("StSq1");
  });

  it("produces StSq2 for step sequence level 2", () => {
    expect(generateIsuShorthand({ kind: "stepSequence", level: 2 })).toBe("StSq2");
  });

  it("produces StSq3 for step sequence level 3", () => {
    expect(generateIsuShorthand({ kind: "stepSequence", level: 3 })).toBe("StSq3");
  });

  it("produces StSq4 for step sequence level 4", () => {
    expect(generateIsuShorthand({ kind: "stepSequence", level: 4 })).toBe("StSq4");
  });
});

// ---------------------------------------------------------------------------
// Choreographic and spiral sequences
// ---------------------------------------------------------------------------

describe("chorSequence", () => {
  it("always produces ChSq1 regardless of input (no level variant)", () => {
    expect(generateIsuShorthand({ kind: "chorSequence" })).toBe("ChSq1");
  });
});

describe("spiralSequence", () => {
  it("always produces SpSq (no level suffix — legacy/synchro element)", () => {
    expect(generateIsuShorthand({ kind: "spiralSequence" })).toBe("SpSq");
  });
});

// ---------------------------------------------------------------------------
// Death spirals
// ---------------------------------------------------------------------------

describe("deathSpiral", () => {
  it("produces FoIDS1 for forward-outside-inside-edge death spiral level 1", () => {
    expect(generateIsuShorthand({ kind: "deathSpiral", type: "FoI", level: 1 })).toBe("FoIDS1");
  });

  it("produces FoODS2 for forward-outside-outside-edge death spiral level 2", () => {
    expect(generateIsuShorthand({ kind: "deathSpiral", type: "FoO", level: 2 })).toBe("FoODS2");
  });

  it("produces BoIDS3 for backward-inside death spiral level 3", () => {
    expect(generateIsuShorthand({ kind: "deathSpiral", type: "BoI", level: 3 })).toBe("BoIDS3");
  });

  it("produces BoODS4 for backward-outside death spiral level 4", () => {
    expect(generateIsuShorthand({ kind: "deathSpiral", type: "BoO", level: 4 })).toBe("BoODS4");
  });

  it("produces BoODSB for backward-outside basic death spiral", () => {
    expect(generateIsuShorthand({ kind: "deathSpiral", type: "BoO", level: "B" })).toBe("BoODSB");
  });
});

// ---------------------------------------------------------------------------
// Lifts
// ---------------------------------------------------------------------------

describe("lifts", () => {
  it("produces 1Li1 for a group-1 lift level 1", () => {
    expect(generateIsuShorthand({ kind: "lift", family: "1Li", level: 1 })).toBe("1Li1");
  });

  it("produces 2Li3 for a group-2 lift level 3", () => {
    expect(generateIsuShorthand({ kind: "lift", family: "2Li", level: 3 })).toBe("2Li3");
  });

  it("produces 3Li2 for a group-3 lift level 2", () => {
    expect(generateIsuShorthand({ kind: "lift", family: "3Li", level: 2 })).toBe("3Li2");
  });

  it("produces 4Li4 for a group-4 lift level 4", () => {
    expect(generateIsuShorthand({ kind: "lift", family: "4Li", level: 4 })).toBe("4Li4");
  });

  it("produces 5ALiB for a group-5A basic lift", () => {
    expect(generateIsuShorthand({ kind: "lift", family: "5ALi", level: "B" })).toBe("5ALiB");
  });

  it("produces 5BLi1 for a group-5B lift level 1", () => {
    expect(generateIsuShorthand({ kind: "lift", family: "5BLi", level: 1 })).toBe("5BLi1");
  });

  it("produces BoLi3 for a border lift level 3", () => {
    expect(generateIsuShorthand({ kind: "lift", family: "BoLi", level: 3 })).toBe("BoLi3");
  });

  it("produces CuLi2 for a curve lift level 2", () => {
    expect(generateIsuShorthand({ kind: "lift", family: "CuLi", level: 2 })).toBe("CuLi2");
  });

  it("produces StLi4 for a stationary lift level 4", () => {
    expect(generateIsuShorthand({ kind: "lift", family: "StLi", level: 4 })).toBe("StLi4");
  });

  it("produces PiFB for a pair-in-flight basic lift", () => {
    expect(generateIsuShorthand({ kind: "lift", family: "PiF", level: "B" })).toBe("PiFB");
  });
});

// ---------------------------------------------------------------------------
// Throws
// ---------------------------------------------------------------------------

describe("throws", () => {
  it("produces 1ThT for a single throw toe loop", () => {
    expect(generateIsuShorthand({ kind: "throw", turns: 1, type: "T" })).toBe("1ThT");
  });

  it("produces 2ThS for a double throw Salchow", () => {
    expect(generateIsuShorthand({ kind: "throw", turns: 2, type: "S" })).toBe("2ThS");
  });

  it("produces 3ThLo for a triple throw loop", () => {
    expect(generateIsuShorthand({ kind: "throw", turns: 3, type: "Lo" })).toBe("3ThLo");
  });

  it("produces 3ThF for a triple throw flip", () => {
    expect(generateIsuShorthand({ kind: "throw", turns: 3, type: "F" })).toBe("3ThF");
  });

  it("produces 3ThLz for a triple throw Lutz", () => {
    expect(generateIsuShorthand({ kind: "throw", turns: 3, type: "Lz" })).toBe("3ThLz");
  });

  it("produces 4ThA for a quad throw Axel", () => {
    expect(generateIsuShorthand({ kind: "throw", turns: 4, type: "A" })).toBe("4ThA");
  });
});
