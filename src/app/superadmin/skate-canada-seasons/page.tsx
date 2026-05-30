"use client";

import * as React from "react";
import { Calendar, Loader2, Pencil, Plus, Zap } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface SkateCanadaSeason {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  scSeasonGuid: string | null;
  createdAt: string;
}

const emptyForm = {
  name: "",
  startDate: "",
  endDate: "",
  isActive: false,
  scSeasonGuid: "",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function toDateInputValue(iso: string) {
  return iso ? new Date(iso).toISOString().slice(0, 10) : "";
}

export default function SkateCanadaSeasonsPage() {
  const [seasons, setSeasons] = React.useState<SkateCanadaSeason[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSheetOpen, setIsSheetOpen] = React.useState(false);
  const [editingSeason, setEditingSeason] = React.useState<SkateCanadaSeason | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isActivating, setIsActivating] = React.useState<string | null>(null);
  const [formData, setFormData] = React.useState(emptyForm);

  React.useEffect(() => {
    fetchSeasons();
  }, []);

  const fetchSeasons = async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/superadmin/skate-canada-seasons");
      if (!res.ok) throw new Error("Failed to fetch seasons");
      const data = await res.json();
      setSeasons(data);
    } catch {
      toast.error("Failed to load seasons");
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenCreate = () => {
    setEditingSeason(null);
    setFormData(emptyForm);
    setIsSheetOpen(true);
  };

  const handleOpenEdit = (season: SkateCanadaSeason) => {
    setEditingSeason(season);
    setFormData({
      name: season.name,
      startDate: toDateInputValue(season.startDate),
      endDate: toDateInputValue(season.endDate),
      isActive: season.isActive,
      scSeasonGuid: season.scSeasonGuid ?? "",
    });
    setIsSheetOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error("Season name is required");
      return;
    }
    if (!formData.startDate || !formData.endDate) {
      toast.error("Start and end dates are required");
      return;
    }

    setIsSaving(true);
    try {
      const url = editingSeason
        ? `/api/superadmin/skate-canada-seasons/${editingSeason.id}`
        : "/api/superadmin/skate-canada-seasons";

      const res = await fetch(url, {
        method: editingSeason ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name.trim(),
          startDate: new Date(formData.startDate).toISOString(),
          endDate: new Date(formData.endDate).toISOString(),
          isActive: formData.isActive,
          scSeasonGuid: formData.scSeasonGuid.trim() || null,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to save season");
      }

      toast.success(editingSeason ? "Season updated" : "Season created");
      setIsSheetOpen(false);
      fetchSeasons();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save season");
    } finally {
      setIsSaving(false);
    }
  };

  const handleActivate = async (season: SkateCanadaSeason) => {
    setIsActivating(season.id);
    try {
      const res = await fetch(`/api/superadmin/skate-canada-seasons/${season.id}/activate`, {
        method: "POST",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to activate season");
      }
      toast.success(`"${season.name}" is now the active season`);
      fetchSeasons();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to activate season");
    } finally {
      setIsActivating(null);
    }
  };

  return (
    <div className="flex flex-col gap-6 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Skate Canada Seasons</h1>
          <p className="text-muted-foreground">Manage global Skate Canada season records</p>
        </div>
        <Button onClick={handleOpenCreate}>
          <Plus className="mr-2 h-4 w-4" />
          New season
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : seasons.length === 0 ? (
        <EmptyState
          icon={Calendar}
          title="No seasons yet"
          description="Create the first Skate Canada season to get started."
          action={{ label: "New season", onClick: handleOpenCreate }}
        />
      ) : (
        <div className="rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Start date</TableHead>
                <TableHead>End date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>CRM GUID</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {seasons.map((season) => (
                <TableRow key={season.id}>
                  <TableCell className="font-medium">{season.name}</TableCell>
                  <TableCell>{formatDate(season.startDate)}</TableCell>
                  <TableCell>{formatDate(season.endDate)}</TableCell>
                  <TableCell>
                    {season.isActive ? (
                      <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                        Active
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Inactive</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {season.scSeasonGuid ? (
                      <span className="font-mono text-xs">{season.scSeasonGuid.slice(0, 8)}…</span>
                    ) : (
                      "— not synced"
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-2">
                      {!season.isActive && (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={isActivating === season.id}
                          onClick={() => handleActivate(season)}
                        >
                          {isActivating === season.id ? (
                            <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                          ) : (
                            <Zap className="mr-2 h-3 w-3" />
                          )}
                          Set as active
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" onClick={() => handleOpenEdit(season)}>
                        <Pencil className="h-4 w-4" />
                        <span className="sr-only">Edit</span>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent className="sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editingSeason ? "Edit season" : "New season"}</SheetTitle>
            <SheetDescription>
              {editingSeason ? "Update season details" : "Create a new Skate Canada season"}
            </SheetDescription>
          </SheetHeader>

          <div className="grid gap-5 py-6">
            <div className="space-y-2">
              <Label htmlFor="season-name">Name</Label>
              <Input
                id="season-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. 2026-2027"
              />
              <p className="text-xs text-muted-foreground">e.g. 2026-2027 or 2026-27</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="season-start">Start date</Label>
              <Input
                id="season-start"
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="season-end">End date</Label>
              <Input
                id="season-end"
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label htmlFor="season-active">Active</Label>
                <p className="text-xs text-muted-foreground">
                  Only one season can be active. Activating this season deactivates others.
                </p>
              </div>
              <Switch
                id="season-active"
                checked={formData.isActive}
                onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="season-guid">CRM GUID (optional)</Label>
              <Input
                id="season-guid"
                value={formData.scSeasonGuid}
                onChange={(e) => setFormData({ ...formData, scSeasonGuid: e.target.value })}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              />
              <p className="text-xs text-muted-foreground">
                Populated by Phase 6.4 CRM sync. Leave blank if not yet known.
              </p>
            </div>
          </div>

          <SheetFooter>
            <Button variant="outline" onClick={() => setIsSheetOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingSeason ? "Save changes" : "Create season"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
