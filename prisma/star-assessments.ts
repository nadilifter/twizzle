/**
 * Skate Canada STAR Assessment Catalog
 * ====================================
 *
 * Ports the official Skate Canada STAR 1-Gold assessment structure into
 * Twizzle. Source: Skate Canada "STAR Assessments" rulebook (24 pages,
 * last updated 2025-06-27). Each test sheet becomes one EvaluationTemplate
 * with its required elements as Skills and one linked Achievement that
 * auto-awards via lib/services/achievement.ts when an evaluation passes
 * the per-level "X of Y silver or better" rule.
 *
 * STAR assessments span five disciplines, each with its own progression:
 *   - Freeskate Elements   STAR 1-10
 *   - Freeskate Programs   STAR 2-Gold (program-level, no skill checklist)
 *   - Skills               STAR 1-Gold (edges, turns, exercises, field moves)
 *   - Dance Step Elements  STAR 1, 3B, 5B (dance step technical assessments)
 *   - Pattern Dances       STAR 2-Gold (specific dances; sample seeded)
 *   - Artistic Programs    STAR 5, 7, 9, Gold
 *   - Synchro              STAR 2, 3, 4
 *
 * Scoring: Skate Canada assesses each element on a Gold/Silver/Bronze
 * scale (Silver = passing). Twizzle models this as PASS_FAIL with the
 * per-test "must pass N of M" rule encoded via completionType=COUNT and
 * completionThreshold=N.
 */

import { PrismaClient } from "@prisma/client";

// ---------------------------------------------------------------------------
// Element catalog
// ---------------------------------------------------------------------------
//
// `category` mirrors the ISU/Skate Canada element type. Skills are deduped
// by name within an organization — if a name matches one already created by
// skate-seed.ts or canskate-ribbons.ts, we re-use it rather than duplicating.

interface StarSkillDef {
  key: string;
  name: string;
  category: string;
  description: string;
}

const STAR_SKILLS: StarSkillDef[] = [
  // ---- Jumps: singles ----
  {
    key: "star-skill-waltz-jump",
    name: "Waltz Jump",
    category: "Jumps",
    description:
      "Half-rotation edge jump from a forward outside edge to a backward outside edge. Skate Canada-listed jump.",
  },
  {
    key: "star-skill-single-salchow",
    name: "Single Salchow",
    category: "Jumps",
    description: "Single-rotation edge jump taking off from a back inside edge.",
  },
  {
    key: "star-skill-single-toe-loop",
    name: "Single Toe Loop",
    category: "Jumps",
    description:
      "Single-rotation toe jump taking off from a back outside edge with a toe pick assist.",
  },
  {
    key: "star-skill-single-loop",
    name: "Single Loop",
    category: "Jumps",
    description: "Single-rotation edge jump taking off and landing on the same back outside edge.",
  },
  {
    key: "star-skill-single-flip",
    name: "Single Flip",
    category: "Jumps",
    description:
      "Single-rotation toe jump from a back inside edge with toe pick assist on the opposite foot.",
  },
  {
    key: "star-skill-single-lutz",
    name: "Single Lutz",
    category: "Jumps",
    description: "Single-rotation toe jump from a back outside edge (counter-rotated takeoff).",
  },
  {
    key: "star-skill-single-axel",
    name: "Single Axel",
    category: "Jumps",
    description:
      "1.5-rotation edge jump entered from a forward outside edge; the only jump with a forward takeoff.",
  },

  // ---- Jumps: doubles ----
  {
    key: "star-skill-double-salchow",
    name: "Double Salchow (2S)",
    category: "Jumps",
    description: "Two-rotation edge jump taking off from a back inside edge.",
  },
  {
    key: "star-skill-double-toe-loop",
    name: "Double Toe Loop (2T)",
    category: "Jumps",
    description: "Two-rotation toe jump from a back outside edge.",
  },
  {
    key: "star-skill-double-loop",
    name: "Double Loop (2Lo)",
    category: "Jumps",
    description: "Two-rotation edge jump from a back outside edge with same-foot landing.",
  },
  {
    key: "star-skill-double-flip",
    name: "Double Flip (2F)",
    category: "Jumps",
    description: "Two-rotation toe jump from a back inside edge.",
  },
  {
    key: "star-skill-double-lutz",
    name: "Double Lutz (2Lz)",
    category: "Jumps",
    description: "Two-rotation toe jump from a back outside edge.",
  },
  {
    key: "star-skill-double-axel",
    name: "Double Axel",
    category: "Jumps",
    description: "2.5-rotation forward-takeoff edge jump.",
  },

  // ---- Jump combinations ----
  {
    key: "star-skill-waltz-toe-loop-combo",
    name: "Waltz + Single Toe Loop Combination",
    category: "Jumps",
    description: "Waltz Jump immediately followed by a Single Toe Loop on the landing foot.",
  },
  {
    key: "star-skill-waltz-loop-combo",
    name: "Waltz + Single Loop Combination",
    category: "Jumps",
    description: "Waltz Jump immediately followed by a Single Loop on the landing foot.",
  },
  {
    key: "star-skill-loop-loop-combo",
    name: "Single Loop + Single Loop Combination",
    category: "Jumps",
    description: "Two Single Loops in immediate succession on the same back outside edge.",
  },
  {
    key: "star-skill-lutz-toe-loop-combo",
    name: "Single Lutz + Single Toe Loop Combination",
    category: "Jumps",
    description: "Single Lutz immediately followed by a Single Toe Loop.",
  },
  {
    key: "star-skill-flip-toe-loop-combo",
    name: "Single Flip + Single Toe Loop Combination",
    category: "Jumps",
    description: "Single Flip immediately followed by a Single Toe Loop.",
  },
  {
    key: "star-skill-axel-combo",
    name: "Axel + Combination",
    category: "Jumps",
    description: "Axel jump followed by a second jump (single or double).",
  },
  {
    key: "star-skill-double-double-combo",
    name: "Double + Double Jump Combination",
    category: "Jumps",
    description:
      "Two double jumps in immediate succession (must be different at higher STAR levels).",
  },

  // ---- Spins ----
  {
    key: "star-skill-fwd-upright-spin",
    name: "Forward Upright Spin",
    category: "Spins",
    description: "Centered upright spin entered forward; minimum 3 revolutions.",
  },
  {
    key: "star-skill-bwd-upright-spin",
    name: "Backward Upright Spin",
    category: "Spins",
    description: "Centered upright spin entered backward; minimum 3 revolutions.",
  },
  {
    key: "star-skill-change-foot-upright-spin",
    name: "Change Foot Upright Spin",
    category: "Spins",
    description: "Upright spin with a change of skating foot.",
  },
  {
    key: "star-skill-fwd-sit-spin",
    name: "Forward Sit Spin",
    category: "Spins",
    description:
      "Sit position spin entered forward; skating thigh parallel to the ice, free leg extended forward.",
  },
  {
    key: "star-skill-bwd-sit-spin",
    name: "Backward Sit Spin",
    category: "Spins",
    description: "Sit position spin entered backward.",
  },
  {
    key: "star-skill-fwd-camel-spin",
    name: "Forward Camel Spin",
    category: "Spins",
    description:
      "Spiral-position spin entered forward; free leg held at hip level or higher with knee and foot.",
  },
  {
    key: "star-skill-bwd-camel-spin",
    name: "Backward Camel Spin",
    category: "Spins",
    description: "Spiral-position spin entered backward.",
  },
  {
    key: "star-skill-change-foot-sit-spin",
    name: "Change Foot Sit Spin",
    category: "Spins",
    description: "Sit spin with a change of skating foot.",
  },
  {
    key: "star-skill-camel-sit-combo",
    name: "Camel/Sit Combination Spin",
    category: "Spins",
    description: "Forward camel transitioning into a sit spin.",
  },
  {
    key: "star-skill-combination-spin",
    name: "Combination Spin",
    category: "Spins",
    description:
      "Spin combining at least two basic positions with two revolutions in each (full value requires all three basic positions).",
  },
  {
    key: "star-skill-combination-spin-change-foot",
    name: "Combination Spin with Change of Foot",
    category: "Spins",
    description: "Combination spin including a foot change between positions.",
  },
  {
    key: "star-skill-spin-one-position",
    name: "Spin In One Position",
    category: "Spins",
    description: "Spin holding only one of the three basic positions with no non-basic positions.",
  },
  {
    key: "star-skill-flying-camel",
    name: "Flying Camel Spin",
    category: "Spins",
    description: "Flying entry into a camel position.",
  },
  {
    key: "star-skill-flying-sit",
    name: "Flying Sit Spin",
    category: "Spins",
    description: "Flying entry into a sit position.",
  },
  {
    key: "star-skill-layback-spin",
    name: "Layback Spin",
    category: "Spins",
    description: "Upright spin with the head and shoulders dropped back, free leg lifted behind.",
  },
  {
    key: "star-skill-crossfoot-spin",
    name: "Crossfoot Spin",
    category: "Spins",
    description: "Upright spin position with feet crossed for centred rotation.",
  },
  {
    key: "star-skill-change-combination-spin",
    name: "Change Combination Spin",
    category: "Spins",
    description: "Combination spin with at least one change of foot and change of position.",
  },

  // ---- Edges ----
  {
    key: "star-skill-fwd-outside-edges",
    name: "Forward Outside Edges",
    category: "Edges",
    description: "Forward outside edges traced down the rink with controlled lean and posture.",
  },
  {
    key: "star-skill-fwd-inside-edges",
    name: "Forward Inside Edges",
    category: "Edges",
    description: "Forward inside edges traced down the rink with controlled lean and posture.",
  },
  {
    key: "star-skill-bwd-outside-edges",
    name: "Backward Outside Edges",
    category: "Edges",
    description: "Backward outside edges traced down the rink with controlled lean.",
  },
  {
    key: "star-skill-bwd-inside-edges",
    name: "Backward Inside Edges",
    category: "Edges",
    description: "Backward inside edges traced down the rink with controlled lean.",
  },
  {
    key: "star-skill-change-of-edge",
    name: "Forward Change of Edge",
    category: "Edges",
    description:
      "Tracing on one foot that visibly changes from one curve+edge to another curve+edge.",
  },

  // ---- Turns ----
  {
    key: "star-skill-fwd-three-turn-outside",
    name: "Forward Outside Three-Turn",
    category: "Turns",
    description: "One-foot turn from forward outside to backward inside edge; tracing forms a '3'.",
  },
  {
    key: "star-skill-fwd-three-turn-inside",
    name: "Forward Inside Three-Turn",
    category: "Turns",
    description: "One-foot turn from forward inside to backward outside edge.",
  },
  {
    key: "star-skill-bwd-three-turn-outside",
    name: "Backward Outside Three-Turn",
    category: "Turns",
    description: "One-foot turn from backward outside to forward inside edge.",
  },
  {
    key: "star-skill-bwd-three-turn-inside",
    name: "Backward Inside Three-Turn",
    category: "Turns",
    description: "One-foot turn from backward inside to forward outside edge.",
  },
  {
    key: "star-skill-fwd-double-threes",
    name: "Forward Double Threes",
    category: "Turns",
    description: "Two consecutive forward three-turns on the same foot in sequence.",
  },
  {
    key: "star-skill-bwd-double-threes",
    name: "Backward Double Threes",
    category: "Turns",
    description: "Two consecutive backward three-turns on the same foot.",
  },
  {
    key: "star-skill-fwd-brackets",
    name: "Forward Brackets",
    category: "Turns",
    description:
      "One-foot turn where the exit edge continues on the same lobe but opposite to the entry; turned against the curve.",
  },
  {
    key: "star-skill-bwd-brackets",
    name: "Backward Brackets",
    category: "Turns",
    description: "Backward bracket turn — counter-rotated to the curve direction.",
  },
  {
    key: "star-skill-fwd-rockers",
    name: "Forward Rockers",
    category: "Turns",
    description:
      "One-foot turn from outside to outside (or inside to inside) with the exit curve on a different lobe.",
  },
  {
    key: "star-skill-bwd-rockers",
    name: "Backward Rockers",
    category: "Turns",
    description: "Backward rocker — same-edge turn with lobe change.",
  },
  {
    key: "star-skill-fwd-counters",
    name: "Forward Counters",
    category: "Turns",
    description: "One-foot turn opposite to the entry curve, same-edge entry/exit, different lobe.",
  },
  {
    key: "star-skill-bwd-counters",
    name: "Backward Counters",
    category: "Turns",
    description: "Backward counter turn.",
  },
  {
    key: "star-skill-fwd-loops",
    name: "Forward Loops",
    category: "Turns",
    description:
      "One-foot oval-pattern movement on the same edge; entry and exit of the loop must cross cleanly.",
  },
  {
    key: "star-skill-bwd-loops",
    name: "Backward Loops",
    category: "Turns",
    description: "Backward loop pattern; clean entry/exit crossing.",
  },
  {
    key: "star-skill-fwd-inside-s-steps",
    name: "Forward Inside S Steps",
    category: "Turns",
    description:
      "Two-foot turn with curve change between feet; entry inside to exit outside (or vice versa).",
  },
  {
    key: "star-skill-bwd-outside-s-steps",
    name: "Backward Outside S Steps",
    category: "Turns",
    description: "Backward S step with curve change.",
  },
  {
    key: "star-skill-twizzles",
    name: "Forward and Backward Twizzles",
    category: "Turns",
    description:
      "Travelling one-foot turn with multiple rotations executed in a continuous uninterrupted action.",
  },
  {
    key: "star-skill-one-foot-turn",
    name: "One-Foot Turn Sequence",
    category: "Turns",
    description: "Rotational movement on one foot from forward to backward (or vice versa).",
  },
  {
    key: "star-skill-rocker-three-turn-seq",
    name: "Rocker-Three-Turn Sequence",
    category: "Turns",
    description: "Combination sequence of rocker turn followed by three-turn(s).",
  },
  {
    key: "star-skill-counter-bracket-seq",
    name: "Counter-Bracket Sequence",
    category: "Turns",
    description: "Combination sequence of counter turn followed by bracket turn(s).",
  },

  // ---- Skills exercises ----
  {
    key: "star-skill-exercise-basic",
    name: "Skills Exercise — Basic",
    category: "Skills Exercise",
    description: "Power, control, and edge-quality exercise prescribed for STAR 1 Skills.",
  },
  {
    key: "star-skill-exercise-power",
    name: "Skills Exercise — Power",
    category: "Skills Exercise",
    description: "Power-stroking exercise prescribed for STAR 3 Skills.",
  },
  {
    key: "star-skill-exercise-quick-edges",
    name: "Skills Exercise — Quick Edges",
    category: "Skills Exercise",
    description: "Quick consecutive edges exercise prescribed for STAR 5 Skills.",
  },
  {
    key: "star-skill-exercise-bwd-slalom",
    name: "Skills Exercise — Backward Slalom",
    category: "Skills Exercise",
    description: "Backward slalom exercise prescribed for STAR 5 Skills.",
  },
  {
    key: "star-skill-exercise-fwd-change-threes",
    name: "Skills Exercise — Forward Change Threes",
    category: "Skills Exercise",
    description: "Forward change-of-edge three-turn pattern prescribed for STAR 6 Skills.",
  },
  {
    key: "star-skill-exercise-bwd-change-threes",
    name: "Skills Exercise — Backward Change Threes",
    category: "Skills Exercise",
    description: "Backward change-of-edge three-turn pattern prescribed for STAR 7 Skills.",
  },
  {
    key: "star-skill-exercise-rolling-edges",
    name: "Skills Exercise — Rolling Edges",
    category: "Skills Exercise",
    description: "Rolling-edge exercise prescribed for STAR 8 Skills.",
  },

  // ---- Field moves ----
  {
    key: "star-skill-fwd-spiral",
    name: "Forward Spiral",
    category: "Field Moves",
    description: "Glide on one foot with the free leg extended behind at or above hip level.",
  },
  {
    key: "star-skill-bwd-spiral",
    name: "Backward Spiral",
    category: "Field Moves",
    description: "Backward glide with free leg extended behind.",
  },
  {
    key: "star-skill-spiral-sequence",
    name: "Spiral Sequence",
    category: "Field Moves",
    description: "Collection of at least two spirals on different feet, uninterrupted.",
  },
  {
    key: "star-skill-inside-spread-eagle",
    name: "Inside Spread Eagle",
    category: "Field Moves",
    description: "Two-foot glide on matching inside edges, hips open.",
  },
  {
    key: "star-skill-outside-spread-eagle",
    name: "Outside Spread Eagle",
    category: "Field Moves",
    description: "Two-foot glide on matching outside edges, hips open.",
  },
  {
    key: "star-skill-ina-bauer",
    name: "Ina Bauer",
    category: "Field Moves",
    description:
      "Two-foot movement with one foot on a forward edge and the other on a matching backward edge on a parallel tracing.",
  },
  {
    key: "star-skill-fwd-one-foot-sit-glide",
    name: "Forward One-Foot Sit Glide",
    category: "Field Moves",
    description:
      "One-foot glide in a strongly bent skating leg with the free leg directed forward parallel to the ice.",
  },
  {
    key: "star-skill-bwd-one-foot-sit-glide",
    name: "Backward One-Foot Sit Glide",
    category: "Field Moves",
    description: "Backward one-foot sit glide.",
  },
  {
    key: "star-skill-y-spiral",
    name: "Y-Spiral",
    category: "Field Moves",
    description: "Spiral position with the free leg held in a Y-position to the side.",
  },
  {
    key: "star-skill-360-field-move-challenge",
    name: "360-degree Field Move Challenge",
    category: "Field Moves",
    description: "Field move executed with a full 360-degree rotation as a Gold-level challenge.",
  },
  {
    key: "star-skill-360-spiral-challenge",
    name: "360-degree Spiral Challenge",
    category: "Field Moves",
    description: "Spiral with a full 360-degree rotation; STAR 9 challenge element.",
  },

  // ---- Dance Step Elements ----
  {
    key: "star-skill-fwd-progressives",
    name: "Forward Progressives",
    category: "Dance Steps",
    description: "Step sequence where the free foot passes the skating foot before placement.",
  },
  {
    key: "star-skill-bwd-progressives",
    name: "Backward Progressives",
    category: "Dance Steps",
    description: "Backward progressive step sequence.",
  },
  {
    key: "star-skill-fwd-chasses",
    name: "Forward Chassés",
    category: "Dance Steps",
    description:
      "Two edges (outside-inside) with the free foot placed beside the skating foot, lifted parallel.",
  },
  {
    key: "star-skill-bwd-chasses",
    name: "Backward Chassés",
    category: "Dance Steps",
    description: "Backward chassé step sequence.",
  },
  {
    key: "star-skill-fwd-slide-chasses",
    name: "Forward Slide Chassés",
    category: "Dance Steps",
    description: "Forward chassés with a slide on the free foot.",
  },
  {
    key: "star-skill-fwd-outside-swing-roll",
    name: "Forward Outside Swing Roll Sequence",
    category: "Dance Steps",
    description: "Forward outside swing roll sequence with leg swing emphasis.",
  },
  {
    key: "star-skill-bwd-swing-roll",
    name: "Backward Swing Roll Sequence",
    category: "Dance Steps",
    description: "Backward swing roll sequence.",
  },
  {
    key: "star-skill-fwd-outside-cross-rolls",
    name: "Forward Outside Cross Rolls",
    category: "Dance Steps",
    description: "Forward outside cross-roll sequence.",
  },
  {
    key: "star-skill-bwd-outside-rolls",
    name: "Backward Outside Rolls",
    category: "Dance Steps",
    description: "Backward outside rolls down the rink.",
  },
  {
    key: "star-skill-fwd-inside-open-c-step",
    name: "Forward Inside Open C Steps",
    category: "Dance Steps",
    description: "Forward inside open C-step turn from one foot to the other.",
  },
  {
    key: "star-skill-fwd-cross-roll-three-turn",
    name: "Forward Outside Cross Roll + Three-Turn",
    category: "Dance Steps",
    description: "Cross roll into a three-turn combination prescribed at STAR 5B.",
  },
  {
    key: "star-skill-double-knee-bend",
    name: "Forward Outside Double Knee Bend",
    category: "Dance Steps",
    description: "Forward outside roll held with two knee bends.",
  },
  {
    key: "star-skill-ten-fox-progressive",
    name: "Ten-Fox Progressive",
    category: "Dance Steps",
    description: "Progressive step pattern from the Ten-Fox dance.",
  },

  // ---- Pattern Dances (sample — most-skated lower STAR dances) ----
  {
    key: "star-skill-dance-dutch-waltz",
    name: "Dutch Waltz",
    category: "Pattern Dance",
    description: "STAR 2a pattern dance. Skated to ¾ waltz time at the prescribed tempo.",
  },
  {
    key: "star-skill-dance-canasta-tango",
    name: "Canasta Tango",
    category: "Pattern Dance",
    description: "STAR 2b pattern dance.",
  },
  {
    key: "star-skill-dance-baby-blues",
    name: "Baby Blues",
    category: "Pattern Dance",
    description: "STAR 3a pattern dance.",
  },
  {
    key: "star-skill-dance-swing-dance",
    name: "Swing Dance",
    category: "Pattern Dance",
    description: "STAR 4a pattern dance.",
  },
  {
    key: "star-skill-dance-fiesta-tango",
    name: "Fiesta Tango",
    category: "Pattern Dance",
    description: "STAR 4b pattern dance.",
  },
  {
    key: "star-skill-dance-willow-waltz",
    name: "Willow Waltz",
    category: "Pattern Dance",
    description: "STAR 5a pattern dance.",
  },
  {
    key: "star-skill-dance-ten-fox",
    name: "Ten-Fox",
    category: "Pattern Dance",
    description: "STAR 6A pattern dance.",
  },
  {
    key: "star-skill-dance-european-waltz",
    name: "European Waltz",
    category: "Pattern Dance",
    description: "STAR 6B pattern dance.",
  },
  {
    key: "star-skill-dance-fourteenstep",
    name: "Fourteenstep",
    category: "Pattern Dance",
    description: "STAR 6C pattern dance.",
  },
  {
    key: "star-skill-dance-foxtrot",
    name: "Foxtrot",
    category: "Pattern Dance",
    description: "STAR 7A pattern dance.",
  },
  {
    key: "star-skill-dance-tango",
    name: "Tango",
    category: "Pattern Dance",
    description: "STAR 7B pattern dance.",
  },
  {
    key: "star-skill-dance-american-waltz",
    name: "American Waltz",
    category: "Pattern Dance",
    description: "STAR 7C pattern dance.",
  },
  {
    key: "star-skill-dance-killian",
    name: "Killian",
    category: "Pattern Dance",
    description: "STAR 8A pattern dance.",
  },
  {
    key: "star-skill-dance-rocker-foxtrot",
    name: "Rocker Foxtrot",
    category: "Pattern Dance",
    description: "STAR 8B pattern dance.",
  },
  {
    key: "star-skill-dance-starlight-waltz",
    name: "Starlight Waltz",
    category: "Pattern Dance",
    description: "STAR 8C pattern dance.",
  },
  {
    key: "star-skill-dance-paso-doble",
    name: "Paso Doble",
    category: "Pattern Dance",
    description: "STAR 9A pattern dance.",
  },
  {
    key: "star-skill-dance-blues",
    name: "Blues",
    category: "Pattern Dance",
    description: "STAR 9B pattern dance.",
  },
  {
    key: "star-skill-dance-silver-samba",
    name: "Silver Samba",
    category: "Pattern Dance",
    description: "STAR 9C pattern dance.",
  },
  {
    key: "star-skill-dance-cha-cha-congelado",
    name: "Cha Cha Congelado",
    category: "Pattern Dance",
    description: "STAR 10A pattern dance.",
  },
  {
    key: "star-skill-dance-westminster-waltz",
    name: "Westminster Waltz",
    category: "Pattern Dance",
    description: "STAR 10B pattern dance.",
  },
  {
    key: "star-skill-dance-quickstep",
    name: "Quickstep",
    category: "Pattern Dance",
    description: "STAR 10C pattern dance.",
  },
  {
    key: "star-skill-dance-viennese-waltz",
    name: "Viennese Waltz",
    category: "Pattern Dance",
    description: "Gold A pattern dance.",
  },
  {
    key: "star-skill-dance-argentine-tango",
    name: "Argentine Tango",
    category: "Pattern Dance",
    description: "Gold B pattern dance.",
  },
  {
    key: "star-skill-dance-gold-rhythm-dance",
    name: "Gold Rhythm Dance",
    category: "Pattern Dance",
    description: "Gold C — Gold Rhythm Dance with annual ISU-designated rhythm/theme.",
  },
  // Diamond Dance Test patterns (post-Gold; six dances, pass four to earn the Test)
  {
    key: "star-skill-dance-ravensburger-waltz",
    name: "Ravensburger Waltz",
    category: "Pattern Dance",
    description: "Diamond Dance Test pattern.",
  },
  {
    key: "star-skill-dance-tango-romantica",
    name: "Tango Romantica",
    category: "Pattern Dance",
    description: "Diamond Dance Test pattern.",
  },
  {
    key: "star-skill-dance-yankee-polka",
    name: "Yankee Polka",
    category: "Pattern Dance",
    description: "Diamond Dance Test pattern.",
  },
  {
    key: "star-skill-dance-rhumba",
    name: "Rhumba",
    category: "Pattern Dance",
    description: "Diamond Dance Test pattern.",
  },
  {
    key: "star-skill-dance-austrian-waltz",
    name: "Austrian Waltz",
    category: "Pattern Dance",
    description: "Diamond Dance Test pattern.",
  },
  {
    key: "star-skill-dance-golden-waltz",
    name: "Golden Waltz",
    category: "Pattern Dance",
    description: "Diamond Dance Test pattern.",
  },

  // ---- Artistic Program Elements ----
  {
    key: "star-skill-choreographic-step-seq",
    name: "Choreographic Step Sequence",
    category: "Artistic",
    description:
      "Choreographic step sequence connecting program elements with expressive movement.",
  },
  {
    key: "star-skill-field-moves-sequence",
    name: "Field Moves Sequence",
    category: "Artistic",
    description: "Sequence of field moves (e.g., spirals, spread eagles) executed continuously.",
  },
  {
    key: "star-skill-artistic-spin",
    name: "Artistic Spin",
    category: "Artistic",
    description: "Spin chosen for artistic expression rather than technical difficulty.",
  },

  // ---- Synchro Elements ----
  {
    key: "star-skill-synchro-linear-block",
    name: "Linear Element (Block)",
    category: "Synchro",
    description: "Synchronized linear formation in block configuration.",
  },
  {
    key: "star-skill-synchro-linear-line",
    name: "Linear Element (Line)",
    category: "Synchro",
    description: "Synchronized linear formation in line configuration.",
  },
  {
    key: "star-skill-synchro-intersection",
    name: "Intersection Element",
    category: "Synchro",
    description: "Two synchronized groups passing through each other in a crossing pattern.",
  },
  {
    key: "star-skill-synchro-rotating-circle",
    name: "Rotating Element (Circle)",
    category: "Synchro",
    description: "Synchronized rotating circle formation.",
  },
  {
    key: "star-skill-synchro-rotating-wheel",
    name: "Rotating Element (Wheel)",
    category: "Synchro",
    description: "Synchronized rotating wheel formation.",
  },
  {
    key: "star-skill-synchro-pivoting-block",
    name: "Pivoting Element (Block)",
    category: "Synchro",
    description: "Synchronized pivoting block formation.",
  },
  {
    key: "star-skill-synchro-transition",
    name: "Transition Exercise",
    category: "Synchro",
    description: "Transition movement between formations (STAR 4 synchro exercise).",
  },
  {
    key: "star-skill-synchro-moves-spiral",
    name: "Synchro Moves Element (Spiral)",
    category: "Synchro",
    description: "Synchronized spiral element.",
  },
];

// ---------------------------------------------------------------------------
// Test sheet / EvaluationTemplate catalog
// ---------------------------------------------------------------------------

interface StarTemplateDef {
  key: string;
  name: string;
  description: string;
  levelKey: string;
  /** Discipline shown to coaches when picking templates. */
  discipline:
    | "Freeskate Elements"
    | "Freeskate Program"
    | "Skills"
    | "Dance Step Elements"
    | "Pattern Dance"
    | "Artistic Program"
    | "Synchro";
  /**
   * Passing requirement encoded for the auto-award:
   *   ALL    = every required skill must pass
   *   COUNT  = must pass at least `threshold` of the required skills
   * Skate Canada generally expresses STAR passing as "X of Y silver or better"
   * which maps cleanly to COUNT.
   */
  completionType: "ALL" | "COUNT";
  threshold: number;
  /** Required skill keys (linked via EvaluationTemplateSkill with isRequired=true). */
  skillKeys: string[];
}

const STAR_TEMPLATES: StarTemplateDef[] = [
  // ===== Freeskate Elements (STAR 1-10) =====
  {
    key: "star-1-freeskate-elements",
    name: "STAR 1 Freeskate Elements",
    description: "Coach-assessed. Pass: four of five elements rated silver or better.",
    levelKey: "level-star-1",
    discipline: "Freeskate Elements",
    completionType: "COUNT",
    threshold: 4,
    skillKeys: [
      "star-skill-waltz-jump",
      "star-skill-single-salchow",
      "star-skill-single-toe-loop",
      "star-skill-fwd-upright-spin",
      "star-skill-bwd-upright-spin",
    ],
  },
  {
    key: "star-2-freeskate-elements",
    name: "STAR 2 Freeskate Elements",
    description: "Coach-assessed. Pass: five of seven elements rated silver or better.",
    levelKey: "level-star-2",
    discipline: "Freeskate Elements",
    completionType: "COUNT",
    threshold: 5,
    skillKeys: [
      "star-skill-single-salchow",
      "star-skill-single-loop",
      "star-skill-single-flip",
      "star-skill-waltz-toe-loop-combo",
      "star-skill-fwd-sit-spin",
      "star-skill-fwd-camel-spin",
      "star-skill-change-foot-upright-spin",
    ],
  },
  {
    key: "star-3-freeskate-elements",
    name: "STAR 3 Freeskate Elements",
    description: "Coach-assessed. Pass: five of seven elements rated silver or better.",
    levelKey: "level-star-3",
    discipline: "Freeskate Elements",
    completionType: "COUNT",
    threshold: 5,
    skillKeys: [
      "star-skill-single-flip",
      "star-skill-single-lutz",
      "star-skill-waltz-loop-combo",
      "star-skill-loop-loop-combo",
      "star-skill-bwd-upright-spin",
      "star-skill-bwd-sit-spin",
      "star-skill-camel-sit-combo",
    ],
  },
  {
    key: "star-4-freeskate-elements",
    name: "STAR 4 Freeskate Elements",
    description: "Coach-assessed. Pass: six of eight elements rated silver or better.",
    levelKey: "level-star-4",
    discipline: "Freeskate Elements",
    completionType: "COUNT",
    threshold: 6,
    skillKeys: [
      "star-skill-single-lutz",
      "star-skill-single-axel",
      "star-skill-flip-toe-loop-combo",
      "star-skill-loop-loop-combo",
      "star-skill-bwd-camel-spin",
      "star-skill-change-foot-sit-spin",
      "star-skill-combination-spin",
      "star-skill-flying-camel",
    ],
  },
  {
    key: "star-5-freeskate-elements",
    name: "STAR 5 Freeskate Elements",
    description: "Coach-assessed. Pass: five of seven elements rated silver or better.",
    levelKey: "level-star-5",
    discipline: "Freeskate Elements",
    completionType: "COUNT",
    threshold: 5,
    skillKeys: [
      "star-skill-single-axel",
      "star-skill-double-salchow",
      "star-skill-lutz-toe-loop-combo",
      "star-skill-fwd-sit-spin",
      "star-skill-spin-one-position",
      "star-skill-combination-spin",
      "star-skill-flying-sit",
    ],
  },
  {
    key: "star-6-freeskate-elements",
    name: "STAR 6 Freeskate Elements",
    description:
      "Evaluator or coach-assessed. Pass: four of six elements rated silver or better, including one double jump and one spin.",
    levelKey: "level-star-6",
    discipline: "Freeskate Elements",
    completionType: "COUNT",
    threshold: 4,
    skillKeys: [
      "star-skill-axel-combo",
      "star-skill-double-salchow",
      "star-skill-double-toe-loop",
      "star-skill-fwd-sit-spin",
      "star-skill-layback-spin",
      "star-skill-combination-spin-change-foot",
    ],
  },
  {
    key: "star-7-freeskate-elements",
    name: "STAR 7 Freeskate Elements",
    description:
      "Evaluator-assessed. Pass: five of seven elements rated silver or better, including two different double jumps and two spins.",
    levelKey: "level-star-7",
    discipline: "Freeskate Elements",
    completionType: "COUNT",
    threshold: 5,
    skillKeys: [
      "star-skill-double-salchow",
      "star-skill-double-toe-loop",
      "star-skill-double-loop",
      "star-skill-flying-camel",
      "star-skill-flying-sit",
      "star-skill-camel-sit-combo",
      "star-skill-change-combination-spin",
    ],
  },
  {
    key: "star-8-freeskate-elements",
    name: "STAR 8 Freeskate Elements",
    description:
      "Evaluator-assessed. Pass: six of eight elements rated silver or better, including three different double jumps and two spins.",
    levelKey: "level-star-8",
    discipline: "Freeskate Elements",
    completionType: "COUNT",
    threshold: 6,
    skillKeys: [
      "star-skill-double-salchow",
      "star-skill-double-toe-loop",
      "star-skill-double-loop",
      "star-skill-double-flip",
      "star-skill-double-lutz",
      "star-skill-double-double-combo",
      "star-skill-fwd-sit-spin",
      "star-skill-change-combination-spin",
    ],
  },
  {
    key: "star-9-freeskate-elements",
    name: "STAR 9 Freeskate Elements",
    description:
      "Evaluator-assessed. Pass: 5/7 silver or better including 3 different double jumps and 2 spins.",
    levelKey: "level-star-9",
    discipline: "Freeskate Elements",
    completionType: "COUNT",
    threshold: 5,
    skillKeys: [
      "star-skill-single-axel",
      "star-skill-double-loop",
      "star-skill-double-double-combo",
      "star-skill-spin-one-position",
      "star-skill-flying-camel",
      "star-skill-flying-sit",
      "star-skill-change-combination-spin",
    ],
  },
  {
    key: "star-10-freeskate-elements",
    name: "STAR 10 Freeskate Elements",
    description:
      "Evaluator-assessed. Pass: 7/9 silver or better including 4 different double jumps and 2 spins.",
    levelKey: "level-star-10",
    discipline: "Freeskate Elements",
    completionType: "COUNT",
    threshold: 7,
    skillKeys: [
      "star-skill-single-axel",
      "star-skill-double-salchow",
      "star-skill-double-toe-loop",
      "star-skill-double-loop",
      "star-skill-double-flip",
      "star-skill-double-lutz",
      "star-skill-double-double-combo",
      "star-skill-flying-camel",
      "star-skill-change-combination-spin",
    ],
  },

  // ===== Freeskate Programs (STAR 2-Gold) =====
  // Program assessments judge against Program Components (Composition,
  // Presentation, Skating Skills); they don't have a skill-checklist in
  // the same sense as elements. We model them with completionType=ALL and
  // an empty skill list — coaches/evaluators mark the template complete
  // after the program is performed and judged.
  {
    key: "star-2-freeskate-program",
    name: "STAR 2 Freeskate Program",
    description:
      "Mandatory program content successful and two of three Program Components (Composition, Presentation, Skating Skills) silver or better.",
    levelKey: "level-star-2",
    discipline: "Freeskate Program",
    completionType: "ALL",
    threshold: 100,
    skillKeys: [],
  },
  {
    key: "star-3-freeskate-program",
    name: "STAR 3 Freeskate Program",
    description: "Mandatory program content + two of three PCs silver or better.",
    levelKey: "level-star-3",
    discipline: "Freeskate Program",
    completionType: "ALL",
    threshold: 100,
    skillKeys: [],
  },
  {
    key: "star-4-freeskate-program",
    name: "STAR 4 Freeskate Program",
    description:
      "Mandatory program content + two of three PCs silver or better, including variety and clarity of edges/steps/turns.",
    levelKey: "level-star-4",
    discipline: "Freeskate Program",
    completionType: "ALL",
    threshold: 100,
    skillKeys: [],
  },
  {
    key: "star-5-freeskate-program",
    name: "STAR 5 Freeskate Program",
    description: "Mandatory program content + all three PCs silver or better.",
    levelKey: "level-star-5",
    discipline: "Freeskate Program",
    completionType: "ALL",
    threshold: 100,
    skillKeys: [],
  },
  {
    key: "star-6-freeskate-program",
    name: "STAR 6 Freeskate Program",
    description:
      "9 of 11 assessments silver or better: 6 elements (4 jumps incl. one double, one combination spin with change of foot) + all three PCs.",
    levelKey: "level-star-6",
    discipline: "Freeskate Program",
    completionType: "ALL",
    threshold: 100,
    skillKeys: [],
  },
  {
    key: "star-7-freeskate-program",
    name: "STAR 7 Freeskate Program",
    description:
      "7 of 9 assessments silver or better: 4 elements (2 jump elements incl. one double, one combo spin with change of foot) + all three PCs.",
    levelKey: "level-star-7",
    discipline: "Freeskate Program",
    completionType: "ALL",
    threshold: 100,
    skillKeys: [],
  },
  {
    key: "star-8-freeskate-program",
    name: "STAR 8 Freeskate Program",
    description:
      "10 of 15 assessments silver or better: 7 elements + 3 of 5 PCs incl. Expression/Projection and Variety & Clarity of edges/steps/turns.",
    levelKey: "level-star-8",
    discipline: "Freeskate Program",
    completionType: "ALL",
    threshold: 100,
    skillKeys: [],
  },
  {
    key: "star-9-freeskate-program",
    name: "STAR 9 Freeskate Program",
    description:
      "8 of 11 assessments silver or better: 4 elements + 4 of 5 PCs incl. Expression/Projection and Variety & Clarity.",
    levelKey: "level-star-9",
    discipline: "Freeskate Program",
    completionType: "ALL",
    threshold: 100,
    skillKeys: [],
  },
  {
    key: "star-10-freeskate-program",
    name: "STAR 10 Freeskate Program",
    description: "13 of 15 assessments silver or better: 8 elements + all 5 PCs.",
    levelKey: "level-star-10",
    discipline: "Freeskate Program",
    completionType: "ALL",
    threshold: 100,
    skillKeys: [],
  },
  {
    key: "gold-freeskate-program",
    name: "Gold Freeskate Program",
    description: "14 of 16 assessments silver or better: 9 elements + all 5 PCs.",
    levelKey: "level-gold",
    discipline: "Freeskate Program",
    completionType: "ALL",
    threshold: 100,
    skillKeys: [],
  },

  // ===== Skills (STAR 1-Gold) =====
  {
    key: "star-1-skills",
    name: "STAR 1 Skills",
    description: "Pass: five of six elements silver or better.",
    levelKey: "level-star-1",
    discipline: "Skills",
    completionType: "COUNT",
    threshold: 5,
    skillKeys: [
      "star-skill-fwd-outside-edges",
      "star-skill-fwd-inside-edges",
      "star-skill-fwd-three-turn-outside",
      "star-skill-fwd-inside-open-c-step",
      "star-skill-exercise-basic",
      "star-skill-fwd-spiral",
    ],
  },
  {
    key: "star-2-skills",
    name: "STAR 2 Skills",
    description: "Pass: four of five elements silver or better.",
    levelKey: "level-star-2",
    discipline: "Skills",
    completionType: "COUNT",
    threshold: 4,
    skillKeys: [
      "star-skill-bwd-outside-edges",
      "star-skill-bwd-inside-edges",
      "star-skill-bwd-three-turn-outside",
      "star-skill-bwd-three-turn-inside",
      "star-skill-one-foot-turn",
    ],
  },
  {
    key: "star-3-skills",
    name: "STAR 3 Skills",
    description: "Pass: two of three elements silver or better.",
    levelKey: "level-star-3",
    discipline: "Skills",
    completionType: "COUNT",
    threshold: 2,
    skillKeys: [
      "star-skill-exercise-power",
      "star-skill-fwd-spiral",
      "star-skill-bwd-one-foot-sit-glide",
    ],
  },
  {
    key: "star-4-skills",
    name: "STAR 4 Skills",
    description: "Pass: four of five elements silver or better.",
    levelKey: "level-star-4",
    discipline: "Skills",
    completionType: "COUNT",
    threshold: 4,
    skillKeys: [
      "star-skill-fwd-brackets",
      "star-skill-bwd-brackets",
      "star-skill-fwd-double-threes",
      "star-skill-change-of-edge",
      "star-skill-bwd-three-turn-outside",
    ],
  },
  {
    key: "star-5-skills",
    name: "STAR 5 Skills",
    description: "Pass: two of three elements silver or better.",
    levelKey: "level-star-5",
    discipline: "Skills",
    completionType: "COUNT",
    threshold: 2,
    skillKeys: [
      "star-skill-exercise-quick-edges",
      "star-skill-exercise-bwd-slalom",
      "star-skill-spiral-sequence",
    ],
  },
  {
    key: "star-6-skills",
    name: "STAR 6 Skills",
    description: "Pass: five of six elements silver or better.",
    levelKey: "level-star-6",
    discipline: "Skills",
    completionType: "COUNT",
    threshold: 5,
    skillKeys: [
      "star-skill-bwd-double-threes",
      "star-skill-fwd-rockers",
      "star-skill-bwd-rockers",
      "star-skill-fwd-counters",
      "star-skill-bwd-counters",
      "star-skill-exercise-fwd-change-threes",
    ],
  },
  {
    key: "star-7-skills",
    name: "STAR 7 Skills",
    description: "Pass: five of six elements silver or better.",
    levelKey: "level-star-7",
    discipline: "Skills",
    completionType: "COUNT",
    threshold: 5,
    skillKeys: [
      "star-skill-fwd-loops",
      "star-skill-bwd-loops",
      "star-skill-fwd-inside-s-steps",
      "star-skill-bwd-outside-s-steps",
      "star-skill-twizzles",
      "star-skill-exercise-bwd-change-threes",
    ],
  },
  {
    key: "star-8-skills",
    name: "STAR 8 Skills",
    description:
      "Pass: five of six elements silver or better. Two field moves (must be different).",
    levelKey: "level-star-8",
    discipline: "Skills",
    completionType: "COUNT",
    threshold: 5,
    skillKeys: [
      "star-skill-rocker-three-turn-seq",
      "star-skill-counter-bracket-seq",
      "star-skill-inside-spread-eagle",
      "star-skill-outside-spread-eagle",
      "star-skill-ina-bauer",
      "star-skill-exercise-rolling-edges",
    ],
  },
  {
    key: "star-9-skills",
    name: "STAR 9 Skills",
    description: "Pass: four of five elements silver or better.",
    levelKey: "level-star-9",
    discipline: "Skills",
    completionType: "COUNT",
    threshold: 4,
    skillKeys: [
      "star-skill-fwd-loops",
      "star-skill-bwd-loops",
      "star-skill-360-spiral-challenge",
      "star-skill-fwd-rockers",
      "star-skill-fwd-inside-s-steps",
    ],
  },
  {
    key: "star-10-skills",
    name: "STAR 10 Skills",
    description: "All elements silver or better. Includes a 360-degree field move challenge.",
    levelKey: "level-star-10",
    discipline: "Skills",
    completionType: "ALL",
    threshold: 100,
    skillKeys: [
      "star-skill-one-foot-turn",
      "star-skill-360-field-move-challenge",
      "star-skill-counter-bracket-seq",
      "star-skill-fwd-counters",
    ],
  },
  {
    key: "gold-skills",
    name: "Gold Skills",
    description: "Gold-level skills challenge. All elements silver or better.",
    levelKey: "level-gold",
    discipline: "Skills",
    completionType: "ALL",
    threshold: 100,
    skillKeys: [
      "star-skill-rocker-three-turn-seq",
      "star-skill-counter-bracket-seq",
      "star-skill-fwd-loops",
      "star-skill-bwd-loops",
      "star-skill-ina-bauer",
    ],
  },

  // ===== Dance Step Elements (STAR 1, 3B, 5B) =====
  {
    key: "star-1-dance-steps",
    name: "STAR 1 Dance Step Elements",
    description: "Pass: four of five elements silver or better.",
    levelKey: "level-star-1",
    discipline: "Dance Step Elements",
    completionType: "COUNT",
    threshold: 4,
    skillKeys: [
      "star-skill-fwd-progressives",
      "star-skill-fwd-chasses",
      "star-skill-fwd-slide-chasses",
      "star-skill-fwd-outside-swing-roll",
      "star-skill-fwd-outside-cross-rolls",
    ],
  },
  {
    key: "star-3b-dance-steps",
    name: "STAR 3B Dance Step Elements",
    description: "Pass: five of six elements silver or better. Accuracy must be silver or better.",
    levelKey: "level-star-3",
    discipline: "Dance Step Elements",
    completionType: "COUNT",
    threshold: 5,
    skillKeys: [
      "star-skill-bwd-progressives",
      "star-skill-bwd-chasses",
      "star-skill-bwd-swing-roll",
      "star-skill-fwd-inside-open-c-step",
      "star-skill-fwd-outside-cross-rolls",
      "star-skill-fwd-three-turn-outside",
    ],
  },
  {
    key: "star-5b-dance-steps",
    name: "STAR 5B Dance Step Elements",
    description:
      "Pass: seven of nine elements silver or better. Accuracy must be silver or better.",
    levelKey: "level-star-5",
    discipline: "Dance Step Elements",
    completionType: "COUNT",
    threshold: 7,
    skillKeys: [
      "star-skill-fwd-inside-open-c-step",
      "star-skill-double-knee-bend",
      "star-skill-fwd-progressives",
      "star-skill-bwd-progressives",
      "star-skill-ten-fox-progressive",
      "star-skill-fwd-outside-cross-rolls",
      "star-skill-fwd-cross-roll-three-turn",
      "star-skill-bwd-outside-rolls",
      "star-skill-fwd-outside-swing-roll",
    ],
  },

  // ===== Pattern Dance Assessments (sample) =====
  // Each pattern dance is its own assessment with timing + 2-of-3 criteria
  // (Accuracy / Edge Quality / Carriage-Clarity) — modeled as ALL with no
  // skill checklist, recorded as a single completion after the dance is
  // performed with a partner / shadow / solo.
  {
    key: "star-2a-dutch-waltz",
    name: "STAR 2a Dutch Waltz",
    description:
      "Pattern dance. Three of four mandatory requirements including timing, two of three full-pattern criteria silver or better.",
    levelKey: "level-star-2",
    discipline: "Pattern Dance",
    completionType: "ALL",
    threshold: 100,
    skillKeys: ["star-skill-dance-dutch-waltz"],
  },
  {
    key: "star-2b-canasta-tango",
    name: "STAR 2b Canasta Tango",
    description:
      "Pattern dance. Three of four mandatory requirements + two of three full-pattern criteria silver or better.",
    levelKey: "level-star-2",
    discipline: "Pattern Dance",
    completionType: "ALL",
    threshold: 100,
    skillKeys: ["star-skill-dance-canasta-tango"],
  },
  {
    key: "star-3a-baby-blues",
    name: "STAR 3a Baby Blues",
    description: "Pattern dance.",
    levelKey: "level-star-3",
    discipline: "Pattern Dance",
    completionType: "ALL",
    threshold: 100,
    skillKeys: ["star-skill-dance-baby-blues"],
  },
  {
    key: "star-4a-swing-dance",
    name: "STAR 4a Swing Dance",
    description: "Pattern dance.",
    levelKey: "level-star-4",
    discipline: "Pattern Dance",
    completionType: "ALL",
    threshold: 100,
    skillKeys: ["star-skill-dance-swing-dance"],
  },
  {
    key: "star-4b-fiesta-tango",
    name: "STAR 4b Fiesta Tango",
    description: "Pattern dance.",
    levelKey: "level-star-4",
    discipline: "Pattern Dance",
    completionType: "ALL",
    threshold: 100,
    skillKeys: ["star-skill-dance-fiesta-tango"],
  },
  {
    key: "star-5a-willow-waltz",
    name: "STAR 5a Willow Waltz",
    description: "Pattern dance.",
    levelKey: "level-star-5",
    discipline: "Pattern Dance",
    completionType: "ALL",
    threshold: 100,
    skillKeys: ["star-skill-dance-willow-waltz"],
  },
  // STAR 6: Ten-Fox, European Waltz, Fourteenstep
  {
    key: "star-6a-ten-fox",
    name: "STAR 6A Ten-Fox",
    description:
      "Pattern dance. Three of four mandatory requirements + two of four full-pattern criteria silver or better.",
    levelKey: "level-star-6",
    discipline: "Pattern Dance",
    completionType: "ALL",
    threshold: 100,
    skillKeys: ["star-skill-dance-ten-fox"],
  },
  {
    key: "star-6b-european-waltz",
    name: "STAR 6B European Waltz",
    description: "Pattern dance.",
    levelKey: "level-star-6",
    discipline: "Pattern Dance",
    completionType: "ALL",
    threshold: 100,
    skillKeys: ["star-skill-dance-european-waltz"],
  },
  {
    key: "star-6c-fourteenstep",
    name: "STAR 6C Fourteenstep",
    description: "Pattern dance.",
    levelKey: "level-star-6",
    discipline: "Pattern Dance",
    completionType: "ALL",
    threshold: 100,
    skillKeys: ["star-skill-dance-fourteenstep"],
  },
  // STAR 7: Foxtrot, Tango, American Waltz
  {
    key: "star-7a-foxtrot",
    name: "STAR 7A Foxtrot",
    description: "Pattern dance.",
    levelKey: "level-star-7",
    discipline: "Pattern Dance",
    completionType: "ALL",
    threshold: 100,
    skillKeys: ["star-skill-dance-foxtrot"],
  },
  {
    key: "star-7b-tango",
    name: "STAR 7B Tango",
    description: "Pattern dance.",
    levelKey: "level-star-7",
    discipline: "Pattern Dance",
    completionType: "ALL",
    threshold: 100,
    skillKeys: ["star-skill-dance-tango"],
  },
  {
    key: "star-7c-american-waltz",
    name: "STAR 7C American Waltz",
    description: "Pattern dance.",
    levelKey: "level-star-7",
    discipline: "Pattern Dance",
    completionType: "ALL",
    threshold: 100,
    skillKeys: ["star-skill-dance-american-waltz"],
  },
  // STAR 8: Killian, Rocker Foxtrot, Starlight Waltz
  {
    key: "star-8a-killian",
    name: "STAR 8A Killian",
    description:
      "Pattern dance. Three of three mandatory requirements + three of four full-pattern criteria silver or better.",
    levelKey: "level-star-8",
    discipline: "Pattern Dance",
    completionType: "ALL",
    threshold: 100,
    skillKeys: ["star-skill-dance-killian"],
  },
  {
    key: "star-8b-rocker-foxtrot",
    name: "STAR 8B Rocker Foxtrot",
    description:
      "Pattern dance. Three of four mandatory requirements + three of four full-pattern criteria silver or better.",
    levelKey: "level-star-8",
    discipline: "Pattern Dance",
    completionType: "ALL",
    threshold: 100,
    skillKeys: ["star-skill-dance-rocker-foxtrot"],
  },
  {
    key: "star-8c-starlight-waltz",
    name: "STAR 8C Starlight Waltz",
    description: "Pattern dance.",
    levelKey: "level-star-8",
    discipline: "Pattern Dance",
    completionType: "ALL",
    threshold: 100,
    skillKeys: ["star-skill-dance-starlight-waltz"],
  },
  // STAR 9: Paso Doble, Blues, Silver Samba (skater must complete 2 of 3)
  {
    key: "star-9a-paso-doble",
    name: "STAR 9A Paso Doble",
    description:
      "Pattern dance. All mandatory requirements + all four full-pattern criteria silver or better.",
    levelKey: "level-star-9",
    discipline: "Pattern Dance",
    completionType: "ALL",
    threshold: 100,
    skillKeys: ["star-skill-dance-paso-doble"],
  },
  {
    key: "star-9b-blues",
    name: "STAR 9B Blues",
    description: "Pattern dance.",
    levelKey: "level-star-9",
    discipline: "Pattern Dance",
    completionType: "ALL",
    threshold: 100,
    skillKeys: ["star-skill-dance-blues"],
  },
  {
    key: "star-9c-silver-samba",
    name: "STAR 9C Silver Samba",
    description: "Pattern dance.",
    levelKey: "level-star-9",
    discipline: "Pattern Dance",
    completionType: "ALL",
    threshold: 100,
    skillKeys: ["star-skill-dance-silver-samba"],
  },
  // STAR 10: Cha Cha Congelado, Westminster Waltz, Quickstep (2 of 3)
  {
    key: "star-10a-cha-cha-congelado",
    name: "STAR 10A Cha Cha Congelado",
    description: "Pattern dance.",
    levelKey: "level-star-10",
    discipline: "Pattern Dance",
    completionType: "ALL",
    threshold: 100,
    skillKeys: ["star-skill-dance-cha-cha-congelado"],
  },
  {
    key: "star-10b-westminster-waltz",
    name: "STAR 10B Westminster Waltz",
    description: "Pattern dance.",
    levelKey: "level-star-10",
    discipline: "Pattern Dance",
    completionType: "ALL",
    threshold: 100,
    skillKeys: ["star-skill-dance-westminster-waltz"],
  },
  {
    key: "star-10c-quickstep",
    name: "STAR 10C Quickstep",
    description: "Pattern dance.",
    levelKey: "level-star-10",
    discipline: "Pattern Dance",
    completionType: "ALL",
    threshold: 100,
    skillKeys: ["star-skill-dance-quickstep"],
  },
  // Gold: Viennese Waltz, Argentine Tango, Gold Rhythm Dance (2 of 3)
  {
    key: "gold-a-viennese-waltz",
    name: "Gold A Viennese Waltz",
    description: "Pattern dance.",
    levelKey: "level-gold",
    discipline: "Pattern Dance",
    completionType: "ALL",
    threshold: 100,
    skillKeys: ["star-skill-dance-viennese-waltz"],
  },
  {
    key: "gold-b-argentine-tango",
    name: "Gold B Argentine Tango",
    description: "Pattern dance.",
    levelKey: "level-gold",
    discipline: "Pattern Dance",
    completionType: "ALL",
    threshold: 100,
    skillKeys: ["star-skill-dance-argentine-tango"],
  },
  {
    key: "gold-c-rhythm-dance",
    name: "Gold C Gold Rhythm Dance",
    description: "Gold Rhythm Dance with annual ISU-designated rhythm/theme.",
    levelKey: "level-gold",
    discipline: "Pattern Dance",
    completionType: "ALL",
    threshold: 100,
    skillKeys: ["star-skill-dance-gold-rhythm-dance"],
  },
  // Diamond Dance Test patterns (post-Gold; pass 4 of 6 to earn the Test)
  {
    key: "diamond-ravensburger-waltz",
    name: "Diamond — Ravensburger Waltz",
    description:
      "Diamond Dance Test pattern. Satisfactory or better in all six criteria (or all except unison if solo). Pass four of the six Diamond dances to earn the Diamond Dance Test.",
    levelKey: "level-gold",
    discipline: "Pattern Dance",
    completionType: "ALL",
    threshold: 100,
    skillKeys: ["star-skill-dance-ravensburger-waltz"],
  },
  {
    key: "diamond-tango-romantica",
    name: "Diamond — Tango Romantica",
    description: "Diamond Dance Test pattern.",
    levelKey: "level-gold",
    discipline: "Pattern Dance",
    completionType: "ALL",
    threshold: 100,
    skillKeys: ["star-skill-dance-tango-romantica"],
  },
  {
    key: "diamond-yankee-polka",
    name: "Diamond — Yankee Polka",
    description: "Diamond Dance Test pattern.",
    levelKey: "level-gold",
    discipline: "Pattern Dance",
    completionType: "ALL",
    threshold: 100,
    skillKeys: ["star-skill-dance-yankee-polka"],
  },
  {
    key: "diamond-rhumba",
    name: "Diamond — Rhumba",
    description: "Diamond Dance Test pattern.",
    levelKey: "level-gold",
    discipline: "Pattern Dance",
    completionType: "ALL",
    threshold: 100,
    skillKeys: ["star-skill-dance-rhumba"],
  },
  {
    key: "diamond-austrian-waltz",
    name: "Diamond — Austrian Waltz",
    description: "Diamond Dance Test pattern.",
    levelKey: "level-gold",
    discipline: "Pattern Dance",
    completionType: "ALL",
    threshold: 100,
    skillKeys: ["star-skill-dance-austrian-waltz"],
  },
  {
    key: "diamond-golden-waltz",
    name: "Diamond — Golden Waltz",
    description: "Diamond Dance Test pattern.",
    levelKey: "level-gold",
    discipline: "Pattern Dance",
    completionType: "ALL",
    threshold: 100,
    skillKeys: ["star-skill-dance-golden-waltz"],
  },

  // ===== Artistic Programs (STAR 5, 7, 9, Gold) =====
  {
    key: "star-5-artistic",
    name: "STAR 5 Artistic Program",
    description:
      "Max 2:10 program. Required: choreographic step sequence, field moves or spiral sequence, artistic spin. Pass: 2 of 3 content + 2 of 3 PCs silver or better.",
    levelKey: "level-star-5",
    discipline: "Artistic Program",
    completionType: "COUNT",
    threshold: 2,
    skillKeys: [
      "star-skill-choreographic-step-seq",
      "star-skill-field-moves-sequence",
      "star-skill-artistic-spin",
    ],
  },
  {
    key: "star-7-artistic",
    name: "STAR 7 Artistic Program",
    description:
      "Max 2:10 program. Pass: 2 of 3 content + 2 of 3 PCs silver or better including Variety/Clarity and Expression.",
    levelKey: "level-star-7",
    discipline: "Artistic Program",
    completionType: "COUNT",
    threshold: 2,
    skillKeys: [
      "star-skill-choreographic-step-seq",
      "star-skill-field-moves-sequence",
      "star-skill-artistic-spin",
    ],
  },
  {
    key: "star-9-artistic",
    name: "STAR 9 Artistic Program",
    description: "Max 2:10 program. Pass: 2 of 3 content + 4 of 5 PCs silver or better.",
    levelKey: "level-star-9",
    discipline: "Artistic Program",
    completionType: "COUNT",
    threshold: 2,
    skillKeys: [
      "star-skill-choreographic-step-seq",
      "star-skill-field-moves-sequence",
      "star-skill-artistic-spin",
    ],
  },
  {
    key: "gold-artistic",
    name: "Gold Artistic Program",
    description: "Max 2:40 program. Pass: 2 of 3 content + all 5 PCs silver or better.",
    levelKey: "level-gold",
    discipline: "Artistic Program",
    completionType: "COUNT",
    threshold: 2,
    skillKeys: [
      "star-skill-choreographic-step-seq",
      "star-skill-field-moves-sequence",
      "star-skill-artistic-spin",
    ],
  },

  // ===== Synchro (STAR 2, 3, 4) =====
  {
    key: "star-2-synchro",
    name: "STAR 2 Synchro",
    description: "Three of four elements silver or better. Performed by 6-12 skaters.",
    levelKey: "level-star-2",
    discipline: "Synchro",
    completionType: "COUNT",
    threshold: 3,
    skillKeys: [
      "star-skill-synchro-linear-block",
      "star-skill-synchro-linear-line",
      "star-skill-synchro-intersection",
      "star-skill-synchro-rotating-circle",
    ],
  },
  {
    key: "star-3-synchro",
    name: "STAR 3 Synchro",
    description: "Four of five elements silver or better.",
    levelKey: "level-star-3",
    discipline: "Synchro",
    completionType: "COUNT",
    threshold: 4,
    skillKeys: [
      "star-skill-synchro-pivoting-block",
      "star-skill-synchro-linear-line",
      "star-skill-synchro-intersection",
      "star-skill-synchro-rotating-circle",
      "star-skill-synchro-rotating-wheel",
    ],
  },
  {
    key: "star-4-synchro",
    name: "STAR 4 Synchro",
    description: "Three of four elements silver or better.",
    levelKey: "level-star-4",
    discipline: "Synchro",
    completionType: "COUNT",
    threshold: 3,
    skillKeys: [
      "star-skill-synchro-transition",
      "star-skill-synchro-intersection",
      "star-skill-synchro-moves-spiral",
      "star-skill-synchro-rotating-wheel",
    ],
  },
];

// ---------------------------------------------------------------------------
// Seeder
// ---------------------------------------------------------------------------

export interface StarAssessmentSeedResult {
  skillsCreated: number;
  skillsReused: number;
  templatesCreated: number;
  achievementsCreated: number;
  templateSkillLinks: number;
}

export async function seedStarAssessments(
  prisma: PrismaClient,
  organizationId: string
): Promise<StarAssessmentSeedResult> {
  let skillsCreated = 0;
  let skillsReused = 0;
  let templatesCreated = 0;
  let achievementsCreated = 0;
  let templateSkillLinks = 0;

  // ---- 1. Skills (deduped by name within the org so the catalog from
  //         canskate-ribbons.ts / skate-seed.ts isn't duplicated) ----
  const existingSkills = await prisma.skill.findMany({
    where: {
      organizationId,
      name: { in: STAR_SKILLS.map((s) => s.name) },
    },
    select: { id: true, name: true },
  });
  const skillIdByName = new Map(existingSkills.map((s) => [s.name, s.id]));

  // Map from our internal key to the resolved (existing or newly-created) Skill ID
  const skillIdByKey = new Map<string, string>();

  for (const skill of STAR_SKILLS) {
    const existingId = skillIdByName.get(skill.name);
    if (existingId) {
      skillIdByKey.set(skill.key, existingId);
      skillsReused++;
      continue;
    }
    const id = `${organizationId}-${skill.key}`;
    const created = await prisma.skill.create({
      data: {
        id,
        organizationId,
        name: skill.name,
        category: skill.category,
        description: skill.description,
      },
    });
    skillIdByKey.set(skill.key, created.id);
    skillIdByName.set(skill.name, created.id);
    skillsCreated++;
  }

  // ---- 2. Look up Level IDs by key (matches skate-seed.ts) ----
  const levels = await prisma.level.findMany({
    where: { organizationId },
    select: { id: true, name: true },
  });
  // skate-seed.ts uses names like "STAR 1", "STAR 2", ..., "Gold"
  const levelKeyToName: Record<string, string> = {
    "level-star-1": "STAR 1",
    "level-star-2": "STAR 2",
    "level-star-3": "STAR 3",
    "level-star-4": "STAR 4",
    "level-star-5": "STAR 5",
    "level-star-6": "STAR 6",
    "level-star-7": "STAR 7",
    "level-star-8": "STAR 8",
    "level-star-9": "STAR 9",
    "level-star-10": "STAR 10",
    "level-gold": "Gold",
  };
  const levelIdByKey = new Map<string, string>();
  for (const [key, name] of Object.entries(levelKeyToName)) {
    const lvl = levels.find((l) => l.name === name);
    if (lvl) levelIdByKey.set(key, lvl.id);
  }

  // ---- 3. EvaluationTemplate + Achievement + ETS links per template ----
  for (const tmpl of STAR_TEMPLATES) {
    const templateId = `${organizationId}-star-tmpl-${tmpl.key}`;
    const achievementId = `${organizationId}-star-ach-${tmpl.key}`;
    const levelId = levelIdByKey.get(tmpl.levelKey) ?? null;

    const existing = await prisma.evaluationTemplate.findUnique({
      where: { id: templateId },
      select: { id: true },
    });

    if (!existing) {
      const linkedSkillIds = tmpl.skillKeys
        .map((k) => skillIdByKey.get(k))
        .filter((id): id is string => Boolean(id));

      await prisma.evaluationTemplate.create({
        data: {
          id: templateId,
          organizationId,
          name: tmpl.name,
          description: tmpl.description,
          levelId,
          minAge: null,
          maxAge: null,
          scoringType: "PASS_FAIL",
          pointScaleMin: 1,
          pointScaleMax: 10,
          pointScalePassThreshold: 7,
          completionType: tmpl.completionType,
          completionThreshold: tmpl.threshold,
          autoSyncEnabled: false,
          autoSyncLevels: [],
          autoSyncCategories: [],
          skills: {
            create: linkedSkillIds.map((skillId, index) => ({
              skillId,
              order: index,
              isRequired: true,
            })),
          },
        },
      });
      templateSkillLinks += linkedSkillIds.length;
      templatesCreated++;
    }

    await prisma.achievement.upsert({
      where: { id: achievementId },
      update: {},
      create: {
        id: achievementId,
        organizationId,
        templateId,
        name: tmpl.name.replace("STAR ", "STAR ") + " — Pass",
        description: `Earn the ${tmpl.name} test pass by meeting the per-element passing standard.`,
      },
    });
    achievementsCreated++;
  }

  return {
    skillsCreated,
    skillsReused,
    templatesCreated,
    achievementsCreated,
    templateSkillLinks,
  };
}

export const STAR_ASSESSMENT_COUNTS = {
  skills: STAR_SKILLS.length,
  templates: STAR_TEMPLATES.length,
};
