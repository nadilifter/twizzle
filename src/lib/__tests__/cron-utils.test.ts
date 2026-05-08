import { readFileSync } from "fs";
import { join } from "path";
import { describe, it, expect } from "vitest";
import { CRON_SCHEDULES } from "@/lib/cron-utils";

// Guards against drift between vercel.json (Vercel's source of truth for
// scheduling) and CRON_SCHEDULES (the crontab passed to Sentry on each
// in_progress check-in). If these disagree, Sentry monitors get the wrong
// cadence and we either over- or under-alert on missed runs.
describe("CRON_SCHEDULES", () => {
  const vercelConfig = JSON.parse(
    readFileSync(join(__dirname, "..", "..", "..", "vercel.json"), "utf8")
  ) as { crons: Array<{ path: string; schedule: string }> };

  it("has an entry for every cron declared in vercel.json", () => {
    const vercelCronNames = vercelConfig.crons.map((c) => c.path.replace(/^\/api\/cron\//, ""));
    for (const name of vercelCronNames) {
      expect(CRON_SCHEDULES, `missing entry for ${name}`).toHaveProperty(name);
    }
  });

  it("has no entries that aren't in vercel.json", () => {
    const vercelCronNames = new Set(
      vercelConfig.crons.map((c) => c.path.replace(/^\/api\/cron\//, ""))
    );
    for (const name of Object.keys(CRON_SCHEDULES)) {
      expect(vercelCronNames.has(name), `${name} is in CRON_SCHEDULES but not vercel.json`).toBe(
        true
      );
    }
  });

  it("matches vercel.json crontab strings exactly", () => {
    for (const cron of vercelConfig.crons) {
      const name = cron.path.replace(/^\/api\/cron\//, "");
      expect(CRON_SCHEDULES[name], `crontab mismatch for ${name}`).toBe(cron.schedule);
    }
  });
});
