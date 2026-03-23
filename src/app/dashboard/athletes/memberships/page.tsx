"use client"

import * as React from "react"
import Link from "next/link"
import { Plus, MoreHorizontal, Trash2, Loader2, AlertCircle, Settings, Eye, Shield, Clock, Calendar as CalendarIcon } from "lucide-react"
import { format } from "date-fns"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

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
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { useMemberships } from "@/hooks/use-memberships"
import { useMembershipGroup } from "@/hooks/use-membership-group"
import { useFeatures } from "@/components/feature-context"
import { DashboardPageHeader } from "@/components/dashboard-page-header"
import { toast } from "sonner"
import type { BillingInterval, MembershipInstanceStatus } from "@/types/memberships"

export default function MembershipsPage() {
  const { memberships, isLoading, error, deleteMembershipGroup } = useMemberships()
  const { isFeatureEnabled } = useFeatures()
  const trainingEnabled = isFeatureEnabled("training")
  
  const [selectedGroupId, setSelectedGroupId] = React.useState<string | null>(null)

  const handleDeleteGroup = async (id: string) => {
    if (confirm("Are you sure? This will delete all instances within this group.")) {
      const success = await deleteMembershipGroup(id)
      if (success) {
        toast.success("Membership Group deleted")
      }
    }
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <DashboardPageHeader
        title="Memberships"
        description="Manage membership groups, instances, and restrictions."
        actions={
          <Button asChild>
            <Link href="/dashboard/athletes/memberships/new">
              <Plus className="mr-2 h-4 w-4" />
              Create Membership Group
            </Link>
          </Button>
        }
      />

      {isLoading && memberships.length === 0 && (
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
          {memberships.map((group) => (
            <Card key={group.id} className="flex flex-col">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-xl">{group.name}</CardTitle>
                    <CardDescription className="mt-2 line-clamp-2">
                      {group.description || "No description"}
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
                      <DropdownMenuItem onClick={() => setSelectedGroupId(group.id)}>
                        <Settings className="mr-2 h-4 w-4" />
                        Manage
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        className="text-destructive focus:text-destructive"
                        onClick={() => handleDeleteGroup(group.id)}
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
                  <Badge variant={group.isRecurring ? "default" : "secondary"}>
                    {group.isRecurring ? "Recurring" : "One-time"}
                  </Badge>
                  {group.defaultPrice != null && (
                    <Badge variant="outline">
                      ${Number(group.defaultPrice).toFixed(2)} / {group.defaultBillingInterval.toLowerCase().replace("_", "-")}
                    </Badge>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 mb-3">
                  {group.programTypes.map((type, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">
                      {type}
                    </Badge>
                  ))}
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Badge variant="outline">{group._count?.instances || 0} Instances</Badge>
                  {group.allowAutoRenew && <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Auto-Renew</Badge>}
                  {(group.hasAgeRestriction || group.hasGenderRestriction || group.hasLevelRestriction || group.hasWaiverRestriction || group.hasMedicalRequirement) && (
                    <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                      <Shield className="mr-1 h-3 w-3" />
                      Restrictions
                    </Badge>
                  )}
                </div>
              </CardContent>
              <CardFooter className="border-t pt-4">
                <Button variant="outline" className="w-full" onClick={() => setSelectedGroupId(group.id)}>
                  Manage
                </Button>
              </CardFooter>
            </Card>
          ))}
          {memberships.length === 0 && (
            <div className="col-span-full text-center py-12 text-muted-foreground">
              No membership groups found. Create one to get started.
            </div>
          )}
        </div>
      )}

      {/* Manage Group Sheet */}
      <Sheet open={!!selectedGroupId} onOpenChange={(open) => !open && setSelectedGroupId(null)}>
        <SheetContent className="sm:max-w-[640px] overflow-y-auto">
            {selectedGroupId && <MembershipGroupManager groupId={selectedGroupId} />}
        </SheetContent>
      </Sheet>
    </div>
  )
}

function MembershipGroupManager({ groupId }: { groupId: string }) {
  const {
    group,
    isLoading,
    isUpdating,
    error,
    fetchGroup,
    updateGroup,
    createInstance,
    updateInstance,
    deleteInstance,
    publishInstance,
  } = useMembershipGroup()
  const { isFeatureEnabled } = useFeatures()
  const trainingEnabled = isFeatureEnabled("training")
  const [isCreatingInstance, setIsCreatingInstance] = React.useState(false)
  const [activeTab, setActiveTab] = React.useState<"instances" | "restrictions">("instances")
  const [instanceStartDate, setInstanceStartDate] = React.useState<Date | undefined>(undefined)
  const [instanceEndDate, setInstanceEndDate] = React.useState<Date | undefined>(undefined)
  const [instanceAutoRenewDate, setInstanceAutoRenewDate] = React.useState<Date | undefined>(undefined)

  React.useEffect(() => {
    fetchGroup(groupId)
  }, [groupId, fetchGroup])

  const handleCreateInstance = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    
    const result = await createInstance(groupId, {
      membershipGroupId: groupId,
      name: formData.get("name") as string,
      price: parseFloat(formData.get("price") as string),
      billingInterval: formData.get("interval") as BillingInterval,
      startDate: instanceStartDate ? format(instanceStartDate, "yyyy-MM-dd") : "",
      endDate: instanceEndDate ? format(instanceEndDate, "yyyy-MM-dd") : "",
      autoRenewDate: instanceAutoRenewDate ? format(instanceAutoRenewDate, "yyyy-MM-dd") : undefined,
      status: (formData.get("status") as MembershipInstanceStatus) || "DRAFT",
    })

    if (result) {
      toast.success("Instance created")
      setIsCreatingInstance(false)
      setInstanceStartDate(undefined)
      setInstanceEndDate(undefined)
      setInstanceAutoRenewDate(undefined)
    }
  }

  const handlePublish = async (instanceId: string) => {
    const result = await publishInstance(groupId, instanceId)
    if (result) {
      toast.success("Instance published")
    }
  }

  const handleDeleteInstance = async (instanceId: string) => {
    if (confirm("Are you sure you want to delete this instance?")) {
      const success = await deleteInstance(groupId, instanceId)
      if (success) {
        toast.success("Instance deleted")
      }
    }
  }

  const handleUpdateRestrictions = async (data: Record<string, unknown>) => {
    const result = await updateGroup(groupId, data)
    if (result) {
      toast.success("Restrictions updated")
    }
  }

  if (isLoading || !group) {
    return <div className="flex items-center justify-center h-full"><Loader2 className="animate-spin" /></div>
  }

  return (
    <div className="flex flex-col gap-6">
      <SheetHeader>
        <SheetTitle>{group.name}</SheetTitle>
        <SheetDescription>
          {group.isRecurring ? "Recurring" : "One-time"} membership
          {group.defaultPrice != null && ` - $${Number(group.defaultPrice).toFixed(2)}/${group.defaultBillingInterval.toLowerCase().replace("_", "-")}`}
        </SheetDescription>
      </SheetHeader>

      {error && (
        <div className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded">
          {error}
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b">
        <button
          className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${activeTab === "instances" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          onClick={() => setActiveTab("instances")}
        >
          <Clock className="inline mr-1.5 h-4 w-4" />
          Instances
        </button>
        <button
          className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${activeTab === "restrictions" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          onClick={() => setActiveTab("restrictions")}
        >
          <Shield className="inline mr-1.5 h-4 w-4" />
          Restrictions
        </button>
      </div>

      {/* Instances Tab */}
      {activeTab === "instances" && (
        <>
          {group.isRecurring && (
            <div className="flex justify-end">
              <Button size="sm" onClick={() => setIsCreatingInstance(!isCreatingInstance)} variant={isCreatingInstance ? "secondary" : "default"}>
                {isCreatingInstance ? "Cancel" : "Add Instance"}
              </Button>
            </div>
          )}

          {isCreatingInstance && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">New Instance</CardTitle>
              </CardHeader>
              <CardContent>
                <form id="create-instance-form" onSubmit={handleCreateInstance} className="grid gap-4">
                  <div className="grid gap-2">
                    <Label>Instance Name</Label>
                    <Input name="name" placeholder="e.g. FY2026" required />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label>Price ($)</Label>
                      <Input name="price" type="number" min="0" step="0.01" defaultValue={group.defaultPrice != null ? Number(group.defaultPrice) : ""} required />
                    </div>
                    <div className="grid gap-2">
                      <Label>Interval</Label>
                      <Select name="interval" defaultValue={group.defaultBillingInterval !== "ONE_TIME" ? group.defaultBillingInterval : "YEARLY"}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="YEARLY">Yearly</SelectItem>
                          <SelectItem value="MONTHLY">Monthly</SelectItem>
                          <SelectItem value="SESSION">Per Session</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label>Start Date</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            className={cn("w-full justify-start text-left font-normal", !instanceStartDate && "text-muted-foreground")}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {instanceStartDate ? format(instanceStartDate, "PPP") : "Pick a date"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={instanceStartDate}
                            onSelect={(date) => {
                              setInstanceStartDate(date)
                              if (instanceEndDate && date && instanceEndDate < date) setInstanceEndDate(undefined)
                            }}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="grid gap-2">
                      <Label>End Date</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            className={cn("w-full justify-start text-left font-normal", !instanceEndDate && "text-muted-foreground")}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {instanceEndDate ? format(instanceEndDate, "PPP") : "Pick a date"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={instanceEndDate}
                            onSelect={setInstanceEndDate}
                            disabled={(date) => instanceStartDate ? date < instanceStartDate : false}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label>Status</Label>
                      <Select name="status" defaultValue="DRAFT">
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="DRAFT">Draft</SelectItem>
                          <SelectItem value="ACTIVE">Active</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label>Auto-Renew Date</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            className={cn("w-full justify-start text-left font-normal", !instanceAutoRenewDate && "text-muted-foreground")}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {instanceAutoRenewDate ? format(instanceAutoRenewDate, "PPP") : "Pick a date"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={instanceAutoRenewDate}
                            onSelect={setInstanceAutoRenewDate}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                  <Button type="submit">Create Instance</Button>
                </form>
              </CardContent>
            </Card>
          )}

          <div className="space-y-4">
            {group.instances?.map((instance) => (
              <Card key={instance.id}>
                <CardHeader className="py-4">
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-base">{instance.name}</CardTitle>
                    <div className="flex items-center gap-2">
                      <Badge variant={instance.status === 'ACTIVE' ? 'default' : instance.status === 'DRAFT' ? 'secondary' : 'outline'}>
                        {instance.status}
                      </Badge>
                      {instance.isAutoGenerated && (
                        <Badge variant="outline" className="text-xs">Auto</Badge>
                      )}
                    </div>
                  </div>
                  <CardDescription>
                    {format(new Date(instance.startDate), 'MMM d, yyyy')} - {format(new Date(instance.endDate), 'MMM d, yyyy')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pb-4 pt-0">
                  <div className="flex justify-between items-end">
                    <div className="text-sm">
                      <div className="font-semibold">${Number(instance.price).toFixed(2)} / {instance.billingInterval.toLowerCase().replace("_", "-")}</div>
                      {instance.capacity != null && (
                        <div className="text-muted-foreground text-xs mt-1">
                          Capacity: {instance._count?.athleteMemberships || 0}/{instance.capacity}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right mr-2">
                        <div className="text-2xl font-bold">{instance._count?.athleteMemberships || 0}</div>
                        <div className="text-xs text-muted-foreground">Members</div>
                      </div>
                      {instance.status === 'DRAFT' && (
                        <Button size="sm" variant="outline" onClick={() => handlePublish(instance.id)}>
                          <Eye className="mr-1 h-3 w-3" />
                          Publish
                        </Button>
                      )}
                      {!instance.isAutoGenerated || group.isRecurring ? (
                        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleDeleteInstance(instance.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            {(!group.instances || group.instances.length === 0) && !isCreatingInstance && (
              <div className="text-center py-8 text-muted-foreground bg-muted/20 rounded-lg">
                {group.isRecurring
                  ? "No instances found. Create one or enable auto-generation."
                  : "Auto-generated instance should appear here."}
              </div>
            )}
          </div>
        </>
      )}

      {/* Restrictions Tab */}
      {activeTab === "restrictions" && (
        <div className="space-y-6">
          {/* Age Restriction */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Age Restriction</Label>
              <Switch
                checked={group.hasAgeRestriction}
                onCheckedChange={(val) => handleUpdateRestrictions({ hasAgeRestriction: val })}
                disabled={isUpdating}
              />
            </div>
            {group.hasAgeRestriction && (
              <div className="grid grid-cols-2 gap-4 pl-2">
                <div className="grid gap-1">
                  <Label className="text-xs text-muted-foreground">Min Age</Label>
                  <Input
                    type="number" min="0" max="100"
                    defaultValue={group.minAge ?? ""}
                    onBlur={(e) => handleUpdateRestrictions({ minAge: e.target.value ? parseInt(e.target.value) : null })}
                  />
                </div>
                <div className="grid gap-1">
                  <Label className="text-xs text-muted-foreground">Max Age</Label>
                  <Input
                    type="number" min="0" max="100"
                    defaultValue={group.maxAge ?? ""}
                    onBlur={(e) => handleUpdateRestrictions({ maxAge: e.target.value ? parseInt(e.target.value) : null })}
                  />
                </div>
              </div>
            )}
          </div>

          <Separator />

          {/* Gender Restriction */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Gender Restriction</Label>
              <Switch
                checked={group.hasGenderRestriction}
                onCheckedChange={(val) => handleUpdateRestrictions({ hasGenderRestriction: val })}
                disabled={isUpdating}
              />
            </div>
            {group.hasGenderRestriction && (
              <div className="flex flex-wrap gap-2 pl-2">
                {(["MALE", "FEMALE", "OTHER", "PREFER_NOT_TO_SAY"] as const).map((gender) => {
                  const selected = group.allowedGenders.includes(gender)
                  return (
                    <Badge
                      key={gender}
                      variant={selected ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => {
                        const newGenders = selected
                          ? group.allowedGenders.filter(g => g !== gender)
                          : [...group.allowedGenders, gender]
                        handleUpdateRestrictions({ allowedGenders: newGenders })
                      }}
                    >
                      {gender.replace("_", " ").toLowerCase().replace(/\b\w/g, l => l.toUpperCase())}
                    </Badge>
                  )
                })}
              </div>
            )}
          </div>

          <Separator />

          {/* Capacity Restriction */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Capacity Limit</Label>
              <Switch
                checked={group.hasCapacityRestriction}
                onCheckedChange={(val) => handleUpdateRestrictions({ hasCapacityRestriction: val })}
                disabled={isUpdating}
              />
            </div>
            {group.hasCapacityRestriction && (
              <div className="pl-2 max-w-[200px]">
                <Input
                  type="number" min="0"
                  defaultValue={group.capacity ?? ""}
                  placeholder="Max members per instance"
                  onBlur={(e) => handleUpdateRestrictions({ capacity: e.target.value ? parseInt(e.target.value) : null })}
                />
              </div>
            )}
          </div>

          <Separator />

          {/* Medical Requirement */}
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Require Medical Information</Label>
            <Switch
              checked={group.hasMedicalRequirement}
              onCheckedChange={(val) => handleUpdateRestrictions({ hasMedicalRequirement: val })}
              disabled={isUpdating}
            />
          </div>

          {trainingEnabled && (
            <>
              <Separator />

              {/* Level Restriction */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Level Restriction</Label>
                  <Switch
                    checked={group.hasLevelRestriction}
                    onCheckedChange={(val) => handleUpdateRestrictions({ hasLevelRestriction: val })}
                    disabled={isUpdating}
                  />
                </div>
                {group.hasLevelRestriction && group.levelRequirements && (
                  <div className="pl-2 space-y-2">
                    {group.levelRequirements.map((lr) => (
                      <div key={lr.id} className="flex items-center justify-between bg-muted/50 px-3 py-2 rounded">
                        <span className="text-sm">{lr.level?.name}</span>
                      </div>
                    ))}
                    {group.levelRequirements.length === 0 && (
                      <p className="text-xs text-muted-foreground">No levels configured. Add them via the restrictions API.</p>
                    )}
                  </div>
                )}
              </div>
            </>
          )}

          <Separator />

          {/* Waiver Restriction */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Waiver Requirement</Label>
              <Switch
                checked={group.hasWaiverRestriction}
                onCheckedChange={(val) => handleUpdateRestrictions({ hasWaiverRestriction: val })}
                disabled={isUpdating}
              />
            </div>
            {group.hasWaiverRestriction && group.waiverRequirements && (
              <div className="pl-2 space-y-2">
                {group.waiverRequirements.map((wr) => (
                  <div key={wr.id} className="flex items-center justify-between bg-muted/50 px-3 py-2 rounded">
                    <span className="text-sm">{wr.waiver?.title}</span>
                  </div>
                ))}
                {group.waiverRequirements.length === 0 && (
                  <p className="text-xs text-muted-foreground">No waivers configured. Add them via the restrictions API.</p>
                )}
              </div>
            )}
          </div>

          <Separator />

          {/* Purchase Window */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Purchase Window (days before start)</Label>
            <Input
              type="number" min="0"
              defaultValue={group.purchaseWindowDays ?? ""}
              placeholder="Leave empty for always available"
              onBlur={(e) => handleUpdateRestrictions({ purchaseWindowDays: e.target.value ? parseInt(e.target.value) : null })}
            />
            <p className="text-xs text-muted-foreground">
              Number of days before an instance&apos;s start date that it becomes available for purchase. Leave empty for always available.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
