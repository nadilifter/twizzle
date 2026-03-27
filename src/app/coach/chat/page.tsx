"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
  Search,
  MoreHorizontal,
  Send,
  MessageSquare,
  Phone,
  Archive,
  XCircle,
  CheckCircle2,
  RotateCcw,
  Plus,
  User,
  Loader2,
  AlertTriangle,
  Globe,
  Mail,
  ShieldCheck,
  ShieldAlert,
  Building2,
} from "lucide-react"
import { toast } from "sonner"
import DOMPurify from "dompurify"
import { cn } from "@/lib/utils"

import { Chat } from "@/components/chat/chat"
import {
  ChatHeader,
  ChatHeaderMain,
  ChatHeaderAddon,
  ChatHeaderAvatar,
  ChatHeaderButton,
} from "@/components/chat/chat-header"
import { ChatMessages } from "@/components/chat/chat-messages"
import {
  ChatToolbar,
  ChatToolbarTextarea,
  ChatToolbarAddon,
  ChatToolbarButton,
} from "@/components/chat/chat-toolbar"
import {
  ChatEvent,
  ChatEventTime,
} from "@/components/chat/chat-event"

// ============================================
// Types
// ============================================

type ConversationChannel = "WEB_ONLY" | "WEB_SMS" | "WEB_EMAIL"

interface Conversation {
  id: string
  userId: string
  userName: string
  phoneNumber: string
  email: string | null
  channel: ConversationChannel
  status: "OPEN" | "CLOSED" | "ARCHIVED"
  lastMessageAt: string | null
  lastMessageBody: string | null
  unreadCount: number
  createdAt: string
  organizationId: string
  organizationName: string
}

interface Message {
  id: string
  body: string
  channel: string
  direction: "INBOUND" | "OUTBOUND"
  twilioStatus: string
  createdAt: string
  sentAt: string | null
  deliveredAt: string | null
  failedAt: string | null
  errorMessage: string | null
  emailSubject: string | null
  htmlBody: string | null
}

interface GuardianOption {
  id: string
  name: string
  email: string
  phone: string | null
  phoneVerified: boolean
  organizationId: string
  organizationName: string
}

// ============================================
// Channel helpers
// ============================================

const channelConfig = {
  WEB_ONLY: { label: "Web Only", icon: Globe, color: "text-blue-500" },
  WEB_SMS: { label: "Web & SMS", icon: Phone, color: "text-green-500" },
  WEB_EMAIL: { label: "Web & Email", icon: Mail, color: "text-purple-500" },
} as const

const messageChannelIcon = {
  WEB: Globe,
  SMS: Phone,
  EMAIL: Mail,
} as const

function ChannelBadge({ channel }: { channel: ConversationChannel }) {
  const config = channelConfig[channel]
  const Icon = config.icon
  return (
    <Badge variant="outline" className="text-[10px] gap-1 px-1.5">
      <Icon className={cn("h-3 w-3", config.color)} />
      {config.label}
    </Badge>
  )
}

// ============================================
// Conversation Sidebar
// ============================================

function ConversationSidebar({
  conversations,
  selectedId,
  onSelect,
  searchQuery,
  onSearchChange,
  onNewConversation,
  isLoading,
}: {
  conversations: Conversation[]
  selectedId: string | null
  onSelect: (id: string) => void
  searchQuery: string
  onSearchChange: (query: string) => void
  onNewConversation: () => void
  isLoading: boolean
}) {
  return (
    <div className="flex flex-col h-full border-r">
      <div className="p-3 border-b space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-sm">Conversations</h2>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onNewConversation} title="New conversation">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <div className="relative">
          <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search..."
            className="pl-7 h-8 text-xs"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
      </div>

      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
            <MessageSquare className="h-8 w-8 text-muted-foreground/50 mb-2" />
            <p className="text-xs text-muted-foreground">
              {searchQuery ? "No conversations found." : "No conversations yet."}
            </p>
          </div>
        ) : (
          <div className="divide-y">
            {conversations.map((conv) => {
              const ChanIcon = channelConfig[conv.channel]?.icon || Globe
              const chanColor = channelConfig[conv.channel]?.color || "text-muted-foreground"
              return (
                <button
                  key={conv.id}
                  onClick={() => onSelect(conv.id)}
                  className={cn(
                    "w-full text-left p-3 hover:bg-muted/50 transition-colors",
                    selectedId === conv.id && "bg-muted"
                  )}
                >
                  <div className="flex items-start gap-2">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <User className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <div className="flex items-center gap-1 min-w-0">
                          <span className="text-sm font-medium truncate">{conv.userName}</span>
                          <ChanIcon className={cn("h-3 w-3 shrink-0", chanColor)} />
                        </div>
                        {conv.unreadCount > 0 && (
                          <Badge variant="default" className="h-5 min-w-[20px] px-1.5 text-[10px]">
                            {conv.unreadCount}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1 mt-0.5">
                        <Building2 className="h-3 w-3 text-muted-foreground shrink-0" />
                        <span className="text-[10px] text-muted-foreground truncate">{conv.organizationName}</span>
                      </div>
                      {conv.lastMessageBody && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {conv.lastMessageBody.substring(0, 60)}
                        </p>
                      )}
                      {conv.lastMessageAt && (
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {formatRelativeTime(new Date(conv.lastMessageAt))}
                        </p>
                      )}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  )
}

// ============================================
// Email Message Card
// ============================================

function EmailMessageCard({ htmlBody, subject }: { htmlBody: string; subject: string | null }) {
  const [expanded, setExpanded] = useState(false)

  const sanitizedHtml = DOMPurify.sanitize(htmlBody, { USE_PROFILES: { html: true } })

  return (
    <div className="border rounded-lg overflow-hidden bg-background">
      {subject && (
        <div className="px-3 py-1.5 border-b bg-muted/30 flex items-center gap-1">
          <Mail className="h-3 w-3 text-muted-foreground" />
          <span className="text-xs font-medium truncate">{subject}</span>
        </div>
      )}
      <div
        className={cn("px-3 py-2 text-sm", !expanded && "max-h-[120px] overflow-hidden relative")}
      >
        <div dangerouslySetInnerHTML={{ __html: sanitizedHtml }} className="prose prose-sm max-w-none" />
        {!expanded && (
          <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-background to-transparent" />
        )}
      </div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-center text-xs text-muted-foreground hover:text-foreground py-1 border-t"
      >
        {expanded ? "Show less" : "Show more"}
      </button>
    </div>
  )
}

// ============================================
// Helpers
// ============================================

function formatRelativeTime(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return "just now"
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString()
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase()
}

// ============================================
// Page Component
// ============================================

export default function CoachChatPage() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [isLoadingConversations, setIsLoadingConversations] = useState(true)
  const [conversationSearch, setConversationSearch] = useState("")

  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null)
  const [conversationDetail, setConversationDetail] = useState<any>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)

  const [newMessage, setNewMessage] = useState("")
  const [isSending, setIsSending] = useState(false)

  const [isNewConvOpen, setIsNewConvOpen] = useState(false)
  const [guardianSearch, setGuardianSearch] = useState("")
  const [guardianOptions, setGuardianOptions] = useState<GuardianOption[]>([])
  const [isCreatingConv, setIsCreatingConv] = useState(false)
  const [selectedChannel, setSelectedChannel] = useState<ConversationChannel>("WEB_ONLY")

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const messagesPollRef = useRef<NodeJS.Timeout | null>(null)

  // ============================================
  // Data fetching
  // ============================================

  const fetchConversations = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (conversationSearch) params.set("search", conversationSearch)
      const response = await fetch(`/api/coach/chat/conversations?${params}`)
      if (!response.ok) throw new Error("Failed to fetch")
      const data = await response.json()
      setConversations(data.conversations || [])
    } catch (error) {
      console.error("Error fetching conversations:", error)
    } finally {
      setIsLoadingConversations(false)
    }
  }, [conversationSearch])

  useEffect(() => {
    fetchConversations()
    pollIntervalRef.current = setInterval(fetchConversations, 10000)
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)
    }
  }, [fetchConversations])

  const fetchMessages = useCallback(async (convId: string) => {
    try {
      const response = await fetch(`/api/coach/chat/conversations/${convId}/messages?limit=100`)
      if (!response.ok) throw new Error("Failed to fetch")
      const data = await response.json()
      setMessages(data.messages || [])
    } catch (error) {
      console.error("Error fetching messages:", error)
    }
  }, [])

  const fetchConversationDetail = useCallback(async (convId: string) => {
    try {
      const response = await fetch(`/api/coach/chat/conversations/${convId}`)
      if (!response.ok) throw new Error("Failed to fetch")
      const data = await response.json()
      setConversationDetail(data)
    } catch (error) {
      console.error("Error fetching conversation detail:", error)
    }
  }, [])

  useEffect(() => {
    if (!selectedConversationId) {
      setMessages([])
      setConversationDetail(null)
      return
    }

    setIsLoadingMessages(true)
    Promise.all([
      fetchMessages(selectedConversationId),
      fetchConversationDetail(selectedConversationId),
    ]).finally(() => setIsLoadingMessages(false))

    fetch(`/api/coach/chat/conversations/${selectedConversationId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markRead: true }),
    }).catch((err) => console.error("Failed to mark conversation as read:", err))

    messagesPollRef.current = setInterval(() => {
      fetchMessages(selectedConversationId)
    }, 10000)

    return () => {
      if (messagesPollRef.current) clearInterval(messagesPollRef.current)
    }
  }, [selectedConversationId, fetchMessages, fetchConversationDetail])

  useEffect(() => {
    if (!isNewConvOpen) return
    const params = guardianSearch ? `?search=${encodeURIComponent(guardianSearch)}` : ""
    fetch(`/api/coach/chat/guardians${params}`)
      .then((r) => { if (!r.ok) throw new Error("Failed to fetch"); return r.json() })
      .then((data) =>
        setGuardianOptions(
          (data.data || []).map((u: any) => ({
            id: u.id,
            name: u.name,
            email: u.email || "",
            phone: u.phone || null,
            phoneVerified: u.phoneVerified ?? false,
            organizationId: u.organizationId,
            organizationName: u.organizationName || "",
          }))
        )
      )
      .catch((err) => console.error("Failed to load guardians:", err))
  }, [isNewConvOpen, guardianSearch])

  // ============================================
  // Actions
  // ============================================

  const handleSendMessage = useCallback(async () => {
    if (!newMessage.trim() || !selectedConversationId || isSending) return

    setIsSending(true)
    try {
      const response = await fetch(
        `/api/coach/chat/conversations/${selectedConversationId}/messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body: newMessage }),
        }
      )

      if (response.ok) {
        setNewMessage("")
        await fetchMessages(selectedConversationId)
        fetchConversations()
      } else {
        const data = await response.json()
        toast.error(data.error || "Failed to send message")
      }
    } catch {
      toast.error("Failed to send message")
    } finally {
      setIsSending(false)
    }
  }, [newMessage, selectedConversationId, isSending, fetchMessages, fetchConversations])

  const handleStartConversation = useCallback(async (guardian: GuardianOption) => {
    setIsCreatingConv(true)
    try {
      const response = await fetch("/api/coach/chat/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: guardian.id,
          organizationId: guardian.organizationId,
          channel: selectedChannel,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setIsNewConvOpen(false)
        setSelectedConversationId(data.conversationId)
        fetchConversations()
      } else {
        const data = await response.json()
        toast.error(data.error || "Failed to create conversation")
      }
    } catch {
      toast.error("Failed to create conversation")
    } finally {
      setIsCreatingConv(false)
    }
  }, [fetchConversations, selectedChannel])

  const handleUpdateStatus = useCallback(async (status: "OPEN" | "CLOSED" | "ARCHIVED") => {
    if (!selectedConversationId) return
    try {
      const response = await fetch(`/api/coach/chat/conversations/${selectedConversationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      })
      if (!response.ok) throw new Error("Failed to update")
      fetchConversations()
      fetchConversationDetail(selectedConversationId)
      toast.success(`Conversation ${status.toLowerCase()}`)
    } catch {
      toast.error("Failed to update conversation")
    }
  }, [selectedConversationId, fetchConversations, fetchConversationDetail])

  const selectedConversation = conversations.find((c) => c.id === selectedConversationId)

  const availableChannels: ConversationChannel[] = ["WEB_ONLY", "WEB_SMS", "WEB_EMAIL"]

  function isGuardianSelectable(guardian: GuardianOption): { selectable: boolean; reason?: string } {
    if (selectedChannel === "WEB_SMS") {
      if (!guardian.phone) return { selectable: false, reason: "A phone number is required for SMS conversations" }
      if (!guardian.phoneVerified) return { selectable: false, reason: "Phone number must be verified to use SMS" }
    }
    if (selectedChannel === "WEB_EMAIL") {
      if (!guardian.email) return { selectable: false, reason: "An email address is required for email conversations" }
    }
    return { selectable: true }
  }

  // ============================================
  // Render
  // ============================================

  return (
    <TooltipProvider>
      <div className="flex h-[calc(100vh-3rem)] flex-col p-4 md:p-6">
        <div className="flex-1 overflow-hidden rounded-lg border bg-background shadow">
          <div className="flex h-full">
            {/* Sidebar */}
            <div className="w-[300px] shrink-0">
              <ConversationSidebar
                conversations={conversations}
                selectedId={selectedConversationId}
                onSelect={setSelectedConversationId}
                searchQuery={conversationSearch}
                onSearchChange={setConversationSearch}
                onNewConversation={() => setIsNewConvOpen(true)}
                isLoading={isLoadingConversations}
              />
            </div>

            {/* Main chat area */}
            <div className="flex-1 min-w-0">
              {!selectedConversationId ? (
                <div className="flex flex-col items-center justify-center h-full text-center px-8">
                  <MessageSquare className="h-16 w-16 text-muted-foreground/30 mb-4" />
                  <h2 className="text-lg font-semibold text-muted-foreground">Select a Conversation</h2>
                  <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                    Choose a conversation from the sidebar or start a new one to begin messaging.
                  </p>
                  <Button variant="outline" className="mt-4" onClick={() => setIsNewConvOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    New Conversation
                  </Button>
                </div>
              ) : (
                <Chat className="h-full">
                  {/* Header */}
                  <ChatHeader className="border-b px-4">
                    <ChatHeaderAddon>
                      <ChatHeaderAvatar
                        fallback={selectedConversation ? getInitials(selectedConversation.userName) : "?"}
                      />
                    </ChatHeaderAddon>
                    <ChatHeaderMain>
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">
                            {selectedConversation?.userName || "Loading..."}
                          </span>
                          {selectedConversation && (
                            <ChannelBadge channel={selectedConversation.channel} />
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <Building2 className="h-3 w-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">
                            {selectedConversation?.organizationName}
                          </span>
                        </div>
                      </div>
                      {conversationDetail?.user?.smsOptOut && selectedConversation?.channel === "WEB_SMS" && (
                        <Badge variant="destructive" className="ml-2 text-[10px]">Opted Out</Badge>
                      )}
                      {selectedConversation?.status === "CLOSED" && (
                        <Badge variant="secondary" className="ml-2 text-[10px]">Closed</Badge>
                      )}
                      {selectedConversation?.status === "ARCHIVED" && (
                        <Badge variant="secondary" className="ml-2 text-[10px]">Archived</Badge>
                      )}
                    </ChatHeaderMain>
                    <ChatHeaderAddon>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <ChatHeaderButton>
                            <MoreHorizontal className="h-4 w-4" />
                          </ChatHeaderButton>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {selectedConversation?.status === "OPEN" && (
                            <DropdownMenuItem onClick={() => handleUpdateStatus("CLOSED")}>
                              <XCircle className="mr-2 h-4 w-4" /> Close Conversation
                            </DropdownMenuItem>
                          )}
                          {selectedConversation?.status === "CLOSED" && (
                            <DropdownMenuItem onClick={() => handleUpdateStatus("OPEN")}>
                              <RotateCcw className="mr-2 h-4 w-4" /> Reopen
                            </DropdownMenuItem>
                          )}
                          {selectedConversation?.status !== "ARCHIVED" && (
                            <DropdownMenuItem onClick={() => handleUpdateStatus("ARCHIVED")}>
                              <Archive className="mr-2 h-4 w-4" /> Archive
                            </DropdownMenuItem>
                          )}
                          {selectedConversation?.status === "ARCHIVED" && (
                            <DropdownMenuItem onClick={() => handleUpdateStatus("OPEN")}>
                              <RotateCcw className="mr-2 h-4 w-4" /> Unarchive
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </ChatHeaderAddon>
                  </ChatHeader>

                  {/* Messages */}
                  <ChatMessages>
                    {isLoadingMessages ? (
                      <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : messages.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12 text-center">
                        <MessageSquare className="h-10 w-10 text-muted-foreground/30 mb-2" />
                        <p className="text-sm text-muted-foreground">No messages yet. Send a message to start the conversation.</p>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-1">
                        {messages.map((msg, idx) => {
                          const isOutbound = msg.direction === "OUTBOUND"
                          const showDateSep = idx === 0 || new Date(msg.createdAt).toDateString() !== new Date(messages[idx - 1].createdAt).toDateString()
                          const MsgChanIcon = messageChannelIcon[msg.channel as keyof typeof messageChannelIcon] || Globe

                          return (
                            <div key={msg.id}>
                              {showDateSep && (
                                <ChatEvent className="items-center gap-1 my-3">
                                  <Separator className="flex-1" />
                                  <ChatEventTime
                                    timestamp={new Date(msg.createdAt)}
                                    format="longDate"
                                    className="font-semibold min-w-max text-[10px]"
                                  />
                                  <Separator className="flex-1" />
                                </ChatEvent>
                              )}
                              {isOutbound ? (
                                <div className="flex justify-end px-3 py-0.5">
                                  <div className="max-w-[75%]">
                                    {msg.htmlBody ? (
                                      <EmailMessageCard htmlBody={msg.htmlBody} subject={msg.emailSubject} />
                                    ) : (
                                      <div className="bg-primary text-primary-foreground rounded-2xl rounded-br-sm px-3 py-2">
                                        <p className="text-sm whitespace-pre-wrap">{msg.body}</p>
                                      </div>
                                    )}
                                    <div className="flex items-center justify-end gap-1 mt-0.5">
                                      <MsgChanIcon className="h-3 w-3 text-muted-foreground" />
                                      <ChatEventTime
                                        timestamp={new Date(msg.createdAt)}
                                        format="time"
                                        className="text-[10px]"
                                      />
                                      {msg.twilioStatus === "DELIVERED" && (
                                        <CheckCircle2 className="h-3 w-3 text-green-500" />
                                      )}
                                      {msg.twilioStatus === "FAILED" && (
                                        <span title={msg.errorMessage || "Failed"}><AlertTriangle className="h-3 w-3 text-destructive" /></span>
                                      )}
                                      {(msg.twilioStatus === "QUEUED" || msg.twilioStatus === "SENDING" || msg.twilioStatus === "SENT") && (
                                        <CheckCircle2 className="h-3 w-3 text-muted-foreground" />
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex justify-start px-3 py-0.5">
                                  <div className="max-w-[75%]">
                                    {msg.htmlBody ? (
                                      <EmailMessageCard htmlBody={msg.htmlBody} subject={msg.emailSubject} />
                                    ) : (
                                      <div className="bg-muted rounded-2xl rounded-bl-sm px-3 py-2">
                                        <p className="text-sm whitespace-pre-wrap">{msg.body}</p>
                                      </div>
                                    )}
                                    <div className="flex items-center gap-1 mt-0.5">
                                      <MsgChanIcon className="h-3 w-3 text-muted-foreground" />
                                      <ChatEventTime
                                        timestamp={new Date(msg.createdAt)}
                                        format="time"
                                        className="text-[10px]"
                                      />
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </ChatMessages>

                  {/* Toolbar */}
                  {conversationDetail?.user?.smsOptOut && selectedConversation?.channel === "WEB_SMS" ? (
                    <div className="sticky bottom-0 p-3 bg-background border-t">
                      <div className="flex items-center justify-center gap-2 py-2 text-sm text-muted-foreground">
                        <AlertTriangle className="h-4 w-4" />
                        This recipient has opted out of SMS messages.
                      </div>
                    </div>
                  ) : (
                    <ChatToolbar>
                      <ChatToolbarTextarea
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onSubmit={handleSendMessage}
                        placeholder="Type a message..."
                        disabled={isSending}
                      />
                      <ChatToolbarAddon align="inline-end">
                        <ChatToolbarButton
                          onClick={handleSendMessage}
                          disabled={!newMessage.trim() || isSending}
                          className={cn(
                            newMessage.trim() && "text-primary hover:text-primary"
                          )}
                        >
                          {isSending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Send className="h-4 w-4" />
                          )}
                        </ChatToolbarButton>
                      </ChatToolbarAddon>
                    </ChatToolbar>
                  )}
                </Chat>
              )}
            </div>
          </div>
        </div>

        {/* New Conversation Dialog */}
        <Dialog open={isNewConvOpen} onOpenChange={setIsNewConvOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>New Conversation</DialogTitle>
              <DialogDescription>Choose a channel and select a guardian to start a conversation.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {/* Channel selector */}
              <div>
                <label className="text-sm font-medium mb-2 block">Channel</label>
                <div className="flex gap-2">
                  {availableChannels.map((ch) => {
                    const config = channelConfig[ch]
                    const Icon = config.icon
                    return (
                      <button
                        key={ch}
                        onClick={() => setSelectedChannel(ch)}
                        className={cn(
                          "flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md border text-sm transition-colors",
                          selectedChannel === ch
                            ? "border-primary bg-primary/5 text-primary font-medium"
                            : "border-border hover:bg-muted/50 text-muted-foreground"
                        )}
                      >
                        <Icon className="h-4 w-4" />
                        {config.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Guardian search */}
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search guardians by name..."
                  className="pl-8"
                  value={guardianSearch}
                  onChange={(e) => setGuardianSearch(e.target.value)}
                  autoFocus
                />
              </div>

              {/* Guardian list */}
              <div className="border rounded-md max-h-[300px] overflow-y-auto">
                {guardianOptions.length === 0 ? (
                  <div className="text-center py-8 text-sm text-muted-foreground">
                    {guardianSearch ? "No guardians found." : "Type to search for guardians..."}
                  </div>
                ) : (
                  <div className="divide-y">
                    {guardianOptions.map((guardian) => {
                      const { selectable, reason } = isGuardianSelectable(guardian)

                      const content = (
                        <button
                          key={guardian.id}
                          onClick={() => selectable && handleStartConversation(guardian)}
                          disabled={isCreatingConv || !selectable}
                          className={cn(
                            "w-full text-left px-4 py-3 transition-colors flex items-center gap-3",
                            selectable
                              ? "hover:bg-muted/50"
                              : "opacity-60 cursor-not-allowed"
                          )}
                        >
                          <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <User className="h-4 w-4 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">{guardian.name}</p>
                            <div className="flex items-center gap-1">
                              <Building2 className="h-3 w-3 text-muted-foreground" />
                              <p className="text-xs text-muted-foreground">{guardian.organizationName}</p>
                            </div>
                          </div>
                          <div className="shrink-0">
                            {selectedChannel === "WEB_SMS" && (
                              <div className="flex items-center gap-1 text-xs">
                                {guardian.phone ? (
                                  <>
                                    {guardian.phoneVerified ? (
                                      <ShieldCheck className="h-3.5 w-3.5 text-green-500" />
                                    ) : (
                                      <ShieldAlert className="h-3.5 w-3.5 text-amber-500" />
                                    )}
                                    <span className={cn(
                                      "text-muted-foreground",
                                      !guardian.phoneVerified && "text-amber-600"
                                    )}>
                                      {guardian.phone}
                                      {!guardian.phoneVerified && " (unverified)"}
                                    </span>
                                  </>
                                ) : (
                                  <span className="text-muted-foreground italic">No phone number</span>
                                )}
                              </div>
                            )}
                            {selectedChannel === "WEB_EMAIL" && (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Mail className="h-3 w-3" />
                                {guardian.email || <span className="italic">No email</span>}
                              </div>
                            )}
                          </div>
                        </button>
                      )

                      if (!selectable && reason) {
                        return (
                          <Tooltip key={guardian.id}>
                            <TooltipTrigger asChild>{content}</TooltipTrigger>
                            <TooltipContent side="left"><p>{reason}</p></TooltipContent>
                          </Tooltip>
                        )
                      }

                      return content
                    })}
                  </div>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  )
}
