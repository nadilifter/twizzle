/**
 * Skating Taxonomy Seed
 * =====================
 *
 * Idempotent seed of the canonical figure-skating taxonomy for an organization:
 *
 *   - Categories: CanSkate, STARSkate, Adult Skating, Synchronized Skating
 *   - Levels: CanSkate Stages 1-6, STAR 1-10, Gold
 *   - Skills: ISU-aligned element catalog grouped by element type
 *     (Edges, Footwork, Jumps, Spins, Spirals, Field Moves, Conditioning)
 *   - Evaluation Templates: representative test sheets
 *
 * Usage:
 *   import { seedSkatingTaxonomy } from "./skate-seed";
 *   await seedSkatingTaxonomy(prisma, organizationId);
 *
 * All rows are upserted by deterministic ID (`${organizationId}-<key>`),
 * so re-running is safe and won't duplicate.
 *
 * Modeled after the Uplifter ecosystem's category/category_level structure
 * (CanSkate / STARSkate / Synchro categories, with per-stage levels).
 */

import { PrismaClient } from "@prisma/client";
import { seedCanSkateRibbons } from "./canskate-ribbons";
import { seedStarAssessments, STAR_ASSESSMENT_COUNTS } from "./star-assessments";

export { seedCanSkateRibbons } from "./canskate-ribbons";
export { seedStarAssessments, STAR_ASSESSMENT_COUNTS } from "./star-assessments";

const CATEGORIES = [
  {
    key: "cat-canskate",
    name: "CanSkate",
    description:
      "Skate Canada's national learn-to-skate program covering fundamentals across six stages.",
    displayOrder: 0,
  },
  {
    key: "cat-starskate",
    name: "STARSkate",
    description:
      "Skate Canada's skill, test, and competition development program (STAR 1-10 + Gold).",
    displayOrder: 1,
  },
  {
    key: "cat-adult-skating",
    name: "Adult Skating",
    description: "Adult-focused recreational and competitive skating programs.",
    displayOrder: 2,
  },
  {
    key: "cat-synchro",
    name: "Synchronized Skating",
    description:
      "Team discipline of 8-16 skaters performing as a unit in formations and transitions.",
    displayOrder: 3,
  },
];

const LEVELS = [
  // CanSkate Stages
  {
    key: "level-canskate-stage-1",
    name: "CanSkate Stage 1",
    description: "Falling, getting up, marching forward, two-foot glide.",
    order: 1,
    color: "#10b981",
  },
  {
    key: "level-canskate-stage-2",
    name: "CanSkate Stage 2",
    description: "Forward swizzles, two-foot jumps, snowplow stops.",
    order: 2,
    color: "#10b981",
  },
  {
    key: "level-canskate-stage-3",
    name: "CanSkate Stage 3",
    description: "Forward one-foot glides, backward swizzles, basic turns.",
    order: 3,
    color: "#10b981",
  },
  {
    key: "level-canskate-stage-4",
    name: "CanSkate Stage 4",
    description: "Forward crossovers, backward one-foot glides, two-foot spins.",
    order: 4,
    color: "#10b981",
  },
  {
    key: "level-canskate-stage-5",
    name: "CanSkate Stage 5",
    description: "Backward crossovers, t-stops, basic spirals, waltz jump prep.",
    order: 5,
    color: "#10b981",
  },
  {
    key: "level-canskate-stage-6",
    name: "CanSkate Stage 6",
    description: "Waltz jump, one-foot spin, lunges, mohawk-introduced edges.",
    order: 6,
    color: "#10b981",
  },
  // STARSkate
  {
    key: "level-star-1",
    name: "STAR 1",
    description: "First competitive level: basic jumps, spins, and skating skills assessment.",
    order: 11,
    color: "#6366f1",
  },
  {
    key: "level-star-2",
    name: "STAR 2",
    description: "Salchow, toe loop, basic upright and sit spin variations.",
    order: 12,
    color: "#6366f1",
  },
  {
    key: "level-star-3",
    name: "STAR 3",
    description: "Loop and flip jumps, scratch spin, basic step sequences.",
    order: 13,
    color: "#6366f1",
  },
  {
    key: "level-star-4",
    name: "STAR 4",
    description: "Lutz, axel, camel spin, change-foot spin combinations.",
    order: 14,
    color: "#6366f1",
  },
  {
    key: "level-star-5",
    name: "STAR 5",
    description: "Double jumps (introductory), flying spins, advanced footwork.",
    order: 15,
    color: "#6366f1",
  },
  {
    key: "level-star-6",
    name: "STAR 6",
    description: "Full set of double jumps, layback spin, full short program elements.",
    order: 16,
    color: "#6366f1",
  },
  {
    key: "level-star-7",
    name: "STAR 7",
    description: "Double axel introduction, level-3 spins, complex step sequences.",
    order: 17,
    color: "#6366f1",
  },
  {
    key: "level-star-8",
    name: "STAR 8",
    description: "Double axel mastery, triple jump introduction, choreographic sequences.",
    order: 18,
    color: "#6366f1",
  },
  {
    key: "level-star-9",
    name: "STAR 9",
    description: "Triple jumps in program, level-4 spins, ISU-style short program.",
    order: 19,
    color: "#6366f1",
  },
  {
    key: "level-star-10",
    name: "STAR 10",
    description: "Full ISU element repertoire: triples, advanced spins, complete free skate.",
    order: 20,
    color: "#6366f1",
  },
  {
    key: "level-gold",
    name: "Gold",
    description: "Highest skill, free skate, dances, and field moves test level.",
    order: 21,
    color: "#fbbf24",
  },
  // Skate Canada Competition Program categories — used alongside STAR for the
  // qualifying / podium pathway. Referenced from STAR 6+ Freeskate
  // assessments in competition contexts.
  {
    key: "level-pre-juvenile",
    name: "Pre-Juvenile",
    description: "Pre-Juvenile Singles competition category; entry-level competitive stream.",
    order: 30,
    color: "#a855f7",
  },
  {
    key: "level-juvenile",
    name: "Juvenile",
    description: "Juvenile Singles competition category.",
    order: 31,
    color: "#a855f7",
  },
  {
    key: "level-pre-novice",
    name: "Pre-Novice",
    description: "Pre-Novice Singles competition category.",
    order: 32,
    color: "#a855f7",
  },
  {
    key: "level-novice",
    name: "Novice",
    description: "Novice Singles competition category.",
    order: 33,
    color: "#a855f7",
  },
  {
    key: "level-junior",
    name: "Junior",
    description: "Junior Singles competition category; ISU age-eligible.",
    order: 34,
    color: "#a855f7",
  },
  {
    key: "level-senior",
    name: "Senior",
    description: "Senior Singles competition category; ISU age-eligible.",
    order: 35,
    color: "#a855f7",
  },
];

// Element catalog. `category` mirrors element type: Edges, Footwork, Jumps, Spins, Spirals,
// Field Moves, Conditioning. The `levelKey` ties each element to its expected introductory
// level (e.g., Salchow → STAR 2).
const SKILLS = [
  // ---- Edges ----
  {
    key: "skill-fwd-swizzles",
    name: "Forward Swizzles",
    category: "Edges",
    description: "Two-foot in-and-out push pattern moving forward.",
    levelKey: "level-canskate-stage-2",
    minAge: 4,
    maxAge: null,
  },
  {
    key: "skill-bwd-swizzles",
    name: "Backward Swizzles",
    category: "Edges",
    description: "Two-foot in-and-out push pattern moving backward.",
    levelKey: "level-canskate-stage-3",
    minAge: 4,
    maxAge: null,
  },
  {
    key: "skill-one-foot-glide",
    name: "One-Foot Glide",
    category: "Edges",
    description: "Forward glide on a single skating foot in a straight line.",
    levelKey: "level-canskate-stage-3",
    minAge: 5,
    maxAge: null,
  },
  {
    key: "skill-fwd-outside-edge",
    name: "Forward Outside Edge",
    category: "Edges",
    description: "Controlled lean and curve on the outside edge of the forward skating foot.",
    levelKey: "level-canskate-stage-5",
    minAge: 6,
    maxAge: null,
  },
  {
    key: "skill-fwd-inside-edge",
    name: "Forward Inside Edge",
    category: "Edges",
    description: "Controlled lean and curve on the inside edge of the forward skating foot.",
    levelKey: "level-canskate-stage-5",
    minAge: 6,
    maxAge: null,
  },
  {
    key: "skill-bwd-outside-edge",
    name: "Backward Outside Edge",
    category: "Edges",
    description: "Controlled lean and curve on the outside edge moving backward.",
    levelKey: "level-canskate-stage-6",
    minAge: 7,
    maxAge: null,
  },
  {
    key: "skill-bwd-inside-edge",
    name: "Backward Inside Edge",
    category: "Edges",
    description: "Controlled lean and curve on the inside edge moving backward.",
    levelKey: "level-canskate-stage-6",
    minAge: 7,
    maxAge: null,
  },

  // ---- Footwork ----
  {
    key: "skill-fwd-crossovers",
    name: "Forward Crossovers",
    category: "Footwork",
    description: "Forward crossing of one foot over the other in a continuous circle.",
    levelKey: "level-canskate-stage-4",
    minAge: 6,
    maxAge: null,
  },
  {
    key: "skill-bwd-crossovers",
    name: "Backward Crossovers",
    category: "Footwork",
    description: "Backward crossing of one foot over the other in a continuous circle.",
    levelKey: "level-canskate-stage-5",
    minAge: 7,
    maxAge: null,
  },
  {
    key: "skill-fwd-cross-cuts",
    name: "Forward Cross-cuts",
    category: "Footwork",
    description: "Powerful crossing-and-pushing pattern used to generate speed on a curve.",
    levelKey: "level-star-2",
    minAge: 8,
    maxAge: null,
  },
  {
    key: "skill-three-turn",
    name: "Forward Outside Three Turn",
    category: "Footwork",
    description:
      "One-foot turn that traces a '3' on the ice, from forward outside to backward inside edge.",
    levelKey: "level-star-1",
    minAge: 7,
    maxAge: null,
  },
  {
    key: "skill-mohawk",
    name: "Inside Mohawk",
    category: "Footwork",
    description: "Foot-to-foot turn from forward inside to backward inside edge.",
    levelKey: "level-star-2",
    minAge: 8,
    maxAge: null,
  },
  {
    key: "skill-bracket",
    name: "Bracket",
    category: "Footwork",
    description: "One-foot turn similar to a three-turn but with reverse edge change.",
    levelKey: "level-star-4",
    minAge: 9,
    maxAge: null,
  },
  {
    key: "skill-choctaw",
    name: "Choctaw",
    category: "Footwork",
    description: "Foot-to-foot turn with edge change (inside-to-outside or outside-to-inside).",
    levelKey: "level-star-5",
    minAge: 10,
    maxAge: null,
  },

  // ---- Jumps ----
  {
    key: "skill-bunny-hop",
    name: "Bunny Hop",
    category: "Jumps",
    description: "Forward leap from one foot to a toe-pick assist on the other.",
    levelKey: "level-canskate-stage-5",
    minAge: 5,
    maxAge: null,
  },
  {
    key: "skill-waltz-jump",
    name: "Waltz Jump",
    category: "Jumps",
    description:
      "Half-rotation jump from a forward outside edge landing on a backward outside edge.",
    levelKey: "level-canskate-stage-6",
    minAge: 6,
    maxAge: null,
  },
  {
    key: "skill-salchow",
    name: "Salchow Jump",
    category: "Jumps",
    description: "Single-rotation edge jump taking off from a back inside edge.",
    levelKey: "level-star-2",
    minAge: 8,
    maxAge: null,
  },
  {
    key: "skill-toe-loop",
    name: "Toe Loop",
    category: "Jumps",
    description: "Toe-assisted single-rotation jump from a back outside edge.",
    levelKey: "level-star-2",
    minAge: 8,
    maxAge: null,
  },
  {
    key: "skill-loop",
    name: "Loop Jump",
    category: "Jumps",
    description: "Single-rotation edge jump taking off and landing on the same back outside edge.",
    levelKey: "level-star-3",
    minAge: 9,
    maxAge: null,
  },
  {
    key: "skill-flip",
    name: "Flip Jump",
    category: "Jumps",
    description: "Toe-assisted single-rotation jump from a back inside edge.",
    levelKey: "level-star-3",
    minAge: 9,
    maxAge: null,
  },
  {
    key: "skill-lutz",
    name: "Lutz Jump",
    category: "Jumps",
    description: "Toe-assisted single-rotation jump from a back outside edge (counter-rotated).",
    levelKey: "level-star-4",
    minAge: 9,
    maxAge: null,
  },
  {
    key: "skill-axel",
    name: "Axel",
    category: "Jumps",
    description:
      "1.5-rotation jump entered from a forward outside edge; only jump with a forward takeoff.",
    levelKey: "level-star-4",
    minAge: 10,
    maxAge: null,
  },
  {
    key: "skill-double-axel",
    name: "Double Axel",
    category: "Jumps",
    description: "2.5-rotation forward-takeoff jump.",
    levelKey: "level-star-7",
    minAge: 12,
    maxAge: null,
  },

  // ---- Spins ----
  {
    key: "skill-two-foot-spin",
    name: "Two-Foot Spin",
    category: "Spins",
    description: "Centered spin on both feet with multiple rotations.",
    levelKey: "level-canskate-stage-4",
    minAge: 4,
    maxAge: null,
  },
  {
    key: "skill-one-foot-spin",
    name: "One-Foot Spin",
    category: "Spins",
    description: "Centered upright spin on one foot.",
    levelKey: "level-canskate-stage-6",
    minAge: 5,
    maxAge: null,
  },
  {
    key: "skill-scratch-spin",
    name: "Scratch Spin",
    category: "Spins",
    description: "Fast upright spin with arms and free leg pulled in tight to the axis.",
    levelKey: "level-star-3",
    minAge: 8,
    maxAge: null,
  },
  {
    key: "skill-sit-spin",
    name: "Sit Spin",
    category: "Spins",
    description: "Spin in a low sitting position with the skating thigh parallel to the ice.",
    levelKey: "level-star-2",
    minAge: 7,
    maxAge: null,
  },
  {
    key: "skill-camel-spin",
    name: "Camel Spin",
    category: "Spins",
    description:
      "Spin in spiral position — skating leg straight, free leg extended back at hip level.",
    levelKey: "level-star-4",
    minAge: 9,
    maxAge: null,
  },
  {
    key: "skill-layback-spin",
    name: "Layback Spin",
    category: "Spins",
    description: "Upright spin with head and shoulders dropped back, free leg behind.",
    levelKey: "level-star-6",
    minAge: 11,
    maxAge: null,
  },
  {
    key: "skill-flying-camel",
    name: "Flying Camel",
    category: "Spins",
    description: "Flying entry into a camel position.",
    levelKey: "level-star-5",
    minAge: 11,
    maxAge: null,
  },
  {
    key: "skill-combination-spin",
    name: "Combination Spin",
    category: "Spins",
    description: "Spin combining upright, sit, and camel positions with foot/position changes.",
    levelKey: "level-star-4",
    minAge: 10,
    maxAge: null,
  },

  // ---- Spirals / Field Moves ----
  {
    key: "skill-forward-spiral",
    name: "Forward Spiral",
    category: "Field Moves",
    description: "Glide on one foot with the free leg extended behind at or above hip level.",
    levelKey: "level-canskate-stage-6",
    minAge: 6,
    maxAge: null,
  },
  {
    key: "skill-backward-spiral",
    name: "Backward Spiral",
    category: "Field Moves",
    description: "Backward glide on one foot with the free leg extended behind.",
    levelKey: "level-star-1",
    minAge: 7,
    maxAge: null,
  },
  {
    key: "skill-spread-eagle",
    name: "Spread Eagle",
    category: "Field Moves",
    description: "Glide on two feet pointing in opposite directions with open hips.",
    levelKey: "level-star-3",
    minAge: 9,
    maxAge: null,
  },
  {
    key: "skill-ina-bauer",
    name: "Ina Bauer",
    category: "Field Moves",
    description: "Two-foot glide with one knee bent forward, other leg extended back.",
    levelKey: "level-star-5",
    minAge: 11,
    maxAge: null,
  },
  {
    key: "skill-lunge",
    name: "Lunge",
    category: "Field Moves",
    description: "Deep lunge glide on one foot with free leg extended along the ice.",
    levelKey: "level-canskate-stage-5",
    minAge: 5,
    maxAge: null,
  },

  // ---- Conditioning ----
  {
    key: "skill-off-ice-core",
    name: "Off-Ice Core Conditioning",
    category: "Conditioning",
    description:
      "Plank, hollow holds, and rotational core work that supports jump rotation and spin position.",
    levelKey: null,
    minAge: 5,
    maxAge: null,
  },
  {
    key: "skill-off-ice-flexibility",
    name: "Off-Ice Flexibility",
    category: "Conditioning",
    description: "Hip openers, splits, and back flexibility for spirals and layback positions.",
    levelKey: null,
    minAge: 5,
    maxAge: null,
  },
  {
    key: "skill-off-ice-jumps",
    name: "Off-Ice Jump Training",
    category: "Conditioning",
    description: "Plyometric jumps and rotational drills to build on-ice jump technique.",
    levelKey: null,
    minAge: 7,
    maxAge: null,
  },
];

// The illustrative TEST_TEMPLATES that used to live here have been removed
// in favour of two purpose-built seeders:
//   - canskate-ribbons.ts → Pre-CanSkate + CanSkate Stages 1-6 ribbons
//     (Balance/Control/Agility) sourced from official Skate Canada CSVs.
//   - star-assessments.ts → STAR 1-Gold test sheets across five disciplines
//     (Freeskate Elements, Freeskate Programs, Skills, Dance, Artistic,
//     Synchro). See those modules for the data tables.

export async function seedSkatingTaxonomy(
  prisma: PrismaClient,
  organizationId: string
): Promise<void> {
  // Categories
  for (const cat of CATEGORIES) {
    await prisma.category.upsert({
      where: { id: `${organizationId}-${cat.key}` },
      update: {},
      create: {
        id: `${organizationId}-${cat.key}`,
        organizationId,
        name: cat.name,
        description: cat.description,
        displayOrder: cat.displayOrder,
      },
    });
  }

  // Levels
  const levelIdByKey = new Map<string, string>();
  for (const lvl of LEVELS) {
    const id = `${organizationId}-${lvl.key}`;
    await prisma.level.upsert({
      where: { id },
      update: {},
      create: {
        id,
        organizationId,
        name: lvl.name,
        description: lvl.description,
        order: lvl.order,
        color: lvl.color,
      },
    });
    levelIdByKey.set(lvl.key, id);
  }

  // Skills
  const skillIdByKey = new Map<string, string>();
  for (const skill of SKILLS) {
    const id = `${organizationId}-${skill.key}`;
    const levelId = skill.levelKey ? levelIdByKey.get(skill.levelKey) : null;
    await prisma.skill.upsert({
      where: { id },
      update: {},
      create: {
        id,
        organizationId,
        name: skill.name,
        category: skill.category,
        description: skill.description,
        minAge: skill.minAge,
        maxAge: skill.maxAge,
        levelId,
      },
    });
    skillIdByKey.set(skill.key, id);
  }

  // Official Skate Canada CanSkate ribbon catalog (Balance/Control/Agility
  // ribbons × Stages 1-6, plus Pre-CanSkate). Imported from the Uplifter
  // ecosystem CSVs in prisma/canskate-ribbons/.
  await seedCanSkateRibbons(prisma, organizationId);

  // Official Skate Canada STAR 1-Gold assessment catalog across Freeskate
  // Elements/Programs, Skills, Dance Step Elements, Pattern Dances,
  // Artistic Programs, and Synchro. ~70 elements + ~40 test sheets.
  await seedStarAssessments(prisma, organizationId);
}

export const SKATE_SEED_COUNTS = {
  categories: CATEGORIES.length,
  levels: LEVELS.length,
  skills: SKILLS.length,
  starSkills: STAR_ASSESSMENT_COUNTS.skills,
  starTemplates: STAR_ASSESSMENT_COUNTS.templates,
};

// ── Skate Canada Season seed ─────────────────────────────────────────────────
// Phase 5.4: Upserts the canonical 2026-2027 development season.
// scSeasonGuid is left null — Phase 6.4 will populate it via the CRM API.

export async function seedSkateCanadaSeasons(prisma: PrismaClient): Promise<void> {
  await prisma.skateCanadaSeason.upsert({
    where: { name: "2026-2027" },
    update: {},
    create: {
      name: "2026-2027",
      startDate: new Date("2026-09-01T00:00:00.000Z"),
      endDate: new Date("2027-08-31T00:00:00.000Z"),
      isActive: true,
      scSeasonGuid: null,
    },
  });
}
