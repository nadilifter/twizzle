"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Plus, Trash2, Edit, Bell, Mail, MessageSquare, MoreVertical, Lock, Eye, Copy, PlayCircle, Loader2, AlertCircle, Check } from "lucide-react"
import { toast } from "sonner"

// Types matching the backend
type TriggerType = 
  | "MEMBERSHIP_EXPIRY"
  | "MEMBERSHIP_EXPIRED"
  | "PAYMENT_DUE"
  | "PAYMENT_OVERDUE"
  | "PAYMENT_RECEIVED"
  | "PROGRAM_REMINDER"
  | "PROGRAM_ENROLLMENT"
  | "PROGRAM_CANCELLATION"
  | "EVENT_REMINDER"
  | "EVENT_REGISTRATION_OPEN"
  | "EVENT_REGISTRATION_CLOSE"
  | "ATTENDANCE_MISSED"
  | "SKILL_ACHIEVED"
  | "EVALUATION_DUE"
  | "EVALUATION_COMPLETED"
  | "BIRTHDAY"
  | "WAITLIST_OPENING"
  | "CONTRACT_RENEWAL"
  | "MAKEUP_CLASS_EXPIRING"
  | "CUSTOM"

type TimingUnit = "MINUTES" | "HOURS" | "DAYS" | "WEEKS" | "MONTHS"
type TimingDirection = "BEFORE" | "AFTER" | "AT"
type ActionType = "ANNOUNCEMENT" | "EMAIL" | "SMS"
type RecipientType = "ALL_GUARDIANS" | "ALL_ATHLETES" | "PROGRAM_MEMBERS" | "MEMBERSHIP_HOLDERS" | "INTERNAL_USERS" | "CUSTOM"

interface NotificationTemplate {
  id: string
  subject?: string
  body: string
  smsBody?: string
}

interface RecipientConfig {
  id: string
  recipientType: RecipientType
  filters?: Record<string, any>
  ccEmails?: string[]
}

interface NotificationRule {
  id: string
  name: string
  description?: string
  triggerType: TriggerType
  timingValue: number
  timingUnit: TimingUnit
  timingDirection: TimingDirection
  actionType: ActionType
  isSystem: boolean
  isActive: boolean
  template?: NotificationTemplate
  recipientConfig?: RecipientConfig
}

interface PlaceholderDefinition {
  key: string
  label: string
  description: string
  example: string
  category: string
}

const TRIGGER_TYPE_LABELS: Record<TriggerType, string> = {
  MEMBERSHIP_EXPIRY: "Membership Expiring",
  MEMBERSHIP_EXPIRED: "Membership Expired",
  PAYMENT_DUE: "Payment Due",
  PAYMENT_OVERDUE: "Payment Overdue",
  PAYMENT_RECEIVED: "Payment Received",
  PROGRAM_REMINDER: "Program Reminder",
  PROGRAM_ENROLLMENT: "Program Enrollment",
  PROGRAM_CANCELLATION: "Program Cancelled",
  EVENT_REMINDER: "Event Reminder",
  EVENT_REGISTRATION_OPEN: "Registration Opening",
  EVENT_REGISTRATION_CLOSE: "Registration Closing",
  ATTENDANCE_MISSED: "Attendance Missed",
  SKILL_ACHIEVED: "Skill Achieved",
  EVALUATION_DUE: "Evaluation Due",
  EVALUATION_COMPLETED: "Evaluation Completed",
  BIRTHDAY: "Birthday",
  WAITLIST_OPENING: "Waitlist Opening",
  CONTRACT_RENEWAL: "Contract Renewal",
  MAKEUP_CLASS_EXPIRING: "Makeup Class Expiring",
  CUSTOM: "Custom",
}

const TIMING_UNIT_LABELS: Record<TimingUnit, string> = {
  MINUTES: "Minutes",
  HOURS: "Hours",
  DAYS: "Days",
  WEEKS: "Weeks",
  MONTHS: "Months",
}

const TIMING_DIRECTION_LABELS: Record<TimingDirection, string> = {
  BEFORE: "Before",
  AFTER: "After",
  AT: "At",
}

const ACTION_LABELS: Record<ActionType, string> = {
  ANNOUNCEMENT: "Post Announcement",
  EMAIL: "Send Email",
  SMS: "Send SMS",
}

const RECIPIENT_LABELS: Record<RecipientType, string> = {
  ALL_GUARDIANS: "All Guardians",
  ALL_ATHLETES: "All Athletes",
  PROGRAM_MEMBERS: "Program Members",
  MEMBERSHIP_HOLDERS: "Membership Holders",
  INTERNAL_USERS: "Staff & Coaches",
  CUSTOM: "Custom Filter",
}

export default function NotificationsPage() {
  const [rules, setRules] = useState<NotificationRule[]>([])
  const [placeholders, setPlaceholders] = useState<PlaceholderDefinition[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [editingRule, setEditingRule] = useState<NotificationRule | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [previewContent, setPreviewContent] = useState("")
  const [isLoadingPreview, setIsLoadingPreview] = useState(false)

  // Form state
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [triggerType, setTriggerType] = useState<TriggerType>("MEMBERSHIP_EXPIRY")
  const [timingValue, setTimingValue] = useState<number>(1)
  const [timingUnit, setTimingUnit] = useState<TimingUnit>("DAYS")
  const [timingDirection, setTimingDirection] = useState<TimingDirection>("BEFORE")
  const [actionType, setActionType] = useState<ActionType>("EMAIL")
  const [recipientType, setRecipientType] = useState<RecipientType>("ALL_GUARDIANS")
  const [templateSubject, setTemplateSubject] = useState("")
  const [templateBody, setTemplateBody] = useState("")
  const [templateSmsBody, setTemplateSmsBody] = useState("")

  // Fetch rules on mount
  useEffect(() => {
    fetchRules()
    fetchPlaceholders()
  }, [])

  // Fetch placeholders when trigger type changes
  useEffect(() => {
    fetchPlaceholders()
  }, [triggerType])

  const fetchRules = async () => {
    try {
      setIsLoading(true)
      const res = await fetch("/api/notifications/rules?includeInactive=true&ensureSystemRules=true")
      if (!res.ok) throw new Error("Failed to fetch rules")
      const data = await res.json()
      setRules(data.data || [])
    } catch (error) {
      toast.error("Failed to load notification rules")
    } finally {
      setIsLoading(false)
    }
  }

  const fetchPlaceholders = async () => {
    try {
      const res = await fetch(`/api/notifications/placeholders?triggerType=${triggerType}`)
      if (!res.ok) throw new Error("Failed to fetch placeholders")
      const data = await res.json()
      setPlaceholders(data.placeholders || [])
    } catch (error) {
      console.error("Failed to fetch placeholders:", error)
    }
  }

  const resetForm = () => {
    setName("")
    setDescription("")
    setTriggerType("MEMBERSHIP_EXPIRY")
    setTimingValue(1)
    setTimingUnit("DAYS")
    setTimingDirection("BEFORE")
    setActionType("EMAIL")
    setRecipientType("ALL_GUARDIANS")
    setTemplateSubject("")
    setTemplateBody("")
    setTemplateSmsBody("")
    setEditingRule(null)
  }

  const handleOpenDialog = (rule?: NotificationRule) => {
    if (rule) {
      setEditingRule(rule)
      setName(rule.name)
      setDescription(rule.description || "")
      setTriggerType(rule.triggerType)
      setTimingValue(rule.timingValue)
      setTimingUnit(rule.timingUnit)
      setTimingDirection(rule.timingDirection)
      setActionType(rule.actionType)
      setRecipientType(rule.recipientConfig?.recipientType || "ALL_GUARDIANS")
      setTemplateSubject(rule.template?.subject || "")
      setTemplateBody(rule.template?.body || "")
      setTemplateSmsBody(rule.template?.smsBody || "")
    } else {
      resetForm()
    }
    setIsDialogOpen(true)
  }

  const handleSaveRule = async () => {
    if (!name || !templateBody) {
      toast.error("Please fill in all required fields")
      return
    }

    setIsSaving(true)
    try {
      const payload = {
        name,
        description,
        triggerType,
        timingValue,
        timingUnit,
        timingDirection,
        actionType,
        template: {
          subject: templateSubject || undefined,
          body: templateBody,
          smsBody: templateSmsBody || undefined,
        },
        recipientConfig: {
          recipientType,
          filters: {},
        },
      }

      let res
      if (editingRule) {
        res = await fetch(`/api/notifications/rules/${editingRule.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      } else {
        res = await fetch("/api/notifications/rules", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      }

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to save rule")
      }

      toast.success(editingRule ? "Rule updated successfully" : "Rule created successfully")

      setIsDialogOpen(false)
      resetForm()
      fetchRules()
    } catch (error: any) {
      toast.error(error.message || "Failed to save rule")
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteRule = async (id: string) => {
    if (!confirm("Are you sure you want to delete this rule?")) return

    try {
      const res = await fetch(`/api/notifications/rules/${id}`, {
        method: "DELETE",
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to delete rule")
      }

      toast.success("Rule deleted successfully")

      fetchRules()
    } catch (error: any) {
      toast.error(error.message || "Failed to delete rule")
    }
  }

  const handleToggleActive = async (rule: NotificationRule) => {
    try {
      const res = await fetch(`/api/notifications/rules/${rule.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !rule.isActive }),
      })

      if (!res.ok) throw new Error("Failed to update rule")

      toast.success(`Rule ${rule.isActive ? "disabled" : "enabled"} successfully`)

      fetchRules()
    } catch (error) {
      toast.error("Failed to update rule")
    }
  }

  const handlePreview = async () => {
    if (!templateBody) return

    setIsLoadingPreview(true)
    try {
      const res = await fetch("/api/notifications/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template: templateBody,
          triggerType,
        }),
      })

      if (!res.ok) throw new Error("Failed to generate preview")

      const data = await res.json()
      setPreviewContent(data.preview)
      setIsPreviewOpen(true)
    } catch (error) {
      toast.error("Failed to generate preview")
    } finally {
      setIsLoadingPreview(false)
    }
  }

  const insertPlaceholder = (key: string) => {
    const placeholder = `{{${key}}}`
    setTemplateBody((prev) => prev + placeholder)
  }

  const getActionIcon = (action: ActionType) => {
    switch (action) {
      case "EMAIL":
        return <Mail className="h-4 w-4" />
      case "SMS":
        return <MessageSquare className="h-4 w-4" />
      case "ANNOUNCEMENT":
        return <Bell className="h-4 w-4" />
    }
  }

  const formatTiming = (rule: NotificationRule) => {
    if (rule.timingValue === 0 || rule.timingDirection === "AT") {
      return `At ${TRIGGER_TYPE_LABELS[rule.triggerType]}`
    }
    const unitLabel = rule.timingValue === 1 
      ? rule.timingUnit.toLowerCase().slice(0, -1) 
      : rule.timingUnit.toLowerCase()
    return `${rule.timingValue} ${unitLabel} ${rule.timingDirection.toLowerCase()} ${TRIGGER_TYPE_LABELS[rule.triggerType]}`
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Notifications & Reminders</h1>
          <p className="text-muted-foreground">
            Configure automated messages based on system events.
          </p>
        </div>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="mr-2 h-4 w-4" />
          Add Notification Rule
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Notification Rules</CardTitle>
          <CardDescription>
            Manage your automated communication workflows. System rules (marked with lock icon) cannot be deleted but can be customized.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center h-24">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rule Name</TableHead>
                  <TableHead>Trigger</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Recipients</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rules.map((rule) => (
                  <TableRow key={rule.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {rule.isSystem && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger>
                                <Lock className="h-3 w-3 text-muted-foreground" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>System rule - cannot be deleted</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                        {rule.name}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatTiming(rule)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getActionIcon(rule.actionType)}
                        <span className="text-sm">{ACTION_LABELS[rule.actionType]}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {RECIPIENT_LABELS[rule.recipientConfig?.recipientType || "ALL_GUARDIANS"]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={rule.isActive ? "default" : "outline"}>
                        {rule.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleOpenDialog(rule)}>
                            <Edit className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleToggleActive(rule)}>
                            {rule.isActive ? (
                              <>
                                <AlertCircle className="mr-2 h-4 w-4" />
                                Disable
                              </>
                            ) : (
                              <>
                                <Check className="mr-2 h-4 w-4" />
                                Enable
                              </>
                            )}
                          </DropdownMenuItem>
                          {!rule.isSystem && (
                            <DropdownMenuItem
                              onClick={() => handleDeleteRule(rule.id)}
                              className="text-destructive"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
                {rules.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground h-24">
                      No notification rules configured.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingRule ? "Edit Notification Rule" : "Create Notification Rule"}
              {editingRule?.isSystem && (
                <Badge variant="secondary" className="ml-2">System Rule</Badge>
              )}
            </DialogTitle>
            <DialogDescription>
              {editingRule?.isSystem
                ? "System rules can only have their template and status modified."
                : "Set up the trigger, action, and recipients for this automation."}
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="settings" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="settings">Settings</TabsTrigger>
              <TabsTrigger value="template">Template</TabsTrigger>
              <TabsTrigger value="recipients">Recipients</TabsTrigger>
            </TabsList>

            <TabsContent value="settings" className="space-y-4 mt-4">
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Rule Name</Label>
                  <Input
                    id="name"
                    placeholder="e.g., Membership Expiry Warning"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={editingRule?.isSystem}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="description">Description (optional)</Label>
                  <Input
                    id="description"
                    placeholder="Brief description of this rule"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    disabled={editingRule?.isSystem}
                  />
                </div>
                
                <div className="grid gap-2">
                  <Label htmlFor="trigger-type">Trigger Event</Label>
                  <Select 
                    value={triggerType} 
                    onValueChange={(val) => setTriggerType(val as TriggerType)}
                    disabled={editingRule?.isSystem}
                  >
                    <SelectTrigger id="trigger-type">
                      <SelectValue placeholder="Select an event" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(TRIGGER_TYPE_LABELS)
                        .sort(([, a], [, b]) => a.localeCompare(b))
                        .map(([key, label]) => (
                        <SelectItem key={key} value={key}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label>Timing</Label>
                  <div className="flex gap-2">
                    <Input 
                      type="number"
                      min="0"
                      className="w-24"
                      value={timingValue}
                      onChange={(e) => setTimingValue(parseInt(e.target.value) || 0)}
                      disabled={editingRule?.isSystem}
                    />
                    <Select 
                      value={timingUnit} 
                      onValueChange={(val) => setTimingUnit(val as TimingUnit)}
                      disabled={editingRule?.isSystem}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(TIMING_UNIT_LABELS).map(([key, label]) => (
                          <SelectItem key={key} value={key}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select 
                      value={timingDirection} 
                      onValueChange={(val) => setTimingDirection(val as TimingDirection)}
                      disabled={editingRule?.isSystem}
                    >
                      <SelectTrigger className="w-28">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(TIMING_DIRECTION_LABELS).map(([key, label]) => (
                          <SelectItem key={key} value={key}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="action">Action</Label>
                  <Select 
                    value={actionType} 
                    onValueChange={(val) => setActionType(val as ActionType)}
                    disabled={editingRule?.isSystem}
                  >
                    <SelectTrigger id="action">
                      <SelectValue placeholder="Select an action" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(ACTION_LABELS).map(([key, label]) => (
                        <SelectItem key={key} value={key}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="template" className="space-y-4 mt-4">
              {actionType === "EMAIL" && (
                <div className="grid gap-2">
                  <Label htmlFor="subject">Email Subject</Label>
                  <Input
                    id="subject"
                    placeholder="e.g., Your membership is expiring soon"
                    value={templateSubject}
                    onChange={(e) => setTemplateSubject(e.target.value)}
                  />
                </div>
              )}

              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="body">
                    {actionType === "SMS" ? "SMS Message" : "Message Body"}
                  </Label>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={handlePreview}
                    disabled={!templateBody || isLoadingPreview}
                  >
                    {isLoadingPreview ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Eye className="mr-2 h-4 w-4" />
                    )}
                    Preview
                  </Button>
                </div>
                <Textarea
                  id="body"
                  placeholder="Enter your message here. Use placeholders like {{athleteName}} for dynamic content."
                  value={templateBody}
                  onChange={(e) => setTemplateBody(e.target.value)}
                  rows={8}
                />
              </div>

              {actionType === "EMAIL" && (
                <div className="grid gap-2">
                  <Label htmlFor="sms-body">SMS Version (optional, for SMS fallback)</Label>
                  <Textarea
                    id="sms-body"
                    placeholder="Shorter version for SMS (160 characters recommended)"
                    value={templateSmsBody}
                    onChange={(e) => setTemplateSmsBody(e.target.value)}
                    rows={3}
                  />
                </div>
              )}

              <div className="border rounded-md p-4">
                <Label className="text-sm font-medium mb-2 block">Available Placeholders</Label>
                <p className="text-xs text-muted-foreground mb-3">
                  Click a placeholder to insert it into your message.
                </p>
                <div className="flex flex-wrap gap-2">
                  {placeholders.map((p) => (
                    <TooltipProvider key={p.key}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => insertPlaceholder(p.key)}
                            className="text-xs"
                          >
                            <Copy className="mr-1 h-3 w-3" />
                            {`{{${p.key}}}`}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="font-medium">{p.label}</p>
                          <p className="text-xs text-muted-foreground">{p.description}</p>
                          <p className="text-xs mt-1">Example: {p.example}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ))}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="recipients" className="space-y-4 mt-4">
              <div className="grid gap-2">
                <Label htmlFor="recipient-type">Who should receive this notification?</Label>
                <Select 
                  value={recipientType} 
                  onValueChange={(val) => setRecipientType(val as RecipientType)}
                  disabled={editingRule?.isSystem}
                >
                  <SelectTrigger id="recipient-type">
                    <SelectValue placeholder="Select recipients" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(RECIPIENT_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="rounded-md bg-muted p-4">
                <h4 className="font-medium text-sm mb-2">Recipient Description</h4>
                <p className="text-sm text-muted-foreground">
                  {recipientType === "ALL_GUARDIANS" && "All guardians in your organization will receive this notification."}
                  {recipientType === "ALL_ATHLETES" && "All guardians with athletes will receive this notification on behalf of their athletes."}
                  {recipientType === "PROGRAM_MEMBERS" && "Only guardians with athletes enrolled in specific programs will receive this notification."}
                  {recipientType === "MEMBERSHIP_HOLDERS" && "Only guardians with athletes who hold specific memberships will receive this notification."}
                  {recipientType === "INTERNAL_USERS" && "Only staff members, coaches, and administrators will receive this notification."}
                  {recipientType === "CUSTOM" && "Custom filter to target specific subsets of recipients."}
                </p>
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveRule} disabled={!name || !templateBody || isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Rule"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Template Preview</DialogTitle>
            <DialogDescription>
              This preview shows how your message will look with example data.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md bg-muted p-4 whitespace-pre-wrap font-mono text-sm">
            {previewContent}
          </div>
          <DialogFooter>
            <Button onClick={() => setIsPreviewOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
