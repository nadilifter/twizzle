import { db } from "@/lib/db";
import { getXeroClient, type XeroApiClient } from "@/lib/xero";
import type { GLCode } from "@prisma/client";
import type { Account as XeroAccountModel, Contact, Item } from "xero-node";
import type { MappingSuggestion, SpecialAccountSuggestion, AutoSuggestResult } from "@/lib/qbo-discovery";

export type { MappingSuggestion, SpecialAccountSuggestion, AutoSuggestResult };

export interface XeroAccount {
  accountID: string;
  name: string;
  type: string;
  bankAccountType?: string;
  class: string;
  status: string;
  code?: string;
}

export async function fetchXeroCompanyInfo(connectionId: string): Promise<void> {
  const { accountingApi, tenantId } = await getXeroClient(connectionId);
  const response = await accountingApi.getOrganisations(tenantId);
  const orgs = response.body?.organisations;

  if (orgs && orgs.length > 0) {
    await db.accountingConnection.update({
      where: { id: connectionId },
      data: { companyName: orgs[0].name || null },
    });
  }
}

export async function fetchXeroAccounts(connectionId: string): Promise<XeroAccount[]> {
  const { accountingApi, tenantId } = await getXeroClient(connectionId);
  const response = await accountingApi.getAccounts(tenantId);
  const accounts = response.body?.accounts || [];

  return accounts
    .filter((a: any) => a.status === "ACTIVE")
    .map((a: any) => ({
      accountID: a.accountID!,
      name: a.name!,
      type: a.type!,
      bankAccountType: a.bankAccountType,
      class: a._class!,
      status: a.status!,
      code: a.code,
    }));
}

export async function fetchXeroContacts(connectionId: string): Promise<any[]> {
  const { accountingApi, tenantId } = await getXeroClient(connectionId);
  const response = await accountingApi.getContacts(tenantId);
  return response.body?.contacts || [];
}

export async function fetchXeroItems(connectionId: string): Promise<any[]> {
  const { accountingApi, tenantId } = await getXeroClient(connectionId);
  const response = await accountingApi.getItems(tenantId);
  return response.body?.items || [];
}

const GL_TO_XERO_CLASS_MAP: Record<string, string[]> = {
  REVENUE: ["REVENUE"],
  EXPENSE: ["EXPENSE"],
  ASSET: ["ASSET"],
  LIABILITY: ["LIABILITY"],
  EQUITY: ["EQUITY"],
};

function normalizeForComparison(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function scoreName(glDescription: string, xeroName: string): number {
  const a = normalizeForComparison(glDescription);
  const b = normalizeForComparison(xeroName);

  if (a === b) return 100;
  if (b.includes(a) || a.includes(b)) return 80;

  const aWords = glDescription.toLowerCase().split(/\s+/);
  const bWords = xeroName.toLowerCase().split(/\s+/);
  const commonWords = aWords.filter((w) =>
    bWords.some((bw) => bw.includes(w) || w.includes(bw))
  );

  if (commonWords.length === 0) return 0;
  return Math.round((commonWords.length / Math.max(aWords.length, bWords.length)) * 60);
}

export async function autoSuggestXeroMappings(
  connectionId: string,
  organizationId: string
): Promise<AutoSuggestResult> {
  const [xeroAccounts, glCodes] = await Promise.all([
    fetchXeroAccounts(connectionId),
    db.gLCode.findMany({
      where: { organizationId, status: "ACTIVE" },
    }),
  ]);

  const glCodeMappings = suggestGlCodeMappings(glCodes, xeroAccounts);
  const specialAccounts = suggestSpecialAccounts(xeroAccounts);

  return { glCodeMappings, specialAccounts };
}

function suggestGlCodeMappings(
  glCodes: GLCode[],
  xeroAccounts: XeroAccount[]
): MappingSuggestion[] {
  return glCodes.map((gl) => {
    const allowedClasses = GL_TO_XERO_CLASS_MAP[gl.type] || [];
    const classMatchedAccounts = xeroAccounts.filter((a) =>
      allowedClasses.includes(a.class)
    );

    const scored = classMatchedAccounts
      .map((a) => ({
        accountId: a.accountID,
        accountName: a.name,
        accountType: a.type,
        score: scoreName(gl.description, a.name),
      }))
      .sort((a, b) => b.score - a.score);

    const top = scored[0];
    let confidence: MappingSuggestion["confidence"] = "none";
    if (top) {
      if (top.score >= 80) confidence = "high";
      else if (top.score >= 40) confidence = "medium";
      else confidence = "low";
    }

    return {
      glCodeId: gl.id,
      glCodeCode: gl.code,
      glCodeDescription: gl.description,
      glCodeType: gl.type,
      suggestedAccountId: top?.accountId ?? null,
      suggestedAccountName: top?.accountName ?? null,
      confidence,
      candidates: scored.slice(0, 5),
    };
  });
}

function suggestSpecialAccounts(
  xeroAccounts: XeroAccount[]
): SpecialAccountSuggestion[] {
  const suggestions: SpecialAccountSuggestion[] = [];

  const bankAccounts = xeroAccounts.filter((a) => a.type === "BANK");
  const checkingAccount = bankAccounts.find(
    (a) => normalizeForComparison(a.name).includes("checking") ||
           normalizeForComparison(a.name).includes("everyday")
  );
  suggestions.push({
    mappingType: "BANK_ACCOUNT",
    suggestedAccountId: checkingAccount?.accountID ?? bankAccounts[0]?.accountID ?? null,
    suggestedAccountName:
      checkingAccount?.name ?? bankAccounts[0]?.name ?? null,
    confidence: checkingAccount ? "high" : bankAccounts.length > 0 ? "medium" : "none",
    candidates: bankAccounts.map((a) => ({
      accountId: a.accountID,
      accountName: a.name,
      accountType: a.type,
    })),
  });

  const expenseAccounts = xeroAccounts.filter((a) => a.class === "EXPENSE");
  const feesAccount = expenseAccounts.find((a) => {
    const n = normalizeForComparison(a.name);
    return (
      n.includes("bankfee") ||
      n.includes("processingfee") ||
      n.includes("merchantfee") ||
      n.includes("paymentprocessing") ||
      n.includes("creditcardfee")
    );
  });
  suggestions.push({
    mappingType: "PROCESSING_FEES",
    suggestedAccountId: feesAccount?.accountID ?? null,
    suggestedAccountName: feesAccount?.name ?? null,
    confidence: feesAccount ? "high" : "none",
    candidates: expenseAccounts.slice(0, 10).map((a) => ({
      accountId: a.accountID,
      accountName: a.name,
      accountType: a.type,
    })),
  });

  const refundAccount = xeroAccounts.find((a) => {
    const n = normalizeForComparison(a.name);
    return n.includes("refund") || n.includes("returnallowance");
  });
  const revenueAccounts = xeroAccounts.filter((a) => a.class === "REVENUE");
  suggestions.push({
    mappingType: "REFUNDS",
    suggestedAccountId: refundAccount?.accountID ?? revenueAccounts[0]?.accountID ?? null,
    suggestedAccountName:
      refundAccount?.name ?? revenueAccounts[0]?.name ?? null,
    confidence: refundAccount ? "high" : "low",
    candidates: revenueAccounts.slice(0, 10).map((a) => ({
      accountId: a.accountID,
      accountName: a.name,
      accountType: a.type,
    })),
  });

  const undepositedFunds = xeroAccounts.find(
    (a) => normalizeForComparison(a.name) === "undepositedfunds"
  );
  const currentAssets = xeroAccounts.filter((a) => a.type === "CURRENT");
  suggestions.push({
    mappingType: "UNDEPOSITED_FUNDS",
    suggestedAccountId: undepositedFunds?.accountID ?? null,
    suggestedAccountName: undepositedFunds?.name ?? null,
    confidence: undepositedFunds ? "high" : "none",
    candidates: currentAssets.map((a) => ({
      accountId: a.accountID,
      accountName: a.name,
      accountType: a.type,
    })),
  });

  return suggestions;
}
