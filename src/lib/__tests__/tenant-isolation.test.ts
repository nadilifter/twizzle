import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

describe("TenantIsolationError", () => {
  it("has correct name and default message", async () => {
    const { TenantIsolationError } = await import("../db" as string);
    const err = new TenantIsolationError();
    expect(err.name).toBe("TenantIsolationError");
    expect(err.message).toBe("Access denied: Resource does not belong to your organization");
    expect(err).toBeInstanceOf(Error);
  });

  it("accepts a custom message", async () => {
    const { TenantIsolationError } = await import("../db" as string);
    const err = new TenantIsolationError("Custom denial message");
    expect(err.message).toBe("Custom denial message");
  });
});

describe("getScopedDb", () => {
  it("throws when called with empty organizationId", async () => {
    const { getScopedDb } = await import("../db" as string);
    expect(() => getScopedDb("")).toThrow("getScopedDb requires a valid organizationId");
  });
});

// ---------------------------------------------------------------------------
// Proxy-level tests: verify that getScopedDb actually intercepts Prisma calls
// and injects / enforces organizationId.
//
// Strategy: replace globalThis.prismaClient with a lightweight fake that
// implements $extends just enough to thread Prisma-style query callbacks
// back into vi.fn() stubs we can assert against.
// ---------------------------------------------------------------------------

const PROXY_ACTIONS = [
  "findMany",
  "findFirst",
  "findUnique",
  "count",
  "create",
  "createMany",
  "update",
  "updateMany",
  "delete",
  "deleteMany",
  "upsert",
] as const;

/**
 * Minimal PrismaClient stand-in that supports $extends well enough for
 * getScopedDb's interceptors to run end-to-end against mock functions.
 *
 * $extends creates a wrapper where each model action passes through the
 * extension's $allModels callback (if one exists for that action), with a
 * `query` function that resolves to the underlying mock.
 */
function createMockRawDb(modelNames: string[]) {
  const client: Record<string, any> = {};

  for (const model of modelNames) {
    client[model] = {};
    for (const action of PROXY_ACTIONS) {
      client[model][action] = vi.fn().mockResolvedValue(null);
    }
  }

  client.$extends = function (ext: any) {
    const callbacks = ext.query?.$allModels ?? {};
    const wrapped: Record<string, any> = {};

    for (const model of modelNames) {
      const pascal = model.charAt(0).toUpperCase() + model.slice(1);
      wrapped[model] = {};

      for (const action of PROXY_ACTIONS) {
        const cb = callbacks[action];
        wrapped[model][action] = cb
          ? (args: any) =>
              cb({
                model: pascal,
                args: args ?? {},
                query: (a: any) => client[model][action](a),
              })
          : (...a: any[]) => client[model][action](...a);
      }
    }

    wrapped.$extends = client.$extends.bind(client);
    return wrapped;
  };

  return client;
}

describe("getScopedDb proxy behavior", () => {
  // "program" is in TENANT_MODELS; "organizationSubscription" is not.
  const MODELS = ["program", "organizationSubscription"];
  let raw: Record<string, any>;
  let getScopedDb: (orgId: string) => any;
  let TenantIsolationError: new (msg?: string) => Error;

  beforeAll(async () => {
    vi.resetModules();
    raw = createMockRawDb(MODELS);
    (globalThis as any).prismaClient = raw;

    const mod = await import("../db" as string);
    getScopedDb = mod.getScopedDb;
    TenantIsolationError = mod.TenantIsolationError;
  });

  beforeEach(() => {
    for (const m of MODELS) {
      for (const a of PROXY_ACTIONS) {
        raw[m][a].mockReset().mockResolvedValue(null);
      }
    }
  });

  // --- reads ----------------------------------------------------------------

  it("findMany injects organizationId into the where clause", async () => {
    raw.program.findMany.mockResolvedValueOnce([{ id: "p1" }]);
    const scoped = getScopedDb("org-1");

    const result = await scoped.program.findMany({ where: { name: "Swim" } });

    expect(result).toEqual([{ id: "p1" }]);
    expect(raw.program.findMany).toHaveBeenCalledWith({
      where: { name: "Swim", organizationId: "org-1" },
    });
  });

  it("findUnique converts to findFirst with org filter and returns null for wrong-org record", async () => {
    raw.program.findFirst.mockResolvedValueOnce(null);
    const scoped = getScopedDb("org-1");

    const result = await scoped.program.findUnique({
      where: { id: "prog-from-org-2" },
    });

    expect(result).toBeNull();
    expect(raw.program.findFirst).toHaveBeenCalledWith({
      where: { id: "prog-from-org-2", organizationId: "org-1" },
      include: undefined,
      select: undefined,
    });
    expect(raw.program.findUnique).not.toHaveBeenCalled();
  });

  // --- writes ---------------------------------------------------------------

  it("update throws TenantIsolationError when record belongs to a different org", async () => {
    raw.program.findFirst.mockResolvedValueOnce(null);
    const scoped = getScopedDb("org-1");

    await expect(
      scoped.program.update({
        where: { id: "prog-from-org-2" },
        data: { name: "hacked" },
      })
    ).rejects.toThrow(TenantIsolationError);

    expect(raw.program.findFirst).toHaveBeenCalledWith({
      where: { id: "prog-from-org-2", organizationId: "org-1" },
      select: { id: true },
    });
    expect(raw.program.update).not.toHaveBeenCalled();
  });

  it("create auto-injects organizationId into data", async () => {
    raw.program.create.mockResolvedValueOnce({ id: "new-1", organizationId: "org-1" });
    const scoped = getScopedDb("org-1");

    const result = await scoped.program.create({ data: { name: "New Program" } });

    expect(result).toEqual({ id: "new-1", organizationId: "org-1" });
    expect(raw.program.create).toHaveBeenCalledWith({
      data: { name: "New Program", organizationId: "org-1" },
    });
  });

  // --- non-tenant model passthrough -----------------------------------------

  it("passes queries on non-tenant models through without org scoping", async () => {
    raw.organizationSubscription.findMany.mockResolvedValueOnce([{ id: "sub-1" }]);
    const scoped = getScopedDb("org-1");

    const result = await scoped.organizationSubscription.findMany({
      where: { status: "ACTIVE" },
    });

    expect(result).toEqual([{ id: "sub-1" }]);
    expect(raw.organizationSubscription.findMany).toHaveBeenCalledWith({
      where: { status: "ACTIVE" },
    });
  });
});
