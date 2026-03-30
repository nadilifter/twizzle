"use client";

import { ProgramStepper } from "../components/program-stepper";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function NewProgramPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/registrations/programs">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Create Program</h1>
          <p className="text-muted-foreground">
            Set up a new registration program for your organization.
          </p>
        </div>
      </div>

      <ProgramStepper />
    </div>
  );
}
