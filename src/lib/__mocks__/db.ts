import { PrismaClient } from "@prisma/client";
import { beforeEach } from "vitest";
import { mockDeep, mockReset, type DeepMockProxy } from "vitest-mock-extended";

export const db = mockDeep<PrismaClient>();
export type MockDb = DeepMockProxy<PrismaClient>;

beforeEach(() => {
  mockReset(db);
});

export default db;
