"use client";

import * as React from "react";
import { Plus, Loader2, AlertCircle, Trash2, Calendar as CalendarIcon } from "lucide-react";
import { format } from "date-fns";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ResponsiveTabsList } from "@/components/ui/responsive-tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { formatTime12h } from "@/lib/date-utils";
import { DashboardPageHeader } from "@/components/dashboard-page-header";
import { toast } from "sonner";
import {
  useHolidays,
  type OrganizationHoliday,
  type ConflictInstance,
  type MissingProgram,
} from "@/hooks/use-holidays";

const currentYear = new Date().getFullYear();
const nextYear = currentYear + 1;

export default function HolidaysPage() {
  const {
    holidays,
    isLoading,
    error,
    year,
    setYear,
    toggleHoliday,
    addCustomClosure,
    deleteHoliday,
    checkConflicts,
    refresh,
  } = useHolidays();

  const [createDialogOpen, setCreateDialogOpen] = React.useState(false);
  const [conflictDialog, setConflictDialog] = React.useState<{
    holiday: OrganizationHoliday;
    action: "enable" | "disable";
    instances?: ConflictInstance[];
    programs?: MissingProgram[];
  } | null>(null);
  const [selectedConflictIds, setSelectedConflictIds] = React.useState<Set<string>>(new Set());
  const [isToggling, setIsToggling] = React.useState<string | null>(null);

  const handleToggle = async (holiday: OrganizationHoliday) => {
    const newEnabled = !holiday.isEnabled;
    const action = newEnabled ? "enable" : "disable";
    const dateStr = holiday.date.split("T")[0];

    setIsToggling(holiday.id);

    try {
      const conflicts = await checkConflicts(dateStr, action);
      if (!conflicts) {
        setIsToggling(null);
        return;
      }

      const hasConflicts =
        (action === "enable" && "instances" in conflicts && conflicts.instances.length > 0) ||
        (action === "disable" && "programs" in conflicts && conflicts.programs.length > 0);

      if (hasConflicts) {
        setConflictDialog({
          holiday,
          action,
          instances: "instances" in conflicts ? conflicts.instances : undefined,
          programs: "programs" in conflicts ? conflicts.programs : undefined,
        });
        setSelectedConflictIds(new Set());
        setIsToggling(null);
        return;
      }

      const result = await toggleHoliday(holiday.id, newEnabled);
      if (result) {
        toast.success(`${holiday.name} ${newEnabled ? "enabled" : "disabled"}`);
      }
    } finally {
      setIsToggling(null);
    }
  };

  const handleConflictConfirm = async () => {
    if (!conflictDialog) return;

    const { holiday, action } = conflictDialog;
    const newEnabled = action === "enable";
    const ids = Array.from(selectedConflictIds);

    setIsToggling(holiday.id);

    const result = await toggleHoliday(
      holiday.id,
      newEnabled,
      action === "enable" ? ids : undefined,
      action === "disable" ? ids : undefined
    );

    if (result) {
      const cancelCount = action === "enable" ? ids.length : 0;
      const createCount = action === "disable" ? ids.length : 0;

      if (cancelCount > 0) {
        toast.success(
          `${holiday.name} enabled, ${cancelCount} session${cancelCount > 1 ? "s" : ""} cancelled`
        );
      } else if (createCount > 0) {
        toast.success(
          `${holiday.name} disabled, ${createCount} session${createCount > 1 ? "s" : ""} re-added`
        );
      } else {
        toast.success(`${holiday.name} ${newEnabled ? "enabled" : "disabled"}`);
      }
    }

    setConflictDialog(null);
    setIsToggling(null);
  };

  const handleDelete = async (holiday: OrganizationHoliday) => {
    if (!confirm(`Delete "${holiday.name}"? This cannot be undone.`)) return;

    const success = await deleteHoliday(holiday.id);
    if (success) {
      toast.success(`"${holiday.name}" deleted`);
    }
  };

  const handleCustomCreated = () => {
    setCreateDialogOpen(false);
    refresh();
  };

  const formatHolidayDate = (dateStr: string) => {
    const date = new Date(dateStr.split("T")[0] + "T12:00:00Z");
    return format(date, "EEEE, MMMM d");
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <DashboardPageHeader
        title="Holidays"
        description="Manage organization closures. Programs will not create sessions on enabled holidays."
        actions={
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Closure
          </Button>
        }
      />

      <Tabs value={String(year)} onValueChange={(val) => setYear(Number(val))}>
        <ResponsiveTabsList value={String(year)} onValueChange={(val) => setYear(Number(val))}>
          <TabsTrigger value={String(currentYear)}>{currentYear}</TabsTrigger>
          <TabsTrigger value={String(nextYear)}>{nextYear}</TabsTrigger>
        </ResponsiveTabsList>

        {[currentYear, nextYear].map((tabYear) => (
          <TabsContent key={tabYear} value={String(tabYear)}>
            {isLoading && holidays.length === 0 ? (
              <div className="rounded-md border">
                <div className="border-b px-4 py-3">
                  <div className="grid grid-cols-12 gap-4">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Skeleton key={i} className="col-span-2 h-4" />
                    ))}
                  </div>
                </div>
                <div className="divide-y">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="grid grid-cols-12 items-center gap-4 px-4 py-3">
                      <Skeleton className="col-span-3 h-4" />
                      <Skeleton className="col-span-5 h-4" />
                      <Skeleton className="col-span-2 h-4" />
                      <Skeleton className="col-span-1 h-4" />
                      <Skeleton className="col-span-1 h-4" />
                    </div>
                  ))}
                </div>
              </div>
            ) : error ? (
              <div className="flex items-center justify-center h-64 text-destructive">
                <AlertCircle className="mr-2 h-6 w-6" />
                <p>{error}</p>
              </div>
            ) : holidays.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                No holidays found for {tabYear}. Your organization may not have a country set.
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[280px]">Date</TableHead>
                      <TableHead>Holiday</TableHead>
                      <TableHead className="w-[120px]">Type</TableHead>
                      <TableHead className="w-[100px] text-center">Enabled</TableHead>
                      <TableHead className="w-[80px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {holidays.map((holiday) => (
                      <TableRow key={holiday.id} className={cn(!holiday.isEnabled && "opacity-50")}>
                        <TableCell className="font-medium">
                          {formatHolidayDate(holiday.date)}
                        </TableCell>
                        <TableCell>{holiday.name}</TableCell>
                        <TableCell>
                          <Badge variant={holiday.type === "NATIONAL" ? "secondary" : "outline"}>
                            {holiday.type === "NATIONAL" ? "National" : "Custom"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Switch
                            checked={holiday.isEnabled}
                            disabled={isToggling === holiday.id}
                            onCheckedChange={() => handleToggle(holiday)}
                          />
                        </TableCell>
                        <TableCell>
                          {holiday.type === "CUSTOM" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              onClick={() => handleDelete(holiday)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

      <AddClosureDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        addCustomClosure={addCustomClosure}
        onCreated={handleCustomCreated}
        year={year}
      />

      <ConflictResolutionDialog
        conflictDialog={conflictDialog}
        selectedIds={selectedConflictIds}
        onSelectedIdsChange={setSelectedConflictIds}
        onConfirm={handleConflictConfirm}
        onCancel={() => {
          setConflictDialog(null);
          setIsToggling(null);
        }}
        isToggling={isToggling !== null}
      />
    </div>
  );
}

function AddClosureDialog({
  open,
  onOpenChange,
  addCustomClosure,
  onCreated,
  year,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  addCustomClosure: (name: string, date: string) => Promise<OrganizationHoliday | null>;
  onCreated: () => void;
  year: number;
}) {
  const [name, setName] = React.useState("");
  const [date, setDate] = React.useState<Date | undefined>(undefined);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  const resetForm = () => {
    setName("");
    setDate(undefined);
    setErrors({});
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = "Name is required";
    if (!date) e.date = "Date is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate() || !date) return;

    setIsSubmitting(true);
    const dateStr = format(date, "yyyy-MM-dd");
    const result = await addCustomClosure(name.trim(), dateStr);
    setIsSubmitting(false);

    if (result) {
      toast.success(`"${name.trim()}" added`);
      resetForm();
      onCreated();
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(val) => {
        if (!val) resetForm();
        onOpenChange(val);
      }}
    >
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add Custom Closure</DialogTitle>
          <DialogDescription>
            Add a custom closure date. Programs will not create sessions on this day.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="closure-name">Name</Label>
            <Input
              id="closure-name"
              placeholder="e.g. Staff Development Day"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
          </div>

          <div className="space-y-2">
            <Label>Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !date && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, "PPP") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto overflow-hidden p-0" align="start">
                <Calendar
                  mode="single"
                  fixedWeeks
                  captionLayout="dropdown"
                  fromYear={year}
                  toYear={year + 1}
                  selected={date}
                  onSelect={setDate}
                  defaultMonth={new Date(year, 0)}
                />
              </PopoverContent>
            </Popover>
            {errors.date && <p className="text-sm text-destructive">{errors.date}</p>}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Add Closure
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ConflictResolutionDialog({
  conflictDialog,
  selectedIds,
  onSelectedIdsChange,
  onConfirm,
  onCancel,
  isToggling,
}: {
  conflictDialog: {
    holiday: OrganizationHoliday;
    action: "enable" | "disable";
    instances?: ConflictInstance[];
    programs?: MissingProgram[];
  } | null;
  selectedIds: Set<string>;
  onSelectedIdsChange: (ids: Set<string>) => void;
  onConfirm: () => void;
  onCancel: () => void;
  isToggling: boolean;
}) {
  if (!conflictDialog) return null;

  const { holiday, action, instances, programs } = conflictDialog;
  const dateStr = holiday.date.split("T")[0] + "T12:00:00Z";
  const formattedDate = format(new Date(dateStr), "MMMM d, yyyy");

  const toggleId = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    onSelectedIdsChange(next);
  };

  return (
    <Dialog
      open={!!conflictDialog}
      onOpenChange={(val) => {
        if (!val) onCancel();
      }}
    >
      <DialogContent className="sm:max-w-[540px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {action === "enable" ? "Enable" : "Disable"} {holiday.name}
          </DialogTitle>
          <DialogDescription>
            {action === "enable"
              ? `The following sessions are scheduled on ${formattedDate}. Select any you'd like to cancel.`
              : `The following programs are missing a session on ${formattedDate}. Select any you'd like to re-add.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {action === "enable" &&
            instances?.map((instance) => (
              <label
                key={instance.id}
                className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/50"
              >
                <Checkbox
                  checked={selectedIds.has(instance.id)}
                  onCheckedChange={() => toggleId(instance.id)}
                  className="mt-0.5"
                />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{instance.programName}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatTime12h(instance.startTime)} - {formatTime12h(instance.endTime)}
                    {instance.registrationCount > 0 && (
                      <span className="ml-2 text-amber-600">
                        ({instance.registrationCount} registration
                        {instance.registrationCount > 1 ? "s" : ""})
                      </span>
                    )}
                  </p>
                </div>
              </label>
            ))}

          {action === "disable" &&
            programs?.map((program) => (
              <label
                key={program.id}
                className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/50"
              >
                <Checkbox
                  checked={selectedIds.has(program.id)}
                  onCheckedChange={() => toggleId(program.id)}
                  className="mt-0.5"
                />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{program.name}</p>
                  <p className="text-sm text-muted-foreground">
                    Session at {formatTime12h(program.startTime)}
                  </p>
                </div>
              </label>
            ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={isToggling}>
            {isToggling && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {action === "enable" ? "Enable Holiday" : "Disable Holiday"}
            {selectedIds.size > 0 &&
              ` & ${action === "enable" ? "Cancel" : "Re-add"} ${selectedIds.size}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
