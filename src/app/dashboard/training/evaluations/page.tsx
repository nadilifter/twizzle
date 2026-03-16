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
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { 
  Plus, 
  Search, 
  Loader2,
  Pencil,
  Trash2,
  ClipboardList,
  CheckCircle,
  XCircle,
  Clock,
} from "lucide-react"
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs"
import { ResponsiveTabsList } from "@/components/ui/responsive-tabs"
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { toast } from "sonner"
import { format } from "date-fns"
import { api } from "@/lib/api-client"
import type { 
  Skill, 
  Level,
  EvaluationTemplateWithSkills,
  EvaluationWithRelations,
  EvaluationStatus,
  ScoringType,
  CompletionType,
} from "@/types/evaluations"

const statusColors: Record<EvaluationStatus, string> = {
  PENDING: "bg-slate-500/10 text-slate-700 dark:text-slate-400",
  IN_PROGRESS: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  PASS: "bg-green-500/10 text-green-700 dark:text-green-400",
  RETRY: "bg-red-500/10 text-red-700 dark:text-red-400",
  EXCELLENT: "bg-purple-500/10 text-purple-700 dark:text-purple-400",
  SATISFACTORY: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400",
}

const statusLabels: Record<EvaluationStatus, string> = {
  PENDING: "Pending",
  IN_PROGRESS: "In Progress",
  PASS: "Pass",
  RETRY: "Retry",
  EXCELLENT: "Excellent",
  SATISFACTORY: "Satisfactory",
}

interface TemplateFormData {
  name: string
  description: string
  levelId: string
  minAge: string
  maxAge: string
  isActive: boolean
  skillIds: string[]
  // Auto-sync configuration
  autoSyncEnabled: boolean
  autoSyncLevels: string[]
  autoSyncCategories: string[]
  // Scoring configuration
  scoringType: ScoringType
  pointScaleMin: string
  pointScaleMax: string
  pointScalePassThreshold: string
  // Completion requirements
  completionType: CompletionType
  completionThreshold: string
}

const initialFormData: TemplateFormData = {
  name: "",
  description: "",
  levelId: "",
  minAge: "",
  maxAge: "",
  isActive: true,
  skillIds: [],
  // Auto-sync defaults
  autoSyncEnabled: false,
  autoSyncLevels: [],
  autoSyncCategories: [],
  // Scoring defaults
  scoringType: "PASS_FAIL",
  pointScaleMin: "1",
  pointScaleMax: "10",
  pointScalePassThreshold: "7",
  // Completion defaults
  completionType: "PERCENTAGE",
  completionThreshold: "80",
}

const scoringTypeLabels: Record<ScoringType, string> = {
  PASS_FAIL: "Pass/Fail",
  POINT_SCALE: "Point Scale",
}

const completionTypeLabels: Record<CompletionType, string> = {
  PERCENTAGE: "Percentage",
  COUNT: "Number of Skills",
  ALL: "All Required Skills",
}

export default function EvaluationsPage() {
  const [activeTab, setActiveTab] = useState("templates")
  
  // Templates state
  const [templates, setTemplates] = useState<EvaluationTemplateWithSkills[]>([])
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(true)
  const [templateSearch, setTemplateSearch] = useState("")
  
  // Evaluations state
  const [evaluations, setEvaluations] = useState<EvaluationWithRelations[]>([])
  const [isLoadingEvaluations, setIsLoadingEvaluations] = useState(true)
  const [evaluationSearch, setEvaluationSearch] = useState("")
  
  // Skills for template form
  const [skills, setSkills] = useState<Skill[]>([])
  const [isLoadingSkills, setIsLoadingSkills] = useState(false)

  // Levels for template form
  const [levels, setLevels] = useState<Level[]>([])
  
  // Form state
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<EvaluationTemplateWithSkills | null>(null)
  const [formData, setFormData] = useState<TemplateFormData>(initialFormData)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  // Fetch templates
  const fetchTemplates = useCallback(async () => {
    setIsLoadingTemplates(true)
    try {
      const params: Record<string, string> = {}
      if (templateSearch) params.search = templateSearch

      const response = await api.get<{
        data: EvaluationTemplateWithSkills[]
        total: number
      }>("/api/evaluation-templates", params)
      
      setTemplates(response.data)
    } catch (error) {
      console.error("Error fetching templates:", error)
      toast.error("Failed to load evaluation templates")
    } finally {
      setIsLoadingTemplates(false)
    }
  }, [templateSearch])

  // Fetch evaluations
  const fetchEvaluations = useCallback(async () => {
    setIsLoadingEvaluations(true)
    try {
      const params: Record<string, string> = { limit: "50" }

      const response = await api.get<{
        data: EvaluationWithRelations[]
        total: number
      }>("/api/evaluations", params)
      
      setEvaluations(response.data)
    } catch (error) {
      console.error("Error fetching evaluations:", error)
      toast.error("Failed to load evaluations")
    } finally {
      setIsLoadingEvaluations(false)
    }
  }, [])

  // Fetch skills for template form
  const fetchSkills = async () => {
    setIsLoadingSkills(true)
    try {
      const response = await api.get<{ data: Skill[] }>("/api/skills", { limit: "500" })
      setSkills(response.data)
    } catch (error) {
      console.error("Error fetching skills:", error)
    } finally {
      setIsLoadingSkills(false)
    }
  }

  // Fetch levels
  const fetchLevels = async () => {
    try {
      const response = await api.get<Level[]>("/api/levels")
      setLevels(response)
    } catch (error) {
      console.error("Error fetching levels:", error)
    }
  }

  // Load levels on mount
  useEffect(() => {
    fetchLevels()
  }, [])

  useEffect(() => {
    if (activeTab === "templates") {
      const debounce = setTimeout(() => {
        fetchTemplates()
      }, 300)
      return () => clearTimeout(debounce)
    } else {
      fetchEvaluations()
    }
  }, [activeTab, fetchTemplates, fetchEvaluations])

  // Handle create template
  const handleCreate = async () => {
    if (!formData.name.trim()) {
      toast.error("Please fill in required fields")
      return
    }
    
    // Either auto-sync must be enabled or skills must be selected
    if (!formData.autoSyncEnabled && formData.skillIds.length === 0) {
      toast.error("Please enable auto-sync or select at least one skill")
      return
    }

    setIsSaving(true)
    try {
      await api.post("/api/evaluation-templates", {
        name: formData.name,
        description: formData.description || undefined,
        levelId: formData.levelId || null,
        minAge: formData.minAge ? parseInt(formData.minAge) : undefined,
        maxAge: formData.maxAge ? parseInt(formData.maxAge) : undefined,
        isActive: formData.isActive,
        // Auto-sync
        autoSyncEnabled: formData.autoSyncEnabled,
        autoSyncLevels: formData.autoSyncLevels,
        autoSyncCategories: formData.autoSyncCategories,
        // Scoring
        scoringType: formData.scoringType,
        pointScaleMin: formData.pointScaleMin ? parseInt(formData.pointScaleMin) : 1,
        pointScaleMax: formData.pointScaleMax ? parseInt(formData.pointScaleMax) : 10,
        pointScalePassThreshold: formData.pointScalePassThreshold ? parseInt(formData.pointScalePassThreshold) : 7,
        // Completion
        completionType: formData.completionType,
        completionThreshold: formData.completionThreshold ? parseFloat(formData.completionThreshold) : 80,
        // Skills (only if not auto-syncing)
        skillIds: formData.autoSyncEnabled ? undefined : formData.skillIds,
      })

      toast.success("Evaluation template created successfully")
      setIsCreateOpen(false)
      setFormData(initialFormData)
      fetchTemplates()
    } catch (error) {
      console.error("Error creating template:", error)
      toast.error("Failed to create evaluation template")
    } finally {
      setIsSaving(false)
    }
  }

  // Handle update template
  const handleUpdate = async () => {
    if (!selectedTemplate || !formData.name.trim()) {
      toast.error("Please fill in required fields")
      return
    }
    
    // Either auto-sync must be enabled or skills must be selected
    if (!formData.autoSyncEnabled && formData.skillIds.length === 0) {
      toast.error("Please enable auto-sync or select at least one skill")
      return
    }

    setIsSaving(true)
    try {
      await api.put(`/api/evaluation-templates/${selectedTemplate.id}`, {
        name: formData.name,
        description: formData.description || null,
        levelId: formData.levelId || null,
        minAge: formData.minAge ? parseInt(formData.minAge) : null,
        maxAge: formData.maxAge ? parseInt(formData.maxAge) : null,
        isActive: formData.isActive,
        // Auto-sync
        autoSyncEnabled: formData.autoSyncEnabled,
        autoSyncLevels: formData.autoSyncLevels,
        autoSyncCategories: formData.autoSyncCategories,
        // Scoring
        scoringType: formData.scoringType,
        pointScaleMin: formData.pointScaleMin ? parseInt(formData.pointScaleMin) : 1,
        pointScaleMax: formData.pointScaleMax ? parseInt(formData.pointScaleMax) : 10,
        pointScalePassThreshold: formData.pointScalePassThreshold ? parseInt(formData.pointScalePassThreshold) : 7,
        // Completion
        completionType: formData.completionType,
        completionThreshold: formData.completionThreshold ? parseFloat(formData.completionThreshold) : 80,
        // Skills (only if not auto-syncing)
        skillIds: formData.autoSyncEnabled ? undefined : formData.skillIds,
      })

      toast.success("Evaluation template updated successfully")
      setIsEditOpen(false)
      setSelectedTemplate(null)
      setFormData(initialFormData)
      fetchTemplates()
    } catch (error) {
      console.error("Error updating template:", error)
      toast.error("Failed to update evaluation template")
    } finally {
      setIsSaving(false)
    }
  }

  // Handle delete template
  const handleDelete = async () => {
    if (!selectedTemplate) return

    setIsDeleting(true)
    try {
      await api.delete(`/api/evaluation-templates/${selectedTemplate.id}`)

      toast.success("Evaluation template deleted successfully")
      setIsDeleteDialogOpen(false)
      setSelectedTemplate(null)
      fetchTemplates()
    } catch (error: unknown) {
      console.error("Error deleting template:", error)
      const errorMessage = error instanceof Error && 'message' in error 
        ? error.message 
        : "Failed to delete template"
      toast.error(errorMessage)
    } finally {
      setIsDeleting(false)
    }
  }

  // Open create sheet
  const openCreate = () => {
    setFormData(initialFormData)
    fetchSkills()
    setIsCreateOpen(true)
  }

  // Open edit sheet
  const openEdit = (template: EvaluationTemplateWithSkills) => {
    setSelectedTemplate(template)
    setFormData({
      name: template.name,
      description: template.description || "",
      levelId: template.levelId || "",
      minAge: template.minAge?.toString() || "",
      maxAge: template.maxAge?.toString() || "",
      isActive: template.isActive,
      skillIds: template.skills.map((s) => s.skillId),
      // Auto-sync
      autoSyncEnabled: template.autoSyncEnabled || false,
      autoSyncLevels: template.autoSyncLevels || [],
      autoSyncCategories: template.autoSyncCategories || [],
      // Scoring
      scoringType: template.scoringType || "PASS_FAIL",
      pointScaleMin: template.pointScaleMin?.toString() || "1",
      pointScaleMax: template.pointScaleMax?.toString() || "10",
      pointScalePassThreshold: template.pointScalePassThreshold?.toString() || "7",
      // Completion
      completionType: template.completionType || "PERCENTAGE",
      completionThreshold: template.completionThreshold?.toString() || "80",
    })
    fetchSkills()
    setIsEditOpen(true)
  }

  // Toggle skill selection
  const toggleSkill = (skillId: string) => {
    setFormData((prev) => ({
      ...prev,
      skillIds: prev.skillIds.includes(skillId)
        ? prev.skillIds.filter((id) => id !== skillId)
        : [...prev.skillIds, skillId],
    }))
  }

  // Get age range display
  const getAgeRange = (template: EvaluationTemplateWithSkills) => {
    if (template.minAge && template.maxAge) {
      return `Ages ${template.minAge}-${template.maxAge}`
    } else if (template.minAge) {
      return `Ages ${template.minAge}+`
    } else if (template.maxAge) {
      return `Ages up to ${template.maxAge}`
    }
    return "All ages"
  }

  // Filtered evaluations
  const filteredEvaluations = evaluations.filter((evaluation) => {
    if (evaluationSearch) {
      const search = evaluationSearch.toLowerCase()
      return (
        evaluation.athlete.name.toLowerCase().includes(search) ||
        evaluation.template?.name.toLowerCase().includes(search)
      )
    }
    return true
  })

  // Group skills by category
  const skillsByCategory = skills.reduce((acc, skill) => {
    if (!acc[skill.category]) {
      acc[skill.category] = []
    }
    acc[skill.category].push(skill)
    return acc
  }, {} as Record<string, Skill[]>)

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Evaluations</h1>
          <p className="text-muted-foreground">
            Manage evaluation templates and view evaluation results.
          </p>
        </div>
        {activeTab === "templates" && (
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            New Template
          </Button>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <ResponsiveTabsList value={activeTab} onValueChange={setActiveTab}>
          <TabsTrigger value="templates">
            <ClipboardList className="mr-2 h-4 w-4" />
            Templates
          </TabsTrigger>
          <TabsTrigger value="recent">
            <Clock className="mr-2 h-4 w-4" />
            Recent Evaluations
          </TabsTrigger>
        </ResponsiveTabsList>

        <TabsContent value="templates" className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search templates..."
                className="pl-8"
                value={templateSearch}
                onChange={(e) => setTemplateSearch(e.target.value)}
              />
            </div>
          </div>

          {isLoadingTemplates ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <Card key={i}>
                  <CardHeader>
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-4 w-full mb-2" />
                    <Skeleton className="h-4 w-2/3" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : templates.length === 0 ? (
            <div className="text-center py-12">
              <ClipboardList className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-semibold mb-2">No Evaluation Templates</h3>
              <p className="text-muted-foreground mb-4">
                Create your first evaluation template to get started.
              </p>
              <Button onClick={openCreate}>
                <Plus className="mr-2 h-4 w-4" />
                New Template
              </Button>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {templates.map((template) => (
                <Card key={template.id} className="relative">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">{template.name}</CardTitle>
                        <CardDescription>{getAgeRange(template)}</CardDescription>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap justify-end">
                        {template.level && (
                          <Badge 
                            style={template.level.color ? { backgroundColor: `${template.level.color}20`, color: template.level.color } : undefined}
                            variant={template.level.color ? "outline" : "secondary"}
                          >
                            {template.level.name}
                          </Badge>
                        )}
                        {!template.isActive && (
                          <Badge variant="outline">Inactive</Badge>
                        )}
                        {template.autoSyncEnabled && (
                          <Badge variant="secondary">Auto-sync</Badge>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {template.description && (
                      <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                        {template.description}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-2 mb-3">
                      <Badge variant="outline" className="text-xs">
                        {scoringTypeLabels[template.scoringType || "PASS_FAIL"]}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {template.completionType === "ALL" 
                          ? "All skills required" 
                          : template.completionType === "PERCENTAGE"
                            ? `${template.completionThreshold}% to pass`
                            : `${template.completionThreshold} skills to pass`}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <span>{template.skills.length} skills</span>
                      <span>{template._count?.evaluations || 0} evaluations</span>
                    </div>
                    <div className="flex gap-2 mt-4">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => openEdit(template)}
                      >
                        <Pencil className="mr-2 h-3 w-3" />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedTemplate(template)
                          setIsDeleteDialogOpen(true)
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="recent" className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search evaluations..."
                className="pl-8"
                value={evaluationSearch}
                onChange={(e) => setEvaluationSearch(e.target.value)}
              />
            </div>
          </div>

          {isLoadingEvaluations ? (
            <Card>
              <CardContent className="p-6">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-12 w-full mb-2" />
                ))}
              </CardContent>
            </Card>
          ) : filteredEvaluations.length === 0 ? (
            <div className="text-center py-12">
              <ClipboardList className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-semibold mb-2">No Evaluations Found</h3>
              <p className="text-muted-foreground">
                {evaluationSearch
                  ? "Try adjusting your search"
                  : "Evaluations will appear here once created"}
              </p>
            </div>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Athlete</TableHead>
                    <TableHead>Template</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Coach</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Score</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEvaluations.map((evaluation) => (
                    <TableRow key={evaluation.id}>
                      <TableCell className="font-medium">
                        {evaluation.athlete.name}
                      </TableCell>
                      <TableCell>
                        {evaluation.template?.name || evaluation.level?.name || "—"}
                      </TableCell>
                      <TableCell>
                        {format(new Date(evaluation.date), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell>{evaluation.coach.name}</TableCell>
                      <TableCell>
                        <Badge className={statusColors[evaluation.status]}>
                          {statusLabels[evaluation.status]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {Number(evaluation.overallScore).toFixed(1)}/10
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Create Template Sheet */}
      <Sheet open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <SheetContent className="sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Create Evaluation Template</SheetTitle>
            <SheetDescription>
              Group skills together to create a reusable evaluation template.
            </SheetDescription>
          </SheetHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Template Name *</Label>
              <Input
                id="name"
                placeholder="e.g. Beginner Floor Assessment"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Describe this evaluation template..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={2}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="difficulty">Level</Label>
              <Select
                value={formData.levelId || "none"}
                onValueChange={(value) => setFormData({ ...formData, levelId: value === "none" ? "" : value })}
              >
                <SelectTrigger id="difficulty">
                  <SelectValue placeholder="Select a level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No level</SelectItem>
                  {levels.map((level) => (
                    <SelectItem key={level.id} value={level.id}>
                      {level.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="minAge">Min Age</Label>
                <Input
                  id="minAge"
                  type="number"
                  min="0"
                  max="100"
                  placeholder="e.g. 4"
                  value={formData.minAge}
                  onChange={(e) => setFormData({ ...formData, minAge: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="maxAge">Max Age</Label>
                <Input
                  id="maxAge"
                  type="number"
                  min="0"
                  max="100"
                  placeholder="e.g. 18"
                  value={formData.maxAge}
                  onChange={(e) => setFormData({ ...formData, maxAge: e.target.value })}
                />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="isActive">Active</Label>
              <Switch
                id="isActive"
                checked={formData.isActive}
                onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
              />
            </div>

            {/* Scoring Configuration */}
            <div className="border rounded-lg p-4 space-y-4">
              <h4 className="font-medium">Scoring Configuration</h4>
              <div className="grid gap-2">
                <Label htmlFor="scoringType">Scoring Type</Label>
                <Select
                  value={formData.scoringType}
                  onValueChange={(value) => setFormData({ ...formData, scoringType: value as ScoringType })}
                >
                  <SelectTrigger id="scoringType">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PASS_FAIL">Pass/Fail (3 states)</SelectItem>
                    <SelectItem value="POINT_SCALE">Point Scale</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {formData.scoringType === "PASS_FAIL" 
                    ? "Skills are marked as Not Attempted, Attempted, or Passed"
                    : "Skills are scored on a numeric scale"}
                </p>
              </div>
              {formData.scoringType === "POINT_SCALE" && (
                <div className="grid grid-cols-3 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="pointScaleMin">Min Score</Label>
                    <Input
                      id="pointScaleMin"
                      type="number"
                      min="0"
                      max="100"
                      value={formData.pointScaleMin}
                      onChange={(e) => setFormData({ ...formData, pointScaleMin: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="pointScaleMax">Max Score</Label>
                    <Input
                      id="pointScaleMax"
                      type="number"
                      min="1"
                      max="100"
                      value={formData.pointScaleMax}
                      onChange={(e) => setFormData({ ...formData, pointScaleMax: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="pointScalePassThreshold">Pass Threshold</Label>
                    <Input
                      id="pointScalePassThreshold"
                      type="number"
                      min="0"
                      max="100"
                      value={formData.pointScalePassThreshold}
                      onChange={(e) => setFormData({ ...formData, pointScalePassThreshold: e.target.value })}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Completion Requirements */}
            <div className="border rounded-lg p-4 space-y-4">
              <h4 className="font-medium">Completion Requirements</h4>
              <div className="grid gap-2">
                <Label htmlFor="completionType">Completion Type</Label>
                <Select
                  value={formData.completionType}
                  onValueChange={(value) => setFormData({ ...formData, completionType: value as CompletionType })}
                >
                  <SelectTrigger id="completionType">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PERCENTAGE">Percentage of Skills</SelectItem>
                    <SelectItem value="COUNT">Number of Skills</SelectItem>
                    <SelectItem value="ALL">All Required Skills</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {formData.completionType !== "ALL" && (
                <div className="grid gap-2">
                  <Label htmlFor="completionThreshold">
                    {formData.completionType === "PERCENTAGE" ? "Required Percentage" : "Required Count"}
                  </Label>
                  <Input
                    id="completionThreshold"
                    type="number"
                    min="0"
                    max={formData.completionType === "PERCENTAGE" ? "100" : "1000"}
                    value={formData.completionThreshold}
                    onChange={(e) => setFormData({ ...formData, completionThreshold: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    {formData.completionType === "PERCENTAGE"
                      ? `Athletes must pass ${formData.completionThreshold}% of required skills to complete this evaluation`
                      : `Athletes must pass ${formData.completionThreshold} skills to complete this evaluation`}
                  </p>
                </div>
              )}
            </div>

            {/* Auto-Sync Configuration */}
            <div className="border rounded-lg p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">Auto-Sync Skills</h4>
                  <p className="text-xs text-muted-foreground">Automatically include skills by level and category</p>
                </div>
                <Switch
                  checked={formData.autoSyncEnabled}
                  onCheckedChange={(checked) => setFormData({ ...formData, autoSyncEnabled: checked })}
                />
              </div>
              {formData.autoSyncEnabled && (
                <>
                  <div className="grid gap-2">
                    <Label>Levels</Label>
                    <div className="flex flex-wrap gap-2">
                      {levels.map((level) => (
                        <label key={level.id} className="flex items-center gap-2">
                          <Checkbox
                            checked={formData.autoSyncLevels.includes(level.id)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setFormData({ ...formData, autoSyncLevels: [...formData.autoSyncLevels, level.id] })
                              } else {
                                setFormData({ ...formData, autoSyncLevels: formData.autoSyncLevels.filter((l) => l !== level.id) })
                              }
                            }}
                          />
                          <span className="text-sm">{level.name}</span>
                        </label>
                      ))}
                      {levels.length === 0 && (
                        <p className="text-xs text-muted-foreground">No levels available</p>
                      )}
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label>Categories</Label>
                    <div className="flex flex-wrap gap-2">
                      {Object.keys(skillsByCategory).map((category) => (
                        <label key={category} className="flex items-center gap-2">
                          <Checkbox
                            checked={formData.autoSyncCategories.includes(category)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setFormData({ ...formData, autoSyncCategories: [...formData.autoSyncCategories, category] })
                              } else {
                                setFormData({ ...formData, autoSyncCategories: formData.autoSyncCategories.filter((c) => c !== category) })
                              }
                            }}
                          />
                          <span className="text-sm">{category}</span>
                        </label>
                      ))}
                    </div>
                    {Object.keys(skillsByCategory).length === 0 && (
                      <p className="text-xs text-muted-foreground">No categories available</p>
                    )}
                  </div>
                </>
              )}
            </div>

            {!formData.autoSyncEnabled && (
            <div className="grid gap-2">
              <Label>Skills * ({formData.skillIds.length} selected)</Label>
              {isLoadingSkills ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : skills.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">
                  No skills available. Create skills first.
                </p>
              ) : (
                <div className="border rounded-lg max-h-[300px] overflow-y-auto">
                  {Object.entries(skillsByCategory).map(([category, categorySkills]) => (
                    <div key={category} className="border-b last:border-b-0">
                      <div className="px-3 py-2 bg-muted/50 font-medium text-sm">
                        {category}
                      </div>
                      <div className="divide-y">
                        {categorySkills.map((skill) => (
                          <label
                            key={skill.id}
                            className="flex items-center gap-3 px-3 py-2 hover:bg-muted/30 cursor-pointer"
                          >
                            <Checkbox
                              checked={formData.skillIds.includes(skill.id)}
                              onCheckedChange={() => toggleSkill(skill.id)}
                            />
                            <div className="flex-1">
                              <div className="text-sm font-medium">{skill.name}</div>
                              <div className="text-xs text-muted-foreground">
                                {skill.skillLevel?.name || "No level"}
                              </div>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            )}
          </div>
          <SheetFooter>
            <Button onClick={handleCreate} disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Template
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Edit Template Sheet */}
      <Sheet open={isEditOpen} onOpenChange={setIsEditOpen}>
        <SheetContent className="sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Edit Evaluation Template</SheetTitle>
            <SheetDescription>
              Update template details and skills.
            </SheetDescription>
          </SheetHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-name">Template Name *</Label>
              <Input
                id="edit-name"
                placeholder="e.g. Beginner Floor Assessment"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                placeholder="Describe this evaluation template..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={2}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-difficulty">Level</Label>
              <Select
                value={formData.levelId || "none"}
                onValueChange={(value) => setFormData({ ...formData, levelId: value === "none" ? "" : value })}
              >
                <SelectTrigger id="edit-difficulty">
                  <SelectValue placeholder="Select a level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No level</SelectItem>
                  {levels.map((level) => (
                    <SelectItem key={level.id} value={level.id}>
                      {level.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-minAge">Min Age</Label>
                <Input
                  id="edit-minAge"
                  type="number"
                  min="0"
                  max="100"
                  placeholder="e.g. 4"
                  value={formData.minAge}
                  onChange={(e) => setFormData({ ...formData, minAge: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-maxAge">Max Age</Label>
                <Input
                  id="edit-maxAge"
                  type="number"
                  min="0"
                  max="100"
                  placeholder="e.g. 18"
                  value={formData.maxAge}
                  onChange={(e) => setFormData({ ...formData, maxAge: e.target.value })}
                />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="edit-isActive">Active</Label>
              <Switch
                id="edit-isActive"
                checked={formData.isActive}
                onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
              />
            </div>

            {/* Scoring Configuration */}
            <div className="border rounded-lg p-4 space-y-4">
              <h4 className="font-medium">Scoring Configuration</h4>
              <div className="grid gap-2">
                <Label htmlFor="edit-scoringType">Scoring Type</Label>
                <Select
                  value={formData.scoringType}
                  onValueChange={(value) => setFormData({ ...formData, scoringType: value as ScoringType })}
                >
                  <SelectTrigger id="edit-scoringType">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PASS_FAIL">Pass/Fail (3 states)</SelectItem>
                    <SelectItem value="POINT_SCALE">Point Scale</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {formData.scoringType === "POINT_SCALE" && (
                <div className="grid grid-cols-3 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="edit-pointScaleMin">Min Score</Label>
                    <Input
                      id="edit-pointScaleMin"
                      type="number"
                      min="0"
                      max="100"
                      value={formData.pointScaleMin}
                      onChange={(e) => setFormData({ ...formData, pointScaleMin: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="edit-pointScaleMax">Max Score</Label>
                    <Input
                      id="edit-pointScaleMax"
                      type="number"
                      min="1"
                      max="100"
                      value={formData.pointScaleMax}
                      onChange={(e) => setFormData({ ...formData, pointScaleMax: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="edit-pointScalePassThreshold">Pass Threshold</Label>
                    <Input
                      id="edit-pointScalePassThreshold"
                      type="number"
                      min="0"
                      max="100"
                      value={formData.pointScalePassThreshold}
                      onChange={(e) => setFormData({ ...formData, pointScalePassThreshold: e.target.value })}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Completion Requirements */}
            <div className="border rounded-lg p-4 space-y-4">
              <h4 className="font-medium">Completion Requirements</h4>
              <div className="grid gap-2">
                <Label htmlFor="edit-completionType">Completion Type</Label>
                <Select
                  value={formData.completionType}
                  onValueChange={(value) => setFormData({ ...formData, completionType: value as CompletionType })}
                >
                  <SelectTrigger id="edit-completionType">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PERCENTAGE">Percentage of Skills</SelectItem>
                    <SelectItem value="COUNT">Number of Skills</SelectItem>
                    <SelectItem value="ALL">All Required Skills</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {formData.completionType !== "ALL" && (
                <div className="grid gap-2">
                  <Label htmlFor="edit-completionThreshold">
                    {formData.completionType === "PERCENTAGE" ? "Required Percentage" : "Required Count"}
                  </Label>
                  <Input
                    id="edit-completionThreshold"
                    type="number"
                    min="0"
                    max={formData.completionType === "PERCENTAGE" ? "100" : "1000"}
                    value={formData.completionThreshold}
                    onChange={(e) => setFormData({ ...formData, completionThreshold: e.target.value })}
                  />
                </div>
              )}
            </div>

            {/* Auto-Sync Configuration */}
            <div className="border rounded-lg p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">Auto-Sync Skills</h4>
                  <p className="text-xs text-muted-foreground">Automatically include skills by level and category</p>
                </div>
                <Switch
                  checked={formData.autoSyncEnabled}
                  onCheckedChange={(checked) => setFormData({ ...formData, autoSyncEnabled: checked })}
                />
              </div>
              {formData.autoSyncEnabled && (
                <>
                  <div className="grid gap-2">
                    <Label>Levels</Label>
                    <div className="flex flex-wrap gap-2">
                      {levels.map((level) => (
                        <label key={level.id} className="flex items-center gap-2">
                          <Checkbox
                            checked={formData.autoSyncLevels.includes(level.id)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setFormData({ ...formData, autoSyncLevels: [...formData.autoSyncLevels, level.id] })
                              } else {
                                setFormData({ ...formData, autoSyncLevels: formData.autoSyncLevels.filter((l) => l !== level.id) })
                              }
                            }}
                          />
                          <span className="text-sm">{level.name}</span>
                        </label>
                      ))}
                      {levels.length === 0 && (
                        <p className="text-xs text-muted-foreground">No levels available</p>
                      )}
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label>Categories</Label>
                    <div className="flex flex-wrap gap-2">
                      {Object.keys(skillsByCategory).map((category) => (
                        <label key={category} className="flex items-center gap-2">
                          <Checkbox
                            checked={formData.autoSyncCategories.includes(category)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setFormData({ ...formData, autoSyncCategories: [...formData.autoSyncCategories, category] })
                              } else {
                                setFormData({ ...formData, autoSyncCategories: formData.autoSyncCategories.filter((c) => c !== category) })
                              }
                            }}
                          />
                          <span className="text-sm">{category}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>

            {!formData.autoSyncEnabled && (
            <div className="grid gap-2">
              <Label>Skills * ({formData.skillIds.length} selected)</Label>
              {isLoadingSkills ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : (
                <div className="border rounded-lg max-h-[300px] overflow-y-auto">
                  {Object.entries(skillsByCategory).map(([category, categorySkills]) => (
                    <div key={category} className="border-b last:border-b-0">
                      <div className="px-3 py-2 bg-muted/50 font-medium text-sm">
                        {category}
                      </div>
                      <div className="divide-y">
                        {categorySkills.map((skill) => (
                          <label
                            key={skill.id}
                            className="flex items-center gap-3 px-3 py-2 hover:bg-muted/30 cursor-pointer"
                          >
                            <Checkbox
                              checked={formData.skillIds.includes(skill.id)}
                              onCheckedChange={() => toggleSkill(skill.id)}
                            />
                            <div className="flex-1">
                              <div className="text-sm font-medium">{skill.name}</div>
                              <div className="text-xs text-muted-foreground">
                                {skill.skillLevel?.name || "No level"}
                              </div>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            )}
          </div>
          <SheetFooter>
            <Button onClick={handleUpdate} disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Evaluation Template</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{selectedTemplate?.name}&quot;? This action cannot be undone.
              {selectedTemplate?._count?.evaluations && selectedTemplate._count.evaluations > 0 && (
                <span className="block mt-2 text-yellow-600">
                  Note: This template has {selectedTemplate._count.evaluations} evaluation(s) associated with it.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeleting}
            >
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
