"use client";

import { EventStepper } from "../components/event-stepper";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function NewEventPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/events">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Create Event</h1>
          <p className="text-muted-foreground">Set up a new event for your organization.</p>
        </div>
      </div>

      <EventStepper />
    </div>
  );
}
