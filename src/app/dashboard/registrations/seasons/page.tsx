"use client";

import * as React from "react";
import Link from "next/link";
import {
  Plus,
  MoreHorizontal,
  Trash2,
  Loader2,
  AlertCircle,
  Calendar as CalendarIcon,
  Repeat,
  Eye,
} from "lucide-react";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { ColorSelector } from "@/components/color-selector";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
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
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { useSeasons } from "@/hooks/use-seasons";
import { DashboardPageHeader } from "@/components/dashboard-page-header";
import { toast } from "sonner";
import type { Season } from "@/hooks/use-seasons";

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  ACTIVE: "default",
  DRAFT: "secondary",
  CLOSED: "outline",
  EXPIRED: "outline",
  CANCELLED: "destructive",
};

export default function SeasonsPage() {
  const {
    seasons,
    isLoading,
    error,
    isFeatureGated,
    deleteSeason,
    createSeason,
    isCreating,
    refresh,
  } = useSeasons();
  const [createDialogOpen, setCreateDialogOpen] = React.useState(false);

  const handleDelete = (id: string) => {
    toast(
      "Delete season? This will unlink all associated programs, memberships, and competitions.",
      {
        action: {
          label: "Delete",
          onClick: async () => {
            const success = await deleteSeason(id);
            if (success) {
              toast.success("Season deleted");
            }
          },
        },
        cancel: { label: "Cancel", onClick: () => {} },
      }
    );
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <DashboardPageHeader
        title="Seasons"
        description="Create recurring seasons to group programs, memberships, and competitions."
        actions={
          <Button onClick={() => setCreateDialogOpen(true)} disabled={isFeatureGated}>
            <Plus className="mr-2 h-4 w-4" />
            Create Season
          </Button>
        }
      />

      {isLoading && seasons.length === 0 && (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-4 rounded-xl border bg-card p-5">
              <div className="flex items-start justify-between gap-2">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-5 w-14 rounded-full" />
              </div>
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
              <div className="mt-auto flex items-center justify-between border-t pt-3">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-8 w-20 rounded-md" />
              </div>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="flex items-center justify-center h-64 text-destructive">
          <AlertCircle className="mr-2 h-6 w-6" />
          <p>{error}</p>
        </div>
      )}

      {!isLoading && !error && (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {seasons.map((season) => (
            <Card key={season.id} className="flex flex-col">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-xl">{season.name}</CardTitle>
                    <CardDescription className="mt-1">
                      {format(new Date(season.startDate), "MMM d, yyyy")} –{" "}
                      {format(new Date(season.endDate), "MMM d, yyyy")}
                    </CardDescription>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Actions</DropdownMenuLabel>
                      <DropdownMenuItem asChild>
                        <Link href={`/dashboard/registrations/seasons/${season.id}`}>
                          <Eye className="mr-2 h-4 w-4" />
                          View
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => handleDelete(season.id)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent className="flex-1">
                {season.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                    {season.description}
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <div
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: season.color }}
                  />
                  <Badge variant={STATUS_VARIANTS[season.status] || "outline"}>
                    {season.status}
                  </Badge>
                  {season.isRecurring && (
                    <Badge variant="outline">
                      <Repeat className="mr-1 h-3 w-3" />
                      Recurring
                    </Badge>
                  )}
                  {season.isAutoGenerated && (
                    <Badge variant="outline" className="text-xs">
                      Auto
                    </Badge>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                  {season._count && (
                    <>
                      <Badge variant="outline">{season._count.programs} Programs</Badge>
                      <Badge variant="outline">{season._count.memberships} Memberships</Badge>
                      <Badge variant="outline">{season._count.competitions} Competitions</Badge>
                    </>
                  )}
                </div>
              </CardContent>
              <CardFooter className="border-t pt-4">
                <Button variant="outline" className="w-full" asChild>
                  <Link href={`/dashboard/registrations/seasons/${season.id}`}>View Season</Link>
                </Button>
              </CardFooter>
            </Card>
          ))}
          {seasons.length === 0 && (
            <div className="col-span-full text-center py-12 text-muted-foreground">
              No seasons found. Create one to get started.
            </div>
          )}
        </div>
      )}

      <CreateSeasonDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        createSeason={createSeason}
        isCreating={isCreating}
        onCreated={() => {
          setCreateDialogOpen(false);
          refresh();
        }}
      />
    </div>
  );
}

function CreateSeasonDialog({
  open,
  onOpenChange,
  createSeason,
  isCreating,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  createSeason: (data: any) => Promise<Season | null>;
  isCreating: boolean;
  onCreated: () => void;
}) {
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [color, setColor] = React.useState("#8b5cf6");
  const [startDate, setStartDate] = React.useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = React.useState<Date | undefined>(undefined);
  const [status, setStatus] = React.useState<"DRAFT" | "ACTIVE">("DRAFT");
  const [isRecurring, setIsRecurring] = React.useState(false);
  const [renewalLeadDays, setRenewalLeadDays] = React.useState(30);
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  const resetForm = () => {
    setName("");
    setDescription("");
    setColor("#8b5cf6");
    setStartDate(undefined);
    setEndDate(undefined);
    setStatus("DRAFT");
    setIsRecurring(false);
    setRenewalLeadDays(30);
    setErrors({});
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = "Name is required";
    if (!startDate) e.startDate = "Start date is required";
    if (!endDate) e.endDate = "End date is required";
    if (startDate && endDate && endDate <= startDate)
      e.endDate = "End date must be after start date";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    const result = await createSeason({
      name: name.trim(),
      description: description.trim() || undefined,
      color,
      startDate: format(startDate!, "yyyy-MM-dd"),
      endDate: format(endDate!, "yyyy-MM-dd"),
      status,
      isRecurring,
      renewalLeadDays: isRecurring ? renewalLeadDays : undefined,
    });

    if (result) {
      toast.success("Season created");
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
      <DialogContent className="sm:max-w-[680px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Season</DialogTitle>
          <DialogDescription>
            Set up a new season to group programs, memberships, and competitions.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <Label htmlFor="create-name">Name</Label>
            <Input
              id="create-name"
              placeholder="e.g. Spring 2026"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="create-description">Description</Label>
            <Textarea
              id="create-description"
              placeholder="Optional description for this season"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <ColorSelector value={color} onChange={setColor} />

          <Separator />

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Start Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !startDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto overflow-hidden p-0" align="start">
                  <Calendar
                    mode="single"
                    fixedWeeks
                    captionLayout="dropdown"
                    fromYear={new Date().getFullYear() - 1}
                    toYear={new Date().getFullYear() + 5}
                    selected={startDate}
                    onSelect={(date) => {
                      setStartDate(date);
                      if (endDate && date && endDate < date) setEndDate(undefined);
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              {errors.startDate && <p className="text-sm text-destructive">{errors.startDate}</p>}
            </div>
            <div className="space-y-2">
              <Label>End Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !endDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto overflow-hidden p-0" align="start">
                  <Calendar
                    mode="single"
                    fixedWeeks
                    captionLayout="dropdown"
                    fromYear={new Date().getFullYear() - 1}
                    toYear={new Date().getFullYear() + 5}
                    selected={endDate}
                    onSelect={setEndDate}
                    disabled={(date) => (startDate ? date < startDate : false)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              {errors.endDate && <p className="text-sm text-destructive">{errors.endDate}</p>}
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={status} onValueChange={(val) => setStatus(val as "DRAFT" | "ACTIVE")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="DRAFT">Draft</SelectItem>
                <SelectItem value="ACTIVE">Active</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>Recurring Season</Label>
              <p className="text-sm text-muted-foreground">
                Automatically generate the next season when this one nears its end
              </p>
            </div>
            <Switch checked={isRecurring} onCheckedChange={setIsRecurring} />
          </div>

          {isRecurring && (
            <div className="space-y-2">
              <Label htmlFor="create-renewalLeadDays">Renewal Lead Days</Label>
              <Input
                id="create-renewalLeadDays"
                type="number"
                min={1}
                value={renewalLeadDays}
                onChange={(e) => setRenewalLeadDays(parseInt(e.target.value) || 30)}
                className="max-w-[200px]"
              />
              <p className="text-sm text-muted-foreground">
                Days before this season ends to auto-generate the next season as a draft
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isCreating}>
            {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create Season
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
