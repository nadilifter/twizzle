"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Plus,
  Search,
  MoreHorizontal,
  Loader2,
  Pencil,
  Trash2,
  Award,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Checkbox } from "@/components/ui/checkbox"
import { Slider } from "@/components/ui/slider"
import { toast } from "sonner"
import type {
  Certification,
  CertificationEvaluationMethod,
} from "@/types/certifications"

const RENEWAL_OPTIONS = [
  { label: "None (one-time)", value: "none" },
  { label: "1 month", value: "1" },
  { label: "3 months", value: "3" },
  { label: "6 months", value: "6" },
  { label: "1 year", value: "12" },
  { label: "2 years", value: "24" },
  { label: "3 years", value: "36" },
  { label: "Custom", value: "custom" },
]

function formatRenewalPeriod(months: number | null): string {
  if (months === null) return "One-time"
  if (months === 1) return "1 month"
  if (months < 12) return `${months} months`
  if (months === 12) return "1 year"
  if (months % 12 === 0) return `${months / 12} years`
  return `${months} months`
}

interface CertFormData {
  name: string
  description: string
  criteria: string
  evaluationMethod: CertificationEvaluationMethod
  pointScaleMin: number
  pointScaleMax: number
  passThreshold: number
  renewalPeriodMonths: number | null
  requiredForPrograms: boolean
  requiredForEvents: boolean
  requiredForCompetitions: boolean
  isActive: boolean
}

const defaultFormData: CertFormData = {
  name: "",
  description: "",
  criteria: "",
  evaluationMethod: "PASS_FAIL",
  pointScaleMin: 1,
  pointScaleMax: 10,
  passThreshold: 7,
  renewalPeriodMonths: null,
  requiredForPrograms: false,
  requiredForEvents: false,
  requiredForCompetitions: false,
  isActive: true,
}

export default function CertificationsPage() {
  const [certifications, setCertifications] = useState<(Certification & { _count: { memberCertifications: number } })[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState("")

  // Form state
  const [formOpen, setFormOpen] = useState(false)
  const [editingCert, setEditingCert] = useState<Certification | null>(null)
  const [formData, setFormData] = useState<CertFormData>(defaultFormData)
  const [renewalOption, setRenewalOption] = useState("none")
  const [customRenewal, setCustomRenewal] = useState("")

  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [certToDelete, setCertToDelete] = useState<Certification | null>(null)

  const fetchCertifications = useCallback(async () => {
    try {
      const res = await fetch("/api/organization/certifications")
      if (!res.ok) throw new Error("Failed to fetch certifications")
      const data = await res.json()
      setCertifications(data)
    } catch {
      toast.error("Failed to load certifications")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchCertifications()
  }, [fetchCertifications])

  const openCreateForm = () => {
    setEditingCert(null)
    setFormData(defaultFormData)
    setRenewalOption("none")
    setCustomRenewal("")
    setFormOpen(true)
  }

  const openEditForm = (cert: Certification) => {
    setEditingCert(cert)
    setFormData({
      name: cert.name,
      description: cert.description || "",
      criteria: cert.criteria || "",
      evaluationMethod: cert.evaluationMethod,
      pointScaleMin: cert.pointScaleMin,
      pointScaleMax: cert.pointScaleMax,
      passThreshold: cert.passThreshold,
      renewalPeriodMonths: cert.renewalPeriodMonths,
      requiredForPrograms: cert.requiredForPrograms,
      requiredForEvents: cert.requiredForEvents,
      requiredForCompetitions: cert.requiredForCompetitions,
      isActive: cert.isActive,
    })

    const months = cert.renewalPeriodMonths
    if (months === null) {
      setRenewalOption("none")
    } else if (RENEWAL_OPTIONS.find((o) => o.value === String(months))) {
      setRenewalOption(String(months))
    } else {
      setRenewalOption("custom")
      setCustomRenewal(String(months))
    }
    setFormOpen(true)
  }

  const handleRenewalChange = (value: string) => {
    setRenewalOption(value)
    if (value === "none") {
      setFormData((prev) => ({ ...prev, renewalPeriodMonths: null }))
    } else if (value === "custom") {
      setFormData((prev) => ({
        ...prev,
        renewalPeriodMonths: customRenewal ? parseInt(customRenewal) : null,
      }))
    } else {
      setFormData((prev) => ({ ...prev, renewalPeriodMonths: parseInt(value) }))
    }
  }

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error("Name is required")
      return
    }

    setSaving(true)
    try {
      const payload = {
        ...formData,
        description: formData.description || null,
        criteria: formData.criteria || null,
        renewalPeriodMonths:
          renewalOption === "custom" && customRenewal
            ? parseInt(customRenewal)
            : formData.renewalPeriodMonths,
      }

      const url = editingCert
        ? `/api/organization/certifications/${editingCert.id}`
        : "/api/organization/certifications"
      const method = editingCert ? "PUT" : "POST"

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Failed to save")
      }

      toast.success(editingCert ? "Certification updated" : "Certification created")
      setFormOpen(false)
      fetchCertifications()
    } catch (error) {
      toast.error((error as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!certToDelete) return
    setSaving(true)
    try {
      const res = await fetch(`/api/organization/certifications/${certToDelete.id}`, {
        method: "DELETE",
      })
      if (!res.ok) throw new Error("Failed to delete")
      toast.success("Certification deleted")
      setDeleteDialogOpen(false)
      setCertToDelete(null)
      fetchCertifications()
    } catch {
      toast.error("Failed to delete certification")
    } finally {
      setSaving(false)
    }
  }

  const filtered = certifications.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.description || "").toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Certifications</h1>
          <p className="text-muted-foreground">
            Define certification requirements for your organization.
            Assign certifications to individual staff from their profile page.
          </p>
        </div>
        <Button onClick={openCreateForm}>
          <Plus className="mr-2 h-4 w-4" />
          Add Certification
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search certifications..."
                className="pl-8"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Award className="h-10 w-10 text-muted-foreground/50 mb-2" />
              <p className="text-sm text-muted-foreground">
                {search ? "No certifications match your search" : "No certifications yet"}
              </p>
              {!search && (
                <Button variant="link" size="sm" onClick={openCreateForm}>
                  Create your first certification
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-hidden rounded-b-lg border-t">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Evaluation</TableHead>
                    <TableHead>Renewal</TableHead>
                    <TableHead>Scopes</TableHead>
                    <TableHead className="text-center">Certified</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[40px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((cert) => (
                    <TableRow
                      key={cert.id}
                      className="cursor-pointer"
                      onClick={() => openEditForm(cert)}
                    >
                      <TableCell>
                        <div className="font-medium">{cert.name}</div>
                        {cert.description && (
                          <div className="text-xs text-muted-foreground truncate max-w-[250px]">
                            {cert.description}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs">
                          {cert.evaluationMethod === "PASS_FAIL" ? "Pass/Fail" : "Point Scale"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatRenewalPeriod(cert.renewalPeriodMonths)}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          {cert.requiredForPrograms && (
                            <Badge variant="outline" className="text-xs">Programs</Badge>
                          )}
                          {cert.requiredForEvents && (
                            <Badge variant="outline" className="text-xs">Events</Badge>
                          )}
                          {cert.requiredForCompetitions && (
                            <Badge variant="outline" className="text-xs">Competitions</Badge>
                          )}
                          {!cert.requiredForPrograms && !cert.requiredForEvents && !cert.requiredForCompetitions && (
                            <span className="text-xs text-muted-foreground">None</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        {cert._count.memberCertifications}
                      </TableCell>
                      <TableCell>
                        {cert.isActive ? (
                          <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 text-xs">
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">
                            Inactive
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEditForm(cert)}>
                              <Pencil className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => {
                                setCertToDelete(cert)
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
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Sheet */}
      <Sheet open={formOpen} onOpenChange={setFormOpen}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>
              {editingCert ? "Edit Certification" : "New Certification"}
            </SheetTitle>
            <SheetDescription>
              {editingCert
                ? "Update certification details and requirements."
                : "Define a new certification for your organization."}
            </SheetDescription>
          </SheetHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="e.g. CPR / First Aid"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, description: e.target.value }))
                }
                placeholder="Brief description of this certification"
                rows={2}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="criteria">Criteria</Label>
              <Textarea
                id="criteria"
                value={formData.criteria}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, criteria: e.target.value }))
                }
                placeholder="What is required to earn this certification? e.g. Complete ARC CPR course and pass written exam"
                rows={3}
              />
            </div>

            <div className="grid gap-2">
              <Label>Evaluation Method</Label>
              <RadioGroup
                value={formData.evaluationMethod}
                onValueChange={(val) =>
                  setFormData((prev) => ({
                    ...prev,
                    evaluationMethod: val as CertificationEvaluationMethod,
                  }))
                }
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="PASS_FAIL" id="pass_fail" />
                  <Label htmlFor="pass_fail" className="font-normal">
                    Pass / Fail
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="POINT_SCALE" id="point_scale" />
                  <Label htmlFor="point_scale" className="font-normal">
                    Point Scale
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {formData.evaluationMethod === "POINT_SCALE" && (
              <div className="grid gap-3 rounded-md border p-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-1">
                    <Label className="text-xs">Min Score</Label>
                    <Input
                      type="number"
                      value={formData.pointScaleMin}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          pointScaleMin: parseInt(e.target.value) || 0,
                        }))
                      }
                    />
                  </div>
                  <div className="grid gap-1">
                    <Label className="text-xs">Max Score</Label>
                    <Input
                      type="number"
                      value={formData.pointScaleMax}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          pointScaleMax: parseInt(e.target.value) || 10,
                        }))
                      }
                    />
                  </div>
                </div>
                <div className="grid gap-1">
                  <Label className="text-xs">
                    Pass Threshold: {formData.passThreshold}
                  </Label>
                  <Slider
                    min={formData.pointScaleMin}
                    max={formData.pointScaleMax}
                    step={1}
                    value={[formData.passThreshold]}
                    onValueChange={([val]) =>
                      setFormData((prev) => ({ ...prev, passThreshold: val }))
                    }
                  />
                </div>
              </div>
            )}

            <div className="grid gap-2">
              <Label>Renewal Period</Label>
              <Select value={renewalOption} onValueChange={handleRenewalChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RENEWAL_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {renewalOption === "custom" && (
                <Input
                  type="number"
                  placeholder="Months"
                  value={customRenewal}
                  onChange={(e) => {
                    setCustomRenewal(e.target.value)
                    setFormData((prev) => ({
                      ...prev,
                      renewalPeriodMonths: e.target.value ? parseInt(e.target.value) : null,
                    }))
                  }}
                />
              )}
            </div>

            <div className="grid gap-2">
              <Label>Required For (Scopes)</Label>
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={formData.requiredForPrograms}
                    onCheckedChange={(checked) =>
                      setFormData((prev) => ({
                        ...prev,
                        requiredForPrograms: !!checked,
                      }))
                    }
                  />
                  Coaching Programs
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={formData.requiredForEvents}
                    onCheckedChange={(checked) =>
                      setFormData((prev) => ({
                        ...prev,
                        requiredForEvents: !!checked,
                      }))
                    }
                  />
                  Events
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={formData.requiredForCompetitions}
                    onCheckedChange={(checked) =>
                      setFormData((prev) => ({
                        ...prev,
                        requiredForCompetitions: !!checked,
                      }))
                    }
                  />
                  Competitions
                </label>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                checked={formData.isActive}
                onCheckedChange={(checked) =>
                  setFormData((prev) => ({ ...prev, isActive: checked }))
                }
              />
              <Label>Active</Label>
            </div>
          </div>

          <SheetFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingCert ? "Save Changes" : "Create"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Certification</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &ldquo;{certToDelete?.name}&rdquo;? This will
              also remove all member certification records. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
