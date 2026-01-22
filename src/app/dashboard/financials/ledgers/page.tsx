"use client"

import * as React from "react"
import { Plus, Search, Filter, TrendingUp, DollarSign, CreditCard, Activity, RefreshCw, CheckCircle2, Settings } from "lucide-react"
import { Bar, BarChart, CartesianGrid, XAxis, Pie, PieChart, Cell, Label as RechartsLabel } from "recharts"
import Link from "next/link"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from "@/components/ui/chart"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { RoutingRules } from "./routing-rules"
import { GLCodesTable, GLCode } from "./gl-codes-table"
import { LedgerTransactions } from "./ledger-transactions"
import { FinancialReports } from "./financial-reports"

// Mock Data for Charts
const accountTypeData = [
  { category: "membership", amount: 45000, fill: "var(--color-membership)" },
  { category: "merchandise", amount: 12500, fill: "var(--color-merchandise)" },
  { category: "events", amount: 8400, fill: "var(--color-events)" },
  { category: "lessons", amount: 6200, fill: "var(--color-lessons)" },
]

const accountTypeConfig = {
  amount: {
    label: "Amount",
  },
  membership: {
    label: "Membership Revenue",
    color: "hsl(var(--chart-1))",
  },
  merchandise: {
    label: "Merchandise Sales",
    color: "hsl(var(--chart-2))",
  },
  events: {
    label: "Event Tickets",
    color: "hsl(var(--chart-3))",
  },
  lessons: {
    label: "Private Lessons",
    color: "hsl(var(--chart-4))",
  },
} satisfies ChartConfig

const expenseTypeData = [
  { category: "software", amount: 2500, fill: "var(--color-software)" },
  { category: "supplies", amount: 1200, fill: "var(--color-supplies)" },
  { category: "travel", amount: 3500, fill: "var(--color-travel)" },
  { category: "contractors", amount: 8000, fill: "var(--color-contractors)" },
]

const expenseTypeConfig = {
  amount: { label: "Amount" },
  software: { label: "Software", color: "hsl(var(--chart-1))" },
  supplies: { label: "Supplies", color: "hsl(var(--chart-2))" },
  travel: { label: "Travel", color: "hsl(var(--chart-3))" },
  contractors: { label: "Contractors", color: "hsl(var(--chart-4))" },
} satisfies ChartConfig

// Mock Data for GL Codes
const initialGLCodes: GLCode[] = [
  { id: "1", code: "4000", description: "Membership Dues", type: "Revenue", status: "Active" },
  { id: "2", code: "4100", description: "Merchandise Sales", type: "Revenue", status: "Active" },
  { id: "3", code: "4200", description: "Event Registration", type: "Revenue", status: "Active" },
  { id: "4", code: "4300", description: "Private Lessons", type: "Revenue", status: "Active" },
  { id: "5", code: "5000", description: "Credit Card Fees", type: "Expense", status: "Active" },
  { id: "6", code: "2000", description: "Deferred Revenue", type: "Liability", status: "Active" },
  { id: "7", code: "1000", description: "Cash on Hand", type: "Asset", status: "Active" },
  { id: "8", code: "3000", description: "Retained Earnings", type: "Equity", status: "Active" },
  // Generating more mock data for pagination
  { id: "9", code: "4001", description: "Day Pass Sales", type: "Revenue", status: "Active" },
  { id: "10", code: "4002", description: "Guest Fees", type: "Revenue", status: "Active" },
  { id: "11", code: "4003", description: "Locker Rentals", type: "Revenue", status: "Active" },
  { id: "12", code: "5001", description: "Office Supplies", type: "Expense", status: "Active" },
  { id: "13", code: "5002", description: "Utilities", type: "Expense", status: "Active" },
  { id: "14", code: "5003", description: "Rent Expense", type: "Expense", status: "Active" },
  { id: "15", code: "5004", description: "Insurance", type: "Expense", status: "Active" },
  { id: "16", code: "5005", description: "Marketing & Advertising", type: "Expense", status: "Active" },
  { id: "17", code: "5006", description: "Software Subscriptions", type: "Expense", status: "Active" },
  { id: "18", code: "5007", description: "Cleaning Services", type: "Expense", status: "Active" },
  { id: "19", code: "5008", description: "Equipment Maintenance", type: "Expense", status: "Active" },
  { id: "20", code: "2001", description: "Accounts Payable", type: "Liability", status: "Active" },
  { id: "21", code: "2002", description: "Sales Tax Payable", type: "Liability", status: "Active" },
  { id: "22", code: "1001", description: "Checking Account", type: "Asset", status: "Active" },
  { id: "23", code: "1002", description: "Savings Account", type: "Asset", status: "Active" },
  { id: "24", code: "1003", description: "Accounts Receivable", type: "Asset", status: "Active" },
  { id: "25", code: "1004", description: "Inventory", type: "Asset", status: "Active" },
]

export default function LedgersPage() {
  const [glCodes, setGlCodes] = React.useState<GLCode[]>(initialGLCodes)
  const [isDialogOpen, setIsDialogOpen] = React.useState(false)
  const [newGLCode, setNewGLCode] = React.useState({
    code: "",
    description: "",
    type: "Revenue",
  })
  
  const [isSyncing, setIsSyncing] = React.useState(false)
  const [lastSync, setLastSync] = React.useState<Date | null>(new Date(Date.now() - 3600000)) // 1 hour ago

  const handleCreateGLCode = () => {
    if (!newGLCode.code || !newGLCode.description) return

    const newCode: GLCode = {
      id: Math.random().toString(36).substr(2, 9),
      code: newGLCode.code,
      description: newGLCode.description,
      type: newGLCode.type,
      status: "Active",
    }

    setGlCodes([...glCodes, newCode])
    setNewGLCode({ code: "", description: "", type: "Revenue" })
    setIsDialogOpen(false)
  }
  
  const handleSync = () => {
    setIsSyncing(true)
    toast.info("Syncing with QuickBooks Online...")
    
    setTimeout(() => {
        setIsSyncing(false)
        setLastSync(new Date())
        toast.success("Sync completed successfully")
    }, 2000)
  }

  const totalRevenue = accountTypeData.reduce((acc, curr) => acc + curr.amount, 0)
  const totalExpenses = expenseTypeData.reduce((acc, curr) => acc + curr.amount, 0)

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold tracking-tight">Ledgers & GL Codes</h1>
          <p className="text-muted-foreground">
            Manage your general ledger codes, routing rules, and view revenue breakdowns.
          </p>
        </div>
        <div className="flex items-center gap-2">
            <div className="flex flex-col items-end mr-2">
                <div className="flex items-center gap-2 text-sm font-medium text-emerald-600">
                    <CheckCircle2 className="h-4 w-4" />
                    QBO Connected
                </div>
                {lastSync && (
                    <span className="text-xs text-muted-foreground">
                        Last sync: {lastSync.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                )}
            </div>
            <Button variant="outline" size="sm" onClick={handleSync} disabled={isSyncing}>
                <RefreshCw className={`mr-2 h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} />
                {isSyncing ? "Syncing..." : "Sync Now"}
            </Button>
            <Button variant="ghost" size="icon" asChild>
                <Link href="/dashboard/financials/integrations">
                    <Settings className="h-4 w-4" />
                    <span className="sr-only">Integration Settings</span>
                </Link>
            </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Ledger Balance</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalRevenue.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Across all revenue accounts
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active GL Codes</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{glCodes.filter(c => c.status === "Active").length}</div>
            <p className="text-xs text-muted-foreground">
              Routing rules active
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unallocated Revenue</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">$1,250.00</div>
            <p className="text-xs text-muted-foreground">
              Pending GL assignment
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="reports">Financial Reports</TabsTrigger>
          <TabsTrigger value="rules">Routing Rules</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
            <Card className="col-span-4">
              <CardHeader>
                <CardTitle>GL Codes</CardTitle>
                <CardDescription>
                  Manage your chart of accounts and routing rules.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Create New GL Code</DialogTitle>
                        <DialogDescription>
                          Add a new General Ledger code for transaction routing.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                          <Label htmlFor="code" className="text-right">
                            Code
                          </Label>
                          <Input
                            id="code"
                            value={newGLCode.code}
                            onChange={(e) => setNewGLCode({ ...newGLCode, code: e.target.value })}
                            className="col-span-3"
                            placeholder="e.g. 4000"
                          />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                          <Label htmlFor="description" className="text-right">
                            Description
                          </Label>
                          <Input
                            id="description"
                            value={newGLCode.description}
                            onChange={(e) => setNewGLCode({ ...newGLCode, description: e.target.value })}
                            className="col-span-3"
                            placeholder="e.g. Membership Dues"
                          />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                          <Label htmlFor="type" className="text-right">
                            Type
                          </Label>
                          <Select
                            value={newGLCode.type}
                            onValueChange={(value) => setNewGLCode({ ...newGLCode, type: value })}
                          >
                            <SelectTrigger className="col-span-3">
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Revenue">Revenue</SelectItem>
                              <SelectItem value="Expense">Expense</SelectItem>
                              <SelectItem value="Liability">Liability</SelectItem>
                              <SelectItem value="Asset">Asset</SelectItem>
                              <SelectItem value="Equity">Equity</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <DialogFooter>
                        <DialogClose asChild>
                          <Button variant="outline">Cancel</Button>
                        </DialogClose>
                        <Button onClick={handleCreateGLCode}>Create Code</Button>
                      </DialogFooter>
                    </DialogContent>
                </Dialog>
                
                <GLCodesTable data={glCodes} onAddClick={() => setIsDialogOpen(true)} />
              </CardContent>
            </Card>

            <div className="col-span-3 flex flex-col gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Revenue by Account Type</CardTitle>
                  <CardDescription>
                    Distribution of revenue across ledger accounts.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-1 pb-0">
                  <ChartContainer
                    config={accountTypeConfig}
                    className="mx-auto aspect-square max-h-[300px]"
                  >
                    <PieChart>
                      <ChartTooltip
                        cursor={false}
                        content={
                          <ChartTooltipContent 
                            hideLabel 
                            className="w-[200px]"
                            formatter={(value, name, item, index) => (
                              <>
                                <div
                                  className="h-2.5 w-2.5 shrink-0 rounded-[2px] bg-[--color-bg]"
                                  style={
                                    {
                                      "--color-bg": item.payload.fill || item.color,
                                    } as React.CSSProperties
                                  }
                                />
                                <div className="flex flex-1 justify-between leading-none items-center">
                                  <span className="text-muted-foreground mr-2">{name}</span>
                                  <span className="font-mono font-medium tabular-nums text-foreground">
                                    ${Number(value).toLocaleString()}
                                  </span>
                                </div>
                              </>
                            )}
                          />
                        }
                      />
                      <Pie
                        data={accountTypeData}
                        dataKey="amount"
                        nameKey="category"
                        innerRadius={60}
                        strokeWidth={5}
                      >
                        <RechartsLabel
                          content={({ viewBox }) => {
                            if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                              return (
                                <text
                                  x={viewBox.cx}
                                  y={viewBox.cy}
                                  textAnchor="middle"
                                  dominantBaseline="middle"
                                >
                                  <tspan
                                    x={viewBox.cx}
                                    y={viewBox.cy}
                                    className="fill-foreground text-3xl font-bold"
                                  >
                                    ${(totalRevenue / 1000).toFixed(1)}k
                                  </tspan>
                                  <tspan
                                    x={viewBox.cx}
                                    y={(viewBox.cy || 0) + 24}
                                    className="fill-muted-foreground text-sm"
                                  >
                                    Total
                                  </tspan>
                                </text>
                              )
                            }
                          }}
                        />
                      </Pie>
                      <ChartLegend
                        content={<ChartLegendContent nameKey="category" className="-translate-y-2 flex-wrap gap-2 [&>*]:basis-1/4 [&>*]:justify-center text-foreground font-medium" />}
                      />
                    </PieChart>
                  </ChartContainer>
                </CardContent>
                <CardFooter className="flex-col gap-2 text-sm">
                  <div className="flex items-center gap-2 font-medium leading-none">
                    Trending up by 5.2% this month <TrendingUp className="h-4 w-4" />
                  </div>
                  <div className="leading-none text-muted-foreground">
                    Showing total revenue distribution for current period
                  </div>
                </CardFooter>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Expense by Account Type</CardTitle>
                  <CardDescription>
                    Distribution of expenses across ledger accounts.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-1 pb-0">
                  <ChartContainer
                    config={expenseTypeConfig}
                    className="mx-auto aspect-square max-h-[300px]"
                  >
                    <PieChart>
                      <ChartTooltip
                        cursor={false}
                        content={
                          <ChartTooltipContent 
                            hideLabel 
                            className="w-[200px]"
                            formatter={(value, name, item, index) => (
                              <>
                                <div
                                  className="h-2.5 w-2.5 shrink-0 rounded-[2px] bg-[--color-bg]"
                                  style={
                                    {
                                      "--color-bg": item.payload.fill || item.color,
                                    } as React.CSSProperties
                                  }
                                />
                                <div className="flex flex-1 justify-between leading-none items-center">
                                  <span className="text-muted-foreground mr-2">{name}</span>
                                  <span className="font-mono font-medium tabular-nums text-foreground">
                                    ${Number(value).toLocaleString()}
                                  </span>
                                </div>
                              </>
                            )}
                          />
                        }
                      />
                      <Pie
                        data={expenseTypeData}
                        dataKey="amount"
                        nameKey="category"
                        innerRadius={60}
                        strokeWidth={5}
                      >
                        <RechartsLabel
                          content={({ viewBox }) => {
                            if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                              return (
                                <text
                                  x={viewBox.cx}
                                  y={viewBox.cy}
                                  textAnchor="middle"
                                  dominantBaseline="middle"
                                >
                                  <tspan
                                    x={viewBox.cx}
                                    y={viewBox.cy}
                                    className="fill-foreground text-3xl font-bold"
                                  >
                                    ${(totalExpenses / 1000).toFixed(1)}k
                                  </tspan>
                                  <tspan
                                    x={viewBox.cx}
                                    y={(viewBox.cy || 0) + 24}
                                    className="fill-muted-foreground text-sm"
                                  >
                                    Total
                                  </tspan>
                                </text>
                              )
                            }
                          }}
                        />
                      </Pie>
                      <ChartLegend
                        content={<ChartLegendContent nameKey="category" className="-translate-y-2 flex-wrap gap-2 [&>*]:basis-1/4 [&>*]:justify-center text-foreground font-medium" />}
                      />
                    </PieChart>
                  </ChartContainer>
                </CardContent>
                <CardFooter className="flex-col gap-2 text-sm">
                  <div className="flex items-center gap-2 font-medium leading-none">
                    Trending down by 2.1% this month <TrendingUp className="h-4 w-4 rotate-180" />
                  </div>
                  <div className="leading-none text-muted-foreground">
                    Showing total expense distribution for current period
                  </div>
                </CardFooter>
              </Card>
            </div>
          </div>
        </TabsContent>
        <TabsContent value="transactions">
            <LedgerTransactions />
        </TabsContent>
        <TabsContent value="reports">
            <FinancialReports />
        </TabsContent>
        <TabsContent value="rules">
          <RoutingRules glCodes={glCodes} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
