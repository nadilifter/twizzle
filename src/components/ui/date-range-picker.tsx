"use client";

import * as React from "react";
import { format, isValid, parse } from "date-fns";
import type { DateRange } from "react-day-picker";
import { CalendarIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const DISPLAY_FORMAT = "MM/dd/yyyy";
const VALUE_FORMAT = "yyyy-MM-dd";

function parseDisplayDate(str: string): Date | null {
  let d = parse(str, "MM/dd/yyyy", new Date());
  if (isValid(d) && d.getFullYear() > 1000) return d;
  d = parse(str, "yyyy-MM-dd", new Date());
  if (isValid(d) && d.getFullYear() > 1000) return d;
  return null;
}

function valueToDisplay(value: string | null): string {
  if (!value) return "";
  const d = parse(value, VALUE_FORMAT, new Date());
  if (!isValid(d)) return "";
  return format(d, DISPLAY_FORMAT);
}

export interface DateRangePickerProps {
  startDate: string | null;
  endDate: string | null;
  onStartChange: (value: string | null) => void;
  onEndChange: (value: string | null) => void;
  endDateOptional?: boolean;
  disabled?: (date: Date) => boolean;
  className?: string;
}

export function DateRangePicker({
  startDate,
  endDate,
  onStartChange,
  onEndChange,
  endDateOptional = false,
  disabled,
  className,
}: DateRangePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [startInput, setStartInput] = React.useState(() => valueToDisplay(startDate));
  const [endInput, setEndInput] = React.useState(() => valueToDisplay(endDate));

  React.useEffect(() => {
    setStartInput(valueToDisplay(startDate));
  }, [startDate]);

  React.useEffect(() => {
    setEndInput(valueToDisplay(endDate));
  }, [endDate]);

  const selectedRange = React.useMemo((): DateRange | undefined => {
    const from = startDate ? parse(startDate, VALUE_FORMAT, new Date()) : undefined;
    const to = endDate ? parse(endDate, VALUE_FORMAT, new Date()) : undefined;
    if (!from || !isValid(from)) return undefined;
    return { from, to: to && isValid(to) ? to : undefined };
  }, [startDate, endDate]);

  function handleStartBlur() {
    const raw = startInput.trim();
    if (!raw) {
      onStartChange(null);
      setStartInput("");
      return;
    }
    const parsed = parseDisplayDate(raw);
    if (parsed) {
      onStartChange(format(parsed, VALUE_FORMAT));
      setStartInput(format(parsed, DISPLAY_FORMAT));
    } else {
      setStartInput(valueToDisplay(startDate));
    }
  }

  function handleEndBlur() {
    const raw = endInput.trim();
    if (!raw) {
      onEndChange(null);
      setEndInput("");
      return;
    }
    const parsed = parseDisplayDate(raw);
    if (parsed) {
      onEndChange(format(parsed, VALUE_FORMAT));
      setEndInput(format(parsed, DISPLAY_FORMAT));
    } else {
      setEndInput(valueToDisplay(endDate));
    }
  }

  function handleCalendarSelect(range: DateRange | undefined) {
    if (!range?.from) {
      onStartChange(null);
      onEndChange(null);
      setStartInput("");
      setEndInput("");
      return;
    }

    // react-day-picker v9 sends { from: A, to: A } on a single-date click and
    // { from: A, to: B } (where B ≠ A) only once the user has picked a second
    // date. Use that distinction to keep the calendar open for the end date.
    const isRangeComplete = range.to != null && range.to.getTime() !== range.from.getTime();

    onStartChange(format(range.from, VALUE_FORMAT));
    setStartInput(format(range.from, DISPLAY_FORMAT));

    if (isRangeComplete) {
      onEndChange(format(range.to!, VALUE_FORMAT));
      setEndInput(format(range.to!, DISPLAY_FORMAT));
      setOpen(false);
    } else {
      // First click: start date chosen, waiting for end date
      onEndChange(null);
      setEndInput("");
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div
        className={cn(
          "flex h-9 w-full items-center rounded-md border border-input bg-transparent shadow-sm transition-colors focus-within:ring-1 focus-within:ring-ring",
          className
        )}
      >
        <input
          type="text"
          inputMode="numeric"
          value={startInput}
          onChange={(e) => setStartInput(e.target.value)}
          onBlur={handleStartBlur}
          placeholder="MM/DD/YYYY"
          className="min-w-0 flex-1 bg-transparent px-3 py-1 text-sm placeholder:text-muted-foreground focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
        />
        <span className="shrink-0 select-none text-muted-foreground text-sm">–</span>
        <input
          type="text"
          inputMode="numeric"
          value={endInput}
          onChange={(e) => setEndInput(e.target.value)}
          onBlur={handleEndBlur}
          placeholder={endDateOptional ? "No end date" : "MM/DD/YYYY"}
          className="min-w-0 flex-1 bg-transparent px-3 py-1 text-sm placeholder:text-muted-foreground focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
        />
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            type="button"
            tabIndex={-1}
            className="mr-1 h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
          >
            <CalendarIcon className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
      </div>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="range"
          selected={selectedRange}
          onSelect={handleCalendarSelect}
          disabled={disabled}
          numberOfMonths={2}
          defaultMonth={selectedRange?.from}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  );
}
