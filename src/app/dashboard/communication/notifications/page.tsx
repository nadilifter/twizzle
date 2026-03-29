"use client"

import React, { useState, useEffect, useRef } from "react"
import { useFeatures } from "@/components/feature-context"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  defineStepper,
  StepperNav,
  StepperItem,
  StepperIndicator,
  StepperSeparator,
  StepperTitle,
  getStepStatus,
} from "@/components/ui/stepper"
import { Plus, Trash2, Edit, Bell, Mail, MessageSquare, MoreVertical, Lock, Eye, Copy, Loader2, AlertCircle, Check, Send, FileText, ChevronLeft, ChevronRight, ArrowLeft, ArrowRight } from "lucide-react"
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
  | "RECURRING_CHARGE_UPCOMING"
  | "RECURRING_CHARGE_SUCCEEDED"
  | "RECURRING_CHARGE_FAILED"
  | "RECURRING_CHARGE_SUSPENDED"
  | "CUSTOM"

type LogStatus = "PENDING" | "SENT" | "DELIVERED" | "FAILED" | "SKIPPED"

type TimingUnit = "MINUTES" | "HOURS" | "DAYS" | "WEEKS" | "MONTHS"
type TimingDirection = "BEFORE" | "AFTER" | "AT"
type ActionType = "ANNOUNCEMENT" | "EMAIL" | "SMS"
type RecipientType = "GUARDIANS" | "MEMBERSHIP_HOLDERS" | "INTERNAL_USERS" | "CUSTOM"

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

interface NotificationLog {
  id: string
  triggerType: TriggerType
  actionType: ActionType
  recipientEmail?: string
  recipientPhone?: string
  recipientName?: string
  subject?: string
  body: string
  status: LogStatus
  errorMessage?: string
  sentAt?: string
  createdAt: string
  notificationRule?: { name: string } | null
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
  RECURRING_CHARGE_UPCOMING: "Recurring Charge Upcoming",
  RECURRING_CHARGE_SUCCEEDED: "Recurring Charge Succeeded",
  RECURRING_CHARGE_FAILED: "Recurring Charge Failed",
  RECURRING_CHARGE_SUSPENDED: "Recurring Charge Suspended",
  CUSTOM: "Custom",
}

const LOG_STATUS_LABELS: Record<LogStatus, string> = {
  PENDING: "Pending",
  SENT: "Sent",
  DELIVERED: "Delivered",
  FAILED: "Failed",
  SKIPPED: "Skipped",
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
  GUARDIANS: "Guardians",
  MEMBERSHIP_HOLDERS: "Membership Holders",
  INTERNAL_USERS: "Staff & Coaches",
  CUSTOM: "Custom Filter",
}

const TIMING_DEFAULTS: Record<string, { value: number; unit: TimingUnit; direction: TimingDirection }> = {
  MEMBERSHIP_EXPIRY: { value: 7, unit: "DAYS", direction: "BEFORE" },
  EVENT_REMINDER: { value: 7, unit: "DAYS", direction: "BEFORE" },
  PROGRAM_REMINDER: { value: 7, unit: "DAYS", direction: "BEFORE" },
  PAYMENT_DUE: { value: 3, unit: "DAYS", direction: "BEFORE" },
  RECURRING_CHARGE_UPCOMING: { value: 3, unit: "DAYS", direction: "BEFORE" },
  BIRTHDAY: { value: 0, unit: "DAYS", direction: "AT" },
}

const DEFAULT_TIMING = { value: 0, unit: "MINUTES" as TimingUnit, direction: "AFTER" as TimingDirection }

const PLACEHOLDER_CATEGORY_LABELS: Record<string, string> = {
  athlete: "Athlete",
  guardian: "Guardian",
  membership: "Membership",
  program: "Program",
  event: "Event",
  payment: "Payment",
  organization: "Organization",
  date: "Date",
}

const { useStepper: useRuleStepper } = defineStepper(
  { id: "trigger", title: "Trigger" },
  { id: "delivery", title: "Delivery" },
  { id: "recipients", title: "Recipients" },
  { id: "template", title: "Template" },
  { id: "review", title: "Review" },
)

export default function NotificationsPage() {
  const { isFeatureEnabled } = useFeatures()
  const membershipsEnabled = isFeatureEnabled("memberships")

  const [rules, setRules] = useState<NotificationRule[]>([])
  const [placeholders, setPlaceholders] = useState<PlaceholderDefinition[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [editingRule, setEditingRule] = useState<NotificationRule | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [previewContent, setPreviewContent] = useState("")
  const [isLoadingPreview, setIsLoadingPreview] = useState(false)

  // Logs state
  const [logs, setLogs] = useState<NotificationLog[]>([])
  const [logsTotal, setLogsTotal] = useState(0)
  const [logsOffset, setLogsOffset] = useState(0)
  const [isLoadingLogs, setIsLoadingLogs] = useState(false)
  const [logStatusFilter, setLogStatusFilter] = useState<string>("all")
  const [showLogs, setShowLogs] = useState(false)

  // Test send state
  const [isSendingTest, setIsSendingTest] = useState<string | null>(null)

  // Recipient filter state
  const [filterMembershipGroupIds, setFilterMembershipGroupIds] = useState<string[]>([])
  const [availableMembershipGroups, setAvailableMembershipGroups] = useState<{ id: string; name: string }[]>([])

  // Stepper
  const ruleStepper = useRuleStepper()
  const currentStepId = ruleStepper.state.current.data.id

  // Form state
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [triggerType, setTriggerType] = useState<TriggerType>("MEMBERSHIP_EXPIRY")
  const [timingValue, setTimingValue] = useState<number>(1)
  const [timingUnit, setTimingUnit] = useState<TimingUnit>("DAYS")
  const [timingDirection, setTimingDirection] = useState<TimingDirection>("BEFORE")
  const [actionType, setActionType] = useState<ActionType>("EMAIL")
  const [recipientType, setRecipientType] = useState<RecipientType>("GUARDIANS")
  const [templateSubject, setTemplateSubject] = useState("")
  const [templateBody, setTemplateBody] = useState("")
  const [templateSmsBody, setTemplateSmsBody] = useState("")
  const [showFullBody, setShowFullBody] = useState(false)

  // Track whether user has manually changed timing/recipient (don't override manual edits)
  const userChangedTimingRef = useRef(false)
  const userChangedRecipientRef = useRef(false)

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

  const fetchLogs = async (offset = 0) => {
    try {
      setIsLoadingLogs(true)
      const params = new URLSearchParams({ limit: "20", offset: String(offset) })
      if (logStatusFilter !== "all") params.set("status", logStatusFilter)
      const res = await fetch(`/api/notifications/logs?${params}`)
      if (!res.ok) throw new Error("Failed to fetch logs")
      const data = await res.json()
      setLogs(data.data || [])
      setLogsTotal(data.total || 0)
      setLogsOffset(offset)
    } catch (error) {
      toast.error("Failed to load notification logs")
    } finally {
      setIsLoadingLogs(false)
    }
  }

  const handleSendTest = async (ruleId: string) => {
    setIsSendingTest(ruleId)
    try {
      const res = await fetch(`/api/notifications/rules/${ruleId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to send test")
      }
      const data = await res.json()
      toast.success(`Test sent: ${data.sentCount} sent, ${data.skippedCount} skipped`)
    } catch (error: any) {
      toast.error(error.message || "Failed to send test notification")
    } finally {
      setIsSendingTest(null)
    }
  }

  const fetchMembershipGroups = async () => {
    try {
      const res = await fetch("/api/memberships?limit=200")
      if (res.ok) {
        const data = await res.json()
        setAvailableMembershipGroups((data.data || data || []).map((g: any) => ({ id: g.id, name: g.name })))
      }
    } catch {}
  }

  useEffect(() => {
    if (recipientType === "MEMBERSHIP_HOLDERS" && availableMembershipGroups.length === 0) fetchMembershipGroups()
  }, [recipientType])

  useEffect(() => {
    if (showLogs) fetchLogs(0)
  }, [showLogs, logStatusFilter])

  // Auto-set timing defaults when trigger changes (only for new rules, only if user hasn't manually edited)
  useEffect(() => {
    if (editingRule || userChangedTimingRef.current) return
    const defaults = TIMING_DEFAULTS[triggerType] ?? DEFAULT_TIMING
    setTimingValue(defaults.value)
    setTimingUnit(defaults.unit)
    setTimingDirection(defaults.direction)
  }, [triggerType, editingRule])

  // Auto-set default name when trigger changes (only for new rules).
  // `name` intentionally omitted — we only want this to fire on trigger selection, not on keystrokes.
  useEffect(() => {
    if (editingRule) return
    if (!name) {
      setName(`${TRIGGER_TYPE_LABELS[triggerType]} Notification`)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [triggerType])

  // Auto-suggest recipient based on trigger (only for new rules, only if user hasn't manually edited)
  useEffect(() => {
    if (editingRule || userChangedRecipientRef.current) return
    setRecipientType("GUARDIANS")
  }, [triggerType, editingRule])

  const resetForm = () => {
    setName("")
    setDescription("")
    setTriggerType("MEMBERSHIP_EXPIRY")
    setTimingValue(1)
    setTimingUnit("DAYS")
    setTimingDirection("BEFORE")
    setActionType("EMAIL")
    setRecipientType("GUARDIANS")
    setTemplateSubject("")
    setTemplateBody("")
    setTemplateSmsBody("")
    setFilterMembershipGroupIds([])
    setEditingRule(null)
    setShowFullBody(false)
    userChangedTimingRef.current = false
    userChangedRecipientRef.current = false
    ruleStepper.navigation.goTo("trigger")
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
      setRecipientType((rule.recipientConfig?.recipientType as RecipientType) || "GUARDIANS")
      setTemplateSubject(rule.template?.subject || "")
      setTemplateBody(rule.template?.body || "")
      setTemplateSmsBody(rule.template?.smsBody || "")
      setFilterMembershipGroupIds(rule.recipientConfig?.filters?.membershipGroupIds || [])
      setShowFullBody(false)
      userChangedTimingRef.current = true
      userChangedRecipientRef.current = true
      ruleStepper.navigation.goTo(rule.isSystem ? "template" : "trigger")
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
          filters: {
            ...(recipientType === "MEMBERSHIP_HOLDERS" && filterMembershipGroupIds.length > 0
              ? { membershipGroupIds: filterMembershipGroupIds }
              : {}),
          },
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

  // Step validation
  const canProceedFromTrigger = !!name.trim() && !!triggerType
  const canProceedFromDelivery = !!actionType
  const canProceedFromRecipients = !!recipientType
  const canProceedFromTemplate = !!templateBody.trim() && (actionType !== "EMAIL" || !!templateSubject.trim())

  const stepOrder = ["trigger", "delivery", "recipients", "template", "review"] as const

  const getEffectiveSteps = () => {
    if (actionType === "ANNOUNCEMENT") {
      return stepOrder.filter(s => s !== "recipients")
    }
    return [...stepOrder]
  }

  const handleNext = () => {
    const effective = getEffectiveSteps()
    const currentIdx = effective.indexOf(currentStepId as typeof effective[number])
    if (currentIdx < effective.length - 1) {
      ruleStepper.navigation.goTo(effective[currentIdx + 1])
    }
  }

  const handleBack = () => {
    const effective = getEffectiveSteps()
    const currentIdx = effective.indexOf(currentStepId as typeof effective[number])
    if (currentIdx > 0) {
      ruleStepper.navigation.goTo(effective[currentIdx - 1])
    }
  }

  const isFirstEffectiveStep = () => {
    const effective = getEffectiveSteps()
    return currentStepId === effective[0]
  }

  const isLastEffectiveStep = () => {
    const effective = getEffectiveSteps()
    return currentStepId === effective[effective.length - 1]
  }

  const canProceedFromCurrentStep = () => {
    switch (currentStepId) {
      case "trigger": return canProceedFromTrigger
      case "delivery": return canProceedFromDelivery
      case "recipients": return canProceedFromRecipients
      case "template": return canProceedFromTemplate
      case "review": return true
      default: return false
    }
  }

  // Group placeholders by category
  const groupedPlaceholders = placeholders.reduce<Record<string, PlaceholderDefinition[]>>((acc, p) => {
    if (!acc[p.category]) acc[p.category] = []
    acc[p.category].push(p)
    return acc
  }, {})

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
                        {RECIPIENT_LABELS[(rule.recipientConfig?.recipientType as RecipientType) || "GUARDIANS"]}
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
                          <DropdownMenuItem
                            onClick={() => handleSendTest(rule.id)}
                            disabled={isSendingTest === rule.id}
                          >
                            {isSendingTest === rule.id ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Sending...
                              </>
                            ) : (
                              <>
                                <Send className="mr-2 h-4 w-4" />
                                Send Test
                              </>
                            )}
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
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] flex flex-col overflow-hidden p-0">
          <DialogHeader className="px-6 pt-6 pb-0">
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

          <div className="flex flex-col gap-4 px-6 pt-4">
            {/* Stepper Navigation */}
            <StepperNav>
              {ruleStepper.state.all.map((step, index) => {
                const ruleCurrentIndex = ruleStepper.state.all.findIndex(s => s.id === currentStepId)
                const isSkipped = actionType === "ANNOUNCEMENT" && step.id === "recipients"
                const status = isSkipped ? "inactive" as const : getStepStatus(index, ruleCurrentIndex)
                return (
                  <React.Fragment key={step.id}>
                    <StepperItem status={status}>
                      <StepperIndicator
                        status={status}
                        step={index + 1}
                        onClick={() => {
                          if (isSkipped) return
                          const effective = getEffectiveSteps()
                          const effectiveCurrentIdx = effective.indexOf(currentStepId as typeof effective[number])
                          const effectiveTargetIdx = effective.indexOf(step.id as typeof effective[number])
                          if (effectiveTargetIdx >= 0 && effectiveTargetIdx < effectiveCurrentIdx) {
                            ruleStepper.navigation.goTo(step.id)
                          }
                        }}
                      />
                      <StepperTitle status={status} className="hidden sm:block">
                        {isSkipped ? <span className="line-through opacity-50">{step.title}</span> : step.title}
                      </StepperTitle>
                    </StepperItem>
                    {index < ruleStepper.state.all.length - 1 && (
                      <StepperSeparator status={status} />
                    )}
                  </React.Fragment>
                )
              })}
            </StepperNav>

            {/* Step 1: Trigger */}
            {currentStepId === "trigger" && (
              <div className="overflow-y-auto max-h-[calc(90vh-280px)] px-1 space-y-4 py-2">
                <div className="grid gap-2">
                  <Label htmlFor="trigger-type">Trigger Event</Label>
                  <Select
                    value={triggerType}
                    onValueChange={(val) => {
                      const newTrigger = val as TriggerType
                      setTriggerType(newTrigger)
                      if (!editingRule && (!name || name === `${TRIGGER_TYPE_LABELS[triggerType]} Notification`)) {
                        setName(`${TRIGGER_TYPE_LABELS[newTrigger]} Notification`)
                      }
                    }}
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
              </div>
            )}

            {/* Step 2: Delivery */}
            {currentStepId === "delivery" && (
              <div className="overflow-y-auto max-h-[calc(90vh-280px)] px-1 space-y-4 py-2">
                <div className="grid gap-2">
                  <Label htmlFor="action">Delivery Method</Label>
                  <Select
                    value={actionType}
                    onValueChange={(val) => setActionType(val as ActionType)}
                    disabled={editingRule?.isSystem}
                  >
                    <SelectTrigger id="action">
                      <SelectValue placeholder="Select a delivery method" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(ACTION_LABELS).map(([key, label]) => (
                        <SelectItem key={key} value={key}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {actionType === "ANNOUNCEMENT" && (
                    <p className="text-xs text-muted-foreground">
                      Announcements are posted org-wide. The recipients step will be skipped.
                    </p>
                  )}
                </div>

                <div className="grid gap-2">
                  <Label>Timing</Label>
                  <p className="text-xs text-muted-foreground">
                    When should this notification fire relative to the trigger event?
                  </p>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      min="0"
                      className="w-24"
                      value={timingValue}
                      onChange={(e) => {
                        userChangedTimingRef.current = true
                        setTimingValue(parseInt(e.target.value) || 0)
                      }}
                      disabled={editingRule?.isSystem}
                    />
                    <Select
                      value={timingUnit}
                      onValueChange={(val) => {
                        userChangedTimingRef.current = true
                        setTimingUnit(val as TimingUnit)
                      }}
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
                      onValueChange={(val) => {
                        userChangedTimingRef.current = true
                        setTimingDirection(val as TimingDirection)
                      }}
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
              </div>
            )}

            {/* Step 3: Recipients (skipped for ANNOUNCEMENT) */}
            {currentStepId === "recipients" && (
              <div className="overflow-y-auto max-h-[calc(90vh-280px)] px-1 space-y-4 py-2">
                <div className="grid gap-2">
                  <Label htmlFor="recipient-type">Who should receive this notification?</Label>
                  <Select
                    value={recipientType}
                    onValueChange={(val) => {
                      userChangedRecipientRef.current = true
                      setRecipientType(val as RecipientType)
                    }}
                    disabled={editingRule?.isSystem}
                  >
                    <SelectTrigger id="recipient-type">
                      <SelectValue placeholder="Select recipients" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(RECIPIENT_LABELS).filter(([key]) => membershipsEnabled || key !== "MEMBERSHIP_HOLDERS").map(([key, label]) => (
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
                    {recipientType === "GUARDIANS" && "The guardians of the affected athlete(s) will receive this notification."}
                    {recipientType === "MEMBERSHIP_HOLDERS" && "Only guardians with athletes who hold specific memberships will receive this notification."}
                    {recipientType === "INTERNAL_USERS" && "Only staff members, coaches, and administrators will receive this notification."}
                    {recipientType === "CUSTOM" && "Custom filter to target specific subsets of recipients."}
                  </p>
                </div>

                {recipientType === "MEMBERSHIP_HOLDERS" && availableMembershipGroups.length > 0 && (
                  <div className="grid gap-2">
                    <Label>Filter by Membership Groups (optional)</Label>
                    <p className="text-xs text-muted-foreground">
                      Leave empty to include all membership holders, or select specific groups.
                    </p>
                    <div className="border rounded-md p-3 max-h-48 overflow-y-auto space-y-2">
                      {availableMembershipGroups.map((group) => (
                        <div key={group.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`mem-${group.id}`}
                            checked={filterMembershipGroupIds.includes(group.id)}
                            onCheckedChange={(checked) => {
                              setFilterMembershipGroupIds((prev) =>
                                checked
                                  ? [...prev, group.id]
                                  : prev.filter((id) => id !== group.id)
                              )
                            }}
                          />
                          <label htmlFor={`mem-${group.id}`} className="text-sm cursor-pointer">
                            {group.name}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Step 4: Template */}
            {currentStepId === "template" && (
              <div className="overflow-y-auto max-h-[calc(90vh-280px)] px-1 space-y-4 py-2">
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
                      {actionType === "SMS" ? "SMS Message" : actionType === "ANNOUNCEMENT" ? "Announcement Body" : "Email Body"}
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
                    placeholder={
                      actionType === "SMS"
                        ? "Enter your SMS message (160 chars per segment)."
                        : "Enter your message here. Use placeholders like {{athleteName}} for dynamic content."
                    }
                    value={templateBody}
                    onChange={(e) => setTemplateBody(e.target.value)}
                    rows={actionType === "SMS" ? 4 : 8}
                  />
                  {actionType === "SMS" && (
                    <p className={`text-xs ${templateBody.length > 160 ? "text-amber-600 font-medium" : "text-muted-foreground"}`}>
                      {templateBody.length}/160 characters
                      {templateBody.length > 160 && ` (${Math.ceil(templateBody.length / 153)} SMS segments)`}
                    </p>
                  )}
                </div>

                <div className="border rounded-md p-4">
                  <Label className="text-sm font-medium mb-2 block">Available Placeholders</Label>
                  <p className="text-xs text-muted-foreground mb-3">
                    Click a placeholder to insert it into your message.
                  </p>
                  <div className="space-y-3">
                    {Object.entries(groupedPlaceholders).map(([category, items]) => (
                      <div key={category}>
                        <p className="text-xs font-medium text-muted-foreground mb-1.5">
                          {PLACEHOLDER_CATEGORY_LABELS[category] ?? category}
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {items.map((p) => (
                            <TooltipProvider key={p.key}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => insertPlaceholder(p.key)}
                                    className="text-xs h-7"
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
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Step 5: Review */}
            {currentStepId === "review" && (
              <div className="overflow-y-auto max-h-[calc(90vh-280px)] px-1 space-y-4 py-2">
                <div className="border rounded-md divide-y">
                  <div className="p-4 grid grid-cols-[120px_1fr] gap-2">
                    <span className="text-sm font-medium text-muted-foreground">Trigger</span>
                    <span className="text-sm">{TRIGGER_TYPE_LABELS[triggerType]}</span>
                    <span className="text-sm font-medium text-muted-foreground">Rule Name</span>
                    <span className="text-sm">{name}</span>
                    {description && (
                      <>
                        <span className="text-sm font-medium text-muted-foreground">Description</span>
                        <span className="text-sm">{description}</span>
                      </>
                    )}
                  </div>
                  <div className="p-4 grid grid-cols-[120px_1fr] gap-2">
                    <span className="text-sm font-medium text-muted-foreground">Delivery</span>
                    <span className="text-sm flex items-center gap-1.5">
                      {getActionIcon(actionType)}
                      {ACTION_LABELS[actionType]}
                    </span>
                    <span className="text-sm font-medium text-muted-foreground">Timing</span>
                    <span className="text-sm">
                      {timingValue === 0 || timingDirection === "AT"
                        ? "Immediately"
                        : `${timingValue} ${timingValue === 1 ? timingUnit.toLowerCase().slice(0, -1) : timingUnit.toLowerCase()} ${timingDirection.toLowerCase()}`}
                    </span>
                  </div>
                  {actionType !== "ANNOUNCEMENT" && (
                    <div className="p-4 grid grid-cols-[120px_1fr] gap-2">
                      <span className="text-sm font-medium text-muted-foreground">Recipients</span>
                      <span className="text-sm">
                        <Badge variant="secondary">{RECIPIENT_LABELS[recipientType]}</Badge>
                        {recipientType === "MEMBERSHIP_HOLDERS" && filterMembershipGroupIds.length > 0 && (
                          <span className="ml-2 text-xs text-muted-foreground">
                            ({filterMembershipGroupIds.length} group{filterMembershipGroupIds.length !== 1 ? "s" : ""} selected)
                          </span>
                        )}
                      </span>
                    </div>
                  )}
                  <div className="p-4 space-y-2">
                    {actionType === "EMAIL" && templateSubject && (
                      <div className="grid grid-cols-[120px_1fr] gap-2">
                        <span className="text-sm font-medium text-muted-foreground">Subject</span>
                        <span className="text-sm">{templateSubject}</span>
                      </div>
                    )}
                    <div className="grid grid-cols-[120px_1fr] gap-2">
                      <span className="text-sm font-medium text-muted-foreground">Message</span>
                      <div className="text-sm">
                        {templateBody.length > 200 && !showFullBody ? (
                          <>
                            <pre className="whitespace-pre-wrap font-sans text-sm text-muted-foreground bg-muted p-3 rounded-md">
                              {templateBody.slice(0, 200)}...
                            </pre>
                            <Button
                              variant="link"
                              size="sm"
                              className="px-0 h-auto mt-1"
                              onClick={() => setShowFullBody(true)}
                            >
                              Show full message
                            </Button>
                          </>
                        ) : (
                          <pre className="whitespace-pre-wrap font-sans text-sm text-muted-foreground bg-muted p-3 rounded-md">
                            {templateBody}
                          </pre>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {editingRule && (
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSendTest(editingRule.id)}
                      disabled={isSendingTest === editingRule.id}
                    >
                      {isSendingTest === editingRule.id ? (
                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sending...</>
                      ) : (
                        <><Send className="mr-2 h-4 w-4" />Send Test</>
                      )}
                    </Button>
                  </div>
                )}

                <Button
                  className="w-full"
                  onClick={handleSaveRule}
                  disabled={!canProceedFromTrigger || !canProceedFromTemplate || isSaving}
                >
                  {isSaving ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</>
                  ) : (
                    editingRule ? "Save Changes" : "Create Rule"
                  )}
                </Button>
              </div>
            )}
          </div>

          {/* Footer Navigation */}
          {currentStepId !== "review" && (
            <div className="flex items-center justify-between border-t px-6 py-4 mt-auto">
              <Button
                variant="outline"
                onClick={() => {
                  if (isFirstEffectiveStep()) setIsDialogOpen(false)
                  else handleBack()
                }}
              >
                {isFirstEffectiveStep() ? (
                  "Cancel"
                ) : (
                  <><ArrowLeft className="mr-2 h-4 w-4" />Back</>
                )}
              </Button>
              <Button
                onClick={handleNext}
                disabled={!canProceedFromCurrentStep()}
              >
                Next
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          )}
          {currentStepId === "review" && (
            <div className="flex items-center justify-start border-t px-6 py-4 mt-auto">
              <Button variant="outline" onClick={handleBack}>
                <ArrowLeft className="mr-2 h-4 w-4" />Back
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Notification Logs */}
      <Card>
        <CardHeader
          className="cursor-pointer"
          onClick={() => setShowLogs(!showLogs)}
        >
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Notification Logs
              </CardTitle>
              <CardDescription>
                View the history of sent notifications.
              </CardDescription>
            </div>
            <Button variant="ghost" size="sm">
              {showLogs ? "Hide" : "Show"}
            </Button>
          </div>
        </CardHeader>
        {showLogs && (
          <CardContent>
            <div className="flex items-center gap-2 mb-4">
              <Label className="text-sm">Status:</Label>
              <Select value={logStatusFilter} onValueChange={setLogStatusFilter}>
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {Object.entries(LOG_STATUS_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {isLoadingLogs ? (
              <div className="flex items-center justify-center h-24">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Rule</TableHead>
                      <TableHead>Trigger</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Recipient</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                          {new Date(log.createdAt).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-sm">
                          {log.notificationRule?.name || "—"}
                        </TableCell>
                        <TableCell className="text-sm">
                          {TRIGGER_TYPE_LABELS[log.triggerType] || log.triggerType}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {getActionIcon(log.actionType)}
                            <span className="text-sm">{ACTION_LABELS[log.actionType]}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          {log.recipientName || log.recipientEmail || log.recipientPhone || "—"}
                        </TableCell>
                        <TableCell>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger>
                                <Badge variant={
                                  log.status === "SENT" || log.status === "DELIVERED" ? "default" :
                                  log.status === "FAILED" ? "destructive" :
                                  "secondary"
                                }>
                                  {LOG_STATUS_LABELS[log.status]}
                                </Badge>
                              </TooltipTrigger>
                              {log.errorMessage && (
                                <TooltipContent>
                                  <p className="text-xs">{log.errorMessage}</p>
                                </TooltipContent>
                              )}
                            </Tooltip>
                          </TooltipProvider>
                        </TableCell>
                      </TableRow>
                    ))}
                    {logs.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground h-24">
                          No notification logs found.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>

                {logsTotal > 20 && (
                  <div className="flex items-center justify-between mt-4">
                    <p className="text-sm text-muted-foreground">
                      Showing {logsOffset + 1}–{Math.min(logsOffset + 20, logsTotal)} of {logsTotal}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={logsOffset === 0}
                        onClick={() => fetchLogs(Math.max(0, logsOffset - 20))}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={logsOffset + 20 >= logsTotal}
                        onClick={() => fetchLogs(logsOffset + 20)}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        )}
      </Card>

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
