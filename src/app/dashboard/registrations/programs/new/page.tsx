"use client";

import { ProgramStepper } from "../components/program-stepper";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { DashboardPageHeader } from "@/components/dashboard-page-header";

export default function NewProgramPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="icon" asChild className="shrink-0">
          <Link href="/dashboard/registrations/programs">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <DashboardPageHeader
            title="Create Program"
            description="Set up a new registration program for your organization."
          />
        </div>
      </div>

      <ProgramStepper />
    </div>
  );
}
