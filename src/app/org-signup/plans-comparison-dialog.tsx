"use client";

import * as React from "react";
import { Check, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  FEATURE_KEYS,
  FEATURE_LABELS,
  type FeatureToggles,
  parseFeatureToggles,
} from "@/lib/feature-toggles";

interface Plan {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  monthlyPrice: string;
  yearlyPrice: string | null;
  transactionFee: string;
  perTransactionFee: string;
  features: string[];
  featureToggles: Record<string, boolean>;
  isPopular: boolean;
  maxAthletes: number | null;
  maxUsers: number | null;
  maxPrograms: number | null;
  maxEvents: number | null;
  smsIncluded: number | null;
  smsOverageRate: string | null;
  emailIncluded: number | null;
  emailOverageRate: string | null;
  maxStorageMB: number | null;
  maxMembershipTypes: number | null;
}

interface PlansComparisonDialogProps {
  plans: Plan[];
  selectedPlanId: string;
  onSelectPlan: (planId: string) => void;
  children: React.ReactNode;
}

function formatCurrency(amount: string | number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
  }).format(Number(amount));
}

function formatRate(amount: string | number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(Number(amount));
}

function formatPercent(decimal: string | number) {
  return `${(Number(decimal) * 100).toFixed(1)}%`;
}

function formatStorage(mb: number | null) {
  if (mb === null) return "Unlimited";
  if (mb >= 1000) return `${mb / 1000} GB`;
  return `${mb} MB`;
}

function formatLimit(value: number | null) {
  return value === null ? "Unlimited" : value.toLocaleString();
}

// --- Desktop table helpers ---

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <TableRow>
      <TableCell
        colSpan={100}
        className="bg-muted/50 py-2 px-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground"
      >
        {children}
      </TableCell>
    </TableRow>
  );
}

function FeatureCheck({ enabled }: { enabled: boolean }) {
  return enabled ? (
    <Check className="h-4 w-4 text-green-500 mx-auto" />
  ) : (
    <X className="h-4 w-4 text-muted-foreground/40 mx-auto" />
  );
}

// --- Mobile card helpers ---

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-right">{value}</span>
    </div>
  );
}

function MobileFeatureRow({ label, enabled }: { label: string; enabled: boolean }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-sm text-muted-foreground">{label}</span>
      {enabled ? (
        <Check className="h-4 w-4 text-green-500" />
      ) : (
        <X className="h-4 w-4 text-muted-foreground/40" />
      )}
    </div>
  );
}

function MobileSectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground pt-3 pb-1">
      {children}
    </p>
  );
}

function MobilePlanCard({
  plan,
  toggles,
  isSelected,
  onSelect,
}: {
  plan: Plan;
  toggles: FeatureToggles;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <div className="space-y-1">
      <MobileSectionLabel>Pricing</MobileSectionLabel>
      <DetailRow label="Monthly" value={formatCurrency(plan.monthlyPrice)} />
      <DetailRow label="Yearly" value={plan.yearlyPrice ? formatCurrency(plan.yearlyPrice) : "—"} />
      <DetailRow label="Transaction fee" value={formatPercent(plan.transactionFee)} />
      <DetailRow label="Per-transaction fee" value={formatRate(plan.perTransactionFee)} />

      <Separator />
      <MobileSectionLabel>Capacity Limits</MobileSectionLabel>
      <DetailRow label="Athletes" value={formatLimit(plan.maxAthletes)} />
      <DetailRow label="Admin users" value={formatLimit(plan.maxUsers)} />
      <DetailRow label="Programs" value={formatLimit(plan.maxPrograms)} />
      <DetailRow label="Events" value={formatLimit(plan.maxEvents)} />
      <DetailRow label="Storage" value={formatStorage(plan.maxStorageMB)} />
      <DetailRow label="Membership types" value={formatLimit(plan.maxMembershipTypes)} />

      <Separator />
      <MobileSectionLabel>Usage Limits</MobileSectionLabel>
      <DetailRow
        label="SMS / month"
        value={plan.smsIncluded !== null ? plan.smsIncluded.toLocaleString() : "—"}
      />
      <DetailRow
        label="SMS overage"
        value={plan.smsOverageRate ? `${formatRate(plan.smsOverageRate)}/msg` : "—"}
      />
      <DetailRow
        label="Emails / month"
        value={plan.emailIncluded !== null ? plan.emailIncluded.toLocaleString() : "—"}
      />
      <DetailRow
        label="Email overage"
        value={plan.emailOverageRate ? `${formatRate(plan.emailOverageRate)}/email` : "—"}
      />

      <Separator />
      <MobileSectionLabel>Features</MobileSectionLabel>
      {FEATURE_KEYS.map((key) => (
        <MobileFeatureRow key={key} label={FEATURE_LABELS[key]} enabled={toggles[key]} />
      ))}

      <div className="pt-4">
        <Button className="w-full" variant={isSelected ? "default" : "outline"} onClick={onSelect}>
          {isSelected ? "Selected" : "Select Plan"}
        </Button>
      </div>
    </div>
  );
}

// --- Main component ---

export function PlansComparisonDialog({
  plans,
  selectedPlanId,
  onSelectPlan,
  children,
}: PlansComparisonDialogProps) {
  const [open, setOpen] = React.useState(false);

  const handleSelect = (planId: string) => {
    onSelectPlan(planId);
    setOpen(false);
  };

  const parsedToggles = React.useMemo(
    () => plans.map((p) => parseFeatureToggles(p.featureToggles)),
    [plans]
  );

  const defaultTab = plans.find((p) => p.id === selectedPlanId)?.slug ?? plans[0]?.slug ?? "";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-5xl w-[95vw] max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle>Compare Plans</DialogTitle>
          <DialogDescription>
            See exactly what each plan includes. Select the plan that fits your organization.
          </DialogDescription>
        </DialogHeader>

        {/* ===== Mobile: tabs per plan ===== */}
        <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-6 md:hidden">
          <Tabs defaultValue={defaultTab}>
            <TabsList className="w-full">
              {plans.map((plan) => (
                <TabsTrigger key={plan.slug} value={plan.slug} className="flex-1 text-xs">
                  {plan.name}
                </TabsTrigger>
              ))}
            </TabsList>

            {plans.map((plan, i) => (
              <TabsContent key={plan.slug} value={plan.slug}>
                <div className="flex flex-col items-center gap-1 py-3">
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-semibold">{plan.name}</span>
                    {plan.isPopular && (
                      <Badge className="bg-primary text-[10px] px-1.5 py-0">Popular</Badge>
                    )}
                  </div>
                  {plan.description && (
                    <p className="text-sm text-muted-foreground">{plan.description}</p>
                  )}
                  <div className="text-2xl font-bold">
                    {formatCurrency(plan.monthlyPrice)}
                    <span className="text-sm font-normal text-muted-foreground">/mo</span>
                  </div>
                </div>

                <MobilePlanCard
                  plan={plan}
                  toggles={parsedToggles[i]}
                  isSelected={selectedPlanId === plan.id}
                  onSelect={() => handleSelect(plan.id)}
                />
              </TabsContent>
            ))}
          </Tabs>
        </div>

        {/* ===== Desktop: comparison table ===== */}
        <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-6 hidden md:block">
          <div className="overflow-hidden rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[180px] min-w-[180px] sticky left-0 bg-background z-10" />
                  {plans.map((plan) => (
                    <TableHead
                      key={plan.id}
                      className={cn(
                        "text-center min-w-[140px]",
                        selectedPlanId === plan.id && "bg-primary/5"
                      )}
                    >
                      <div className="flex flex-col items-center gap-1 py-2">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-foreground text-base">
                            {plan.name}
                          </span>
                          {plan.isPopular && (
                            <Badge className="bg-primary text-[10px] px-1.5 py-0">Popular</Badge>
                          )}
                        </div>
                        <div className="text-lg font-bold text-foreground">
                          {formatCurrency(plan.monthlyPrice)}
                          <span className="text-xs font-normal text-muted-foreground">/mo</span>
                        </div>
                        {plan.yearlyPrice && (
                          <span className="text-xs text-muted-foreground">
                            {formatCurrency(plan.yearlyPrice)}/yr
                          </span>
                        )}
                        <Button
                          size="sm"
                          variant={selectedPlanId === plan.id ? "default" : "outline"}
                          className="mt-1 text-xs h-7"
                          onClick={() => handleSelect(plan.id)}
                        >
                          {selectedPlanId === plan.id ? "Selected" : "Select Plan"}
                        </Button>
                      </div>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>

              <TableBody>
                <SectionLabel>Pricing</SectionLabel>
                <TableRow>
                  <TableCell className="font-medium sticky left-0 bg-background">
                    Monthly price
                  </TableCell>
                  {plans.map((plan) => (
                    <TableCell
                      key={plan.id}
                      className={cn("text-center", selectedPlanId === plan.id && "bg-primary/5")}
                    >
                      {formatCurrency(plan.monthlyPrice)}
                    </TableCell>
                  ))}
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium sticky left-0 bg-background">
                    Yearly price
                  </TableCell>
                  {plans.map((plan) => (
                    <TableCell
                      key={plan.id}
                      className={cn("text-center", selectedPlanId === plan.id && "bg-primary/5")}
                    >
                      {plan.yearlyPrice ? formatCurrency(plan.yearlyPrice) : "—"}
                    </TableCell>
                  ))}
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium sticky left-0 bg-background">
                    Transaction fee
                  </TableCell>
                  {plans.map((plan) => (
                    <TableCell
                      key={plan.id}
                      className={cn("text-center", selectedPlanId === plan.id && "bg-primary/5")}
                    >
                      {formatPercent(plan.transactionFee)}
                    </TableCell>
                  ))}
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium sticky left-0 bg-background">
                    Per-transaction fee
                  </TableCell>
                  {plans.map((plan) => (
                    <TableCell
                      key={plan.id}
                      className={cn("text-center", selectedPlanId === plan.id && "bg-primary/5")}
                    >
                      {formatRate(plan.perTransactionFee)}
                    </TableCell>
                  ))}
                </TableRow>

                <SectionLabel>Capacity Limits</SectionLabel>
                <TableRow>
                  <TableCell className="font-medium sticky left-0 bg-background">
                    Athletes
                  </TableCell>
                  {plans.map((plan) => (
                    <TableCell
                      key={plan.id}
                      className={cn("text-center", selectedPlanId === plan.id && "bg-primary/5")}
                    >
                      {formatLimit(plan.maxAthletes)}
                    </TableCell>
                  ))}
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium sticky left-0 bg-background">
                    Admin users
                  </TableCell>
                  {plans.map((plan) => (
                    <TableCell
                      key={plan.id}
                      className={cn("text-center", selectedPlanId === plan.id && "bg-primary/5")}
                    >
                      {formatLimit(plan.maxUsers)}
                    </TableCell>
                  ))}
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium sticky left-0 bg-background">
                    Programs
                  </TableCell>
                  {plans.map((plan) => (
                    <TableCell
                      key={plan.id}
                      className={cn("text-center", selectedPlanId === plan.id && "bg-primary/5")}
                    >
                      {formatLimit(plan.maxPrograms)}
                    </TableCell>
                  ))}
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium sticky left-0 bg-background">Events</TableCell>
                  {plans.map((plan) => (
                    <TableCell
                      key={plan.id}
                      className={cn("text-center", selectedPlanId === plan.id && "bg-primary/5")}
                    >
                      {formatLimit(plan.maxEvents)}
                    </TableCell>
                  ))}
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium sticky left-0 bg-background">Storage</TableCell>
                  {plans.map((plan) => (
                    <TableCell
                      key={plan.id}
                      className={cn("text-center", selectedPlanId === plan.id && "bg-primary/5")}
                    >
                      {formatStorage(plan.maxStorageMB)}
                    </TableCell>
                  ))}
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium sticky left-0 bg-background">
                    Membership types
                  </TableCell>
                  {plans.map((plan) => (
                    <TableCell
                      key={plan.id}
                      className={cn("text-center", selectedPlanId === plan.id && "bg-primary/5")}
                    >
                      {formatLimit(plan.maxMembershipTypes)}
                    </TableCell>
                  ))}
                </TableRow>

                <SectionLabel>Usage Limits</SectionLabel>
                <TableRow>
                  <TableCell className="font-medium sticky left-0 bg-background">
                    SMS / month
                  </TableCell>
                  {plans.map((plan) => (
                    <TableCell
                      key={plan.id}
                      className={cn("text-center", selectedPlanId === plan.id && "bg-primary/5")}
                    >
                      {plan.smsIncluded !== null ? plan.smsIncluded.toLocaleString() : "—"}
                    </TableCell>
                  ))}
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium sticky left-0 bg-background">
                    SMS overage rate
                  </TableCell>
                  {plans.map((plan) => (
                    <TableCell
                      key={plan.id}
                      className={cn("text-center", selectedPlanId === plan.id && "bg-primary/5")}
                    >
                      {plan.smsOverageRate ? `${formatRate(plan.smsOverageRate)}/msg` : "—"}
                    </TableCell>
                  ))}
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium sticky left-0 bg-background">
                    Emails / month
                  </TableCell>
                  {plans.map((plan) => (
                    <TableCell
                      key={plan.id}
                      className={cn("text-center", selectedPlanId === plan.id && "bg-primary/5")}
                    >
                      {plan.emailIncluded !== null ? plan.emailIncluded.toLocaleString() : "—"}
                    </TableCell>
                  ))}
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium sticky left-0 bg-background">
                    Email overage rate
                  </TableCell>
                  {plans.map((plan) => (
                    <TableCell
                      key={plan.id}
                      className={cn("text-center", selectedPlanId === plan.id && "bg-primary/5")}
                    >
                      {plan.emailOverageRate ? `${formatRate(plan.emailOverageRate)}/email` : "—"}
                    </TableCell>
                  ))}
                </TableRow>

                <SectionLabel>Features</SectionLabel>
                {FEATURE_KEYS.map((key) => (
                  <TableRow key={key}>
                    <TableCell className="font-medium sticky left-0 bg-background">
                      {FEATURE_LABELS[key]}
                    </TableCell>
                    {plans.map((plan, i) => (
                      <TableCell
                        key={plan.id}
                        className={cn("text-center", selectedPlanId === plan.id && "bg-primary/5")}
                      >
                        <FeatureCheck enabled={parsedToggles[i][key]} />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
