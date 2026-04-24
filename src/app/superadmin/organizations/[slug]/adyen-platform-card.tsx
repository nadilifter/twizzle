"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  CreditCard,
  Loader2,
  ChevronDownIcon,
  RefreshCwIcon,
  ExternalLinkIcon,
  PlayIcon,
  CheckCircle2Icon,
  WalletIcon,
} from "lucide-react";

type AdyenAccount = {
  id: string;
  legalEntityId: string;
  businessLineId: string | null;
  accountHolderId: string | null;
  balanceAccountId: string | null;
  storeId: string | null;
  storeReference: string | null;
  onboardingStatus: string;
  verificationStatus: string | null;
  capabilities: any;
  sweepId: string | null;
  transferInstrumentId: string | null;
  createdAt: string;
  updatedAt: string;
};

interface Props {
  organizationId: string;
  initialAccount: AdyenAccount | null;
}

type TransferRow = {
  id: string;
  creationDate: string;
  category: string | null;
  direction: string | null;
  status: string | null;
  amount: { value: number; currency: string } | null;
  reference: string | null;
  description: string | null;
  counterpartyDescription: string | null;
};

type BalanceDiagnostics = {
  balanceAccountId: string;
  balance: {
    available: number;
    pending: number;
    reserved: number;
    balance: number;
    currency: string;
  } | null;
  transfers: TransferRow[];
  windowDays: number;
};

export function AdyenPlatformCard({ organizationId, initialAccount }: Props) {
  const [account, setAccount] = useState<AdyenAccount | null>(initialAccount);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [capsOpen, setCapsOpen] = useState(false);
  const [balanceOpen, setBalanceOpen] = useState(false);
  const [balanceData, setBalanceData] = useState<BalanceDiagnostics | null>(null);
  const [balanceError, setBalanceError] = useState<string | null>(null);

  const doAction = async (action: string, endpoint: string, method: string = "POST") => {
    setLoading(action);
    setError(null);
    try {
      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: method === "POST" ? JSON.stringify({ organizationId }) : undefined,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || `${action} failed`);
        return;
      }

      if (action === "link" && data.url) {
        window.open(data.url, "_blank");
      }

      // Refresh status
      await refreshStatus();
    } catch {
      setError(`${action} failed`);
    } finally {
      setLoading(null);
    }
  };

  const refreshStatus = async () => {
    setLoading("refresh");
    try {
      const res = await fetch(`/api/superadmin/organizations/${organizationId}/adyen-platform`);
      const data = await res.json();
      if (res.ok) {
        setAccount(data.account);
      }
    } catch {
      // ignore
    } finally {
      setLoading(null);
    }
  };

  const refreshBalance = async () => {
    setLoading("balance");
    setBalanceError(null);
    try {
      const res = await fetch(`/api/superadmin/organizations/${organizationId}/adyen-balance`);
      const data = await res.json();
      if (!res.ok) {
        setBalanceError(data.error || "Failed to fetch balance");
        setBalanceData(null);
        return;
      }
      setBalanceData(data);
    } catch {
      setBalanceError("Failed to fetch balance");
    } finally {
      setLoading(null);
    }
  };

  const toggleBalance = async (open: boolean) => {
    setBalanceOpen(open);
    if (open && !balanceData && !balanceError) {
      await refreshBalance();
    }
  };

  const statusColor: Record<string, string> = {
    PENDING_HOSTED: "bg-amber-100 text-amber-800",
    IN_PROGRESS: "bg-blue-100 text-blue-800",
    AWAITING_DATA: "bg-orange-100 text-orange-800",
    IN_REVIEW: "bg-purple-100 text-purple-800",
    VERIFIED: "bg-green-100 text-green-800",
    REJECTED: "bg-red-100 text-red-800",
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            <div>
              <CardTitle>Adyen Platform Account</CardTitle>
              <CardDescription>Marketplace onboarding and payment processing</CardDescription>
            </div>
          </div>
          {account && (
            <Badge className={statusColor[account.onboardingStatus] || ""}>
              {account.onboardingStatus.replace(/_/g, " ")}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && <p className="text-sm text-destructive">{error}</p>}

        {!account ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              No Adyen platform account exists for this organization.
            </p>
            <Button
              size="sm"
              onClick={() => doAction("initiate", "/api/organization/adyen-onboarding")}
              disabled={!!loading}
            >
              {loading === "initiate" && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <PlayIcon className="h-4 w-4 mr-2" />
              Initiate Onboarding
            </Button>
          </div>
        ) : (
          <>
            {/* Entity IDs */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <IdRow label="Legal Entity" value={account.legalEntityId} />
              <IdRow label="Business Line" value={account.businessLineId} />
              <IdRow label="Account Holder" value={account.accountHolderId} />
              <IdRow label="Balance Account" value={account.balanceAccountId} />
              <IdRow label="Store" value={account.storeId} />
              <IdRow label="Sweep" value={account.sweepId} />
            </div>

            {account.verificationStatus && (
              <div className="text-sm">
                <span className="text-muted-foreground">Verification: </span>
                <span>{account.verificationStatus}</span>
              </div>
            )}

            {/* Capabilities (collapsible) */}
            {account.capabilities && Object.keys(account.capabilities).length > 0 && (
              <Collapsible open={capsOpen} onOpenChange={setCapsOpen}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="w-full justify-between">
                    Capabilities ({Object.keys(account.capabilities).length})
                    <ChevronDownIcon
                      className={`h-4 w-4 transition-transform ${capsOpen ? "rotate-180" : ""}`}
                    />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <pre className="text-xs bg-muted p-3 rounded-md overflow-auto max-h-60">
                    {JSON.stringify(account.capabilities, null, 2)}
                  </pre>
                </CollapsibleContent>
              </Collapsible>
            )}

            {/* Balance & Activity (collapsible, lazy-loaded) */}
            {account.balanceAccountId && (
              <Collapsible open={balanceOpen} onOpenChange={toggleBalance}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="w-full justify-between">
                    <span className="flex items-center gap-2">
                      <WalletIcon className="h-4 w-4" />
                      Balance & Recent Activity
                    </span>
                    <ChevronDownIcon
                      className={`h-4 w-4 transition-transform ${balanceOpen ? "rotate-180" : ""}`}
                    />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-3 pt-2">
                  {balanceError && <p className="text-sm text-destructive">{balanceError}</p>}

                  {loading === "balance" && !balanceData && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                    </div>
                  )}

                  {balanceData && (
                    <>
                      <div className="flex items-center justify-between gap-4">
                        <div className="grid grid-cols-3 gap-4 flex-1">
                          <div>
                            <p className="text-xs text-muted-foreground">Available</p>
                            <p className="text-lg font-semibold">
                              {balanceData.balance
                                ? formatAmount(
                                    balanceData.balance.available,
                                    balanceData.balance.currency,
                                    { alreadyMajorUnits: true }
                                  )
                                : "—"}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Pending</p>
                            <p className="text-lg font-semibold">
                              {balanceData.balance
                                ? formatAmount(
                                    balanceData.balance.pending,
                                    balanceData.balance.currency,
                                    { alreadyMajorUnits: true }
                                  )
                                : "—"}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Reserved</p>
                            <p className="text-lg font-semibold">
                              {balanceData.balance
                                ? formatAmount(
                                    balanceData.balance.reserved,
                                    balanceData.balance.currency,
                                    { alreadyMajorUnits: true }
                                  )
                                : "—"}
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={refreshBalance}
                          disabled={loading === "balance"}
                        >
                          {loading === "balance" ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <RefreshCwIcon className="h-4 w-4 mr-2" />
                          )}
                          Refresh
                        </Button>
                      </div>

                      <div>
                        <p className="text-xs text-muted-foreground mb-2">
                          Transfers (last {balanceData.windowDays}d, all categories)
                        </p>
                        {balanceData.transfers.length === 0 ? (
                          <p className="text-sm text-muted-foreground italic">
                            No transfers in this window. If a recent payment was captured but
                            hasn&apos;t booked yet, wait for Adyen&apos;s settlement run and
                            refresh.
                          </p>
                        ) : (
                          <div className="border rounded-md overflow-hidden">
                            <table className="w-full text-xs">
                              <thead className="bg-muted">
                                <tr className="text-left">
                                  <th className="px-2 py-1.5 font-medium">Date</th>
                                  <th className="px-2 py-1.5 font-medium">Category</th>
                                  <th className="px-2 py-1.5 font-medium">Dir</th>
                                  <th className="px-2 py-1.5 font-medium">Status</th>
                                  <th className="px-2 py-1.5 font-medium text-right">Amount</th>
                                  <th className="px-2 py-1.5 font-medium">Reference</th>
                                </tr>
                              </thead>
                              <tbody>
                                {balanceData.transfers.map((t) => (
                                  <tr key={t.id} className="border-t">
                                    <td className="px-2 py-1.5 whitespace-nowrap">
                                      {t.creationDate
                                        ? new Date(t.creationDate).toLocaleString()
                                        : "—"}
                                    </td>
                                    <td className="px-2 py-1.5">{t.category || "—"}</td>
                                    <td className="px-2 py-1.5">{t.direction || "—"}</td>
                                    <td className="px-2 py-1.5">{t.status || "—"}</td>
                                    <td className="px-2 py-1.5 text-right font-mono">
                                      {t.amount
                                        ? formatAmount(t.amount.value, t.amount.currency)
                                        : "—"}
                                    </td>
                                    <td
                                      className="px-2 py-1.5 truncate max-w-[160px]"
                                      title={t.reference || t.description || ""}
                                    >
                                      {t.reference || t.description || "—"}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </CollapsibleContent>
              </Collapsible>
            )}

            {/* Actions */}
            <div className="flex flex-wrap gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={refreshStatus} disabled={!!loading}>
                {loading === "refresh" ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCwIcon className="h-4 w-4 mr-2" />
                )}
                Refresh Status
              </Button>

              {["PENDING_HOSTED", "IN_PROGRESS", "AWAITING_DATA", "REJECTED"].includes(
                account.onboardingStatus
              ) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => doAction("link", "/api/organization/adyen-onboarding/link")}
                  disabled={!!loading}
                >
                  {loading === "link" && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  <ExternalLinkIcon className="h-4 w-4 mr-2" />
                  Onboarding Link
                </Button>
              )}

              {account.onboardingStatus === "VERIFIED" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    doAction(
                      "finalize",
                      `/api/superadmin/organizations/${organizationId}/adyen-platform`
                    )
                  }
                  disabled={!!loading}
                >
                  {loading === "finalize" ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <CheckCircle2Icon className="h-4 w-4 mr-2" />
                  )}
                  {account.storeId ? "Re-finalize Setup" : "Finalize Setup"}
                </Button>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function IdRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <span className="text-muted-foreground">{label}</span>
      <p className="font-mono text-xs truncate">
        {value || <span className="text-muted-foreground italic">—</span>}
      </p>
    </div>
  );
}

function formatAmount(
  value: number,
  currency: string,
  opts: { alreadyMajorUnits?: boolean } = {}
): string {
  const majorAmount = opts.alreadyMajorUnits ? value : value / 100;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).format(majorAmount);
  } catch {
    return `${majorAmount.toFixed(2)} ${currency}`;
  }
}
