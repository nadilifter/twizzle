"use client";

import * as React from "react";
import { Plus, TrendingUp, DollarSign, CreditCard, Activity, Loader2, Layers } from "lucide-react";
import { Pie, PieChart, Label as RechartsLabel } from "recharts";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ResponsiveTabsList } from "@/components/ui/responsive-tabs";
import { GLCodesTable, GLCode } from "./gl-codes-table";
import { LedgerTransactions } from "./ledger-transactions";
import { FinancialReports } from "./financial-reports";
import { GLCodeAssignments } from "./gl-code-assignments";

const CHART_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "hsl(160, 60%, 45%)",
  "hsl(200, 60%, 45%)",
  "hsl(280, 60%, 45%)",
];

interface RevenueByCode {
  id: string;
  code: string;
  description: string;
  amount: number;
}

interface MonthlyRevenue {
  month: string;
  total: number;
}

export default function LedgersPage() {
  const [activeTab, setActiveTab] = React.useState("overview");
  const [glCodes, setGlCodes] = React.useState<GLCode[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [newGLCode, setNewGLCode] = React.useState({
    code: "",
    description: "",
    type: "REVENUE",
  });
  const [stats, setStats] = React.useState({
    totalRevenue: 0,
    totalExpenses: 0,
    totalAssets: 0,
    totalLiabilities: 0,
    totalEquity: 0,
  });
  const [revenueByCode, setRevenueByCode] = React.useState<RevenueByCode[]>([]);
  const [monthlyRevenue, setMonthlyRevenue] = React.useState<MonthlyRevenue[]>([]);

  const fetchGLCodes = React.useCallback(async () => {
    try {
      const response = await fetch("/api/ledgers");
      if (!response.ok) throw new Error("Failed to fetch GL codes");

      const data = await response.json();
      const mappedCodes = data.data.map((code: Record<string, unknown>) => ({
        id: code.id,
        code: code.code,
        description: code.description,
        type: (code.type as string).charAt(0) + (code.type as string).slice(1).toLowerCase(),
        status: code.status === "ACTIVE" ? "Active" : "Inactive",
      }));
      setGlCodes(mappedCodes);
      setStats(data.stats);
      setRevenueByCode(data.revenueByCode || []);
      setMonthlyRevenue(data.monthlyRevenue || []);
    } catch (error) {
      console.error("Error fetching GL codes:", error);
      toast.error("Failed to load GL codes");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchGLCodes();
  }, [fetchGLCodes]);

  const handleCreateGLCode = async () => {
    if (!newGLCode.code || !newGLCode.description) {
      toast.error("Please fill in all required fields");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/ledgers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newGLCode),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create GL code");
      }

      toast.success("GL code created successfully");
      setNewGLCode({ code: "", description: "", type: "REVENUE" });
      setIsDialogOpen(false);
      fetchGLCodes();
    } catch (error) {
      console.error("Error creating GL code:", error);
      toast.error(error instanceof Error ? error.message : "Failed to create GL code");
    } finally {
      setSaving(false);
    }
  };

  // Build chart config and data from real GL code revenue breakdown
  const revenueChartConfig: ChartConfig = {
    amount: { label: "Amount" },
    ...Object.fromEntries(
      revenueByCode.map((rc, i) => [
        rc.code,
        { label: rc.description, color: CHART_COLORS[i % CHART_COLORS.length] },
      ])
    ),
  };

  const revenueChartData = revenueByCode.map((rc, i) => ({
    category: rc.code,
    amount: rc.amount,
    fill: CHART_COLORS[i % CHART_COLORS.length],
  }));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold tracking-tight">Ledgers & GL Codes</h1>
          <p className="text-muted-foreground">
            Manage your general ledger codes, entity assignments, and view revenue breakdowns.
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              $
              {stats.totalRevenue.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
            <p className="text-xs text-muted-foreground">From invoiced line items</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active GL Codes</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {glCodes.filter((c) => c.status === "Active").length}
            </div>
            <p className="text-xs text-muted-foreground">{glCodes.length} total codes</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Liabilities</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              $
              {stats.totalLiabilities.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
            <p className="text-xs text-muted-foreground">From ledger entries</p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <ResponsiveTabsList value={activeTab} onValueChange={setActiveTab}>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="assignments">Assignments</TabsTrigger>
          <TabsTrigger value="reports">Financial Reports</TabsTrigger>
        </ResponsiveTabsList>
        <TabsContent value="overview" className="space-y-4">
          <div className="grid items-start gap-6 md:grid-cols-2 lg:grid-cols-7">
            <Card className="col-span-4">
              <CardHeader>
                <CardTitle>GL Codes</CardTitle>
                <CardDescription>
                  Manage your chart of accounts and entity assignments.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create New GL Code</DialogTitle>
                      <DialogDescription>
                        Add a new General Ledger code for categorizing revenue.
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
                          onChange={(e) =>
                            setNewGLCode({ ...newGLCode, description: e.target.value })
                          }
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
                        <Button variant="outline" disabled={saving}>
                          Cancel
                        </Button>
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
                  <CardTitle>Revenue by GL Code</CardTitle>
                  <CardDescription>
                    Distribution of invoiced revenue across GL codes.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-1 pb-0">
                  {revenueChartData.length > 0 ? (
                    <ChartContainer
                      config={revenueChartConfig}
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
                                      $
                                      {Number(value).toLocaleString(undefined, {
                                        minimumFractionDigits: 2,
                                      })}
                                    </span>
                                  </div>
                                </>
                              )}
                            />
                          }
                        />
                        <Pie
                          data={revenueChartData}
                          dataKey="amount"
                          nameKey="category"
                          innerRadius={60}
                          strokeWidth={5}
                        >
                          <RechartsLabel
                            content={({ viewBox }) => {
                              if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                                const formatted =
                                  stats.totalRevenue >= 1000
                                    ? `$${(stats.totalRevenue / 1000).toFixed(1)}k`
                                    : `$${stats.totalRevenue.toFixed(0)}`;
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
                                      {formatted}
                                    </tspan>
                                    <tspan
                                      x={viewBox.cx}
                                      y={(viewBox.cy || 0) + 24}
                                      className="fill-muted-foreground text-sm"
                                    >
                                      Total
                                    </tspan>
                                  </text>
                                );
                              }
                            }}
                          />
                        </Pie>
                        <ChartLegend
                          content={
                            <ChartLegendContent
                              nameKey="category"
                              className="-translate-y-2 flex-wrap gap-2 [&>*]:basis-1/4 [&>*]:justify-center text-foreground font-medium"
                            />
                          }
                        />
                      </PieChart>
                    </ChartContainer>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12">
                      <Layers className="h-12 w-12 text-muted-foreground/50 mb-4" />
                      <p className="text-sm text-muted-foreground text-center">
                        No revenue recorded yet.
                        <br />
                        Revenue will appear here as invoices are created.
                      </p>
                    </div>
                  )}
                </CardContent>
                {revenueChartData.length > 0 && (
                  <CardFooter className="flex-col gap-2 text-sm">
                    <div className="flex items-center gap-2 font-medium leading-none">
                      Revenue breakdown by GL code <TrendingUp className="h-4 w-4" />
                    </div>
                    <div className="leading-none text-muted-foreground">
                      From invoiced line items with assigned GL codes
                    </div>
                  </CardFooter>
                )}
              </Card>
            </div>
          </div>
        </TabsContent>
        <TabsContent value="transactions">
          <LedgerTransactions />
        </TabsContent>
        <TabsContent value="reports">
          <FinancialReports
            stats={stats}
            monthlyRevenue={monthlyRevenue}
            revenueByCode={revenueByCode}
          />
        </TabsContent>
        <TabsContent value="assignments">
          <GLCodeAssignments />
        </TabsContent>
      </Tabs>
    </div>
  );
}
