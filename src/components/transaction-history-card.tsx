"use client";

import { format } from "date-fns";
import { ArrowRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatPrice } from "@/lib/format-utils";
import { INVOICE_STATUS_STYLES } from "@/lib/invoice-status";
import { cn } from "@/lib/utils";

export interface TransactionLineItem {
  id: string;
  description: string;
  total: string | number;
  createdAt: string;
  invoice: {
    status: string;
    user: { name: string | null; email?: string | null } | null;
  } | null;
}

interface TransactionHistoryCardProps {
  lineItems: TransactionLineItem[];
  onViewAll?: () => void;
  limit?: number;
}

export function TransactionHistoryCard({
  lineItems,
  onViewAll,
  limit = 5,
}: TransactionHistoryCardProps) {
  const items = lineItems.slice(0, limit);
  const hasMore = lineItems.length > limit;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Transaction History</CardTitle>
        {hasMore && onViewAll && (
          <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={onViewAll}>
            View All
            <ArrowRight className="h-3 w-3" />
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {items.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Description</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => {
                const total = typeof item.total === "string" ? parseFloat(item.total) : item.total;
                return (
                  <TableRow key={item.id}>
                    <TableCell>
                      <p className="font-medium">{item.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.invoice?.user?.name ?? "N/A"} &middot;{" "}
                        {format(new Date(item.createdAt), "MM/dd/yyyy")}
                      </p>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn(
                          "capitalize",
                          INVOICE_STATUS_STYLES[item.invoice?.status ?? ""] ?? ""
                        )}
                      >
                        {item.invoice?.status?.toLowerCase() ?? "unknown"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{formatPrice(total)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        ) : (
          <div className="py-10 text-center text-muted-foreground">No transactions found.</div>
        )}
      </CardContent>
    </Card>
  );
}
