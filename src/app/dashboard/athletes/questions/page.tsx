"use client";

import * as React from "react";
import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardPageHeader } from "@/components/dashboard-page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Plus, Trash2, GripVertical, Loader2, FileText, Info, ChevronDown } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { useCustomInfoQuestions } from "@/hooks/use-custom-information";
import { useFeatures } from "@/components/feature-context";
import { api } from "@/lib/api-client";
import type {
  CustomInfoQuestion,
  CustomInfoQuestionType,
  CustomInfoScopeType,
  CreateCustomInfoQuestionPayload,
} from "@/types/custom-information";
import { QUESTION_TYPE_LABELS, SCOPE_TYPE_LABELS } from "@/types/custom-information";

// ============================================
// Scope Selector
// ============================================

interface ScopeEntry {
  scopeType: CustomInfoScopeType;
  targetId: string | null;
}

interface EntityOption {
  id: string;
  name: string;
}

function ScopeSelector({
  scopes,
  onChange,
}: {
  scopes: ScopeEntry[];
  onChange: (scopes: ScopeEntry[]) => void;
}) {
  const { isFeatureEnabled } = useFeatures();
  const seasonsEnabled = isFeatureEnabled("seasons");
  const [programs, setPrograms] = useState<EntityOption[]>([]);
  const [events, setEvents] = useState<EntityOption[]>([]);
  const [competitions, setCompetitions] = useState<EntityOption[]>([]);
  const [memberships, setMemberships] = useState<EntityOption[]>([]);
  const [passes, setPasses] = useState<EntityOption[]>([]);
  const [seasons, setSeasons] = useState<EntityOption[]>([]);
  const [loadingEntities, setLoadingEntities] = useState(false);
  const [entitiesLoaded, setEntitiesLoaded] = useState(false);

  const showSeasonOption = seasonsEnabled && seasons.length > 0;
  const [scopeMode, setScopeMode] = useState<"season" | "manual">(
    scopes.some((s) => s.scopeType === "SEASON") ? "season" : "manual"
  );
  const prevScopesRef = React.useRef(scopes);

  useEffect(() => {
    if (prevScopesRef.current !== scopes && scopes.length > 0) {
      setScopeMode(scopes.some((s) => s.scopeType === "SEASON") ? "season" : "manual");
    }
    prevScopesRef.current = scopes;
  }, [scopes]);

  const loadEntities = useCallback(async () => {
    if (entitiesLoaded) return;
    setLoadingEntities(true);
    try {
      const safeGet = async (url: string): Promise<any> => {
        try {
          return await api.get<any>(url);
        } catch {
          return null;
        }
      };

      const unwrap = (res: any): any[] =>
        res == null ? [] : Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : [];

      const [programsRes, eventsRes, competitionsRes, membershipsRes, passesRes] =
        await Promise.all([
          safeGet("/api/programs?limit=500"),
          safeGet("/api/events?limit=500"),
          safeGet("/api/competitions"),
          safeGet("/api/memberships?limit=500"),
          safeGet("/api/passes?limit=500"),
        ]);

      setPrograms(unwrap(programsRes).map((p: any) => ({ id: p.id, name: p.name })));
      setEvents(unwrap(eventsRes).map((e: any) => ({ id: e.id, name: e.title || e.name })));
      setCompetitions(unwrap(competitionsRes).map((c: any) => ({ id: c.id, name: c.name })));
      setMemberships(unwrap(membershipsRes).map((m: any) => ({ id: m.id, name: m.name })));
      setPasses(unwrap(passesRes).map((p: any) => ({ id: p.id, name: p.name })));

      if (seasonsEnabled) {
        const seasonsRes = await safeGet("/api/seasons?limit=500");
        setSeasons(unwrap(seasonsRes).map((s: any) => ({ id: s.id, name: s.name })));
      }
      setEntitiesLoaded(true);
    } catch (err) {
      console.error("Failed to load entities:", err);
    } finally {
      setLoadingEntities(false);
    }
  }, [entitiesLoaded, seasonsEnabled]);

  useEffect(() => {
    loadEntities();
  }, [loadEntities]);

  const hasScope = (scopeType: CustomInfoScopeType, targetId?: string | null) =>
    scopes.some(
      (s) => s.scopeType === scopeType && (targetId === undefined || s.targetId === targetId)
    );

  const toggleAllScope = (scopeType: CustomInfoScopeType) => {
    if (hasScope(scopeType)) {
      onChange(scopes.filter((s) => s.scopeType !== scopeType));
    } else {
      onChange([...scopes, { scopeType, targetId: null }]);
    }
  };

  const toggleSpecificScope = (scopeType: CustomInfoScopeType, targetId: string) => {
    if (hasScope(scopeType, targetId)) {
      onChange(scopes.filter((s) => !(s.scopeType === scopeType && s.targetId === targetId)));
    } else {
      onChange([...scopes, { scopeType, targetId }]);
    }
  };

  const switchToSeason = () => {
    onChange([]);
    setScopeMode("season");
  };
  const switchToManual = () => {
    onChange([]);
    setScopeMode("manual");
  };

  const allScopeTypes: {
    all: CustomInfoScopeType;
    specific: CustomInfoScopeType;
    label: string;
    entities: EntityOption[];
  }[] = [
    { all: "ALL_PROGRAMS", specific: "PROGRAM", label: "Programs", entities: programs },
    { all: "ALL_EVENTS", specific: "EVENT", label: "Events", entities: events },
    {
      all: "ALL_COMPETITIONS",
      specific: "COMPETITION",
      label: "Competitions",
      entities: competitions,
    },
    { all: "ALL_MEMBERSHIPS", specific: "MEMBERSHIP", label: "Memberships", entities: memberships },
    { all: "ALL_PASSES", specific: "PASS", label: "Passes", entities: passes },
  ];

  if (loadingEntities) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading...
      </div>
    );
  }

  const entityScopeList = (
    <div className="space-y-2">
      {allScopeTypes.map(({ all, specific, label, entities }) => (
        <div key={all} className="space-y-1">
          <div className="flex items-center space-x-2">
            <Checkbox
              id={all}
              checked={hasScope(all)}
              onCheckedChange={() => toggleAllScope(all)}
            />
            <Label htmlFor={all} className="text-sm font-normal cursor-pointer">
              All {label}
            </Label>
          </div>

          {!hasScope(all) && entities.length > 0 && (
            <Collapsible>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="ml-6 h-7 text-xs gap-1">
                  Specific {label}
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="ml-6 mt-1 space-y-1 max-h-40 overflow-y-auto border rounded-md p-2">
                  {entities.map((entity) => (
                    <div key={entity.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`${specific}-${entity.id}`}
                        checked={hasScope(specific, entity.id)}
                        onCheckedChange={() => toggleSpecificScope(specific, entity.id)}
                      />
                      <Label
                        htmlFor={`${specific}-${entity.id}`}
                        className="text-sm font-normal cursor-pointer truncate"
                      >
                        {entity.name}
                      </Label>
                    </div>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>
      ))}
    </div>
  );

  const seasonList = (
    <div className="space-y-1">
      {seasons.map((season) => (
        <div key={season.id} className="flex items-center space-x-2">
          <Checkbox
            id={`SEASON-${season.id}`}
            checked={hasScope("SEASON", season.id)}
            onCheckedChange={() => toggleSpecificScope("SEASON", season.id)}
          />
          <Label
            htmlFor={`SEASON-${season.id}`}
            className="text-sm font-normal cursor-pointer truncate"
          >
            {season.name}
          </Label>
        </div>
      ))}
      <p className="text-xs text-muted-foreground pt-1">
        Applies to all programs, competitions, and memberships within the selected season(s).
      </p>
    </div>
  );

  if (!showSeasonOption) {
    return (
      <div className="space-y-3">
        <Label>Scope</Label>
        <p className="text-sm text-muted-foreground">
          Select when this question should appear during registration
        </p>
        {entityScopeList}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Label>Scope</Label>
      <p className="text-sm text-muted-foreground">
        Select when this question should appear during registration
      </p>

      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          variant={scopeMode === "season" ? "default" : "outline"}
          onClick={() => {
            if (scopeMode !== "season") switchToSeason();
          }}
          className="text-xs"
        >
          By Season
        </Button>
        <Button
          type="button"
          size="sm"
          variant={scopeMode === "manual" ? "default" : "outline"}
          onClick={() => {
            if (scopeMode !== "manual") switchToManual();
          }}
          className="text-xs"
        >
          Select Manually
        </Button>
      </div>

      {scopeMode === "season" ? seasonList : entityScopeList}
    </div>
  );
}

// ============================================
// Sortable Question Item
// ============================================

function SortableQuestion({
  question,
  onEdit,
  onDelete,
}: {
  question: CustomInfoQuestion;
  onEdit: (question: CustomInfoQuestion) => void;
  onDelete: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: question.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const scopeBadges = question.scopes.map((s) => {
    const label = SCOPE_TYPE_LABELS[s.scopeType];
    return label;
  });
  const uniqueBadges = [...new Set(scopeBadges)];

  return (
    <div ref={setNodeRef} style={style} className="border rounded-lg p-4 bg-background">
      <div className="flex items-start gap-3">
        <div
          {...attributes}
          {...listeners}
          className="mt-1 cursor-move text-muted-foreground hover:text-foreground"
        >
          <GripVertical className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <p className="font-medium truncate">{question.questionText}</p>
            {question.required && (
              <Badge variant="destructive" className="text-xs shrink-0">
                Required
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="secondary" className="text-xs">
              {QUESTION_TYPE_LABELS[question.questionType]}
            </Badge>
            {question.questionType === "VALUE" &&
              question.valueMin != null &&
              question.valueMax != null && (
                <Badge variant="secondary" className="text-xs">
                  Range: {question.valueMin}–{question.valueMax}
                  {question.allowDecimals ? " (decimals)" : " (whole numbers)"}
                </Badge>
              )}
            {question.questionType === "BOOLEAN" && question.requireSignatureOnYes && (
              <Badge variant="secondary" className="text-xs">
                + Signature on Yes
              </Badge>
            )}
            <Badge variant="secondary" className="text-xs">
              {question.validityDays == null ? "Indefinite" : `${question.validityDays}d validity`}
            </Badge>
            {uniqueBadges.map((badge) => (
              <Badge key={badge} variant="outline" className="text-xs">
                {badge}
              </Badge>
            ))}
          </div>
          {question.description && (
            <p className="text-xs text-muted-foreground mt-1">{question.description}</p>
          )}
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="ghost" size="sm" onClick={() => onEdit(question)}>
            Edit
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" className="text-destructive">
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Question</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete this question? Existing responses will be
                  preserved but the question will no longer appear during registration.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => onDelete(question.id)}>Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  );
}

// ============================================
// Question Editor Dialog
// ============================================

function QuestionEditor({
  question,
  open,
  onOpenChange,
  onSave,
  isSaving,
}: {
  question: CustomInfoQuestion | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: CreateCustomInfoQuestionPayload & { id?: string }) => Promise<void>;
  isSaving: boolean;
}) {
  const [questionText, setQuestionText] = useState("");
  const [description, setDescription] = useState("");
  const [questionType, setQuestionType] = useState<CustomInfoQuestionType>("SHORT_TEXT");
  const [required, setRequired] = useState(true);
  const [scopes, setScopes] = useState<ScopeEntry[]>([]);
  const [valueMin, setValueMin] = useState<string>("");
  const [valueMax, setValueMax] = useState<string>("");
  const [allowDecimals, setAllowDecimals] = useState(false);
  const [requireSignatureOnYes, setRequireSignatureOnYes] = useState(false);
  const [validityMode, setValidityMode] = useState<"indefinite" | "days">("indefinite");
  const [validityDaysValue, setValidityDaysValue] = useState<string>("365");

  useEffect(() => {
    if (question) {
      setQuestionText(question.questionText);
      setDescription(question.description || "");
      setQuestionType(question.questionType);
      setRequired(question.required);
      setScopes(question.scopes.map((s) => ({ scopeType: s.scopeType, targetId: s.targetId })));
      setValueMin(question.valueMin != null ? String(question.valueMin) : "");
      setValueMax(question.valueMax != null ? String(question.valueMax) : "");
      setAllowDecimals(question.allowDecimals ?? false);
      setRequireSignatureOnYes(question.requireSignatureOnYes ?? false);
      setValidityMode(question.validityDays == null ? "indefinite" : "days");
      setValidityDaysValue(question.validityDays != null ? String(question.validityDays) : "365");
    } else {
      setQuestionText("");
      setDescription("");
      setQuestionType("SHORT_TEXT");
      setRequired(true);
      setScopes([]);
      setValueMin("");
      setValueMax("");
      setAllowDecimals(false);
      setRequireSignatureOnYes(false);
      setValidityMode("indefinite");
      setValidityDaysValue("365");
    }
  }, [question, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (scopes.length === 0) {
      toast.error("Please select at least one scope");
      return;
    }
    if (questionType === "VALUE") {
      const min = parseFloat(valueMin);
      const max = parseFloat(valueMax);
      if (isNaN(min) || isNaN(max)) {
        toast.error("Value questions require a numeric min and max range");
        return;
      }
      if (max <= min) {
        toast.error("Max must be greater than min");
        return;
      }
    }
    if (validityMode === "days") {
      const parsed = parseInt(validityDaysValue, 10);
      if (isNaN(parsed) || parsed < 1 || parsed > 3650) {
        toast.error("Validity days must be between 1 and 3650");
        return;
      }
    }
    await onSave({
      id: question?.id,
      questionText,
      description: description || null,
      questionType,
      required,
      scopes,
      ...(questionType === "VALUE"
        ? {
            valueMin: parseFloat(valueMin) || null,
            valueMax: parseFloat(valueMax) || null,
            allowDecimals,
          }
        : {
            valueMin: null,
            valueMax: null,
            allowDecimals: false,
          }),
      requireSignatureOnYes: questionType === "BOOLEAN" ? requireSignatureOnYes : false,
      validityDays: validityMode === "indefinite" ? null : parseInt(validityDaysValue, 10),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{question ? "Edit Question" : "Add Question"}</DialogTitle>
            <DialogDescription>
              Configure a custom question to collect information during registration
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="questionText">Question</Label>
              <Input
                id="questionText"
                value={questionText}
                onChange={(e) => setQuestionText(e.target.value)}
                placeholder="e.g. What is your weight?"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Additional instructions or context"
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="questionType">Answer Type</Label>
              <Select
                value={questionType}
                onValueChange={(v) => setQuestionType(v as CustomInfoQuestionType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="VALUE">Number</SelectItem>
                  <SelectItem value="BOOLEAN">Yes / No</SelectItem>
                  <SelectItem value="SIGNATURE">Signature</SelectItem>
                  <SelectItem value="SHORT_TEXT">Short Text</SelectItem>
                  <SelectItem value="LONG_TEXT">Long Text</SelectItem>
                  <SelectItem value="IMAGE">Image Upload</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {questionType === "VALUE" && (
              <div className="space-y-3 rounded-md border p-3">
                <p className="text-sm font-medium">Number Settings</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="valueMin" className="text-xs">
                      Minimum
                    </Label>
                    <Input
                      id="valueMin"
                      type="number"
                      step={allowDecimals ? "any" : "1"}
                      value={valueMin}
                      onChange={(e) => setValueMin(e.target.value)}
                      placeholder="e.g. 0"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="valueMax" className="text-xs">
                      Maximum
                    </Label>
                    <Input
                      id="valueMax"
                      type="number"
                      step={allowDecimals ? "any" : "1"}
                      value={valueMax}
                      onChange={(e) => setValueMax(e.target.value)}
                      placeholder="e.g. 500"
                      required
                    />
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="allowDecimals"
                    checked={allowDecimals}
                    onCheckedChange={setAllowDecimals}
                  />
                  <Label htmlFor="allowDecimals" className="text-sm font-normal">
                    Allow decimal values
                  </Label>
                </div>
              </div>
            )}
            {questionType === "BOOLEAN" && (
              <div className="space-y-3 rounded-md border p-3">
                <p className="text-sm font-medium">Yes / No Settings</p>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="requireSignatureOnYes"
                    checked={requireSignatureOnYes}
                    onCheckedChange={setRequireSignatureOnYes}
                  />
                  <Label htmlFor="requireSignatureOnYes" className="text-sm font-normal">
                    Require signature when answered &ldquo;Yes&rdquo;
                  </Label>
                </div>
              </div>
            )}

            <div className="flex items-center space-x-2">
              <Switch id="required" checked={required} onCheckedChange={setRequired} />
              <Label htmlFor="required">Required question</Label>
            </div>

            <div className="space-y-3 rounded-md border p-3">
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-medium">Validity Period</p>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-xs">
                      How long a response remains valid. Athletes with expired responses will be
                      asked to re-submit during registration.
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <Select
                value={validityMode}
                onValueChange={(v) => setValidityMode(v as "indefinite" | "days")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="indefinite">Indefinite (never expires)</SelectItem>
                  <SelectItem value="days">Expires after a set number of days</SelectItem>
                </SelectContent>
              </Select>
              {validityMode === "days" && (
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={1}
                    max={3650}
                    value={validityDaysValue}
                    onChange={(e) => setValidityDaysValue(e.target.value)}
                    className="w-32"
                  />
                  <span className="text-sm text-muted-foreground">days</span>
                </div>
              )}
            </div>

            <ScopeSelector scopes={scopes} onChange={setScopes} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                isSaving ||
                !questionText.trim() ||
                scopes.length === 0 ||
                (questionType === "VALUE" && (!valueMin || !valueMax))
              }
            >
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {question ? "Save Changes" : "Add Question"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ============================================
// Main Page
// ============================================

export default function QuestionsPage() {
  const {
    questions,
    isLoading: questionsLoading,
    isSaving: questionsSaving,
    createQuestion,
    updateQuestion,
    deleteQuestion,
    reorderQuestions,
  } = useCustomInfoQuestions();

  const [editingQuestion, setEditingQuestion] = useState<CustomInfoQuestion | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = questions.findIndex((q) => q.id === active.id);
      const newIndex = questions.findIndex((q) => q.id === over.id);
      const reordered = arrayMove(questions, oldIndex, newIndex);
      const orderedQuestions = reordered.map((q, i) => ({
        id: q.id,
        displayOrder: i,
      }));
      const success = await reorderQuestions(orderedQuestions);
      if (!success) {
        toast.error("Failed to reorder questions");
      }
    }
  };

  const handleSaveQuestion = async (data: CreateCustomInfoQuestionPayload & { id?: string }) => {
    if (data.id) {
      const success = await updateQuestion(data.id, data);
      if (success) {
        toast.success("Question updated");
        setIsEditorOpen(false);
        setEditingQuestion(null);
      } else {
        toast.error("Failed to update question");
      }
    } else {
      const newQuestion = await createQuestion(data);
      if (newQuestion) {
        toast.success("Question added");
        setIsEditorOpen(false);
      } else {
        toast.error("Failed to add question");
      }
    }
  };

  const handleDeleteQuestion = async (id: string) => {
    const success = await deleteQuestion(id);
    if (success) {
      toast.success("Question deleted");
    } else {
      toast.error("Failed to delete question");
    }
  };

  const handleEditQuestion = (question: CustomInfoQuestion) => {
    setEditingQuestion(question);
    setIsEditorOpen(true);
  };

  const handleAddQuestion = () => {
    setEditingQuestion(null);
    setIsEditorOpen(true);
  };

  if (questionsLoading) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <div className="space-y-2">
          <Skeleton className="h-7 w-72" />
          <Skeleton className="h-4 w-96" />
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-xl border bg-card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-8 w-24 rounded-md" />
            </div>
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <DashboardPageHeader
        title="Custom Information Questions"
        description="Configure questions to collect additional information from athletes during registration"
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Questions
          </CardTitle>
          <CardDescription>
            Define questions and their scope to control when they appear during registration
          </CardDescription>
        </CardHeader>
        <CardContent>
          {questions.length > 0 ? (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={questions.map((q) => q.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2 mb-4">
                  {questions.map((question) => (
                    <SortableQuestion
                      key={question.id}
                      question={question}
                      onEdit={handleEditQuestion}
                      onDelete={handleDeleteQuestion}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No questions yet</p>
              <p className="text-sm">Add a question to start collecting custom information</p>
            </div>
          )}

          <Button onClick={handleAddQuestion} className="w-full">
            <Plus className="mr-2 h-4 w-4" />
            Add Question
          </Button>
        </CardContent>
      </Card>

      <QuestionEditor
        question={editingQuestion}
        open={isEditorOpen}
        onOpenChange={setIsEditorOpen}
        onSave={handleSaveQuestion}
        isSaving={questionsSaving}
      />
    </div>
  );
}
