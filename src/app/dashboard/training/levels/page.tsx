"use client"

import { useState, useEffect, useCallback } from "react"
import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import { restrictToVerticalAxis, restrictToParentElement } from "@dnd-kit/modifiers"
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { 
  Plus, 
  Search, 
  Loader2,
  Pencil,
  Trash2,
  GripVertical,
} from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { toast } from "sonner"
import { api } from "@/lib/api-client"
import { ColorSelector } from "@/components/color-selector"

interface Level {
  id: string
  name: string
  description: string | null
  order: number
  color: string | null
  isDefault: boolean
  createdAt: string
  updatedAt: string
}

interface LevelFormData {
  name: string
  description: string
  color: string
  isDefault: boolean
}

const initialFormData: LevelFormData = {
  name: "",
  description: "",
  color: "#3b82f6", // Default blue
  isDefault: false,
}


function SortableLevelRow({
  level,
  onEdit,
  onDelete,
}: {
  level: Level
  onEdit: (level: Level) => void
  onDelete: (level: Level) => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: level.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <TableRow
      ref={setNodeRef}
      style={style}
      className={isDragging ? "opacity-50" : ""}
    >
      <TableCell>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="cursor-grab touch-none text-muted-foreground hover:text-foreground"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-4 w-4" />
          </button>
          <div
            className="w-4 h-4 rounded-full"
            style={{ backgroundColor: level.color || "#64748b" }}
          />
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <span className="font-medium">{level.name}</span>
          {level.isDefault && (
            <Badge variant="secondary" className="text-xs">Default</Badge>
          )}
        </div>
      </TableCell>
      <TableCell className="text-muted-foreground max-w-xs truncate">
        {level.description || "—"}
      </TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onEdit(level)}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onDelete(level)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  )
}

export default function LevelsPage() {
  const [levels, setLevels] = useState<Level[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const [editingLevel, setEditingLevel] = useState<Level | null>(null)
  const [formData, setFormData] = useState<LevelFormData>(initialFormData)
  const [isSaving, setIsSaving] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [levelToDelete, setLevelToDelete] = useState<Level | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isSavingOrder, setIsSavingOrder] = useState(false)

  const sensors = useSensors(
    useSensor(MouseSensor, {}),
    useSensor(TouchSensor, {}),
    useSensor(KeyboardSensor, {})
  )

  const fetchLevels = useCallback(async () => {
    try {
      const data = await api.get<Level[]>("/api/levels", { search: searchQuery })
      setLevels(data)
    } catch (error) {
      console.error("Error fetching levels:", error)
      toast.error("Failed to load levels")
    } finally {
      setIsLoading(false)
    }
  }, [searchQuery])

  useEffect(() => {
    fetchLevels()
  }, [fetchLevels])

  const handleOpenSheet = (level?: Level) => {
    if (level) {
      setEditingLevel(level)
      setFormData({
        name: level.name,
        description: level.description || "",
        color: level.color || "#3b82f6",
        isDefault: level.isDefault,
      })
    } else {
      setEditingLevel(null)
      setFormData(initialFormData)
    }
    setIsSheetOpen(true)
  }

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error("Name is required")
      return
    }

    setIsSaving(true)
    try {
      if (editingLevel) {
        await api.put(`/api/levels/${editingLevel.id}`, formData)
        toast.success("Level updated successfully")
      } else {
        await api.post("/api/levels", formData)
        toast.success("Level created successfully")
      }
      setIsSheetOpen(false)
      fetchLevels()
    } catch (error) {
      console.error("Error saving level:", error)
      toast.error(editingLevel ? "Failed to update level" : "Failed to create level")
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!levelToDelete) return

    setIsDeleting(true)
    try {
      await api.delete(`/api/levels/${levelToDelete.id}`)
      toast.success("Level deleted successfully")
      setDeleteDialogOpen(false)
      setLevelToDelete(null)
      fetchLevels()
    } catch (error: any) {
      console.error("Error deleting level:", error)
      const message = error?.error || "Failed to delete level"
      toast.error(message)
    } finally {
      setIsDeleting(false)
    }
  }

  const openDeleteDialog = (level: Level) => {
    setLevelToDelete(level)
    setDeleteDialogOpen(true)
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = levels.findIndex((l) => l.id === active.id)
    const newIndex = levels.findIndex((l) => l.id === over.id)
    const reordered = arrayMove(levels, oldIndex, newIndex)
    setLevels(reordered)

    setIsSavingOrder(true)
    try {
      const updates = reordered.map((level, index) => ({
        id: level.id,
        order: index,
      }))
      await api.post("/api/levels/reorder", { levels: updates })
      toast.success("Level order updated")
    } catch (error) {
      console.error("Error saving level order:", error)
      toast.error("Failed to save level order")
      fetchLevels()
    } finally {
      setIsSavingOrder(false)
    }
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Levels</h1>
          <p className="text-muted-foreground">
            Define skill and program levels for your organization
          </p>
        </div>
        <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
          <SheetTrigger asChild>
            <Button onClick={() => handleOpenSheet()}>
              <Plus className="h-4 w-4 mr-2" />
              Add Level
            </Button>
          </SheetTrigger>
          <SheetContent className="sm:max-w-md">
            <SheetHeader>
              <SheetTitle>{editingLevel ? "Edit Level" : "Create Level"}</SheetTitle>
              <SheetDescription>
                {editingLevel 
                  ? "Update the level details below." 
                  : "Add a new level for programs and skills."}
              </SheetDescription>
            </SheetHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  placeholder="e.g., Bronze, Level 1, Beginner"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Optional description for this level"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                />
              </div>
              <ColorSelector
                value={formData.color}
                onChange={(color) => setFormData({ ...formData, color })}
              />
              <div className="flex items-center space-x-2">
                <Switch
                  id="isDefault"
                  checked={formData.isDefault}
                  onCheckedChange={(checked) => setFormData({ ...formData, isDefault: checked })}
                />
                <Label htmlFor="isDefault">Set as default level</Label>
              </div>
            </div>
            <SheetFooter>
              <Button
                onClick={handleSave}
                disabled={isSaving || !formData.name.trim()}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : editingLevel ? (
                  "Save Changes"
                ) : (
                  "Create Level"
                )}
              </Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Levels</CardTitle>
          <CardDescription>
            Levels are sorted from lowest to highest. Drag to reorder.
            {isSavingOrder && (
              <span className="ml-2 inline-flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" />
                Saving...
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search levels..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : levels.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">
                {searchQuery ? "No levels found matching your search." : "No levels created yet."}
              </p>
              {!searchQuery && (
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => handleOpenSheet()}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create your first level
                </Button>
              )}
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              modifiers={[restrictToVerticalAxis, restrictToParentElement]}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={levels.map((l) => l.id)}
                strategy={verticalListSortingStrategy}
              >
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12"></TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {levels.map((level) => (
                      <SortableLevelRow
                        key={level.id}
                        level={level}
                        onEdit={handleOpenSheet}
                        onDelete={openDeleteDialog}
                      />
                    ))}
                  </TableBody>
                </Table>
              </SortableContext>
            </DndContext>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Level</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{levelToDelete?.name}&quot;? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
