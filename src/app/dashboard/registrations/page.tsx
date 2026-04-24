"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ClipboardList, Users, CalendarOff, ArrowRight } from "lucide-react";
import Link from "next/link";
import { DashboardPageHeader } from "@/components/dashboard-page-header";

export default function RegistrationsPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <DashboardPageHeader
        title="Registrations"
        description="Manage your registration programs and queue settings."
      />

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <ClipboardList className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle>Programs</CardTitle>
                <CardDescription>Configure registration programs and pricing</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Create and manage programs that athletes can register for. Set up membership tiers,
              requirements, and assign coaches.
            </p>
            <Button asChild variant="outline" className="w-full">
              <Link href="/dashboard/registrations/programs">
                Manage Programs
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <CalendarOff className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle>Holidays</CardTitle>
                <CardDescription>Organization closures and holidays</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Manage national holidays and custom closures. Programs will not create sessions on
              enabled holiday dates.
            </p>
            <Button asChild variant="outline" className="w-full">
              <Link href="/dashboard/registrations/holidays">
                Manage Holidays
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle>Queues</CardTitle>
                <CardDescription>Virtual waiting room configuration</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Configure registration queues to manage high-traffic registration periods. Set
              reservation timeouts and control concurrent registrations.
            </p>
            <Button asChild variant="outline" className="w-full">
              <Link href="/dashboard/registrations/queues">
                Manage Queues
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
