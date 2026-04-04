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
// Proxy-level tests for getScopedDb
//
// Approach modelled after olivierwilkinson/prisma-extension-soft-delete:
//   A lightweight MockClient exposes per-operation vi.fn() stubs that the
//   real getScopedDb extension threads through via $extends.  We assert on
//   the stubs to verify args transformation AND result passthrough.
//
// Also informed by sweetr-dev/sweetr.dev RLS integration tests which
// validate bidirectional isolation ("tenant A reads own, tenant B cannot").
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
 * Minimal PrismaClient stand-in whose $extends faithfully threads
 * per-operation $allModels callbacks so the real getScopedDb interceptors
 * run end-to-end against vi.fn() stubs.
 *
 * Modelled after prisma-extension-soft-delete's MockClient pattern:
 * each model delegate has one vi.fn() per Prisma action. $extends returns
 * a new wrapper where every action is routed through the matching extension
 * callback (if registered), with `query` resolving to the underlying stub.
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

  it("findUnique returns the record when it belongs to the scoped org", async () => {
    const record = { id: "prog-1", name: "Swim", organizationId: "org-1" };
    raw.program.findFirst.mockResolvedValueOnce(record);
    const scoped = getScopedDb("org-1");

    const result = await scoped.program.findUnique({
      where: { id: "prog-1" },
    });

    expect(result).toEqual(record);
  });

  // --- writes ---------------------------------------------------------------

  it("create auto-injects organizationId into data", async () => {
    raw.program.create.mockResolvedValueOnce({ id: "new-1", organizationId: "org-1" });
    const scoped = getScopedDb("org-1");

    const result = await scoped.program.create({ data: { name: "New Program" } });

    expect(result).toEqual({ id: "new-1", organizationId: "org-1" });
    expect(raw.program.create).toHaveBeenCalledWith({
      data: { name: "New Program", organizationId: "org-1" },
    });
  });

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

  it("update proceeds when the ownership check passes", async () => {
    raw.program.findFirst.mockResolvedValueOnce({ id: "prog-1" });
    raw.program.update.mockResolvedValueOnce({ id: "prog-1", name: "Renamed" });
    const scoped = getScopedDb("org-1");

    const result = await scoped.program.update({
      where: { id: "prog-1" },
      data: { name: "Renamed" },
    });

    expect(result).toEqual({ id: "prog-1", name: "Renamed" });
    expect(raw.program.update).toHaveBeenCalled();
  });

  it("delete throws TenantIsolationError when record belongs to a different org", async () => {
    raw.program.findFirst.mockResolvedValueOnce(null);
    const scoped = getScopedDb("org-1");

    await expect(scoped.program.delete({ where: { id: "prog-from-org-2" } })).rejects.toThrow(
      TenantIsolationError
    );

    expect(raw.program.findFirst).toHaveBeenCalledWith({
      where: { id: "prog-from-org-2", organizationId: "org-1" },
      select: { id: true },
    });
    expect(raw.program.delete).not.toHaveBeenCalled();
  });

  it("createMany injects organizationId into every element of the data array", async () => {
    raw.program.createMany.mockResolvedValueOnce({ count: 2 });
    const scoped = getScopedDb("org-1");

    const result = await scoped.program.createMany({
      data: [{ name: "Swim" }, { name: "Dive" }],
    });

    expect(result).toEqual({ count: 2 });
    expect(raw.program.createMany).toHaveBeenCalledWith({
      data: [
        { name: "Swim", organizationId: "org-1" },
        { name: "Dive", organizationId: "org-1" },
      ],
    });
  });

  // --- updateMany / deleteMany: where-injection (no ownership pre-check) ----

  it("updateMany injects organizationId into where instead of doing an ownership check", async () => {
    raw.program.updateMany.mockResolvedValueOnce({ count: 3 });
    const scoped = getScopedDb("org-1");

    const result = await scoped.program.updateMany({
      where: { status: "DRAFT" },
      data: { status: "PUBLISHED" },
    });

    expect(result).toEqual({ count: 3 });
    expect(raw.program.updateMany).toHaveBeenCalledWith({
      where: { status: "DRAFT", organizationId: "org-1" },
      data: { status: "PUBLISHED" },
    });
    expect(raw.program.findFirst).not.toHaveBeenCalled();
  });

  it("deleteMany injects organizationId into where instead of doing an ownership check", async () => {
    raw.program.deleteMany.mockResolvedValueOnce({ count: 2 });
    const scoped = getScopedDb("org-1");

    const result = await scoped.program.deleteMany({
      where: { status: "ARCHIVED" },
    });

    expect(result).toEqual({ count: 2 });
    expect(raw.program.deleteMany).toHaveBeenCalledWith({
      where: { status: "ARCHIVED", organizationId: "org-1" },
    });
    expect(raw.program.findFirst).not.toHaveBeenCalled();
  });

  // --- upsert: cross-org check on existing record before upserting ----------

  it("upsert throws TenantIsolationError when existing record belongs to a different org", async () => {
    raw.program.findFirst.mockResolvedValueOnce({ id: "prog-1", organizationId: "org-2" });
    const scoped = getScopedDb("org-1");

    await expect(
      scoped.program.upsert({
        where: { id: "prog-1" },
        create: { name: "New" },
        update: { name: "Updated" },
      })
    ).rejects.toThrow(TenantIsolationError);

    expect(raw.program.findFirst).toHaveBeenCalledWith({
      where: { id: "prog-1" },
      select: { id: true, organizationId: true },
    });
    expect(raw.program.upsert).not.toHaveBeenCalled();
  });

  it("upsert proceeds and injects organizationId into create when no existing record", async () => {
    raw.program.findFirst.mockResolvedValueOnce(null);
    raw.program.upsert.mockResolvedValueOnce({ id: "new-1", name: "New", organizationId: "org-1" });
    const scoped = getScopedDb("org-1");

    const result = await scoped.program.upsert({
      where: { id: "nonexistent" },
      create: { name: "New" },
      update: { name: "Updated" },
    });

    expect(result).toEqual({ id: "new-1", name: "New", organizationId: "org-1" });
    expect(raw.program.upsert).toHaveBeenCalledWith({
      where: { id: "nonexistent" },
      create: { name: "New", organizationId: "org-1" },
      update: { name: "Updated" },
    });
  });

  it("upsert proceeds when existing record belongs to the same org", async () => {
    raw.program.findFirst.mockResolvedValueOnce({ id: "prog-1", organizationId: "org-1" });
    raw.program.upsert.mockResolvedValueOnce({ id: "prog-1", name: "Updated" });
    const scoped = getScopedDb("org-1");

    const result = await scoped.program.upsert({
      where: { id: "prog-1" },
      create: { name: "New" },
      update: { name: "Updated" },
    });

    expect(result).toEqual({ id: "prog-1", name: "Updated" });
    expect(raw.program.upsert).toHaveBeenCalled();
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
