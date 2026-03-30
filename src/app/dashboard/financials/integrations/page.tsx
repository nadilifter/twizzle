"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Check,
  ExternalLink,
  RefreshCw,
  AlertCircle,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  Unplug,
  ArrowRight,
} from "lucide-react";

type Provider = "qbo" | "xero";

interface ConnectionStatus {
  connected: boolean;
  setupComplete: boolean;
  companyName?: string;
  tenantId?: string;
  lastSyncAt?: string;
  connectedAt?: string;
  pendingSync?: number;
  failedSync?: number;
  mappingsCount?: number;
}

interface ExternalAccount {
  Id?: string;
  accountID?: string;
  Name?: string;
  name?: string;
  FullyQualifiedName?: string;
  AccountType?: string;
  type?: string;
  Active?: boolean;
}

interface MappingSuggestion {
  glCodeId: string;
  glCodeCode: string;
  glCodeDescription: string;
  glCodeType: string;
  suggestedAccountId: string | null;
  suggestedAccountName: string | null;
  confidence: "high" | "medium" | "low" | "none";
  candidates: Array<{
    accountId: string;
    accountName: string;
    accountType: string;
    score: number;
  }>;
}

interface SpecialAccountSuggestion {
  mappingType: string;
  suggestedAccountId: string | null;
  suggestedAccountName: string | null;
  confidence: "high" | "medium" | "low" | "none";
  candidates: Array<{
    accountId: string;
    accountName: string;
    accountType: string;
  }>;
}

interface SyncLog {
  id: string;
  entityType: string;
  uplifterEntityId: string;
  action: string;
  status: string;
  externalEntityId?: string;
  errorMessage?: string;
  durationMs?: number;
  createdAt: string;
}

interface SyncStatus {
  queue: { pending: number; processing: number; completed: number; failed: number };
  recentLogs: SyncLog[];
  lastSyncAt?: string;
}

const PROVIDER_CONFIG: Record<
  Provider,
  {
    label: string;
    logoText: string;
    logoBg: string;
    buttonBg: string;
    description: string;
    features: string[];
  }
> = {
  qbo: {
    label: "QuickBooks Online",
    logoText: "qb",
    logoBg: "bg-[#2CA01C]",
    buttonBg: "bg-[#2CA01C] hover:bg-[#2CA01C]/90",
    description: "Automatically sync your invoices, payments, and financial data to QuickBooks",
    features: [
      "Customers (guardians)",
      "Invoices and line items",
      "Payments received",
      "Refunds",
      "Journal entries from your ledger",
      "Adyen payout deposits",
    ],
  },
  xero: {
    label: "Xero",
    logoText: "X",
    logoBg: "bg-[#13B5EA]",
    buttonBg: "bg-[#13B5EA] hover:bg-[#13B5EA]/90",
    description: "Automatically sync your invoices, payments, and financial data to Xero",
    features: [
      "Contacts (guardians)",
      "Invoices and line items",
      "Payments received",
      "Credit notes (refunds)",
      "Manual journals from your ledger",
      "Bank transactions (payouts)",
    ],
  },
};

function normalizeAccount(
  provider: Provider,
  raw: any
): { id: string; name: string; type: string } {
  if (provider === "qbo") {
    return { id: raw.Id, name: raw.FullyQualifiedName || raw.Name, type: raw.AccountType };
  }
  return { id: raw.accountID, name: raw.name, type: raw.type || raw.class };
}

export default function IntegrationsPage() {
  const [qboStatus, setQboStatus] = useState<ConnectionStatus | null>(null);
  const [xeroStatus, setXeroStatus] = useState<ConnectionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<Provider | null>(null);

  const fetchStatuses = useCallback(async () => {
    try {
      const [qboRes, xeroRes] = await Promise.all([
        fetch("/api/integrations/qbo/status"),
        fetch("/api/integrations/xero/status"),
      ]);
      if (qboRes.ok) setQboStatus(await qboRes.json());
      if (xeroRes.ok) setXeroStatus(await xeroRes.json());
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatuses();
  }, [fetchStatuses]);

  if (loading) return <IntegrationsLoading />;

  const getState = (status: ConnectionStatus | null): "disconnected" | "setup" | "connected" =>
    !status?.connected ? "disconnected" : !status.setupComplete ? "setup" : "connected";

  const qboState = getState(qboStatus);
  const xeroState = getState(xeroStatus);

  const hasSetupInProgress = qboState === "setup" || xeroState === "setup";
  const hasActiveConnection = qboState !== "disconnected" || xeroState !== "disconnected";

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Integrations</h1>
        <p className="text-muted-foreground">
          Connect your financial data with external accounting software.
        </p>
      </div>

      {qboState === "setup" && qboStatus && (
        <SetupView provider="qbo" status={qboStatus} onComplete={fetchStatuses} />
      )}

      {xeroState === "setup" && xeroStatus && (
        <SetupView provider="xero" status={xeroStatus} onComplete={fetchStatuses} />
      )}

      {!hasSetupInProgress && (
        <div className={hasActiveConnection ? "flex flex-col gap-6" : "grid gap-6 md:grid-cols-2"}>
          {qboState === "connected" && qboStatus ? (
            <ConnectedCard provider="qbo" status={qboStatus} onDisconnect={fetchStatuses} />
          ) : qboState === "disconnected" && !hasActiveConnection ? (
            <DisconnectedCard
              provider="qbo"
              actionLoading={actionLoading === "qbo"}
              onConnect={() => {
                setActionLoading("qbo");
                window.location.href = "/api/integrations/qbo/connect";
              }}
            />
          ) : null}

          {xeroState === "connected" && xeroStatus ? (
            <ConnectedCard provider="xero" status={xeroStatus} onDisconnect={fetchStatuses} />
          ) : xeroState === "disconnected" && !hasActiveConnection ? (
            <DisconnectedCard
              provider="xero"
              actionLoading={actionLoading === "xero"}
              onConnect={() => {
                setActionLoading("xero");
                window.location.href = "/api/integrations/xero/connect";
              }}
            />
          ) : null}
        </div>
      )}
    </div>
  );
}

function DisconnectedCard({
  provider,
  actionLoading,
  onConnect,
}: {
  provider: Provider;
  actionLoading: boolean;
  onConnect: () => void;
}) {
  const config = PROVIDER_CONFIG[provider];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-4">
          <div
            className={`flex h-12 w-12 items-center justify-center rounded-lg ${config.logoBg} text-white font-bold text-xl`}
          >
            {config.logoText}
          </div>
          <div>
            <CardTitle>{config.label}</CardTitle>
            <CardDescription>{config.description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm text-muted-foreground space-y-2">
          <p>Connect your {config.label} account to automatically sync:</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            {config.features.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
          <p className="mt-3">
            After connecting, you&apos;ll map your GL codes to {config.label} accounts. We&apos;ll
            auto-suggest the best matches to save you time.
          </p>
        </div>
      </CardContent>
      <CardFooter>
        <Button
          className={`w-full ${config.buttonBg}`}
          disabled={actionLoading}
          onClick={onConnect}
        >
          {actionLoading ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <ExternalLink className="h-4 w-4 mr-2" />
          )}
          Connect to {config.label}
        </Button>
      </CardFooter>
    </Card>
  );
}

function SetupView({
  provider,
  status,
  onComplete,
}: {
  provider: Provider;
  status: ConnectionStatus;
  onComplete: () => void;
}) {
  const config = PROVIDER_CONFIG[provider];
  const [suggestions, setSuggestions] = useState<{
    glCodeMappings: MappingSuggestion[];
    specialAccounts: SpecialAccountSuggestion[];
  } | null>(null);
  const [accounts, setAccounts] = useState<Array<{ id: string; name: string; type: string }>>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(true);
  const [saving, setSaving] = useState(false);

  const [glMappings, setGlMappings] = useState<Record<string, { id: string; name: string }>>({});
  const [specialMappings, setSpecialMappings] = useState<
    Record<string, { id: string; name: string }>
  >({});

  useEffect(() => {
    async function loadData() {
      try {
        const [suggestRes, accountsRes] = await Promise.all([
          fetch(`/api/integrations/${provider}/mappings/auto-suggest`, { method: "POST" }),
          fetch(`/api/integrations/${provider}/accounts`),
        ]);

        if (suggestRes.ok && accountsRes.ok) {
          const suggestData = await suggestRes.json();
          const accountsData = await accountsRes.json();

          setSuggestions(suggestData);

          const normalizedAccounts = (accountsData.accounts || []).map((a: any) =>
            normalizeAccount(provider, a)
          );
          setAccounts(normalizedAccounts);

          const preGl: Record<string, { id: string; name: string }> = {};
          for (const s of suggestData.glCodeMappings) {
            if (s.suggestedAccountId && (s.confidence === "high" || s.confidence === "medium")) {
              preGl[s.glCodeId] = { id: s.suggestedAccountId, name: s.suggestedAccountName || "" };
            }
          }
          setGlMappings(preGl);

          const preSp: Record<string, { id: string; name: string }> = {};
          for (const s of suggestData.specialAccounts) {
            if (s.suggestedAccountId && s.confidence !== "none") {
              preSp[s.mappingType] = {
                id: s.suggestedAccountId,
                name: s.suggestedAccountName || "",
              };
            }
          }
          setSpecialMappings(preSp);
        }
      } catch (error) {
        console.error("Failed to load suggestions:", error);
      } finally {
        setLoadingSuggestions(false);
      }
    }
    loadData();
  }, [provider]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const mappings = [
        ...Object.entries(glMappings).map(([glCodeId, acct]) => ({
          mappingType: "GL_CODE" as const,
          uplifterEntityId: glCodeId,
          externalAccountId: acct.id,
          externalAccountName: acct.name,
        })),
        ...Object.entries(specialMappings).map(([type, acct]) => ({
          mappingType: type as any,
          uplifterEntityId: null,
          externalAccountId: acct.id,
          externalAccountName: acct.name,
        })),
      ];

      const res = await fetch(`/api/integrations/${provider}/mappings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mappings }),
      });

      if (res.ok) {
        await fetch(`/api/integrations/${provider}/sync`, { method: "POST" });
        onComplete();
      }
    } catch (error) {
      console.error("Failed to save mappings:", error);
    } finally {
      setSaving(false);
    }
  };

  const confidenceBadge = (c: string) => {
    switch (c) {
      case "high":
        return (
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs">
            Auto-matched
          </Badge>
        );
      case "medium":
        return (
          <Badge
            variant="outline"
            className="bg-yellow-50 text-yellow-700 border-yellow-200 text-xs"
          >
            Suggested
          </Badge>
        );
      case "low":
        return (
          <Badge
            variant="outline"
            className="bg-orange-50 text-orange-700 border-orange-200 text-xs"
          >
            Review
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-xs">
            Select account
          </Badge>
        );
    }
  };

  const specialLabels: Record<string, { label: string; desc: string }> = {
    BANK_ACCOUNT: { label: "Bank Account", desc: "Where Adyen deposits land" },
    PROCESSING_FEES: { label: "Processing Fees", desc: "Adyen/card processing fees" },
    REFUNDS: { label: "Refunds Account", desc: "Account for refund transactions" },
    UNDEPOSITED_FUNDS: { label: "Undeposited Funds", desc: "Payments pending settlement" },
  };

  const getAccountsByType = (types: string[]) => accounts.filter((a) => types.includes(a.type));

  return (
    <div className="space-y-6 max-w-4xl">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-lg ${config.logoBg} text-white font-bold`}
              >
                {config.logoText}
              </div>
              <div>
                <CardTitle className="text-lg">
                  Map Your Accounts
                  {status.companyName && (
                    <span className="text-muted-foreground font-normal">
                      {" "}
                      — {status.companyName}
                    </span>
                  )}
                </CardTitle>
                <CardDescription>
                  Review the suggested mappings below. Adjust any that don&apos;t look right, then
                  confirm.
                </CardDescription>
              </div>
            </div>
            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
              Setup Required
            </Badge>
          </div>
        </CardHeader>
      </Card>

      {loadingSuggestions ? (
        <Card>
          <CardContent className="py-8 space-y-4">
            <Skeleton className="h-4 w-64" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Special Accounts</CardTitle>
              <CardDescription>
                These accounts are used for deposits, fees, and refunds.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {suggestions?.specialAccounts.map((sa) => {
                  const info = specialLabels[sa.mappingType];
                  if (!info) return null;

                  let accountOptions = sa.candidates;
                  if (accountOptions.length === 0) {
                    if (sa.mappingType === "BANK_ACCOUNT") {
                      accountOptions = getAccountsByType(
                        provider === "qbo" ? ["Bank"] : ["BANK"]
                      ).map((a) => ({
                        accountId: a.id,
                        accountName: a.name,
                        accountType: a.type,
                      }));
                    } else if (sa.mappingType === "PROCESSING_FEES") {
                      accountOptions = getAccountsByType(
                        provider === "qbo" ? ["Expense", "Other Expense"] : ["EXPENSE"]
                      ).map((a) => ({
                        accountId: a.id,
                        accountName: a.name,
                        accountType: a.type,
                      }));
                    } else {
                      accountOptions = accounts.map((a) => ({
                        accountId: a.id,
                        accountName: a.name,
                        accountType: a.type,
                      }));
                    }
                  }

                  return (
                    <div key={sa.mappingType} className="flex items-center gap-4">
                      <div className="w-48 shrink-0">
                        <div className="font-medium text-sm">{info.label}</div>
                        <div className="text-xs text-muted-foreground">{info.desc}</div>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                      <Select
                        value={specialMappings[sa.mappingType]?.id || ""}
                        onValueChange={(val) => {
                          const acct = accountOptions.find((a) => a.accountId === val);
                          if (acct) {
                            setSpecialMappings((prev) => ({
                              ...prev,
                              [sa.mappingType]: { id: acct.accountId, name: acct.accountName },
                            }));
                          }
                        }}
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Select account..." />
                        </SelectTrigger>
                        <SelectContent>
                          {accountOptions.map((a) => (
                            <SelectItem key={a.accountId} value={a.accountId}>
                              {a.accountName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {confidenceBadge(sa.confidence)}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Revenue &amp; Expense Accounts</CardTitle>
              <CardDescription>
                Map each GL code to its corresponding {config.label} account.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-24">Code</TableHead>
                    <TableHead className="w-48">Description</TableHead>
                    <TableHead className="w-24">Type</TableHead>
                    <TableHead>{config.label} Account</TableHead>
                    <TableHead className="w-28">Match</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {suggestions?.glCodeMappings.map((gl) => {
                    const options =
                      gl.candidates.length > 0
                        ? gl.candidates
                        : accounts.map((a) => ({
                            accountId: a.id,
                            accountName: a.name,
                            accountType: a.type,
                            score: 0,
                          }));

                    return (
                      <TableRow key={gl.glCodeId}>
                        <TableCell className="font-mono text-sm">{gl.glCodeCode}</TableCell>
                        <TableCell className="text-sm">{gl.glCodeDescription}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-xs">
                            {gl.glCodeType}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={glMappings[gl.glCodeId]?.id || ""}
                            onValueChange={(val) => {
                              const acct = options.find((a) => a.accountId === val);
                              if (acct) {
                                setGlMappings((prev) => ({
                                  ...prev,
                                  [gl.glCodeId]: { id: acct.accountId, name: acct.accountName },
                                }));
                              }
                            }}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select account..." />
                            </SelectTrigger>
                            <SelectContent>
                              {options.map((a) => (
                                <SelectItem key={a.accountId} value={a.accountId}>
                                  {a.accountName}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>{confidenceBadge(gl.confidence)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => {
                window.location.href = `/api/integrations/${provider}/connect`;
              }}
            >
              Reconnect
            </Button>
            <Button
              className={config.buttonBg}
              disabled={saving || Object.keys(glMappings).length === 0}
              onClick={handleSave}
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Check className="h-4 w-4 mr-2" />
              )}
              Confirm Mappings &amp; Start Sync
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function ConnectedCard({
  provider,
  status,
  onDisconnect,
}: {
  provider: Provider;
  status: ConnectionStatus;
  onDisconnect: () => void;
}) {
  const config = PROVIDER_CONFIG[provider];
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [loadingSync, setLoadingSync] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [showLogs, setShowLogs] = useState(false);

  useEffect(() => {
    fetchSyncStatus();
  }, []);

  async function fetchSyncStatus() {
    try {
      const res = await fetch(`/api/integrations/${provider}/sync/status`);
      if (res.ok) setSyncStatus(await res.json());
    } catch {
      // ignore
    } finally {
      setLoadingSync(false);
    }
  }

  async function triggerSync() {
    setSyncing(true);
    try {
      await fetch(`/api/integrations/${provider}/sync`, { method: "POST" });
      await fetchSyncStatus();
    } finally {
      setSyncing(false);
    }
  }

  async function handleDisconnect() {
    if (
      !confirm(
        `Are you sure you want to disconnect ${config.label}? All sync mappings will be removed.`
      )
    )
      return;
    setDisconnecting(true);
    try {
      await fetch(`/api/integrations/${provider}/disconnect`, { method: "POST" });
      onDisconnect();
    } finally {
      setDisconnecting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-lg ${config.logoBg} text-white font-bold`}
            >
              {config.logoText}
            </div>
            <div>
              <CardTitle className="text-lg">
                {config.label}
                {status.companyName && (
                  <span className="text-muted-foreground font-normal text-sm">
                    {" "}
                    — {status.companyName}
                  </span>
                )}
              </CardTitle>
              <CardDescription>
                Connected{" "}
                {status.connectedAt && `since ${new Date(status.connectedAt).toLocaleDateString()}`}
              </CardDescription>
            </div>
          </div>
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Connected
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-6 text-sm">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Clock className="h-4 w-4" />
            Last sync: {status.lastSyncAt ? new Date(status.lastSyncAt).toLocaleString() : "Never"}
          </div>
        </div>

        {!loadingSync && syncStatus && (
          <div className="grid grid-cols-4 gap-2">
            <MiniStatusCard
              label="Pending"
              count={syncStatus.queue.pending}
              icon={<Clock className="h-3.5 w-3.5 text-yellow-500" />}
            />
            <MiniStatusCard
              label="Processing"
              count={syncStatus.queue.processing}
              icon={<Loader2 className="h-3.5 w-3.5 text-blue-500 animate-spin" />}
            />
            <MiniStatusCard
              label="Completed"
              count={syncStatus.queue.completed}
              icon={<CheckCircle2 className="h-3.5 w-3.5 text-green-500" />}
            />
            <MiniStatusCard
              label="Failed"
              count={syncStatus.queue.failed}
              icon={<XCircle className="h-3.5 w-3.5 text-red-500" />}
            />
          </div>
        )}

        {showLogs && syncStatus && syncStatus.recentLogs.length > 0 && (
          <div className="border rounded-md overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>ID</TableHead>
                  <TableHead>Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {syncStatus.recentLogs.slice(0, 10).map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs font-mono">
                        {log.entityType}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {log.status === "COMPLETED" ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                      ) : (
                        <XCircle className="h-3.5 w-3.5 text-red-500" />
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {log.externalEntityId || "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(log.createdAt).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
      <CardFooter className="gap-2 flex-wrap">
        <Button variant="outline" size="sm" onClick={triggerSync} disabled={syncing}>
          {syncing ? (
            <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-1.5" />
          )}
          Sync Now
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setShowLogs(!showLogs)}>
          {showLogs ? "Hide" : "Show"} Logs
        </Button>
        <div className="flex-1" />
        <Button
          variant="outline"
          size="sm"
          className="text-red-600 hover:text-red-600 hover:bg-red-50"
          onClick={handleDisconnect}
          disabled={disconnecting}
        >
          {disconnecting ? (
            <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
          ) : (
            <Unplug className="h-4 w-4 mr-1.5" />
          )}
          Disconnect
        </Button>
      </CardFooter>
    </Card>
  );
}

function MiniStatusCard({
  label,
  count,
  icon,
}: {
  label: string;
  count: number;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 rounded-md border p-2">
      {icon}
      <div>
        <div className="text-lg font-bold leading-none">{count}</div>
        <div className="text-[10px] text-muted-foreground">{label}</div>
      </div>
    </div>
  );
}

function IntegrationsLoading() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-96" />
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    </div>
  );
}
