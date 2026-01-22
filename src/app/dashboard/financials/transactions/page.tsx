"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { SearchIcon, DownloadIcon, FilterIcon } from "lucide-react"

const transactions = [
  {
    id: "TRX-8923-4421",
    date: "2025-11-26",
    description: "Tuition - Elite Squad (Sarah J.)",
    amount: "$150.00",
    method: "Visa •••• 4242",
    status: "Settled",
    pspReference: "8526123456789012",
  },
  {
    id: "TRX-8923-4422",
    date: "2025-11-26",
    description: "Uniform Purchase",
    amount: "$85.50",
    method: "Mastercard •••• 8821",
    status: "Authorised",
    pspReference: "8526123456789013",
  },
  {
    id: "TRX-8923-4423",
    date: "2025-11-25",
    description: "Winter Camp Deposit",
    amount: "$50.00",
    method: "Apple Pay",
    status: "Settled",
    pspReference: "8526123456789014",
  },
  {
    id: "TRX-8923-4424",
    date: "2025-11-25",
    description: "Private Lesson (Coach Mike)",
    amount: "$75.00",
    method: "Visa •••• 1122",
    status: "Refunded",
    pspReference: "8526123456789015",
  },
  {
    id: "TRX-8923-4425",
    date: "2025-11-24",
    description: "Annual Registration Fee",
    amount: "$120.00",
    method: "Google Pay",
    status: "Settled",
    pspReference: "8526123456789016",
  },
]

export default function TransactionsPage() {
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
              <Button variant="outline" size="sm">
                <DownloadIcon className="mr-2 h-4 w-4" />
                Export
              </Button>
            </div>
          </div>
          <CardDescription>
            Real-time transaction data from your payment terminals and online checkout.
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
              />
            </div>
            <Select defaultValue="all">
              <SelectTrigger className="w-[180px]">
                <FilterIcon className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="settled">Settled</SelectItem>
                <SelectItem value="authorised">Authorised</SelectItem>
                <SelectItem value="refunded">Refunded</SelectItem>
                <SelectItem value="refused">Refused</SelectItem>
              </SelectContent>
            </Select>
            <Select defaultValue="7d">
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Date Range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="24h">Last 24 Hours</SelectItem>
                <SelectItem value="7d">Last 7 Days</SelectItem>
                <SelectItem value="30d">Last 30 Days</SelectItem>
                <SelectItem value="month">This Month</SelectItem>
              </SelectContent>
            </Select>
          </div>

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
                  <TableCell className="whitespace-nowrap">{trx.date}</TableCell>
                  <TableCell className="font-medium">{trx.description}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {trx.pspReference}
                  </TableCell>
                  <TableCell>{trx.method}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        trx.status === "Settled"
                          ? "default" // Using default (primary color) for success/settled
                          : trx.status === "Refunded"
                          ? "destructive"
                          : "secondary"
                      }
                    >
                      {trx.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-semibold">{trx.amount}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}


