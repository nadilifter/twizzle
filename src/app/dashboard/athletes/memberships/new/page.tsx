"use client";

import { MembershipStepper } from "../components/membership-stepper";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { DashboardPageHeader } from "@/components/dashboard-page-header";

export default function NewMembershipPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="icon" asChild className="shrink-0">
          <Link href="/dashboard/athletes/memberships">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <DashboardPageHeader
            title="Create Membership Group"
            description="Set up a new membership type for your organization."
          />
        </div>
      </div>

      <MembershipStepper />
    </div>
  );
}
