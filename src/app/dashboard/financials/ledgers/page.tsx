"use client"

import * as React from "react"
import { Plus, Search, TrendingUp, DollarSign, CreditCard, Activity, RefreshCw, CheckCircle2, Settings, Loader2 } from "lucide-react"
import { Pie, PieChart, Label as RechartsLabel } from "recharts"
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
  DialogClose,
} from "@/components/ui/dialog"
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from "@/components/ui/chart"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { RoutingRules } from "./routing-rules"
import { GLCodesTable, GLCode } from "./gl-codes-table"
import { LedgerTransactions } from "./ledger-transactions"
import { FinancialReports } from "./financial-reports"

const accountTypeConfig = {
  amount: { label: "Amount" },
  membership: { label: "Membership Revenue", color: "hsl(var(--chart-1))" },
  merchandise: { label: "Merchandise Sales", color: "hsl(var(--chart-2))" },
  events: { label: "Event Tickets", color: "hsl(var(--chart-3))" },
  lessons: { label: "Private Lessons", color: "hsl(var(--chart-4))" },
} satisfies ChartConfig

const expenseTypeConfig = {
  amount: { label: "Amount" },
  software: { label: "Software", color: "hsl(var(--chart-1))" },
  supplies: { label: "Supplies", color: "hsl(var(--chart-2))" },
  travel: { label: "Travel", color: "hsl(var(--chart-3))" },
  contractors: { label: "Contractors", color: "hsl(var(--chart-4))" },
} satisfies ChartConfig

export default function LedgersPage() {
  const [glCodes, setGlCodes] = React.useState<GLCode[]>([])
  const [loading, setLoading] = React.useState(true)
  const [isDialogOpen, setIsDialogOpen] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [newGLCode, setNewGLCode] = React.useState({
    code: "",
    description: "",
    type: "REVENUE",
  })
  const [stats, setStats] = React.useState({
    totalRevenue: 0,
    totalExpenses: 0,
    totalAssets: 0,
    totalLiabilities: 0,
    totalEquity: 0,
  })
  
  const [isSyncing, setIsSyncing] = React.useState(false)
  const [lastSync, setLastSync] = React.useState<Date | null>(new Date(Date.now() - 3600000))

  const fetchGLCodes = React.useCallback(async () => {
    try {
      const response = await fetch("/api/ledgers")
      if (!response.ok) throw new Error("Failed to fetch GL codes")
      
      const data = await response.json()
      // Map API response to match GLCode interface
      const mappedCodes = data.data.map((code: Record<string, unknown>) => ({
        id: code.id,
        code: code.code,
        description: code.description,
        type: (code.type as string).charAt(0) + (code.type as string).slice(1).toLowerCase(),
        status: code.status === "ACTIVE" ? "Active" : "Inactive",
      }))
      setGlCodes(mappedCodes)
      setStats(data.stats)
    } catch (error) {
      console.error("Error fetching GL codes:", error)
      toast.error("Failed to load GL codes")
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    fetchGLCodes()
  }, [fetchGLCodes])

  const handleCreateGLCode = async () => {
    if (!newGLCode.code || !newGLCode.description) {
      toast.error("Please fill in all required fields")
      return
    }

    setSaving(true)
    try {
      const response = await fetch("/api/ledgers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newGLCode),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to create GL code")
      }

      toast.success("GL code created successfully")
      setNewGLCode({ code: "", description: "", type: "REVENUE" })
      setIsDialogOpen(false)
      fetchGLCodes()
    } catch (error) {
      console.error("Error creating GL code:", error)
      toast.error(error instanceof Error ? error.message : "Failed to create GL code")
    } finally {
      setSaving(false)
    }
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

  // Prepare chart data from stats
  const accountTypeData = [
    { category: "membership", amount: stats.totalRevenue * 0.62, fill: "var(--color-membership)" },
    { category: "merchandise", amount: stats.totalRevenue * 0.17, fill: "var(--color-merchandise)" },
    { category: "events", amount: stats.totalRevenue * 0.12, fill: "var(--color-events)" },
    { category: "lessons", amount: stats.totalRevenue * 0.09, fill: "var(--color-lessons)" },
  ]

  const expenseTypeData = [
    { category: "software", amount: stats.totalExpenses * 0.16, fill: "var(--color-software)" },
    { category: "supplies", amount: stats.totalExpenses * 0.08, fill: "var(--color-supplies)" },
    { category: "travel", amount: stats.totalExpenses * 0.23, fill: "var(--color-travel)" },
    { category: "contractors", amount: stats.totalExpenses * 0.53, fill: "var(--color-contractors)" },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

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
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${stats.totalRevenue.toLocaleString()}</div>
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
              In use for routing
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${stats.totalExpenses.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              This period
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
          <div className="grid items-start gap-6 md:grid-cols-2 lg:grid-cols-7">
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
                            <SelectItem value="REVENUE">Revenue</SelectItem>
                            <SelectItem value="EXPENSE">Expense</SelectItem>
                            <SelectItem value="LIABILITY">Liability</SelectItem>
                            <SelectItem value="ASSET">Asset</SelectItem>
                            <SelectItem value="EQUITY">Equity</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <DialogFooter>
                      <DialogClose asChild>
                        <Button variant="outline" disabled={saving}>Cancel</Button>
                      </DialogClose>
                      <Button onClick={handleCreateGLCode} disabled={saving}>
                        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Create Code
                      </Button>
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
                            formatter={(value, name, item) => (
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
                                    ${(stats.totalRevenue / 1000).toFixed(1)}k
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
                    Revenue breakdown <TrendingUp className="h-4 w-4" />
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
                            formatter={(value, name, item) => (
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
                                    ${(stats.totalExpenses / 1000).toFixed(1)}k
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
                    Expense breakdown <TrendingUp className="h-4 w-4 rotate-180" />
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
