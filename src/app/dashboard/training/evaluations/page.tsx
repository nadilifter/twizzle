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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
  SkillDifficulty, 
  EvaluationTemplateWithSkills,
  EvaluationWithRelations,
  EvaluationStatus,
} from "@/types/evaluations"

const difficultyColors: Record<SkillDifficulty, string> = {
  BEGINNER: "bg-green-500/10 text-green-700 dark:text-green-400",
  INTERMEDIATE: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400",
  ADVANCED: "bg-red-500/10 text-red-700 dark:text-red-400",
}

const difficultyLabels: Record<SkillDifficulty, string> = {
  BEGINNER: "Beginner",
  INTERMEDIATE: "Intermediate",
  ADVANCED: "Advanced",
}

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
  difficultyLevel: SkillDifficulty
  minAge: string
  maxAge: string
  isActive: boolean
  skillIds: string[]
}

const initialFormData: TemplateFormData = {
  name: "",
  description: "",
  difficultyLevel: "BEGINNER",
  minAge: "",
  maxAge: "",
  isActive: true,
  skillIds: [],
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
    if (!formData.name.trim() || formData.skillIds.length === 0) {
      toast.error("Please fill in required fields and select at least one skill")
      return
    }

    setIsSaving(true)
    try {
      await api.post("/api/evaluation-templates", {
        name: formData.name,
        description: formData.description || undefined,
        difficultyLevel: formData.difficultyLevel,
        minAge: formData.minAge ? parseInt(formData.minAge) : undefined,
        maxAge: formData.maxAge ? parseInt(formData.maxAge) : undefined,
        isActive: formData.isActive,
        skillIds: formData.skillIds,
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
    if (!selectedTemplate || !formData.name.trim() || formData.skillIds.length === 0) {
      toast.error("Please fill in required fields and select at least one skill")
      return
    }

    setIsSaving(true)
    try {
      await api.put(`/api/evaluation-templates/${selectedTemplate.id}`, {
        name: formData.name,
        description: formData.description || null,
        difficultyLevel: formData.difficultyLevel,
        minAge: formData.minAge ? parseInt(formData.minAge) : null,
        maxAge: formData.maxAge ? parseInt(formData.maxAge) : null,
        isActive: formData.isActive,
        skillIds: formData.skillIds,
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
      difficultyLevel: template.difficultyLevel,
      minAge: template.minAge?.toString() || "",
      maxAge: template.maxAge?.toString() || "",
      isActive: template.isActive,
      skillIds: template.skills.map((s) => s.skillId),
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
        <TabsList>
          <TabsTrigger value="templates">
            <ClipboardList className="mr-2 h-4 w-4" />
            Templates
          </TabsTrigger>
          <TabsTrigger value="recent">
            <Clock className="mr-2 h-4 w-4" />
            Recent Evaluations
          </TabsTrigger>
        </TabsList>

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
                      <div className="flex items-center gap-2">
                        <Badge className={difficultyColors[template.difficultyLevel]}>
                          {difficultyLabels[template.difficultyLevel]}
                        </Badge>
                        {!template.isActive && (
                          <Badge variant="outline">Inactive</Badge>
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
                        {evaluation.template?.name || evaluation.level}
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
              <Label htmlFor="difficulty">Difficulty Level</Label>
              <Select
                value={formData.difficultyLevel}
                onValueChange={(value) => setFormData({ ...formData, difficultyLevel: value as SkillDifficulty })}
              >
                <SelectTrigger id="difficulty">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BEGINNER">Beginner</SelectItem>
                  <SelectItem value="INTERMEDIATE">Intermediate</SelectItem>
                  <SelectItem value="ADVANCED">Advanced</SelectItem>
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
                                {difficultyLabels[skill.difficultyLevel]}
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
              <Label htmlFor="edit-difficulty">Difficulty Level</Label>
              <Select
                value={formData.difficultyLevel}
                onValueChange={(value) => setFormData({ ...formData, difficultyLevel: value as SkillDifficulty })}
              >
                <SelectTrigger id="edit-difficulty">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BEGINNER">Beginner</SelectItem>
                  <SelectItem value="INTERMEDIATE">Intermediate</SelectItem>
                  <SelectItem value="ADVANCED">Advanced</SelectItem>
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
                                {difficultyLabels[skill.difficultyLevel]}
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
