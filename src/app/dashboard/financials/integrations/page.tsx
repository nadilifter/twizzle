"use client"

import { useEffect, useState, useCallback } from "react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
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
} from "lucide-react"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface QboStatus {
  connected: boolean
  setupComplete: boolean
  companyName?: string
  realmId?: string
  lastSyncAt?: string
  connectedAt?: string
  pendingSync?: number
  failedSync?: number
  mappingsCount?: number
}

interface QboAccount {
  Id: string
  Name: string
  FullyQualifiedName: string
  AccountType: string
  AccountSubType: string
  Active: boolean
}

interface MappingSuggestion {
  glCodeId: string
  glCodeCode: string
  glCodeDescription: string
  glCodeType: string
  suggestedQboAccountId: string | null
  suggestedQboAccountName: string | null
  confidence: "high" | "medium" | "low" | "none"
  candidates: Array<{
    qboAccountId: string
    qboAccountName: string
    accountType: string
    score: number
  }>
}

interface SpecialAccountSuggestion {
  mappingType: string
  suggestedQboAccountId: string | null
  suggestedQboAccountName: string | null
  confidence: "high" | "medium" | "low" | "none"
  candidates: Array<{
    qboAccountId: string
    qboAccountName: string
    accountType: string
  }>
}

interface SyncLog {
  id: string
  entityType: string
  uplifterEntityId: string
  action: string
  status: string
  qboEntityId?: string
  errorMessage?: string
  durationMs?: number
  createdAt: string
}

interface SyncStatus {
  queue: { pending: number; processing: number; completed: number; failed: number }
  recentLogs: SyncLog[]
  lastSyncAt?: string
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function IntegrationsPage() {
  const [status, setStatus] = useState<QboStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/integrations/qbo/status")
      if (res.ok) setStatus(await res.json())
    } catch {
      // Silently fail - status will show disconnected
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStatus()
  }, [fetchStatus])

  if (loading) return <IntegrationsLoading />

  const state: "disconnected" | "setup" | "connected" =
    !status?.connected ? "disconnected" : !status.setupComplete ? "setup" : "connected"

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Integrations</h1>
        <p className="text-muted-foreground">
          Connect your financial data with external accounting software.
        </p>
      </div>

      {state === "disconnected" && (
        <div className="grid gap-6 md:grid-cols-2">
          <DisconnectedView setActionLoading={setActionLoading} actionLoading={actionLoading} />
          <XeroComingSoon />
        </div>
      )}
      {state === "setup" && status && <SetupView status={status} onComplete={fetchStatus} />}
      {state === "connected" && status && <ConnectedView status={status} onDisconnect={fetchStatus} />}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Disconnected state
// ---------------------------------------------------------------------------

function DisconnectedView({
  setActionLoading,
  actionLoading,
}: {
  setActionLoading: (v: boolean) => void
  actionLoading: boolean
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#2CA01C] text-white font-bold text-xl">
            qb
          </div>
          <div>
            <CardTitle>QuickBooks Online</CardTitle>
            <CardDescription>
              Automatically sync your invoices, payments, and financial data to QuickBooks
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm text-muted-foreground space-y-2">
          <p>Connect your QuickBooks Online account to automatically sync:</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Customers (guardians)</li>
            <li>Invoices and line items</li>
            <li>Payments received</li>
            <li>Refunds</li>
            <li>Journal entries from your ledger</li>
            <li>Adyen payout deposits</li>
          </ul>
          <p className="mt-3">
            After connecting, you&apos;ll map your GL codes to QuickBooks accounts.
            We&apos;ll auto-suggest the best matches to save you time.
          </p>
        </div>
      </CardContent>
      <CardFooter>
        <Button
          className="w-full bg-[#2CA01C] hover:bg-[#2CA01C]/90"
          disabled={actionLoading}
          onClick={() => {
            setActionLoading(true)
            window.location.href = "/api/integrations/qbo/connect"
          }}
        >
          {actionLoading ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <ExternalLink className="h-4 w-4 mr-2" />
          )}
          Connect to QuickBooks
        </Button>
      </CardFooter>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Setup state: account mapping with auto-suggest
// ---------------------------------------------------------------------------

function SetupView({ status, onComplete }: { status: QboStatus; onComplete: () => void }) {
  const [suggestions, setSuggestions] = useState<{
    glCodeMappings: MappingSuggestion[]
    specialAccounts: SpecialAccountSuggestion[]
  } | null>(null)
  const [qboAccounts, setQboAccounts] = useState<QboAccount[]>([])
  const [loadingSuggestions, setLoadingSuggestions] = useState(true)
  const [saving, setSaving] = useState(false)

  // Selected mappings: glCodeId -> qboAccountId
  const [glMappings, setGlMappings] = useState<Record<string, { id: string; name: string }>>({})
  // Special account selections: mappingType -> qboAccountId
  const [specialMappings, setSpecialMappings] = useState<Record<string, { id: string; name: string }>>({})

  useEffect(() => {
    async function loadData() {
      try {
        const [suggestRes, accountsRes] = await Promise.all([
          fetch("/api/integrations/qbo/mappings/auto-suggest", { method: "POST" }),
          fetch("/api/integrations/qbo/accounts"),
        ])

        if (suggestRes.ok && accountsRes.ok) {
          const suggestData = await suggestRes.json()
          const accountsData = await accountsRes.json()

          setSuggestions(suggestData)
          setQboAccounts(accountsData.accounts || [])

          // Pre-populate selections from suggestions
          const preGl: Record<string, { id: string; name: string }> = {}
          for (const s of suggestData.glCodeMappings) {
            if (s.suggestedQboAccountId && (s.confidence === "high" || s.confidence === "medium")) {
              preGl[s.glCodeId] = { id: s.suggestedQboAccountId, name: s.suggestedQboAccountName || "" }
            }
          }
          setGlMappings(preGl)

          const preSp: Record<string, { id: string; name: string }> = {}
          for (const s of suggestData.specialAccounts) {
            if (s.suggestedQboAccountId && s.confidence !== "none") {
              preSp[s.mappingType] = { id: s.suggestedQboAccountId, name: s.suggestedQboAccountName || "" }
            }
          }
          setSpecialMappings(preSp)
        }
      } catch (error) {
        console.error("Failed to load suggestions:", error)
      } finally {
        setLoadingSuggestions(false)
      }
    }
    loadData()
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      const mappings = [
        ...Object.entries(glMappings).map(([glCodeId, acct]) => ({
          mappingType: "GL_CODE" as const,
          uplifterEntityId: glCodeId,
          qboAccountId: acct.id,
          qboAccountName: acct.name,
        })),
        ...Object.entries(specialMappings).map(([type, acct]) => ({
          mappingType: type as any,
          uplifterEntityId: null,
          qboAccountId: acct.id,
          qboAccountName: acct.name,
        })),
      ]

      const res = await fetch("/api/integrations/qbo/mappings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mappings }),
      })

      if (res.ok) {
        // Trigger initial sync
        await fetch("/api/integrations/qbo/sync", { method: "POST" })
        onComplete()
      }
    } catch (error) {
      console.error("Failed to save mappings:", error)
    } finally {
      setSaving(false)
    }
  }

  const confidenceBadge = (c: string) => {
    switch (c) {
      case "high":
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs">Auto-matched</Badge>
      case "medium":
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200 text-xs">Suggested</Badge>
      case "low":
        return <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200 text-xs">Review</Badge>
      default:
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-xs">Select account</Badge>
    }
  }

  const specialLabels: Record<string, { label: string; desc: string }> = {
    BANK_ACCOUNT: { label: "Bank Account", desc: "Where Adyen deposits land" },
    PROCESSING_FEES: { label: "Processing Fees", desc: "Adyen/card processing fees" },
    REFUNDS: { label: "Refunds Account", desc: "Account for refund transactions" },
    UNDEPOSITED_FUNDS: { label: "Undeposited Funds", desc: "Payments pending settlement" },
  }

  const getAccountsByType = (types: string[]) =>
    qboAccounts.filter((a) => types.includes(a.AccountType))

  return (
    <div className="space-y-6 max-w-4xl">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#2CA01C] text-white font-bold">
                qb
              </div>
              <div>
                <CardTitle className="text-lg">
                  Map Your Accounts
                  {status.companyName && (
                    <span className="text-muted-foreground font-normal"> — {status.companyName}</span>
                  )}
                </CardTitle>
                <CardDescription>
                  Review the suggested mappings below. Adjust any that don&apos;t look right, then confirm.
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
          {/* Special accounts */}
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
                  const info = specialLabels[sa.mappingType]
                  if (!info) return null

                  let accountOptions = sa.candidates
                  if (accountOptions.length === 0) {
                    if (sa.mappingType === "BANK_ACCOUNT") {
                      accountOptions = getAccountsByType(["Bank"]).map((a) => ({
                        qboAccountId: a.Id,
                        qboAccountName: a.FullyQualifiedName,
                        accountType: a.AccountType,
                      }))
                    } else if (sa.mappingType === "PROCESSING_FEES") {
                      accountOptions = getAccountsByType(["Expense", "Other Expense"]).map((a) => ({
                        qboAccountId: a.Id,
                        qboAccountName: a.FullyQualifiedName,
                        accountType: a.AccountType,
                      }))
                    } else {
                      accountOptions = qboAccounts.map((a) => ({
                        qboAccountId: a.Id,
                        qboAccountName: a.FullyQualifiedName,
                        accountType: a.AccountType,
                      }))
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
                          const acct = accountOptions.find((a) => a.qboAccountId === val)
                          if (acct) {
                            setSpecialMappings((prev) => ({
                              ...prev,
                              [sa.mappingType]: { id: acct.qboAccountId, name: acct.qboAccountName },
                            }))
                          }
                        }}
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Select QBO account..." />
                        </SelectTrigger>
                        <SelectContent>
                          {accountOptions.map((a) => (
                            <SelectItem key={a.qboAccountId} value={a.qboAccountId}>
                              {a.qboAccountName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {confidenceBadge(sa.confidence)}
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          {/* GL code mappings */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Revenue &amp; Expense Accounts</CardTitle>
              <CardDescription>
                Map each GL code to its corresponding QuickBooks account.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-24">Code</TableHead>
                    <TableHead className="w-48">Description</TableHead>
                    <TableHead className="w-24">Type</TableHead>
                    <TableHead>QuickBooks Account</TableHead>
                    <TableHead className="w-28">Match</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {suggestions?.glCodeMappings.map((gl) => {
                    const allowedTypes = GL_TYPE_MAP[gl.glCodeType] || []
                    const options =
                      gl.candidates.length > 0
                        ? gl.candidates
                        : qboAccounts
                            .filter((a) => allowedTypes.includes(a.AccountType))
                            .map((a) => ({
                              qboAccountId: a.Id,
                              qboAccountName: a.FullyQualifiedName,
                              accountType: a.AccountType,
                              score: 0,
                            }))

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
                              const acct = options.find((a) => a.qboAccountId === val)
                              if (acct) {
                                setGlMappings((prev) => ({
                                  ...prev,
                                  [gl.glCodeId]: { id: acct.qboAccountId, name: acct.qboAccountName },
                                }))
                              }
                            }}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select account..." />
                            </SelectTrigger>
                            <SelectContent>
                              {options.map((a) => (
                                <SelectItem key={a.qboAccountId} value={a.qboAccountId}>
                                  {a.qboAccountName}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>{confidenceBadge(gl.confidence)}</TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Confirm */}
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => {
                window.location.href = "/api/integrations/qbo/connect"
              }}
            >
              Reconnect
            </Button>
            <Button
              className="bg-[#2CA01C] hover:bg-[#2CA01C]/90"
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
  )
}

const GL_TYPE_MAP: Record<string, string[]> = {
  REVENUE: ["Income", "Other Income"],
  EXPENSE: ["Expense", "Other Expense", "Cost of Goods Sold"],
  ASSET: ["Other Current Asset", "Fixed Asset", "Other Asset", "Bank"],
  LIABILITY: ["Other Current Liability", "Long Term Liability", "Credit Card"],
  EQUITY: ["Equity"],
}

// ---------------------------------------------------------------------------
// Connected state: sync dashboard
// ---------------------------------------------------------------------------

function ConnectedView({ status, onDisconnect }: { status: QboStatus; onDisconnect: () => void }) {
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null)
  const [loadingSync, setLoadingSync] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)

  useEffect(() => {
    fetchSyncStatus()
  }, [])

  async function fetchSyncStatus() {
    try {
      const res = await fetch("/api/integrations/qbo/sync/status")
      if (res.ok) setSyncStatus(await res.json())
    } catch {
      // ignore
    } finally {
      setLoadingSync(false)
    }
  }

  async function triggerSync() {
    setSyncing(true)
    try {
      await fetch("/api/integrations/qbo/sync", { method: "POST" })
      await fetchSyncStatus()
    } finally {
      setSyncing(false)
    }
  }

  async function handleDisconnect() {
    if (!confirm("Are you sure you want to disconnect QuickBooks? All sync mappings will be removed.")) return
    setDisconnecting(true)
    try {
      await fetch("/api/integrations/qbo/disconnect", { method: "POST" })
      onDisconnect()
    } finally {
      setDisconnecting(false)
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Connection info */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#2CA01C] text-white font-bold">
                qb
              </div>
              <div>
                <CardTitle className="text-lg">
                  QuickBooks Online
                  {status.companyName && (
                    <span className="text-muted-foreground font-normal"> — {status.companyName}</span>
                  )}
                </CardTitle>
                <CardDescription>
                  Connected {status.connectedAt && `since ${new Date(status.connectedAt).toLocaleDateString()}`}
                </CardDescription>
              </div>
            </div>
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Connected
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Clock className="h-4 w-4" />
              Last sync: {status.lastSyncAt ? new Date(status.lastSyncAt).toLocaleString() : "Never"}
            </div>
            {(status.pendingSync ?? 0) > 0 && (
              <div className="flex items-center gap-1.5 text-yellow-600">
                <AlertCircle className="h-4 w-4" />
                {status.pendingSync} pending
              </div>
            )}
            {(status.failedSync ?? 0) > 0 && (
              <div className="flex items-center gap-1.5 text-red-600">
                <XCircle className="h-4 w-4" />
                {status.failedSync} failed
              </div>
            )}
          </div>
        </CardContent>
        <CardFooter className="gap-3">
          <Button
            variant="outline"
            onClick={triggerSync}
            disabled={syncing}
          >
            {syncing ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Sync Now
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <a href="/dashboard/financials/integrations?edit_mappings=true">
              Edit Mappings
            </a>
          </Button>
          <div className="flex-1" />
          <Button
            variant="outline"
            className="text-red-600 hover:text-red-600 hover:bg-red-50"
            onClick={handleDisconnect}
            disabled={disconnecting}
          >
            {disconnecting ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Unplug className="h-4 w-4 mr-2" />
            )}
            Disconnect
          </Button>
        </CardFooter>
      </Card>

      {/* Sync queue status */}
      {loadingSync ? (
        <Card>
          <CardContent className="py-6">
            <Skeleton className="h-4 w-48 mb-4" />
            <Skeleton className="h-20 w-full" />
          </CardContent>
        </Card>
      ) : syncStatus && (
        <>
          <div className="grid grid-cols-4 gap-4">
            <StatusCard label="Pending" count={syncStatus.queue.pending} icon={<Clock className="h-4 w-4 text-yellow-500" />} />
            <StatusCard label="Processing" count={syncStatus.queue.processing} icon={<Loader2 className="h-4 w-4 text-blue-500 animate-spin" />} />
            <StatusCard label="Completed" count={syncStatus.queue.completed} icon={<CheckCircle2 className="h-4 w-4 text-green-500" />} />
            <StatusCard label="Failed" count={syncStatus.queue.failed} icon={<XCircle className="h-4 w-4 text-red-500" />} />
          </div>

          {/* Recent sync logs */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent Sync Activity</CardTitle>
            </CardHeader>
            <CardContent>
              {syncStatus.recentLogs.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No sync activity yet. Click &quot;Sync Now&quot; to start.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>QBO ID</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Time</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {syncStatus.recentLogs.slice(0, 20).map((log) => (
                      <TableRow key={log.id}>
                        <TableCell>
                          <Badge variant="secondary" className="text-xs font-mono">
                            {log.entityType}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">{log.action}</TableCell>
                        <TableCell>
                          {log.status === "COMPLETED" ? (
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              OK
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-xs">
                              <XCircle className="h-3 w-3 mr-1" />
                              Failed
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {log.qboEntityId || "—"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {log.durationMs ? `${log.durationMs}ms` : "—"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(log.createdAt).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}

function StatusCard({ label, count, icon }: { label: string; count: number; icon: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 py-4 px-4">
        {icon}
        <div>
          <div className="text-2xl font-bold">{count}</div>
          <div className="text-xs text-muted-foreground">{label}</div>
        </div>
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Xero coming soon
// ---------------------------------------------------------------------------

function XeroComingSoon() {
  return (
    <Card className="opacity-60">
      <CardHeader>
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#13B5EA] text-white font-bold text-xl">
            X
          </div>
          <div className="flex-1">
            <CardTitle>Xero</CardTitle>
            <CardDescription>Beautiful accounting software</CardDescription>
          </div>
          <Badge variant="secondary">Coming Soon</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Xero integration is on our roadmap. Sync your invoices, payments, and financial data directly to Xero.
        </p>
      </CardContent>
      <CardFooter>
        <Button className="w-full" disabled>
          Connect to Xero
        </Button>
      </CardFooter>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function IntegrationsLoading() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-96" />
      </div>
      <Skeleton className="h-64 w-full max-w-2xl" />
    </div>
  )
}
