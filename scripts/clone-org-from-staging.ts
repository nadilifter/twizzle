/**
 * Clone Organization from Staging
 * ================================
 *
 * Last reviewed: 2026-03-29
 *
 * PURPOSE
 * -------
 * Copies a single organization and ALL related data from the staging database
 * to your local database. The local copy is overwritten if it already exists.
 * Staging data is left intact.
 *
 * USAGE
 * -----
 *   STAGING_DB_PASSWORD="<password>" pnpm clone-org <slug>
 *
 * PREREQUISITES
 * -------------
 * - SSH config entry for 'uplifter-staging' (see scripts/deploy-staging.sh)
 * - Local PostgreSQL running on port 5434 (docker-compose.yml)
 * - STAGING_DB_PASSWORD env var set to the staging Postgres password
 *
 * HOW IT WORKS
 * ------------
 * 1. Opens an SSH tunnel to the staging Postgres container
 * 2. Dynamically discovers all tables with an organizationId column
 * 3. Walks the FK graph to find child tables without organizationId
 * 4. Deletes the local org (cascade removes all children)
 * 5. Disables FK triggers, copies all data table by table, re-enables
 *
 * SAFETY
 * ------
 * - Only modifies the LOCAL database. Staging is read-only.
 * - Will not run if DATABASE_URL looks like production.
 */

import { Client } from "pg";
import { spawn, execSync, ChildProcess } from "child_process";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const SSH_HOST = "uplifter-staging";
const STAGING_DB_CONTAINER = "uplifter-postgres";
const STAGING_DB_PORT = 5432;
const TUNNEL_LOCAL_PORT = 15432;
const STAGING_DB_USER = "uplifter";
const STAGING_DB_NAME = "uplifter";

const LOCAL_DB_URL =
  process.env.DATABASE_URL ||
  "postgresql://postgres:postgres@localhost:5434/leapfrog?schema=public";

// Tables that hold global identity records shared across orgs.
// These are upserted (ON CONFLICT DO NOTHING) rather than overwritten.
const UPSERT_TABLES = new Set(["User", "Athlete"]);

// Global reference tables that org-scoped rows may FK into.
// When a local record already exists (matched by uniqueKey) but has a different
// ID than staging, we remap the FK in the child table to the local ID rather
// than inserting a duplicate.
const GLOBAL_PARENT_TABLES: Array<{
  table: string;
  uniqueKey: string;
  referencedBy: { table: string; fkColumn: string };
}> = [
  {
    table: "SubscriptionPlan",
    uniqueKey: "slug",
    referencedBy: { table: "OrganizationSubscription", fkColumn: "planId" },
  },
  {
    table: "Sport",
    uniqueKey: "slug",
    referencedBy: { table: "OrganizationSport", fkColumn: "sportId" },
  },
];

// Tables to never copy (internal Prisma/seed data, not org-related).
const SKIP_TABLES = new Set(["_prisma_migrations", "ReservedDomain"]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const BLUE = "\x1b[34m";
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";

function log(msg: string) {
  console.log(`${GREEN}[CLONE]${RESET} ${msg}`);
}
function logWarn(msg: string) {
  console.log(`${YELLOW}[WARN]${RESET} ${msg}`);
}
function logError(msg: string) {
  console.error(`${RED}[ERROR]${RESET} ${msg}`);
}
function logStep(msg: string) {
  console.log(`${BLUE}[STEP]${RESET} ${msg}`);
}
function logDim(msg: string) {
  console.log(`${DIM}       ${msg}${RESET}`);
}

/**
 * Resolve the Docker container's IP on the staging host.
 * The container name isn't resolvable from the host level — only within
 * the Docker network — so we inspect the container to get its bridge IP.
 */
function resolveContainerIp(): string {
  const cmd = `ssh -o ConnectTimeout=5 ${SSH_HOST} "docker inspect ${STAGING_DB_CONTAINER} --format '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}'"`;
  const ip = execSync(cmd, { encoding: "utf-8" }).trim();
  if (!ip) {
    throw new Error(
      `Could not resolve IP for Docker container '${STAGING_DB_CONTAINER}' on ${SSH_HOST}`
    );
  }
  return ip;
}

/**
 * Open an SSH tunnel and wait for it to be connectable.
 */
function openTunnel(containerIp: string): Promise<ChildProcess> {
  return new Promise((resolve, reject) => {
    const tunnel = spawn(
      "ssh",
      [
        "-N",
        "-L",
        `${TUNNEL_LOCAL_PORT}:${containerIp}:${STAGING_DB_PORT}`,
        SSH_HOST,
        "-o",
        "StrictHostKeyChecking=no",
        "-o",
        "ExitOnForwardFailure=yes",
      ],
      { stdio: "pipe" }
    );

    tunnel.on("error", (err) => reject(new Error(`SSH tunnel failed to start: ${err.message}`)));

    let stderrOutput = "";
    tunnel.stderr?.on("data", (data: Buffer) => {
      stderrOutput += data.toString();
    });

    tunnel.on("close", (code) => {
      if (code !== null && code !== 0) {
        reject(new Error(`SSH tunnel exited with code ${code}. stderr: ${stderrOutput}`));
      }
    });

    // Poll until the tunnel is accepting connections
    let attempts = 0;
    const maxAttempts = 30;
    const interval = setInterval(async () => {
      attempts++;
      try {
        const probe = new Client({
          host: "localhost",
          port: TUNNEL_LOCAL_PORT,
          user: STAGING_DB_USER,
          password: process.env.STAGING_DB_PASSWORD,
          database: STAGING_DB_NAME,
          connectionTimeoutMillis: 2000,
        });
        await probe.connect();
        await probe.end();
        clearInterval(interval);
        resolve(tunnel);
      } catch {
        if (attempts >= maxAttempts) {
          clearInterval(interval);
          tunnel.kill();
          reject(new Error(`SSH tunnel did not become ready after ${maxAttempts} attempts`));
        }
      }
    }, 1000);
  });
}

/**
 * Query information_schema to find all public tables that have an
 * "organizationId" column.
 */
async function getOrgScopedTables(client: Client): Promise<string[]> {
  const res = await client.query(`
    SELECT table_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND column_name = 'organizationId'
    ORDER BY table_name
  `);
  return res.rows.map((r: { table_name: string }) => r.table_name);
}

interface FkEdge {
  childTable: string;
  childColumn: string;
  parentTable: string;
  parentColumn: string;
}

/**
 * Build the full FK dependency graph for the public schema.
 * Returns edges: child -> parent.
 */
async function getFkGraph(client: Client): Promise<FkEdge[]> {
  const res = await client.query(`
    SELECT
      tc.table_name   AS child_table,
      kcu.column_name AS child_column,
      ccu.table_name  AS parent_table,
      ccu.column_name AS parent_column
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
     AND tc.table_schema   = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name
     AND ccu.table_schema    = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema    = 'public'
  `);
  return res.rows.map(
    (r: {
      child_table: string;
      child_column: string;
      parent_table: string;
      parent_column: string;
    }) => ({
      childTable: r.child_table,
      childColumn: r.child_column,
      parentTable: r.parent_table,
      parentColumn: r.parent_column,
    })
  );
}

/**
 * BFS from org-scoped tables outward through FK edges to discover child tables
 * that don't have organizationId but belong to the org through a parent FK.
 *
 * Returns a list of { table, fkColumn, parentTable, parentColumn } for each
 * discovered child table, in BFS order (parents before children).
 */
function discoverChildTables(
  orgScopedTables: Set<string>,
  fkEdges: FkEdge[]
): Array<{
  table: string;
  fkColumn: string;
  parentTable: string;
  parentColumn: string;
}> {
  // Build child -> parent index grouped by child table
  const childToParentEdges = new Map<string, FkEdge[]>();
  for (const edge of fkEdges) {
    const list = childToParentEdges.get(edge.childTable) || [];
    list.push(edge);
    childToParentEdges.set(edge.childTable, list);
  }

  // Build parent -> children index
  const parentToChildren = new Map<string, FkEdge[]>();
  for (const edge of fkEdges) {
    const list = parentToChildren.get(edge.parentTable) || [];
    list.push(edge);
    parentToChildren.set(edge.parentTable, list);
  }

  const visited = new Set<string>([...orgScopedTables, "Organization"]);
  const result: Array<{
    table: string;
    fkColumn: string;
    parentTable: string;
    parentColumn: string;
  }> = [];

  // BFS: start from all org-scoped tables + Organization
  const queue = [...visited];

  while (queue.length > 0) {
    const parentTable = queue.shift()!;
    const children = parentToChildren.get(parentTable) || [];

    for (const edge of children) {
      if (visited.has(edge.childTable)) continue;
      if (SKIP_TABLES.has(edge.childTable)) continue;
      if (UPSERT_TABLES.has(edge.childTable)) continue;
      if (orgScopedTables.has(edge.childTable)) continue;

      visited.add(edge.childTable);
      result.push({
        table: edge.childTable,
        fkColumn: edge.childColumn,
        parentTable: edge.parentTable,
        parentColumn: edge.parentColumn,
      });
      queue.push(edge.childTable);
    }
  }

  return result;
}

/**
 * Get the set of column names that are json or jsonb type for a table.
 */
async function getJsonColumns(client: Client, table: string): Promise<Set<string>> {
  const res = await client.query(
    `
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = $1
      AND data_type IN ('json', 'jsonb')
  `,
    [table]
  );
  return new Set(res.rows.map((r: { column_name: string }) => r.column_name));
}

/**
 * Copy rows from staging to local for a given table/filter.
 * Returns the number of rows copied.
 */
async function copyRows(
  staging: Client,
  local: Client,
  table: string,
  whereClause: string,
  whereParams: any[],
  upsert: boolean = false
): Promise<number> {
  const rows = await staging.query(`SELECT * FROM "${table}" WHERE ${whereClause}`, whereParams);

  if (rows.rows.length === 0) return 0;

  // Identify JSON/JSONB columns so we can re-serialize them.
  // Native PG arrays (text[], int[]) are left as-is — node-postgres handles them.
  const jsonCols = await getJsonColumns(staging, table);

  const columns = Object.keys(rows.rows[0]);
  const quotedCols = columns.map((c) => `"${c}"`).join(", ");

  // Batch insert in chunks of 100 rows
  const chunkSize = 100;
  let total = 0;

  for (let i = 0; i < rows.rows.length; i += chunkSize) {
    const chunk = rows.rows.slice(i, i + chunkSize);
    const valuePlaceholders: string[] = [];
    const allValues: any[] = [];

    for (let rowIdx = 0; rowIdx < chunk.length; rowIdx++) {
      const row = chunk[rowIdx];
      const placeholders = columns.map((_, colIdx) => `$${rowIdx * columns.length + colIdx + 1}`);
      valuePlaceholders.push(`(${placeholders.join(", ")})`);

      for (const col of columns) {
        const val = row[col];
        if (val !== null && jsonCols.has(col) && typeof val === "object") {
          allValues.push(JSON.stringify(val));
        } else {
          allValues.push(val);
        }
      }
    }

    const conflictClause = upsert ? " ON CONFLICT DO NOTHING" : "";

    await local.query(
      `INSERT INTO "${table}" (${quotedCols}) VALUES ${valuePlaceholders.join(
        ", "
      )}${conflictClause}`,
      allValues
    );

    total += chunk.length;
  }

  return total;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const slug = process.argv[2];
  if (!slug || slug.startsWith("-")) {
    console.error("Usage: pnpm clone-org <slug>");
    console.error("Example: STAGING_DB_PASSWORD=secret pnpm clone-org discover-circus");
    process.exit(1);
  }

  if (!process.env.STAGING_DB_PASSWORD) {
    logError("STAGING_DB_PASSWORD env var is required.");
    logDim("Example: STAGING_DB_PASSWORD=secret pnpm clone-org " + slug);
    process.exit(1);
  }

  // Safety: refuse if local DB looks like production
  const localUrl = LOCAL_DB_URL;
  if (localUrl.includes("prod") || localUrl.includes("uplifterinc.com")) {
    logError("DATABASE_URL looks like a production database. This script only targets local.");
    process.exit(1);
  }

  // Step 1: Resolve container IP and open SSH tunnel
  logStep("Resolving staging Postgres container IP...");
  let containerIp: string;
  try {
    containerIp = resolveContainerIp();
    log(`Container IP: ${containerIp}`);
  } catch (err: any) {
    logError(err.message);
    process.exit(1);
  }

  logStep("Opening SSH tunnel to staging...");
  let tunnel: ChildProcess | null = null;
  try {
    tunnel = await openTunnel(containerIp);
  } catch (err: any) {
    logError(err.message);
    logDim("Make sure your SSH config has an entry for 'uplifter-staging':");
    logDim("  Host uplifter-staging");
    logDim("    HostName 54.92.161.196");
    logDim("    User ec2-user");
    logDim("    IdentityFile ~/.ssh/uplifter-staging.pem");
    process.exit(1);
  }
  log("SSH tunnel established on localhost:" + TUNNEL_LOCAL_PORT);

  // Step 2: Connect to both databases
  const staging = new Client({
    host: "localhost",
    port: TUNNEL_LOCAL_PORT,
    user: STAGING_DB_USER,
    password: process.env.STAGING_DB_PASSWORD,
    database: STAGING_DB_NAME,
  });

  const local = new Client({ connectionString: localUrl });

  try {
    await staging.connect();
    await local.connect();
    log("Connected to staging and local databases");

    // Step 3: Find org on staging
    logStep(`Looking up organization "${slug}" on staging...`);
    const orgResult = await staging.query('SELECT * FROM "Organization" WHERE "slug" = $1', [slug]);

    if (orgResult.rows.length === 0) {
      logError(`Organization not found on staging with slug: ${slug}`);
      process.exit(1);
    }

    const org = orgResult.rows[0];
    const orgId: string = org.id;
    log(`Found: "${org.name}" (id: ${orgId})`);

    // Step 4: Discover tables
    logStep("Discovering organization-scoped tables...");
    const orgScopedTableNames = await getOrgScopedTables(staging);
    const orgScopedSet = new Set(orgScopedTableNames);
    // Remove Organization itself — handled separately
    orgScopedSet.delete("Organization");
    log(`Found ${orgScopedSet.size} tables with organizationId column`);

    logStep("Building FK dependency graph...");
    const fkEdges = await getFkGraph(staging);
    const childTables = discoverChildTables(orgScopedSet, fkEdges);
    log(`Discovered ${childTables.length} additional child tables via FK graph`);

    // Step 5: Collect User and Athlete IDs to upsert
    logStep("Collecting User and Athlete IDs...");

    const userIdsResult = await staging.query(
      'SELECT DISTINCT "userId" FROM "OrganizationMember" WHERE "organizationId" = $1',
      [orgId]
    );
    const userIds: string[] = userIdsResult.rows
      .map((r: { userId: string }) => r.userId)
      .filter(Boolean);

    const athleteIdsResult = await staging.query(
      'SELECT DISTINCT "athleteId" FROM "OrganizationAthlete" WHERE "organizationId" = $1',
      [orgId]
    );
    const athleteIds: string[] = athleteIdsResult.rows
      .map((r: { athleteId: string }) => r.athleteId)
      .filter(Boolean);

    log(`Users to upsert: ${userIds.length}, Athletes to upsert: ${athleteIds.length}`);

    // Step 6: Delete existing local org (cascade)
    logStep("Deleting existing local organization (if any)...");
    const deleteResult = await local.query('DELETE FROM "Organization" WHERE "slug" = $1', [slug]);
    if ((deleteResult.rowCount ?? 0) > 0) {
      log("Deleted existing local organization and all cascaded data");
    } else {
      log("No existing local organization found — clean insert");
    }

    // Step 7: Disable FK triggers for bulk insert
    await local.query("SET session_replication_role = 'replica'");

    const summary: Array<{ table: string; rows: number }> = [];

    // Step 8: Copy Organization record
    logStep("Copying Organization record...");
    const orgCols = Object.keys(org);
    const orgQuotedCols = orgCols.map((c) => `"${c}"`).join(", ");
    const orgPlaceholders = orgCols.map((_, i) => `$${i + 1}`).join(", ");
    const orgValues = orgCols.map((c) => org[c]);

    await local.query(
      `INSERT INTO "Organization" (${orgQuotedCols}) VALUES (${orgPlaceholders})`,
      orgValues
    );
    summary.push({ table: "Organization", rows: 1 });

    // Step 9: Upsert Users
    if (userIds.length > 0) {
      logStep(`Upserting ${userIds.length} User records...`);
      const placeholders = userIds.map((_, i) => `$${i + 1}`).join(", ");
      const count = await copyRows(
        staging,
        local,
        "User",
        `"id" IN (${placeholders})`,
        userIds,
        true
      );
      summary.push({ table: "User (upsert)", rows: count });
    }

    // Step 10: Upsert Athletes
    if (athleteIds.length > 0) {
      logStep(`Upserting ${athleteIds.length} Athlete records...`);
      const placeholders = athleteIds.map((_, i) => `$${i + 1}`).join(", ");
      const count = await copyRows(
        staging,
        local,
        "Athlete",
        `"id" IN (${placeholders})`,
        athleteIds,
        true
      );
      summary.push({ table: "Athlete (upsert)", rows: count });
    }

    // Step 11: Pre-resolve global reference records (SubscriptionPlan, Sport, etc.)
    // Build a remap table: staging ID -> local ID for records that already exist
    // locally with the same unique key but a different ID. Insert missing records.
    // The actual FK remapping happens AFTER org-scoped tables are copied (step 13).
    logStep("Resolving referenced global records...");
    const fkRemaps: Array<{
      childTable: string;
      fkColumn: string;
      stagingId: string;
      localId: string;
    }> = [];

    for (const gp of GLOBAL_PARENT_TABLES) {
      const refResult = await staging.query(
        `SELECT DISTINCT "${gp.referencedBy.fkColumn}" FROM "${gp.referencedBy.table}" WHERE "organizationId" = $1`,
        [orgId]
      );
      const stagingFkIds: string[] = refResult.rows
        .map((r: any) => r[gp.referencedBy.fkColumn])
        .filter(Boolean);

      if (stagingFkIds.length === 0) continue;

      const placeholders = stagingFkIds.map((_, i) => `$${i + 1}`).join(", ");
      const stagingRecords = await staging.query(
        `SELECT * FROM "${gp.table}" WHERE "id" IN (${placeholders})`,
        stagingFkIds
      );

      for (const stagingRow of stagingRecords.rows) {
        const uniqueVal = stagingRow[gp.uniqueKey];
        const localMatch = await local.query(
          `SELECT "id" FROM "${gp.table}" WHERE "${gp.uniqueKey}" = $1`,
          [uniqueVal]
        );

        if (localMatch.rows.length > 0) {
          const localId = localMatch.rows[0].id;
          if (localId !== stagingRow.id) {
            fkRemaps.push({
              childTable: gp.referencedBy.table,
              fkColumn: gp.referencedBy.fkColumn,
              stagingId: stagingRow.id,
              localId,
            });
            logDim(`${gp.table}: will remap "${uniqueVal}" (${stagingRow.id} -> ${localId})`);
          } else {
            logDim(`${gp.table}: "${uniqueVal}" already exists with matching ID`);
          }
        } else {
          const cols = Object.keys(stagingRow);
          const jsonCols = await getJsonColumns(staging, gp.table);
          const quotedCols = cols.map((c) => `"${c}"`).join(", ");
          const valPlaceholders = cols.map((_, i) => `$${i + 1}`).join(", ");
          const values = cols.map((c) => {
            const v = stagingRow[c];
            return v !== null && jsonCols.has(c) && typeof v === "object" ? JSON.stringify(v) : v;
          });
          await local.query(
            `INSERT INTO "${gp.table}" (${quotedCols}) VALUES (${valPlaceholders})`,
            values
          );
          summary.push({ table: `${gp.table} (inserted)`, rows: 1 });
          logDim(`${gp.table}: inserted "${uniqueVal}" (new record)`);
        }
      }
    }

    // Step 12: Copy all org-scoped tables
    logStep("Copying org-scoped tables...");
    const copiedIds = new Map<string, Set<string>>();

    for (const table of orgScopedSet) {
      if (SKIP_TABLES.has(table)) continue;

      const count = await copyRows(staging, local, table, '"organizationId" = $1', [orgId]);

      if (count > 0) {
        summary.push({ table, rows: count });

        // Track copied IDs for child table lookups
        const idsResult = await staging.query(
          `SELECT "id" FROM "${table}" WHERE "organizationId" = $1`,
          [orgId]
        );
        copiedIds.set(table, new Set(idsResult.rows.map((r: { id: string }) => r.id)));
      }

      logDim(`${table}: ${count} rows`);
    }

    // Step 12b: Apply FK remaps for global reference records
    if (fkRemaps.length > 0) {
      logStep("Remapping global record FKs...");
      for (const remap of fkRemaps) {
        await local.query(
          `UPDATE "${remap.childTable}" SET "${remap.fkColumn}" = $1 WHERE "${remap.fkColumn}" = $2 AND "organizationId" = $3`,
          [remap.localId, remap.stagingId, orgId]
        );
        logDim(`${remap.childTable}."${remap.fkColumn}": ${remap.stagingId} -> ${remap.localId}`);
      }
    }

    // Step 13: Copy child tables (no organizationId, linked via FK)
    if (childTables.length > 0) {
      logStep("Copying child tables (via FK graph)...");

      for (const child of childTables) {
        const parentIds = copiedIds.get(child.parentTable);
        if (!parentIds || parentIds.size === 0) continue;

        const idArray = [...parentIds];
        const placeholders = idArray.map((_, i) => `$${i + 1}`).join(", ");

        try {
          const count = await copyRows(
            staging,
            local,
            child.table,
            `"${child.fkColumn}" IN (${placeholders})`,
            idArray
          );

          if (count > 0) {
            summary.push({ table: `${child.table} (via ${child.parentTable})`, rows: count });

            // Track these IDs too, so deeper children can find them
            const idsResult = await staging.query(
              `SELECT "id" FROM "${child.table}" WHERE "${child.fkColumn}" IN (${placeholders})`,
              idArray
            );
            copiedIds.set(child.table, new Set(idsResult.rows.map((r: { id: string }) => r.id)));
          }

          logDim(`${child.table}: ${count} rows`);
        } catch (err: any) {
          logWarn(`Skipped ${child.table}: ${err.message.split("\n")[0]}`);
        }
      }
    }

    // Step 13: Re-enable FK triggers
    await local.query("SET session_replication_role = 'origin'");

    // Print summary
    console.log("");
    log("Clone complete!");
    console.log("");
    console.log("  Table                                         Rows");
    console.log("  " + "─".repeat(52));
    let totalRows = 0;
    for (const entry of summary) {
      const padded = entry.table.padEnd(45);
      console.log(`  ${padded} ${entry.rows}`);
      totalRows += entry.rows;
    }
    console.log("  " + "─".repeat(52));
    console.log(`  ${"Total".padEnd(45)} ${totalRows}`);
    console.log("");
  } finally {
    await staging.end().catch(() => {});
    await local.end().catch(() => {});
    if (tunnel) {
      tunnel.kill();
      log("SSH tunnel closed");
    }
  }
}

main().catch((err) => {
  logError(err.message || err);
  process.exit(1);
});
