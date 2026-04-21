export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { computeReferralLedgerMismatches } from "@/lib/referral";
import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Gift, Users, CreditCard, CheckCircle } from "lucide-react";

export default async function SuperadminReferralsPage() {
  const referrals = await db.referral.findMany({
    include: {
      referrerOrganization: { select: { id: true, name: true, slug: true } },
      referredOrganization: { select: { id: true, name: true, slug: true } },
      applications: {
        include: {
          subscriptionInvoice: {
            select: { id: true, reference: true, periodStart: true, paidAt: true },
          },
        },
        orderBy: { appliedAt: "desc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const integrityMismatches = computeReferralLedgerMismatches(referrals);

  const totalReferrals = referrals.length;
  const totalCreditMonths = referrals.reduce((sum, r) => sum + r.creditMonths, 0);
  const totalCreditsUsed = referrals.reduce((sum, r) => sum + r.creditMonthsUsed, 0);
  const totalCreditsRemaining = totalCreditMonths - totalCreditsUsed;

  // Aggregate referrals by referring org for the summary table
  const byReferrer = new Map<
    string,
    {
      orgName: string;
      orgSlug: string;
      count: number;
      creditsAwarded: number;
      creditsUsed: number;
    }
  >();

  for (const r of referrals) {
    const key = r.referrerOrganizationId;
    const existing = byReferrer.get(key);
    if (existing) {
      existing.count++;
      existing.creditsAwarded += r.creditMonths;
      existing.creditsUsed += r.creditMonthsUsed;
    } else {
      byReferrer.set(key, {
        orgName: r.referrerOrganization.name,
        orgSlug: r.referrerOrganization.slug,
        count: 1,
        creditsAwarded: r.creditMonths,
        creditsUsed: r.creditMonthsUsed,
      });
    }
  }

  const referrerSummary = Array.from(byReferrer.entries())
    .map(([id, data]) => ({ id, ...data }))
    .sort((a, b) => b.count - a.count);

  return (
    <div className="flex flex-col gap-6 p-4">
      <div>
        <h1 className="text-2xl font-bold">Referrals</h1>
        <p className="text-muted-foreground">
          Track referral activity and billing credits across all organizations
        </p>
      </div>

      {integrityMismatches.length > 0 && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Ledger integrity mismatch</CardTitle>
            <CardDescription>
              The counter on these referrals disagrees with the sum of recorded credit applications.
              Rows with no applications may be pre-ledger (applied before this feature shipped).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Referral ID</TableHead>
                  <TableHead className="text-right">creditMonthsUsed</TableHead>
                  <TableHead className="text-right">Σ monthsApplied</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {integrityMismatches.map((m) => (
                  <TableRow key={m.referralId}>
                    <TableCell className="font-mono text-xs">{m.referralId}</TableCell>
                    <TableCell className="text-right">{m.counter}</TableCell>
                    <TableCell className="text-right">{m.summed}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Referrals</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalReferrals}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Credits Awarded</CardTitle>
            <Gift className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalCreditMonths} {totalCreditMonths === 1 ? "month" : "months"}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Credits Used</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalCreditsUsed} {totalCreditsUsed === 1 ? "month" : "months"}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Credits Remaining</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalCreditsRemaining} {totalCreditsRemaining === 1 ? "month" : "months"}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Referrals by Organization</CardTitle>
          <CardDescription>
            Summary of referral activity grouped by the referring organization.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {referrerSummary.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No referrals yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Organization</TableHead>
                  <TableHead className="text-right">Referrals</TableHead>
                  <TableHead className="text-right">Credits Awarded</TableHead>
                  <TableHead className="text-right">Credits Used</TableHead>
                  <TableHead className="text-right">Remaining</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {referrerSummary.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <Link
                        href={`/superadmin/organizations/${row.orgSlug}`}
                        className="font-medium hover:underline"
                      >
                        {row.orgName}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right">{row.count}</TableCell>
                    <TableCell className="text-right">{row.creditsAwarded}</TableCell>
                    <TableCell className="text-right">{row.creditsUsed}</TableCell>
                    <TableCell className="text-right">
                      {row.creditsAwarded - row.creditsUsed}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>All Referrals</CardTitle>
          <CardDescription>Complete list of all referral records.</CardDescription>
        </CardHeader>
        <CardContent>
          {referrals.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No referrals yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Referring Org</TableHead>
                  <TableHead>Referred Org</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Credit</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Applied to</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {referrals.map((referral) => {
                  const remaining = referral.creditMonths - referral.creditMonthsUsed;
                  return (
                    <TableRow key={referral.id}>
                      <TableCell>
                        <Link
                          href={`/superadmin/organizations/${referral.referrerOrganization.slug}`}
                          className="font-medium hover:underline"
                        >
                          {referral.referrerOrganization.name}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/superadmin/organizations/${referral.referredOrganization.slug}`}
                          className="hover:underline"
                        >
                          {referral.referredOrganization.name}
                        </Link>
                      </TableCell>
                      <TableCell>
                        {referral.createdAt.toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </TableCell>
                      <TableCell className="text-right">
                        {referral.creditMonths} {referral.creditMonths === 1 ? "month" : "months"}
                      </TableCell>
                      <TableCell>
                        {remaining > 0 ? (
                          <Badge variant="default">Active</Badge>
                        ) : (
                          <Badge variant="secondary">Used</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {referral.applications.length === 0 ? (
                          <span className="text-muted-foreground text-xs">—</span>
                        ) : (
                          <ul className="flex flex-col gap-0.5">
                            {referral.applications.map((app) => (
                              <li key={app.id} className="text-xs">
                                <span className="font-mono">
                                  {app.subscriptionInvoice.reference}
                                </span>
                                <span className="text-muted-foreground">
                                  {" "}
                                  ·{" "}
                                  {app.appliedAt.toLocaleDateString("en-US", {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                  })}
                                  {app.monthsApplied !== 1 && ` · ${app.monthsApplied}mo`}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
