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
import { Button } from "@/components/ui/button"
import { DownloadIcon, LandmarkIcon, ArrowUpRightIcon } from "lucide-react"

const payouts = [
  {
    id: "PO-9921",
    date: "2025-11-24",
    amount: "$4,250.00",
    fees: "$124.50",
    net: "$4,125.50",
    status: "Paid",
    bankAccount: "**** 9876",
  },
  {
    id: "PO-9920",
    date: "2025-11-17",
    amount: "$3,800.00",
    fees: "$110.20",
    net: "$3,689.80",
    status: "Paid",
    bankAccount: "**** 9876",
  },
  {
    id: "PO-9919",
    date: "2025-11-10",
    amount: "$5,100.00",
    fees: "$145.80",
    net: "$4,954.20",
    status: "Paid",
    bankAccount: "**** 9876",
  },
]

export default function PayoutsPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Payouts</h1>
        <p className="text-muted-foreground">
          Track settlements transferred to your bank account.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card className="bg-primary text-primary-foreground">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium opacity-80">Next Estimated Payout</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">$2,350.00</div>
            <p className="text-xs opacity-80 mt-1">Scheduled for Friday, Nov 29</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Pending Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">$2,350.00</div>
            <p className="text-xs text-muted-foreground mt-1">From 15 recent transactions</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Paid (YTD)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">$142,890.00</div>
            <div className="flex items-center text-xs text-green-600 mt-1">
              <ArrowUpRightIcon className="mr-1 h-3 w-3" />
              +12% vs last year
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Settlement History</CardTitle>
            <Button variant="outline" size="sm">
              <DownloadIcon className="mr-2 h-4 w-4" />
              Download Report
            </Button>
          </div>
          <CardDescription>
            Detailed breakdown of batches paid out to your account.
          </CardDescription>
        </CardHeader>
        <CardContent>
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
                <TableRow key={po.id}>
                  <TableCell>{po.date}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {po.id}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <LandmarkIcon className="h-3 w-3 text-muted-foreground" />
                      {po.bankAccount}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                      {po.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">{po.amount}</TableCell>
                  <TableCell className="text-right text-red-600">-{po.fees}</TableCell>
                  <TableCell className="text-right font-bold">{po.net}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}






