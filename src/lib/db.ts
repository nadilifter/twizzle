import { PrismaClient, Prisma } from "@prisma/client";
import { AsyncLocalStorage } from "async_hooks";
import { logger } from "@/lib/logger";

const SLOW_QUERY_THRESHOLD_MS = 500;

function createPrismaClient() {
  const client = new PrismaClient<Prisma.PrismaClientOptions, "query">({
    log: [
      { emit: "event", level: "query" },
      { emit: "stdout", level: "warn" },
      { emit: "stdout", level: "error" },
    ],
  });

  client.$on("query", (e) => {
    if (e.duration > SLOW_QUERY_THRESHOLD_MS) {
      logger.warn(`Slow query (${e.duration}ms)`, {
        query: e.query.slice(0, 200),
        duration: e.duration,
      });
    }
  });

  return client as unknown as PrismaClient;
}

declare global {
  // eslint-disable-next-line no-var
  var prismaClient: PrismaClient | undefined;
}

// Prevent multiple instances of Prisma Client in development
const _rawDb = globalThis.prismaClient || createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.prismaClient = _rawDb;
}

// Per-request tracking of scoped query context. AsyncLocalStorage ensures
// concurrent requests don't interfere with each other's scoped-query flag.
const _scopedQueryStorage = new AsyncLocalStorage<{ active: boolean }>();

function _isInsideScopedQuery(): boolean {
  return _scopedQueryStorage.getStore()?.active === true;
}

// In development, wrap the base client with a monitoring extension that warns
// when tenant-model queries are executed without organizationId. In production,
// export the raw client with zero overhead.
function _createDevWarningDb(client: PrismaClient) {
  function hasOrgId(action: string, args: any): boolean {
    switch (action) {
      case "create":
        return !!args?.data?.organizationId;
      case "createMany": {
        const data = args?.data;
        return Array.isArray(data)
          ? data.length > 0 && data.every((d: any) => d.organizationId)
          : !!data?.organizationId;
      }
      case "upsert":
        return !!args?.create?.organizationId;
      default:
        return !!args?.where?.organizationId;
    }
  }

  function warnIfUnscoped(model: string, action: string, args: any) {
    if (
      !_isInsideScopedQuery() &&
      typeof _TENANT_SET !== "undefined" &&
      _TENANT_SET.has(model) &&
      !hasOrgId(action, args)
    ) {
      console.warn(
        `\x1b[33m[TENANT WARNING]\x1b[0m ${action} on ${model} without organizationId. ` +
          `Use getScopedDb() or add organizationId to the query.`
      );
    }
  }

  return client.$extends({
    query: {
      $allModels: {
        async findMany({ model, args, query }) {
          warnIfUnscoped(model, "findMany", args);
          return query(args);
        },
        async findFirst({ model, args, query }) {
          warnIfUnscoped(model, "findFirst", args);
          return query(args);
        },
        async findUnique({ model, args, query }) {
          warnIfUnscoped(model, "findUnique", args);
          return query(args);
        },
        async count({ model, args, query }) {
          warnIfUnscoped(model, "count", args);
          return query(args);
        },
        async create({ model, args, query }) {
          warnIfUnscoped(model, "create", args);
          return query(args);
        },
        async createMany({ model, args, query }) {
          warnIfUnscoped(model, "createMany", args);
          return query(args);
        },
        async update({ model, args, query }) {
          warnIfUnscoped(model, "update", args);
          return query(args);
        },
        async updateMany({ model, args, query }) {
          warnIfUnscoped(model, "updateMany", args);
          return query(args);
        },
        async delete({ model, args, query }) {
          warnIfUnscoped(model, "delete", args);
          return query(args);
        },
        async deleteMany({ model, args, query }) {
          warnIfUnscoped(model, "deleteMany", args);
          return query(args);
        },
        async upsert({ model, args, query }) {
          warnIfUnscoped(model, "upsert", args);
          return query(args);
        },
      },
    },
  });
}

export const db = (process.env.NODE_ENV !== "production"
  ? _createDevWarningDb(_rawDb)
  : _rawDb) as unknown as PrismaClient;

// Models that have a direct organizationId field and should be auto-scoped.
// Platform-level models (OrganizationSubscription, OrganizationFeatureOverride,
// OrganizationPaymentMethod, AdyenPlatformAccount, OrganizationStatusLog,
// SubscriptionInvoice, SubscriptionPaymentAttempt) are intentionally excluded
// -- they are managed by superadmins and system cron jobs.
// SmsNumberAssignment is excluded because the number pool service requires
// cross-org visibility to prevent routing collisions (same phone number must
// map to different Twilio numbers per org).
const TENANT_MODELS = [
  "Program",
  "Event",
  "Invoice",
  "Skill",
  "LessonPlan",
  "Announcement",
  "WebsiteConfig",
  "OrganizationMember",
  "MembershipGroup",
  "Pass",
  "Discount",
  "GLCode",
  "LedgerEntry",
  "Product",
  "Waiver",
  "OrganizationInvitation",
  "OrganizationAthlete",
  "MedicalFormConfig",
  "CustomMedicalQuestion",
  "Level",
  "ProgramInstance",
  "Transaction",
  "Payout",
  "RecurringCharge",
  "EvaluationTemplate",
  "Achievement",
  "Message",
  "SmsCampaign",
  "Conversation",
  "SmsUsage",
  "EmailMessage",
  "EmailCampaign",
  "EmailUsage",
  "Media",
  "Facility",
  "Equipment",
  "Shift",
  "ScheduleTemplate",
  "RegistrationQueueConfig",
  "NotificationRule",
  "NotificationLog",
  "Competition",
  "CompetitionTeam",
  "RegistrationFile",
  "Certification",
  "OrganizationSport",
  "OrganizationCategoryPreference",
  "Order",
  "TeamMemberHighlight",
  "CustomInfoConfig",
  "CustomInfoQuestion",
  "CustomInfoResponse",
  "Category",
  "OrganizationHoliday",
  "Season",
] as const;

// Helper type for models that have organizationId
type TenantModel = (typeof TENANT_MODELS)[number];

// Set for O(1) lookup in the dev-mode middleware (defined after TENANT_MODELS
// to avoid TDZ issues with the $use callback registered above).
const _TENANT_SET = new Set<string>(TENANT_MODELS);

/**
 * Error thrown when a tenant isolation violation is detected
 */
export class TenantIsolationError extends Error {
  constructor(message: string = "Access denied: Resource does not belong to your organization") {
    super(message);
    this.name = "TenantIsolationError";
  }
}

/**
 * Helper to get camelCase model name from PascalCase
 */
function getModelDelegate(model: string): string {
  return model.charAt(0).toLowerCase() + model.slice(1);
}

/**
 * Creates a scoped database client that enforces tenant isolation.
 * All queries are automatically filtered by organizationId.
 *
 * SECURITY: This extension ensures that:
 * - Read operations (findMany, findFirst, findUnique, count) only return records for the organization
 * - Create operations automatically set the organizationId
 * - Update operations verify the record belongs to the organization before updating
 * - Delete operations verify the record belongs to the organization before deleting
 *
 * @param organizationId - The organization ID to scope queries to
 */
export function getScopedDb(organizationId: string) {
  if (!organizationId) {
    throw new Error("getScopedDb requires a valid organizationId");
  }

  const scopedQuery = <T>(fn: () => Promise<T>): Promise<T> => {
    return _scopedQueryStorage.run({ active: true }, fn);
  };

  function injectWhereScope(args: any): void {
    args.where = { ...(args.where || {}), organizationId };
  }

  async function verifyOwnership(model: string, args: any, action: string): Promise<void> {
    const delegate = getModelDelegate(model);
    const record = await scopedQuery(() =>
      (_rawDb as any)[delegate].findFirst({
        where: { ...(args.where || {}), organizationId },
        select: { id: true },
      })
    );
    if (!record) {
      throw new TenantIsolationError(
        `Cannot ${action} ${model}: Record not found or access denied`
      );
    }
  }

  return _rawDb.$extends({
    query: {
      $allModels: {
        async findMany({ model, args, query }) {
          if (_TENANT_SET.has(model)) injectWhereScope(args);
          return scopedQuery(() => query(args));
        },
        async findFirst({ model, args, query }) {
          if (_TENANT_SET.has(model)) injectWhereScope(args);
          return scopedQuery(() => query(args));
        },
        async findUnique({ model, args, query }) {
          if (_TENANT_SET.has(model)) {
            const delegate = getModelDelegate(model);
            return scopedQuery(() =>
              (_rawDb as any)[delegate].findFirst({
                where: { ...((args as any).where || {}), organizationId },
                include: (args as any).include,
                select: (args as any).select,
              })
            );
          }
          return scopedQuery(() => query(args));
        },
        async count({ model, args, query }) {
          if (_TENANT_SET.has(model)) injectWhereScope(args);
          return scopedQuery(() => query(args));
        },
        async create({ model, args, query }) {
          if (_TENANT_SET.has(model)) {
            (args as any).data = { ...((args as any).data || {}), organizationId };
          }
          return scopedQuery(() => query(args));
        },
        async createMany({ model, args, query }) {
          if (_TENANT_SET.has(model)) {
            const data = (args as any).data;
            (args as any).data = Array.isArray(data)
              ? data.map((item: any) => ({ ...item, organizationId }))
              : { ...data, organizationId };
          }
          return scopedQuery(() => query(args));
        },
        async update({ model, args, query }) {
          if (_TENANT_SET.has(model)) await verifyOwnership(model, args, "update");
          return scopedQuery(() => query(args));
        },
        async updateMany({ model, args, query }) {
          if (_TENANT_SET.has(model)) injectWhereScope(args);
          return scopedQuery(() => query(args));
        },
        async delete({ model, args, query }) {
          if (_TENANT_SET.has(model)) await verifyOwnership(model, args, "delete");
          return scopedQuery(() => query(args));
        },
        async deleteMany({ model, args, query }) {
          if (_TENANT_SET.has(model)) injectWhereScope(args);
          return scopedQuery(() => query(args));
        },
        async upsert({ model, args, query }) {
          if (_TENANT_SET.has(model)) {
            const delegate = getModelDelegate(model);
            const existing = await scopedQuery(() =>
              (_rawDb as any)[delegate].findFirst({
                where: (args as any).where || {},
                select: { id: true, organizationId: true },
              })
            );
            if (existing && (existing as any).organizationId !== organizationId) {
              throw new TenantIsolationError(
                `Cannot upsert ${model}: Record belongs to a different organization`
              );
            }
            (args as any).create = { ...((args as any).create || {}), organizationId };
          }
          return scopedQuery(() => query(args));
        },
      },
    },
  });
}

export function getAdminDb() {
  return _rawDb;
}

export default db;
