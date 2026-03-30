"use client";

import * as React from "react";
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
  Calendar as CalendarIcon,
} from "lucide-react";
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
  unsettledAmount: number;
  unsettledCount: number;
}

const PAGE_SIZE = 20;

const statusColors: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  PENDING: "outline",
  SCHEDULED: "secondary",
  PAID: "default",
  FAILED: "destructive",
};

export default function PayoutsPage() {
  const router = useRouter();
  const [payouts, setPayouts] = React.useState<Payout[]>([]);
  const [loading, setLoading] = React.useState(true);
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
    unsettledAmount: 0,
    unsettledCount: 0,
  });

  const fetchPayouts = React.useCallback(async () => {
    try {
      setLoading(true);
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
    } catch (error) {
      console.error("Error fetching payouts:", error);
      toast.error("Failed to load payouts");
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, startDate, endDate]);

  React.useEffect(() => {
    fetchPayouts();
  }, [fetchPayouts]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const handleExport = () => {
    const headers = ["Date", "Batch ID", "Bank Account", "Status", "Gross", "Fees", "Net"];
    const rows = payouts.map((po) => [
      po.paidAt
        ? format(new Date(po.paidAt), "yyyy-MM-dd")
        : format(new Date(po.createdAt), "yyyy-MM-dd"),
      po.reference,
      po.bankAccount || "",
      po.status,
      `$${Number(po.amount).toFixed(2)}`,
      `-$${Number(po.fees).toFixed(2)}`,
      `$${Number(po.net).toFixed(2)}`,
    ]);

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
          Payouts are processed daily via automated sweeps.
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card className="bg-primary text-primary-foreground">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium opacity-80">Next Estimated Payout</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">${Number(stats.unsettledAmount).toFixed(2)}</div>
            <p className="text-xs opacity-80 mt-1">
              {stats.nextPayout?.scheduledAt
                ? `Scheduled for ${format(new Date(stats.nextPayout.scheduledAt), "EEEE, MMM d")}`
                : `From ${stats.unsettledCount} pending transaction${stats.unsettledCount !== 1 ? "s" : ""}`}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Pending Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">${Number(stats.pendingAmount).toFixed(2)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.pendingCount} scheduled payout{stats.pendingCount !== 1 ? "s" : ""}
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
          <div className="flex items-center justify-between">
            <CardTitle>Settlement History</CardTitle>
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
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Gross Amount</TableHead>
                    <TableHead className="text-right">Fees</TableHead>
                    <TableHead className="text-right">Net Payout</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payouts.map((po) => (
                    <TableRow
                      key={po.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => router.push(`/dashboard/financials/payouts/${po.id}`)}
                    >
                      <TableCell>
                        {po.paidAt
                          ? format(new Date(po.paidAt), "MMM d, yyyy")
                          : format(new Date(po.createdAt), "MMM d, yyyy")}
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
                        <Badge variant={statusColors[po.status] || "outline"}>{po.status}</Badge>
                      </TableCell>
                      <TableCell className="text-right">${Number(po.amount).toFixed(2)}</TableCell>
                      <TableCell className="text-right text-red-600">
                        -${Number(po.fees).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right font-bold">
                        ${Number(po.net).toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
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
