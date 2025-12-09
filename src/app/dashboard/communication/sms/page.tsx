"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
import { SendIcon, Plus } from "lucide-react"
import { MessagesTable, Message } from "@/components/messages-table"
import { SmsStatsCards } from "@/components/sms-stats-cards"
import { SmsChartAreaInteractive } from "@/components/sms-chart-area-interactive"

export default function SMSPage() {
  const [message, setMessage] = useState("")
  const [audience, setAudience] = useState("all")
  const [classification, setClassification] = useState("general")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null)

  // Mock data generator for pagination
  const generateMessages = (): Message[] => {
    const classifications = ["Reminder", "Event", "Billing", "Alert", "News"]
    const audiences = ["All Athletes", "Elite Squad", "Outstanding Invoices", "Parents"]
    
    return Array.from({ length: 45 }).map((_, i) => ({
      id: i + 1,
      content: i === 0 ? "Reminder: Winter Training Camp starts tomorrow at 8am!" : `Sample message content for item ${i + 1}...`,
      classification: classifications[i % classifications.length],
      audience: audiences[i % audiences.length],
      sent: 100 + i,
      delivered: 98 + i,
      failed: 2,
      date: `Nov ${Math.max(1, 30 - (i % 30))}, 2025`,
      unreadResponses: i % 5 === 0, // Every 5th message has unread responses
    }))
  }

  const allMessages = generateMessages()

  return (
    <div className="@container/main flex flex-1 flex-col gap-2">
      <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
        <div className="flex items-center justify-between px-4 lg:px-6">
          <h1 className="text-2xl font-bold tracking-tight">SMS Messaging</h1>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                New Message
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>New Campaign</DialogTitle>
                <DialogDescription>
                  Compose a message to send to a segment of your club.
                </DialogDescription>
              </DialogHeader>
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
                      <SelectItem value="event-nov15">Event: Regional Championship (124)</SelectItem>
                      <SelectItem value="outstanding">Accounts with Balance Due (15)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <label className="text-sm font-medium">Classification</label>
                  <Select value={classification} onValueChange={setClassification}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select classification" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="general">General</SelectItem>
                      <SelectItem value="reminder">Reminder</SelectItem>
                      <SelectItem value="alert">Alert</SelectItem>
                      <SelectItem value="billing">Billing</SelectItem>
                      <SelectItem value="event">Event</SelectItem>
                      <SelectItem value="news">News</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <label className="text-sm font-medium">Message</label>
                  <Textarea
                    placeholder="Type your message here... (e.g., Gym is closed due to weather)"
                    className="min-h-[120px]"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{message.length} characters</span>
                    <span>~{Math.ceil(message.length / 160)} segment(s) per recipient</span>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox id="marketing" />
                  <label
                    htmlFor="marketing"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Include opt-out link (&quot;Reply STOP to unsubscribe&quot;)
                  </label>
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                <Button disabled={!message}>
                  <SendIcon className="mr-2 h-4 w-4" />
                  Send Campaign
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <SmsStatsCards />
        <div className="px-4 lg:px-6">
          <SmsChartAreaInteractive />
        </div>
        <MessagesTable 
          data={allMessages} 
          onMessageClick={setSelectedMessage}
        />
      </div>

      <Sheet open={!!selectedMessage} onOpenChange={(open) => !open && setSelectedMessage(null)}>
        <SheetContent className="sm:max-w-[540px]">
          <SheetHeader className="mb-6">
            <SheetTitle>Message Details</SheetTitle>
            <SheetDescription>
              View delivery status and responses for this campaign.
            </SheetDescription>
          </SheetHeader>
          
          {selectedMessage && (
            <div className="flex flex-col gap-6 h-full">
              <Card className="bg-muted/50">
                <CardContent className="p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline">{selectedMessage.classification}</Badge>
                    <span className="text-xs text-muted-foreground">{selectedMessage.date}</span>
                  </div>
                  <p className="text-sm font-medium">{selectedMessage.content}</p>
                  <div className="flex justify-between text-xs text-muted-foreground pt-2 border-t">
                    <span>Sent to: {selectedMessage.audience}</span>
                    <span>{selectedMessage.delivered}/{selectedMessage.sent} Delivered</span>
                  </div>
                </CardContent>
              </Card>

              <div className="flex flex-col gap-4">
                <h3 className="text-sm font-semibold">Responses</h3>
                {selectedMessage.unreadResponses ? (
                  <div className="flex flex-col gap-3">
                    <div className="flex gap-3 items-start p-3 rounded-lg border bg-blue-50/50 border-blue-100">
                      <div className="h-2 w-2 rounded-full bg-blue-500 mt-2 shrink-0" />
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold">Sarah Miller (Parent)</span>
                          <span className="text-xs text-muted-foreground">10:42 AM</span>
                        </div>
                        <p className="text-sm">Thanks for the reminder! Will Sophia need her competition leo?</p>
                        <Button variant="link" className="h-auto p-0 text-xs">Reply</Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center text-sm text-muted-foreground py-8">
                    No responses received yet.
                  </div>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
