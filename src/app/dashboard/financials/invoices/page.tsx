"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { PlusIcon, LinkIcon, SendIcon, MoreHorizontalIcon } from "lucide-react"
import { CreateInvoiceSheet } from "@/components/invoices/create-invoice-sheet"

const invoices = [
  {
    id: "INV-2024-001",
    recipient: "Jane Doe (Parent)",
    athlete: "Sarah Doe",
    item: "Fall Session Tuition",
    amount: "$450.00",
    dueDate: "2025-11-30",
    status: "Unpaid",
    linkStatus: "Active",
  },
  {
    id: "INV-2024-002",
    recipient: "Mike Smith (Parent)",
    athlete: "John Smith",
    item: "Competition Leo",
    amount: "$120.00",
    dueDate: "2025-11-15",
    status: "Paid",
    linkStatus: "Expired",
  },
  {
    id: "INV-2024-003",
    recipient: "Emily Chen",
    athlete: "Lily Chen",
    item: "Private Lesson Package",
    amount: "$300.00",
    dueDate: "2025-12-01",
    status: "Unpaid",
    linkStatus: "Active",
  },
]

export default function InvoicesPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Invoices</h1>
            <p className="text-muted-foreground">
              Create and manage payment links using Adyen Pay by Link.
            </p>
          </div>
          <CreateInvoiceSheet />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Outstanding Amount</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">$750.00</div>
            <p className="text-xs text-muted-foreground">Across 2 active invoices</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Collected this Month</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">$2,450.00</div>
            <p className="text-xs text-muted-foreground">Via Pay by Link</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Payment Success Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">94%</div>
            <p className="text-xs text-muted-foreground">Last 30 days</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Invoices</CardTitle>
          <CardDescription>
            Manage invoices and copy payment links for your customers.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice #</TableHead>
                <TableHead>Recipient</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell className="font-medium">{inv.id}</TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span>{inv.recipient}</span>
                      <span className="text-xs text-muted-foreground">For: {inv.athlete}</span>
                    </div>
                  </TableCell>
                  <TableCell>{inv.item}</TableCell>
                  <TableCell>{inv.dueDate}</TableCell>
                  <TableCell>
                    <Badge variant={inv.status === "Paid" ? "default" : "outline"}>
                      {inv.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-semibold">{inv.amount}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontalIcon className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>
                          <LinkIcon className="mr-2 h-4 w-4" />
                          Copy Payment Link
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <SendIcon className="mr-2 h-4 w-4" />
                          Resend Email
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}


