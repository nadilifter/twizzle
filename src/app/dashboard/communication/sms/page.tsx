"use client"

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { useFeatures } from "@/components/feature-context"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  defineStepper,
  StepperNav,
  StepperItem,
  StepperIndicator,
  StepperSeparator,
  StepperTitle,
  getStepStatus,
} from "@/components/ui/stepper"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  Plus,
  Search,
  MoreHorizontal,
  Send,
  Copy,
  Trash2,
  MessageSquare,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Users,
  Save,
  ArrowRight,
  ArrowLeft,
  Eye,
  Clock,
  Braces,
  Calendar as CalendarIcon,
  Phone,
  Hash,
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

// ============================================
// Types
// ============================================

interface SmsCampaign {
  id: string
  name: string
  body: string
  status: string
  targetType: string
  totalRecipients: number
  sentCount: number
  deliveredCount: number
  failedCount: number
  createdAt: string
  startedAt?: string
  completedAt?: string
  classification: string
}

type TargetType =
  | "ALL_USERS"
  | "ALL_MEMBERS"
  | "ALL_PROGRAM_REGISTRANTS"
  | "PROGRAM_ANY_INSTANCE"
  | "PROGRAM_SPECIFIC_INSTANCE"
  | "MEMBERSHIP_HOLDERS"
  | "SPECIFIC_USERS"
  | "ALL_GUARDIANS"

interface ProgramOption { id: string; name: string }
interface ProgramInstanceOption { id: string; date: string; startTime: string; endTime: string; status: string }
interface MembershipGroupOption { id: string; name: string }
interface GuardianOption { id: string; name: string; email: string }

// ============================================
// Constants
// ============================================

const TARGET_TYPE_LABELS: Record<TargetType, string> = {
  ALL_USERS: "All Staff & Users",
  ALL_MEMBERS: "All Members",
  ALL_PROGRAM_REGISTRANTS: "All Program Registrants",
  PROGRAM_ANY_INSTANCE: "Program Registrants (Any Instance)",
  PROGRAM_SPECIFIC_INSTANCE: "Program Registrants (Specific Instance)",
  MEMBERSHIP_HOLDERS: "Membership Holders",
  SPECIFIC_USERS: "Specific Guardians",
  ALL_GUARDIANS: "All Guardians",
}

const TARGET_TYPE_DESCRIPTIONS: Record<TargetType, string> = {
  ALL_USERS: "Send to all staff members, coaches, and admins in your organization.",
  ALL_MEMBERS: "Send to all guardians in your organization.",
  ALL_PROGRAM_REGISTRANTS: "Send to guardians with athletes enrolled in any active program.",
  PROGRAM_ANY_INSTANCE: "Send to guardians with athletes registered for any instance of a specific program.",
  PROGRAM_SPECIFIC_INSTANCE: "Send to guardians with athletes registered for a specific instance of a program.",
  MEMBERSHIP_HOLDERS: "Send to guardians with athletes holding specific membership types.",
  SPECIFIC_USERS: "Hand-pick specific guardians to send to.",
  ALL_GUARDIANS: "Send to all guardians in your organization.",
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
  SCHEDULED: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  SENDING: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
  COMPLETED: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  FAILED: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
  CANCELLED: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
}

const CLASSIFICATION_LABELS: Record<string, string> = {
  GENERAL: "General",
  REMINDER: "Reminder",
  ALERT: "Alert",
  BILLING: "Billing",
  EVENT: "Event",
  NEWS: "News",
}

interface PlaceholderDef {
  key: string
  label: string
  description: string
  example: string
  category: string
}

const PLACEHOLDER_DEFS: PlaceholderDef[] = [
  { key: "athleteName", label: "Athlete Name", description: "Full name of the athlete", example: "Emma Johnson", category: "athlete" },
  { key: "athleteFirstName", label: "Athlete First Name", description: "First name of the athlete", example: "Emma", category: "athlete" },
  { key: "guardianName", label: "Guardian Name", description: "Name of the guardian", example: "Sarah Johnson", category: "guardian" },
  { key: "guardianFirstName", label: "Guardian First Name", description: "First name of the guardian", example: "Sarah", category: "guardian" },
  { key: "guardianPhone", label: "Guardian Phone", description: "Phone of the guardian", example: "(555) 123-4567", category: "guardian" },
  { key: "guardianBalance", label: "Guardian Balance", description: "Guardian account balance", example: "$150.00", category: "guardian" },
  { key: "membershipName", label: "Membership Name", description: "Name of the membership instance", example: "Annual Membership 2026", category: "membership" },
  { key: "membershipGroupName", label: "Membership Type", description: "Name of the membership type", example: "Annual Membership", category: "membership" },
  { key: "membershipEndDate", label: "Membership End Date", description: "When the membership expires", example: "December 31, 2026", category: "membership" },
  { key: "membershipStatus", label: "Membership Status", description: "Current status of the membership", example: "Active", category: "membership" },
  { key: "programName", label: "Program Name", description: "Name of the program", example: "JO Team Training", category: "program" },
  { key: "organizationName", label: "Organization Name", description: "Name of your organization", example: "Sunrise Gymnastics", category: "organization" },
  { key: "organizationPhone", label: "Organization Phone", description: "Contact phone", example: "(555) 987-6543", category: "organization" },
  { key: "currentDate", label: "Current Date", description: "Today's date", example: "February 11, 2026", category: "date" },
]

const QUICK_PLACEHOLDERS = [
  "guardianFirstName",
  "athleteFirstName",
  "organizationName",
  "programName",
  "membershipName",
]

// ============================================
// Helpers
// ============================================

function renderPlaceholderPills(text: string) {
  if (!text) return null
  const parts = text.split(/(\{\{\w+\}\})/g)
  return parts.map((part, i) => {
    const match = part.match(/^\{\{(\w+)\}\}$/)
    if (match) {
      const def = PLACEHOLDER_DEFS.find((p) => p.key === match[1])
      const label = def?.label || match[1]
      return (
        <span
          key={i}
          className="inline-flex items-center px-1.5 py-0 rounded-full bg-blue-50 text-blue-700 text-xs font-medium border border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800 mx-0.5 whitespace-nowrap"
        >
          {label}
        </span>
      )
    }
    return part ? <span key={i}>{part}</span> : null
  })
}

/**
 * Simple GSM-7 segment calculator (mirrors server-side logic).
 * GSM-7: 160 chars per segment (or 153 if multi-part)
 * UCS-2: 70 chars per segment (or 67 if multi-part)
 */
function calculateSegmentsClient(text: string): { segments: number; encoding: string; charsPerSegment: number; charsRemaining: number } {
  if (!text) return { segments: 0, encoding: "GSM-7", charsPerSegment: 160, charsRemaining: 160 }

  // Check if text is GSM-7 compatible
  const gsm7 = /^[@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞ ÆæßÉ!\"#¤%&'()*+,\-.\/0-9:;<=>?¡A-ZÄÖÑÜa-zäöñüà\^{}\\\[~\]|€]*$/
  const isGsm7 = gsm7.test(text)
  const len = text.length

  if (isGsm7) {
    if (len <= 160) return { segments: 1, encoding: "GSM-7", charsPerSegment: 160, charsRemaining: 160 - len }
    const segments = Math.ceil(len / 153)
    return { segments, encoding: "GSM-7", charsPerSegment: 153, charsRemaining: (segments * 153) - len }
  } else {
    if (len <= 70) return { segments: 1, encoding: "UCS-2", charsPerSegment: 70, charsRemaining: 70 - len }
    const segments = Math.ceil(len / 67)
    return { segments, encoding: "UCS-2", charsPerSegment: 67, charsRemaining: (segments * 67) - len }
  }
}

// ============================================
// Stepper definition
// ============================================

const { useStepper: useSmsStepper } = defineStepper(
  { id: "campaign", title: "Campaign" },
  { id: "compose", title: "Compose" },
  { id: "preview", title: "Preview" },
  { id: "send", title: "Send" },
)

// ============================================
// Page Component
// ============================================

export default function SmsCampaignsPage() {
  const { isFeatureEnabled } = useFeatures()
  const membershipsEnabled = isFeatureEnabled("memberships")

  const activePlaceholders = useMemo(() =>
    membershipsEnabled ? PLACEHOLDER_DEFS : PLACEHOLDER_DEFS.filter((p) => p.category !== "membership"),
    [membershipsEnabled]
  )
  const activeQuickPlaceholders = useMemo(() =>
    membershipsEnabled ? QUICK_PLACEHOLDERS : QUICK_PLACEHOLDERS.filter((k) => k !== "membershipName"),
    [membershipsEnabled]
  )

  // List state
  const [campaigns, setCampaigns] = useState<SmsCampaign[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [selectedCampaign, setSelectedCampaign] = useState<SmsCampaign | null>(null)

  // Compose dialog state
  const [isComposeOpen, setIsComposeOpen] = useState(false)
  const smsStepper = useSmsStepper()
  const [isSending, setIsSending] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // Campaign form state
  const [campaignName, setCampaignName] = useState("")
  const [messageBody, setMessageBody] = useState("")
  const [classification, setClassification] = useState("GENERAL")
  const [targetType, setTargetType] = useState<TargetType>("ALL_MEMBERS")
  const [targetProgramId, setTargetProgramId] = useState("")
  const [targetProgramInstanceId, setTargetProgramInstanceId] = useState("")
  const [targetMembershipGroupIds, setTargetMembershipGroupIds] = useState<string[]>([])
  const [targetUserIds, setTargetUserIds] = useState<string[]>([])
  const [scheduledAt, setScheduledAt] = useState("")

  // Options for selectors
  const [programs, setPrograms] = useState<ProgramOption[]>([])
  const [programInstances, setProgramInstances] = useState<ProgramInstanceOption[]>([])
  const [membershipGroups, setMembershipGroups] = useState<MembershipGroupOption[]>([])
  const [guardians, setGuardians] = useState<GuardianOption[]>([])
  const [guardianSearch, setGuardianSearch] = useState("")

  // Recipient count
  const [recipientCount, setRecipientCount] = useState<number | null>(null)
  const [isLoadingRecipients, setIsLoadingRecipients] = useState(false)

  // Preview state
  const [previewBody, setPreviewBody] = useState("")
  const [previewSegments, setPreviewSegments] = useState(0)
  const [isLoadingPreview, setIsLoadingPreview] = useState(false)

  // Placeholder picker
  const [placeholderSearch, setPlaceholderSearch] = useState("")
  const [placeholderOpen, setPlaceholderOpen] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Segment info for the body
  const segmentInfo = useMemo(() => calculateSegmentsClient(messageBody), [messageBody])

  // ============================================
  // Data fetching
  // ============================================

  const fetchCampaigns = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (searchQuery) params.set("search", searchQuery)
      if (statusFilter !== "all") params.set("status", statusFilter)
      const response = await fetch(`/api/sms/campaigns?${params}`)
      if (!response.ok) throw new Error("Failed to fetch campaigns")
      const data = await response.json()
      setCampaigns(data.campaigns || [])
    } catch (error) {
      console.error("Error fetching campaigns:", error)
      toast.error("Failed to load SMS campaigns")
    } finally {
      setIsLoading(false)
    }
  }, [searchQuery, statusFilter])

  useEffect(() => { fetchCampaigns() }, [fetchCampaigns])

  useEffect(() => {
    fetch("/api/programs")
      .then((r) => r.json())
      .then((data) => setPrograms((data.data || data.programs || []).map((p: any) => ({ id: p.id, name: p.name }))))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!membershipsEnabled) return
    fetch("/api/memberships")
      .then((r) => r.json())
      .then((data) => setMembershipGroups((data.data || data.groups || []).map((g: any) => ({ id: g.id, name: g.name }))))
      .catch(() => {})
  }, [membershipsEnabled])

  useEffect(() => {
    if (!targetProgramId) { setProgramInstances([]); return }
    fetch(`/api/programs/${targetProgramId}/instances`)
      .then((r) => r.json())
      .then((data) => setProgramInstances(data.data || data.instances || []))
      .catch(() => {})
  }, [targetProgramId])

  useEffect(() => {
    if (targetType !== "SPECIFIC_USERS") return
    const params = guardianSearch ? `?search=${encodeURIComponent(guardianSearch)}` : ""
    fetch(`/api/guardians${params}`)
      .then((r) => r.json())
      .then((data) =>
        setGuardians((data.data || data.guardians || []).map((g: any) => ({ id: g.id, name: g.name, email: g.email })))
      )
      .catch(() => {})
  }, [targetType, guardianSearch])

  // Fetch recipient count
  useEffect(() => {
    if (!isComposeOpen) return
    const fetchRecipients = async () => {
      setIsLoadingRecipients(true)
      try {
        const body: any = { targetType }
        if (targetProgramId) body.targetProgramId = targetProgramId
        if (targetProgramInstanceId) body.targetProgramInstanceId = targetProgramInstanceId
        if (targetMembershipGroupIds.length > 0) body.targetMembershipGroupIds = targetMembershipGroupIds
        if (targetUserIds.length > 0) body.targetUserIds = targetUserIds
        const response = await fetch("/api/sms/campaigns/recipients", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
        if (response.ok) { const data = await response.json(); setRecipientCount(data.count) }
      } catch { setRecipientCount(null) } finally { setIsLoadingRecipients(false) }
    }
    const timeout = setTimeout(fetchRecipients, 300)
    return () => clearTimeout(timeout)
  }, [isComposeOpen, targetType, targetProgramId, targetProgramInstanceId, targetMembershipGroupIds, targetUserIds])

  // Fetch preview when entering step 3
  const fetchPreview = useCallback(async () => {
    if (!messageBody.trim()) return
    setIsLoadingPreview(true)
    try {
      const response = await fetch("/api/sms/campaigns/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          body: messageBody,
          targetType,
          targetProgramId: targetProgramId || undefined,
          targetProgramInstanceId: targetProgramInstanceId || undefined,
          targetMembershipGroupIds: targetMembershipGroupIds.length > 0 ? targetMembershipGroupIds : undefined,
          targetUserIds: targetUserIds.length > 0 ? targetUserIds : undefined,
        }),
      })
      if (response.ok) {
        const data = await response.json()
        setPreviewBody(data.previewBody)
        setPreviewSegments(data.segments)
      }
    } catch {} finally { setIsLoadingPreview(false) }
  }, [messageBody, targetType, targetProgramId, targetProgramInstanceId, targetMembershipGroupIds, targetUserIds])

  const currentStepId = smsStepper.state.current.data.id

  useEffect(() => {
    if (currentStepId === "preview") fetchPreview()
  }, [currentStepId, fetchPreview])

  // ============================================
  // Actions
  // ============================================

  const resetForm = useCallback(() => {
    setCampaignName(""); setMessageBody(""); setClassification("GENERAL")
    setTargetType("ALL_MEMBERS"); setTargetProgramId(""); setTargetProgramInstanceId("")
    setTargetMembershipGroupIds([]); setTargetUserIds([]); setScheduledAt("")
    setRecipientCount(null); setPreviewBody(""); setPreviewSegments(0); smsStepper.navigation.goTo("campaign")
  }, [smsStepper.navigation])

  const handleOpenCompose = useCallback(() => { resetForm(); setIsComposeOpen(true) }, [resetForm])

  const insertPlaceholder = useCallback((key: string) => {
    const placeholder = `{{${key}}}`
    const textarea = textareaRef.current
    if (textarea) {
      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      const newValue = messageBody.substring(0, start) + placeholder + messageBody.substring(end)
      setMessageBody(newValue)
      // Set cursor position after the inserted placeholder
      setTimeout(() => {
        textarea.focus()
        textarea.setSelectionRange(start + placeholder.length, start + placeholder.length)
      }, 0)
    } else {
      setMessageBody((prev) => prev + placeholder)
    }
    setPlaceholderOpen(false)
  }, [messageBody])

  const handleSubmit = useCallback(async (mode: "send" | "schedule" | "draft") => {
    if (!campaignName) { toast.error("Campaign name is required"); return }
    if (mode !== "draft" && !messageBody.trim()) { toast.error("Message body is required"); return }
    if (mode === "schedule" && !scheduledAt) { toast.error("Please select a date and time to schedule"); return }

    const setter = mode === "draft" ? setIsSaving : setIsSending
    setter(true)
    try {
      const response = await fetch("/api/sms/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: campaignName,
          body: messageBody,
          classification,
          targetType,
          targetProgramId: targetProgramId || undefined,
          targetProgramInstanceId: targetProgramInstanceId || undefined,
          targetMembershipGroupIds: targetMembershipGroupIds.length > 0 ? targetMembershipGroupIds : undefined,
          targetUserIds: targetUserIds.length > 0 ? targetUserIds : undefined,
          sendImmediately: mode === "send",
          scheduledAt: mode === "schedule" ? new Date(scheduledAt).toISOString() : undefined,
        }),
      })
      if (response.ok) {
        const data = await response.json()
        const msg = mode === "send" ? `Campaign sent to ${data.totalRecipients} recipients`
          : mode === "schedule" ? "Campaign scheduled successfully"
          : "Campaign saved as draft"
        toast.success(msg)
        setIsComposeOpen(false)
        fetchCampaigns()
      } else {
        const data = await response.json()
        toast.error(data.error || "Failed to save campaign")
      }
    } catch { toast.error("Failed to save campaign") } finally { setter(false) }
  }, [campaignName, messageBody, classification, targetType, targetProgramId, targetProgramInstanceId, targetMembershipGroupIds, targetUserIds, scheduledAt, fetchCampaigns])

  const handleDeleteCampaign = useCallback(async (id: string) => {
    try {
      const response = await fetch(`/api/sms/campaigns/${id}`, { method: "DELETE" })
      if (response.ok) { toast.success("Campaign deleted"); setSelectedCampaign(null); fetchCampaigns() }
      else toast.error("Failed to delete campaign")
    } catch { toast.error("Failed to delete campaign") }
  }, [fetchCampaigns])

  const handleDuplicateCampaign = useCallback((campaign: SmsCampaign) => {
    setCampaignName(`${campaign.name} (Copy)`)
    setMessageBody(campaign.body)
    setClassification(campaign.classification)
    smsStepper.navigation.goTo("campaign")
    setSelectedCampaign(null)
    setIsComposeOpen(true)
  }, [smsStepper.navigation])

  const handleSendExisting = useCallback(async (id: string) => {
    try {
      const response = await fetch(`/api/sms/campaigns/${id}/send`, { method: "POST" })
      if (response.ok) { toast.success("Campaign is being sent"); setSelectedCampaign(null); fetchCampaigns() }
      else { const data = await response.json(); toast.error(data.error || "Failed to send campaign") }
    } catch { toast.error("Failed to send campaign") }
  }, [fetchCampaigns])

  // Step validation
  const canProceedFromStep1 = !!campaignName.trim() && recipientCount !== null && recipientCount > 0
  const canProceedFromStep2 = messageBody.trim().length > 0

  const filteredCampaigns = useMemo(() => {
    return campaigns.filter((c) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        if (!c.name.toLowerCase().includes(q) && !c.body.toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [campaigns, searchQuery])

  const filteredPlaceholders = placeholderSearch
    ? activePlaceholders.filter(
        (p) =>
          p.label.toLowerCase().includes(placeholderSearch.toLowerCase()) ||
          p.key.toLowerCase().includes(placeholderSearch.toLowerCase())
      )
    : activePlaceholders

  // ============================================
  // Render
  // ============================================

  return (
    <div className="@container/main flex flex-1 flex-col gap-2">
      <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
        {/* Header */}
        <div className="flex items-center justify-between px-4 lg:px-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">SMS Campaigns</h1>
            <p className="text-muted-foreground text-sm">Create and send personalized text message campaigns to your community.</p>
          </div>
          <Button onClick={handleOpenCompose}>
            <Plus className="mr-2 h-4 w-4" />
            New Campaign
          </Button>
        </div>

        {/* Search & Filters */}
        <div className="flex items-center gap-3 px-4 lg:px-6">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input type="search" placeholder="Search campaigns..." className="pl-8" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="DRAFT">Draft</SelectItem>
              <SelectItem value="SENDING">Sending</SelectItem>
              <SelectItem value="COMPLETED">Completed</SelectItem>
              <SelectItem value="SCHEDULED">Scheduled</SelectItem>
              <SelectItem value="FAILED">Failed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Campaign List */}
        <div className="px-4 lg:px-6">
          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-6 space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="space-y-2 flex-1"><Skeleton className="h-5 w-48" /><Skeleton className="h-4 w-64" /><Skeleton className="h-3 w-32" /></div>
                      <div className="flex gap-6"><Skeleton className="h-8 w-12" /><Skeleton className="h-8 w-12" /></div>
                    </div>
                  ))}
                </div>
              ) : filteredCampaigns.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="font-medium">{searchQuery || statusFilter !== "all" ? "No campaigns match your filters." : "No SMS campaigns yet."}</p>
                  <p className="text-sm mt-1">{!searchQuery && statusFilter === "all" && "Create your first campaign to get started."}</p>
                </div>
              ) : (
                <div className="divide-y">
                  {filteredCampaigns.map((campaign) => (
                    <div key={campaign.id} className="flex items-center justify-between p-4 hover:bg-muted/50 cursor-pointer transition-colors" onClick={() => setSelectedCampaign(campaign)}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-medium truncate">{campaign.name}</h3>
                          <Badge className={STATUS_COLORS[campaign.status] || STATUS_COLORS.DRAFT}>{campaign.status}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground truncate">{campaign.body.substring(0, 80)}{campaign.body.length > 80 ? "..." : ""}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-muted-foreground">{TARGET_TYPE_LABELS[campaign.targetType as TargetType] || campaign.targetType}</span>
                          <span className="text-xs text-muted-foreground">&middot;</span>
                          <span className="text-xs text-muted-foreground">{new Date(campaign.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-6 text-sm text-muted-foreground ml-4">
                        <div className="text-center hidden sm:block"><p className="font-semibold text-foreground">{campaign.totalRecipients}</p><p className="text-xs">Recipients</p></div>
                        <div className="text-center hidden md:block"><p className="font-semibold text-foreground">{campaign.deliveredCount}</p><p className="text-xs">Delivered</p></div>
                        <div className="text-center hidden md:block"><p className="font-semibold text-foreground">{campaign.failedCount}</p><p className="text-xs">Failed</p></div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}><Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {campaign.status === "DRAFT" && <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleSendExisting(campaign.id) }}><Send className="mr-2 h-4 w-4" />Send Now</DropdownMenuItem>}
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleDuplicateCampaign(campaign) }}><Copy className="mr-2 h-4 w-4" />Duplicate</DropdownMenuItem>
                            {campaign.status === "DRAFT" && <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleDeleteCampaign(campaign.id) }} className="text-destructive"><Trash2 className="mr-2 h-4 w-4" />Delete</DropdownMenuItem>}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Campaign Details Sheet */}
      <Sheet open={!!selectedCampaign} onOpenChange={(open) => !open && setSelectedCampaign(null)}>
        <SheetContent className="sm:max-w-[540px] overflow-y-auto">
          <SheetHeader className="mb-6"><SheetTitle>Campaign Details</SheetTitle><SheetDescription>Performance metrics for this SMS campaign.</SheetDescription></SheetHeader>
          {selectedCampaign && (
            <div className="flex flex-col gap-6">
              <Card className="bg-muted/50">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <Badge className={STATUS_COLORS[selectedCampaign.status] || STATUS_COLORS.DRAFT}>{selectedCampaign.status}</Badge>
                    <span className="text-xs text-muted-foreground">{new Date(selectedCampaign.createdAt).toLocaleDateString()}</span>
                  </div>
                  <h3 className="font-semibold text-lg">{selectedCampaign.name}</h3>
                  <div className="flex justify-between text-xs text-muted-foreground pt-2 border-t">
                    <span>To: {TARGET_TYPE_LABELS[selectedCampaign.targetType as TargetType] || selectedCampaign.targetType}</span>
                    <span>{selectedCampaign.totalRecipients} Recipients</span>
                  </div>
                </CardContent>
              </Card>
              <div className="flex gap-2">
                {selectedCampaign.status === "DRAFT" && <Button size="sm" onClick={() => handleSendExisting(selectedCampaign.id)}><Send className="mr-2 h-4 w-4" />Send Now</Button>}
                <Button size="sm" variant="outline" onClick={() => handleDuplicateCampaign(selectedCampaign)}><Copy className="mr-2 h-4 w-4" />Duplicate</Button>
                {selectedCampaign.status === "DRAFT" && <Button size="sm" variant="destructive" onClick={() => handleDeleteCampaign(selectedCampaign.id)}><Trash2 className="mr-2 h-4 w-4" />Delete</Button>}
              </div>
              <div className="grid grid-cols-3 gap-4">
                <Card><CardContent className="p-4 flex flex-col items-center text-center"><div className="text-2xl font-bold flex items-center gap-1"><CheckCircle2 className="h-5 w-5 text-green-500" />{selectedCampaign.deliveredCount}</div><div className="text-xs text-muted-foreground">Delivered</div></CardContent></Card>
                <Card><CardContent className="p-4 flex flex-col items-center text-center"><div className="text-2xl font-bold flex items-center gap-1"><Send className="h-5 w-5 text-blue-500" />{selectedCampaign.sentCount}</div><div className="text-xs text-muted-foreground">Sent</div></CardContent></Card>
                <Card><CardContent className="p-4 flex flex-col items-center text-center"><div className="text-2xl font-bold flex items-center gap-1"><AlertTriangle className="h-5 w-5 text-red-500" />{selectedCampaign.failedCount}</div><div className="text-xs text-muted-foreground">Failed</div></CardContent></Card>
              </div>
              {selectedCampaign.body && (
                <div className="flex flex-col gap-2">
                  <h3 className="text-sm font-semibold">Message Body</h3>
                  <div className="rounded-md border border-input bg-muted/30 px-3 py-3 text-sm whitespace-pre-wrap">
                    {renderPlaceholderPills(selectedCampaign.body)}
                  </div>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* ========== Compose Dialog with Stepper ========== */}
      <Dialog open={isComposeOpen} onOpenChange={(open) => { if (!open) setIsComposeOpen(false) }}>
        <DialogContent className="sm:max-w-[900px] max-h-[90vh] flex flex-col overflow-hidden p-0">
          <DialogHeader className="px-6 pt-6 pb-0">
            <DialogTitle>New SMS Campaign</DialogTitle>
            <DialogDescription>Follow the steps to compose and send your text message campaign.</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 px-6 pt-4">
            {/* Step Navigation */}
            <StepperNav>
              {smsStepper.state.all.map((step, index) => {
                const smsCurrentIndex = smsStepper.state.all.findIndex(s => s.id === smsStepper.state.current.data.id)
                const status = getStepStatus(index, smsCurrentIndex)
                return (
                  <React.Fragment key={step.id}>
                    <StepperItem status={status}>
                      <StepperIndicator
                        status={status}
                        step={index + 1}
                        onClick={() => {
                          if (index < smsCurrentIndex) smsStepper.navigation.goTo(step.id)
                        }}
                      />
                      <StepperTitle status={status} className="hidden sm:block">{step.title}</StepperTitle>
                    </StepperItem>
                    {index < smsStepper.state.all.length - 1 && (
                      <StepperSeparator status={status} />
                    )}
                  </React.Fragment>
                )
              })}
            </StepperNav>

            {/* Step 1: Campaign Name & Recipients */}
            {currentStepId === "campaign" && (
              <div className="overflow-y-auto max-h-[calc(90vh-280px)] px-1 space-y-5 py-2">
                <div className="grid gap-2">
                  <Label htmlFor="campaign-name">Campaign Name</Label>
                  <Input id="campaign-name" placeholder="e.g., February Reminder" value={campaignName} onChange={(e) => setCampaignName(e.target.value)} />
                  <p className="text-xs text-muted-foreground">This is for your internal reference only and won&apos;t be visible to recipients.</p>
                </div>

                <div className="grid gap-2">
                  <Label>Classification</Label>
                  <Select value={classification} onValueChange={setClassification}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(CLASSIFICATION_LABELS).map(([key, label]) => (<SelectItem key={key} value={key}>{label}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label>Send To</Label>
                  <Select value={targetType} onValueChange={(v) => setTargetType(v as TargetType)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.entries(TARGET_TYPE_LABELS) as [TargetType, string][]).filter(([key]) => membershipsEnabled || key !== "MEMBERSHIP_HOLDERS").map(([key, label]) => (<SelectItem key={key} value={key}>{label}</SelectItem>))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">{TARGET_TYPE_DESCRIPTIONS[targetType]}</p>

                  {(targetType === "PROGRAM_ANY_INSTANCE" || targetType === "PROGRAM_SPECIFIC_INSTANCE") && (
                    <div className="grid gap-2 mt-2">
                      <Label>Program</Label>
                      <Select value={targetProgramId} onValueChange={setTargetProgramId}>
                        <SelectTrigger><SelectValue placeholder="Select a program" /></SelectTrigger>
                        <SelectContent>{programs.map((p) => (<SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>))}</SelectContent>
                      </Select>
                    </div>
                  )}

                  {targetType === "PROGRAM_SPECIFIC_INSTANCE" && targetProgramId && (
                    <div className="grid gap-2 mt-2">
                      <Label>Instance</Label>
                      <Select value={targetProgramInstanceId} onValueChange={setTargetProgramInstanceId}>
                        <SelectTrigger><SelectValue placeholder="Select an instance" /></SelectTrigger>
                        <SelectContent>{programInstances.map((i) => (<SelectItem key={i.id} value={i.id}>{new Date(i.date).toLocaleDateString()} {i.startTime} - {i.endTime}</SelectItem>))}</SelectContent>
                      </Select>
                    </div>
                  )}

                  {targetType === "MEMBERSHIP_HOLDERS" && (
                    <div className="grid gap-2 mt-2">
                      <Label>Membership Types</Label>
                      <div className="flex flex-wrap gap-2 p-3 border rounded-md min-h-[40px]">
                        {membershipGroups.map((g) => {
                          const isSelected = targetMembershipGroupIds.includes(g.id)
                          return (
                            <button key={g.id} type="button"
                              onClick={() => setTargetMembershipGroupIds((prev) => isSelected ? prev.filter((id) => id !== g.id) : [...prev, g.id])}
                              className={cn("px-3 py-1 rounded-full text-xs font-medium border transition-colors", isSelected ? "bg-primary text-primary-foreground border-primary" : "bg-muted text-muted-foreground border-transparent hover:bg-muted/80")}
                            >{g.name}</button>
                          )
                        })}
                        {membershipGroups.length === 0 && <p className="text-xs text-muted-foreground">No membership types found.</p>}
                      </div>
                    </div>
                  )}

                  {targetType === "SPECIFIC_USERS" && (
                    <div className="grid gap-2 mt-2">
                      <Label>Select Guardians</Label>
                      <Input placeholder="Search guardians..." value={guardianSearch} onChange={(e) => setGuardianSearch(e.target.value)} className="mb-1" />
                      <div className="border rounded-md max-h-[160px] overflow-y-auto">
                        {guardians.map((g) => {
                          const isSelected = targetUserIds.includes(g.id)
                          return (
                            <button key={g.id} type="button"
                              onClick={() => setTargetUserIds((prev) => isSelected ? prev.filter((id) => id !== g.id) : [...prev, g.id])}
                              className={cn("flex items-center justify-between w-full px-3 py-2 text-sm text-left hover:bg-muted/50 transition-colors", isSelected && "bg-primary/5")}
                            >
                              <div><p className="font-medium">{g.name}</p><p className="text-xs text-muted-foreground">{g.email}</p></div>
                              {isSelected && <CheckCircle2 className="h-4 w-4 text-primary" />}
                            </button>
                          )
                        })}
                        {guardians.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">{guardianSearch ? "No guardians match your search." : "Loading guardians..."}</p>}
                      </div>
                      {targetUserIds.length > 0 && <p className="text-xs text-muted-foreground">{targetUserIds.length} {targetUserIds.length === 1 ? "guardian" : "guardians"} selected</p>}
                    </div>
                  )}

                  <div className="flex items-center gap-2 mt-2 p-3 rounded-md bg-muted/50">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    {isLoadingRecipients ? (
                      <span className="text-sm text-muted-foreground">Counting recipients...</span>
                    ) : recipientCount !== null ? (
                      <span className="text-sm"><span className="font-semibold">{recipientCount}</span> <span className="text-muted-foreground">{recipientCount === 1 ? "recipient will receive this text" : "recipients will receive this text"}</span></span>
                    ) : (
                      <span className="text-sm text-muted-foreground">Select targeting to see recipient count</span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Message Body (forceMount to preserve textarea state) */}
            <div className="px-0" style={{ display: currentStepId === "compose" ? undefined : "none" }}>
              <div className="overflow-y-auto max-h-[calc(90vh-280px)] px-1 space-y-5 py-2">
                <div className="grid gap-2">
                  <div className="flex items-center justify-between">
                    <Label>Message Body</Label>
                    <Popover open={placeholderOpen} onOpenChange={setPlaceholderOpen}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className="h-8">
                          <Braces className="mr-1.5 h-3.5 w-3.5" />
                          Insert Placeholder
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent align="end" className="w-[300px] p-3">
                        <div className="space-y-3">
                          <div>
                            <p className="text-sm font-medium mb-1">Insert Placeholder</p>
                            <p className="text-xs text-muted-foreground">Click to insert at cursor position.</p>
                          </div>
                          <Input
                            placeholder="Search..."
                            value={placeholderSearch}
                            onChange={(e) => setPlaceholderSearch(e.target.value)}
                            className="h-8 text-xs"
                          />
                          <div className="max-h-[240px] overflow-y-auto space-y-1">
                            {filteredPlaceholders.map((p) => (
                              <button
                                key={p.key}
                                type="button"
                                onClick={() => insertPlaceholder(p.key)}
                                className="flex items-center justify-between w-full px-2 py-1.5 text-left text-xs rounded-md hover:bg-muted transition-colors"
                              >
                                <div>
                                  <span className="font-medium">{p.label}</span>
                                  <span className="text-muted-foreground ml-2">{p.example}</span>
                                </div>
                              </button>
                            ))}
                            {filteredPlaceholders.length === 0 && (
                              <p className="text-xs text-muted-foreground text-center py-2">No matches.</p>
                            )}
                          </div>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                  <Textarea
                    ref={textareaRef}
                    placeholder="Type your message here... Use placeholders like {{guardianFirstName}} for personalization."
                    value={messageBody}
                    onChange={(e) => setMessageBody(e.target.value)}
                    rows={8}
                    className="resize-none font-mono text-sm"
                    maxLength={1600}
                  />

                  {/* Segment counter */}
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1">
                        <Hash className="h-3 w-3" />
                        {messageBody.length} characters
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageSquare className="h-3 w-3" />
                        {segmentInfo.segments} {segmentInfo.segments === 1 ? "segment" : "segments"} ({segmentInfo.encoding})
                      </span>
                    </div>
                    <span>{segmentInfo.charsRemaining} chars remaining in segment</span>
                  </div>
                </div>

                {/* Quick placeholder chips */}
                <div className="border rounded-md p-3">
                  <Label className="text-sm font-medium mb-2 block">Quick Insert</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {activeQuickPlaceholders.map((key) => {
                      const def = activePlaceholders.find((p) => p.key === key)
                      if (!def) return null
                      return (
                        <TooltipProvider key={key} delayDuration={200}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                onClick={() => insertPlaceholder(key)}
                                className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 hover:border-blue-300 transition-colors cursor-pointer dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800 dark:hover:bg-blue-900"
                              >
                                {def.label}
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom">
                              <p className="text-xs">{def.description}</p>
                              <p className="text-xs text-muted-foreground">e.g. {def.example}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )
                    })}
                  </div>
                </div>

                {/* Opt-out notice */}
                <div className="rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3">
                  <p className="text-xs text-amber-800 dark:text-amber-300">
                    <strong>Note:</strong> Recipients can reply STOP to opt out of future messages. This is required for A2P 10DLC compliance.
                  </p>
                </div>
              </div>
            </div>

            {/* Step 3: Preview */}
            {currentStepId === "preview" && (
              <div className="overflow-y-auto max-h-[calc(90vh-280px)] px-1 py-2">
                <div className="space-y-4">
                  {/* Summary */}
                  <Card className="bg-muted/50">
                    <CardContent className="p-4">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div><span className="text-muted-foreground">Campaign:</span> <span className="font-medium">{campaignName}</span></div>
                        <div><span className="text-muted-foreground">Recipients:</span> <span className="font-medium">{recipientCount ?? "..."}</span></div>
                        <div><span className="text-muted-foreground">Segments/msg:</span> <span className="font-medium">{segmentInfo.segments}</span></div>
                        <div><span className="text-muted-foreground">Audience:</span> <span className="font-medium">{TARGET_TYPE_LABELS[targetType]}</span></div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* SMS Preview */}
                  <Label className="text-sm font-medium">Message Preview</Label>

                  <div className="mx-auto w-[320px]">
                    {/* Phone mockup */}
                    <div className="relative bg-gray-100 dark:bg-gray-900 rounded-[2rem] border-4 border-gray-300 dark:border-gray-700 p-4 pt-8 pb-6">
                      {/* Notch */}
                      <div className="absolute top-2 left-1/2 -translate-x-1/2 w-20 h-1.5 bg-gray-300 dark:bg-gray-600 rounded-full" />

                      {/* Message bubble */}
                      <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm min-h-[120px]">
                        {isLoadingPreview ? (
                          <div className="flex items-center justify-center h-[120px]">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                          </div>
                        ) : (
                          <p className="text-sm whitespace-pre-wrap leading-relaxed">{previewBody || messageBody}</p>
                        )}
                      </div>

                      {/* Cost estimate */}
                      <div className="mt-3 text-center">
                        <p className="text-[10px] text-muted-foreground">
                          {previewSegments || segmentInfo.segments} segment{(previewSegments || segmentInfo.segments) !== 1 ? "s" : ""} &times; {recipientCount ?? 0} recipients = <span className="font-semibold">{(previewSegments || segmentInfo.segments) * (recipientCount ?? 0)} total segments</span>
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 4: Send / Schedule / Draft */}
            {currentStepId === "send" && (
              <div className="overflow-y-auto max-h-[calc(90vh-280px)] px-1 py-2">
                <div className="space-y-6">
                  <p className="text-sm text-muted-foreground">
                    Your campaign &quot;{campaignName}&quot; is ready to go to{" "}
                    <span className="font-medium text-foreground">{recipientCount}</span>{" "}
                    {recipientCount === 1 ? "recipient" : "recipients"}. Choose how you&apos;d like to proceed.
                  </p>

                  {/* Send Now */}
                  <Card className="border-2 hover:border-primary/50 transition-colors cursor-pointer" onClick={() => handleSubmit("send")}>
                    <CardContent className="p-5 flex items-start gap-4">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <Send className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-base">Send Now</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          Immediately send this campaign to all {recipientCount} {recipientCount === 1 ? "recipient" : "recipients"}.
                        </p>
                      </div>
                      {isSending && <Loader2 className="h-5 w-5 animate-spin text-primary mt-1" />}
                    </CardContent>
                  </Card>

                  {/* Schedule */}
                  <Card className="border-2 hover:border-primary/50 transition-colors">
                    <CardContent className="p-5 flex items-start gap-4">
                      <div className="h-10 w-10 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0">
                        <Clock className="h-5 w-5 text-blue-500" />
                      </div>
                      <div className="flex-1 space-y-3">
                        <div>
                          <h3 className="font-semibold text-base">Schedule for Later</h3>
                          <p className="text-sm text-muted-foreground mt-1">Pick a date and time to automatically send this campaign.</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <Input
                            type="datetime-local"
                            value={scheduledAt}
                            onChange={(e) => setScheduledAt(e.target.value)}
                            min={new Date().toISOString().slice(0, 16)}
                            className="max-w-[260px]"
                          />
                          <Button
                            size="sm"
                            disabled={!scheduledAt || isSaving}
                            onClick={() => handleSubmit("schedule")}
                          >
                            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CalendarIcon className="mr-2 h-4 w-4" />}
                            Schedule
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Save as Draft */}
                  <Card className="border-2 hover:border-muted-foreground/30 transition-colors cursor-pointer" onClick={() => handleSubmit("draft")}>
                    <CardContent className="p-5 flex items-start gap-4">
                      <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                        <Save className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-base">Save as Draft</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          Save this campaign to come back and send it later.
                        </p>
                      </div>
                      {isSaving && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mt-1" />}
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}
          </div>

          {/* Footer Navigation */}
          <div className="flex items-center justify-between border-t px-6 py-4 mt-auto">
            <Button
              variant="outline"
              onClick={() => {
                if (smsStepper.state.isFirst) setIsComposeOpen(false)
                else smsStepper.navigation.prev()
              }}
            >
              {smsStepper.state.isFirst ? (
                "Cancel"
              ) : (
                <><ArrowLeft className="mr-2 h-4 w-4" />Back</>
              )}
            </Button>
            {!smsStepper.state.isLast && (
              <Button
                onClick={() => smsStepper.navigation.next()}
                disabled={
                  (currentStepId === "campaign" && !canProceedFromStep1) ||
                  (currentStepId === "compose" && !canProceedFromStep2)
                }
              >
                Next
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
