"use client"

import * as React from "react"
import { Plus, MoreHorizontal, Trash2, Loader2, AlertCircle, Settings, Ticket, Calendar, Hash, Globe } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Checkbox } from "@/components/ui/checkbox"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { usePasses, usePass } from "@/hooks/use-passes"
import { useFeatures } from "@/components/feature-context"
import { DashboardPageHeader } from "@/components/dashboard-page-header"
import { toast } from "sonner"
import type { Pass, BillingInterval, PassLimitPeriod } from "@/types/passes"

function formatBillingInterval(interval: string) {
  switch (interval) {
    case "MONTHLY": return "month"
    case "YEARLY": return "year"
    case "ONE_TIME": return "one-time"
    default: return interval.toLowerCase().replace("_", "-")
  }
}

function formatLimitPeriod(period: string) {
  switch (period) {
    case "WEEKLY": return "week"
    case "MONTHLY": return "month"
    default: return period.toLowerCase()
  }
}

type AvailableProgram = { id: string; name: string; status: string }

function useAvailablePrograms(shouldFetch: boolean) {
  const [programs, setPrograms] = React.useState<AvailableProgram[]>([])

  React.useEffect(() => {
    if (!shouldFetch) return
    fetch("/api/programs?limit=200")
      .then((r) => r.json())
      .then((data) => setPrograms(data.data || []))
      .catch(() => {})
  }, [shouldFetch])

  return programs
}

export default function PassesPage() {
  const { passes, isLoading, error, createPass, deletePass, refresh } = usePasses({ initialParams: { include: "programs" } })
  const { isFeatureEnabled } = useFeatures()
  const passesEnabled = isFeatureEnabled("passes")

  const [isCreateOpen, setIsCreateOpen] = React.useState(false)
  const [selectedPassId, setSelectedPassId] = React.useState<string | null>(null)

  const availablePrograms = useAvailablePrograms(isCreateOpen)

  const [createName, setCreateName] = React.useState("")
  const [createDescription, setCreateDescription] = React.useState("")
  const [createPrice, setCreatePrice] = React.useState("")
  const [createBillingInterval, setCreateBillingInterval] = React.useState<BillingInterval>("MONTHLY")
  const [createSessionLimit, setCreateSessionLimit] = React.useState("")
  const [createLimitPeriod, setCreateLimitPeriod] = React.useState<PassLimitPeriod>("WEEKLY")
  const [createScopeMode, setCreateScopeMode] = React.useState<"all" | "specific">("all")
  const [createProgramIds, setCreateProgramIds] = React.useState<Set<string>>(new Set())

  const resetCreateForm = () => {
    setCreateName("")
    setCreateDescription("")
    setCreatePrice("")
    setCreateBillingInterval("MONTHLY")
    setCreateSessionLimit("")
    setCreateLimitPeriod("WEEKLY")
    setCreateScopeMode("all")
    setCreateProgramIds(new Set())
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()

    const price = parseFloat(createPrice)
    const sessionLimit = parseInt(createSessionLimit)

    if (isNaN(price) || price < 0) {
      toast.error("Please enter a valid price")
      return
    }
    if (isNaN(sessionLimit) || sessionLimit < 1) {
      toast.error("Session limit must be at least 1")
      return
    }
    if (createScopeMode === "specific" && createProgramIds.size === 0) {
      toast.error("Select at least one program or choose 'All programs'")
      return
    }

    const result = await createPass({
      name: createName,
      description: createDescription || undefined,
      price,
      billingInterval: createBillingInterval,
      sessionLimit,
      limitPeriod: createLimitPeriod,
      coversAllPrograms: createScopeMode === "all",
      programIds: createScopeMode === "specific" ? Array.from(createProgramIds) : undefined,
    })

    if (result) {
      toast.success("Pass created")
      setIsCreateOpen(false)
      resetCreateForm()
      refresh()
    }
  }

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure? This will remove this pass and all athlete enrollments.")) {
      const success = await deletePass(id)
      if (success) {
        toast.success("Pass deleted")
        if (selectedPassId === id) setSelectedPassId(null)
      }
    }
  }

  if (!passesEnabled) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <Ticket className="h-12 w-12 text-muted-foreground" />
        <h2 className="text-xl font-semibold">Passes not available</h2>
        <p className="text-muted-foreground">Upgrade to a Gold or Platinum plan to use Passes.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <DashboardPageHeader
        title="Passes"
        description="Create and manage passes that give athletes access to programs with session credits."
        actions={
          <Button onClick={() => setIsCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create Pass
          </Button>
        }
      />

      {isLoading && passes.length === 0 && (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {error && (
        <div className="flex items-center justify-center h-64 text-destructive">
          <AlertCircle className="mr-2 h-6 w-6" />
          <p>{error}</p>
        </div>
      )}

      {!isLoading && !error && (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {passes.map((pass) => (
            <Card key={pass.id} className="flex flex-col">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-xl">{pass.name}</CardTitle>
                    <CardDescription className="mt-2 line-clamp-2">
                      {pass.description || "No description"}
                    </CardDescription>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Actions</DropdownMenuLabel>
                      <DropdownMenuItem onClick={() => setSelectedPassId(pass.id)}>
                        <Settings className="mr-2 h-4 w-4" />
                        Manage
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => handleDelete(pass.id)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent className="flex-1">
                <div className="flex flex-wrap gap-2 mb-3">
                  <Badge variant="outline">
                    ${Number(pass.price).toFixed(2)} / {formatBillingInterval(pass.billingInterval)}
                  </Badge>
                  <Badge variant="secondary">
                    <Hash className="mr-1 h-3 w-3" />
                    {pass.sessionLimit} sessions / {formatLimitPeriod(pass.limitPeriod)}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  {pass.coversAllPrograms ? (
                    <Badge variant="outline">
                      <Globe className="mr-1 h-3 w-3" />
                      All Programs
                    </Badge>
                  ) : (
                    <Badge variant="outline">{pass._count?.coveredPrograms || 0} Programs</Badge>
                  )}
                  <Badge variant="outline">{pass._count?.athletePasses || 0} Athletes</Badge>
                  <Badge variant={pass.status === "ACTIVE" ? "default" : "secondary"}>
                    {pass.status}
                  </Badge>
                </div>
              </CardContent>
              <CardFooter className="border-t pt-4">
                <Button variant="outline" className="w-full" onClick={() => setSelectedPassId(pass.id)}>
                  Manage
                </Button>
              </CardFooter>
            </Card>
          ))}
          {passes.length === 0 && (
            <div className="col-span-full text-center py-12 text-muted-foreground">
              No passes found. Create one to get started.
            </div>
          )}
        </div>
      )}

      {/* Create Pass Sheet */}
      <Sheet open={isCreateOpen} onOpenChange={(o) => { if (!o) { setIsCreateOpen(false); resetCreateForm() } }}>
        <SheetContent className="sm:max-w-[540px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Create Pass</SheetTitle>
            <SheetDescription>Define a pass with pricing, session limits, and program scope.</SheetDescription>
          </SheetHeader>
          <form onSubmit={handleCreate} className="mt-6 space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="create-name">Pass Name</Label>
              <Input
                id="create-name"
                placeholder="e.g. Monthly All-Access"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="create-description">Description</Label>
              <Textarea
                id="create-description"
                placeholder="Describe what this pass includes..."
                rows={2}
                value={createDescription}
                onChange={(e) => setCreateDescription(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="create-price">Price</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <Input
                    id="create-price"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    className="pl-7"
                    value={createPrice}
                    onChange={(e) => setCreatePrice(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Billing Period</Label>
                <Select value={createBillingInterval} onValueChange={(v) => setCreateBillingInterval(v as BillingInterval)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MONTHLY">Per Month</SelectItem>
                    <SelectItem value="YEARLY">Per Year</SelectItem>
                    <SelectItem value="ONE_TIME">One-time</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="create-sessionLimit">Session Limit</Label>
                <Input
                  id="create-sessionLimit"
                  type="number"
                  min="1"
                  placeholder="2"
                  value={createSessionLimit}
                  onChange={(e) => setCreateSessionLimit(e.target.value)}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label>Per</Label>
                <Select value={createLimitPeriod} onValueChange={(v) => setCreateLimitPeriod(v as PassLimitPeriod)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="WEEKLY">Week</SelectItem>
                    <SelectItem value="MONTHLY">Month</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator />

            <div className="grid gap-3">
              <Label className="text-base font-medium">Program Scope</Label>
              <RadioGroup value={createScopeMode} onValueChange={(v) => setCreateScopeMode(v as "all" | "specific")}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="all" id="scope-all" />
                  <Label htmlFor="scope-all" className="font-normal">All programs (automatically includes new programs)</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="specific" id="scope-specific" />
                  <Label htmlFor="scope-specific" className="font-normal">Specific programs</Label>
                </div>
              </RadioGroup>

              {createScopeMode === "specific" && (
                <div className="space-y-2 max-h-48 overflow-y-auto border rounded-md p-2">
                  {availablePrograms.length === 0 && (
                    <p className="text-sm text-muted-foreground py-2 text-center">Loading programs...</p>
                  )}
                  {availablePrograms.map((program) => (
                    <div key={program.id} className="flex items-center space-x-3 py-1.5 px-1 rounded-md hover:bg-muted/50">
                      <Checkbox
                        checked={createProgramIds.has(program.id)}
                        onCheckedChange={(checked) => {
                          setCreateProgramIds((prev) => {
                            const next = new Set(prev)
                            if (checked) next.add(program.id)
                            else next.delete(program.id)
                            return next
                          })
                        }}
                      />
                      <span className="text-sm truncate">{program.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => { setIsCreateOpen(false); resetCreateForm() }}>
                Cancel
              </Button>
              <Button type="submit" className="flex-1">Create Pass</Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>

      {/* Pass Management Sheet */}
      {selectedPassId && (
        <PassManagerSheet
          passId={selectedPassId}
          open={!!selectedPassId}
          onClose={() => { setSelectedPassId(null); refresh() }}
        />
      )}
    </div>
  )
}

function PassManagerSheet({ passId, open, onClose }: { passId: string; open: boolean; onClose: () => void }) {
  const { pass, isLoading, isUpdating, updatePass, addProgram, removeProgram, addAthlete, removeAthlete, error, fetchPass } = usePass(passId)
  const [activeTab, setActiveTab] = React.useState<"details" | "programs" | "athletes">("details")

  const availablePrograms = useAvailablePrograms(open)

  const [editName, setEditName] = React.useState("")
  const [editDescription, setEditDescription] = React.useState("")
  const [editPrice, setEditPrice] = React.useState("")
  const [editBillingInterval, setEditBillingInterval] = React.useState<BillingInterval>("MONTHLY")
  const [editSessionLimit, setEditSessionLimit] = React.useState("")
  const [editLimitPeriod, setEditLimitPeriod] = React.useState<PassLimitPeriod>("WEEKLY")
  const [editScopeMode, setEditScopeMode] = React.useState<"all" | "specific">("all")
  const [editProgramIds, setEditProgramIds] = React.useState<Set<string>>(new Set())
  const [scopeDirty, setScopeDirty] = React.useState(false)

  React.useEffect(() => {
    if (pass) {
      setEditName(pass.name)
      setEditDescription(pass.description || "")
      setEditPrice(String(Number(pass.price)))
      setEditBillingInterval(pass.billingInterval)
      setEditSessionLimit(String(pass.sessionLimit))
      setEditLimitPeriod(pass.limitPeriod)
      setEditScopeMode(pass.coversAllPrograms ? "all" : "specific")
      setEditProgramIds(new Set(pass.coveredPrograms?.map((p) => p.id) || []))
      setScopeDirty(false)
    }
  }, [pass])

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()

    const price = parseFloat(editPrice)
    const sessionLimit = parseInt(editSessionLimit)

    if (isNaN(price) || price < 0) {
      toast.error("Please enter a valid price")
      return
    }
    if (isNaN(sessionLimit) || sessionLimit < 1) {
      toast.error("Session limit must be at least 1")
      return
    }
    if (editScopeMode === "specific" && editProgramIds.size === 0) {
      toast.error("Select at least one program or choose 'All programs'")
      return
    }

    const result = await updatePass({
      name: editName,
      description: editDescription || undefined,
      price,
      billingInterval: editBillingInterval,
      sessionLimit,
      limitPeriod: editLimitPeriod,
      coversAllPrograms: editScopeMode === "all",
      ...(editScopeMode === "specific" ? { programIds: Array.from(editProgramIds) } : { programIds: [] }),
    })

    if (result) {
      toast.success("Pass updated")
      setScopeDirty(false)
    }
  }

  const coveredProgramIds = editProgramIds

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <SheetContent className="sm:max-w-[540px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{pass?.name || "Loading..."}</SheetTitle>
          <SheetDescription>Manage pass details, covered programs, and athlete enrollments.</SheetDescription>
        </SheetHeader>

        {isLoading && (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 py-4 text-destructive text-sm">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}

        {pass && !isLoading && (
          <div className="mt-6 space-y-6">
            {/* Tab Navigation */}
            <div className="flex gap-2 border-b pb-1">
              {(["details", "programs", "athletes"] as const).map((tab) => (
                <Button
                  key={tab}
                  variant={activeTab === tab ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setActiveTab(tab)}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </Button>
              ))}
            </div>

            {/* Details Tab */}
            {activeTab === "details" && (
              <form onSubmit={handleUpdate} className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="edit-name">Pass Name</Label>
                  <Input id="edit-name" value={editName} onChange={(e) => setEditName(e.target.value)} required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-description">Description</Label>
                  <Textarea id="edit-description" value={editDescription} onChange={(e) => setEditDescription(e.target.value)} rows={2} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="edit-price">Price</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                      <Input
                        id="edit-price"
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        className="pl-7"
                        value={editPrice}
                        onChange={(e) => setEditPrice(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label>Billing Period</Label>
                    <Select value={editBillingInterval} onValueChange={(v) => setEditBillingInterval(v as BillingInterval)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="MONTHLY">Per Month</SelectItem>
                        <SelectItem value="YEARLY">Per Year</SelectItem>
                        <SelectItem value="ONE_TIME">One-time</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="edit-sessionLimit">Session Limit</Label>
                    <Input
                      id="edit-sessionLimit"
                      type="number"
                      min="1"
                      value={editSessionLimit}
                      onChange={(e) => setEditSessionLimit(e.target.value)}
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Per</Label>
                    <Select value={editLimitPeriod} onValueChange={(v) => setEditLimitPeriod(v as PassLimitPeriod)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="WEEKLY">Week</SelectItem>
                        <SelectItem value="MONTHLY">Month</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Separator />

                <div className="grid gap-3">
                  <Label className="text-base font-medium">Program Scope</Label>
                  <RadioGroup
                    value={editScopeMode}
                    onValueChange={(v) => { setEditScopeMode(v as "all" | "specific"); setScopeDirty(true) }}
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="all" id="edit-scope-all" />
                      <Label htmlFor="edit-scope-all" className="font-normal">All programs (automatically includes new programs)</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="specific" id="edit-scope-specific" />
                      <Label htmlFor="edit-scope-specific" className="font-normal">Specific programs</Label>
                    </div>
                  </RadioGroup>

                  {editScopeMode === "specific" && (
                    <div className="space-y-2 max-h-48 overflow-y-auto border rounded-md p-2">
                      {availablePrograms.length === 0 && (
                        <p className="text-sm text-muted-foreground py-2 text-center">Loading programs...</p>
                      )}
                      {availablePrograms.map((program) => (
                        <div key={program.id} className="flex items-center space-x-3 py-1.5 px-1 rounded-md hover:bg-muted/50">
                          <Checkbox
                            checked={coveredProgramIds.has(program.id)}
                            onCheckedChange={(checked) => {
                              setEditProgramIds((prev) => {
                                const next = new Set(prev)
                                if (checked) next.add(program.id)
                                else next.delete(program.id)
                                return next
                              })
                              setScopeDirty(true)
                            }}
                          />
                          <span className="text-sm truncate">{program.name}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="grid gap-2">
                  <Label>Status</Label>
                  <Badge variant={pass.status === "ACTIVE" ? "default" : "secondary"} className="w-fit">
                    {pass.status}
                  </Badge>
                </div>
                <Button type="submit" disabled={isUpdating} className="w-full">
                  {isUpdating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Save Changes
                </Button>
              </form>
            )}

            {/* Programs Tab */}
            {activeTab === "programs" && (
              <div className="space-y-4">
                {pass.coversAllPrograms ? (
                  <div className="flex items-center gap-2 p-3 rounded-md bg-muted/50 text-sm">
                    <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span>
                      This pass covers <strong>all programs</strong> automatically. To choose specific programs, change the scope in the Details tab.
                    </span>
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground">
                      Programs covered by this pass. Athletes with this pass get free registration to these programs (within session limits).
                    </p>
                    <Separator />
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {availablePrograms.length === 0 && (
                        <p className="text-sm text-muted-foreground py-4 text-center">No programs found.</p>
                      )}
                      {availablePrograms.map((program) => {
                        const isCovered = pass.coveredPrograms?.some((p) => p.id === program.id) ?? false
                        return (
                          <div key={program.id} className="flex items-center space-x-3 py-2 px-1 rounded-md hover:bg-muted/50">
                            <Checkbox
                              checked={isCovered}
                              onCheckedChange={async () => {
                                if (isCovered) {
                                  const success = await removeProgram(program.id)
                                  if (success) toast.success("Program removed from pass")
                                } else {
                                  const success = await addProgram(program.id)
                                  if (success) toast.success("Program added to pass")
                                }
                              }}
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{program.name}</p>
                            </div>
                            <Badge variant="secondary" className="text-xs shrink-0">{program.status}</Badge>
                          </div>
                        )
                      })}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Athletes Tab */}
            {activeTab === "athletes" && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Athletes enrolled in this pass. Athletes can also purchase passes from the public storefront.
                </p>
                <Separator />
                {pass.athletePasses && pass.athletePasses.length > 0 ? (
                  <div className="space-y-2">
                    {pass.athletePasses.map((ap) => (
                      <div key={ap.id} className="flex items-center justify-between py-2 px-1">
                        <div>
                          <p className="text-sm font-medium">
                            {ap.athlete?.firstName} {ap.athlete?.lastName}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Since {new Date(ap.startDate).toLocaleDateString()}
                            {ap.endDate && ` · Expires ${new Date(ap.endDate).toLocaleDateString()}`}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={ap.status === "ACTIVE" ? "default" : "secondary"} className="text-xs">
                            {ap.status}
                          </Badge>
                          {ap.autoRenew && (
                            <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                              <Calendar className="mr-1 h-3 w-3" />
                              Auto-renew
                            </Badge>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                            onClick={async () => {
                              if (ap.athlete && confirm(`Remove ${ap.athlete.firstName} ${ap.athlete.lastName} from this pass?`)) {
                                const success = await removeAthlete(ap.athleteId)
                                if (success) toast.success("Athlete removed from pass")
                              }
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    No athletes enrolled yet.
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
