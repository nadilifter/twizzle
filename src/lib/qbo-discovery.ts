import { db } from "@/lib/db";
import { getQboClient, type QboApiClient } from "@/lib/qbo";
import type { GLCode } from "@prisma/client";

// ---------------------------------------------------------------------------
// QBO entity types used during discovery
// ---------------------------------------------------------------------------

export interface QboAccount {
  Id: string;
  Name: string;
  FullyQualifiedName: string;
  AccountType: string;
  AccountSubType: string;
  Classification: string;
  Active: boolean;
  CurrentBalance: number;
  SubAccount: boolean;
}

export interface QboCompanyInfo {
  CompanyName: string;
  Country: string;
  FiscalYearStartMonth: string;
  CompanyAddr?: {
    Line1?: string;
    City?: string;
    CountrySubDivisionCode?: string;
    PostalCode?: string;
  };
}

export interface QboCustomer {
  Id: string;
  DisplayName: string;
  PrimaryEmailAddr?: { Address: string };
  Active: boolean;
}

export interface QboItem {
  Id: string;
  Name: string;
  Type: string;
  Active: boolean;
  IncomeAccountRef?: { value: string; name: string };
}

// ---------------------------------------------------------------------------
// Discovery: fetch data from QBO after OAuth
// ---------------------------------------------------------------------------

export async function fetchCompanyInfo(connectionId: string): Promise<void> {
  const client = await getQboClient(connectionId);
  const companies = await client.query<QboCompanyInfo>(
    "SELECT * FROM CompanyInfo"
  );

  if (companies.length > 0) {
    await db.qboConnection.update({
      where: { id: connectionId },
      data: { companyName: companies[0].CompanyName },
    });
  }
}

export async function fetchChartOfAccounts(
  connectionId: string
): Promise<QboAccount[]> {
  const client = await getQboClient(connectionId);
  return client.query<QboAccount>(
    "SELECT * FROM Account WHERE Active = true MAXRESULTS 1000"
  );
}

export async function fetchExistingCustomers(
  connectionId: string
): Promise<QboCustomer[]> {
  const client = await getQboClient(connectionId);
  return client.query<QboCustomer>(
    "SELECT Id, DisplayName, PrimaryEmailAddr, Active FROM Customer WHERE Active = true MAXRESULTS 1000"
  );
}

export async function fetchExistingItems(
  connectionId: string
): Promise<QboItem[]> {
  const client = await getQboClient(connectionId);
  return client.query<QboItem>(
    "SELECT * FROM Item WHERE Active = true MAXRESULTS 1000"
  );
}

// ---------------------------------------------------------------------------
// Auto-suggest: match Uplifter GL codes to QBO accounts
// ---------------------------------------------------------------------------

const GL_TO_QBO_TYPE_MAP: Record<string, string[]> = {
  REVENUE: ["Income", "Other Income"],
  EXPENSE: ["Expense", "Other Expense", "Cost of Goods Sold"],
  ASSET: ["Other Current Asset", "Fixed Asset", "Other Asset", "Bank"],
  LIABILITY: ["Other Current Liability", "Long Term Liability", "Credit Card"],
  EQUITY: ["Equity"],
};

export interface MappingSuggestion {
  glCodeId: string;
  glCodeCode: string;
  glCodeDescription: string;
  glCodeType: string;
  suggestedQboAccountId: string | null;
  suggestedQboAccountName: string | null;
  confidence: "high" | "medium" | "low" | "none";
  candidates: Array<{
    qboAccountId: string;
    qboAccountName: string;
    accountType: string;
    score: number;
  }>;
}

export interface SpecialAccountSuggestion {
  mappingType: "BANK_ACCOUNT" | "PROCESSING_FEES" | "REFUNDS" | "UNDEPOSITED_FUNDS";
  suggestedQboAccountId: string | null;
  suggestedQboAccountName: string | null;
  confidence: "high" | "medium" | "low" | "none";
  candidates: Array<{
    qboAccountId: string;
    qboAccountName: string;
    accountType: string;
  }>;
}

export interface AutoSuggestResult {
  glCodeMappings: MappingSuggestion[];
  specialAccounts: SpecialAccountSuggestion[];
}

function normalizeForComparison(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function scoreName(glDescription: string, qboName: string): number {
  const a = normalizeForComparison(glDescription);
  const b = normalizeForComparison(qboName);

  if (a === b) return 100;
  if (b.includes(a) || a.includes(b)) return 80;

  const aWords = glDescription.toLowerCase().split(/\s+/);
  const bWords = qboName.toLowerCase().split(/\s+/);
  const commonWords = aWords.filter((w) =>
    bWords.some((bw) => bw.includes(w) || w.includes(bw))
  );

  if (commonWords.length === 0) return 0;
  return Math.round((commonWords.length / Math.max(aWords.length, bWords.length)) * 60);
}

export async function autoSuggestMappings(
  connectionId: string,
  organizationId: string
): Promise<AutoSuggestResult> {
  const [qboAccounts, glCodes] = await Promise.all([
    fetchChartOfAccounts(connectionId),
    db.gLCode.findMany({
      where: { organizationId, status: "ACTIVE" },
    }),
  ]);

  const glCodeMappings = suggestGlCodeMappings(glCodes, qboAccounts);
  const specialAccounts = suggestSpecialAccounts(qboAccounts);

  return { glCodeMappings, specialAccounts };
}

function suggestGlCodeMappings(
  glCodes: GLCode[],
  qboAccounts: QboAccount[]
): MappingSuggestion[] {
  return glCodes.map((gl) => {
    const allowedTypes = GL_TO_QBO_TYPE_MAP[gl.type] || [];
    const typeMatchedAccounts = qboAccounts.filter((a) =>
      allowedTypes.includes(a.AccountType)
    );

    const scored = typeMatchedAccounts
      .map((a) => ({
        qboAccountId: a.Id,
        qboAccountName: a.FullyQualifiedName,
        accountType: a.AccountType,
        score: scoreName(gl.description, a.Name),
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
      suggestedQboAccountId: top?.qboAccountId ?? null,
      suggestedQboAccountName: top?.qboAccountName ?? null,
      confidence,
      candidates: scored.slice(0, 5),
    };
  });
}

function suggestSpecialAccounts(
  qboAccounts: QboAccount[]
): SpecialAccountSuggestion[] {
  const suggestions: SpecialAccountSuggestion[] = [];

  // Bank account
  const bankAccounts = qboAccounts.filter((a) => a.AccountType === "Bank");
  const checkingAccount = bankAccounts.find(
    (a) => normalizeForComparison(a.Name).includes("checking")
  );
  suggestions.push({
    mappingType: "BANK_ACCOUNT",
    suggestedQboAccountId: checkingAccount?.Id ?? bankAccounts[0]?.Id ?? null,
    suggestedQboAccountName:
      checkingAccount?.FullyQualifiedName ??
      bankAccounts[0]?.FullyQualifiedName ??
      null,
    confidence: checkingAccount ? "high" : bankAccounts.length > 0 ? "medium" : "none",
    candidates: bankAccounts.map((a) => ({
      qboAccountId: a.Id,
      qboAccountName: a.FullyQualifiedName,
      accountType: a.AccountType,
    })),
  });

  // Processing fees
  const expenseAccounts = qboAccounts.filter(
    (a) => a.AccountType === "Expense" || a.AccountType === "Other Expense"
  );
  const feesAccount = expenseAccounts.find((a) => {
    const n = normalizeForComparison(a.Name);
    return (
      n.includes("bankcharge") ||
      n.includes("processingfee") ||
      n.includes("merchantfee") ||
      n.includes("paymentprocessing") ||
      n.includes("creditcardfee")
    );
  });
  suggestions.push({
    mappingType: "PROCESSING_FEES",
    suggestedQboAccountId: feesAccount?.Id ?? null,
    suggestedQboAccountName: feesAccount?.FullyQualifiedName ?? null,
    confidence: feesAccount ? "high" : "none",
    candidates: expenseAccounts.slice(0, 10).map((a) => ({
      qboAccountId: a.Id,
      qboAccountName: a.FullyQualifiedName,
      accountType: a.AccountType,
    })),
  });

  // Refunds account
  const refundAccount = qboAccounts.find((a) => {
    const n = normalizeForComparison(a.Name);
    return n.includes("refund") || n.includes("returnallowance");
  });
  const incomeAccounts = qboAccounts.filter(
    (a) => a.AccountType === "Income" || a.AccountType === "Other Income"
  );
  suggestions.push({
    mappingType: "REFUNDS",
    suggestedQboAccountId: refundAccount?.Id ?? incomeAccounts[0]?.Id ?? null,
    suggestedQboAccountName:
      refundAccount?.FullyQualifiedName ??
      incomeAccounts[0]?.FullyQualifiedName ??
      null,
    confidence: refundAccount ? "high" : "low",
    candidates: incomeAccounts.slice(0, 10).map((a) => ({
      qboAccountId: a.Id,
      qboAccountName: a.FullyQualifiedName,
      accountType: a.AccountType,
    })),
  });

  // Undeposited Funds
  const undepositedFunds = qboAccounts.find(
    (a) => normalizeForComparison(a.Name) === "undepositedfunds"
  );
  const otherCurrentAssets = qboAccounts.filter(
    (a) => a.AccountType === "Other Current Asset"
  );
  suggestions.push({
    mappingType: "UNDEPOSITED_FUNDS",
    suggestedQboAccountId: undepositedFunds?.Id ?? null,
    suggestedQboAccountName: undepositedFunds?.FullyQualifiedName ?? null,
    confidence: undepositedFunds ? "high" : "none",
    candidates: otherCurrentAssets.map((a) => ({
      qboAccountId: a.Id,
      qboAccountName: a.FullyQualifiedName,
      accountType: a.AccountType,
    })),
  });

  return suggestions;
}
