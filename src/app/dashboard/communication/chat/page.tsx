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
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

// shadcn-chat components
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
  ChatEventAddon,
  ChatEventBody,
  ChatEventContent,
  ChatEventTime,
  ChatEventAvatar,
  ChatEventTitle,
} from "@/components/chat/chat-event"

// ============================================
// Types
// ============================================

interface Conversation {
  id: string
  familyId: string
  familyName: string
  primaryContact: string
  phoneNumber: string
  status: "OPEN" | "CLOSED" | "ARCHIVED"
  lastMessageAt: string | null
  lastMessageBody: string | null
  unreadCount: number
  createdAt: string
}

interface Message {
  id: string
  body: string
  direction: "INBOUND" | "OUTBOUND"
  twilioStatus: string
  createdAt: string
  sentAt: string | null
  deliveredAt: string | null
  failedAt: string | null
  errorMessage: string | null
}

interface FamilyOption {
  id: string
  name: string
  primaryContact: string
  phone: string
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
      {/* Sidebar header */}
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

      {/* Conversation list */}
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
            {conversations.map((conv) => (
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
                      <span className="text-sm font-medium truncate">{conv.primaryContact}</span>
                      {conv.unreadCount > 0 && (
                        <Badge variant="default" className="h-5 min-w-[20px] px-1.5 text-[10px]">
                          {conv.unreadCount}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{conv.familyName}</p>
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
            ))}
          </div>
        )}
      </ScrollArea>
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

export default function SmsConversationsPage() {
  // Conversation list state
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [isLoadingConversations, setIsLoadingConversations] = useState(true)
  const [conversationSearch, setConversationSearch] = useState("")
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null)

  // Active conversation state
  const [conversationDetail, setConversationDetail] = useState<any>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)

  // Compose state
  const [newMessage, setNewMessage] = useState("")
  const [isSending, setIsSending] = useState(false)

  // New conversation dialog
  const [isNewConvOpen, setIsNewConvOpen] = useState(false)
  const [familySearch, setFamilySearch] = useState("")
  const [familyOptions, setFamilyOptions] = useState<FamilyOption[]>([])
  const [isCreatingConv, setIsCreatingConv] = useState(false)

  // Polling ref
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const messagesPollRef = useRef<NodeJS.Timeout | null>(null)

  // ============================================
  // Data fetching
  // ============================================

  const fetchConversations = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (conversationSearch) params.set("search", conversationSearch)
      const response = await fetch(`/api/sms/conversations?${params}`)
      if (!response.ok) throw new Error("Failed to fetch")
      const data = await response.json()
      setConversations(data.conversations || [])
    } catch (error) {
      console.error("Error fetching conversations:", error)
    } finally {
      setIsLoadingConversations(false)
    }
  }, [conversationSearch])

  // Initial load + polling for conversation list
  useEffect(() => {
    fetchConversations()
    pollIntervalRef.current = setInterval(fetchConversations, 10000)
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)
    }
  }, [fetchConversations])

  const fetchMessages = useCallback(async (convId: string) => {
    try {
      const response = await fetch(`/api/sms/conversations/${convId}/messages?limit=100`)
      if (!response.ok) throw new Error("Failed to fetch")
      const data = await response.json()
      setMessages(data.messages || [])
    } catch (error) {
      console.error("Error fetching messages:", error)
    }
  }, [])

  const fetchConversationDetail = useCallback(async (convId: string) => {
    try {
      const response = await fetch(`/api/sms/conversations/${convId}`)
      if (!response.ok) throw new Error("Failed to fetch")
      const data = await response.json()
      setConversationDetail(data)
    } catch (error) {
      console.error("Error fetching conversation detail:", error)
    }
  }, [])

  // Load messages when conversation is selected
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

    // Mark as read
    fetch(`/api/sms/conversations/${selectedConversationId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markRead: true }),
    }).catch(() => {})

    // Poll for new messages
    messagesPollRef.current = setInterval(() => {
      fetchMessages(selectedConversationId)
    }, 10000)

    return () => {
      if (messagesPollRef.current) clearInterval(messagesPollRef.current)
    }
  }, [selectedConversationId, fetchMessages, fetchConversationDetail])

  // Fetch families for new conversation dialog
  useEffect(() => {
    if (!isNewConvOpen) return
    const params = familySearch ? `?search=${encodeURIComponent(familySearch)}` : ""
    fetch(`/api/families${params}`)
      .then((r) => r.json())
      .then((data) =>
        setFamilyOptions(
          (data.data || data.families || [])
            .filter((f: any) => f.phone)
            .map((f: any) => ({
              id: f.id,
              name: f.name,
              primaryContact: f.primaryContact,
              phone: f.phone,
            }))
        )
      )
      .catch(() => {})
  }, [isNewConvOpen, familySearch])

  // ============================================
  // Actions
  // ============================================

  const handleSendMessage = useCallback(async () => {
    if (!newMessage.trim() || !selectedConversationId || isSending) return

    setIsSending(true)
    try {
      const response = await fetch(
        `/api/sms/conversations/${selectedConversationId}/messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body: newMessage }),
        }
      )

      if (response.ok) {
        setNewMessage("")
        // Refresh messages immediately
        await fetchMessages(selectedConversationId)
        // Refresh conversation list to update last message
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

  const handleStartConversation = useCallback(async (familyId: string) => {
    setIsCreatingConv(true)
    try {
      const response = await fetch("/api/sms/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ familyId }),
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
  }, [fetchConversations])

  const handleUpdateStatus = useCallback(async (status: "OPEN" | "CLOSED" | "ARCHIVED") => {
    if (!selectedConversationId) return
    try {
      await fetch(`/api/sms/conversations/${selectedConversationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      })
      fetchConversations()
      fetchConversationDetail(selectedConversationId)
      toast.success(`Conversation ${status.toLowerCase()}`)
    } catch {
      toast.error("Failed to update conversation")
    }
  }, [selectedConversationId, fetchConversations, fetchConversationDetail])

  // Find selected conversation from list
  const selectedConversation = conversations.find((c) => c.id === selectedConversationId)

  // ============================================
  // Render
  // ============================================

  return (
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
              // Empty state
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
                      fallback={selectedConversation ? getInitials(selectedConversation.primaryContact) : "?"}
                    />
                  </ChatHeaderAddon>
                  <ChatHeaderMain>
                    <div className="flex flex-col">
                      <span className="font-medium text-sm">
                        {selectedConversation?.primaryContact || "Loading..."}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {selectedConversation?.familyName}
                        {selectedConversation?.phoneNumber && ` · ${selectedConversation.phoneNumber}`}
                      </span>
                    </div>
                    {conversationDetail?.family?.smsOptOut && (
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
                              // Outbound message (right-aligned bubble)
                              <div className="flex justify-end px-3 py-0.5">
                                <div className="max-w-[75%]">
                                  <div className="bg-primary text-primary-foreground rounded-2xl rounded-br-sm px-3 py-2">
                                    <p className="text-sm whitespace-pre-wrap">{msg.body}</p>
                                  </div>
                                  <div className="flex items-center justify-end gap-1 mt-0.5">
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
                              // Inbound message (left-aligned bubble)
                              <div className="flex justify-start px-3 py-0.5">
                                <div className="max-w-[75%]">
                                  <div className="bg-muted rounded-2xl rounded-bl-sm px-3 py-2">
                                    <p className="text-sm whitespace-pre-wrap">{msg.body}</p>
                                  </div>
                                  <div className="flex items-center gap-1 mt-0.5">
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
                {conversationDetail?.family?.smsOptOut ? (
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
            <DialogDescription>Search for a family to start a text conversation.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search families by name..."
                className="pl-8"
                value={familySearch}
                onChange={(e) => setFamilySearch(e.target.value)}
                autoFocus
              />
            </div>
            <div className="border rounded-md max-h-[300px] overflow-y-auto">
              {familyOptions.length === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  {familySearch ? "No families found." : "Type to search for families..."}
                </div>
              ) : (
                <div className="divide-y">
                  {familyOptions.map((family) => (
                    <button
                      key={family.id}
                      onClick={() => handleStartConversation(family.id)}
                      disabled={isCreatingConv}
                      className="w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors flex items-center gap-3"
                    >
                      <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <User className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{family.name}</p>
                        <p className="text-xs text-muted-foreground">{family.primaryContact}</p>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                        <Phone className="h-3 w-3" />
                        {family.phone}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
