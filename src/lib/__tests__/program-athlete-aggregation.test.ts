import { describe, it, expect } from "vitest";
import {
  aggregateProgramAthletes,
  applyLevels,
  applyMedicalCompliance,
  applyMembershipCompliance,
  applyWaiverCompliance,
  sortAthleteRows,
  type AthleteLite,
  type EnrollmentInput,
  type InstanceRegistrationInput,
} from "../program-athlete-aggregation";

function makeAthlete(overrides: Partial<AthleteLite> = {}): AthleteLite {
  return {
    id: "athlete-1",
    name: "Alice Smith",
    firstName: "Alice",
    lastName: "Smith",
    avatar: null,
    email: "alice@example.com",
    birthDate: null,
    gender: null,
    organizationAthletes: [],
    ...overrides,
  };
}

function makeEnrollment(overrides: Partial<EnrollmentInput> = {}): EnrollmentInput {
  const athlete = overrides.athlete ?? makeAthlete();
  return {
    athleteId: athlete.id,
    status: "ACTIVE",
    createdAt: new Date("2026-01-15T00:00:00Z"),
    athlete,
    ...overrides,
  };
}

function makeInstanceReg(
  overrides: Partial<InstanceRegistrationInput> = {}
): InstanceRegistrationInput {
  const athlete = overrides.athlete ?? makeAthlete();
  return {
    athleteId: athlete.id,
    createdAt: new Date("2026-02-01T00:00:00Z"),
    athlete,
    ...overrides,
  };
}

describe("aggregateProgramAthletes", () => {
  it("returns empty map when no enrollments or registrations", () => {
    const result = aggregateProgramAthletes([], []);
    expect(result.size).toBe(0);
  });

  it("creates one row per unique enrolled athlete", () => {
    const alice = makeAthlete({ id: "a1", firstName: "Alice", lastName: "A" });
    const bob = makeAthlete({ id: "a2", firstName: "Bob", lastName: "B" });
    const result = aggregateProgramAthletes(
      [makeEnrollment({ athlete: alice }), makeEnrollment({ athlete: bob })],
      []
    );
    expect(result.size).toBe(2);
    expect(result.get("a1")?.firstName).toBe("Alice");
    expect(result.get("a2")?.firstName).toBe("Bob");
  });

  it("counts sessions for per-instance registrations", () => {
    const alice = makeAthlete({ id: "a1" });
    const regs = [
      makeInstanceReg({ athlete: alice, createdAt: new Date("2026-02-01") }),
      makeInstanceReg({ athlete: alice, createdAt: new Date("2026-02-08") }),
      makeInstanceReg({ athlete: alice, createdAt: new Date("2026-02-15") }),
    ];
    const result = aggregateProgramAthletes([], regs);
    expect(result.size).toBe(1);
    expect(result.get("a1")?.sessionCount).toBe(3);
  });

  it("dedupes the same athlete across enrollments and registrations", () => {
    const alice = makeAthlete({ id: "a1" });
    const result = aggregateProgramAthletes(
      [makeEnrollment({ athlete: alice })],
      [
        makeInstanceReg({ athlete: alice }),
        makeInstanceReg({ athlete: alice, createdAt: new Date("2026-02-08") }),
      ]
    );
    expect(result.size).toBe(1);
    expect(result.get("a1")?.sessionCount).toBe(2);
    expect(result.get("a1")?.status).toBe("ACTIVE"); // from enrollment
  });

  it("uses the earliest createdAt as firstRegisteredAt across both sources", () => {
    const alice = makeAthlete({ id: "a1" });
    const result = aggregateProgramAthletes(
      [makeEnrollment({ athlete: alice, createdAt: new Date("2026-03-01T00:00:00Z") })],
      [makeInstanceReg({ athlete: alice, createdAt: new Date("2026-01-01T00:00:00Z") })]
    );
    expect(result.get("a1")?.firstRegisteredAt).toBe("2026-01-01T00:00:00.000Z");
  });

  it("starts per-instance-only athletes with sessionCount=1 and status REGISTERED", () => {
    const alice = makeAthlete({ id: "a1" });
    const result = aggregateProgramAthletes([], [makeInstanceReg({ athlete: alice })]);
    expect(result.get("a1")?.sessionCount).toBe(1);
    expect(result.get("a1")?.status).toBe("REGISTERED");
  });
});

describe("applyLevels", () => {
  it("assigns levels from the athlete's organizationAthletes row", () => {
    const alice = makeAthlete({
      id: "a1",
      organizationAthletes: [{ level: "level-5" }],
    });
    const byAthlete = aggregateProgramAthletes([makeEnrollment({ athlete: alice })], []);
    applyLevels(
      byAthlete,
      [makeEnrollment({ athlete: alice })],
      [],
      new Map([["level-5", "Level 5"]])
    );
    expect(byAthlete.get("a1")?.level).toEqual({ id: "level-5", name: "Level 5" });
  });

  it("ignores 'Unassigned' as a level", () => {
    const alice = makeAthlete({
      id: "a1",
      organizationAthletes: [{ level: "Unassigned" }],
    });
    const byAthlete = aggregateProgramAthletes([makeEnrollment({ athlete: alice })], []);
    applyLevels(byAthlete, [makeEnrollment({ athlete: alice })], [], new Map());
    expect(byAthlete.get("a1")?.level).toBeNull();
  });

  it("falls back to the level id when name is missing from the map", () => {
    const alice = makeAthlete({
      id: "a1",
      organizationAthletes: [{ level: "legacy-level" }],
    });
    const byAthlete = aggregateProgramAthletes([makeEnrollment({ athlete: alice })], []);
    applyLevels(byAthlete, [makeEnrollment({ athlete: alice })], [], new Map());
    expect(byAthlete.get("a1")?.level).toEqual({ id: "legacy-level", name: "legacy-level" });
  });
});

describe("applyMembershipCompliance", () => {
  it("marks verified when the athlete is in the set, missing otherwise", () => {
    const alice = makeAthlete({ id: "a1" });
    const bob = makeAthlete({ id: "a2" });
    const byAthlete = aggregateProgramAthletes(
      [makeEnrollment({ athlete: alice }), makeEnrollment({ athlete: bob })],
      []
    );
    applyMembershipCompliance(byAthlete, new Set(["a1"]));
    expect(byAthlete.get("a1")?.compliance.membership).toBe("verified");
    expect(byAthlete.get("a2")?.compliance.membership).toBe("missing");
  });
});

describe("applyWaiverCompliance", () => {
  it("marks signed only when all required waivers are accepted", () => {
    const alice = makeAthlete({ id: "a1" });
    const bob = makeAthlete({ id: "a2" });
    const byAthlete = aggregateProgramAthletes(
      [makeEnrollment({ athlete: alice }), makeEnrollment({ athlete: bob })],
      []
    );
    applyWaiverCompliance(
      byAthlete,
      ["w1", "w2"],
      [
        { athleteId: "a1", waiverId: "w1" },
        { athleteId: "a1", waiverId: "w2" },
        { athleteId: "a2", waiverId: "w1" },
      ]
    );
    expect(byAthlete.get("a1")?.compliance.waiver).toBe("signed");
    expect(byAthlete.get("a2")?.compliance.waiver).toBe("unsigned");
  });

  it("treats athletes with no acceptances as unsigned", () => {
    const alice = makeAthlete({ id: "a1" });
    const byAthlete = aggregateProgramAthletes([makeEnrollment({ athlete: alice })], []);
    applyWaiverCompliance(byAthlete, ["w1"], []);
    expect(byAthlete.get("a1")?.compliance.waiver).toBe("unsigned");
  });
});

describe("applyMedicalCompliance", () => {
  it("marks complete when the athlete is in the set, incomplete otherwise", () => {
    const alice = makeAthlete({ id: "a1" });
    const bob = makeAthlete({ id: "a2" });
    const byAthlete = aggregateProgramAthletes(
      [makeEnrollment({ athlete: alice }), makeEnrollment({ athlete: bob })],
      []
    );
    applyMedicalCompliance(byAthlete, new Set(["a2"]));
    expect(byAthlete.get("a1")?.compliance.medical).toBe("incomplete");
    expect(byAthlete.get("a2")?.compliance.medical).toBe("complete");
  });
});

describe("sortAthleteRows", () => {
  it("sorts by lastName then firstName case-insensitively", () => {
    const byAthlete = aggregateProgramAthletes(
      [
        makeEnrollment({
          athlete: makeAthlete({ id: "a1", firstName: "Charlie", lastName: "Zulu" }),
        }),
        makeEnrollment({
          athlete: makeAthlete({ id: "a2", firstName: "alice", lastName: "adams" }),
        }),
        makeEnrollment({
          athlete: makeAthlete({ id: "a3", firstName: "Bob", lastName: "Adams" }),
        }),
      ],
      []
    );
    const sorted = sortAthleteRows(Array.from(byAthlete.values()));
    expect(sorted.map((r) => r.id)).toEqual(["a2", "a3", "a1"]);
  });
});
