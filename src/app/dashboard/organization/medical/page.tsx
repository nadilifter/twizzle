"use client";

import * as React from "react";
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
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
  DialogTrigger,
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
import {
  Plus,
  Trash2,
  GripVertical,
  Loader2,
  Settings,
  FileText,
  Save,
  Heart,
  AlertTriangle,
  Pill,
  Phone,
  UtensilsCrossed,
  Shield,
} from "lucide-react";
import { toast } from "sonner";
import { useMedicalConfig, useMedicalQuestions } from "@/hooks/use-medical";
import type { CustomMedicalQuestion, CreateCustomMedicalQuestionPayload, MedicalQuestionType } from "@/types/medical";

// Sortable question item component
function SortableQuestion({
  question,
  onEdit,
  onDelete,
}: {
  question: CustomMedicalQuestion;
  onEdit: (question: CustomMedicalQuestion) => void;
  onDelete: (id: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: question.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const questionTypeLabels: Record<MedicalQuestionType, string> = {
    TEXT: "Short Answer",
    YES_NO: "Yes/No",
    MULTIPLE_CHOICE: "Multiple Choice",
    CHECKBOX: "Checkboxes",
  };

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
          <div className="flex items-center gap-2 mb-1">
            <p className="font-medium truncate">{question.questionText}</p>
            {question.required && (
              <Badge variant="destructive" className="text-xs">Required</Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {questionTypeLabels[question.questionType]}
            {question.options && (question.options as string[]).length > 0 && (
              <> - {(question.options as string[]).length} options</>
            )}
          </p>
        </div>
        <div className="flex gap-2">
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
                  Are you sure you want to delete this question? This will also delete any existing responses to this question.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => onDelete(question.id)}>
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  );
}

// Question editor dialog
function QuestionEditor({
  question,
  open,
  onOpenChange,
  onSave,
  isSaving,
}: {
  question: CustomMedicalQuestion | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: CreateCustomMedicalQuestionPayload & { id?: string }) => Promise<void>;
  isSaving: boolean;
}) {
  const [questionText, setQuestionText] = useState(question?.questionText || "");
  const [questionType, setQuestionType] = useState<MedicalQuestionType>(question?.questionType || "TEXT");
  const [required, setRequired] = useState(question?.required || false);
  const [options, setOptions] = useState<string[]>((question?.options as string[]) || []);
  const [newOption, setNewOption] = useState("");

  React.useEffect(() => {
    if (question) {
      setQuestionText(question.questionText);
      setQuestionType(question.questionType);
      setRequired(question.required);
      setOptions((question.options as string[]) || []);
    } else {
      setQuestionText("");
      setQuestionType("TEXT");
      setRequired(false);
      setOptions([]);
    }
  }, [question]);

  const addOption = () => {
    if (newOption.trim() && !options.includes(newOption.trim())) {
      setOptions([...options, newOption.trim()]);
      setNewOption("");
    }
  };

  const removeOption = (option: string) => {
    setOptions(options.filter((o) => o !== option));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const data = {
      id: question?.id,
      questionText,
      questionType,
      required,
      options: questionType === "MULTIPLE_CHOICE" || questionType === "CHECKBOX" ? options : undefined,
    };

    await onSave(data);
  };

  const needsOptions = questionType === "MULTIPLE_CHOICE" || questionType === "CHECKBOX";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{question ? "Edit Question" : "Add Question"}</DialogTitle>
            <DialogDescription>
              Create a custom question to collect additional medical information
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="questionText">Question</Label>
              <Input
                id="questionText"
                value={questionText}
                onChange={(e) => setQuestionText(e.target.value)}
                placeholder="Enter your question"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="questionType">Answer Type</Label>
              <Select value={questionType} onValueChange={(v) => setQuestionType(v as MedicalQuestionType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TEXT">Short Answer</SelectItem>
                  <SelectItem value="YES_NO">Yes/No</SelectItem>
                  <SelectItem value="MULTIPLE_CHOICE">Multiple Choice</SelectItem>
                  <SelectItem value="CHECKBOX">Checkboxes</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {needsOptions && (
              <div className="space-y-2">
                <Label>Options</Label>
                <div className="space-y-2">
                  {options.map((option, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Input value={option} disabled className="flex-1" />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeOption(option)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <Input
                      value={newOption}
                      onChange={(e) => setNewOption(e.target.value)}
                      placeholder="Add option"
                      onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addOption())}
                    />
                    <Button type="button" variant="outline" onClick={addOption}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )}
            <div className="flex items-center space-x-2">
              <Switch
                id="required"
                checked={required}
                onCheckedChange={setRequired}
              />
              <Label htmlFor="required">Required question</Label>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving || !questionText.trim()}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {question ? "Save Changes" : "Add Question"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function MedicalSettingsPage() {
  const { config, isLoading: configLoading, isSaving: configSaving, updateConfig } = useMedicalConfig();
  const { 
    questions, 
    isLoading: questionsLoading, 
    isSaving: questionsSaving,
    createQuestion,
    updateQuestion,
    deleteQuestion,
    reorderQuestions,
  } = useMedicalQuestions();

  const [editingQuestion, setEditingQuestion] = useState<CustomMedicalQuestion | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleConfigChange = async (key: string, value: boolean) => {
    const success = await updateConfig({ [key]: value });
    if (success) {
      toast.success("Settings updated");
    } else {
      toast.error("Failed to update settings");
    }
  };

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

  const handleSaveQuestion = async (data: CreateCustomMedicalQuestionPayload & { id?: string }) => {
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

  const handleEditQuestion = (question: CustomMedicalQuestion) => {
    setEditingQuestion(question);
    setIsEditorOpen(true);
  };

  const handleAddQuestion = () => {
    setEditingQuestion(null);
    setIsEditorOpen(true);
  };

  if (configLoading || questionsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Medical Information Settings</h1>
          <p className="text-muted-foreground">
            Configure what medical information to collect from athletes
          </p>
        </div>
      </div>

      {/* Standard Questions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Standard Questions
          </CardTitle>
          <CardDescription>
            Enable or disable standard medical information fields
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              <div>
                <Label className="text-base">Allergies</Label>
                <p className="text-sm text-muted-foreground">Collect food, environmental, and medication allergies</p>
              </div>
            </div>
            <Switch
              checked={config?.collectAllergies !== false}
              onCheckedChange={(checked) => handleConfigChange("collectAllergies", checked)}
              disabled={configSaving}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Heart className="h-5 w-5 text-red-500" />
              <div>
                <Label className="text-base">Medical Conditions</Label>
                <p className="text-sm text-muted-foreground">Collect conditions like asthma, diabetes, epilepsy</p>
              </div>
            </div>
            <Switch
              checked={config?.collectConditions !== false}
              onCheckedChange={(checked) => handleConfigChange("collectConditions", checked)}
              disabled={configSaving}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Pill className="h-5 w-5 text-blue-500" />
              <div>
                <Label className="text-base">Medications</Label>
                <p className="text-sm text-muted-foreground">Collect current medications the athlete is taking</p>
              </div>
            </div>
            <Switch
              checked={config?.collectMedications !== false}
              onCheckedChange={(checked) => handleConfigChange("collectMedications", checked)}
              disabled={configSaving}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Phone className="h-5 w-5 text-green-500" />
              <div>
                <Label className="text-base">Emergency Contact</Label>
                <p className="text-sm text-muted-foreground">Collect emergency contact name, phone, and relationship</p>
              </div>
            </div>
            <Switch
              checked={config?.collectEmergencyContact !== false}
              onCheckedChange={(checked) => handleConfigChange("collectEmergencyContact", checked)}
              disabled={configSaving}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <UtensilsCrossed className="h-5 w-5 text-orange-500" />
              <div>
                <Label className="text-base">Dietary Restrictions</Label>
                <p className="text-sm text-muted-foreground">Collect dietary restrictions and food preferences</p>
              </div>
            </div>
            <Switch
              checked={config?.collectDietaryRestrictions === true}
              onCheckedChange={(checked) => handleConfigChange("collectDietaryRestrictions", checked)}
              disabled={configSaving}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Shield className="h-5 w-5 text-purple-500" />
              <div>
                <Label className="text-base">Insurance Information</Label>
                <p className="text-sm text-muted-foreground">Collect insurance provider and policy number</p>
              </div>
            </div>
            <Switch
              checked={config?.collectInsuranceInfo === true}
              onCheckedChange={(checked) => handleConfigChange("collectInsuranceInfo", checked)}
              disabled={configSaving}
            />
          </div>
        </CardContent>
      </Card>

      {/* Custom Questions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Custom Questions
          </CardTitle>
          <CardDescription>
            Add custom questions to collect additional information specific to your organization
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
              <p>No custom questions yet</p>
              <p className="text-sm">Add a question to collect additional information</p>
            </div>
          )}

          <Button onClick={handleAddQuestion} className="w-full">
            <Plus className="mr-2 h-4 w-4" />
            Add Custom Question
          </Button>
        </CardContent>
      </Card>

      {/* Question Editor Dialog */}
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
