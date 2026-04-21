"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { SearchIcon, DownloadIcon, FilterIcon, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { getMethodLabel } from "@/lib/payment-utils";

interface Transaction {
  id: string;
  pspReference: string;
  merchantRef: string | null;
  type: "PAYMENT" | "REFUND" | "CHARGEBACK" | "CAPTURE" | "CANCEL";
  amount: number;
  currency: string;
  status: "AUTHORISED" | "CAPTURED" | "SETTLED" | "REFUSED" | "CANCELLED" | "ERROR" | "PENDING";
  method: string | null;
  description: string | null;
  createdAt: string;
  settledAt: string | null;
  payment?: {
    id: string;
    amount: number;
    user?: {
      id: string;
      name: string;
    };
  } | null;
}

const statusVariants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  SETTLED: "default",
  AUTHORISED: "secondary",
  CAPTURED: "secondary",
  PENDING: "outline",
  REFUSED: "destructive",
  CANCELLED: "destructive",
  ERROR: "destructive",
};

const statusLabels: Record<string, string> = {
  AUTHORISED: "Authorised",
  CAPTURED: "Captured",
  SETTLED: "Settled",
  REFUSED: "Refused",
  CANCELLED: "Cancelled",
  ERROR: "Error",
  PENDING: "Pending",
};

export default function TransactionsPage() {
  const [transactions, setTransactions] = React.useState<Transaction[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [stats, setStats] = React.useState({
    settledThisMonth: 0,
    transactionCount: 0,
  });

  const fetchTransactions = React.useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (statusFilter && statusFilter !== "all") params.set("status", statusFilter);

      const response = await fetch(`/api/transactions?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch transactions");

      const data = await response.json();
      setTransactions(data.data);
      setStats(data.stats);
    } catch (error) {
      console.error("Error fetching transactions:", error);
      toast.error("Failed to load transactions");
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  React.useEffect(() => {
    const timeoutId = setTimeout(fetchTransactions, 300);
    return () => clearTimeout(timeoutId);
  }, [fetchTransactions]);

  const handleExport = () => {
    // Generate CSV export
    const headers = ["Date", "PSP Reference", "Description", "Method", "Status", "Amount"];
    const rows = transactions.map((trx) => [
      format(new Date(trx.createdAt), "yyyy-MM-dd HH:mm"),
      trx.pspReference,
      trx.description || "",
      trx.method || "",
      trx.status,
      `$${Number(trx.amount).toFixed(2)}`,
    ]);

    const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transactions-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Transactions exported");
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Transactions</h1>
        <p className="text-muted-foreground">
          View and manage all payments processed through Adyen.
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Payment History</CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleExport}>
                <DownloadIcon className="mr-2 h-4 w-4" />
                Export
              </Button>
            </div>
          </div>
          <CardDescription>
            Real-time transaction data from your payment terminals and online checkout.
            {stats.transactionCount > 0 && (
              <span className="block mt-1">
                ${Number(stats.settledThisMonth).toFixed(2)} settled this month (
                {stats.transactionCount} transactions)
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-6">
            <div className="relative flex-1 max-w-sm">
              <SearchIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search by reference or description..."
                className="pl-8"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <FilterIcon className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="SETTLED">Settled</SelectItem>
                <SelectItem value="AUTHORISED">Authorised</SelectItem>
                <SelectItem value="CAPTURED">Captured</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="REFUSED">Refused</SelectItem>
                <SelectItem value="CANCELLED">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No transactions found. Transactions will appear here once payments are processed.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>PSP Reference</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((trx) => (
                  <TableRow key={trx.id}>
                    <TableCell className="whitespace-nowrap">
                      {format(new Date(trx.createdAt), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell className="font-medium">
                      {trx.description || trx.payment?.user?.name || "Payment"}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {trx.pspReference}
                    </TableCell>
                    <TableCell>
                      {Number(trx.amount) === 0
                        ? "—"
                        : trx.method
                          ? getMethodLabel({ type: trx.method.toLowerCase(), brand: null })
                          : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariants[trx.status] || "outline"}>
                        {statusLabels[trx.status] || trx.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {trx.type === "REFUND" ? "-" : ""}${Number(trx.amount).toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
