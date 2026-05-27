"use client";

import * as React from "react";
import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { restrictToVerticalAxis, restrictToParentElement } from "@dnd-kit/modifiers";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Plus,
  Pencil,
  Trash2,
  MoreHorizontal,
  Loader2,
  Building2,
  Trophy,
  GripVertical,
  ArrowUpDown,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Sport {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  isActive: boolean;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
  _count: {
    organizations: number;
  };
}

interface SportFormData {
  name: string;
  slug: string;
  description: string;
  icon: string;
  isActive: boolean;
  displayOrder: number;
}

const initialFormData: SportFormData = {
  name: "",
  slug: "",
  description: "",
  icon: "",
  isActive: true,
  displayOrder: 0,
};

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

// Sortable sport item for reorder dialog
function SortableSportItem({ sport }: { sport: Sport }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: sport.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 rounded-lg border bg-card p-3 ${
        isDragging ? "opacity-50 shadow-lg" : ""
      }`}
    >
      <button
        type="button"
        className="cursor-grab touch-none text-muted-foreground hover:text-foreground"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-5 w-5" />
      </button>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium">{sport.name}</span>
          <span className="text-muted-foreground font-mono text-sm">{sport.slug}</span>
        </div>
        {sport.description && (
          <p className="mt-0.5 truncate text-sm text-muted-foreground">{sport.description}</p>
        )}
      </div>
      <Badge variant={sport.isActive ? "default" : "secondary"}>
        {sport.isActive ? "Active" : "Inactive"}
      </Badge>
    </div>
  );
}

export default function SuperadminSportsPage() {
  const [sports, setSports] = React.useState<Sport[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingSport, setEditingSport] = React.useState<Sport | null>(null);
  const [formData, setFormData] = React.useState<SportFormData>(initialFormData);

  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [deletingSport, setDeletingSport] = React.useState<Sport | null>(null);

  const [isReorderDialogOpen, setIsReorderDialogOpen] = React.useState(false);
  const [reorderSports, setReorderSports] = React.useState<Sport[]>([]);
  const [isSavingOrder, setIsSavingOrder] = React.useState(false);

  const sensors = useSensors(
    useSensor(MouseSensor, {}),
    useSensor(TouchSensor, {}),
    useSensor(KeyboardSensor, {})
  );

  const fetchSports = React.useCallback(async () => {
    try {
      const response = await fetch("/api/superadmin/sports");
      if (!response.ok) throw new Error("Failed to fetch sports");
      const data = await response.json();
      setSports(data);
    } catch (error) {
      toast.error("Failed to load sports");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchSports();
  }, [fetchSports]);

  const handleOpenCreate = () => {
    setEditingSport(null);
    setFormData({
      ...initialFormData,
      displayOrder: sports.length,
    });
    setDialogOpen(true);
  };

  const handleOpenEdit = (sport: Sport) => {
    setEditingSport(sport);
    setFormData({
      name: sport.name,
      slug: sport.slug,
      description: sport.description || "",
      icon: sport.icon || "",
      isActive: sport.isActive,
      displayOrder: sport.displayOrder,
    });
    setDialogOpen(true);
  };

  const handleNameChange = (name: string) => {
    setFormData((prev) => ({
      ...prev,
      name,
      slug: editingSport ? prev.slug : generateSlug(name),
    }));
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error("Name is required");
      return;
    }
    if (!formData.slug.trim()) {
      toast.error("Slug is required");
      return;
    }

    setSaving(true);
    try {
      const url = editingSport
        ? `/api/superadmin/sports/${editingSport.id}`
        : "/api/superadmin/sports";
      const method = editingSport ? "PATCH" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          slug: formData.slug,
          description: formData.description || null,
          icon: formData.icon || null,
          isActive: formData.isActive,
          ...(editingSport ? {} : { displayOrder: formData.displayOrder }),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to save sport");
      }

      toast.success(editingSport ? "Sport updated" : "Sport created");
      setDialogOpen(false);
      fetchSports();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save sport");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingSport) return;

    try {
      const response = await fetch(`/api/superadmin/sports/${deletingSport.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to delete sport");
      }

      toast.success("Sport deleted");
      setDeleteDialogOpen(false);
      setDeletingSport(null);
      fetchSports();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete sport");
    }
  };

  const handleOpenReorder = () => {
    setReorderSports([...sports]);
    setIsReorderDialogOpen(true);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setReorderSports((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const handleSaveOrder = async () => {
    setIsSavingOrder(true);
    try {
      const updates = reorderSports.map((sport, index) => ({
        id: sport.id,
        displayOrder: index,
      }));

      const response = await fetch("/api/superadmin/sports/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sports: updates }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to save order");
      }

      toast.success("Sport order updated");
      setIsReorderDialogOpen(false);
      fetchSports();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save order");
    } finally {
      setIsSavingOrder(false);
    }
  };

  const totalOrgs = sports.reduce((sum, s) => sum + s._count.organizations, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Sports</h1>
          <p className="text-muted-foreground">
            Manage the sports available for organizations to select.
          </p>
        </div>
        <div className="flex gap-2">
          {sports.length > 1 && (
            <Button variant="outline" onClick={handleOpenReorder}>
              <ArrowUpDown className="mr-2 h-4 w-4" />
              Reorder
            </Button>
          )}
          <Button onClick={handleOpenCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Add Sport
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Sports</CardTitle>
            <Trophy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{sports.length}</div>
            <p className="text-xs text-muted-foreground">
              {sports.filter((s) => s.isActive).length} active
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Organization Selections</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalOrgs}</div>
            <p className="text-xs text-muted-foreground">Across all sports</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Most Popular</CardTitle>
            <Trophy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {sports.length > 0
                ? sports.reduce((max, s) =>
                    s._count.organizations > max._count.organizations ? s : max
                  ).name
                : "—"}
            </div>
            <p className="text-xs text-muted-foreground">
              {sports.length > 0
                ? `${
                    sports.reduce((max, s) =>
                      s._count.organizations > max._count.organizations ? s : max
                    )._count.organizations
                  } organizations`
                : "No sports yet"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Sports Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Sports</CardTitle>
          <CardDescription>
            {sports.length} sport{sports.length !== 1 ? "s" : ""} configured
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-center">Organizations</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="w-[70px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sports.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No sports configured yet. Add your first sport to get started.
                  </TableCell>
                </TableRow>
              ) : (
                sports.map((sport) => (
                  <TableRow key={sport.id}>
                    <TableCell className="font-medium">{sport.name}</TableCell>
                    <TableCell className="text-muted-foreground font-mono text-sm">
                      {sport.slug}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                      {sport.description || "—"}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary">{sport._count.organizations}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={sport.isActive ? "default" : "secondary"}>
                        {sport.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleOpenEdit(sport)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => {
                              setDeletingSport(sport);
                              setDeleteDialogOpen(true);
                            }}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingSport ? "Edit Sport" : "Add Sport"}</DialogTitle>
            <DialogDescription>
              {editingSport
                ? "Update the sport details below."
                : "Add a new sport that organizations can select."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="sport-name">Name</Label>
              <Input
                id="sport-name"
                value={formData.name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="e.g., Figure Skating"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sport-slug">Slug</Label>
              <Input
                id="sport-slug"
                value={formData.slug}
                onChange={(e) => setFormData((prev) => ({ ...prev, slug: e.target.value }))}
                placeholder="e.g., figure-skating"
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                URL-friendly identifier. Auto-generated from name.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sport-description">Description</Label>
              <Textarea
                id="sport-description"
                value={formData.description}
                onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Brief description of this sport"
                rows={3}
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Active</Label>
                <p className="text-xs text-muted-foreground">
                  Inactive sports are hidden from organization selection
                </p>
              </div>
              <Switch
                checked={formData.isActive}
                onCheckedChange={(checked) =>
                  setFormData((prev) => ({ ...prev, isActive: checked }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingSport ? "Save Changes" : "Create Sport"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Sport</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deletingSport?.name}&quot;? This action cannot
              be undone.
              {deletingSport && deletingSport._count.organizations > 0 && (
                <span className="block mt-2 text-destructive font-medium">
                  This sport is currently used by {deletingSport._count.organizations}{" "}
                  organization(s). You must deactivate it instead.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reorder Dialog */}
      <Dialog open={isReorderDialogOpen} onOpenChange={setIsReorderDialogOpen}>
        <DialogContent className="max-w-3xl overflow-hidden">
          <DialogHeader>
            <DialogTitle>Reorder Sports</DialogTitle>
            <DialogDescription>
              Drag and drop to reorder how sports appear to organizations
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[60vh] overflow-y-auto py-4">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              modifiers={[restrictToVerticalAxis, restrictToParentElement]}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={reorderSports.map((s) => s.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="flex flex-col gap-2">
                  {reorderSports.map((sport) => (
                    <SortableSportItem key={sport.id} sport={sport} />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsReorderDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveOrder} disabled={isSavingOrder}>
              {isSavingOrder && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
