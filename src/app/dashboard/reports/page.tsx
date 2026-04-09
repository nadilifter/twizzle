"use client";

import Link from "next/link";
import { FlaskConical } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { DashboardPageHeader } from "@/components/dashboard-page-header";
import { REPORT_DEFINITIONS, COMING_SOON_BADGE_CLASS } from "./report-definitions";

export default function ReportsPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <DashboardPageHeader
        title="Reports"
        description="Business reports for your organization. Select a report to view details."
      />

      <Alert>
        <FlaskConical className="h-4 w-4" />
        <AlertTitle>Demo Data</AlertTitle>
        <AlertDescription>
          Reports are currently showing placeholder data for preview purposes. Live data
          integrations are coming soon.
        </AlertDescription>
      </Alert>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {REPORT_DEFINITIONS.map((report) => (
          <Link key={report.slug} href={`/dashboard/reports/${report.slug}`}>
            <Card className="h-full transition-colors hover:bg-muted/50">
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                <div className="rounded-md bg-muted p-2">
                  <report.icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <Badge variant="secondary" className={COMING_SOON_BADGE_CLASS}>
                  Coming Soon
                </Badge>
              </CardHeader>
              <CardContent>
                <CardTitle className="text-sm font-semibold mb-1">{report.title}</CardTitle>
                <CardDescription className="text-xs">{report.description}</CardDescription>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
