"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { 
  Plus, 
  Loader2,
  Trash2,
  ClipboardList,
  Calendar,
  Users,
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import { format } from "date-fns"
import { api } from "@/lib/api-client"
import type { 
  EvaluationTemplateWithSkills,
  ProgramEvaluationTemplate,
} from "@/types/evaluations"

interface ProgramEvaluationTemplatesProps {
  programId: string
  programName: string
}

export function ProgramEvaluationTemplates({ programId, programName }: ProgramEvaluationTemplatesProps) {
  const [assignments, setAssignments] = useState<ProgramEvaluationTemplate[]>([])
  const [availableTemplates, setAvailableTemplates] = useState<EvaluationTemplateWithSkills[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false)
  
  // Dialog state
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("")
  const [isRequired, setIsRequired] = useState(false)
  const [dueDate, setDueDate] = useState<string>("")
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState<string | null>(null)

  // Fetch assigned templates
  const fetchAssignments = useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await api.get<{
        programId: string
        programName: string
        templates: ProgramEvaluationTemplate[]
      }>(`/api/programs/${programId}/evaluation-templates`)
      
      setAssignments(response.templates)
    } catch (error) {
      console.error("Error fetching program templates:", error)
      toast.error("Failed to load evaluation templates")
    } finally {
      setIsLoading(false)
    }
  }, [programId])

  // Fetch available templates for assignment
  const fetchAvailableTemplates = async () => {
    setIsLoadingTemplates(true)
    try {
      const response = await api.get<{
        data: EvaluationTemplateWithSkills[]
      }>("/api/evaluation-templates", { isActive: "true", limit: "100" })
      
      // Filter out already assigned templates
      const assignedIds = new Set(assignments.map((a) => a.templateId))
      setAvailableTemplates(response.data.filter((t) => !assignedIds.has(t.id)))
    } catch (error) {
      console.error("Error fetching templates:", error)
    } finally {
      setIsLoadingTemplates(false)
    }
  }

  useEffect(() => {
    fetchAssignments()
  }, [fetchAssignments])

  // Handle assign template
  const handleAssign = async () => {
    if (!selectedTemplateId) {
      toast.error("Please select a template")
      return
    }

    setIsSaving(true)
    try {
      await api.post(`/api/programs/${programId}/evaluation-templates`, {
        templateId: selectedTemplateId,
        isRequired,
        dueDate: dueDate || null,
      })

      toast.success("Template assigned successfully")
      setIsAddDialogOpen(false)
      setSelectedTemplateId("")
      setIsRequired(false)
      setDueDate("")
      fetchAssignments()
    } catch (error) {
      console.error("Error assigning template:", error)
      toast.error("Failed to assign template")
    } finally {
      setIsSaving(false)
    }
  }

  // Handle remove assignment
  const handleRemove = async (templateId: string) => {
    setIsDeleting(templateId)
    try {
      await api.delete(`/api/programs/${programId}/evaluation-templates?templateId=${templateId}`)

      toast.success("Template removed from program")
      fetchAssignments()
    } catch (error) {
      console.error("Error removing template:", error)
      toast.error("Failed to remove template")
    } finally {
      setIsDeleting(null)
    }
  }

  // Handle generate evaluations
  const handleGenerate = async (templateId: string) => {
    setIsGenerating(templateId)
    try {
      const response = await api.post<{
        created: number
        skipped: number
        message?: string
      }>(`/api/programs/${programId}/evaluations`, {
        templateId,
      })

      if (response.created > 0) {
        toast.success(`Created ${response.created} evaluation(s)`)
      } else if (response.message) {
        toast.info(response.message)
      } else {
        toast.info("No new evaluations created")
      }
    } catch (error) {
      console.error("Error generating evaluations:", error)
      toast.error("Failed to generate evaluations")
    } finally {
      setIsGenerating(null)
    }
  }

  // Open add dialog
  const openAddDialog = () => {
    fetchAvailableTemplates()
    setIsAddDialogOpen(true)
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-9 w-32" />
        </div>
        {[1, 2].map((i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Evaluation Templates</h3>
          <p className="text-sm text-muted-foreground">
            Templates assigned to this program
          </p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openAddDialog}>
              <Plus className="mr-2 h-4 w-4" />
              Assign Template
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Assign Evaluation Template</DialogTitle>
              <DialogDescription>
                Add an evaluation template to {programName}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="template">Template</Label>
                {isLoadingTemplates ? (
                  <Skeleton className="h-10 w-full" />
                ) : availableTemplates.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2">
                    No templates available to assign
                  </p>
                ) : (
                  <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                    <SelectTrigger id="template">
                      <SelectValue placeholder="Select a template" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableTemplates.map((template) => (
                        <SelectItem key={template.id} value={template.id}>
                          <div className="flex items-center gap-2">
                            <span>{template.name}</span>
                            {template.level && (
                              <Badge 
                                className="text-xs"
                                style={template.level.color ? { backgroundColor: `${template.level.color}20`, color: template.level.color } : undefined}
                                variant={template.level.color ? "outline" : "secondary"}
                              >
                                {template.level.name}
                              </Badge>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="isRequired">Required for Program</Label>
                <Switch
                  id="isRequired"
                  checked={isRequired}
                  onCheckedChange={setIsRequired}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="dueDate">Due Date (optional)</Label>
                <Input
                  id="dueDate"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAssign} disabled={isSaving || !selectedTemplateId}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Assign
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {assignments.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-8">
            <ClipboardList className="h-12 w-12 text-muted-foreground mb-4" />
            <h4 className="font-semibold mb-2">No Templates Assigned</h4>
            <p className="text-sm text-muted-foreground text-center mb-4">
              Assign evaluation templates to track athlete progress in this program
            </p>
            <Button variant="outline" onClick={openAddDialog}>
              <Plus className="mr-2 h-4 w-4" />
              Assign Template
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {assignments.map((assignment) => (
            <Card key={assignment.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base">
                      {assignment.template?.name || "Unknown Template"}
                    </CardTitle>
                    <CardDescription className="flex items-center gap-2 mt-1">
                      {assignment.template?.level && (
                        <Badge 
                          className="text-xs"
                          style={assignment.template.level.color ? { backgroundColor: `${assignment.template.level.color}20`, color: assignment.template.level.color } : undefined}
                          variant={assignment.template.level.color ? "outline" : "secondary"}
                        >
                          {assignment.template.level.name}
                        </Badge>
                      )}
                      {assignment.isRequired && (
                        <Badge variant="secondary" className="text-xs">Required</Badge>
                      )}
                      {assignment.dueDate && (
                        <span className="flex items-center text-xs">
                          <Calendar className="h-3 w-3 mr-1" />
                          Due: {format(new Date(assignment.dueDate), "MMM d, yyyy")}
                        </span>
                      )}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleGenerate(assignment.templateId)}
                      disabled={isGenerating === assignment.templateId}
                    >
                      {isGenerating === assignment.templateId ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Users className="h-4 w-4 mr-1" />
                          Generate
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRemove(assignment.templateId)}
                      disabled={isDeleting === assignment.templateId}
                    >
                      {isDeleting === assignment.templateId ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-sm text-muted-foreground">
                  {assignment.template?.skills?.length || 0} skills
                  {assignment.template?.achievements && assignment.template.achievements.length > 0 && (
                    <> • {assignment.template.achievements.length} achievement(s)</>
                  )}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
