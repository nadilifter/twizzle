"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { 
  Mail, 
  MailOpen, 
  MousePointerClick,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  TrendingUp,
} from "lucide-react"
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
  GUARDIAN: "All Guardians",
}

export default function EmailPage() {
  // Data state
  const [campaigns, setCampaigns] = useState<EmailCampaign[]>([])
  const [usage, setUsage] = useState<UsageInfo | null>(null)
  const [selectedCampaign, setSelectedCampaign] = useState<EmailCampaign | null>(null)
  
  // Loading states
  const [isLoading, setIsLoading] = useState(true)

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

  useEffect(() => {
    fetchCampaigns()
  }, [fetchCampaigns])

  // Calculate stats
  const totalSent = campaigns.reduce((sum, c) => sum + c.sentCount, 0)
  const totalOpened = campaigns.reduce((sum, c) => sum + c.openedCount, 0)
  const totalClicked = campaigns.reduce((sum, c) => sum + c.clickedCount, 0)
  const avgOpenRate = totalSent > 0 ? ((totalOpened / totalSent) * 100).toFixed(1) : "0"
  const avgClickRate = totalSent > 0 ? ((totalClicked / totalSent) * 100).toFixed(1) : "0"

  return (
    <div className="@container/main flex flex-1 flex-col gap-2">
      <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
        <div className="flex items-center justify-between px-4 lg:px-6">
          <h1 className="text-2xl font-bold tracking-tight">Email Communications</h1>
        </div>

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
