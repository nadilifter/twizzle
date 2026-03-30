import type { Prisma, PrismaClient } from "@prisma/client";

type TxClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

const DEFAULT_GL_CODES = [
  {
    code: "4100",
    description: "Program Revenue",
    type: "REVENUE" as const,
    defaultForType: "PROGRAM" as const,
  },
  {
    code: "4200",
    description: "Event Revenue",
    type: "REVENUE" as const,
    defaultForType: "EVENT" as const,
  },
  {
    code: "4300",
    description: "Competition Revenue",
    type: "REVENUE" as const,
    defaultForType: "COMPETITION" as const,
  },
  {
    code: "4400",
    description: "Membership Revenue",
    type: "REVENUE" as const,
    defaultForType: "MEMBERSHIP" as const,
  },
  {
    code: "4500",
    description: "Pass Revenue",
    type: "REVENUE" as const,
    defaultForType: "PASS" as const,
  },
  {
    code: "4600",
    description: "Product Revenue",
    type: "REVENUE" as const,
    defaultForType: "PRODUCT" as const,
  },
  {
    code: "2100",
    description: "Sales Tax Collected",
    type: "LIABILITY" as const,
    defaultForType: null,
  },
] as const;

export async function createDefaultGLCodes(organizationId: string, client: TxClient) {
  const existing = await client.gLCode.findMany({
    where: { organizationId, isDefault: true },
    select: { code: true },
  });
  const existingCodes = new Set(existing.map((g) => g.code));

  const toCreate = DEFAULT_GL_CODES.filter((d) => !existingCodes.has(d.code));
  if (toCreate.length === 0) return;

  await client.gLCode.createMany({
    data: toCreate.map((d) => ({
      code: d.code,
      description: d.description,
      type: d.type,
      defaultForType: d.defaultForType,
      isDefault: true,
      organizationId,
    })),
  });
}

export async function getDefaultGLCodeForType(
  organizationId: string,
  entityType: "PROGRAM" | "EVENT" | "COMPETITION" | "MEMBERSHIP" | "PASS" | "PRODUCT",
  client: TxClient
) {
  return client.gLCode.findFirst({
    where: { organizationId, isDefault: true, defaultForType: entityType },
    select: { id: true },
  });
}
