"use client";

import { createContext, useContext } from "react";
import type { CalendarContextType } from "./types";

export const CalendarContext = createContext<CalendarContextType | null>(null);

export function useCalendarContext(): CalendarContextType {
  const context = useContext(CalendarContext);
  if (!context) {
    throw new Error(
      "useCalendarContext must be used within a CalendarProvider"
    );
  }
  return context;
}
