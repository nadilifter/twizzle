"use client";

import * as React from "react";
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
  ChevronDown,
  ChevronUp,
  Info,
  Check,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardPageHeader } from "@/components/dashboard-page-header";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
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
import { CombinationGrid } from "@/components/combination-grid";
import { cn } from "@/lib/utils";

// ============================================
// Types
// ============================================

interface AxisValue {
  id?: string;
  name: string;
  axis: "ROW" | "COLUMN";
  displayOrder: number;
  minAge?: number | null;
  maxAge?: number | null;
  allowedGenders?: string[];
  resultType?: "TIME" | "DISTANCE" | "HEIGHT" | "SCORE" | null;
  sortDirection?: "ASC" | "DESC" | null;
}

interface CombinationEntry {
  id?: string;
  rowValueId: string;
  colValueId: string;
  isActive: boolean;
  name?: string | null;
}

interface IndividualEntry {
  id?: string;
  name: string;
  description?: string | null;
  displayOrder: number;
  hasGenderRestriction: boolean;
  hasAgeRestriction: boolean;
  hasCapacityRestriction: boolean;
  allowedGenders?: string[];
  minAge?: number | null;
  maxAge?: number | null;
  capacity?: number | null;
  resultType?: "TIME" | "DISTANCE" | "HEIGHT" | "SCORE" | null;
  sortDirection?: "ASC" | "DESC" | null;
}

interface Template {
  id: string;
  organizationId: string | null;
  name: string;
  description: string | null;
  type: "COMBINATION" | "INDIVIDUAL";
  isActive: boolean;
  displayOrder: number;
  rowAxisLabel: string | null;
  columnAxisLabel: string | null;
  restrictionAxis: "ROW" | "COLUMN" | null;
  axisValues: (AxisValue & { id: string })[];
  combinationEntries: (CombinationEntry & { id: string })[];
  individualEntries: (IndividualEntry & { id: string })[];
  isDisabledByOrg?: boolean;
}

interface FormData {
  name: string;
  description: string;
  type: "COMBINATION" | "INDIVIDUAL";
  isActive: boolean;
  displayOrder: number;
  rowAxisLabel: string;
  columnAxisLabel: string;
  restrictionAxis: "ROW" | "COLUMN";
  axisValues: AxisValue[];
  disabledCombinations: Set<string>;
  individualEntries: IndividualEntry[];
}

const initialFormData: FormData = {
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
};

// ============================================
// Preset Template Card
// ============================================

function PresetTemplateCard({
  template,
  onToggleDisabled,
  togglingId,
}: {
  template: Template;
  onToggleDisabled: (id: string, isDisabled: boolean) => void;
  togglingId: string | null;
}) {
  const [expanded, setExpanded] = React.useState(false);
  const isDisabled = template.isDisabledByOrg ?? false;
  const isToggling = togglingId === template.id;

  const rows = template.axisValues.filter((v) => v.axis === "ROW");
  const cols = template.axisValues.filter((v) => v.axis === "COLUMN");

  const entryCount =
    template.type === "COMBINATION"
      ? template.combinationEntries.filter((e) => e.isActive).length
      : template.individualEntries.length;
  const totalCount =
    template.type === "COMBINATION"
      ? template.combinationEntries.length
      : template.individualEntries.length;

  return (
    <Card className={cn(isDisabled && "opacity-60")}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1 flex-1 min-w-0">
            <CardTitle className="text-base flex items-center gap-2 flex-wrap">
              <span className={cn(isDisabled && "line-through")}>{template.name}</span>
              <Badge
                variant={template.type === "COMBINATION" ? "default" : "secondary"}
                className="text-xs"
              >
                {template.type === "COMBINATION" ? (
                  <>
                    <Grid3x3 className="mr-1 h-3 w-3" /> Combination
                  </>
                ) : (
                  <>
                    <List className="mr-1 h-3 w-3" /> Individual
                  </>
                )}
              </Badge>
              <Badge variant="outline" className="text-xs">
                Preset
              </Badge>
              {isDisabled && (
                <Badge variant="secondary" className="text-xs">
                  Disabled
                </Badge>
              )}
            </CardTitle>
            {template.description && (
              <CardDescription className="text-xs">{template.description}</CardDescription>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-2">
              {isToggling ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : (
                <Switch
                  checked={!isDisabled}
                  onCheckedChange={(checked) => onToggleDisabled(template.id, !checked)}
                  aria-label={isDisabled ? "Enable this preset" : "Disable this preset"}
                />
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {template.type === "COMBINATION" ? (
            <>
              <span>
                {rows.length} {template.rowAxisLabel || "rows"}
              </span>
              <span>&times;</span>
              <span>
                {cols.length} {template.columnAxisLabel || "columns"}
              </span>
              <span>&middot;</span>
              <span>
                {entryCount}/{totalCount} active
              </span>
            </>
          ) : (
            <span>{entryCount} entries</span>
          )}
        </div>
      </CardHeader>
      {expanded && (
        <CardContent className="pt-0">
          <Separator className="mb-4" />
          {template.type === "COMBINATION" ? (
            <CombinationGrid
              rows={rows.map((r) => ({
                id: r.id,
                name: r.name,
                restrictions:
                  template.restrictionAxis === "ROW"
                    ? { minAge: r.minAge, maxAge: r.maxAge, allowedGenders: r.allowedGenders }
                    : undefined,
              }))}
              columns={cols.map((c) => ({
                id: c.id,
                name: c.name,
                restrictions:
                  template.restrictionAxis === "COLUMN"
                    ? { minAge: c.minAge, maxAge: c.maxAge, allowedGenders: c.allowedGenders }
                    : undefined,
              }))}
              entries={template.combinationEntries.map((e) => ({
                rowId: e.rowValueId,
                colId: e.colValueId,
                isActive: e.isActive,
              }))}
              rowAxisLabel={template.rowAxisLabel || undefined}
              columnAxisLabel={template.columnAxisLabel || undefined}
              readOnly
            />
          ) : (
            <div className="space-y-2">
              {template.individualEntries.map((entry) => (
                <div key={entry.id} className="flex items-center gap-2 rounded-lg border p-2">
                  <span className="text-sm font-medium">{entry.name}</span>
                  {entry.resultType && (
                    <Badge variant="secondary" className="text-xs">
                      {entry.resultType}
                    </Badge>
                  )}
                  {entry.hasAgeRestriction && (entry.minAge || entry.maxAge) && (
                    <Badge variant="outline" className="text-xs">
                      {entry.minAge && entry.maxAge
                        ? `Ages ${entry.minAge}-${entry.maxAge}`
                        : entry.minAge
                          ? `Ages ${entry.minAge}+`
                          : `Ages up to ${entry.maxAge}`}
                    </Badge>
                  )}
                  {entry.hasCapacityRestriction && entry.capacity && (
                    <Badge variant="outline" className="text-xs">
                      Cap: {entry.capacity}
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

// ============================================
// Custom Template Card
// ============================================

function CustomTemplateCard({
  template,
  onEdit,
  onDelete,
}: {
  template: Template;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = React.useState(false);

  const rows = template.axisValues.filter((v) => v.axis === "ROW");
  const cols = template.axisValues.filter((v) => v.axis === "COLUMN");

  const entryCount =
    template.type === "COMBINATION"
      ? template.combinationEntries.filter((e) => e.isActive).length
      : template.individualEntries.length;
  const totalCount =
    template.type === "COMBINATION"
      ? template.combinationEntries.length
      : template.individualEntries.length;

  return (
    <Card className={cn(!template.isActive && "opacity-60")}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1 flex-1 min-w-0">
            <CardTitle className="text-base flex items-center gap-2 flex-wrap">
              <span className={cn(!template.isActive && "line-through")}>{template.name}</span>
              <Badge
                variant={template.type === "COMBINATION" ? "default" : "secondary"}
                className="text-xs"
              >
                {template.type === "COMBINATION" ? (
                  <>
                    <Grid3x3 className="mr-1 h-3 w-3" /> Combination
                  </>
                ) : (
                  <>
                    <List className="mr-1 h-3 w-3" /> Individual
                  </>
                )}
              </Badge>
              <Badge variant="outline" className="text-xs bg-primary/5">
                Custom
              </Badge>
              {!template.isActive && (
                <Badge variant="secondary" className="text-xs">
                  Inactive
                </Badge>
              )}
            </CardTitle>
            {template.description && (
              <CardDescription className="text-xs">{template.description}</CardDescription>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onEdit}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem className="text-destructive" onClick={onDelete}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {template.type === "COMBINATION" ? (
            <>
              <span>
                {rows.length} {template.rowAxisLabel || "rows"}
              </span>
              <span>&times;</span>
              <span>
                {cols.length} {template.columnAxisLabel || "columns"}
              </span>
              <span>&middot;</span>
              <span>
                {entryCount}/{totalCount} active
              </span>
            </>
          ) : (
            <span>{entryCount} entries</span>
          )}
        </div>
      </CardHeader>
      {expanded && (
        <CardContent className="pt-0">
          <Separator className="mb-4" />
          {template.type === "COMBINATION" ? (
            <CombinationGrid
              rows={rows.map((r) => ({
                id: r.id,
                name: r.name,
                restrictions:
                  template.restrictionAxis === "ROW"
                    ? { minAge: r.minAge, maxAge: r.maxAge, allowedGenders: r.allowedGenders }
                    : undefined,
              }))}
              columns={cols.map((c) => ({
                id: c.id,
                name: c.name,
                restrictions:
                  template.restrictionAxis === "COLUMN"
                    ? { minAge: c.minAge, maxAge: c.maxAge, allowedGenders: c.allowedGenders }
                    : undefined,
              }))}
              entries={template.combinationEntries.map((e) => ({
                rowId: e.rowValueId,
                colId: e.colValueId,
                isActive: e.isActive,
              }))}
              rowAxisLabel={template.rowAxisLabel || undefined}
              columnAxisLabel={template.columnAxisLabel || undefined}
              readOnly
            />
          ) : (
            <div className="space-y-2">
              {template.individualEntries.map((entry) => (
                <div key={entry.id} className="flex items-center gap-2 rounded-lg border p-2">
                  <span className="text-sm font-medium">{entry.name}</span>
                  {entry.resultType && (
                    <Badge variant="secondary" className="text-xs">
                      {entry.resultType}
                    </Badge>
                  )}
                  {entry.hasAgeRestriction && (entry.minAge || entry.maxAge) && (
                    <Badge variant="outline" className="text-xs">
                      {entry.minAge && entry.maxAge
                        ? `Ages ${entry.minAge}-${entry.maxAge}`
                        : entry.minAge
                          ? `Ages ${entry.minAge}+`
                          : `Ages up to ${entry.maxAge}`}
                    </Badge>
                  )}
                  {entry.hasCapacityRestriction && entry.capacity && (
                    <Badge variant="outline" className="text-xs">
                      Cap: {entry.capacity}
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

// ============================================
// Main Page
// ============================================

export default function CategoriesPage() {
  const [presets, setPresets] = React.useState<Template[]>([]);
  const [custom, setCustom] = React.useState<Template[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [togglingPresetId, setTogglingPresetId] = React.useState<string | null>(null);

  // Dialog state
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingTemplate, setEditingTemplate] = React.useState<Template | null>(null);
  const [formData, setFormData] = React.useState<FormData>(initialFormData);

  // Delete state
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [deletingTemplate, setDeletingTemplate] = React.useState<Template | null>(null);

  // New value inputs
  const [newRowValue, setNewRowValue] = React.useState("");
  const [newColValue, setNewColValue] = React.useState("");
  const [newIndividualName, setNewIndividualName] = React.useState("");

  // Fetch data
  const fetchData = React.useCallback(async () => {
    try {
      const categoriesRes = await fetch("/api/competition-categories");

      if (categoriesRes.ok) {
        const data = await categoriesRes.json();
        setPresets(data.presets || []);
        setCustom(data.custom || []);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load categories");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Toggle preset disabled
  const handleTogglePresetDisabled = async (templateId: string, isDisabled: boolean) => {
    setTogglingPresetId(templateId);
    try {
      const response = await fetch(`/api/competition-categories/${templateId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isDisabled }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to update");
      }

      // Optimistically update local state
      setPresets((prev) =>
        prev.map((p) => (p.id === templateId ? { ...p, isDisabledByOrg: isDisabled } : p))
      );

      toast.success(isDisabled ? "Preset disabled" : "Preset enabled");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update");
    } finally {
      setTogglingPresetId(null);
    }
  };

  // Handlers
  const handleOpenCreate = () => {
    setEditingTemplate(null);
    setFormData({ ...initialFormData, displayOrder: custom.length });
    setNewRowValue("");
    setNewColValue("");
    setNewIndividualName("");
    setDialogOpen(true);
  };

  const handleOpenEdit = (template: Template) => {
    setEditingTemplate(template);
    const disabledSet = new Set<string>();
    for (const entry of template.combinationEntries) {
      if (!entry.isActive) {
        disabledSet.add(`${entry.rowValueId}:${entry.colValueId}`);
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
        resultType: v.resultType || null,
        sortDirection: v.sortDirection || null,
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
        resultType: e.resultType || null,
        sortDirection: e.sortDirection || null,
      })),
    });
    setNewRowValue("");
    setNewColValue("");
    setNewIndividualName("");
    setDialogOpen(true);
  };

  const handleAddRowValue = () => {
    if (!newRowValue.trim()) return;
    const rows = formData.axisValues.filter((v) => v.axis === "ROW");
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
    }));
    setNewRowValue("");
  };

  const handleAddColValue = () => {
    if (!newColValue.trim()) return;
    const cols = formData.axisValues.filter((v) => v.axis === "COLUMN");
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
    }));
    setNewColValue("");
  };

  const handleRemoveAxisValue = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      axisValues: prev.axisValues.filter((_, i) => i !== index),
    }));
  };

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
    }));
  };

  const handleAddIndividualEntry = () => {
    if (!newIndividualName.trim()) return;
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
    }));
    setNewIndividualName("");
  };

  const handleRemoveIndividualEntry = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      individualEntries: prev.individualEntries.filter((_, i) => i !== index),
    }));
  };

  const handleToggleCombination = (rowId: string, colId: string, isActive: boolean) => {
    setFormData((prev) => {
      const key = `${rowId}:${colId}`;
      const newSet = new Set(prev.disabledCombinations);
      if (isActive) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return { ...prev, disabledCombinations: newSet };
    });
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error("Name is required");
      return;
    }

    if (formData.type === "COMBINATION") {
      const rows = formData.axisValues.filter((v) => v.axis === "ROW");
      const cols = formData.axisValues.filter((v) => v.axis === "COLUMN");
      if (rows.length === 0 || cols.length === 0) {
        toast.error("Add at least one row and column value");
        return;
      }
    }

    if (formData.type === "INDIVIDUAL" && formData.individualEntries.length === 0) {
      toast.error("Add at least one entry");
      return;
    }

    setSaving(true);
    try {
      if (editingTemplate) {
        const combinationUpdates: Array<{
          rowValueId: string;
          colValueId: string;
          isActive: boolean;
        }> = [];
        if (formData.type === "COMBINATION") {
          const rows = formData.axisValues.filter((v) => v.axis === "ROW");
          const cols = formData.axisValues.filter((v) => v.axis === "COLUMN");
          for (const row of rows) {
            for (const col of cols) {
              if (row.id && col.id) {
                const key = `${row.id}:${col.id}`;
                combinationUpdates.push({
                  rowValueId: row.id,
                  colValueId: col.id,
                  isActive: !formData.disabledCombinations.has(key),
                });
              }
            }
          }
        }

        const response = await fetch(`/api/competition-categories/${editingTemplate.id}`, {
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
            individualEntries:
              formData.type === "INDIVIDUAL" ? formData.individualEntries : undefined,
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Failed to update");
        }
        toast.success("Category template updated");
      } else {
        const rows = formData.axisValues.filter((v) => v.axis === "ROW");
        const cols = formData.axisValues.filter((v) => v.axis === "COLUMN");
        const disabledCombinations: Array<{
          rowValueIndex: number;
          colValueIndex: number;
          isActive: boolean;
        }> = [];

        for (let ri = 0; ri < rows.length; ri++) {
          for (let ci = 0; ci < cols.length; ci++) {
            const key = `temp-row-${ri}:temp-col-${ci}`;
            if (formData.disabledCombinations.has(key)) {
              disabledCombinations.push({ rowValueIndex: ri, colValueIndex: ci, isActive: false });
            }
          }
        }

        const response = await fetch("/api/competition-categories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formData.name,
            description: formData.description || null,
            type: formData.type,
            isActive: formData.isActive,
            displayOrder: formData.displayOrder,
            rowAxisLabel: formData.type === "COMBINATION" ? formData.rowAxisLabel || null : null,
            columnAxisLabel:
              formData.type === "COMBINATION" ? formData.columnAxisLabel || null : null,
            restrictionAxis: formData.type === "COMBINATION" ? formData.restrictionAxis : null,
            axisValues: formData.type === "COMBINATION" ? formData.axisValues : [],
            disabledCombinations,
            individualEntries: formData.type === "INDIVIDUAL" ? formData.individualEntries : [],
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Failed to create");
        }
        toast.success("Category template created");
      }

      setDialogOpen(false);
      fetchData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingTemplate) return;
    try {
      const response = await fetch(`/api/competition-categories/${deletingTemplate.id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to delete");
      }
      toast.success("Category template deleted");
      setDeleteDialogOpen(false);
      setDeletingTemplate(null);
      fetchData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete");
    }
  };

  // Grid data for form
  const formRows = formData.axisValues
    .map((v, i) => ({ ...v, _index: i }))
    .filter((v) => v.axis === "ROW");
  const formCols = formData.axisValues
    .map((v, i) => ({ ...v, _index: i }))
    .filter((v) => v.axis === "COLUMN");

  const gridRows = formRows.map((r) => ({
    id: r.id || `temp-row-${formRows.indexOf(r)}`,
    name: r.name,
    restrictions:
      formData.restrictionAxis === "ROW"
        ? { minAge: r.minAge, maxAge: r.maxAge, allowedGenders: r.allowedGenders }
        : undefined,
  }));

  const gridCols = formCols.map((c) => ({
    id: c.id || `temp-col-${formCols.indexOf(c)}`,
    name: c.name,
    restrictions:
      formData.restrictionAxis === "COLUMN"
        ? { minAge: c.minAge, maxAge: c.maxAge, allowedGenders: c.allowedGenders }
        : undefined,
  }));

  const gridEntries = gridRows.flatMap((r) =>
    gridCols.map((c) => ({
      rowId: r.id,
      colId: c.id,
      isActive: !formData.disabledCombinations.has(`${r.id}:${c.id}`),
    }))
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const enabledPresetsCount = presets.filter((p) => !p.isDisabledByOrg).length;

  return (
    <div className="flex flex-col gap-6 p-6">
      <DashboardPageHeader
        title="Categories"
        description="Manage competition categories for your organization. Toggle presets on or off, and create your own custom categories."
        actions={
          <Button onClick={handleOpenCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Add Category
          </Button>
        }
      />

      {/* Presets Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Presets</h2>
          <span className="text-xs text-muted-foreground">
            {enabledPresetsCount} of {presets.length} enabled
          </span>
        </div>
        {presets.length === 0 ? (
          <Card>
            <CardContent className="py-8">
              <div className="text-center text-muted-foreground">
                <Info className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="font-medium">No Presets Available</p>
                <p className="text-sm mt-1">
                  No category templates have been configured yet. Contact your administrator.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {presets.map((template) => (
              <PresetTemplateCard
                key={template.id}
                template={template}
                onToggleDisabled={handleTogglePresetDisabled}
                togglingId={togglingPresetId}
              />
            ))}
          </div>
        )}
      </div>

      {/* Custom Categories Section */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Custom Categories</h2>
        {custom.length === 0 ? (
          <Card>
            <CardContent className="py-8">
              <div className="text-center text-muted-foreground">
                <Layers className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="font-medium">No Custom Categories</p>
                <p className="text-sm mt-1">
                  Click &quot;Add Category&quot; to create your first custom category template.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {custom.map((template) => (
              <CustomTemplateCard
                key={template.id}
                template={template}
                onEdit={() => handleOpenEdit(template)}
                onDelete={() => {
                  setDeletingTemplate(template);
                  setDeleteDialogOpen(true);
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? "Edit Category Template" : "Add Category Template"}
            </DialogTitle>
            <DialogDescription>
              {editingTemplate
                ? "Update this custom category template."
                : "Create a new custom category template for your organization."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-6 py-4">
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label htmlFor="cat-name">Name</Label>
                <Input
                  id="cat-name"
                  value={formData.name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Age Group x Discipline"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cat-description">Description</Label>
                <Textarea
                  id="cat-description"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, description: e.target.value }))
                  }
                  placeholder="Brief description"
                  rows={2}
                />
              </div>
            </div>

            {!editingTemplate && (
              <div className="space-y-3">
                <Label className="text-base font-medium">Type</Label>
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
                      <p className="text-xs text-muted-foreground">Grid from two dimensions</p>
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
                      <p className="text-xs text-muted-foreground">Standalone entries</p>
                    </div>
                  </label>
                </RadioGroup>
              </div>
            )}

            <Separator />

            {/* COMBINATION config */}
            {formData.type === "COMBINATION" && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Row Axis Label</Label>
                    <Input
                      value={formData.rowAxisLabel}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, rowAxisLabel: e.target.value }))
                      }
                      placeholder="e.g., Age Group"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Column Axis Label</Label>
                    <Input
                      value={formData.columnAxisLabel}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, columnAxisLabel: e.target.value }))
                      }
                      placeholder="e.g., Discipline"
                    />
                  </div>
                </div>

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
                </div>

                {/* Row values */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium">
                    {formData.rowAxisLabel || "Row"} Values
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      value={newRowValue}
                      onChange={(e) => setNewRowValue(e.target.value)}
                      placeholder={`Add ${formData.rowAxisLabel || "row"} value...`}
                      onKeyDown={(e) =>
                        e.key === "Enter" && (e.preventDefault(), handleAddRowValue())
                      }
                    />
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleAddRowValue}
                      disabled={!newRowValue.trim()}
                    >
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

                {/* Column values */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium">
                    {formData.columnAxisLabel || "Column"} Values
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      value={newColValue}
                      onChange={(e) => setNewColValue(e.target.value)}
                      placeholder={`Add ${formData.columnAxisLabel || "column"} value...`}
                      onKeyDown={(e) =>
                        e.key === "Enter" && (e.preventDefault(), handleAddColValue())
                      }
                    />
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleAddColValue}
                      disabled={!newColValue.trim()}
                    >
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
                          <Select
                            value={col.resultType || ""}
                            onValueChange={(v) =>
                              setFormData((prev) => ({
                                ...prev,
                                axisValues: prev.axisValues.map((av, i) =>
                                  i === col._index
                                    ? {
                                        ...av,
                                        resultType: v as AxisValue["resultType"],
                                        sortDirection:
                                          v === "TIME"
                                            ? "ASC"
                                            : ("DESC" as AxisValue["sortDirection"]),
                                      }
                                    : av
                                ),
                              }))
                            }
                          >
                            <SelectTrigger className="w-24 h-7 text-xs">
                              <SelectValue placeholder="Result" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="TIME">Time</SelectItem>
                              <SelectItem value="DISTANCE">Distance</SelectItem>
                              <SelectItem value="HEIGHT">Height</SelectItem>
                              <SelectItem value="SCORE">Score</SelectItem>
                            </SelectContent>
                          </Select>
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

                {/* Grid preview */}
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

            {/* INDIVIDUAL config */}
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
                      <div key={index} className="flex items-start gap-3 rounded-lg border p-3">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{entry.name}</span>
                            <Select
                              value={entry.resultType || ""}
                              onValueChange={(v) =>
                                setFormData((prev) => ({
                                  ...prev,
                                  individualEntries: prev.individualEntries.map((e, i) =>
                                    i === index
                                      ? {
                                          ...e,
                                          resultType: v as IndividualEntry["resultType"],
                                          sortDirection:
                                            v === "TIME"
                                              ? "ASC"
                                              : ("DESC" as IndividualEntry["sortDirection"]),
                                        }
                                      : e
                                  ),
                                }))
                              }
                            >
                              <SelectTrigger className="w-24 h-7 text-xs">
                                <SelectValue placeholder="Result" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="TIME">Time</SelectItem>
                                <SelectItem value="DISTANCE">Distance</SelectItem>
                                <SelectItem value="HEIGHT">Height</SelectItem>
                                <SelectItem value="SCORE">Score</SelectItem>
                              </SelectContent>
                            </Select>
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
                                        ? {
                                            ...e,
                                            hasAgeRestriction: checked,
                                            minAge: checked ? e.minAge : null,
                                            maxAge: checked ? e.maxAge : null,
                                          }
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
                                          ? {
                                              ...ent,
                                              minAge: e.target.value
                                                ? parseInt(e.target.value)
                                                : null,
                                            }
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
                                          ? {
                                              ...ent,
                                              maxAge: e.target.value
                                                ? parseInt(e.target.value)
                                                : null,
                                            }
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
                                        ? {
                                            ...e,
                                            hasCapacityRestriction: checked,
                                            capacity: checked ? e.capacity : null,
                                          }
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
                                        ? {
                                            ...ent,
                                            capacity: e.target.value
                                              ? parseInt(e.target.value)
                                              : null,
                                          }
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

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Active</Label>
                <p className="text-xs text-muted-foreground">
                  Inactive templates won&apos;t be available for competitions
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

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Category Template</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deletingTemplate?.name}&quot;? This action
              cannot be undone.
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
  );
}
