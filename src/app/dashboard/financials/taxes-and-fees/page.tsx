"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { format } from "date-fns";
import { Loader2, TrendingUp } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { DateRangePicker } from "@/components/ui/date-range-picker";

interface TaxFeeConfig {
  taxEnabled: boolean;
  taxRate: number;
  taxPaidBy: "CUSTOMER" | "ORGANIZATION";
  plan: {
    name: string;
    transactionFee: number;
    perTransactionFee: number;
  } | null;
}

interface MonthlyTaxData {
  month: string;
  taxCollected: number;
  invoiceCount: number;
}

interface MonthlyFeeData {
  month: string;
  transactionCount: number;
  grossVolume: number;
  fees: number;
}

interface ReportData {
  tax: { total: number; monthly: MonthlyTaxData[] };
  fees: { total: number; totalVolume: number; transactionCount: number; monthly: MonthlyFeeData[] };
  period: { startDate: string; endDate: string };
}

type PresetPeriod =
  | "this-month"
  | "last-month"
  | "this-quarter"
  | "last-quarter"
  | "this-year"
  | "last-year"
  | "custom";

function getPresetDates(preset: PresetPeriod): { start: string; end: string } | null {
  if (preset === "custom") return null;
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();

  switch (preset) {
    case "this-month":
      return {
        start: format(new Date(y, m, 1), "yyyy-MM-dd"),
        end: format(now, "yyyy-MM-dd"),
      };
    case "last-month":
      return {
        start: format(new Date(y, m - 1, 1), "yyyy-MM-dd"),
        end: format(new Date(y, m, 0), "yyyy-MM-dd"),
      };
    case "this-quarter": {
      const qStart = Math.floor(m / 3) * 3;
      return {
        start: format(new Date(y, qStart, 1), "yyyy-MM-dd"),
        end: format(now, "yyyy-MM-dd"),
      };
    }
    case "last-quarter": {
      const qStart = Math.floor(m / 3) * 3 - 3;
      const qEnd = qStart + 3;
      return {
        start: format(new Date(y, qStart, 1), "yyyy-MM-dd"),
        end: format(new Date(y, qEnd, 0), "yyyy-MM-dd"),
      };
    }
    case "this-year":
      return {
        start: format(new Date(y, 0, 1), "yyyy-MM-dd"),
        end: format(now, "yyyy-MM-dd"),
      };
    case "last-year":
      return {
        start: format(new Date(y - 1, 0, 1), "yyyy-MM-dd"),
        end: format(new Date(y - 1, 11, 31), "yyyy-MM-dd"),
      };
  }
}

function formatCurrency(amount: number): string {
  return `$${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatMonthLabel(monthStr: string): string {
  const [year, month] = monthStr.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);
  return format(date, "MMM yyyy");
}

export default function TaxesAndFeesPage() {
  const [config, setConfig] = useState<TaxFeeConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Local form state
  const [taxEnabled, setTaxEnabled] = useState(true);
  const [ratePercent, setRatePercent] = useState("");
  const [taxPaidBy, setTaxPaidBy] = useState<"CUSTOMER" | "ORGANIZATION">("CUSTOMER");

  // Report state
  const [report, setReport] = useState<ReportData | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [period, setPeriod] = useState<PresetPeriod>("this-month");
  const [customStart, setCustomStart] = useState<string | null>(null);
  const [customEnd, setCustomEnd] = useState<string | null>(null);

  const loadConfig = useCallback(async () => {
    try {
      const res = await fetch("/api/organization/taxes-and-fees");
      if (!res.ok) throw new Error("Failed to load");
      const data: TaxFeeConfig = await res.json();
      setConfig(data);
      setTaxEnabled(data.taxEnabled);
      setRatePercent((data.taxRate * 100).toFixed(2).replace(/\.?0+$/, ""));
      setTaxPaidBy(data.taxPaidBy);
    } catch {
      toast.error("Failed to load tax and fee settings");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadReport = useCallback(async (start: string, end: string) => {
    setReportLoading(true);
    try {
      const res = await fetch(
        `/api/organization/taxes-and-fees/report?startDate=${start}&endDate=${end}`
      );
      if (!res.ok) throw new Error("Failed to load report");
      const data: ReportData = await res.json();
      setReport(data);
    } catch {
      toast.error("Failed to load report data");
    } finally {
      setReportLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  useEffect(() => {
    if (period === "custom") {
      if (customStart && customEnd) {
        loadReport(customStart, customEnd);
      }
    } else {
      const dates = getPresetDates(period);
      if (dates) {
        loadReport(dates.start, dates.end);
      }
    }
  }, [period, customStart, customEnd, loadReport]);

  const hasConfigChanges =
    config &&
    (taxEnabled !== config.taxEnabled ||
      ratePercent !== (config.taxRate * 100).toFixed(2).replace(/\.?0+$/, "") ||
      taxPaidBy !== config.taxPaidBy);

  const handleSave = async () => {
    const parsed = parseFloat(ratePercent);
    if (taxEnabled && (isNaN(parsed) || parsed < 0 || parsed > 100)) {
      toast.error("Tax rate must be between 0 and 100");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/organization/taxes-and-fees", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taxEnabled,
          taxRate: taxEnabled ? parsed / 100 : (config?.taxRate ?? 0),
          taxPaidBy,
        }),
      });

      if (res.ok) {
        const updated = await res.json();
        setConfig((prev) =>
          prev
            ? {
                ...prev,
                taxEnabled: updated.taxEnabled,
                taxRate: updated.taxRate,
                taxPaidBy: updated.taxPaidBy,
              }
            : prev
        );
        toast.success("Settings saved");
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to save settings");
      }
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Taxes & Fees</h1>
          <p className="text-muted-foreground">
            Configure how taxes and processing fees are handled for your organization.
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving || !hasConfigChanges}>
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            "Save Changes"
          )}
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Sales Tax Card */}
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle>Sales Tax Configuration</CardTitle>
            <CardDescription>
              Configure whether your organization collects sales tax and at what rate. The rate was
              defaulted from your state when you signed up.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1 space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="tax-toggle" className="flex flex-col gap-1">
                <span>Collect sales tax</span>
                <span className="font-normal text-muted-foreground text-xs">
                  When disabled, no tax will be applied at checkout.
                </span>
              </Label>
              <Switch id="tax-toggle" checked={taxEnabled} onCheckedChange={setTaxEnabled} />
            </div>

            {taxEnabled && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="tax-rate">Tax rate (%)</Label>
                  <Input
                    id="tax-rate"
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={ratePercent}
                    onChange={(e) => setRatePercent(e.target.value)}
                    className="max-w-[200px]"
                    placeholder="e.g. 6.25"
                  />
                  <p className="text-xs text-muted-foreground">
                    Enter the combined state + local sales tax rate for your location.
                  </p>
                </div>

                <Separator />

                <div className="space-y-3">
                  <Label className="text-sm font-medium">Who pays the sales tax?</Label>
                  <RadioGroup
                    value={taxPaidBy}
                    onValueChange={(v) => setTaxPaidBy(v as "CUSTOMER" | "ORGANIZATION")}
                    className="space-y-2"
                  >
                    <div className="flex items-start space-x-3">
                      <RadioGroupItem value="CUSTOMER" id="tax-customer" className="mt-0.5" />
                      <Label
                        htmlFor="tax-customer"
                        className="flex flex-col gap-0.5 cursor-pointer"
                      >
                        <span>Customer pays</span>
                        <span className="font-normal text-xs text-muted-foreground">
                          Tax appears as a separate line item at checkout.
                        </span>
                      </Label>
                    </div>
                    <div className="flex items-start space-x-3">
                      <RadioGroupItem value="ORGANIZATION" id="tax-org" className="mt-0.5" />
                      <Label htmlFor="tax-org" className="flex flex-col gap-0.5 cursor-pointer">
                        <span>Organization pays (tax-inclusive pricing)</span>
                        <span className="font-normal text-xs text-muted-foreground">
                          Prices include tax. Tax does not appear at checkout, but you still owe it.
                        </span>
                      </Label>
                    </div>
                  </RadioGroup>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Processing Fee Card */}
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle>Processing Fee</CardTitle>
            <CardDescription>
              Your processing fee rate is determined by your{" "}
              <Link href="/dashboard/usage/billing" className="underline hover:text-foreground">
                subscription plan
              </Link>
              .
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1 space-y-4">
            {config?.plan ? (
              <div className="rounded-lg border p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Plan</span>
                  <span className="font-medium">{config.plan.name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Transaction Fee</span>
                  <span className="font-medium">
                    {(config.plan.transactionFee * 100).toFixed(1)}% + $
                    {config.plan.perTransactionFee.toFixed(2)}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No subscription plan found. Processing fees require an active plan.
              </p>
            )}

            <Separator />

            <p className="text-sm text-muted-foreground">
              Processing fees are deducted from your payouts. Customers do not see the fee.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Report Section */}
      <Separator className="my-2" />

      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold tracking-tight flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Reports
        </h2>
        <p className="text-sm text-muted-foreground">
          View your tax liability and processing fee summary for any time period.
        </p>
      </div>

      {/* Period Selector */}
      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-1.5">
          <Label className="text-sm">Time Period</Label>
          <Select value={period} onValueChange={(v) => setPeriod(v as PresetPeriod)}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="this-month">This Month</SelectItem>
              <SelectItem value="last-month">Last Month</SelectItem>
              <SelectItem value="this-quarter">This Quarter</SelectItem>
              <SelectItem value="last-quarter">Last Quarter</SelectItem>
              <SelectItem value="this-year">This Year</SelectItem>
              <SelectItem value="last-year">Last Year</SelectItem>
              <SelectItem value="custom">Custom Range</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {period === "custom" && (
          <DateRangePicker
            startDate={customStart}
            endDate={customEnd}
            onStartChange={setCustomStart}
            onEndChange={setCustomEnd}
          />
        )}
      </div>

      {reportLoading ? (
        <div className="flex items-center justify-center p-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : report ? (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Tax Liability Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tax Liability</CardTitle>
              <CardDescription>
                Total tax collected from paid invoices in this period.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-3xl font-bold">{formatCurrency(report.tax.total)}</div>
              {report.tax.monthly.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Month</TableHead>
                      <TableHead className="text-right">Invoices</TableHead>
                      <TableHead className="text-right">Tax</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.tax.monthly.map((row) => (
                      <TableRow key={row.month}>
                        <TableCell>{formatMonthLabel(row.month)}</TableCell>
                        <TableCell className="text-right">{row.invoiceCount}</TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(row.taxCollected)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-sm text-muted-foreground">No tax data for this period.</p>
              )}
            </CardContent>
          </Card>

          {/* Processing Fee Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Processing Fees</CardTitle>
              <CardDescription>
                Fees based on your plan rate applied to settled transactions.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-3xl font-bold">{formatCurrency(report.fees.total)}</div>
              <div className="flex gap-4 text-sm text-muted-foreground">
                <span>{report.fees.transactionCount} transactions</span>
                <span>{formatCurrency(report.fees.totalVolume)} volume</span>
              </div>
              {report.fees.monthly.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Month</TableHead>
                      <TableHead className="text-right">Txns</TableHead>
                      <TableHead className="text-right">Volume</TableHead>
                      <TableHead className="text-right">Fees</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.fees.monthly.map((row) => (
                      <TableRow key={row.month}>
                        <TableCell>{formatMonthLabel(row.month)}</TableCell>
                        <TableCell className="text-right">{row.transactionCount}</TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(row.grossVolume)}
                        </TableCell>
                        <TableCell className="text-right">{formatCurrency(row.fees)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-sm text-muted-foreground">No fee data for this period.</p>
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
