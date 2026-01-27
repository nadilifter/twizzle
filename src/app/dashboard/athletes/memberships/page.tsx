"use client"

import * as React from "react"
import { Plus, MoreHorizontal, Pencil, Trash2, Loader2, AlertCircle, Calendar, Settings } from "lucide-react"
import { format } from "date-fns"

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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useMemberships } from "@/hooks/use-memberships"
import { useMembershipGroup } from "@/hooks/use-membership-group"
import { toast } from "sonner"
import type { MembershipGroup, MembershipInstance, BillingInterval } from "@/types/memberships"

export default function MembershipsPage() {
  const { memberships, isLoading, error, createMembershipGroup, deleteMembershipGroup } = useMemberships()
  
  const [isCreateGroupOpen, setIsCreateGroupOpen] = React.useState(false)
  const [selectedGroupId, setSelectedGroupId] = React.useState<string | null>(null)

  const handleCreateGroup = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    
    const result = await createMembershipGroup({
      name: formData.get("name") as string,
      description: formData.get("description") as string,
      allowAutoRenew: formData.get("allowAutoRenew") === "on",
      programTypes: (formData.get("programTypes") as string).split(",").map(s => s.trim()).filter(Boolean),
    })

    if (result) {
      toast.success("Membership Group created")
      setIsCreateGroupOpen(false)
    }
  }

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
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold tracking-tight">Memberships</h1>
          <p className="text-muted-foreground">
            Manage membership groups and their term instances.
          </p>
        </div>
        <Button onClick={() => setIsCreateGroupOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Create Membership Group
        </Button>
      </div>

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
                      {group.description}
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
                        Manage Instances
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
                <div className="flex flex-wrap gap-2 mb-4">
                  {group.programTypes.map((type, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">
                      {type}
                    </Badge>
                  ))}
                  {group.programTypes.length === 0 && (
                     <span className="text-sm text-muted-foreground italic">No specific program types</span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Badge variant="outline">{group._count?.instances || 0} Instances</Badge>
                  {group.allowAutoRenew && <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Auto-Renew</Badge>}
                </div>
              </CardContent>
              <CardFooter className="border-t pt-4">
                <Button variant="outline" className="w-full" onClick={() => setSelectedGroupId(group.id)}>
                  Manage Instances
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

      {/* Create Group Dialog */}
      <Dialog open={isCreateGroupOpen} onOpenChange={setIsCreateGroupOpen}>
        <DialogContent>
          <form onSubmit={handleCreateGroup}>
            <DialogHeader>
              <DialogTitle>Create Membership Group</DialogTitle>
              <DialogDescription>
                Define a broad category of membership (e.g., "Annual Membership").
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Group Name</Label>
                <Input id="name" name="name" placeholder="e.g. Annual Membership" required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" name="description" placeholder="Description of this membership type..." />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="programTypes">Program Types (comma separated)</Label>
                <Input id="programTypes" name="programTypes" placeholder="e.g. Recreational, Competitive" />
              </div>
              <div className="flex items-center gap-2">
                <Switch id="allowAutoRenew" name="allowAutoRenew" />
                <Label htmlFor="allowAutoRenew">Allow Auto-Renewal Logic</Label>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsCreateGroupOpen(false)}>Cancel</Button>
              <Button type="submit">Create Group</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Manage Instances Sheet */}
      <Sheet open={!!selectedGroupId} onOpenChange={(open) => !open && setSelectedGroupId(null)}>
        <SheetContent className="sm:max-w-[600px] overflow-y-auto">
            {selectedGroupId && <MembershipInstancesManager groupId={selectedGroupId} />}
        </SheetContent>
      </Sheet>
    </div>
  )
}

function MembershipInstancesManager({ groupId }: { groupId: string }) {
  const { group, isLoading, createInstance, fetchGroup } = useMembershipGroup()
  const [isCreating, setIsCreating] = React.useState(false)

  React.useEffect(() => {
    fetchGroup(groupId)
  }, [groupId, fetchGroup])

  const handleCreateInstance = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    
    const result = await createInstance(groupId, {
      name: formData.get("name") as string,
      price: parseFloat(formData.get("price") as string),
      billingInterval: formData.get("interval") as BillingInterval,
      startDate: formData.get("startDate") as string, // will be parsed by API schema/Date constructor
      endDate: formData.get("endDate") as string,
      autoRenewDate: formData.get("autoRenewDate") as string || undefined,
    })

    if (result) {
      toast.success("Instance created")
      setIsCreating(false)
    }
  }

  if (isLoading || !group) {
    return <div className="flex items-center justify-center h-full"><Loader2 className="animate-spin" /></div>
  }

  return (
    <div className="flex flex-col gap-6">
      <SheetHeader>
        <SheetTitle>{group.name} - Instances</SheetTitle>
        <SheetDescription>
            Manage specific term instances (e.g., FY25, FY26) for this group.
        </SheetDescription>
      </SheetHeader>

      <div className="flex justify-end">
        <Button size="sm" onClick={() => setIsCreating(!isCreating)} variant={isCreating ? "secondary" : "default"}>
          {isCreating ? "Cancel" : "Add Instance"}
        </Button>
      </div>

      {isCreating && (
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
                            <Input name="price" type="number" min="0" step="0.01" required />
                        </div>
                        <div className="grid gap-2">
                            <Label>Interval</Label>
                            <Select name="interval" defaultValue="YEARLY">
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
                            <Input name="startDate" type="date" required />
                        </div>
                        <div className="grid gap-2">
                            <Label>End Date</Label>
                            <Input name="endDate" type="date" required />
                        </div>
                    </div>
                    <div className="grid gap-2">
                        <Label>Auto-Renew Trigger Date (Optional)</Label>
                        <Input name="autoRenewDate" type="date" />
                        <p className="text-xs text-muted-foreground">Date when system should create next instance.</p>
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
                        <Badge variant={instance.status === 'ACTIVE' ? 'default' : 'secondary'}>{instance.status}</Badge>
                    </div>
                    <CardDescription>
                        {format(new Date(instance.startDate), 'MMM d, yyyy')} - {format(new Date(instance.endDate), 'MMM d, yyyy')}
                    </CardDescription>
                </CardHeader>
                <CardContent className="pb-4 pt-0">
                    <div className="flex justify-between items-end">
                        <div className="text-sm">
                            <div className="font-semibold">${Number(instance.price).toFixed(2)} / {instance.billingInterval.toLowerCase()}</div>
                            <div className="text-muted-foreground text-xs mt-1">
                                {instance.autoRenewDate ? `Auto-renews: ${format(new Date(instance.autoRenewDate), 'MMM d')}` : 'No auto-renew set'}
                            </div>
                        </div>
                        <div className="text-right">
                             <div className="text-2xl font-bold">{instance._count?.athleteMemberships || 0}</div>
                             <div className="text-xs text-muted-foreground">Athletes</div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        ))}
        {(!group.instances || group.instances.length === 0) && !isCreating && (
            <div className="text-center py-8 text-muted-foreground bg-muted/20 rounded-lg">
                No instances found. Create one to enable purchases.
            </div>
        )}
      </div>
    </div>
  )
}
