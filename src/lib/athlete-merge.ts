// Athlete merge service.
//
// Merges a "duplicate" Athlete into a "survivor" Athlete in one $transaction:
//   1. Validate (same org, no in-flight federation submissions, etc.)
//   2. Rebind / dedupe every FK that points to Athlete (23 tables)
//   3. Merge the OrganizationAthlete join row (preserving the oldest
//      federationMemberNumber per the ROADMAP rule)
//   4. Snapshot the duplicate's data + write the AthleteMerge audit row
//   5. Delete the duplicate Athlete row (cascades to anything still left)
//
// Preview mode runs validation + counts what WOULD be rebound/deduplicated
// without writing anything. Used by the UI to show the user what they're
// about to do.

import { db } from "@/lib/db";
import type { Prisma, PrismaClient } from "@prisma/client";

type Tx = Prisma.TransactionClient | PrismaClient;

export interface MergeInput {
  survivorId: string;
  duplicateId: string;
  organizationId: string;
  actorId: string;
  reason?: string | null;
}

export interface MergeCounts {
  [table: string]: { rebound: number; deduplicated: number };
}

export interface MergePreviewResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
  counts: MergeCounts;
  // Whose federationMemberNumber the merge will keep, if both rows have one.
  federationDecision: {
    survivor: FederationFields | null;
    duplicate: FederationFields | null;
    chosen: "survivor" | "duplicate" | null;
    reason: string | null;
  };
}

export interface MergeExecuteResult {
  mergeId: string;
  counts: MergeCounts;
}

interface FederationFields {
  federationName: string | null;
  federationMemberNumber: string | null;
  federationMemberExpiresAt: Date | null;
  createdAt: Date;
}

// Tables that get a plain rebind: every row on the duplicate becomes the
// survivor's row. No dedup key — same row can exist on both sides without
// any unique constraint to violate.
const PLAIN_REBIND_TABLES = [
  "attendance",
  "evaluation",
  "competitionEntry",
  "competitionResult",
  "registrationFile",
  "media",
  "lineItem",
  "recurringCharge",
  "guardianClaimRequest",
  "instanceAttendance",
  "instanceRegistration",
  "enrollment",
  "athleteMembership",
  "athletePass",
  "waiverAcceptance",
  "waiverSignature",
] as const;

// Tables with an `id` PK that need dedup on a foreign key before rebinding.
// If the survivor already has a row with the same key, drop the duplicate's
// row; otherwise rebind. Each entry is [delegate, dedupKey].
//
// FederationSubmissionAthlete is intentionally NOT in this list — it has a
// composite PK (no `id`) and is handled separately in rebindFederationSubmissionLinks().
const DEDUP_REBIND_TABLES: Array<[string, string]> = [
  ["athleteGuardian", "userId"], // dedupe per guardian user
  ["athleteSkillProgress", "skillId"], // dedupe per skill
  ["customInfoResponse", "questionId"], // dedupe per custom-info question
  ["athleteAchievement", "achievementId"], // dedupe per achievement template
];

// Re-fetches the FederationSubmission rows currently linking to the duplicate
// to verify no non-DRAFT submissions exist (per ROADMAP rule the user chose).
async function findBlockingSubmissions(client: Tx, athleteId: string) {
  const links = await client.federationSubmissionAthlete.findMany({
    where: { athleteId },
    include: { submission: { select: { id: true, status: true } } },
  });
  return links.map((link) => link.submission).filter((sub) => sub.status !== "DRAFT");
}

// Compares the two OrganizationAthlete join rows in the merged org and decides
// which federationMemberNumber to keep.
function decideFederationFields(
  survivorOA: {
    federationName: string | null;
    federationMemberNumber: string | null;
    federationMemberExpiresAt: Date | null;
    createdAt: Date;
  } | null,
  duplicateOA: {
    federationName: string | null;
    federationMemberNumber: string | null;
    federationMemberExpiresAt: Date | null;
    createdAt: Date;
  } | null
): MergePreviewResult["federationDecision"] {
  const survivorHas = !!survivorOA?.federationMemberNumber;
  const duplicateHas = !!duplicateOA?.federationMemberNumber;

  if (!survivorHas && !duplicateHas) {
    return {
      survivor: survivorOA,
      duplicate: duplicateOA,
      chosen: null,
      reason: null,
    };
  }
  if (survivorHas && !duplicateHas) {
    return {
      survivor: survivorOA,
      duplicate: duplicateOA,
      chosen: "survivor",
      reason: "Only the survivor has a federation number.",
    };
  }
  if (!survivorHas && duplicateHas) {
    return {
      survivor: survivorOA,
      duplicate: duplicateOA,
      chosen: "duplicate",
      reason: "Only the duplicate has a federation number; transferring to survivor.",
    };
  }
  // Both have one. Prefer the OLDER OrganizationAthlete row's federation fields
  // per the ROADMAP rule ("preserve the oldest federationMemberNumber"). The
  // join-row createdAt is the best proxy for when the number was first
  // recorded against this athlete.
  const survivorOlder = survivorOA!.createdAt <= duplicateOA!.createdAt;
  return {
    survivor: survivorOA,
    duplicate: duplicateOA,
    chosen: survivorOlder ? "survivor" : "duplicate",
    reason: survivorOlder
      ? "Both athletes have a federation number — keeping the survivor's (older join row)."
      : "Both athletes have a federation number — keeping the duplicate's (older join row).",
  };
}

interface AthleteWithGuards {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  birthDate: Date | null;
  organizationAthletes: Array<{
    id: string;
    organizationId: string;
    level: string;
    status: string;
    customId: string | null;
    federationName: string | null;
    federationMemberNumber: string | null;
    federationMemberExpiresAt: Date | null;
    createdAt: Date;
  }>;
}

async function loadAthlete(client: Tx, id: string): Promise<AthleteWithGuards | null> {
  return client.athlete.findUnique({
    where: { id },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      birthDate: true,
      organizationAthletes: {
        select: {
          id: true,
          organizationId: true,
          level: true,
          status: true,
          customId: true,
          federationName: true,
          federationMemberNumber: true,
          federationMemberExpiresAt: true,
          createdAt: true,
        },
      },
    },
  });
}

async function validate(
  client: Tx,
  input: MergeInput
): Promise<{
  errors: string[];
  warnings: string[];
  survivor: AthleteWithGuards | null;
  duplicate: AthleteWithGuards | null;
}> {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (input.survivorId === input.duplicateId) {
    errors.push("Survivor and duplicate must be different athletes.");
    return { errors, warnings, survivor: null, duplicate: null };
  }

  const [survivor, duplicate] = await Promise.all([
    loadAthlete(client, input.survivorId),
    loadAthlete(client, input.duplicateId),
  ]);

  if (!survivor) errors.push("Survivor athlete not found.");
  if (!duplicate) errors.push("Duplicate athlete not found.");
  if (errors.length) return { errors, warnings, survivor, duplicate };

  // Both athletes must belong to the requesting org.
  const survivorInOrg = survivor!.organizationAthletes.some(
    (oa) => oa.organizationId === input.organizationId
  );
  const duplicateInOrg = duplicate!.organizationAthletes.some(
    (oa) => oa.organizationId === input.organizationId
  );

  if (!survivorInOrg) errors.push("Survivor athlete is not in your organization.");
  if (!duplicateInOrg) errors.push("Duplicate athlete is not in your organization.");

  // Same-org merge only for v1: if either athlete belongs to organizations
  // OTHER than the requesting one, refuse. Cross-org merges are too risky
  // to do without explicit per-org acknowledgment.
  const survivorOtherOrgs = survivor!.organizationAthletes.filter(
    (oa) => oa.organizationId !== input.organizationId
  );
  const duplicateOtherOrgs = duplicate!.organizationAthletes.filter(
    (oa) => oa.organizationId !== input.organizationId
  );
  if (survivorOtherOrgs.length || duplicateOtherOrgs.length) {
    errors.push(
      "Cross-organization merge is not supported. One or both athletes belong to other organizations."
    );
  }

  // Refuse if duplicate has any non-DRAFT FederationSubmission. The
  // submission's identity is reported to the federation; silently re-binding
  // to a different athlete after the fact would corrupt that record.
  const blocking = await findBlockingSubmissions(client, input.duplicateId);
  if (blocking.length) {
    errors.push(
      `Duplicate has ${blocking.length} non-DRAFT federation submission(s) (statuses: ${[
        ...new Set(blocking.map((s) => s.status)),
      ].join(", ")}). Transition them to REJECTED before merging.`
    );
  }

  // Surface federation-number conflict as a warning (it's resolved by the
  // decideFederationFields rule, but the human reviewer should know).
  const survivorOA = survivor!.organizationAthletes.find(
    (oa) => oa.organizationId === input.organizationId
  )!;
  const duplicateOA = duplicate!.organizationAthletes.find(
    (oa) => oa.organizationId === input.organizationId
  )!;
  if (survivorOA?.federationMemberNumber && duplicateOA?.federationMemberNumber) {
    if (survivorOA.federationMemberNumber !== duplicateOA.federationMemberNumber) {
      warnings.push(
        `Both athletes have a federation number (survivor: ${survivorOA.federationMemberNumber}, duplicate: ${duplicateOA.federationMemberNumber}). The older join row's number is kept.`
      );
    }
  }

  return { errors, warnings, survivor, duplicate };
}

// Counts how many rows would be rebound vs. deduplicated for each table.
// Doesn't mutate anything.
async function computeCounts(client: Tx, input: MergeInput): Promise<MergeCounts> {
  const counts: MergeCounts = {};

  // Plain rebind tables — every duplicate row becomes a survivor row.
  for (const table of PLAIN_REBIND_TABLES) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const delegate = (client as any)[table];
    const total = await delegate.count({ where: { athleteId: input.duplicateId } });
    counts[table] = { rebound: total, deduplicated: 0 };
  }

  // Dedup-rebind tables — pre-check the survivor's keyset to know which of
  // the duplicate's rows will be rebound vs. deduplicated.
  for (const [table, key] of DEDUP_REBIND_TABLES) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const delegate = (client as any)[table];
    const survivorRows = await delegate.findMany({
      where: { athleteId: input.survivorId },
      select: { [key]: true },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const survivorKeys = new Set(survivorRows.map((r: any) => r[key]));
    const duplicateRows = await delegate.findMany({
      where: { athleteId: input.duplicateId },
      select: { id: true, [key]: true },
    });
    let dedup = 0;
    let rebind = 0;
    for (const row of duplicateRows) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (survivorKeys.has((row as any)[key])) dedup++;
      else rebind++;
    }
    counts[table] = { rebound: rebind, deduplicated: dedup };
  }

  // AthleteMedicalInfo is 1:1 (unique on athleteId) — survivor's row stays
  // unchanged if present; duplicate's row is dropped via cascade when the
  // Athlete is deleted at the end.
  const duplicateMedical = await client.athleteMedicalInfo.findFirst({
    where: { athleteId: input.duplicateId },
    select: { id: true },
  });
  const survivorMedical = await client.athleteMedicalInfo.findFirst({
    where: { athleteId: input.survivorId },
    select: { id: true },
  });
  counts["athleteMedicalInfo"] = {
    rebound: duplicateMedical && !survivorMedical ? 1 : 0,
    deduplicated: duplicateMedical && survivorMedical ? 1 : 0,
  };

  // FederationSubmissionAthlete — composite PK on (submissionId, athleteId),
  // no `id` column. Dedupe on submissionId.
  const survivorSubs = await client.federationSubmissionAthlete.findMany({
    where: { athleteId: input.survivorId },
    select: { submissionId: true },
  });
  const survivorSubSet = new Set(survivorSubs.map((r) => r.submissionId));
  const duplicateSubs = await client.federationSubmissionAthlete.findMany({
    where: { athleteId: input.duplicateId },
    select: { submissionId: true },
  });
  let subRebound = 0;
  let subDedup = 0;
  for (const row of duplicateSubs) {
    if (survivorSubSet.has(row.submissionId)) subDedup++;
    else subRebound++;
  }
  counts["federationSubmissionAthlete"] = { rebound: subRebound, deduplicated: subDedup };

  // OrganizationAthlete — exactly one row each in this org, will be merged.
  counts["organizationAthlete"] = { rebound: 0, deduplicated: 1 };

  return counts;
}

export async function previewMerge(input: MergeInput): Promise<MergePreviewResult> {
  const { errors, warnings, survivor, duplicate } = await validate(db, input);

  if (errors.length || !survivor || !duplicate) {
    return {
      ok: false,
      errors,
      warnings,
      counts: {},
      federationDecision: {
        survivor: null,
        duplicate: null,
        chosen: null,
        reason: null,
      },
    };
  }

  const survivorOA = survivor.organizationAthletes.find(
    (oa) => oa.organizationId === input.organizationId
  )!;
  const duplicateOA = duplicate.organizationAthletes.find(
    (oa) => oa.organizationId === input.organizationId
  )!;

  const counts = await computeCounts(db, input);

  return {
    ok: true,
    errors,
    warnings,
    counts,
    federationDecision: decideFederationFields(survivorOA, duplicateOA),
  };
}

export async function executeMerge(input: MergeInput): Promise<MergeExecuteResult> {
  return db.$transaction(async (tx) => {
    const { errors, survivor, duplicate } = await validate(tx, input);
    if (errors.length || !survivor || !duplicate) {
      throw new MergeValidationError(errors);
    }

    const survivorOA = survivor.organizationAthletes.find(
      (oa) => oa.organizationId === input.organizationId
    )!;
    const duplicateOA = duplicate.organizationAthletes.find(
      (oa) => oa.organizationId === input.organizationId
    )!;

    const counts: MergeCounts = {};

    // Plain rebinds — updateMany is fine since no unique conflict possible.
    for (const table of PLAIN_REBIND_TABLES) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const delegate = (tx as any)[table];
      const result = await delegate.updateMany({
        where: { athleteId: input.duplicateId },
        data: { athleteId: input.survivorId },
      });
      counts[table] = { rebound: result.count, deduplicated: 0 };
    }

    // Dedup rebinds — find conflicting keys, delete duplicate's, rebind rest.
    for (const [table, key] of DEDUP_REBIND_TABLES) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const delegate = (tx as any)[table];
      const survivorRows = await delegate.findMany({
        where: { athleteId: input.survivorId },
        select: { [key]: true },
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const survivorKeys = new Set(survivorRows.map((r: any) => r[key]));
      const duplicateRows = await delegate.findMany({
        where: { athleteId: input.duplicateId },
        select: { id: true, [key]: true },
      });

      const toDedupIds: string[] = [];
      const toRebindIds: string[] = [];
      for (const row of duplicateRows) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (survivorKeys.has((row as any)[key])) toDedupIds.push((row as any).id);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        else toRebindIds.push((row as any).id);
      }

      if (toDedupIds.length) {
        await delegate.deleteMany({ where: { id: { in: toDedupIds } } });
      }
      if (toRebindIds.length) {
        await delegate.updateMany({
          where: { id: { in: toRebindIds } },
          data: { athleteId: input.survivorId },
        });
      }
      counts[table] = { rebound: toRebindIds.length, deduplicated: toDedupIds.length };
    }

    // AthleteMedicalInfo is 1:1. If survivor doesn't have one and duplicate
    // does, rebind. Otherwise the duplicate's row is dropped by cascade on
    // Athlete delete below.
    const survivorMedical = await tx.athleteMedicalInfo.findFirst({
      where: { athleteId: input.survivorId },
      select: { id: true },
    });
    const duplicateMedical = await tx.athleteMedicalInfo.findFirst({
      where: { athleteId: input.duplicateId },
      select: { id: true },
    });
    if (duplicateMedical) {
      if (!survivorMedical) {
        await tx.athleteMedicalInfo.update({
          where: { id: duplicateMedical.id },
          data: { athleteId: input.survivorId },
        });
        counts["athleteMedicalInfo"] = { rebound: 1, deduplicated: 0 };
      } else {
        counts["athleteMedicalInfo"] = { rebound: 0, deduplicated: 1 };
      }
    } else {
      counts["athleteMedicalInfo"] = { rebound: 0, deduplicated: 0 };
    }

    // FederationSubmissionAthlete — composite PK on (submissionId, athleteId).
    // Can't UPDATE a key field directly; for each duplicate row, either
    // CREATE the corresponding survivor row (if missing) and DELETE the
    // duplicate's, or just DELETE the duplicate's (dedup).
    const survivorSubs = await tx.federationSubmissionAthlete.findMany({
      where: { athleteId: input.survivorId },
      select: { submissionId: true },
    });
    const survivorSubSet = new Set(survivorSubs.map((r) => r.submissionId));
    const duplicateSubs = await tx.federationSubmissionAthlete.findMany({
      where: { athleteId: input.duplicateId },
      select: { submissionId: true },
    });
    let subRebound = 0;
    let subDedup = 0;
    for (const row of duplicateSubs) {
      if (survivorSubSet.has(row.submissionId)) {
        // Survivor already linked to this submission — just drop the duplicate's link.
        await tx.federationSubmissionAthlete.delete({
          where: {
            submissionId_athleteId: {
              submissionId: row.submissionId,
              athleteId: input.duplicateId,
            },
          },
        });
        subDedup++;
      } else {
        // Move link to survivor: delete duplicate's row, create survivor's.
        await tx.federationSubmissionAthlete.delete({
          where: {
            submissionId_athleteId: {
              submissionId: row.submissionId,
              athleteId: input.duplicateId,
            },
          },
        });
        await tx.federationSubmissionAthlete.create({
          data: { submissionId: row.submissionId, athleteId: input.survivorId },
        });
        subRebound++;
      }
    }
    counts["federationSubmissionAthlete"] = { rebound: subRebound, deduplicated: subDedup };

    // Merge the OrganizationAthlete join row. Update the survivor's row with
    // the federation fields chosen by decideFederationFields, then delete the
    // duplicate's join row.
    const fedDecision = decideFederationFields(survivorOA, duplicateOA);
    const chosenSource = fedDecision.chosen === "duplicate" ? duplicateOA : survivorOA;
    await tx.organizationAthlete.update({
      where: { id: survivorOA.id },
      data: {
        // Take federation fields from whichever side was chosen.
        federationName: chosenSource.federationName,
        federationMemberNumber: chosenSource.federationMemberNumber,
        federationMemberExpiresAt: chosenSource.federationMemberExpiresAt,
        // Other fields: prefer the survivor's, fall back to duplicate's if survivor's are null/default.
        customId: survivorOA.customId ?? duplicateOA.customId,
        // level / status already on the survivor — don't overwrite.
      },
    });
    await tx.organizationAthlete.delete({ where: { id: duplicateOA.id } });
    counts["organizationAthlete"] = { rebound: 0, deduplicated: 1 };

    // Snapshot the duplicate before deletion.
    const duplicateSnapshot = {
      athlete: {
        id: duplicate.id,
        firstName: duplicate.firstName,
        lastName: duplicate.lastName,
        email: duplicate.email,
        birthDate: duplicate.birthDate,
      },
      organizationAthlete: {
        organizationId: duplicateOA.organizationId,
        level: duplicateOA.level,
        status: duplicateOA.status,
        customId: duplicateOA.customId,
        federationName: duplicateOA.federationName,
        federationMemberNumber: duplicateOA.federationMemberNumber,
        federationMemberExpiresAt: duplicateOA.federationMemberExpiresAt,
        createdAt: duplicateOA.createdAt,
      },
    };

    // Write the audit row.
    const audit = await tx.athleteMerge.create({
      data: {
        organizationId: input.organizationId,
        survivorId: input.survivorId,
        duplicateId: input.duplicateId,
        duplicateSnapshot: duplicateSnapshot as unknown as Prisma.InputJsonValue,
        counts: counts as unknown as Prisma.InputJsonValue,
        mergedById: input.actorId,
        reason: input.reason ?? null,
      },
      select: { id: true },
    });

    // Finally, delete the duplicate Athlete. Any remaining FK pointers will
    // cascade-delete (or set null) per the schema's onDelete rules. By this
    // point everything in PLAIN_REBIND_TABLES + DEDUP_REBIND_TABLES +
    // AthleteMedicalInfo + OrganizationAthlete has been handled explicitly,
    // so this delete should affect nothing else.
    await tx.athlete.delete({ where: { id: input.duplicateId } });

    return { mergeId: audit.id, counts };
  });
}

export class MergeValidationError extends Error {
  errors: string[];
  constructor(errors: string[]) {
    super(`Merge validation failed: ${errors.join("; ")}`);
    this.name = "MergeValidationError";
    this.errors = errors;
  }
}
