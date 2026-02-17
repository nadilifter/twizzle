"use client"

import * as React from "react"
import {
  Plus,
  Pencil,
  Trash2,
  MoreHorizontal,
  Loader2,
  Layers,
  Grid3x3,
  List,
  X,
} from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
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
import { Separator } from "@/components/ui/separator"
import { CombinationGrid } from "@/components/combination-grid"
import { cn } from "@/lib/utils"

// ============================================
// Types
// ============================================

interface Sport {
  id: string
  name: string
  slug: string
  isActive: boolean
}

interface AxisValue {
  id?: string
  name: string
  axis: "ROW" | "COLUMN"
  displayOrder: number
  minAge?: number | null
  maxAge?: number | null
  allowedGenders?: string[]
}

interface CombinationEntry {
  id?: string
  rowValueId: string
  colValueId: string
  isActive: boolean
  name?: string | null
}

interface IndividualEntry {
  id?: string
  name: string
  description?: string | null
  displayOrder: number
  hasGenderRestriction: boolean
  hasAgeRestriction: boolean
  hasCapacityRestriction: boolean
  allowedGenders?: string[]
  minAge?: number | null
  maxAge?: number | null
  capacity?: number | null
}

interface Template {
  id: string
  sportId: string | null
  name: string
  description: string | null
  type: "COMBINATION" | "INDIVIDUAL"
  isActive: boolean
  displayOrder: number
  rowAxisLabel: string | null
  columnAxisLabel: string | null
  restrictionAxis: "ROW" | "COLUMN" | null
  sport: { id: string; name: string; slug: string } | null
  axisValues: (AxisValue & { id: string })[]
  combinationEntries: (CombinationEntry & { id: string })[]
  individualEntries: (IndividualEntry & { id: string })[]
}

interface TemplateFormData {
  name: string
  description: string
  type: "COMBINATION" | "INDIVIDUAL"
  isActive: boolean
  displayOrder: number
  rowAxisLabel: string
  columnAxisLabel: string
  restrictionAxis: "ROW" | "COLUMN"
  axisValues: AxisValue[]
  disabledCombinations: Set<string>
  individualEntries: IndividualEntry[]
}

const initialFormData: TemplateFormData = {
  name: "",
  description: "",
  type: "COMBINATION",
  isActive: true,
  displayOrder: 0,
  rowAxisLabel: "",
  columnAxisLabel: "",
  restrictionAxis: "ROW",
  axisValues: [],
  disabledCombinations: new Set(),
  individualEntries: [],
}

// ============================================
// Component
// ============================================

export default function SuperadminCompetitionCategoriesPage() {
  const [sports, setSports] = React.useState<Sport[]>([])
  const [selectedSportId, setSelectedSportId] = React.useState<string>("")
  const [templates, setTemplates] = React.useState<Template[]>([])
  const [loading, setLoading] = React.useState(true)
  const [loadingTemplates, setLoadingTemplates] = React.useState(false)
  const [saving, setSaving] = React.useState(false)

  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editingTemplate, setEditingTemplate] = React.useState<Template | null>(null)
  const [formData, setFormData] = React.useState<TemplateFormData>(initialFormData)

  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false)
  const [deletingTemplate, setDeletingTemplate] = React.useState<Template | null>(null)

  // New value inputs
  const [newRowValue, setNewRowValue] = React.useState("")
  const [newColValue, setNewColValue] = React.useState("")
  const [newIndividualName, setNewIndividualName] = React.useState("")

  // Fetch sports
  React.useEffect(() => {
    const fetchSports = async () => {
      try {
        const response = await fetch("/api/superadmin/sports")
        if (!response.ok) throw new Error("Failed to fetch sports")
        const data = await response.json()
        setSports(data.filter((s: Sport) => s.isActive))
      } catch (error) {
        toast.error("Failed to load sports")
      } finally {
        setLoading(false)
      }
    }
    fetchSports()
  }, [])

  // Fetch templates when sport is selected
  const fetchTemplates = React.useCallback(async (sportId: string) => {
    if (!sportId) return
    setLoadingTemplates(true)
    try {
      const response = await fetch(`/api/superadmin/competition-categories?sportId=${sportId}`)
      if (!response.ok) throw new Error("Failed to fetch templates")
      const data = await response.json()
      setTemplates(data)
    } catch (error) {
      toast.error("Failed to load templates")
    } finally {
      setLoadingTemplates(false)
    }
  }, [])

  React.useEffect(() => {
    if (selectedSportId) {
      fetchTemplates(selectedSportId)
    } else {
      setTemplates([])
    }
  }, [selectedSportId, fetchTemplates])

  // Handlers
  const handleOpenCreate = () => {
    setEditingTemplate(null)
    setFormData({
      ...initialFormData,
      displayOrder: templates.length,
    })
    setNewRowValue("")
    setNewColValue("")
    setNewIndividualName("")
    setDialogOpen(true)
  }

  const handleOpenEdit = (template: Template) => {
    setEditingTemplate(template)

    const disabledSet = new Set<string>()
    for (const entry of template.combinationEntries) {
      if (!entry.isActive) {
        disabledSet.add(`${entry.rowValueId}:${entry.colValueId}`)
      }
    }

    setFormData({
      name: template.name,
      description: template.description || "",
      type: template.type,
      isActive: template.isActive,
      displayOrder: template.displayOrder,
      rowAxisLabel: template.rowAxisLabel || "",
      columnAxisLabel: template.columnAxisLabel || "",
      restrictionAxis: template.restrictionAxis || "ROW",
      axisValues: template.axisValues.map((v) => ({
        id: v.id,
        name: v.name,
        axis: v.axis,
        displayOrder: v.displayOrder,
        minAge: v.minAge,
        maxAge: v.maxAge,
        allowedGenders: v.allowedGenders || [],
      })),
      disabledCombinations: disabledSet,
      individualEntries: template.individualEntries.map((e) => ({
        id: e.id,
        name: e.name,
        description: e.description,
        displayOrder: e.displayOrder,
        hasGenderRestriction: e.hasGenderRestriction,
        hasAgeRestriction: e.hasAgeRestriction,
        hasCapacityRestriction: e.hasCapacityRestriction,
        allowedGenders: e.allowedGenders || [],
        minAge: e.minAge,
        maxAge: e.maxAge,
        capacity: e.capacity,
      })),
    })
    setNewRowValue("")
    setNewColValue("")
    setNewIndividualName("")
    setDialogOpen(true)
  }

  const handleAddRowValue = () => {
    if (!newRowValue.trim()) return
    const rows = formData.axisValues.filter((v) => v.axis === "ROW")
    setFormData((prev) => ({
      ...prev,
      axisValues: [
        ...prev.axisValues,
        {
          name: newRowValue.trim(),
          axis: "ROW",
          displayOrder: rows.length,
          minAge: null,
          maxAge: null,
          allowedGenders: [],
        },
      ],
    }))
    setNewRowValue("")
  }

  const handleAddColValue = () => {
    if (!newColValue.trim()) return
    const cols = formData.axisValues.filter((v) => v.axis === "COLUMN")
    setFormData((prev) => ({
      ...prev,
      axisValues: [
        ...prev.axisValues,
        {
          name: newColValue.trim(),
          axis: "COLUMN",
          displayOrder: cols.length,
          minAge: null,
          maxAge: null,
          allowedGenders: [],
        },
      ],
    }))
    setNewColValue("")
  }

  const handleRemoveAxisValue = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      axisValues: prev.axisValues.filter((_, i) => i !== index),
    }))
  }

  const handleUpdateAxisRestriction = (
    index: number,
    field: "minAge" | "maxAge",
    value: string
  ) => {
    setFormData((prev) => ({
      ...prev,
      axisValues: prev.axisValues.map((v, i) =>
        i === index ? { ...v, [field]: value ? parseInt(value, 10) : null } : v
      ),
    }))
  }

  const handleAddIndividualEntry = () => {
    if (!newIndividualName.trim()) return
    setFormData((prev) => ({
      ...prev,
      individualEntries: [
        ...prev.individualEntries,
        {
          name: newIndividualName.trim(),
          description: null,
          displayOrder: prev.individualEntries.length,
          hasGenderRestriction: false,
          hasAgeRestriction: false,
          hasCapacityRestriction: false,
          allowedGenders: [],
          minAge: null,
          maxAge: null,
          capacity: null,
        },
      ],
    }))
    setNewIndividualName("")
  }

  const handleRemoveIndividualEntry = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      individualEntries: prev.individualEntries.filter((_, i) => i !== index),
    }))
  }

  const handleToggleCombination = (rowId: string, colId: string, isActive: boolean) => {
    setFormData((prev) => {
      const key = `${rowId}:${colId}`
      const newSet = new Set(prev.disabledCombinations)
      if (isActive) {
        newSet.delete(key)
      } else {
        newSet.add(key)
      }
      return { ...prev, disabledCombinations: newSet }
    })
  }

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error("Name is required")
      return
    }

    if (formData.type === "COMBINATION") {
      const rows = formData.axisValues.filter((v) => v.axis === "ROW")
      const cols = formData.axisValues.filter((v) => v.axis === "COLUMN")
      if (rows.length === 0) {
        toast.error("Add at least one row value")
        return
      }
      if (cols.length === 0) {
        toast.error("Add at least one column value")
        return
      }
    }

    if (formData.type === "INDIVIDUAL" && formData.individualEntries.length === 0) {
      toast.error("Add at least one entry")
      return
    }

    setSaving(true)
    try {
      if (editingTemplate) {
        // Build combination updates for edit
        const combinationUpdates: Array<{ rowValueId: string; colValueId: string; isActive: boolean }> = []
        if (formData.type === "COMBINATION") {
          const rows = formData.axisValues.filter((v) => v.axis === "ROW")
          const cols = formData.axisValues.filter((v) => v.axis === "COLUMN")
          for (const row of rows) {
            for (const col of cols) {
              if (row.id && col.id) {
                const key = `${row.id}:${col.id}`
                combinationUpdates.push({
                  rowValueId: row.id,
                  colValueId: col.id,
                  isActive: !formData.disabledCombinations.has(key),
                })
              }
            }
          }
        }

        const response = await fetch(`/api/superadmin/competition-categories/${editingTemplate.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formData.name,
            description: formData.description || null,
            isActive: formData.isActive,
            displayOrder: formData.displayOrder,
            rowAxisLabel: formData.rowAxisLabel || null,
            columnAxisLabel: formData.columnAxisLabel || null,
            restrictionAxis: formData.type === "COMBINATION" ? formData.restrictionAxis : null,
            axisValues: formData.type === "COMBINATION" ? formData.axisValues : undefined,
            combinationUpdates: formData.type === "COMBINATION" ? combinationUpdates : undefined,
            individualEntries: formData.type === "INDIVIDUAL" ? formData.individualEntries : undefined,
          }),
        })

        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || "Failed to update template")
        }

        toast.success("Template updated")
      } else {
        // Build disabled combinations for create
        const rows = formData.axisValues.filter((v) => v.axis === "ROW")
        const cols = formData.axisValues.filter((v) => v.axis === "COLUMN")

        const disabledCombinations: Array<{
          rowValueIndex: number
          colValueIndex: number
          isActive: boolean
        }> = []

        for (let ri = 0; ri < rows.length; ri++) {
          for (let ci = 0; ci < cols.length; ci++) {
            // For new templates, we use temp IDs based on names
            const key = `temp-row-${ri}:temp-col-${ci}`
            if (formData.disabledCombinations.has(key)) {
              disabledCombinations.push({
                rowValueIndex: ri,
                colValueIndex: ci,
                isActive: false,
              })
            }
          }
        }

        const response = await fetch("/api/superadmin/competition-categories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sportId: selectedSportId,
            name: formData.name,
            description: formData.description || null,
            type: formData.type,
            isActive: formData.isActive,
            displayOrder: formData.displayOrder,
            rowAxisLabel: formData.type === "COMBINATION" ? (formData.rowAxisLabel || null) : null,
            columnAxisLabel: formData.type === "COMBINATION" ? (formData.columnAxisLabel || null) : null,
            restrictionAxis: formData.type === "COMBINATION" ? formData.restrictionAxis : null,
            axisValues: formData.type === "COMBINATION" ? formData.axisValues : [],
            disabledCombinations,
            individualEntries: formData.type === "INDIVIDUAL" ? formData.individualEntries : [],
          }),
        })

        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || "Failed to create template")
        }

        toast.success("Template created")
      }

      setDialogOpen(false)
      fetchTemplates(selectedSportId)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save template")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deletingTemplate) return

    try {
      const response = await fetch(`/api/superadmin/competition-categories/${deletingTemplate.id}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to delete template")
      }

      toast.success("Template deleted")
      setDeleteDialogOpen(false)
      setDeletingTemplate(null)
      fetchTemplates(selectedSportId)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete template")
    }
  }

  // Compute grid data for the form
  const formRows = formData.axisValues
    .map((v, i) => ({ ...v, _index: i }))
    .filter((v) => v.axis === "ROW")
  const formCols = formData.axisValues
    .map((v, i) => ({ ...v, _index: i }))
    .filter((v) => v.axis === "COLUMN")

  const gridRows = formRows.map((r) => ({
    id: r.id || `temp-row-${formRows.indexOf(r)}`,
    name: r.name,
    restrictions: formData.restrictionAxis === "ROW"
      ? { minAge: r.minAge, maxAge: r.maxAge, allowedGenders: r.allowedGenders }
      : undefined,
  }))

  const gridCols = formCols.map((c) => ({
    id: c.id || `temp-col-${formCols.indexOf(c)}`,
    name: c.name,
    restrictions: formData.restrictionAxis === "COLUMN"
      ? { minAge: c.minAge, maxAge: c.maxAge, allowedGenders: c.allowedGenders }
      : undefined,
  }))

  const gridEntries = gridRows.flatMap((r) =>
    gridCols.map((c) => ({
      rowId: r.id,
      colId: c.id,
      isActive: !formData.disabledCombinations.has(`${r.id}:${c.id}`),
    }))
  )

  // Stats
  const combinationCount = templates.filter((t) => t.type === "COMBINATION").length
  const individualCount = templates.filter((t) => t.type === "INDIVIDUAL").length

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Competition Categories</h1>
          <p className="text-muted-foreground">
            Configure category templates for each sport. Organizations will use these as presets.
          </p>
        </div>
      </div>

      {/* Sport Selector */}
      <div className="flex items-center gap-4">
        <div className="w-[300px]">
          <Select value={selectedSportId} onValueChange={setSelectedSportId}>
            <SelectTrigger>
              <SelectValue placeholder="Select a sport to configure..." />
            </SelectTrigger>
            <SelectContent>
              {sports.map((sport) => (
                <SelectItem key={sport.id} value={sport.id}>
                  {sport.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {selectedSportId && (
          <Button onClick={handleOpenCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Add Template
          </Button>
        )}
      </div>

      {!selectedSportId && (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              <Layers className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p className="font-medium">Select a Sport</p>
              <p className="text-sm mt-1">Choose a sport above to view and configure its category templates.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {selectedSportId && (
        <>
          {/* Stats */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Templates</CardTitle>
                <Layers className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{templates.length}</div>
                <p className="text-xs text-muted-foreground">
                  {templates.filter((t) => t.isActive).length} active
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Combination</CardTitle>
                <Grid3x3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{combinationCount}</div>
                <p className="text-xs text-muted-foreground">Grid-based templates</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Individual</CardTitle>
                <List className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{individualCount}</div>
                <p className="text-xs text-muted-foreground">Standalone entries</p>
              </CardContent>
            </Card>
          </div>

          {/* Templates Table */}
          <Card>
            <CardHeader>
              <CardTitle>Category Templates</CardTitle>
              <CardDescription>
                {templates.length} template{templates.length !== 1 ? "s" : ""} for{" "}
                {sports.find((s) => s.id === selectedSportId)?.name || "this sport"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingTemplates ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-center">Entries</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                      <TableHead className="w-[70px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {templates.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                          No templates configured yet. Add your first template to get started.
                        </TableCell>
                      </TableRow>
                    ) : (
                      templates.map((template) => {
                        const entryCount =
                          template.type === "COMBINATION"
                            ? template.combinationEntries.filter((e) => e.isActive).length
                            : template.individualEntries.length
                        const totalCount =
                          template.type === "COMBINATION"
                            ? template.combinationEntries.length
                            : template.individualEntries.length

                        return (
                          <TableRow key={template.id}>
                            <TableCell>
                              <div>
                                <span className="font-medium">{template.name}</span>
                                {template.description && (
                                  <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[250px]">
                                    {template.description}
                                  </p>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant={template.type === "COMBINATION" ? "default" : "secondary"}>
                                {template.type === "COMBINATION" ? (
                                  <><Grid3x3 className="mr-1 h-3 w-3" /> Combination</>
                                ) : (
                                  <><List className="mr-1 h-3 w-3" /> Individual</>
                                )}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              {template.type === "COMBINATION" ? (
                                <span className="text-sm">
                                  {entryCount}/{totalCount}
                                </span>
                              ) : (
                                <span className="text-sm">{entryCount}</span>
                              )}
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge variant={template.isActive ? "default" : "secondary"}>
                                {template.isActive ? "Active" : "Inactive"}
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
                                  <DropdownMenuItem onClick={() => handleOpenEdit(template)}>
                                    <Pencil className="mr-2 h-4 w-4" />
                                    Edit
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    className="text-destructive"
                                    onClick={() => {
                                      setDeletingTemplate(template)
                                      setDeleteDialogOpen(true)
                                    }}
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        )
                      })
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? "Edit Template" : "Add Category Template"}
            </DialogTitle>
            <DialogDescription>
              {editingTemplate
                ? "Update the category template details."
                : "Create a new category template for this sport."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-6 py-4">
            {/* Basic Info */}
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label htmlFor="template-name">Name</Label>
                <Input
                  id="template-name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, name: e.target.value }))
                  }
                  placeholder="e.g., Age Group x Apparatus"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="template-description">Description</Label>
                <Textarea
                  id="template-description"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, description: e.target.value }))
                  }
                  placeholder="Brief description of this template"
                  rows={2}
                />
              </div>
            </div>

            {/* Type Selection (only for new) */}
            {!editingTemplate && (
              <div className="space-y-3">
                <Label className="text-base font-medium">Template Type</Label>
                <RadioGroup
                  value={formData.type}
                  onValueChange={(value: "COMBINATION" | "INDIVIDUAL") =>
                    setFormData((prev) => ({ ...prev, type: value }))
                  }
                  className="grid grid-cols-2 gap-4"
                >
                  <label
                    className={cn(
                      "flex items-start gap-3 rounded-lg border p-4 cursor-pointer transition-colors",
                      formData.type === "COMBINATION"
                        ? "border-primary bg-primary/5"
                        : "hover:bg-muted/50"
                    )}
                  >
                    <RadioGroupItem value="COMBINATION" className="mt-0.5" />
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <Grid3x3 className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">Combination</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Create a grid from two dimensions (e.g., Age x Discipline)
                      </p>
                    </div>
                  </label>
                  <label
                    className={cn(
                      "flex items-start gap-3 rounded-lg border p-4 cursor-pointer transition-colors",
                      formData.type === "INDIVIDUAL"
                        ? "border-primary bg-primary/5"
                        : "hover:bg-muted/50"
                    )}
                  >
                    <RadioGroupItem value="INDIVIDUAL" className="mt-0.5" />
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <List className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">Individual</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Standalone category entries with their own restrictions
                      </p>
                    </div>
                  </label>
                </RadioGroup>
              </div>
            )}

            <Separator />

            {/* COMBINATION Configuration */}
            {formData.type === "COMBINATION" && (
              <div className="space-y-6">
                {/* Axis Labels */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="row-axis-label">Row Axis Label</Label>
                    <Input
                      id="row-axis-label"
                      value={formData.rowAxisLabel}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, rowAxisLabel: e.target.value }))
                      }
                      placeholder="e.g., Age Group"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="col-axis-label">Column Axis Label</Label>
                    <Input
                      id="col-axis-label"
                      value={formData.columnAxisLabel}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, columnAxisLabel: e.target.value }))
                      }
                      placeholder="e.g., Discipline"
                    />
                  </div>
                </div>

                {/* Restriction Axis */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Restriction Controlled By</Label>
                  <RadioGroup
                    value={formData.restrictionAxis}
                    onValueChange={(value: "ROW" | "COLUMN") =>
                      setFormData((prev) => ({ ...prev, restrictionAxis: value }))
                    }
                    className="flex gap-4"
                  >
                    <label className="flex items-center gap-2 cursor-pointer">
                      <RadioGroupItem value="ROW" />
                      <span className="text-sm">{formData.rowAxisLabel || "Row"} values</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <RadioGroupItem value="COLUMN" />
                      <span className="text-sm">{formData.columnAxisLabel || "Column"} values</span>
                    </label>
                  </RadioGroup>
                  <p className="text-xs text-muted-foreground">
                    Restrictions (age, gender) will be set on each value of the selected axis and inherited by all combinations in that row/column.
                  </p>
                </div>

                {/* Row Values */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium">
                    {formData.rowAxisLabel || "Row"} Values
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      value={newRowValue}
                      onChange={(e) => setNewRowValue(e.target.value)}
                      placeholder={`Add ${formData.rowAxisLabel || "row"} value...`}
                      onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddRowValue())}
                    />
                    <Button type="button" size="sm" onClick={handleAddRowValue} disabled={!newRowValue.trim()}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  {formRows.length > 0 && (
                    <div className="space-y-2">
                      {formRows.map((row) => (
                        <div
                          key={row._index}
                          className="flex items-center gap-2 rounded-lg border p-2"
                        >
                          <Badge variant="secondary" className="text-xs">
                            {row.name}
                          </Badge>
                          {formData.restrictionAxis === "ROW" && (
                            <div className="flex items-center gap-2 ml-auto">
                              <Input
                                type="number"
                                min={0}
                                max={100}
                                placeholder="Min age"
                                className="w-20 h-7 text-xs"
                                value={row.minAge ?? ""}
                                onChange={(e) =>
                                  handleUpdateAxisRestriction(row._index, "minAge", e.target.value)
                                }
                              />
                              <span className="text-xs text-muted-foreground">-</span>
                              <Input
                                type="number"
                                min={0}
                                max={100}
                                placeholder="Max age"
                                className="w-20 h-7 text-xs"
                                value={row.maxAge ?? ""}
                                onChange={(e) =>
                                  handleUpdateAxisRestriction(row._index, "maxAge", e.target.value)
                                }
                              />
                            </div>
                          )}
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 ml-auto shrink-0"
                            onClick={() => handleRemoveAxisValue(row._index)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Column Values */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium">
                    {formData.columnAxisLabel || "Column"} Values
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      value={newColValue}
                      onChange={(e) => setNewColValue(e.target.value)}
                      placeholder={`Add ${formData.columnAxisLabel || "column"} value...`}
                      onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddColValue())}
                    />
                    <Button type="button" size="sm" onClick={handleAddColValue} disabled={!newColValue.trim()}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  {formCols.length > 0 && (
                    <div className="space-y-2">
                      {formCols.map((col) => (
                        <div
                          key={col._index}
                          className="flex items-center gap-2 rounded-lg border p-2"
                        >
                          <Badge variant="outline" className="text-xs">
                            {col.name}
                          </Badge>
                          {formData.restrictionAxis === "COLUMN" && (
                            <div className="flex items-center gap-2 ml-auto">
                              <Input
                                type="number"
                                min={0}
                                max={100}
                                placeholder="Min age"
                                className="w-20 h-7 text-xs"
                                value={col.minAge ?? ""}
                                onChange={(e) =>
                                  handleUpdateAxisRestriction(col._index, "minAge", e.target.value)
                                }
                              />
                              <span className="text-xs text-muted-foreground">-</span>
                              <Input
                                type="number"
                                min={0}
                                max={100}
                                placeholder="Max age"
                                className="w-20 h-7 text-xs"
                                value={col.maxAge ?? ""}
                                onChange={(e) =>
                                  handleUpdateAxisRestriction(col._index, "maxAge", e.target.value)
                                }
                              />
                            </div>
                          )}
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 ml-auto shrink-0"
                            onClick={() => handleRemoveAxisValue(col._index)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Combination Grid Preview */}
                {formRows.length > 0 && formCols.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Combination Grid</Label>
                    <p className="text-xs text-muted-foreground">
                      Uncheck combinations that should not be available.
                    </p>
                    <CombinationGrid
                      rows={gridRows}
                      columns={gridCols}
                      entries={gridEntries}
                      rowAxisLabel={formData.rowAxisLabel}
                      columnAxisLabel={formData.columnAxisLabel}
                      onToggleEntry={handleToggleCombination}
                    />
                  </div>
                )}
              </div>
            )}

            {/* INDIVIDUAL Configuration */}
            {formData.type === "INDIVIDUAL" && (
              <div className="space-y-4">
                <Label className="text-sm font-medium">Category Entries</Label>
                <div className="flex gap-2">
                  <Input
                    value={newIndividualName}
                    onChange={(e) => setNewIndividualName(e.target.value)}
                    placeholder="Add entry name..."
                    onKeyDown={(e) =>
                      e.key === "Enter" && (e.preventDefault(), handleAddIndividualEntry())
                    }
                  />
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleAddIndividualEntry}
                    disabled={!newIndividualName.trim()}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {formData.individualEntries.length > 0 && (
                  <div className="space-y-2">
                    {formData.individualEntries.map((entry, index) => (
                      <div
                        key={index}
                        className="flex items-start gap-3 rounded-lg border p-3"
                      >
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{entry.name}</span>
                          </div>
                          <div className="flex flex-wrap gap-3">
                            <label className="flex items-center gap-1.5 text-xs">
                              <Switch
                                className="scale-75"
                                checked={entry.hasAgeRestriction}
                                onCheckedChange={(checked) =>
                                  setFormData((prev) => ({
                                    ...prev,
                                    individualEntries: prev.individualEntries.map((e, i) =>
                                      i === index
                                        ? { ...e, hasAgeRestriction: checked, minAge: checked ? e.minAge : null, maxAge: checked ? e.maxAge : null }
                                        : e
                                    ),
                                  }))
                                }
                              />
                              Age
                            </label>
                            {entry.hasAgeRestriction && (
                              <div className="flex items-center gap-1">
                                <Input
                                  type="number"
                                  min={0}
                                  className="w-16 h-6 text-xs"
                                  placeholder="Min"
                                  value={entry.minAge ?? ""}
                                  onChange={(e) =>
                                    setFormData((prev) => ({
                                      ...prev,
                                      individualEntries: prev.individualEntries.map((ent, i) =>
                                        i === index
                                          ? { ...ent, minAge: e.target.value ? parseInt(e.target.value) : null }
                                          : ent
                                      ),
                                    }))
                                  }
                                />
                                <span className="text-xs">-</span>
                                <Input
                                  type="number"
                                  min={0}
                                  className="w-16 h-6 text-xs"
                                  placeholder="Max"
                                  value={entry.maxAge ?? ""}
                                  onChange={(e) =>
                                    setFormData((prev) => ({
                                      ...prev,
                                      individualEntries: prev.individualEntries.map((ent, i) =>
                                        i === index
                                          ? { ...ent, maxAge: e.target.value ? parseInt(e.target.value) : null }
                                          : ent
                                      ),
                                    }))
                                  }
                                />
                              </div>
                            )}
                            <label className="flex items-center gap-1.5 text-xs">
                              <Switch
                                className="scale-75"
                                checked={entry.hasCapacityRestriction}
                                onCheckedChange={(checked) =>
                                  setFormData((prev) => ({
                                    ...prev,
                                    individualEntries: prev.individualEntries.map((e, i) =>
                                      i === index
                                        ? { ...e, hasCapacityRestriction: checked, capacity: checked ? e.capacity : null }
                                        : e
                                    ),
                                  }))
                                }
                              />
                              Capacity
                            </label>
                            {entry.hasCapacityRestriction && (
                              <Input
                                type="number"
                                min={1}
                                className="w-20 h-6 text-xs"
                                placeholder="Max"
                                value={entry.capacity ?? ""}
                                onChange={(e) =>
                                  setFormData((prev) => ({
                                    ...prev,
                                    individualEntries: prev.individualEntries.map((ent, i) =>
                                      i === index
                                        ? { ...ent, capacity: e.target.value ? parseInt(e.target.value) : null }
                                        : ent
                                    ),
                                  }))
                                }
                              />
                            )}
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0"
                          onClick={() => handleRemoveIndividualEntry(index)}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Active Toggle */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Active</Label>
                <p className="text-xs text-muted-foreground">
                  Inactive templates are hidden from organizations
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
              {editingTemplate ? "Save Changes" : "Create Template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deletingTemplate?.name}&quot;? This
              action cannot be undone. Organizations currently referencing this template will
              lose access to it.
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
    </div>
  )
}
