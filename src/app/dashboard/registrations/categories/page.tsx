"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
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
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Plus,
  Search,
  Loader2,
  AlertCircle,
  Pencil,
  Trash2,
  BookOpen,
  CalendarDays,
  Trophy,
  ImageIcon,
  GripVertical,
  ArrowUpDown,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ImageUpload } from "@/components/ui/image-upload";
import { useCategories, type Category } from "@/hooks/use-categories";
import { useFeatures } from "@/components/feature-context";
import { toast } from "sonner";

interface CategoryFormData {
  name: string;
  description: string;
  imageUrl: string | null;
}

const defaultFormData: CategoryFormData = {
  name: "",
  description: "",
  imageUrl: null,
};

function SortableCategoryItem({ category }: { category: Category }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: category.id,
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
      <div className="flex-1 min-w-0">
        <span className="font-medium">{category.name}</span>
        {category.description && (
          <p className="mt-0.5 truncate text-sm text-muted-foreground">{category.description}</p>
        )}
      </div>
      <div className="flex gap-1.5 shrink-0">
        <Badge variant="secondary" className="gap-1">
          <BookOpen className="h-3 w-3" />
          {category._count.programs}
        </Badge>
        <Badge variant="secondary" className="gap-1">
          <CalendarDays className="h-3 w-3" />
          {category._count.events}
        </Badge>
      </div>
    </div>
  );
}

export default function CategoriesPage() {
  const {
    categories,
    allPrograms,
    isLoading,
    isCreating,
    isUpdating,
    isDeleting,
    error,
    fetchCategories,
    createCategory,
    updateCategory,
    deleteCategory,
    clearError,
  } = useCategories({ autoFetch: false });
  const { isFeatureEnabled } = useFeatures();
  const competitionsEnabled = isFeatureEnabled("competitions");
  const [searchTerm, setSearchTerm] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [formData, setFormData] = useState<CategoryFormData>(defaultFormData);

  const [isReorderDialogOpen, setIsReorderDialogOpen] = useState(false);
  const [reorderCategories, setReorderCategories] = useState<Category[]>([]);
  const [isSavingOrder, setIsSavingOrder] = useState(false);

  const isSaving = isCreating || isUpdating;

  const sensors = useSensors(
    useSensor(MouseSensor, {}),
    useSensor(TouchSensor, {}),
    useSensor(KeyboardSensor, {})
  );

  const hasFetched = useRef(false);
  useEffect(() => {
    const params = { search: searchTerm };
    if (!hasFetched.current) {
      hasFetched.current = true;
      fetchCategories(params);
      return;
    }
    const timer = setTimeout(() => fetchCategories(params), 500);
    return () => clearTimeout(timer);
  }, [searchTerm, fetchCategories]);

  const openCreateForm = () => {
    setEditingCategory(null);
    setFormData(defaultFormData);
    setFormOpen(true);
  };

  const openEditForm = (category: Category) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      description: category.description || "",
      imageUrl: category.imageUrl,
    });
    setFormOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error("Name is required");
      return;
    }

    const payload = {
      name: formData.name.trim(),
      description: formData.description.trim() || null,
      imageUrl: formData.imageUrl,
    };

    if (editingCategory) {
      const result = await updateCategory(editingCategory.id, payload);
      if (result) {
        toast.success("Category updated");
        setFormOpen(false);
        fetchCategories({ search: searchTerm });
      } else {
        toast.error("Failed to update category");
        clearError();
      }
    } else {
      const result = await createCategory(payload);
      if (result) {
        toast.success("Category created");
        setFormOpen(false);
        fetchCategories({ search: searchTerm });
      } else {
        toast.error("Failed to create category");
        clearError();
      }
    }
  };

  const handleDelete = async (id: string) => {
    const success = await deleteCategory(id);
    if (success) {
      toast.success("Category deleted");
    } else {
      toast.error("Failed to delete category");
    }
  };

  const handleOpenReorder = () => {
    setReorderCategories([...categories]);
    setIsReorderDialogOpen(true);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setReorderCategories((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const handleSaveOrder = async () => {
    setIsSavingOrder(true);
    try {
      const updates = reorderCategories.map((category, index) => ({
        id: category.id,
        displayOrder: index,
      }));

      const response = await fetch("/api/categories/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categories: updates }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to save order");
      }

      toast.success("Category order updated");
      setIsReorderDialogOpen(false);
      fetchCategories({ search: searchTerm });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save order");
    } finally {
      setIsSavingOrder(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Categories</h1>
          <p className="text-muted-foreground">
            Group your programs, events, and competitions into categories for your marketing site.
          </p>
        </div>
        <div className="flex gap-2">
          {categories.length > 1 && (
            <Button variant="outline" onClick={handleOpenReorder}>
              <ArrowUpDown className="mr-2 h-4 w-4" />
              Reorder
            </Button>
          )}
          <Button onClick={openCreateForm}>
            <Plus className="mr-2 h-4 w-4" />
            Add Category
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 md:max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search categories..."
            className="pl-8"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {isLoading && categories.length === 0 && (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
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
          {/* All Programs — always first, non-deletable */}
          {!searchTerm && allPrograms && (
            <Card className="flex flex-col overflow-hidden">
              {allPrograms.imageUrl ? (
                <div className="relative aspect-video w-full bg-muted">
                  <Image
                    src={allPrograms.imageUrl}
                    alt="All Programs"
                    fill
                    className="object-cover"
                  />
                </div>
              ) : (
                <div className="flex items-center justify-center aspect-video w-full bg-muted">
                  <ImageIcon className="h-12 w-12 text-muted-foreground/40" />
                </div>
              )}
              <CardHeader className="pb-2">
                <CardTitle className="leading-tight">All Programs</CardTitle>
              </CardHeader>
              <CardContent className="flex-1 pb-3">
                <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                  Shows all programs on your marketing site regardless of category.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary" className="gap-1">
                    <BookOpen className="h-3 w-3" />
                    {allPrograms._count.programs}{" "}
                    {allPrograms._count.programs === 1 ? "Program" : "Programs"}
                  </Badge>
                  <Badge variant="secondary" className="gap-1">
                    <CalendarDays className="h-3 w-3" />
                    {allPrograms._count.events}{" "}
                    {allPrograms._count.events === 1 ? "Event" : "Events"}
                  </Badge>
                  {competitionsEnabled && (
                    <Badge variant="secondary" className="gap-1">
                      <Trophy className="h-3 w-3" />
                      {allPrograms._count.competitions}{" "}
                      {allPrograms._count.competitions === 1 ? "Competition" : "Competitions"}
                    </Badge>
                  )}
                </div>
              </CardContent>
              <CardFooter className="border-t pt-3 gap-2">
                <Button variant="outline" size="sm" className="flex-1" asChild>
                  <Link href="/dashboard/registrations/categories/all-programs">
                    <Pencil className="mr-1.5 h-3.5 w-3.5" />
                    Edit
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          )}

          {categories.map((category) => (
            <Card key={category.id} className="flex flex-col overflow-hidden">
              {category.imageUrl ? (
                <div className="relative aspect-video w-full bg-muted">
                  <Image
                    src={category.imageUrl}
                    alt={category.name}
                    fill
                    className="object-cover"
                  />
                </div>
              ) : (
                <div className="flex items-center justify-center aspect-video w-full bg-muted">
                  <ImageIcon className="h-12 w-12 text-muted-foreground/40" />
                </div>
              )}
              <CardHeader className="pb-2">
                <CardTitle className="leading-tight">{category.name}</CardTitle>
              </CardHeader>
              <CardContent className="flex-1 pb-3">
                {category.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                    {category.description}
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary" className="gap-1">
                    <BookOpen className="h-3 w-3" />
                    {category._count.programs}{" "}
                    {category._count.programs === 1 ? "Program" : "Programs"}
                  </Badge>
                  <Badge variant="secondary" className="gap-1">
                    <CalendarDays className="h-3 w-3" />
                    {category._count.events} {category._count.events === 1 ? "Event" : "Events"}
                  </Badge>
                  {competitionsEnabled && (
                    <Badge variant="secondary" className="gap-1">
                      <Trophy className="h-3 w-3" />
                      {category._count.competitions}{" "}
                      {category._count.competitions === 1 ? "Competition" : "Competitions"}
                    </Badge>
                  )}
                </div>
              </CardContent>
              <CardFooter className="border-t pt-3 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => openEditForm(category)}
                >
                  <Pencil className="mr-1.5 h-3.5 w-3.5" />
                  Edit
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      disabled={isDeleting}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete category?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will remove the category &ldquo;{category.name}&rdquo;. Programs,
                        events, and competitions in this category will become uncategorized.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleDelete(category.id)}>
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </CardFooter>
            </Card>
          ))}
          {categories.length === 0 && !searchTerm && (
            <div className="col-span-full text-center py-12 text-muted-foreground">
              No additional categories. Create one to further organize your programs.
            </div>
          )}
          {categories.length === 0 && searchTerm && (
            <div className="col-span-full text-center py-12 text-muted-foreground">
              No categories match your search.
            </div>
          )}
        </div>
      )}

      {/* Create/Edit Sheet */}
      <Sheet open={formOpen} onOpenChange={setFormOpen}>
        <SheetContent className="sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editingCategory ? "Edit Category" : "New Category"}</SheetTitle>
            <SheetDescription>
              {editingCategory
                ? `Update details for "${editingCategory.name}".`
                : "Create a new category to group programs, events, and competitions."}
            </SheetDescription>
          </SheetHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="category-name">Name</Label>
              <Input
                id="category-name"
                value={formData.name}
                onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="e.g. Recreational Programs"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="category-description">Description</Label>
              <Textarea
                id="category-description"
                value={formData.description}
                onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="A short description of what this category includes..."
                rows={3}
              />
            </div>

            <ImageUpload
              label="Category Image"
              value={formData.imageUrl}
              onChange={(url) => setFormData((prev) => ({ ...prev, imageUrl: url }))}
              type="category"
            />
          </div>

          <SheetFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingCategory ? "Save Changes" : "Create Category"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Reorder Dialog */}
      <Dialog open={isReorderDialogOpen} onOpenChange={setIsReorderDialogOpen}>
        <DialogContent className="max-w-2xl overflow-hidden">
          <DialogHeader>
            <DialogTitle>Reorder Categories</DialogTitle>
            <DialogDescription>
              Drag and drop to set the display order on your marketing site.
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
                items={reorderCategories.map((c) => c.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="flex flex-col gap-2">
                  {reorderCategories.map((category) => (
                    <SortableCategoryItem key={category.id} category={category} />
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
