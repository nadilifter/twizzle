"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
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
import { SendIcon, Plus, Calendar as CalendarIcon, Clock } from "lucide-react"
import { EmailsTable, Email } from "@/components/emails-table"
import { EmailStatsCards } from "@/components/email-stats-cards"
import { EmailChartAreaInteractive } from "@/components/email-chart-area-interactive"
import { EmailSettings } from "@/components/email-settings"
import { Calendar } from "@/components/ui/calendar"
import { cn } from "@/lib/utils"

export default function EmailPage() {
  const [subject, setSubject] = useState("")
  const [content, setContent] = useState("")
  const [audience, setAudience] = useState("all")
  const [status, setStatus] = useState("draft")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null)
  const [dialogView, setDialogView] = useState<"compose" | "schedule" | "confirm">("compose")
  const [scheduledDate, setScheduledDate] = useState<Date | undefined>(new Date())
  const [scheduledTime, setScheduledTime] = useState("09:00")

  // Reset dialog state when closed
  const handleOpenChange = (open: boolean) => {
    setIsDialogOpen(open)
    if (!open) {
      setTimeout(() => {
        setDialogView("compose")
        setScheduledTime("09:00")
      }, 300)
    }
  }

  // Mock data generator for pagination
  const generateEmails = (): Email[] => {
    const statuses = ["Sent", "Scheduled", "Draft"]
    const audiences = ["All Athletes", "Elite Squad", "Parents", "Coaches"]
    
    return Array.from({ length: 45 }).map((_, i) => ({
      id: i + 1,
      subject: i === 0 ? "October Newsletter: Winter Camp & Meet Schedule" : `Weekly Update: Important dates for ${i + 1}`,
      status: statuses[i % statuses.length],
      audience: audiences[i % audiences.length],
      sent: i % 3 === 0 ? 0 : 150 + (i * 5),
      opened: i % 3 === 0 ? 0 : Math.floor((150 + (i * 5)) * 0.45),
      clicked: i % 3 === 0 ? 0 : Math.floor((150 + (i * 5)) * 0.12),
      date: `Oct ${Math.max(1, 30 - (i % 30))}, 2025`,
    }))
  }

  const allEmails = generateEmails()

  return (
    <div className="@container/main flex flex-1 flex-col gap-2">
      <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
        <Tabs defaultValue="campaigns" className="space-y-4">
          <div className="flex items-center justify-between px-4 lg:px-6">
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-bold tracking-tight">Email Marketing</h1>
              <TabsList>
                <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
                <TabsTrigger value="settings">Settings</TabsTrigger>
              </TabsList>
            </div>
            
            <Dialog open={isDialogOpen} onOpenChange={handleOpenChange}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  New Email
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                  <DialogTitle>
                    {dialogView === "compose" && "New Email Campaign"}
                    {dialogView === "schedule" && "Schedule Campaign"}
                    {dialogView === "confirm" && "Confirm Send"}
                  </DialogTitle>
                  <DialogDescription>
                    {dialogView === "compose" && "Create an email to your club members."}
                    {dialogView === "schedule" && "Pick a date and time to send this campaign."}
                    {dialogView === "confirm" && "Are you sure you want to send this email now?"}
                  </DialogDescription>
                </DialogHeader>

                {dialogView === "compose" && (
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <label className="text-sm font-medium">Audience Segment</label>
                      <Select value={audience} onValueChange={setAudience}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select audience" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Active Athletes (142)</SelectItem>
                          <SelectItem value="elite">Elite Squad Only (24)</SelectItem>
                          <SelectItem value="parents">Parents Only (130)</SelectItem>
                          <SelectItem value="coaches">Coaches (8)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid gap-2">
                      <label className="text-sm font-medium">Subject Line</label>
                      <Input
                        placeholder="e.g., Winter Camp Registration Now Open!"
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                      />
                    </div>

                    <div className="grid gap-2">
                      <label className="text-sm font-medium">Content</label>
                      <Textarea
                        placeholder="Write your email content here..."
                        className="min-h-[200px]"
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                      />
                    </div>

                    <div className="flex items-center space-x-2">
                      <Checkbox id="template" />
                      <label
                        htmlFor="template"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        Use standard header/footer template
                      </label>
                    </div>
                  </div>
                )}

                {dialogView === "schedule" && (
                  <div className="flex flex-col items-center justify-center py-4 space-y-4">
                    <Calendar
                      mode="single"
                      selected={scheduledDate}
                      onSelect={setScheduledDate}
                      className="rounded-md border"
                    />
                    <div className="flex flex-col gap-2 w-full max-w-[280px]">
                      <label className="text-sm font-medium">Time</label>
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

                {dialogView === "confirm" && (
                  <div className="py-6">
                    <div className="rounded-md bg-muted p-4">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="font-semibold">Subject:</span>
                        <span className="text-sm text-muted-foreground">{subject}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="font-semibold">Audience:</span>
                        <span className="text-sm text-muted-foreground capitalize">{audience}</span>
                      </div>
                    </div>
                    <p className="mt-4 text-sm text-muted-foreground">
                      This email will be sent immediately to the selected audience segment. This action cannot be undone.
                    </p>
                  </div>
                )}

                <DialogFooter>
                  {dialogView === "compose" ? (
                    <>
                      <Button variant="ghost" onClick={() => setIsDialogOpen(false)}>Save Draft</Button>
                      <Button 
                        variant="outline" 
                        disabled={!subject || !content}
                        onClick={() => setDialogView("schedule")}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        Schedule
                      </Button>
                      <Button 
                        disabled={!subject || !content}
                        onClick={() => setDialogView("confirm")}
                      >
                        <SendIcon className="mr-2 h-4 w-4" />
                        Send Now
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button variant="ghost" onClick={() => setDialogView("compose")}>Back</Button>
                      <Button 
                        onClick={() => {
                          setIsDialogOpen(false)
                          // Here we would handle the actual send/schedule logic
                        }}
                      >
                        {dialogView === "schedule" ? "Schedule Send" : "Confirm Send"}
                      </Button>
                    </>
                  )}
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <TabsContent value="campaigns" className="space-y-4">
            <EmailStatsCards />
            <div className="px-4 lg:px-6">
              <EmailChartAreaInteractive />
            </div>
            <EmailsTable 
              data={allEmails} 
              onEmailClick={setSelectedEmail}
            />
          </TabsContent>

          <TabsContent value="settings" className="px-4 lg:px-6">
             <EmailSettings />
          </TabsContent>
        </Tabs>
      </div>

      <Sheet open={!!selectedEmail} onOpenChange={(open) => !open && setSelectedEmail(null)}>
        <SheetContent className="sm:max-w-[540px]">
          <SheetHeader className="mb-6">
            <SheetTitle>Campaign Details</SheetTitle>
            <SheetDescription>
              Performance metrics for this email campaign.
            </SheetDescription>
          </SheetHeader>
          
          {selectedEmail && (
            <div className="flex flex-col gap-6 h-full">
              <Card className="bg-muted/50">
                <CardContent className="p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <Badge variant={selectedEmail.status === 'Sent' ? 'secondary' : 'outline'}>
                      {selectedEmail.status}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{selectedEmail.date}</span>
                  </div>
                  <h3 className="font-semibold text-lg">{selectedEmail.subject}</h3>
                  <div className="flex justify-between text-xs text-muted-foreground pt-2 border-t">
                    <span>To: {selectedEmail.audience}</span>
                    <span>{selectedEmail.sent} Recipients</span>
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                    <div className="text-2xl font-bold">
                      {selectedEmail.sent > 0 ? ((selectedEmail.opened / selectedEmail.sent) * 100).toFixed(1) : 0}%
                    </div>
                    <div className="text-xs text-muted-foreground">Open Rate</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                    <div className="text-2xl font-bold">
                      {selectedEmail.sent > 0 ? ((selectedEmail.clicked / selectedEmail.sent) * 100).toFixed(1) : 0}%
                    </div>
                    <div className="text-xs text-muted-foreground">Click Rate</div>
                  </CardContent>
                </Card>
              </div>

              <div className="flex flex-col gap-2">
                <h3 className="text-sm font-semibold">Preview</h3>
                <div className="rounded-md border bg-white p-4 text-sm text-muted-foreground min-h-[200px]">
                  <p>Hi [First Name],</p>
                  <br/>
                  <p>This is a preview of the email content for &quot;{selectedEmail.subject}&quot;. In a real implementation, this would show the actual HTML email rendered safely.</p>
                  <br/>
                  <p>Best,</p>
                  <p>The Uplifter Team</p>
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
