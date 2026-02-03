"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
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
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  SendIcon, 
  Plus, 
  Calendar as CalendarIcon, 
  Clock, 
  Mail, 
  MailOpen, 
  MousePointerClick,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Eye,
  Users,
  TrendingUp,
} from "lucide-react"
import { RichTextEditor } from "@/components/ui/rich-text-editor"
import { Calendar } from "@/components/ui/calendar"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"

interface EmailCampaign {
  id: string
  name: string
  subject: string
  status: string
  totalRecipients: number
  sentCount: number
  deliveredCount: number
  openedCount: number
  clickedCount: number
  bouncedCount: number
  failedCount: number
  createdAt: string
  startedAt?: string
  completedAt?: string
  targetScope: string
  htmlBody: string
}

interface Program {
  id: string
  name: string
}

interface Event {
  id: string
  name: string
}

interface UsageInfo {
  used: number
  included: number
  remaining: number
  overageRate: number | null
}

const statusColors: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
  SCHEDULED: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  SENDING: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
  COMPLETED: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  FAILED: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
  CANCELLED: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
}

const targetScopeLabels: Record<string, string> = {
  ALL: "All Members",
  PROGRAM: "Program Participants",
  EVENT: "Event Attendees",
  FAMILY: "All Families",
}

export default function EmailPage() {
  // Form state
  const [name, setName] = useState("")
  const [subject, setSubject] = useState("")
  const [content, setContent] = useState("")
  const [targetScope, setTargetScope] = useState<string>("ALL")
  const [targetProgramId, setTargetProgramId] = useState<string>("")
  const [targetEventId, setTargetEventId] = useState<string>("")
  const [targetMembershipStatus, setTargetMembershipStatus] = useState<string>("")
  const [classification, setClassification] = useState<string>("GENERAL")
  
  // Dialog state
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [dialogView, setDialogView] = useState<"compose" | "schedule" | "preview" | "confirm">("compose")
  const [scheduledDate, setScheduledDate] = useState<Date | undefined>(new Date())
  const [scheduledTime, setScheduledTime] = useState("09:00")
  
  // Data state
  const [campaigns, setCampaigns] = useState<EmailCampaign[]>([])
  const [programs, setPrograms] = useState<Program[]>([])
  const [events, setEvents] = useState<Event[]>([])
  const [usage, setUsage] = useState<UsageInfo | null>(null)
  const [selectedCampaign, setSelectedCampaign] = useState<EmailCampaign | null>(null)
  
  // Loading states
  const [isLoading, setIsLoading] = useState(true)
  const [isSending, setIsSending] = useState(false)
  const [isPreviewLoading, setIsPreviewLoading] = useState(false)
  
  // Preview state
  const [previewHtml, setPreviewHtml] = useState("")
  const [recipientCount, setRecipientCount] = useState(0)

  // Fetch campaigns
  const fetchCampaigns = useCallback(async () => {
    try {
      const response = await fetch("/api/email/campaigns")
      if (!response.ok) throw new Error("Failed to fetch campaigns")
      const data = await response.json()
      setCampaigns(data.campaigns || [])
      setUsage(data.usage || null)
    } catch (error) {
      console.error("Error fetching campaigns:", error)
      toast.error("Failed to load email campaigns")
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Fetch programs and events for targeting
  const fetchTargetOptions = useCallback(async () => {
    try {
      const [programsRes, eventsRes] = await Promise.all([
        fetch("/api/programs"),
        fetch("/api/events"),
      ])
      
      if (programsRes.ok) {
        const programsData = await programsRes.json()
        setPrograms(programsData.programs || programsData || [])
      }
      
      if (eventsRes.ok) {
        const eventsData = await eventsRes.json()
        setEvents(eventsData.events || eventsData || [])
      }
    } catch (error) {
      console.error("Error fetching target options:", error)
    }
  }, [])

  useEffect(() => {
    fetchCampaigns()
    fetchTargetOptions()
  }, [fetchCampaigns, fetchTargetOptions])

  // Reset form
  const resetForm = () => {
    setName("")
    setSubject("")
    setContent("")
    setTargetScope("ALL")
    setTargetProgramId("")
    setTargetEventId("")
    setTargetMembershipStatus("")
    setClassification("GENERAL")
    setDialogView("compose")
    setScheduledDate(new Date())
    setScheduledTime("09:00")
    setPreviewHtml("")
    setRecipientCount(0)
  }

  // Handle dialog close
  const handleOpenChange = (open: boolean) => {
    setIsDialogOpen(open)
    if (!open) {
      setTimeout(resetForm, 300)
    }
  }

  // Generate preview
  const handlePreview = async () => {
    if (!subject || !content) {
      toast.error("Please enter a subject and content")
      return
    }

    setIsPreviewLoading(true)
    try {
      const response = await fetch("/api/email/campaigns/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject,
          htmlBody: content,
          targetScope,
          targetProgramId: targetProgramId || undefined,
          targetEventId: targetEventId || undefined,
          targetMembershipStatus: targetMembershipStatus || undefined,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to generate preview")
      }

      const data = await response.json()
      setPreviewHtml(data.html)
      setRecipientCount(data.recipientCount)
      setDialogView("preview")
    } catch (error: any) {
      toast.error(error.message || "Failed to generate preview")
    } finally {
      setIsPreviewLoading(false)
    }
  }

  // Create and send campaign
  const handleSend = async (sendImmediately: boolean) => {
    if (!name || !subject || !content) {
      toast.error("Please fill in all required fields")
      return
    }

    setIsSending(true)
    try {
      // Create campaign
      const createResponse = await fetch("/api/email/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          subject,
          htmlBody: content,
          classification,
          targetScope,
          targetProgramId: targetProgramId || undefined,
          targetEventId: targetEventId || undefined,
          targetMembershipStatus: targetMembershipStatus || undefined,
          scheduledAt: !sendImmediately && scheduledDate 
            ? new Date(
                scheduledDate.getFullYear(),
                scheduledDate.getMonth(),
                scheduledDate.getDate(),
                parseInt(scheduledTime.split(":")[0]),
                parseInt(scheduledTime.split(":")[1])
              ).toISOString()
            : undefined,
          sendImmediately,
        }),
      })

      if (!createResponse.ok) {
        const error = await createResponse.json()
        throw new Error(error.error || "Failed to create campaign")
      }

      const result = await createResponse.json()

      // When sendImmediately: create API already starts sending in background; calling send is idempotent (returns success if already SENDING)
      if (sendImmediately && result.campaignId) {
        const sendResponse = await fetch(`/api/email/campaigns/${result.campaignId}/send`, {
          method: "POST",
        })
        if (!sendResponse.ok) {
          const error = await sendResponse.json()
          throw new Error(error.error || "Failed to send campaign")
        }
      }

      toast.success(
        sendImmediately 
          ? `Campaign sent to ${result.totalRecipients} recipients` 
          : "Campaign scheduled successfully"
      )
      
      setIsDialogOpen(false)
      fetchCampaigns()
    } catch (error: any) {
      toast.error(error.message || "Failed to create campaign")
    } finally {
      setIsSending(false)
    }
  }

  // Save as draft
  const handleSaveDraft = async () => {
    if (!name || !subject) {
      toast.error("Please enter a name and subject")
      return
    }

    setIsSending(true)
    try {
      const response = await fetch("/api/email/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          subject,
          htmlBody: content || "<p></p>",
          classification,
          targetScope,
          targetProgramId: targetProgramId || undefined,
          targetEventId: targetEventId || undefined,
          targetMembershipStatus: targetMembershipStatus || undefined,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to save draft")
      }

      toast.success("Draft saved successfully")
      setIsDialogOpen(false)
      fetchCampaigns()
    } catch (error: any) {
      toast.error(error.message || "Failed to save draft")
    } finally {
      setIsSending(false)
    }
  }

  // Calculate stats
  const totalSent = campaigns.reduce((sum, c) => sum + c.sentCount, 0)
  const totalOpened = campaigns.reduce((sum, c) => sum + c.openedCount, 0)
  const totalClicked = campaigns.reduce((sum, c) => sum + c.clickedCount, 0)
  const avgOpenRate = totalSent > 0 ? ((totalOpened / totalSent) * 100).toFixed(1) : "0"
  const avgClickRate = totalSent > 0 ? ((totalClicked / totalSent) * 100).toFixed(1) : "0"

  return (
    <div className="@container/main flex flex-1 flex-col gap-2">
      <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
        <Tabs defaultValue="campaigns" className="space-y-4">
          <div className="flex items-center justify-between px-4 lg:px-6">
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-bold tracking-tight">Email Communications</h1>
              <TabsList>
                <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
                <TabsTrigger value="analytics">Analytics</TabsTrigger>
              </TabsList>
            </div>
            
            <Dialog open={isDialogOpen} onOpenChange={handleOpenChange}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  New Campaign
                </Button>
              </DialogTrigger>
              <DialogContent className={dialogView === "preview" ? "sm:max-w-[800px]" : "sm:max-w-[600px]"}>
                <DialogHeader>
                  <DialogTitle>
                    {dialogView === "compose" && "New Email Campaign"}
                    {dialogView === "schedule" && "Schedule Campaign"}
                    {dialogView === "preview" && "Preview Email"}
                    {dialogView === "confirm" && "Confirm Send"}
                  </DialogTitle>
                  <DialogDescription>
                    {dialogView === "compose" && "Create an email to send to your members."}
                    {dialogView === "schedule" && "Pick a date and time to send this campaign."}
                    {dialogView === "preview" && `This email will be sent to ${recipientCount} recipients.`}
                    {dialogView === "confirm" && "Are you sure you want to send this email now?"}
                  </DialogDescription>
                </DialogHeader>

                {dialogView === "compose" && (
                  <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
                    <div className="grid gap-2">
                      <Label htmlFor="name">Campaign Name</Label>
                      <Input
                        id="name"
                        placeholder="e.g., January Newsletter"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label>Send To</Label>
                        <Select value={targetScope} onValueChange={setTargetScope}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select audience" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ALL">All Members</SelectItem>
                            <SelectItem value="PROGRAM">Program Participants</SelectItem>
                            <SelectItem value="EVENT">Event Attendees</SelectItem>
                            <SelectItem value="FAMILY">All Families</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="grid gap-2">
                        <Label>Category</Label>
                        <Select value={classification} onValueChange={setClassification}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="GENERAL">General</SelectItem>
                            <SelectItem value="PROGRAM_UPDATE">Program Update</SelectItem>
                            <SelectItem value="EVENT_UPDATE">Event Update</SelectItem>
                            <SelectItem value="MEMBERSHIP">Membership</SelectItem>
                            <SelectItem value="NEWSLETTER">Newsletter</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {targetScope === "PROGRAM" && (
                      <div className="grid gap-2">
                        <Label>Select Program</Label>
                        <Select value={targetProgramId} onValueChange={setTargetProgramId}>
                          <SelectTrigger>
                            <SelectValue placeholder="Choose a program" />
                          </SelectTrigger>
                          <SelectContent>
                            {programs.map((program) => (
                              <SelectItem key={program.id} value={program.id}>
                                {program.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {targetScope === "EVENT" && (
                      <div className="grid gap-2">
                        <Label>Select Event</Label>
                        <Select value={targetEventId} onValueChange={setTargetEventId}>
                          <SelectTrigger>
                            <SelectValue placeholder="Choose an event" />
                          </SelectTrigger>
                          <SelectContent>
                            {events.map((event) => (
                              <SelectItem key={event.id} value={event.id}>
                                {event.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    <div className="grid gap-2">
                      <Label>Membership Status (Optional)</Label>
                      <Select 
                        value={targetMembershipStatus || "ANY"} 
                        onValueChange={(val) => setTargetMembershipStatus(val === "ANY" ? "" : val)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Any membership status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ANY">Any Status</SelectItem>
                          <SelectItem value="ACTIVE">Active Members Only</SelectItem>
                          <SelectItem value="EXPIRED">Expired Members Only</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="subject">Subject Line</Label>
                      <Input
                        id="subject"
                        placeholder="e.g., Important Update: Winter Schedule Changes"
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                      />
                    </div>

                    <div className="grid gap-2">
                      <Label>Email Content</Label>
                      <RichTextEditor
                        value={content}
                        onChange={setContent}
                        placeholder="Write your email content here..."
                      />
                    </div>
                  </div>
                )}

                {dialogView === "schedule" && (
                  <div className="flex flex-col items-center justify-center py-4 space-y-4">
                    <Calendar
                      mode="single"
                      selected={scheduledDate}
                      onSelect={setScheduledDate}
                      disabled={(date) => date < new Date()}
                      className="rounded-md border"
                    />
                    <div className="flex flex-col gap-2 w-full max-w-[280px]">
                      <Label>Time</Label>
                      <div className="relative">
                        <Clock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                        <Input
                          type="time"
                          value={scheduledTime}
                          onChange={(e) => setScheduledTime(e.target.value)}
                          className="pl-9"
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground pt-2">
                      <Clock className="h-4 w-4" />
                      <span>Will be sent at {scheduledTime} on {scheduledDate?.toLocaleDateString()}</span>
                    </div>
                  </div>
                )}

                {dialogView === "preview" && (
                  <div className="py-4">
                    <div className="rounded-md border bg-white dark:bg-gray-950 overflow-hidden max-h-[50vh] overflow-y-auto">
                      <iframe
                        srcDoc={previewHtml}
                        className="w-full h-[400px] border-0"
                        title="Email Preview"
                      />
                    </div>
                    <div className="flex items-center gap-2 mt-4 text-sm text-muted-foreground">
                      <Users className="h-4 w-4" />
                      <span>This email will be sent to <strong>{recipientCount}</strong> recipients</span>
                    </div>
                  </div>
                )}

                {dialogView === "confirm" && (
                  <div className="py-6">
                    <div className="rounded-md bg-muted p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold">Campaign:</span>
                        <span className="text-sm text-muted-foreground">{name}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="font-semibold">Subject:</span>
                        <span className="text-sm text-muted-foreground">{subject}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="font-semibold">Audience:</span>
                        <span className="text-sm text-muted-foreground">{targetScopeLabels[targetScope]}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="font-semibold">Recipients:</span>
                        <span className="text-sm text-muted-foreground">{recipientCount}</span>
                      </div>
                    </div>
                    <p className="mt-4 text-sm text-muted-foreground">
                      This email will be sent immediately. This action cannot be undone.
                    </p>
                  </div>
                )}

                <DialogFooter>
                  {dialogView === "compose" && (
                    <>
                      <Button variant="ghost" onClick={handleSaveDraft} disabled={isSending}>
                        Save Draft
                      </Button>
                      <Button 
                        variant="outline" 
                        disabled={!subject || !content || isPreviewLoading}
                        onClick={handlePreview}
                      >
                        {isPreviewLoading ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Eye className="mr-2 h-4 w-4" />
                        )}
                        Preview
                      </Button>
                    </>
                  )}
                  {dialogView === "preview" && (
                    <>
                      <Button variant="ghost" onClick={() => setDialogView("compose")}>
                        Edit
                      </Button>
                      <Button 
                        variant="outline" 
                        onClick={() => setDialogView("schedule")}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        Schedule
                      </Button>
                      <Button 
                        onClick={() => setDialogView("confirm")}
                        disabled={recipientCount === 0}
                      >
                        <SendIcon className="mr-2 h-4 w-4" />
                        Send Now
                      </Button>
                    </>
                  )}
                  {dialogView === "schedule" && (
                    <>
                      <Button variant="ghost" onClick={() => setDialogView("preview")}>Back</Button>
                      <Button 
                        onClick={() => handleSend(false)}
                        disabled={isSending}
                      >
                        {isSending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Schedule Send
                      </Button>
                    </>
                  )}
                  {dialogView === "confirm" && (
                    <>
                      <Button variant="ghost" onClick={() => setDialogView("preview")}>Back</Button>
                      <Button 
                        onClick={() => handleSend(true)}
                        disabled={isSending}
                      >
                        {isSending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Confirm Send
                      </Button>
                    </>
                  )}
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <TabsContent value="campaigns" className="space-y-4">
            {/* Stats Cards */}
            <div className="grid gap-4 px-4 lg:px-6 sm:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Emails Sent</CardTitle>
                  <Mail className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <>
                      <Skeleton className="h-8 w-16 mb-2" />
                      <Skeleton className="h-3 w-24" />
                    </>
                  ) : (
                    <>
                      <div className="text-2xl font-bold">{usage?.used ?? 0}</div>
                      <p className="text-xs text-muted-foreground">
                        {usage?.included ? `of ${usage.included} included this month` : "this month"}
                      </p>
                    </>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Avg. Open Rate</CardTitle>
                  <MailOpen className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <>
                      <Skeleton className="h-8 w-12 mb-2" />
                      <Skeleton className="h-3 w-20" />
                    </>
                  ) : (
                    <>
                      <div className="text-2xl font-bold">{avgOpenRate}%</div>
                      <p className="text-xs text-muted-foreground">
                        {totalOpened} total opens
                      </p>
                    </>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Avg. Click Rate</CardTitle>
                  <MousePointerClick className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <>
                      <Skeleton className="h-8 w-12 mb-2" />
                      <Skeleton className="h-3 w-24" />
                    </>
                  ) : (
                    <>
                      <div className="text-2xl font-bold">{avgClickRate}%</div>
                      <p className="text-xs text-muted-foreground">
                        {totalClicked} total clicks
                      </p>
                    </>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Campaigns</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <>
                      <Skeleton className="h-8 w-8 mb-2" />
                      <Skeleton className="h-3 w-20" />
                    </>
                  ) : (
                    <>
                      <div className="text-2xl font-bold">{campaigns.length}</div>
                      <p className="text-xs text-muted-foreground">
                        {campaigns.filter(c => c.status === "COMPLETED").length} completed
                      </p>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Campaigns List */}
            <div className="px-4 lg:px-6">
              <Card>
                <CardHeader>
                  <CardTitle>Recent Campaigns</CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                  ) : campaigns.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No email campaigns yet.</p>
                      <p className="text-sm">Create your first campaign to get started.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {campaigns.map((campaign) => (
                        <div
                          key={campaign.id}
                          className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                          onClick={() => setSelectedCampaign(campaign)}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-medium truncate">{campaign.name}</h3>
                              <Badge className={statusColors[campaign.status] || statusColors.DRAFT}>
                                {campaign.status}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground truncate">{campaign.subject}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {targetScopeLabels[campaign.targetScope]} • {new Date(campaign.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="flex items-center gap-6 text-sm text-muted-foreground ml-4">
                            <div className="text-center">
                              <p className="font-semibold text-foreground">{campaign.sentCount}</p>
                              <p className="text-xs">Sent</p>
                            </div>
                            <div className="text-center">
                              <p className="font-semibold text-foreground">
                                {campaign.deliveredCount > 0 
                                  ? ((campaign.openedCount / campaign.deliveredCount) * 100).toFixed(0)
                                  : 0}%
                              </p>
                              <p className="text-xs">Opened</p>
                            </div>
                            <div className="text-center">
                              <p className="font-semibold text-foreground">
                                {campaign.deliveredCount > 0 
                                  ? ((campaign.clickedCount / campaign.deliveredCount) * 100).toFixed(0)
                                  : 0}%
                              </p>
                              <p className="text-xs">Clicked</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="analytics" className="px-4 lg:px-6">
            <Card>
              <CardHeader>
                <CardTitle>Email Analytics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                  <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Detailed analytics coming soon.</p>
                  <p className="text-sm">Track open rates, click rates, and engagement over time.</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Campaign Details Sheet */}
      <Sheet open={!!selectedCampaign} onOpenChange={(open) => !open && setSelectedCampaign(null)}>
        <SheetContent className="sm:max-w-[540px]">
          <SheetHeader className="mb-6">
            <SheetTitle>Campaign Details</SheetTitle>
            <SheetDescription>
              Performance metrics for this email campaign.
            </SheetDescription>
          </SheetHeader>
          
          {selectedCampaign && (
            <div className="flex flex-col gap-6">
              <Card className="bg-muted/50">
                <CardContent className="p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <Badge className={statusColors[selectedCampaign.status] || statusColors.DRAFT}>
                      {selectedCampaign.status}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(selectedCampaign.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <h3 className="font-semibold text-lg">{selectedCampaign.name}</h3>
                  <p className="text-sm text-muted-foreground">{selectedCampaign.subject}</p>
                  <div className="flex justify-between text-xs text-muted-foreground pt-2 border-t">
                    <span>To: {targetScopeLabels[selectedCampaign.targetScope]}</span>
                    <span>{selectedCampaign.totalRecipients} Recipients</span>
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                    <div className="text-2xl font-bold flex items-center gap-1">
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                      {selectedCampaign.deliveredCount}
                    </div>
                    <div className="text-xs text-muted-foreground">Delivered</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                    <div className="text-2xl font-bold flex items-center gap-1">
                      <MailOpen className="h-5 w-5 text-blue-500" />
                      {selectedCampaign.openedCount}
                    </div>
                    <div className="text-xs text-muted-foreground">Opened</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                    <div className="text-2xl font-bold flex items-center gap-1">
                      <MousePointerClick className="h-5 w-5 text-purple-500" />
                      {selectedCampaign.clickedCount}
                    </div>
                    <div className="text-xs text-muted-foreground">Clicked</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                    <div className="text-2xl font-bold flex items-center gap-1">
                      <AlertTriangle className="h-5 w-5 text-red-500" />
                      {selectedCampaign.bouncedCount + selectedCampaign.failedCount}
                    </div>
                    <div className="text-xs text-muted-foreground">Failed/Bounced</div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                    <div className="text-2xl font-bold">
                      {selectedCampaign.deliveredCount > 0 
                        ? ((selectedCampaign.openedCount / selectedCampaign.deliveredCount) * 100).toFixed(1)
                        : 0}%
                    </div>
                    <div className="text-xs text-muted-foreground">Open Rate</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                    <div className="text-2xl font-bold">
                      {selectedCampaign.deliveredCount > 0 
                        ? ((selectedCampaign.clickedCount / selectedCampaign.deliveredCount) * 100).toFixed(1)
                        : 0}%
                    </div>
                    <div className="text-xs text-muted-foreground">Click Rate</div>
                  </CardContent>
                </Card>
              </div>

              {selectedCampaign.htmlBody && (
                <div className="flex flex-col gap-2">
                  <h3 className="text-sm font-semibold">Preview</h3>
                  <div className="rounded-md border bg-white dark:bg-gray-950 overflow-hidden">
                    <iframe
                      srcDoc={selectedCampaign.htmlBody}
                      className="w-full h-[300px] border-0"
                      title="Email Preview"
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
