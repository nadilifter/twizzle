"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Search,
  Send,
  MessageSquare,
  CheckCircle2,
  Building2,
  Loader2,
  AlertTriangle,
  Phone,
  ArrowRight,
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import Link from "next/link"

import { Chat } from "@/components/chat/chat"
import {
  ChatHeader,
  ChatHeaderMain,
  ChatHeaderAddon,
  ChatHeaderAvatar,
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

interface Conversation {
  id: string
  organizationId: string
  organizationName: string
  organizationLogo: string | null
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

interface UserPhoneStatus {
  phone: string | null
  phoneVerified: boolean
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
  isLoading,
}: {
  conversations: Conversation[]
  selectedId: string | null
  onSelect: (id: string) => void
  searchQuery: string
  onSearchChange: (query: string) => void
  isLoading: boolean
}) {
  return (
    <div className="flex flex-col h-full border-r">
      <div className="p-3 border-b space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-sm">Conversations</h2>
        </div>
        <div className="relative">
          <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search organizations..."
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
                    <Building2 className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-sm font-medium truncate">{conv.organizationName}</span>
                      {conv.unreadCount > 0 && (
                        <Badge variant="default" className="h-5 min-w-[20px] px-1.5 text-[10px]">
                          {conv.unreadCount}
                        </Badge>
                      )}
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

export default function AthleteChatPage() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [isLoadingConversations, setIsLoadingConversations] = useState(true)
  const [conversationSearch, setConversationSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null)

  const [messages, setMessages] = useState<Message[]>([])
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)

  const [newMessage, setNewMessage] = useState("")
  const [isSending, setIsSending] = useState(false)

  const [phoneStatus, setPhoneStatus] = useState<UserPhoneStatus | null>(null)
  const [isLoadingPhone, setIsLoadingPhone] = useState(true)

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const messagesPollRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    async function fetchPhoneStatus() {
      try {
        const res = await fetch("/api/user/profile")
        if (res.ok) {
          const data = await res.json()
          setPhoneStatus({
            phone: data.phone,
            phoneVerified: data.phoneVerified,
          })
        }
      } catch (error) {
        console.error("Error fetching phone status:", error)
      } finally {
        setIsLoadingPhone(false)
      }
    }
    fetchPhoneStatus()
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(conversationSearch), 300)
    return () => clearTimeout(timer)
  }, [conversationSearch])

  // ============================================
  // Data fetching
  // ============================================

  const fetchConversations = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (debouncedSearch) params.set("search", debouncedSearch)
      const response = await fetch(`/api/athletes/chat/conversations?${params}`)
      if (!response.ok) throw new Error("Failed to fetch")
      const data = await response.json()
      setConversations(data.conversations || [])
    } catch (error) {
      console.error("Error fetching conversations:", error)
    } finally {
      setIsLoadingConversations(false)
    }
  }, [debouncedSearch])

  useEffect(() => {
    fetchConversations()

    const startPoll = () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)
      pollIntervalRef.current = setInterval(fetchConversations, 10000)
    }
    const stopPoll = () => {
      if (pollIntervalRef.current) { clearInterval(pollIntervalRef.current); pollIntervalRef.current = null }
    }

    startPoll()

    const onVisibility = () => {
      if (document.hidden) { stopPoll() } else { fetchConversations(); startPoll() }
    }
    document.addEventListener("visibilitychange", onVisibility)

    return () => {
      stopPoll()
      document.removeEventListener("visibilitychange", onVisibility)
    }
  }, [fetchConversations])

  const fetchMessages = useCallback(async (convId: string) => {
    try {
      const response = await fetch(`/api/athletes/chat/conversations/${convId}/messages?limit=100`)
      if (!response.ok) throw new Error("Failed to fetch")
      const data = await response.json()
      setMessages(data.messages || [])
    } catch (error) {
      console.error("Error fetching messages:", error)
    }
  }, [])

  useEffect(() => {
    if (!selectedConversationId) {
      setMessages([])
      return
    }

    setIsLoadingMessages(true)
    fetchMessages(selectedConversationId).finally(() => setIsLoadingMessages(false))

    fetch(`/api/athletes/chat/conversations/${selectedConversationId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markRead: true }),
    }).catch((err) => console.error("Failed to mark conversation as read:", err))

    const startPoll = () => {
      if (messagesPollRef.current) clearInterval(messagesPollRef.current)
      messagesPollRef.current = setInterval(() => fetchMessages(selectedConversationId), 10000)
    }
    const stopPoll = () => {
      if (messagesPollRef.current) { clearInterval(messagesPollRef.current); messagesPollRef.current = null }
    }

    startPoll()

    const onVisibility = () => {
      if (document.hidden) { stopPoll() } else { fetchMessages(selectedConversationId); startPoll() }
    }
    document.addEventListener("visibilitychange", onVisibility)

    return () => {
      stopPoll()
      document.removeEventListener("visibilitychange", onVisibility)
    }
  }, [selectedConversationId, fetchMessages])

  // ============================================
  // Actions
  // ============================================

  const handleSendMessage = useCallback(async () => {
    if (!newMessage.trim() || !selectedConversationId || isSending) return

    setIsSending(true)
    try {
      const response = await fetch(
        `/api/athletes/chat/conversations/${selectedConversationId}/messages`,
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

  const selectedConversation = conversations.find((c) => c.id === selectedConversationId)

  // ============================================
  // Phone prompt check
  // ============================================

  const needsPhone = phoneStatus && (!phoneStatus.phone || !phoneStatus.phoneVerified)

  if (isLoadingPhone) {
    return (
      <div className="flex h-[calc(100vh-3rem)] items-center justify-center p-4 md:p-6">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (needsPhone) {
    return (
      <div className="flex h-[calc(100vh-3rem)] items-center justify-center p-4 md:p-6">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
              <Phone className="h-7 w-7 text-primary" />
            </div>
            <CardTitle>Phone Number Required</CardTitle>
            <CardDescription>
              {!phoneStatus?.phone
                ? "To use SMS messaging, you need to add and verify a phone number on your account."
                : "Your phone number is not yet verified. Please verify it to use SMS messaging."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Button asChild>
              <Link href="/athletes/account">
                {!phoneStatus?.phone ? "Add Phone Number" : "Verify Phone Number"}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

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
                  Choose a conversation from the sidebar to view messages.
                  Organizations you communicate with will appear here.
                </p>
              </div>
            ) : (
              <Chat className="h-full">
                {/* Header */}
                <ChatHeader className="border-b px-4">
                  <ChatHeaderAddon>
                    <ChatHeaderAvatar
                      fallback={selectedConversation ? getInitials(selectedConversation.organizationName) : "?"}
                    />
                  </ChatHeaderAddon>
                  <ChatHeaderMain>
                    <div className="flex flex-col">
                      <span className="font-medium text-sm">
                        {selectedConversation?.organizationName || "Loading..."}
                      </span>
                    </div>
                  </ChatHeaderMain>
                </ChatHeader>

                {/* Messages — direction is flipped relative to admin view */}
                <ChatMessages>
                  {isLoadingMessages ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <MessageSquare className="h-10 w-10 text-muted-foreground/30 mb-2" />
                      <p className="text-sm text-muted-foreground">No messages yet.</p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-1">
                      {messages.map((msg, idx) => {
                        const isFromMe = msg.direction === "INBOUND"
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
                            {isFromMe ? (
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
                                  </div>
                                </div>
                              </div>
                            ) : (
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
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </ChatMessages>

                {/* Toolbar */}
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
              </Chat>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
