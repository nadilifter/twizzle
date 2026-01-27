import { create } from "zustand";
import {
  startOfWeek,
  addWeeks,
  subWeeks,
  addDays,
} from "date-fns";

interface CalendarState {
  currentWeekStart: Date;
  searchQuery: string;
  eventTypeFilter: "all" | "with-meeting" | "without-meeting";
  participantsFilter: "all" | "with-participants" | "without-participants";
  goToNextWeek: () => void;
  goToPreviousWeek: () => void;
  goToToday: () => void;
  goToDate: (date: Date) => void;
  setSearchQuery: (query: string) => void;
  setEventTypeFilter: (
    filter: "all" | "with-meeting" | "without-meeting"
  ) => void;
  setParticipantsFilter: (
    filter: "all" | "with-participants" | "without-participants"
  ) => void;
  getWeekDays: () => Date[];
}

export const useCalendarStore = create<CalendarState>((set, get) => ({
  currentWeekStart: startOfWeek(new Date(), { weekStartsOn: 1 }),
  searchQuery: "",
  eventTypeFilter: "all",
  participantsFilter: "all",

  goToNextWeek: () =>
    set((state) => ({
      currentWeekStart: addWeeks(state.currentWeekStart, 1),
    })),

  goToPreviousWeek: () =>
    set((state) => ({
      currentWeekStart: subWeeks(state.currentWeekStart, 1),
    })),

  goToToday: () =>
    set({
      currentWeekStart: startOfWeek(new Date(), { weekStartsOn: 1 }),
    }),

  goToDate: (date: Date) =>
    set({
      currentWeekStart: startOfWeek(date, { weekStartsOn: 1 }),
    }),

  setSearchQuery: (query: string) => set({ searchQuery: query }),
  setEventTypeFilter: (filter: "all" | "with-meeting" | "without-meeting") =>
    set({ eventTypeFilter: filter }),
  setParticipantsFilter: (
    filter: "all" | "with-participants" | "without-participants"
  ) => set({ participantsFilter: filter }),

  getWeekDays: () => {
    const state = get();
    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      days.push(addDays(state.currentWeekStart, i));
    }
    return days;
  },
}));
