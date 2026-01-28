import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var prismaClient: PrismaClient | undefined;
}

// Prevent multiple instances of Prisma Client in development
export const db = globalThis.prismaClient || new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.prismaClient = db;
}

// Models that have a direct organizationId field
const TENANT_MODELS = [
  "Family",
  "Program",
  "Event",
  "Invoice",
  "Skill",
  "LessonPlan",
  "Announcement",
  "WebsiteConfig",
  "OrganizationMember",
  "MembershipTier",
  "MembershipGroup",
  "Discount",
  "GLCode",
  "LedgerEntry",
  "Product",
] as const;

// Helper type for models that have organizationId
type TenantModel = (typeof TENANT_MODELS)[number];

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

  return db.$extends({
    query: {
      $allModels: {
        async findMany({ model, args, query }) {
          if (TENANT_MODELS.includes(model as TenantModel)) {
            (args as any).where = {
              ...((args as any).where || {}),
              organizationId,
            };
          }
          return query(args);
        },
        async findFirst({ model, args, query }) {
          if (TENANT_MODELS.includes(model as TenantModel)) {
            (args as any).where = {
              ...((args as any).where || {}),
              organizationId,
            };
          }
          return query(args);
        },
        async findUnique({ model, args, query }) {
          // Transform findUnique to findFirst with organizationId filter
          // This is more secure as it verifies tenant ownership
          if (TENANT_MODELS.includes(model as TenantModel)) {
            const delegate = getModelDelegate(model);
            
            return (db as any)[delegate].findFirst({
              where: {
                ...((args as any).where || {}),
                organizationId,
              },
              include: (args as any).include,
              select: (args as any).select,
            });
          }
          return query(args);
        },
        async count({ model, args, query }) {
          if (TENANT_MODELS.includes(model as TenantModel)) {
            (args as any).where = {
              ...((args as any).where || {}),
              organizationId,
            };
          }
          return query(args);
        },
        async create({ model, args, query }) {
          if (TENANT_MODELS.includes(model as TenantModel)) {
            (args as any).data = {
              ...((args as any).data || {}),
              organizationId,
            };
          }
          return query(args);
        },
        async createMany({ model, args, query }) {
          if (TENANT_MODELS.includes(model as TenantModel)) {
            const data = (args as any).data;
            if (Array.isArray(data)) {
              (args as any).data = data.map((item: any) => ({
                ...item,
                organizationId,
              }));
            } else {
              (args as any).data = {
                ...data,
                organizationId,
              };
            }
          }
          return query(args);
        },
        async update({ model, args, query }) {
          if (TENANT_MODELS.includes(model as TenantModel)) {
            // Security: Verify the record exists and belongs to this organization
            // before allowing the update
            const delegate = getModelDelegate(model);
            const whereClause = (args as any).where || {};
            
            // Check if record exists and belongs to this org
            const existingRecord = await (db as any)[delegate].findFirst({
              where: {
                ...whereClause,
                organizationId,
              },
              select: { id: true },
            });
            
            if (!existingRecord) {
              throw new TenantIsolationError(
                `Cannot update ${model}: Record not found or access denied`
              );
            }
          }
          return query(args);
        },
        async updateMany({ model, args, query }) {
          if (TENANT_MODELS.includes(model as TenantModel)) {
            // Add organizationId to the where clause to scope updates
            (args as any).where = {
              ...((args as any).where || {}),
              organizationId,
            };
          }
          return query(args);
        },
        async delete({ model, args, query }) {
          if (TENANT_MODELS.includes(model as TenantModel)) {
            // Security: Verify the record exists and belongs to this organization
            // before allowing the delete
            const delegate = getModelDelegate(model);
            const whereClause = (args as any).where || {};
            
            const existingRecord = await (db as any)[delegate].findFirst({
              where: {
                ...whereClause,
                organizationId,
              },
              select: { id: true },
            });
            
            if (!existingRecord) {
              throw new TenantIsolationError(
                `Cannot delete ${model}: Record not found or access denied`
              );
            }
          }
          return query(args);
        },
        async deleteMany({ model, args, query }) {
          if (TENANT_MODELS.includes(model as TenantModel)) {
            // Add organizationId to the where clause to scope deletes
            (args as any).where = {
              ...((args as any).where || {}),
              organizationId,
            };
          }
          return query(args);
        },
        async upsert({ model, args, query }) {
          if (TENANT_MODELS.includes(model as TenantModel)) {
            // For upsert, add organizationId to both create and update data
            // and verify any existing record belongs to this org
            const delegate = getModelDelegate(model);
            const whereClause = (args as any).where || {};
            
            // Check if record exists
            const existingRecord = await (db as any)[delegate].findFirst({
              where: whereClause,
              select: { id: true, organizationId: true },
            });
            
            // If record exists but belongs to different org, deny access
            if (existingRecord && (existingRecord as any).organizationId !== organizationId) {
              throw new TenantIsolationError(
                `Cannot upsert ${model}: Record belongs to a different organization`
              );
            }
            
            // Add organizationId to create data
            (args as any).create = {
              ...((args as any).create || {}),
              organizationId,
            };
          }
          return query(args);
        },
      },
    },
  });
}

export function getAdminDb() {
  // Returns the raw client, but we could add audit logging extension here
  return db;
}

export default db;
