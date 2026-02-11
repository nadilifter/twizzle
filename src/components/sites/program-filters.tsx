"use client";

import { format } from "date-fns";
import { CalendarDays, Clock, Users, Award, UserCircle, X } from "lucide-react";
import type { DateRange } from "react-day-picker";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

export interface Level {
  id: string;
  name: string;
  color: string | null;
}

export interface Coach {
  id: string;
  name: string;
  avatar: string | null;
}

export interface ProgramFilterState {
  ageRange: [number, number];
  dateRange: DateRange | undefined;
  timeRange: [string, string];
  selectedLevels: string[];
  selectedCoaches: string[];
}

export const DEFAULT_FILTERS: ProgramFilterState = {
  ageRange: [0, 99],
  dateRange: undefined,
  timeRange: ["", ""],
  selectedLevels: [],
  selectedCoaches: [],
};

// Generate hour options: 12 AM (midnight) through 11 PM
const HOUR_OPTIONS = Array.from({ length: 24 }, (_, hour) => {
  const h12 = hour % 12 || 12;
  const ampm = hour < 12 ? "AM" : "PM";
  const value = `${String(hour).padStart(2, "0")}:00`;
  const label = `${h12}:00 ${ampm}`;
  return { value, label };
});

interface ProgramFiltersProps {
  levels: Level[];
  coaches: Coach[];
  filters: ProgramFilterState;
  onFiltersChange: (filters: ProgramFilterState) => void;
  activeFilterCount: number;
}

export function ProgramFiltersContent({
  levels,
  coaches,
  filters,
  onFiltersChange,
  activeFilterCount,
}: ProgramFiltersProps) {
  const handleMinAgeChange = (raw: string) => {
    const val = raw === "" ? 0 : Math.max(0, Math.min(99, parseInt(raw, 10) || 0));
    onFiltersChange({ ...filters, ageRange: [val, filters.ageRange[1]] });
  };

  const handleMaxAgeChange = (raw: string) => {
    const val = raw === "" ? 99 : Math.max(0, Math.min(99, parseInt(raw, 10) || 0));
    onFiltersChange({ ...filters, ageRange: [filters.ageRange[0], val] });
  };

  const handleDateChange = (range: DateRange | undefined) => {
    onFiltersChange({ ...filters, dateRange: range });
  };

  const handleTimeStartChange = (value: string) => {
    onFiltersChange({
      ...filters,
      timeRange: [value === "__any__" ? "" : value, filters.timeRange[1]],
    });
  };

  const handleTimeEndChange = (value: string) => {
    onFiltersChange({
      ...filters,
      timeRange: [filters.timeRange[0], value === "__any__" ? "" : value],
    });
  };

  const toggleLevel = (levelId: string) => {
    const current = filters.selectedLevels;
    const next = current.includes(levelId)
      ? current.filter((id) => id !== levelId)
      : [...current, levelId];
    onFiltersChange({ ...filters, selectedLevels: next });
  };

  const toggleCoach = (coachId: string) => {
    const current = filters.selectedCoaches;
    const next = current.includes(coachId)
      ? current.filter((id) => id !== coachId)
      : [...current, coachId];
    onFiltersChange({ ...filters, selectedCoaches: next });
  };

  const clearAll = () => {
    onFiltersChange({ ...DEFAULT_FILTERS });
  };

  return (
    <div className="space-y-5">
      {/* Age Range */}
      <div className="space-y-3">
        <Label className="flex items-center gap-1.5 text-sm font-medium">
          <Users className="h-3.5 w-3.5" />
          Age Range
        </Label>
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <Label className="text-xs text-muted-foreground mb-1 block">Min</Label>
            <Input
              type="number"
              min={0}
              max={99}
              value={filters.ageRange[0] === 0 ? "" : filters.ageRange[0]}
              placeholder="0"
              onChange={(e) => handleMinAgeChange(e.target.value)}
            />
          </div>
          <span className="text-sm text-muted-foreground mt-5">to</span>
          <div className="flex-1">
            <Label className="text-xs text-muted-foreground mb-1 block">Max</Label>
            <Input
              type="number"
              min={0}
              max={99}
              value={filters.ageRange[1] === 99 ? "" : filters.ageRange[1]}
              placeholder="99"
              onChange={(e) => handleMaxAgeChange(e.target.value)}
            />
          </div>
        </div>
      </div>

      <Separator />

      {/* Date Range */}
      <div className="space-y-3">
        <Label className="flex items-center gap-1.5 text-sm font-medium">
          <CalendarDays className="h-3.5 w-3.5" />
          Date Range
        </Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "w-full justify-start text-left font-normal",
                !filters.dateRange?.from && "text-muted-foreground"
              )}
            >
              <CalendarDays className="mr-2 h-4 w-4" />
              {filters.dateRange?.from ? (
                filters.dateRange.to ? (
                  <>
                    {format(filters.dateRange.from, "MMM d")} -{" "}
                    {format(filters.dateRange.to, "MMM d, yyyy")}
                  </>
                ) : (
                  format(filters.dateRange.from, "MMM d, yyyy")
                )
              ) : (
                "Select dates"
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="range"
              selected={filters.dateRange}
              onSelect={handleDateChange}
              numberOfMonths={1}
            />
          </PopoverContent>
        </Popover>
        {filters.dateRange?.from && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-muted-foreground"
            onClick={() => onFiltersChange({ ...filters, dateRange: undefined })}
          >
            <X className="mr-1 h-3 w-3" />
            Clear dates
          </Button>
        )}
      </div>

      <Separator />

      {/* Time Range */}
      <div className="space-y-3">
        <Label className="flex items-center gap-1.5 text-sm font-medium">
          <Clock className="h-3.5 w-3.5" />
          Time Range
        </Label>
        <div className="flex items-center gap-2">
          <Select
            value={filters.timeRange[0] || "__any__"}
            onValueChange={handleTimeStartChange}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="From" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__any__">Any start</SelectItem>
              {HOUR_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-sm text-muted-foreground shrink-0">to</span>
          <Select
            value={filters.timeRange[1] || "__any__"}
            onValueChange={handleTimeEndChange}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="To" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__any__">Any end</SelectItem>
              {HOUR_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Level */}
      {levels.length > 0 && (
        <>
          <Separator />
          <div className="space-y-3">
            <Label className="flex items-center gap-1.5 text-sm font-medium">
              <Award className="h-3.5 w-3.5" />
              Level
            </Label>
            <div className="flex flex-wrap gap-2">
              {levels.map((level) => {
                const isSelected = filters.selectedLevels.includes(level.id);
                return (
                  <button
                    key={level.id}
                    onClick={() => toggleLevel(level.id)}
                    className="focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 rounded-md"
                  >
                    <Badge
                      variant={isSelected ? "default" : "outline"}
                      className={cn(
                        "cursor-pointer select-none transition-colors",
                        !isSelected && "hover:bg-muted"
                      )}
                      style={
                        isSelected && level.color
                          ? {
                              backgroundColor: level.color,
                              borderColor: level.color,
                              color: "#fff",
                            }
                          : level.color
                          ? {
                              borderColor: `${level.color}60`,
                              color: level.color,
                            }
                          : undefined
                      }
                    >
                      {level.name}
                    </Badge>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* Coach */}
      {coaches.length > 0 && (
        <>
          <Separator />
          <div className="space-y-3">
            <Label className="flex items-center gap-1.5 text-sm font-medium">
              <UserCircle className="h-3.5 w-3.5" />
              Coach
            </Label>
            <div className="flex flex-wrap gap-2">
              {coaches.map((coach) => {
                const isSelected = filters.selectedCoaches.includes(coach.id);
                return (
                  <button
                    key={coach.id}
                    onClick={() => toggleCoach(coach.id)}
                    className="focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 rounded-md"
                  >
                    <Badge
                      variant={isSelected ? "default" : "outline"}
                      className={cn(
                        "cursor-pointer select-none transition-colors",
                        !isSelected && "hover:bg-muted"
                      )}
                    >
                      {coach.name}
                    </Badge>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* Clear All */}
      {activeFilterCount > 0 && (
        <>
          <Separator />
          <Button
            variant="outline"
            onClick={clearAll}
            className="w-full gap-2"
          >
            <X className="h-4 w-4" />
            Clear All Filters
          </Button>
        </>
      )}
    </div>
  );
}
