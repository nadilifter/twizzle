"use client";

import { CalendarHeader } from "@/components/calendar/calendar-header";
import { CalendarControls } from "@/components/calendar/calendar-controls";
import { CalendarView } from "@/components/calendar/calendar-view";

export default function CalendarPage() {
  return (
    <div className="h-full min-h-[calc(100vh-4rem)] overflow-hidden flex flex-col lg:p-2 w-full">
      <div className="lg:border lg:rounded-md overflow-hidden flex flex-col items-center justify-start bg-background h-full w-full">
        <div className="w-full">
          <CalendarHeader />
          <CalendarControls />
        </div>
        <div className="flex-1 overflow-hidden w-full">
          <CalendarView />
        </div>
      </div>
    </div>
  );
}
