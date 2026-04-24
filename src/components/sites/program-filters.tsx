"use client";

import { format } from "date-fns";
import {
  CalendarDays,
  Clock,
  Users,
  Award,
  UserCircle,
  CalendarRange,
  Layers,
  MapPin,
  CircleDot,
  Repeat,
  X,
} from "lucide-react";
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

export interface SeasonFilter {
  id: string;
  name: string;
  color: string;
}

export interface CategoryFilter {
  id: string;
  name: string;
}

export interface FacilityFilter {
  id: string;
  name: string;
}

export interface ProgramFilterState {
  ageRange: [number, number];
  dateRange: DateRange | undefined;
  timeRange: [string, string];
  selectedLevels: string[];
  selectedCoaches: string[];
  selectedSeason: string;
  selectedCategory: string;
  selectedFacility: string;
  selectedGenders: string[];
  selectedStatus: string[];
  recurringFilter: "all" | "recurring" | "drop-in";
}

export const DEFAULT_FILTERS: ProgramFilterState = {
  ageRange: [0, 99],
  dateRange: undefined,
  timeRange: ["", ""],
  selectedLevels: [],
  selectedCoaches: [],
  selectedSeason: "",
  selectedCategory: "",
  selectedFacility: "",
  selectedGenders: [],
  selectedStatus: ["DRAFT", "ACTIVE"],
  recurringFilter: "all",
};

const DEFAULT_STATUS_KEY = ["DRAFT", "ACTIVE"].sort().join(",");

// Generate hour options: 12 AM (midnight) through 11 PM
const HOUR_OPTIONS = Array.from({ length: 24 }, (_, hour) => {
  const h12 = hour % 12 || 12;
  const ampm = hour < 12 ? "AM" : "PM";
  const value = `${String(hour).padStart(2, "0")}:00`;
  const label = `${h12}:00 ${ampm}`;
  return { value, label };
});

export function countActiveFilters(
  filters: ProgramFilterState,
  { hideDateRange = false }: { hideDateRange?: boolean } = {}
): number {
  let count = 0;
  if (
    filters.ageRange[0] !== DEFAULT_FILTERS.ageRange[0] ||
    filters.ageRange[1] !== DEFAULT_FILTERS.ageRange[1]
  )
    count++;
  if (!hideDateRange && filters.dateRange?.from) count++;
  if (filters.timeRange[0] || filters.timeRange[1]) count++;
  if (filters.selectedLevels.length > 0) count++;
  if (filters.selectedCoaches.length > 0) count++;
  if (filters.selectedSeason) count++;
  if (filters.selectedCategory) count++;
  if (filters.selectedFacility) count++;
  if (filters.selectedGenders.length > 0) count++;
  if (filters.selectedStatus.slice().sort().join(",") !== DEFAULT_STATUS_KEY) count++;
  if (filters.recurringFilter !== "all") count++;
  return count;
}

const GENDER_OPTIONS = [
  { value: "MALE", label: "Male" },
  { value: "FEMALE", label: "Female" },
  { value: "OTHER", label: "Other" },
  { value: "PREFER_NOT_TO_SAY", label: "Prefer Not to Say" },
] as const;

interface ProgramFiltersProps {
  levels: Level[];
  coaches: Coach[];
  seasons?: SeasonFilter[];
  categories?: CategoryFilter[];
  facilities?: FacilityFilter[];
  filters: ProgramFilterState;
  onFiltersChange: (filters: ProgramFilterState) => void;
  hideDateRange?: boolean;
  showGenderFilter?: boolean;
  showStatusFilter?: boolean;
  showSeasonFilter?: boolean;
}

export function ProgramFiltersContent({
  levels,
  coaches,
  seasons = [],
  categories = [],
  facilities = [],
  filters,
  onFiltersChange,
  hideDateRange = false,
  showGenderFilter = false,
  showStatusFilter = false,
  showSeasonFilter = false,
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

  const toggleGender = (gender: string) => {
    const current = filters.selectedGenders;
    const next = current.includes(gender)
      ? current.filter((g) => g !== gender)
      : [...current, gender];
    onFiltersChange({ ...filters, selectedGenders: next });
  };

  return (
    <div className="space-y-5">
      {/* Status (admin only) */}
      {showStatusFilter && (
        <>
          <div className="space-y-3">
            <Label className="flex items-center gap-1.5 text-sm font-medium">
              <CircleDot className="h-3.5 w-3.5" />
              Status
            </Label>
            <div className="flex flex-wrap gap-2">
              {(["DRAFT", "ACTIVE", "COMPLETE"] as const).map((s) => {
                const selected = filters.selectedStatus.includes(s);
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => {
                      const next = selected
                        ? filters.selectedStatus.filter((v) => v !== s)
                        : [...filters.selectedStatus, s];
                      onFiltersChange({ ...filters, selectedStatus: next });
                    }}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                      selected ? "border-primary bg-primary/5 text-primary" : "hover:bg-muted/50"
                    )}
                  >
                    {s === "DRAFT" ? "Draft" : s === "ACTIVE" ? "Active" : "Complete"}
                  </button>
                );
              })}
            </div>
          </div>
          <Separator />
        </>
      )}

      {/* Recurring vs Drop-in */}
      {showStatusFilter && (
        <>
          <div className="space-y-3">
            <Label className="flex items-center gap-1.5 text-sm font-medium">
              <Repeat className="h-3.5 w-3.5" />
              Session Type
            </Label>
            <div className="flex gap-2">
              {(["all", "recurring", "drop-in"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => onFiltersChange({ ...filters, recurringFilter: v })}
                  className={cn(
                    "flex-1 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
                    filters.recurringFilter === v
                      ? "border-primary bg-primary/5 text-primary"
                      : "hover:bg-muted/50"
                  )}
                >
                  {v === "all" ? "All" : v === "recurring" ? "Recurring" : "Drop-in"}
                </button>
              ))}
            </div>
          </div>
          <Separator />
        </>
      )}

      {/* Facility */}
      {facilities.length > 0 && (
        <>
          <div className="space-y-3">
            <Label className="flex items-center gap-1.5 text-sm font-medium">
              <MapPin className="h-3.5 w-3.5" />
              Facility
            </Label>
            <Select
              value={filters.selectedFacility || "__all__"}
              onValueChange={(v) =>
                onFiltersChange({ ...filters, selectedFacility: v === "__all__" ? "" : v })
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All Facilities" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All Facilities</SelectItem>
                {facilities.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Separator />
        </>
      )}

      {/* Season */}
      {(showSeasonFilter || seasons.length > 0) && (
        <>
          <div className="space-y-3">
            <Label className="flex items-center gap-1.5 text-sm font-medium">
              <CalendarRange className="h-3.5 w-3.5" />
              Season
            </Label>
            <Select
              value={filters.selectedSeason || "__all__"}
              onValueChange={(v) =>
                onFiltersChange({ ...filters, selectedSeason: v === "__all__" ? "" : v })
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All Seasons" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All Seasons</SelectItem>
                {seasons.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                      {s.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Separator />
        </>
      )}

      {/* Category */}
      {categories.length > 0 && (
        <>
          <div className="space-y-3">
            <Label className="flex items-center gap-1.5 text-sm font-medium">
              <Layers className="h-3.5 w-3.5" />
              Category
            </Label>
            <Select
              value={filters.selectedCategory || "__all__"}
              onValueChange={(v) =>
                onFiltersChange({ ...filters, selectedCategory: v === "__all__" ? "" : v })
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All Categories</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Separator />
        </>
      )}

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

      {!hideDateRange && (
        <>
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
        </>
      )}

      <Separator />

      {/* Time Range */}
      <div className="space-y-3">
        <Label className="flex items-center gap-1.5 text-sm font-medium">
          <Clock className="h-3.5 w-3.5" />
          Time Range
        </Label>
        <div className="flex items-center gap-2">
          <Select value={filters.timeRange[0] || "__any__"} onValueChange={handleTimeStartChange}>
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
          <Select value={filters.timeRange[1] || "__any__"} onValueChange={handleTimeEndChange}>
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

      {/* Gender */}
      {showGenderFilter && (
        <>
          <Separator />
          <div className="space-y-3">
            <Label className="flex items-center gap-1.5 text-sm font-medium">
              <Users className="h-3.5 w-3.5" />
              Gender
            </Label>
            <div className="flex flex-wrap gap-2">
              {GENDER_OPTIONS.map((option) => {
                const isSelected = filters.selectedGenders.includes(option.value);
                return (
                  <button
                    key={option.value}
                    onClick={() => toggleGender(option.value)}
                    className="focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 rounded-md"
                  >
                    <Badge
                      variant={isSelected ? "default" : "outline"}
                      className={cn(
                        "cursor-pointer select-none transition-colors",
                        !isSelected && "hover:bg-muted"
                      )}
                    >
                      {option.label}
                    </Badge>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
