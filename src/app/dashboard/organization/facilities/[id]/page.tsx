"use client";

import * as React from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  ArrowLeft,
  AlertCircle,
  AlertTriangle,
  Building,
  Calendar,
  CheckCircle2,
  Clock,
  Dumbbell,
  Info,
  Loader2,
  Mail,
  MapPin,
  MoreHorizontal,
  Pencil,
  Phone,
  Plus,
  Search,
  Settings,
  StickyNote,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { useBreadcrumbOverride } from "@/components/breadcrumb-context";
import { useFacility, useFacilityNotes, useFacilityActivity } from "@/hooks/use-facilities";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhoneInput } from "@/components/ui/phone-input";
import { formatPhoneNumberIntl } from "react-phone-number-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ResponsiveTabsList } from "@/components/ui/responsive-tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { LocationMap } from "@/components/location-map";
import { formatActivityStatusLabel } from "@/lib/format-activity-status";
import { COUNTRIES, getRegionsForCountry } from "@/lib/location-data";
import { StateProvinceCombobox } from "@/components/ui/state-province-combobox";
import type {
  Space,
  Equipment,
  FacilityNote,
  FacilityActivityItem,
  FacilityActivitySort,
  FacilityActivityType,
  FacilityAssignment,
  FacilityOperatingHours,
} from "@/types/facilities";

const DAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function getStatusBadgeVariant(status: string) {
  switch (status) {
    case "ACTIVE":
    case "OPEN":
      return "outline" as const;
    case "MAINTENANCE":
      return "secondary" as const;
    default:
      return "destructive" as const;
  }
}

function getConditionIcon(condition: string) {
  if (condition === "EXCELLENT" || condition === "GOOD") {
    return <CheckCircle2 className="h-4 w-4 text-green-500" />;
  } else if (condition === "FAIR") {
    return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
  }
  return <AlertTriangle className="h-4 w-4 text-red-500" />;
}

const ACTIVITY_TYPE_CONFIG: Record<string, { label: string; className: string }> = {
  event: { label: "Event", className: "bg-blue-50 text-blue-700 border-blue-200" },
  program: { label: "Program", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  program_instance: { label: "Session", className: "bg-teal-50 text-teal-700 border-teal-200" },
  competition: {
    label: "Competition",
    className: "bg-purple-50 text-purple-700 border-purple-200",
  },
};

type FacilityTimeBlock = { openTime: string; closeTime: string };

function emptyFacilityHours(): Record<number, FacilityTimeBlock[]> {
  return { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
}

function FacilityOperatingHoursDialog({
  facilityId,
  operatingHoursSource,
  open,
  onOpenChange,
  onSaved,
}: {
  facilityId: string;
  operatingHoursSource: FacilityOperatingHours[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [saving, setSaving] = React.useState(false);
  const [operatingHours, setOperatingHours] =
    React.useState<Record<number, FacilityTimeBlock[]>>(emptyFacilityHours());

  React.useEffect(() => {
    if (!open) return;
    const hours = emptyFacilityHours();
    for (const h of operatingHoursSource) {
      hours[h.dayOfWeek].push({ openTime: h.openTime, closeTime: h.closeTime });
    }
    setOperatingHours(hours);
  }, [open, operatingHoursSource]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const slots = Object.entries(operatingHours).flatMap(([day, blocks]) =>
        blocks.map((b) => ({
          dayOfWeek: parseInt(day, 10),
          openTime: b.openTime,
          closeTime: b.closeTime,
        }))
      );
      const res = await fetch(`/api/organization/facilities/${facilityId}/operating-hours`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slots }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to save operating hours");
      }
      toast.success("Operating hours updated");
      onOpenChange(false);
      onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save operating hours");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-hidden flex flex-col gap-0 p-0">
        <DialogHeader className="px-6 pt-6 pb-2 shrink-0 space-y-1.5">
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-muted-foreground" />
            Operating hours
          </DialogTitle>
          <DialogDescription>
            Set when this facility is open each day. You can add multiple time blocks per day (for
            example, a lunch closure).
          </DialogDescription>
        </DialogHeader>
        <div className="overflow-y-auto px-6 py-4 flex-1 min-h-0 border-y">
          <div className="grid gap-4 max-w-2xl">
            {DAY_LABELS.map((label, dayIndex) => {
              const blocks = operatingHours[dayIndex] ?? [];
              const isOpen = blocks.length > 0;
              return (
                <div key={dayIndex} className="space-y-2">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
                    <div className="flex items-center gap-2 w-28 shrink-0 pt-0.5">
                      <Switch
                        checked={isOpen}
                        onCheckedChange={(checked) => {
                          setOperatingHours((prev) => ({
                            ...prev,
                            [dayIndex]: checked ? [{ openTime: "09:00", closeTime: "17:00" }] : [],
                          }));
                        }}
                      />
                      <span className="text-sm font-medium">{label}</span>
                    </div>
                    {isOpen ? (
                      <div className="flex-1 space-y-2 min-w-0">
                        {blocks.map((block, blockIdx) => (
                          <div key={blockIdx} className="flex flex-wrap items-center gap-2">
                            <Input
                              type="time"
                              value={block.openTime}
                              onChange={(e) => {
                                setOperatingHours((prev) => {
                                  const updated = [...prev[dayIndex]];
                                  updated[blockIdx] = {
                                    ...updated[blockIdx],
                                    openTime: e.target.value,
                                  };
                                  return { ...prev, [dayIndex]: updated };
                                });
                              }}
                              className="w-[130px]"
                            />
                            <span className="text-muted-foreground text-sm">to</span>
                            <Input
                              type="time"
                              value={block.closeTime}
                              onChange={(e) => {
                                setOperatingHours((prev) => {
                                  const updated = [...prev[dayIndex]];
                                  updated[blockIdx] = {
                                    ...updated[blockIdx],
                                    closeTime: e.target.value,
                                  };
                                  return { ...prev, [dayIndex]: updated };
                                });
                              }}
                              className="w-[130px]"
                            />
                            {blocks.length > 1 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0"
                                onClick={() => {
                                  setOperatingHours((prev) => ({
                                    ...prev,
                                    [dayIndex]: prev[dayIndex].filter((_, i) => i !== blockIdx),
                                  }));
                                }}
                              >
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        ))}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-xs h-7 -ml-2"
                          onClick={() => {
                            setOperatingHours((prev) => ({
                              ...prev,
                              [dayIndex]: [
                                ...prev[dayIndex],
                                { openTime: "09:00", closeTime: "17:00" },
                              ],
                            }));
                          }}
                        >
                          <Plus className="h-3 w-3 mr-1" /> Add block
                        </Button>
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground pt-0.5">Closed</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <DialogFooter className="px-6 py-4 shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save hours
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================
// Overview Tab
// ============================================

function OverviewTab({
  facility,
  spaces,
  equipment,
  onHoursSaved,
}: {
  facility: NonNullable<ReturnType<typeof useFacility>["facility"]>;
  spaces: Space[];
  equipment: Equipment[];
  onHoursSaved: () => void;
}) {
  const [hoursDialogOpen, setHoursDialogOpen] = React.useState(false);
  const address = [
    facility.street,
    facility.city,
    facility.stateProvince,
    facility.postalCode,
    facility.country,
  ]
    .filter(Boolean)
    .join(", ");

  const hoursByDay: Record<number, { openTime: string; closeTime: string }[]> = {};
  for (let d = 0; d < 7; d++) hoursByDay[d] = [];
  for (const h of facility.operatingHours ?? []) {
    hoursByDay[h.dayOfWeek]?.push({ openTime: h.openTime, closeTime: h.closeTime });
  }

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="lg:col-span-4">
          <CardHeader>
            <CardTitle>General Information</CardTitle>
            <CardDescription>Facility details and contact information.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                <span>{address || "No address set"}</span>
              </div>
              {facility.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span>{formatPhoneNumberIntl(facility.phone) || facility.phone}</span>
                </div>
              )}
              {facility.email && (
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span>{facility.email}</span>
                </div>
              )}
            </div>
            {facility.description && (
              <>
                <Separator />
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {facility.description}
                </p>
              </>
            )}
            <Separator />
            <div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-3">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  Operating hours
                </h4>
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0 w-fit"
                  onClick={() => setHoursDialogOpen(true)}
                >
                  <Clock className="mr-2 h-3.5 w-3.5" />
                  Edit hours
                </Button>
              </div>
              <div className="grid gap-1.5 text-sm">
                {DAY_LABELS.map((label, d) => {
                  const blocks = hoursByDay[d];
                  return (
                    <div key={d} className="flex items-center gap-3">
                      <span className="w-12 font-medium text-muted-foreground">
                        {label.slice(0, 3)}
                      </span>
                      {blocks.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {blocks.map((b, i) => (
                            <span key={i}>
                              {b.openTime} – {b.closeTime}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">Closed</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Facility Stats</CardTitle>
            <CardDescription>Current status and quick stats.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Status</span>
              <Badge variant={getStatusBadgeVariant(facility.status)}>{facility.status}</Badge>
            </div>
            <Separator />
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <span className="text-2xl font-bold">
                  {facility.squareFootage?.toLocaleString() || "—"}
                </span>
                <span className="text-xs text-muted-foreground">Square Footage</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-2xl font-bold">{facility.maxCapacity || "—"}</span>
                <span className="text-xs text-muted-foreground">Max Capacity</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-2xl font-bold">{facility._count.spaces}</span>
                <span className="text-xs text-muted-foreground">Spaces</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-2xl font-bold">{facility._count.equipment}</span>
                <span className="text-xs text-muted-foreground">Equipment Items</span>
              </div>
            </div>
            {facility.latitude != null && facility.longitude != null && (
              <>
                <Separator />
                <LocationMap
                  latitude={facility.latitude}
                  longitude={facility.longitude}
                  label={facility.name}
                  sublabel={[facility.street, facility.city, facility.stateProvince]
                    .filter(Boolean)
                    .join(", ")}
                  className="h-48 min-h-0 rounded-md"
                />
              </>
            )}
          </CardContent>
        </Card>
      </div>
      <FacilityOperatingHoursDialog
        facilityId={facility.id}
        operatingHoursSource={facility.operatingHours ?? []}
        open={hoursDialogOpen}
        onOpenChange={setHoursDialogOpen}
        onSaved={onHoursSaved}
      />
    </>
  );
}

// ============================================
// Activity Tab
// ============================================

const ACTIVITY_SORT_OPTIONS: { value: FacilityActivitySort; label: string }[] = [
  { value: "date_asc", label: "Date (soonest first)" },
  { value: "date_desc", label: "Date (latest first)" },
  { value: "name_asc", label: "Name (A–Z)" },
  { value: "name_desc", label: "Name (Z–A)" },
  { value: "type_asc", label: "Type (A–Z)" },
  { value: "type_desc", label: "Type (Z–A)" },
];

function ActivityRow({ item }: { item: FacilityActivityItem }) {
  const config = ACTIVITY_TYPE_CONFIG[item.type];
  return (
    <TableRow>
      <TableCell>
        <Badge variant="outline" className={config?.className}>
          {config?.label ?? item.type}
        </Badge>
      </TableCell>
      <TableCell className="font-medium">
        <Link href={item.href} className="hover:underline">
          {item.name}
        </Link>
      </TableCell>
      <TableCell className="whitespace-nowrap">
        {format(new Date(item.date), "MMM d, yyyy")}
      </TableCell>
      <TableCell className="text-muted-foreground">{item.detail ?? "—"}</TableCell>
      <TableCell>
        <Badge variant="secondary" className="font-normal">
          {formatActivityStatusLabel(item.status)}
        </Badge>
      </TableCell>
    </TableRow>
  );
}

function ActivityTab({ facilityId }: { facilityId: string }) {
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(20);
  const [sort, setSort] = React.useState<FacilityActivitySort>("date_asc");
  const [typeFilter, setTypeFilter] = React.useState<"all" | FacilityActivityType>("all");
  const [searchInput, setSearchInput] = React.useState("");
  const [debouncedQ, setDebouncedQ] = React.useState("");

  React.useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQ(searchInput), 350);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  React.useEffect(() => {
    setPage(1);
  }, [debouncedQ, sort, typeFilter, pageSize]);

  const types = React.useMemo(() => (typeFilter === "all" ? [] : [typeFilter]), [typeFilter]);

  const { data, isLoading } = useFacilityActivity(facilityId, {
    page,
    pageSize,
    sort,
    types,
    q: debouncedQ,
  });

  React.useEffect(() => {
    if (data && data.page !== page) {
      setPage(data.page);
    }
  }, [data, page]);

  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;
  const currentPage = data?.page ?? page;
  const items = data?.items ?? [];
  const hasFilters = debouncedQ.trim().length > 0 || typeFilter !== "all";
  const rangeStart = total === 0 ? 0 : (currentPage - 1) * (data?.pageSize ?? pageSize) + 1;
  const rangeEnd = total === 0 ? 0 : Math.min(currentPage * (data?.pageSize ?? pageSize), total);

  if (isLoading && !data) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 xl:flex-row xl:flex-wrap xl:items-end">
        <div className="flex-1 min-w-[min(100%,220px)] space-y-2">
          <Label htmlFor="activity-search" className="text-xs text-muted-foreground">
            Search by name
          </Label>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <Input
              id="activity-search"
              placeholder="Filter by title or name…"
              className="pl-9"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
        </div>
        <div className="grid gap-2 w-full sm:w-[180px]">
          <Label className="text-xs text-muted-foreground">Activity type</Label>
          <Select
            value={typeFilter}
            onValueChange={(v) => {
              setTypeFilter(v as "all" | FacilityActivityType);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="event">Events</SelectItem>
              <SelectItem value="program">Programs</SelectItem>
              <SelectItem value="program_instance">Sessions</SelectItem>
              <SelectItem value="competition">Competitions</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2 w-full sm:w-[220px]">
          <Label className="text-xs text-muted-foreground">Sort by</Label>
          <Select value={sort} onValueChange={(v) => setSort(v as FacilityActivitySort)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ACTIVITY_SORT_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2 w-full sm:w-[130px]">
          <Label className="text-xs text-muted-foreground">Per page</Label>
          <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="20">20</SelectItem>
              <SelectItem value="50">50</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {total === 0 && !isLoading ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center">
              {hasFilters
                ? "No activity matches your filters. Try adjusting search or type."
                : "No upcoming activity at this facility."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="relative rounded-md border overflow-x-auto">
            {isLoading && (
              <div className="absolute inset-0 z-10 flex items-center justify-center rounded-md bg-background/60">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            )}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <ActivityRow key={`${item.type}-${item.id}`} item={item} />
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground tabular-nums">
              {total === 0 ? "No results" : `Showing ${rangeStart}–${rangeEnd} of ${total}`}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={currentPage <= 1 || isLoading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground tabular-nums px-1 min-w-[7rem] text-center">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={currentPage >= totalPages || isLoading}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ============================================
// Spaces Tab
// ============================================

function SpacesTab({
  facilityId,
  spaces,
  onRefresh,
}: {
  facilityId: string;
  spaces: Space[];
  onRefresh: () => void;
}) {
  const [search, setSearch] = React.useState("");
  const [formOpen, setFormOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [availabilityDialogOpen, setAvailabilityDialogOpen] = React.useState(false);
  const [editingSpace, setEditingSpace] = React.useState<Space | null>(null);
  const [editSpaceOpen, setEditSpaceOpen] = React.useState(false);
  const [editSpaceData, setEditSpaceData] = React.useState<{
    name: string;
    capacity: string;
    status: string;
    description: string;
  }>({ name: "", capacity: "", status: "OPEN", description: "" });
  const [savingEdit, setSavingEdit] = React.useState(false);
  const [availabilitySlots, setAvailabilitySlots] = React.useState<
    Record<number, { enabled: boolean; openTime: string; closeTime: string }>
  >({});
  const [savingAvailability, setSavingAvailability] = React.useState(false);

  const filtered = spaces.filter((s) => s.name.toLowerCase().includes(search.toLowerCase()));

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    const formData = new FormData(e.currentTarget);
    try {
      const res = await fetch(`/api/organization/facilities/${facilityId}/spaces`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.get("name") as string,
          capacity: formData.get("capacity") ? Number(formData.get("capacity")) : null,
          status: (formData.get("space-status") as string) || "OPEN",
          description: (formData.get("space-description") as string) || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create space");
      }
      toast.success("Space created");
      setFormOpen(false);
      onRefresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create space");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (spaceId: string) => {
    try {
      const res = await fetch(`/api/organization/facilities/${facilityId}/spaces/${spaceId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete space");
      toast.success("Space deleted");
      onRefresh();
    } catch {
      toast.error("Failed to delete space");
    }
  };

  const handleOpenEditSpace = (space: Space) => {
    setEditingSpace(space);
    setEditSpaceData({
      name: space.name,
      capacity: space.capacity != null ? String(space.capacity) : "",
      status: space.status,
      description: space.description ?? "",
    });
    setEditSpaceOpen(true);
  };

  const handleSaveEditSpace = async () => {
    if (!editingSpace) return;
    setSavingEdit(true);
    try {
      const res = await fetch(
        `/api/organization/facilities/${facilityId}/spaces/${editingSpace.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: editSpaceData.name,
            capacity: editSpaceData.capacity ? Number(editSpaceData.capacity) : null,
            status: editSpaceData.status,
            description: editSpaceData.description || null,
          }),
        }
      );
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update space");
      }
      toast.success("Space updated");
      setEditSpaceOpen(false);
      onRefresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update space");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleOpenAvailability = async (space: Space) => {
    setEditingSpace(space);
    try {
      const res = await fetch(
        `/api/organization/facilities/${facilityId}/spaces/${space.id}/availability`
      );
      if (res.ok) {
        const slots: Array<{ dayOfWeek: number; openTime: string; closeTime: string }> =
          await res.json();
        const initial: Record<number, { enabled: boolean; openTime: string; closeTime: string }> =
          {};
        for (let d = 0; d < 7; d++) {
          const existing = slots.find((s) => s.dayOfWeek === d);
          initial[d] = existing
            ? { enabled: true, openTime: existing.openTime, closeTime: existing.closeTime }
            : { enabled: false, openTime: "08:00", closeTime: "18:00" };
        }
        setAvailabilitySlots(initial);
      }
    } catch {
      toast.error("Failed to load space availability");
    }
    setAvailabilityDialogOpen(true);
  };

  const handleSaveAvailability = async () => {
    if (!editingSpace) return;
    setSavingAvailability(true);
    try {
      const slots = Object.entries(availabilitySlots)
        .filter(([, v]) => v.enabled)
        .map(([day, v]) => ({
          dayOfWeek: parseInt(day),
          openTime: v.openTime,
          closeTime: v.closeTime,
        }));
      const res = await fetch(
        `/api/organization/facilities/${facilityId}/spaces/${editingSpace.id}/availability`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slots }),
        }
      );
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to save");
      }
      toast.success("Availability hours saved");
      setAvailabilityDialogOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save availability");
    } finally {
      setSavingAvailability(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search spaces..."
            className="w-[150px] lg:w-[250px]"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Sheet open={formOpen} onOpenChange={setFormOpen}>
          <Button onClick={() => setFormOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Add Space
          </Button>
          <SheetContent>
            <form onSubmit={handleCreate}>
              <SheetHeader>
                <SheetTitle>Add New Space</SheetTitle>
                <SheetDescription>Define a new space in this facility.</SheetDescription>
              </SheetHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="space-name">Space Name *</Label>
                  <Input
                    id="space-name"
                    name="name"
                    placeholder="e.g. Balance Beam Area"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="capacity">Max Capacity</Label>
                    <Input id="capacity" name="capacity" type="number" placeholder="20" />
                  </div>
                  <div className="grid gap-2">
                    <Label>Status</Label>
                    <Select name="space-status" defaultValue="OPEN">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="OPEN">Open</SelectItem>
                        <SelectItem value="CLOSED">Closed</SelectItem>
                        <SelectItem value="MAINTENANCE">Maintenance</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="space-description">Description</Label>
                  <Textarea
                    id="space-description"
                    name="space-description"
                    placeholder="Optional description..."
                    rows={2}
                  />
                </div>
              </div>
              <SheetFooter>
                <Button type="submit" disabled={saving}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create Space
                </Button>
              </SheetFooter>
            </form>
          </SheetContent>
        </Sheet>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map((space) => (
          <Card key={space.id}>
            <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{space.name}</CardTitle>
              <div className="flex items-center gap-1">
                <Badge variant={getStatusBadgeVariant(space.status)}>{space.status}</Badge>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="h-8 w-8 p-0">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleOpenEditSpace(space)}>
                      <Pencil className="mr-2 h-4 w-4" /> Edit
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-red-600"
                      onClick={() => handleDelete(space.id)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                {space.capacity ? `Max Capacity: ${space.capacity} students` : "No capacity set"}
              </p>
              {space.description && (
                <p className="text-xs text-muted-foreground mt-1 truncate">{space.description}</p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                {space._count.equipment} equipment items
              </p>
            </CardContent>
            <CardFooter className="pt-0">
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => handleOpenAvailability(space)}
              >
                <Clock className="mr-2 h-3.5 w-3.5" />
                Availability Hours
              </Button>
            </CardFooter>
          </Card>
        ))}
        {filtered.length === 0 && (
          <Card className="col-span-full">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Dumbbell className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground text-center">
                {search ? "No spaces match your search." : "No spaces yet."}
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={availabilityDialogOpen} onOpenChange={setAvailabilityDialogOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Availability Hours &mdash; {editingSpace?.name}</DialogTitle>
            <DialogDescription>Set the weekly operating hours for this space.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 max-h-[400px] overflow-y-auto py-2">
            {DAY_LABELS.map((label, dayIndex) => {
              const slot = availabilitySlots[dayIndex];
              if (!slot) return null;
              return (
                <div key={dayIndex} className="flex items-center gap-3">
                  <div className="w-24 flex items-center gap-2">
                    <Switch
                      checked={slot.enabled}
                      onCheckedChange={(checked) =>
                        setAvailabilitySlots((prev) => ({
                          ...prev,
                          [dayIndex]: { ...prev[dayIndex], enabled: checked },
                        }))
                      }
                    />
                    <span className="text-sm font-medium">{label.slice(0, 3)}</span>
                  </div>
                  {slot.enabled ? (
                    <div className="flex items-center gap-2 flex-1">
                      <Input
                        type="time"
                        value={slot.openTime}
                        onChange={(e) =>
                          setAvailabilitySlots((prev) => ({
                            ...prev,
                            [dayIndex]: { ...prev[dayIndex], openTime: e.target.value },
                          }))
                        }
                        className="w-[120px]"
                      />
                      <span className="text-muted-foreground text-sm">to</span>
                      <Input
                        type="time"
                        value={slot.closeTime}
                        onChange={(e) =>
                          setAvailabilitySlots((prev) => ({
                            ...prev,
                            [dayIndex]: { ...prev[dayIndex], closeTime: e.target.value },
                          }))
                        }
                        className="w-[120px]"
                      />
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">Closed</span>
                  )}
                </div>
              );
            })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAvailabilityDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveAvailability} disabled={savingAvailability}>
              {savingAvailability && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Hours
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editSpaceOpen} onOpenChange={setEditSpaceOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Space</DialogTitle>
            <DialogDescription>Update space details.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Name *</Label>
              <Input
                value={editSpaceData.name}
                onChange={(e) => setEditSpaceData((p) => ({ ...p, name: e.target.value }))}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Max Capacity</Label>
                <Input
                  type="number"
                  value={editSpaceData.capacity}
                  onChange={(e) => setEditSpaceData((p) => ({ ...p, capacity: e.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label>Status</Label>
                <Select
                  value={editSpaceData.status}
                  onValueChange={(v) => setEditSpaceData((p) => ({ ...p, status: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="OPEN">Open</SelectItem>
                    <SelectItem value="CLOSED">Closed</SelectItem>
                    <SelectItem value="MAINTENANCE">Maintenance</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Description</Label>
              <Textarea
                value={editSpaceData.description}
                onChange={(e) => setEditSpaceData((p) => ({ ...p, description: e.target.value }))}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditSpaceOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveEditSpace}
              disabled={savingEdit || !editSpaceData.name.trim()}
            >
              {savingEdit && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================
// Equipment Tab
// ============================================

function EquipmentTab({
  facilityId,
  equipment,
  spaces,
  onRefresh,
}: {
  facilityId: string;
  equipment: Equipment[];
  spaces: Space[];
  onRefresh: () => void;
}) {
  const [search, setSearch] = React.useState("");
  const [formOpen, setFormOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [editEquipOpen, setEditEquipOpen] = React.useState(false);
  const [editingEquip, setEditingEquip] = React.useState<Equipment | null>(null);
  const [editEquipData, setEditEquipData] = React.useState<{
    name: string;
    serialNumber: string;
    condition: string;
    status: string;
    spaceId: string;
  }>({ name: "", serialNumber: "", condition: "GOOD", status: "ACTIVE", spaceId: "" });
  const [savingEdit, setSavingEdit] = React.useState(false);

  const filtered = equipment.filter((e) => e.name.toLowerCase().includes(search.toLowerCase()));

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    const formData = new FormData(e.currentTarget);
    try {
      const res = await fetch(`/api/organization/facilities/${facilityId}/equipment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.get("name") as string,
          serialNumber: (formData.get("serialNumber") as string) || null,
          condition: (formData.get("condition") as string) || "GOOD",
          status: (formData.get("equip-status") as string) || "ACTIVE",
          spaceId: (formData.get("spaceId") as string) || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create equipment");
      }
      toast.success("Equipment added");
      setFormOpen(false);
      onRefresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add equipment");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (equipmentId: string) => {
    try {
      const res = await fetch(`/api/organization/equipment/${equipmentId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete equipment");
      toast.success("Equipment deleted");
      onRefresh();
    } catch {
      toast.error("Failed to delete equipment");
    }
  };

  const handleOpenEditEquip = (item: Equipment) => {
    setEditingEquip(item);
    setEditEquipData({
      name: item.name,
      serialNumber: item.serialNumber ?? "",
      condition: item.condition,
      status: item.status,
      spaceId: item.space?.id ?? "",
    });
    setEditEquipOpen(true);
  };

  const handleSaveEditEquip = async () => {
    if (!editingEquip) return;
    setSavingEdit(true);
    try {
      const res = await fetch(`/api/organization/equipment/${editingEquip.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editEquipData.name,
          serialNumber: editEquipData.serialNumber || null,
          condition: editEquipData.condition,
          status: editEquipData.status,
          spaceId: editEquipData.spaceId || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update equipment");
      }
      toast.success("Equipment updated");
      setEditEquipOpen(false);
      onRefresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update equipment");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleLogInspection = async (equipmentId: string) => {
    try {
      const res = await fetch(`/api/organization/equipment/${equipmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lastInspectionDate: new Date().toISOString().split("T")[0] }),
      });
      if (!res.ok) throw new Error("Failed to log inspection");
      toast.success("Inspection logged");
      onRefresh();
    } catch {
      toast.error("Failed to log inspection");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search equipment..."
            className="w-[150px] lg:w-[250px]"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Sheet open={formOpen} onOpenChange={setFormOpen}>
          <Button onClick={() => setFormOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Add Equipment
          </Button>
          <SheetContent>
            <form onSubmit={handleCreate}>
              <SheetHeader>
                <SheetTitle>Add Equipment</SheetTitle>
                <SheetDescription>Register a new piece of equipment.</SheetDescription>
              </SheetHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="equip-name">Name/ID *</Label>
                  <Input id="equip-name" name="name" placeholder="e.g. Beam #3" required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="equip-serial">Serial Number</Label>
                  <Input
                    id="equip-serial"
                    name="serialNumber"
                    placeholder="Optional serial number"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Condition</Label>
                    <Select name="condition" defaultValue="GOOD">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="EXCELLENT">Excellent</SelectItem>
                        <SelectItem value="GOOD">Good</SelectItem>
                        <SelectItem value="FAIR">Fair</SelectItem>
                        <SelectItem value="POOR">Poor</SelectItem>
                        <SelectItem value="UNSAFE">Unsafe / Out of Order</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>Status</Label>
                    <Select name="equip-status" defaultValue="ACTIVE">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ACTIVE">Active</SelectItem>
                        <SelectItem value="RETIRED">Retired</SelectItem>
                        <SelectItem value="MAINTENANCE">Maintenance</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {spaces.length > 0 && (
                  <div className="grid gap-2">
                    <Label>Assign to Space</Label>
                    <Select name="spaceId">
                      <SelectTrigger>
                        <SelectValue placeholder="Select space (optional)" />
                      </SelectTrigger>
                      <SelectContent>
                        {spaces.map((space) => (
                          <SelectItem key={space.id} value={space.id}>
                            {space.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
              <SheetFooter>
                <Button type="submit" disabled={saving}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Add Equipment
                </Button>
              </SheetFooter>
            </form>
          </SheetContent>
        </Sheet>
      </div>

      {filtered.length > 0 ? (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[200px]">Name</TableHead>
                <TableHead>Serial #</TableHead>
                <TableHead>Space</TableHead>
                <TableHead>Condition</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Inspection</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {item.serialNumber || "—"}
                  </TableCell>
                  <TableCell>{item.space?.name || "—"}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getConditionIcon(item.condition)}
                      <span>{item.condition}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={getStatusBadgeVariant(item.status)}>{item.status}</Badge>
                  </TableCell>
                  <TableCell>
                    {item.lastInspectionDate
                      ? new Date(item.lastInspectionDate).toLocaleDateString()
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleOpenEditEquip(item)}>
                          <Pencil className="mr-2 h-4 w-4" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleLogInspection(item.id)}>
                          <CheckCircle2 className="mr-2 h-4 w-4" /> Log Inspection
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-red-600"
                          onClick={() => handleDelete(item.id)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Dumbbell className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center">
              {search ? "No equipment matches your search." : "No equipment registered yet."}
            </p>
          </CardContent>
        </Card>
      )}

      <Dialog open={editEquipOpen} onOpenChange={setEditEquipOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Equipment</DialogTitle>
            <DialogDescription>Update equipment details.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Name *</Label>
              <Input
                value={editEquipData.name}
                onChange={(e) => setEditEquipData((p) => ({ ...p, name: e.target.value }))}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label>Serial Number</Label>
              <Input
                value={editEquipData.serialNumber}
                onChange={(e) => setEditEquipData((p) => ({ ...p, serialNumber: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Condition</Label>
                <Select
                  value={editEquipData.condition}
                  onValueChange={(v) => setEditEquipData((p) => ({ ...p, condition: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EXCELLENT">Excellent</SelectItem>
                    <SelectItem value="GOOD">Good</SelectItem>
                    <SelectItem value="FAIR">Fair</SelectItem>
                    <SelectItem value="POOR">Poor</SelectItem>
                    <SelectItem value="UNSAFE">Unsafe</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Status</Label>
                <Select
                  value={editEquipData.status}
                  onValueChange={(v) => setEditEquipData((p) => ({ ...p, status: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACTIVE">Active</SelectItem>
                    <SelectItem value="RETIRED">Retired</SelectItem>
                    <SelectItem value="MAINTENANCE">Maintenance</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {spaces.length > 0 && (
              <div className="grid gap-2">
                <Label>Assign to Space</Label>
                <Select
                  value={editEquipData.spaceId}
                  onValueChange={(v) => setEditEquipData((p) => ({ ...p, spaceId: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select space (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {spaces.map((space) => (
                      <SelectItem key={space.id} value={space.id}>
                        {space.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditEquipOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveEditEquip}
              disabled={savingEdit || !editEquipData.name.trim()}
            >
              {savingEdit && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================
// Staff Tab
// ============================================

function StaffTab({ facilityId }: { facilityId: string }) {
  const [assignments, setAssignments] = React.useState<FacilityAssignment[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [assignOpen, setAssignOpen] = React.useState(false);
  const [staffMembers, setStaffMembers] = React.useState<
    { id: string; name: string; email: string; role: string }[]
  >([]);
  const [selectedUserId, setSelectedUserId] = React.useState("");
  const [assignAsPrimary, setAssignAsPrimary] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  const fetchAssignments = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/organization/facilities/${facilityId}/assignments`);
      if (res.ok) setAssignments(await res.json());
    } catch {
      // silently fail
    } finally {
      setIsLoading(false);
    }
  }, [facilityId]);

  const fetchStaff = React.useCallback(async () => {
    try {
      const res = await fetch("/api/organization/members");
      if (res.ok) {
        const data = await res.json();
        const members = (data.members ?? data ?? []) as Array<{
          userId: string;
          user: { id: string; name: string; email: string; role: string };
        }>;
        setStaffMembers(
          members.map((m) => ({
            id: m.user?.id ?? m.userId,
            name: m.user?.name ?? "",
            email: m.user?.email ?? "",
            role: m.user?.role ?? "",
          }))
        );
      }
    } catch {
      // silently fail
    }
  }, []);

  React.useEffect(() => {
    fetchAssignments();
  }, [fetchAssignments]);

  const handleAssign = async () => {
    if (!selectedUserId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/organization/facilities/${facilityId}/assignments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: selectedUserId, isPrimary: assignAsPrimary }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to assign staff");
      }
      toast.success("Staff member assigned");
      setAssignOpen(false);
      setSelectedUserId("");
      setAssignAsPrimary(false);
      fetchAssignments();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to assign staff");
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePrimary = async (userId: string, currentlyPrimary: boolean) => {
    try {
      const res = await fetch(`/api/organization/facilities/${facilityId}/assignments/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPrimary: !currentlyPrimary }),
      });
      if (!res.ok) throw new Error("Failed to update assignment");
      toast.success(currentlyPrimary ? "Removed primary status" : "Set as primary");
      fetchAssignments();
    } catch {
      toast.error("Failed to update assignment");
    }
  };

  const handleRemove = async (userId: string) => {
    try {
      const res = await fetch(`/api/organization/facilities/${facilityId}/assignments/${userId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to remove assignment");
      toast.success("Staff member removed");
      fetchAssignments();
    } catch {
      toast.error("Failed to remove staff member");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const assignedUserIds = new Set(assignments.map((a) => a.userId));
  const availableStaff = staffMembers.filter((s) => !assignedUserIds.has(s.id));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {assignments.length} staff assigned to this facility
        </p>
        <Button
          onClick={() => {
            fetchStaff();
            setAssignOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" /> Assign Staff
        </Button>
      </div>

      {assignments.length > 0 ? (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {assignments.map((a) => (
            <Card key={a.id}>
              <CardContent className="flex items-center gap-3 p-4">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={a.user.avatar ?? undefined} />
                  <AvatarFallback>{a.user.name?.charAt(0) ?? "?"}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{a.user.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{a.user.email}</p>
                </div>
                <div className="flex items-center gap-1">
                  {a.isPrimary && (
                    <Badge variant="outline" className="text-[10px]">
                      Primary
                    </Badge>
                  )}
                  <Badge variant="secondary" className="text-[10px]">
                    {a.user.role}
                  </Badge>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleTogglePrimary(a.userId, a.isPrimary)}>
                        <CheckCircle2 className="mr-2 h-4 w-4" />{" "}
                        {a.isPrimary ? "Remove Primary" : "Set as Primary"}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-red-600"
                        onClick={() => handleRemove(a.userId)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" /> Remove
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center">
              No staff assigned to this facility yet.
            </p>
          </CardContent>
        </Card>
      )}

      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Assign Staff</DialogTitle>
            <DialogDescription>Select a staff member to assign to this facility.</DialogDescription>
          </DialogHeader>
          {availableStaff.length > 0 ? (
            <div className="grid gap-4 py-2">
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a staff member" />
                </SelectTrigger>
                <SelectContent>
                  {availableStaff.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} ({s.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex items-center gap-2">
                <Switch checked={assignAsPrimary} onCheckedChange={setAssignAsPrimary} />
                <Label className="text-sm">Assign as primary staff member</Label>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-4">
              All staff members are already assigned to this facility.
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAssign} disabled={!selectedUserId || saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Assign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================
// Notes Tab
// ============================================

function NotesTab({
  facilityId,
  description,
  onDescriptionSaved,
}: {
  facilityId: string;
  description: string | null;
  onDescriptionSaved: (desc: string) => void;
}) {
  const { notes, isLoading, isCreating, createNote, updateNote, deleteNote } =
    useFacilityNotes(facilityId);
  const [newNote, setNewNote] = React.useState("");
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editContent, setEditContent] = React.useState("");
  const [descEditing, setDescEditing] = React.useState(false);
  const [descValue, setDescValue] = React.useState(description ?? "");

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    const result = await createNote(newNote.trim());
    if (result) {
      setNewNote("");
      toast.success("Note added");
    } else {
      toast.error("Failed to add note");
    }
  };

  const handleUpdateNote = async (noteId: string) => {
    if (!editContent.trim()) return;
    const result = await updateNote(noteId, editContent.trim());
    if (result) {
      setEditingId(null);
      toast.success("Note updated");
    } else {
      toast.error("Failed to update note");
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    const ok = await deleteNote(noteId);
    if (ok) {
      toast.success("Note deleted");
    } else {
      toast.error("Failed to delete note");
    }
  };

  const handleSaveDescription = async () => {
    try {
      const res = await fetch(`/api/organization/facilities/${facilityId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: descValue || null }),
      });
      if (!res.ok) throw new Error("Failed to save");
      toast.success("Description updated");
      setDescEditing(false);
      onDescriptionSaved(descValue);
    } catch {
      toast.error("Failed to update description");
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-base">Facility Description</CardTitle>
            <CardDescription>
              General notes about this facility visible to all staff.
            </CardDescription>
          </div>
          {!descEditing && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setDescValue(description ?? "");
                setDescEditing(true);
              }}
            >
              <Pencil className="h-4 w-4" />
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {descEditing ? (
            <div className="space-y-2">
              <Textarea value={descValue} onChange={(e) => setDescValue(e.target.value)} rows={4} />
              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => setDescEditing(false)}>
                  Cancel
                </Button>
                <Button size="sm" onClick={handleSaveDescription}>
                  Save
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {description || "No description set."}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Notes Log</CardTitle>
          <CardDescription>Add timestamped notes about this facility.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Textarea
              placeholder="Add a note..."
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              rows={2}
              className="flex-1"
            />
            <Button
              onClick={handleAddNote}
              disabled={isCreating || !newNote.trim()}
              className="self-end"
            >
              {isCreating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
            </Button>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center h-24">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : notes.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No notes yet.</p>
          ) : (
            <div className="space-y-3">
              {notes.map((note) => (
                <div key={note.id} className="flex gap-3 p-3 rounded-lg border">
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarImage src={note.author.avatar ?? undefined} />
                    <AvatarFallback>{note.author.name?.charAt(0) ?? "?"}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{note.author.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(note.createdAt), "MMM d, yyyy 'at' h:mm a")}
                        </span>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-7 w-7 p-0">
                            <MoreHorizontal className="h-3.5 w-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => {
                              setEditingId(note.id);
                              setEditContent(note.content);
                            }}
                          >
                            <Pencil className="mr-2 h-4 w-4" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-red-600"
                            onClick={() => handleDeleteNote(note.id)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    {editingId === note.id ? (
                      <div className="mt-2 space-y-2">
                        <Textarea
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          rows={2}
                        />
                        <div className="flex gap-2 justify-end">
                          <Button variant="outline" size="sm" onClick={() => setEditingId(null)}>
                            Cancel
                          </Button>
                          <Button size="sm" onClick={() => handleUpdateNote(note.id)}>
                            Save
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">
                        {note.content}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================
// Edit Facility Sheet
// ============================================

function EditFacilitySheet({
  facility,
  open,
  onOpenChange,
  onSaved,
}: {
  facility: NonNullable<ReturnType<typeof useFacility>["facility"]>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [saving, setSaving] = React.useState(false);
  const [country, setCountry] = React.useState(facility.country || "US");
  const [stateProvince, setStateProvince] = React.useState(facility.stateProvince || "");
  const [phone, setPhone] = React.useState(facility.phone || "");
  const [status, setStatus] = React.useState(facility.status || "ACTIVE");
  const [isDefault, setIsDefault] = React.useState(facility.isDefault);

  React.useEffect(() => {
    if (open) {
      setCountry(facility.country || "US");
      setStateProvince(facility.stateProvince || "");
      setPhone(facility.phone || "");
      setStatus(facility.status || "ACTIVE");
      setIsDefault(facility.isDefault);
    }
  }, [open, facility]);

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get("name") as string,
      street: (formData.get("street") as string) || null,
      city: (formData.get("city") as string) || null,
      stateProvince: stateProvince || null,
      postalCode: (formData.get("postalCode") as string) || null,
      country: country || null,
      phone: phone || null,
      email: (formData.get("email") as string) || null,
      squareFootage: formData.get("squareFootage") ? Number(formData.get("squareFootage")) : null,
      maxCapacity: formData.get("maxCapacity") ? Number(formData.get("maxCapacity")) : null,
      description: (formData.get("description") as string) || null,
      status,
      isDefault,
    };

    try {
      const res = await fetch(`/api/organization/facilities/${facility.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to save facility");
      }

      toast.success("Facility updated");
      onOpenChange(false);
      onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save facility");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto">
        <form onSubmit={handleSave}>
          <SheetHeader>
            <SheetTitle>Edit Facility</SheetTitle>
            <SheetDescription>Update facility details.</SheetDescription>
          </SheetHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Facility Name *</Label>
              <Input id="name" name="name" defaultValue={facility.name} required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="street">Street Address</Label>
              <Input id="street" name="street" defaultValue={facility.street || ""} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="city">City</Label>
                <Input id="city" name="city" defaultValue={facility.city || ""} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="stateProvince">
                  {country === "CA" ? "Province" : country === "US" ? "State" : "State / Province"}
                </Label>
                <StateProvinceCombobox
                  country={country}
                  value={stateProvince}
                  onChange={setStateProvince}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="postalCode">
                  {country === "CA" ? "Postal Code" : country === "US" ? "ZIP Code" : "Postal Code"}
                </Label>
                <Input id="postalCode" name="postalCode" defaultValue={facility.postalCode || ""} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="country">Country</Label>
                <Select
                  value={country}
                  onValueChange={(v) => {
                    setCountry(v);
                    if (country !== v) setStateProvince("");
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select country" />
                  </SelectTrigger>
                  <SelectContent>
                    {COUNTRIES.map((c) => (
                      <SelectItem key={c.code} value={c.code}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Separator />
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="phone">Phone</Label>
                <PhoneInput
                  id="phone"
                  defaultCountry="US"
                  value={phone}
                  onChange={(v) => setPhone(v || "")}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" defaultValue={facility.email || ""} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="squareFootage">Square Footage</Label>
                <Input
                  id="squareFootage"
                  name="squareFootage"
                  type="number"
                  defaultValue={facility.squareFootage || ""}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="maxCapacity">Max Capacity</Label>
                <Input
                  id="maxCapacity"
                  name="maxCapacity"
                  type="number"
                  defaultValue={facility.maxCapacity || ""}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                name="description"
                defaultValue={facility.description || ""}
                rows={3}
              />
            </div>
            <Separator />
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Status</Label>
                <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACTIVE">Active</SelectItem>
                    <SelectItem value="INACTIVE">Inactive</SelectItem>
                    <SelectItem value="MAINTENANCE">Maintenance</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Default Facility</Label>
                <div className="flex items-center gap-2 h-9">
                  <Switch checked={isDefault} onCheckedChange={setIsDefault} />
                  <span className="text-sm text-muted-foreground">{isDefault ? "Yes" : "No"}</span>
                </div>
              </div>
            </div>
          </div>
          <SheetFooter>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

// ============================================
// Main Page
// ============================================

export default function FacilityDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const facilityId = typeof params.id === "string" ? params.id : null;

  const { facility, isLoading, error, fetchFacility } = useFacility(facilityId);
  const [isEditOpen, setIsEditOpen] = React.useState(false);
  const [activeTab, setActiveTabState] = React.useState(searchParams.get("tab") ?? "overview");

  const [spaces, setSpaces] = React.useState<Space[]>([]);
  const [equipment, setEquipment] = React.useState<Equipment[]>([]);
  const [loadingDetail, setLoadingDetail] = React.useState(false);

  const setActiveTab = React.useCallback(
    (tab: string) => {
      setActiveTabState(tab);
      const p = new URLSearchParams(searchParams.toString());
      if (tab === "overview") {
        p.delete("tab");
      } else {
        p.set("tab", tab);
      }
      const qs = p.toString();
      router.replace(`${window.location.pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
    },
    [searchParams, router]
  );

  useBreadcrumbOverride(
    facility ? `/dashboard/organization/facilities/${facilityId}` : undefined,
    facility?.name
  );

  const fetchDetails = React.useCallback(async () => {
    if (!facilityId) return;
    setLoadingDetail(true);
    try {
      const [spacesRes, equipmentRes] = await Promise.all([
        fetch(`/api/organization/facilities/${facilityId}/spaces`),
        fetch(`/api/organization/facilities/${facilityId}/equipment`),
      ]);
      if (spacesRes.ok && equipmentRes.ok) {
        setSpaces(await spacesRes.json());
        setEquipment(await equipmentRes.json());
      }
    } catch {
      // handled by individual tabs
    } finally {
      setLoadingDetail(false);
    }
  }, [facilityId]);

  React.useEffect(() => {
    if (facilityId) fetchDetails();
  }, [facilityId, fetchDetails]);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <div className="space-y-2">
          <Skeleton className="h-7 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border bg-card p-5 space-y-3">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 gap-4">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <h1 className="text-2xl font-bold">Error Loading Facility</h1>
        <p className="text-muted-foreground">{error}</p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Go Back
          </Button>
          <Button onClick={() => fetchFacility()}>Try Again</Button>
        </div>
      </div>
    );
  }

  if (!facility) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6">
        <h1 className="text-2xl font-bold">Facility Not Found</h1>
        <p className="text-muted-foreground">The facility you are looking for does not exist.</p>
        <Button className="mt-4" variant="outline" size="sm" asChild>
          <Link href="/dashboard/organization/facilities">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back to Facilities
          </Link>
        </Button>
      </div>
    );
  }

  const address = [facility.city, facility.stateProvince].filter(Boolean).join(", ");

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted">
            <Building className="h-6 w-6 text-muted-foreground" />
          </div>
          <div className="flex flex-col gap-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-semibold tracking-tight">{facility.name}</h1>
              <Badge
                variant={getStatusBadgeVariant(facility.status)}
                className="text-[10px] uppercase tracking-wider font-semibold h-5 px-1.5 shrink-0"
              >
                {facility.status}
              </Badge>
              {facility.isDefault && (
                <Badge
                  variant="outline"
                  className="text-[10px] uppercase tracking-wider font-semibold h-5 px-1.5 shrink-0 border-yellow-400 text-yellow-600 bg-yellow-50"
                >
                  Default
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-x-1.5 text-sm text-muted-foreground">
              {address && (
                <>
                  <MapPin className="h-3.5 w-3.5" />
                  <span>{address}</span>
                </>
              )}
              {facility.phone && (
                <>
                  {address && <span className="text-border">·</span>}
                  <Phone className="h-3.5 w-3.5" />
                  <span>{formatPhoneNumberIntl(facility.phone) || facility.phone}</span>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" asChild>
            <Link href="/dashboard/organization/facilities">
              <ArrowLeft className="h-4 w-4 mr-1" /> All Facilities
            </Link>
          </Button>
          <Button size="sm" onClick={() => setIsEditOpen(true)}>
            <Settings className="h-4 w-4 mr-1" /> Edit
          </Button>
        </div>
      </div>

      <EditFacilitySheet
        facility={facility}
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
        onSaved={() => {
          fetchFacility();
          fetchDetails();
        }}
      />

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <ResponsiveTabsList value={activeTab} onValueChange={setActiveTab}>
          <TabsTrigger value="overview" className="gap-2">
            <Info className="h-4 w-4" /> Overview
          </TabsTrigger>
          <TabsTrigger value="activity" className="gap-2">
            <Calendar className="h-4 w-4" /> Activity
          </TabsTrigger>
          <TabsTrigger value="spaces" className="gap-2">
            <Building className="h-4 w-4" /> Spaces ({spaces.length})
          </TabsTrigger>
          <TabsTrigger value="equipment" className="gap-2">
            <Dumbbell className="h-4 w-4" /> Equipment ({equipment.length})
          </TabsTrigger>
          <TabsTrigger value="staff" className="gap-2">
            <Users className="h-4 w-4" /> Staff
          </TabsTrigger>
          <TabsTrigger value="notes" className="gap-2">
            <StickyNote className="h-4 w-4" /> Notes
          </TabsTrigger>
        </ResponsiveTabsList>

        <TabsContent value="overview">
          {loadingDetail ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <OverviewTab
              facility={facility}
              spaces={spaces}
              equipment={equipment}
              onHoursSaved={() => fetchFacility()}
            />
          )}
        </TabsContent>

        <TabsContent value="activity">
          <ActivityTab facilityId={facility.id} />
        </TabsContent>

        <TabsContent value="spaces">
          <SpacesTab
            facilityId={facility.id}
            spaces={spaces}
            onRefresh={() => {
              fetchFacility();
              fetchDetails();
            }}
          />
        </TabsContent>

        <TabsContent value="equipment">
          <EquipmentTab
            facilityId={facility.id}
            equipment={equipment}
            spaces={spaces}
            onRefresh={() => {
              fetchFacility();
              fetchDetails();
            }}
          />
        </TabsContent>

        <TabsContent value="staff">
          <StaffTab facilityId={facility.id} />
        </TabsContent>

        <TabsContent value="notes">
          <NotesTab
            facilityId={facility.id}
            description={facility.description}
            onDescriptionSaved={(desc) => fetchFacility()}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
