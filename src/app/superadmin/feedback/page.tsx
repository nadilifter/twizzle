"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import {
  Plus,
  Search,
  MoreHorizontal,
  Pencil,
  Trash2,
  Check,
  Merge,
  Loader2,
  ThumbsUp,
  MessageSquare,
  Calendar,
  Eye,
  User,
  ExternalLink,
} from "lucide-react"
import Link from "next/link"
import { format } from "date-fns"
import { toast } from "sonner"

interface Feature {
  id: string
  title: string
  description: string
  status: "SUBMITTED" | "PLANNED" | "IN_PROGRESS" | "DONE" | "CLOSED"
  isPublic: boolean
  categories: string[]
  targetDate: string | null
  statusChangedAt: string | null
  createdAt: string
  updatedAt: string
  author: {
    id: string
    name: string
    email: string
    avatar: string | null
  } | null
  voteCount: number
  commentCount: number
  mergedCount: number
}

const statusColors: Record<string, string> = {
  SUBMITTED: "bg-yellow-500 text-white",
  PLANNED: "bg-blue-500 text-white",
  IN_PROGRESS: "bg-purple-500 text-white",
  DONE: "bg-green-500 text-white",
  CLOSED: "bg-gray-500 text-white",
}

const statusLabels: Record<string, string> = {
  SUBMITTED: "Submitted",
  PLANNED: "Planned",
  IN_PROGRESS: "In Progress",
  DONE: "Done",
  CLOSED: "Closed",
}

const PREDEFINED_CATEGORIES = [
  "UI/UX",
  "Mobile",
  "Performance",
  "Integrations",
  "Analytics",
  "API",
  "Security",
  "Communication",
  "Scheduling",
  "Athletes",
  "Programs",
  "Financials",
  "Other",
]

export default function SuperadminFeedbackPage() {
  const [features, setFeatures] = useState<Feature[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("submissions")
  const [submissionsCount, setSubmissionsCount] = useState(0)
  const [liveCount, setLiveCount] = useState(0)
  const [searchQuery, setSearchQuery] = useState("")
  
  // Dialog states
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [approveDialogOpen, setApproveDialogOpen] = useState(false)
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)
  const [selectedFeature, setSelectedFeature] = useState<Feature | null>(null)
  const [saving, setSaving] = useState(false)
  
  // Form states
  const [editTitle, setEditTitle] = useState("")
  const [editDescription, setEditDescription] = useState("")
  const [editStatus, setEditStatus] = useState<Feature["status"]>("PLANNED")
  const [editCategories, setEditCategories] = useState<string[]>([])
  const [editTargetDate, setEditTargetDate] = useState("")
  const [mergeTargetId, setMergeTargetId] = useState("")
  
  // Live features for merge target selection
  const [liveFeatures, setLiveFeatures] = useState<Feature[]>([])

  const fetchFeatures = async (tab: string) => {
    setLoading(true)
    try {
      const response = await fetch(`/api/superadmin/feedback?tab=${tab}&search=${searchQuery}`)
      if (response.ok) {
        const data = await response.json()
        setFeatures(data.data || [])
      }
    } catch (error) {
      console.error("Failed to fetch features:", error)
      toast.error("Failed to fetch features")
    } finally {
      setLoading(false)
    }
  }

  const fetchCounts = async () => {
    try {
      const [submissionsRes, liveRes] = await Promise.all([
        fetch("/api/superadmin/feedback?tab=submissions"),
        fetch("/api/superadmin/feedback?tab=live"),
      ])
      if (submissionsRes.ok) {
        const data = await submissionsRes.json()
        setSubmissionsCount(data.total || 0)
      }
      if (liveRes.ok) {
        const data = await liveRes.json()
        setLiveCount(data.total || 0)
        setLiveFeatures(data.data || [])
      }
    } catch (error) {
      console.error("Failed to fetch counts:", error)
    }
  }

  const fetchLiveFeatures = async () => {
    try {
      const response = await fetch("/api/superadmin/feedback?tab=live")
      if (response.ok) {
        const data = await response.json()
        setLiveFeatures(data.data || [])
      }
    } catch (error) {
      console.error("Failed to fetch live features:", error)
    }
  }

  useEffect(() => {
    fetchFeatures(activeTab)
  }, [activeTab, searchQuery])

  useEffect(() => {
    fetchCounts()
  }, [])

  const handleTabChange = (tab: string) => {
    setActiveTab(tab)
  }

  const openEditDialog = (feature: Feature) => {
    setSelectedFeature(feature)
    setEditTitle(feature.title)
    setEditDescription(feature.description)
    setEditStatus(feature.status)
    setEditCategories(feature.categories)
    setEditTargetDate(feature.targetDate ? feature.targetDate.slice(0, 16) : "")
    setEditDialogOpen(true)
  }

  const openApproveDialog = (feature: Feature) => {
    setSelectedFeature(feature)
    setEditCategories(feature.categories)
    setEditTargetDate("")
    setApproveDialogOpen(true)
  }

  const openMergeDialog = async (feature: Feature) => {
    setSelectedFeature(feature)
    setMergeTargetId("")
    await fetchLiveFeatures()
    setMergeDialogOpen(true)
  }

  const openCreateDialog = () => {
    setEditTitle("")
    setEditDescription("")
    setEditStatus("PLANNED")
    setEditCategories([])
    setEditTargetDate("")
    setCreateDialogOpen(true)
  }

  const openDetailDialog = (feature: Feature) => {
    setSelectedFeature(feature)
    setDetailDialogOpen(true)
  }

  const handleCreate = async () => {
    if (!editTitle || !editDescription) {
      toast.error("Title and description are required")
      return
    }

    setSaving(true)
    try {
      const response = await fetch("/api/superadmin/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editTitle,
          description: editDescription,
          status: editStatus,
          isPublic: true,
          categories: editCategories,
          targetDate: editTargetDate ? new Date(editTargetDate).toISOString() : null,
        }),
      })

      if (response.ok) {
        toast.success("Feature created successfully")
        setCreateDialogOpen(false)
        fetchFeatures(activeTab)
      } else {
        const error = await response.json()
        throw new Error(error.error || "Failed to create feature")
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create feature")
    } finally {
      setSaving(false)
    }
  }

  const handleUpdate = async () => {
    if (!selectedFeature) return

    setSaving(true)
    try {
      const response = await fetch(`/api/superadmin/feedback/${selectedFeature.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editTitle,
          description: editDescription,
          status: editStatus,
          categories: editCategories,
          targetDate: editTargetDate ? new Date(editTargetDate).toISOString() : null,
        }),
      })

      if (response.ok) {
        toast.success("Feature updated successfully")
        setEditDialogOpen(false)
        fetchFeatures(activeTab)
      } else {
        const error = await response.json()
        throw new Error(error.error || "Failed to update feature")
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update feature")
    } finally {
      setSaving(false)
    }
  }

  const handleApprove = async () => {
    if (!selectedFeature) return

    setSaving(true)
    try {
      const response = await fetch(`/api/superadmin/feedback/${selectedFeature.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categories: editCategories,
          targetDate: editTargetDate ? new Date(editTargetDate).toISOString() : null,
        }),
      })

      if (response.ok) {
        toast.success("Feature approved and added to roadmap")
        setApproveDialogOpen(false)
        fetchFeatures(activeTab)
        fetchCounts()
      } else {
        const error = await response.json()
        throw new Error(error.error || "Failed to approve feature")
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to approve feature")
    } finally {
      setSaving(false)
    }
  }

  const handleMerge = async () => {
    if (!selectedFeature || !mergeTargetId) return

    setSaving(true)
    try {
      const response = await fetch(`/api/superadmin/feedback/${selectedFeature.id}/merge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetFeatureId: mergeTargetId,
        }),
      })

      if (response.ok) {
        toast.success("Feature merged successfully")
        setMergeDialogOpen(false)
        fetchFeatures(activeTab)
        fetchCounts()
      } else {
        const error = await response.json()
        throw new Error(error.error || "Failed to merge feature")
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to merge feature")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this feature? This action cannot be undone.")) return

    try {
      const response = await fetch(`/api/superadmin/feedback/${id}`, {
        method: "DELETE",
      })

      if (response.ok) {
        toast.success("Feature deleted successfully")
        fetchFeatures(activeTab)
        fetchCounts()
      } else {
        throw new Error("Failed to delete feature")
      }
    } catch (error) {
      toast.error("Failed to delete feature")
    }
  }

  const toggleCategory = (category: string) => {
    setEditCategories((prev) =>
      prev.includes(category)
        ? prev.filter((c) => c !== category)
        : [...prev, category]
    )
  }

  const filteredFeatures = features.filter((f) =>
    f.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    f.description.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const formatQuarter = (date: string | null) => {
    if (!date) return "-"
    const d = new Date(date)
    const quarter = Math.ceil((d.getMonth() + 1) / 3)
    return `Q${quarter} ${d.getFullYear()}`
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Product Feedback</h1>
          <p className="text-muted-foreground">
            Manage user feedback submissions and public roadmap features.
          </p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="mr-2 h-4 w-4" />
          Add Feature
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <div className="flex items-center justify-between gap-4">
          <TabsList>
            <TabsTrigger value="submissions">
              Submissions
              {submissionsCount > 0 && (
                <Badge variant="secondary" className="ml-2">{submissionsCount}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="live">
              Live Features
              {liveCount > 0 && (
                <Badge variant="outline" className="ml-2">{liveCount}</Badge>
              )}
            </TabsTrigger>
          </TabsList>
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search features..."
              className="pl-8"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <TabsContent value="submissions" className="mt-4">
          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : filteredFeatures.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <p className="text-sm text-muted-foreground">
                    {searchQuery ? "No submissions match your search" : "No pending submissions"}
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Submitted By</TableHead>
                      <TableHead>Categories</TableHead>
                      <TableHead>Votes</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredFeatures.map((feature) => (
                      <TableRow key={feature.id}>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium">{feature.title}</span>
                            <span className="text-sm text-muted-foreground line-clamp-1">
                              {feature.description}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {feature.author ? (
                            <Link 
                              href={`/superadmin/users/${feature.author.id}`}
                              className="flex items-center gap-1.5 hover:text-primary transition-colors group"
                            >
                              <User className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
                              <div>
                                <span className="font-medium group-hover:underline">{feature.author.name}</span>
                                <div className="text-xs text-muted-foreground">
                                  {feature.author.email}
                                </div>
                              </div>
                              <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100" />
                            </Link>
                          ) : (
                            <span className="text-muted-foreground">Anonymous</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {feature.categories.slice(0, 2).map((cat) => (
                              <Badge key={cat} variant="outline" className="text-xs">
                                {cat}
                              </Badge>
                            ))}
                            {feature.categories.length > 2 && (
                              <Badge variant="outline" className="text-xs">
                                +{feature.categories.length - 2}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <ThumbsUp className="h-4 w-4 text-muted-foreground" />
                            {feature.voteCount}
                          </div>
                        </TableCell>
                        <TableCell>
                          {format(new Date(feature.createdAt), "MMM d, yyyy")}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openDetailDialog(feature)}>
                                <Eye className="mr-2 h-4 w-4" />
                                View Details
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => openApproveDialog(feature)}>
                                <Check className="mr-2 h-4 w-4" />
                                Accept
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openMergeDialog(feature)}>
                                <Merge className="mr-2 h-4 w-4" />
                                Merge into Existing
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => handleDelete(feature.id)}
                                className="text-destructive"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="live" className="mt-4">
          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : filteredFeatures.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <p className="text-sm text-muted-foreground">
                    {searchQuery ? "No features match your search" : "No live features yet"}
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Target</TableHead>
                      <TableHead>Votes</TableHead>
                      <TableHead>Comments</TableHead>
                      <TableHead>Last Updated</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredFeatures.map((feature) => (
                      <TableRow key={feature.id}>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium">{feature.title}</span>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {feature.categories.slice(0, 2).map((cat) => (
                                <Badge key={cat} variant="outline" className="text-xs">
                                  {cat}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={statusColors[feature.status]}>
                            {statusLabels[feature.status]}
                          </Badge>
                        </TableCell>
                        <TableCell>{formatQuarter(feature.targetDate)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <ThumbsUp className="h-4 w-4 text-muted-foreground" />
                            {feature.voteCount}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <MessageSquare className="h-4 w-4 text-muted-foreground" />
                            {feature.commentCount}
                          </div>
                        </TableCell>
                        <TableCell>
                          {feature.statusChangedAt
                            ? format(new Date(feature.statusChangedAt), "MMM d, yyyy")
                            : "-"}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openDetailDialog(feature)}>
                                <Eye className="mr-2 h-4 w-4" />
                                View Details
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openEditDialog(feature)}>
                                <Pencil className="mr-2 h-4 w-4" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => handleDelete(feature.id)}
                                className="text-destructive"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create Feature Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Add New Feature</DialogTitle>
            <DialogDescription>
              Create a new feature directly on the public roadmap.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="create-title">Title</Label>
              <Input
                id="create-title"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="Feature title"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="create-description">Description</Label>
              <Textarea
                id="create-description"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Describe the feature..."
                rows={4}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Status</Label>
                <Select value={editStatus} onValueChange={(val: any) => setEditStatus(val)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PLANNED">Planned</SelectItem>
                    <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                    <SelectItem value="DONE">Done</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Target Date</Label>
                <Input
                  type="date"
                  value={editTargetDate}
                  onChange={(e) => setEditTargetDate(e.target.value)}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Categories</Label>
              <div className="flex flex-wrap gap-2">
                {PREDEFINED_CATEGORIES.map((cat) => (
                  <Badge
                    key={cat}
                    variant={editCategories.includes(cat) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => toggleCategory(cat)}
                  >
                    {cat}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={saving || !editTitle || !editDescription}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Feature
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Feature Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Edit Feature</DialogTitle>
            <DialogDescription>
              Update feature details, status, and target date.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-title">Title</Label>
              <Input
                id="edit-title"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                rows={4}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Status</Label>
                <Select value={editStatus} onValueChange={(val: any) => setEditStatus(val)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PLANNED">Planned</SelectItem>
                    <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                    <SelectItem value="DONE">Done</SelectItem>
                    <SelectItem value="CLOSED">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Target Date</Label>
                <Input
                  type="date"
                  value={editTargetDate}
                  onChange={(e) => setEditTargetDate(e.target.value)}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Categories</Label>
              <div className="flex flex-wrap gap-2">
                {PREDEFINED_CATEGORIES.map((cat) => (
                  <Badge
                    key={cat}
                    variant={editCategories.includes(cat) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => toggleCategory(cat)}
                  >
                    {cat}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdate} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approve Dialog */}
      <Dialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Accept Submission</DialogTitle>
            <DialogDescription>
              This will add the feature to the public roadmap and notify the submitter.
            </DialogDescription>
          </DialogHeader>
          {selectedFeature && (
            <div className="grid gap-4 py-4">
              <div className="rounded-lg border p-4 bg-muted/50">
                <h4 className="font-medium">{selectedFeature.title}</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  {selectedFeature.description}
                </p>
              </div>
              <div className="grid gap-2">
                <Label>Categories</Label>
                <div className="flex flex-wrap gap-2">
                  {PREDEFINED_CATEGORIES.map((cat) => (
                    <Badge
                      key={cat}
                      variant={editCategories.includes(cat) ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => toggleCategory(cat)}
                    >
                      {cat}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Target Date (optional)</Label>
                <Input
                  type="date"
                  value={editTargetDate}
                  onChange={(e) => setEditTargetDate(e.target.value)}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleApprove} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Accept & Add to Roadmap
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Merge Dialog */}
      <Dialog open={mergeDialogOpen} onOpenChange={setMergeDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Merge into Existing Feature</DialogTitle>
            <DialogDescription>
              Merge this submission into an existing feature. The submitter will be notified.
            </DialogDescription>
          </DialogHeader>
          {selectedFeature && (
            <div className="grid gap-4 py-4">
              <div className="rounded-lg border p-4 bg-muted/50">
                <h4 className="font-medium">{selectedFeature.title}</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  {selectedFeature.description}
                </p>
              </div>
              <div className="grid gap-2">
                <Label>Merge Into</Label>
                <Select value={mergeTargetId} onValueChange={setMergeTargetId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a feature..." />
                  </SelectTrigger>
                  <SelectContent>
                    {liveFeatures
                      .filter((f) => f.id !== selectedFeature.id)
                      .map((f) => (
                        <SelectItem key={f.id} value={f.id}>
                          {f.title}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setMergeDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleMerge} disabled={saving || !mergeTargetId}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Merge Feature
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Feature Details</DialogTitle>
          </DialogHeader>
          {selectedFeature && (
            <div className="grid gap-4 py-4">
              <div>
                <h3 className="text-lg font-semibold">{selectedFeature.title}</h3>
                <div className="flex items-center gap-2 mt-2">
                  <Badge className={statusColors[selectedFeature.status]}>
                    {statusLabels[selectedFeature.status]}
                  </Badge>
                  {selectedFeature.categories.map((cat) => (
                    <Badge key={cat} variant="outline">
                      {cat}
                    </Badge>
                  ))}
                </div>
              </div>
              <p className="text-muted-foreground">{selectedFeature.description}</p>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Submitted by:</span>
                  <p className="font-medium">
                    {selectedFeature.author?.name || "Anonymous"}
                    {selectedFeature.author?.email && (
                      <span className="text-muted-foreground font-normal">
                        {" "}({selectedFeature.author.email})
                      </span>
                    )}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Submitted on:</span>
                  <p className="font-medium">
                    {format(new Date(selectedFeature.createdAt), "MMM d, yyyy 'at' h:mm a")}
                  </p>
                </div>
                {selectedFeature.targetDate && (
                  <div>
                    <span className="text-muted-foreground">Target:</span>
                    <p className="font-medium">{formatQuarter(selectedFeature.targetDate)}</p>
                  </div>
                )}
                <div>
                  <span className="text-muted-foreground">Engagement:</span>
                  <p className="font-medium">
                    {selectedFeature.voteCount} votes, {selectedFeature.commentCount} comments
                  </p>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
