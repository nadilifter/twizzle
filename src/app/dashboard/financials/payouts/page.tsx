"use client";

import React, { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DownloadIcon,
  LandmarkIcon,
  ArrowUpRightIcon,
  Loader2,
  ChevronLeftIcon,
  ChevronRightIcon,
  InfoIcon,
  AlertCircleIcon,
  RefreshCwIcon,
  Calendar as CalendarIcon,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { format } from "date-fns";
import { toast } from "sonner";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface Payout {
  id: string;
  reference: string;
  amount: number;
  fees: number;
  net: number;
  currency: string;
  status: "PENDING" | "SCHEDULED" | "PAID" | "FAILED";
  payoutType: "MANUAL" | "SWEEP";
  bankAccount: string | null;
  scheduledAt: string | null;
  paidAt: string | null;
  estimatedArrivalTime: string | null;
  createdAt: string;
}

interface PayoutStats {
  pendingAmount: number;
  pendingCount: number;
  paidYTD: number;
  nextPayout: Payout | null;
  liveBalance: {
    available: number;
    pending: number;
    reserved: number;
    balance: number;
    currency: string;
  } | null;
  isVerified: boolean;
  unsettledAmount: number;
  unsettledCount: number;
}

const PAGE_SIZE = 20;
const SYNC_THROTTLE_MS = 30 * 60 * 1000;

function getSyncThrottleKey(organizationId: string) {
  return `payout-sync-last:${organizationId}`;
}

type PayoutCache = {
  stats: PayoutStats;
  payouts: Payout[];
  total: number;
};

function getPayoutCacheKey(organizationId: string) {
  return `payout-cache:${organizationId}`;
}

function readPayoutCache(organizationId: string): PayoutCache | null {
  try {
    const raw = localStorage.getItem(getPayoutCacheKey(organizationId));
    return raw ? (JSON.parse(raw) as PayoutCache) : null;
  } catch {
    return null;
  }
}

function writePayoutCache(organizationId: string, data: PayoutCache) {
  try {
    localStorage.setItem(getPayoutCacheKey(organizationId), JSON.stringify(data));
  } catch {
    // storage quota exceeded — ignore
  }
}

const statusColors: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  PENDING: "outline",
  SCHEDULED: "secondary",
  PAID: "default",
  FAILED: "destructive",
};

export default function PayoutsPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const orgId = session?.user?.organizationId ?? null;
  const [payouts, setPayouts] = React.useState<Payout[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [backgroundRefreshing, setBackgroundRefreshing] = React.useState(false);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(0);
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [startDate, setStartDate] = React.useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = React.useState<Date | undefined>(undefined);
  const [stats, setStats] = React.useState<PayoutStats>({
    pendingAmount: 0,
    pendingCount: 0,
    paidYTD: 0,
    nextPayout: null,
    liveBalance: null,
    isVerified: false,
    unsettledAmount: 0,
    unsettledCount: 0,
  });

  const [payoutSchedule, setPayoutSchedule] = React.useState<string>("daily");
  const [hasSweep, setHasSweep] = React.useState(false);
  const [isVerified, setIsVerified] = React.useState(false);
  const [wasVerified, setWasVerified] = React.useState(false);
  const [scheduleLoading, setScheduleLoading] = React.useState(false);

  useEffect(() => {
    async function fetchSchedule() {
      try {
        const res = await fetch("/api/organization/adyen-onboarding");
        if (!res.ok) return;
        const data = await res.json();
        if (data.account) {
          setPayoutSchedule(data.account.payoutSchedule ?? "daily");
          setHasSweep(!!data.account.hasSweep);
          setIsVerified(data.account.onboardingStatus === "VERIFIED");
          setWasVerified(!!data.account.verifiedAt);
        }
      } catch {
        // best-effort; don't block the page
      }
    }
    fetchSchedule();
  }, []);
  const [syncLoading, setSyncLoading] = React.useState(false);
  const skipFilterFetch = React.useRef(true);
  const hasInitialized = React.useRef(false);

  const handleScheduleChange = async (value: string) => {
    setScheduleLoading(true);
    try {
      const res = await fetch("/api/organization/adyen-onboarding/sweep", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schedule: value }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update payout schedule");
      }
      setPayoutSchedule(value);
      toast.success(`Payout schedule updated to ${value}`);
    } catch (e: any) {
      toast.error(e.message || "Failed to update payout schedule");
    } finally {
      setScheduleLoading(false);
    }
  };

  const fetchPayouts = React.useCallback(
    async ({ silent = false }: { silent?: boolean } = {}) => {
      const isDefaultView = page === 0 && statusFilter === "all" && !startDate && !endDate;
      if (silent) {
        setBackgroundRefreshing(true);
      } else {
        setLoading(true);
      }
      try {
        const params = new URLSearchParams();
        params.set("limit", String(PAGE_SIZE));
        params.set("offset", String(page * PAGE_SIZE));
        if (statusFilter && statusFilter !== "all") {
          params.set("status", statusFilter);
        }
        if (startDate) params.set("startDate", format(startDate, "yyyy-MM-dd"));
        if (endDate) params.set("endDate", format(endDate, "yyyy-MM-dd"));

        const response = await fetch(`/api/payouts?${params}`);
        if (!response.ok) throw new Error("Failed to fetch payouts");

        const data = await response.json();
        setPayouts(data.data);
        setTotal(data.total);
        setStats(data.stats);

        if (isDefaultView && orgId) {
          writePayoutCache(orgId, { stats: data.stats, payouts: data.data, total: data.total });
        }
      } catch (error) {
        console.error("Error fetching payouts:", error);
        if (!silent) toast.error("Failed to load payouts");
      } finally {
        setLoading(false);
        setBackgroundRefreshing(false);
      }
    },
    [page, statusFilter, startDate, endDate, orgId]
  );

  useEffect(() => {
    async function init() {
      // Seed from cache immediately so the UI has values before the network responds
      const cached = orgId ? readPayoutCache(orgId) : null;
      if (cached) {
        setStats(cached.stats);
        setPayouts(cached.payouts);
        setTotal(cached.total);
        setLoading(false);
      }

      let verified = false;
      try {
        const res = await fetch("/api/organization/adyen-onboarding");
        if (res.ok) {
          const data = await res.json();
          if (data.account) {
            setPayoutSchedule(data.account.payoutSchedule ?? "daily");
            setHasSweep(!!data.account.hasSweep);
            verified = data.account.onboardingStatus === "VERIFIED";
            setIsVerified(verified);
          }
        }
      } catch {
        // best-effort
      }

      if (verified && orgId) {
        try {
          const throttleKey = getSyncThrottleKey(orgId);
          const lastSync = localStorage.getItem(throttleKey);
          const withinWindow = lastSync && Date.now() - Number(lastSync) < SYNC_THROTTLE_MS;

          if (!withinWindow) {
            const syncRes = await fetch("/api/payouts/sync", { method: "POST" });
            if (syncRes.ok) {
              localStorage.setItem(throttleKey, String(Date.now()));
            }
          }
        } catch {
          // best-effort; don't block payouts load
        }
      }

      // If we already seeded from cache, refresh silently in the background
      fetchPayouts({ silent: !!cached });
    }
    if (hasInitialized.current || !orgId) return;
    hasInitialized.current = true;
    init();
  }, [orgId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-fetch when filters or page change; skip the mount fire (handled by init above)
  useEffect(() => {
    if (skipFilterFetch.current) {
      skipFilterFetch.current = false;
      return;
    }
    fetchPayouts({ silent: payouts.length > 0 });
  }, [fetchPayouts]); // eslint-disable-line react-hooks/exhaustive-deps

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const handleManualSync = async () => {
    setSyncLoading(true);
    try {
      const res = await fetch("/api/payouts/sync?force=true", { method: "POST" });
      if (res.ok && orgId) {
        localStorage.setItem(getSyncThrottleKey(orgId), String(Date.now()));
      }
      await fetchPayouts();
      toast.success("Payouts synced");
    } catch {
      toast.error("Failed to sync payouts");
    } finally {
      setSyncLoading(false);
    }
  };

  const handleExport = () => {
    const headers = [
      "Date",
      "Time",
      "Batch ID",
      "Bank Account",
      "Type",
      "Status",
      "Gross",
      "Fees",
      "Net",
    ];
    const rows = payouts.map((po) => {
      const d = new Date(po.paidAt ?? po.createdAt ?? Date.now());
      return [
        format(d, "yyyy-MM-dd"),
        format(d, "HH:mm"),
        po.reference,
        po.bankAccount || "",
        po.payoutType === "SWEEP" ? "Scheduled" : "Manual",
        po.status,
        `$${Number(po.amount).toFixed(2)}`,
        `-$${Number(po.fees).toFixed(2)}`,
        `$${Number(po.net).toFixed(2)}`,
      ];
    });

    const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `payouts-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Payouts exported");
  };

  const handleResetFilters = () => {
    setStatusFilter("all");
    setStartDate(undefined);
    setEndDate(undefined);
    setPage(0);
  };

  const hasActiveFilters = statusFilter !== "all" || startDate || endDate;

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Payouts</h1>
        <p className="text-muted-foreground">Track settlements transferred to your bank account.</p>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <InfoIcon className="h-3 w-3" />
          Payouts are processed {payoutSchedule} via automated sweeps.
        </div>
      </div>

      {wasVerified && !isVerified && (
        <Alert className="bg-amber-50 border-amber-200 text-amber-800">
          <AlertCircleIcon className="h-4 w-4 text-amber-600" />
          <AlertTitle>Payouts Paused — Verification Required</AlertTitle>
          <AlertDescription>
            Your account verification requires attention. Payouts are paused until your account is
            re-verified.{" "}
            <a href="/dashboard/financials/onboarding" className="underline font-medium">
              Go to onboarding →
            </a>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card className="bg-primary text-primary-foreground">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium opacity-80">Next Estimated Payout</CardTitle>
          </CardHeader>
          <CardContent>
            {!stats.isVerified ? (
              <p className="text-sm opacity-80">Complete your onboarding to view your balance.</p>
            ) : (
              <>
                <div className="text-3xl font-bold">
                  ${Number(stats.liveBalance?.available ?? stats.unsettledAmount).toFixed(2)}
                </div>
                <p className="text-xs opacity-80 mt-1">
                  {stats.liveBalance
                    ? "Live balance from Adyen"
                    : "Estimated from local transactions"}
                </p>
              </>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Pending Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              ${Number(stats.liveBalance?.pending ?? stats.unsettledAmount).toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.liveBalance
                ? "Captured payments awaiting settlement"
                : `${stats.unsettledCount} unsettled transaction${
                    stats.unsettledCount !== 1 ? "s" : ""
                  }`}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Paid (YTD)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">${Number(stats.paidYTD).toFixed(2)}</div>
            <div className="flex items-center text-xs text-green-600 mt-1">
              <ArrowUpRightIcon className="mr-1 h-3 w-3" />
              Year to date
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Payout Schedule</CardTitle>
          <CardDescription>
            Choose how often funds are swept from your balance account to your bank.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <Select
              value={payoutSchedule}
              onValueChange={handleScheduleChange}
              disabled={!hasSweep || !isVerified || scheduleLoading}
            >
              <SelectTrigger className="w-[160px]">
                {scheduleLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <SelectValue />}
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
              </SelectContent>
            </Select>
            {(!hasSweep || !isVerified) && (
              <p className="text-xs text-muted-foreground">
                Available after onboarding is verified and a bank account is linked.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CardTitle>Payout History</CardTitle>
              {backgroundRefreshing && (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
              )}
            </div>
            <div className="flex items-center gap-2">
              {isVerified && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleManualSync}
                  disabled={syncLoading}
                >
                  {syncLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCwIcon className="mr-2 h-4 w-4" />
                  )}
                  Sync
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={handleExport}
                disabled={payouts.length === 0}
              >
                <DownloadIcon className="mr-2 h-4 w-4" />
                Download Report
              </Button>
            </div>
          </div>
          <CardDescription>Detailed breakdown of batches paid out to your account.</CardDescription>

          <div className="flex flex-wrap items-end gap-3 pt-2">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">Status</label>
              <Select
                value={statusFilter}
                onValueChange={(value) => {
                  setStatusFilter(value);
                  setPage(0);
                }}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="SCHEDULED">Scheduled</SelectItem>
                  <SelectItem value="PAID">Paid</SelectItem>
                  <SelectItem value="FAILED">Failed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">From</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-[160px] justify-start text-left font-normal",
                      !startDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, "MMM d, yyyy") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={(date) => {
                      setStartDate(date);
                      setPage(0);
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">To</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-[160px] justify-start text-left font-normal",
                      !endDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, "MMM d, yyyy") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={(date) => {
                      setEndDate(date);
                      setPage(0);
                    }}
                    disabled={(date) => (startDate ? date < startDate : false)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={handleResetFilters}>
                Clear filters
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : payouts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {hasActiveFilters
                ? "No payouts match the current filters."
                : "No payouts yet. Payouts will appear here once settlements are processed."}
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Batch ID</TableHead>
                    <TableHead>Bank Account</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Gross Amount</TableHead>
                    <TableHead className="text-right">Fees</TableHead>
                    <TableHead className="text-right">Net Payout</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payouts.map((po) => {
                    const payoutDate = new Date(po.paidAt ?? po.createdAt ?? Date.now());
                    return (
                      <TableRow
                        key={po.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => router.push(`/dashboard/financials/payouts/${po.id}`)}
                      >
                        <TableCell>
                          <div className="flex flex-col">
                            <span>{format(payoutDate, "MMM d, yyyy")}</span>
                            <span className="text-xs text-muted-foreground">
                              {format(payoutDate, "h:mm a")}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {po.reference}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <LandmarkIcon className="h-3 w-3 text-muted-foreground" />
                            {po.bankAccount ? `****${po.bankAccount}` : "\u2014"}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={po.payoutType === "SWEEP" ? "secondary" : "outline"}>
                            {po.payoutType === "SWEEP" ? "Scheduled" : "Manual"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusColors[po.status] || "outline"}>{po.status}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          ${Number(po.amount).toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right text-red-600">
                          -${Number(po.fees).toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right font-bold">
                          ${Number(po.net).toFixed(2)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-4">
                  <p className="text-sm text-muted-foreground">
                    Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of{" "}
                    {total}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(0, p - 1))}
                      disabled={page === 0}
                    >
                      <ChevronLeftIcon className="h-4 w-4" />
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      Page {page + 1} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                      disabled={page >= totalPages - 1}
                    >
                      <ChevronRightIcon className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
