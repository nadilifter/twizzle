"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, AlertCircle, RefreshCw } from "lucide-react";
import { MessagesTable, Message } from "@/components/messages-table";
import { SmsStatsCards, SmsStatsProps } from "@/components/sms-stats-cards";
import { type SmsChartDataPoint } from "@/components/sms-chart-area-interactive";
import { toast } from "sonner";

const SmsChartAreaInteractive = dynamic(() => import("@/components/sms-chart-area-interactive"), {
  ssr: false,
  loading: () => <Skeleton className="h-[300px] w-full" />,
});

interface SmsMessage {
  id: string;
  to: string;
  from: string;
  body: string;
  segments: number;
  twilioSid: string | null;
  twilioStatus: string;
  direction: string;
  classification: string;
  cost: number | null;
  sentAt: string | null;
  deliveredAt: string | null;
  failedAt: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string;
  } | null;
  campaign: {
    id: string;
    name: string;
  } | null;
}

interface ApiResponse {
  messages: SmsMessage[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  usage: {
    periodStart: string;
    periodEnd: string;
    messagesSent: number;
    messagesDelivered: number;
    messagesFailed: number;
    totalSegments: number;
    totalCost: number;
    includedMessages: number;
    overageMessages: number;
    overageCost: number;
  } | null;
  limits: {
    allowed: boolean;
    remaining: number;
    used: number;
    included: number;
    overageRate: number | null;
  };
  configured: boolean;
}

// Transform API message to table format
function transformToTableMessage(msg: SmsMessage, index: number): Message {
  return {
    id: index + 1,
    content: msg.body,
    classification: msg.classification.charAt(0) + msg.classification.slice(1).toLowerCase(),
    audience: msg.user?.name || msg.campaign?.name || "Individual",
    recipient: msg.to, // Show the actual phone number
    status: msg.twilioStatus, // Show Twilio delivery status
    sent: 1,
    delivered: msg.twilioStatus === "DELIVERED" ? 1 : 0,
    failed: msg.twilioStatus === "FAILED" || msg.twilioStatus === "UNDELIVERED" ? 1 : 0,
    date: new Date(msg.createdAt).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
    unreadResponses: msg.direction === "INBOUND",
  };
}

export default function SMSPage() {
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [apiData, setApiData] = useState<ApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchMessages = useCallback(async (sync: boolean = false) => {
    try {
      setIsLoading(true);
      setError(null);

      // Sync pending message statuses from Twilio first
      if (sync) {
        try {
          const syncRes = await fetch("/api/sms/sync", { method: "POST" });
          const syncData = await syncRes.json();
          console.log("Sync result:", syncData);
          if (syncData.updated > 0) {
            toast.success(`Updated ${syncData.updated} message status(es)`);
          }
        } catch (syncErr) {
          // Don't fail the whole request if sync fails
          console.warn("Failed to sync message statuses:", syncErr);
        }
      }

      const response = await fetch("/api/sms?limit=50");
      if (!response.ok) {
        throw new Error("Failed to fetch messages");
      }
      const data = await response.json();
      setApiData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load messages");
      console.error("Error fetching SMS data:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // Sync statuses on initial page load
    fetchMessages(true);
  }, [fetchMessages]);

  // Build stats for the cards
  const stats: SmsStatsProps | undefined = apiData
    ? {
        messagesSent: apiData.usage?.messagesSent ?? 0,
        messagesDelivered: apiData.usage?.messagesDelivered ?? 0,
        messagesFailed: apiData.usage?.messagesFailed ?? 0,
        deliveryRate:
          apiData.usage && apiData.usage.messagesSent > 0
            ? (apiData.usage.messagesDelivered / apiData.usage.messagesSent) * 100
            : 0,
        totalCost: apiData.usage?.totalCost ?? 0,
        includedMessages: apiData.limits?.included ?? 0,
        overageMessages: apiData.usage?.overageMessages ?? 0,
        overageCost: apiData.usage?.overageCost ?? 0,
        overageRate: apiData.limits?.overageRate ?? null,
        periodEnd: apiData.usage?.periodEnd ? new Date(apiData.usage.periodEnd) : null,
        configured: apiData.configured,
      }
    : undefined;

  // Build chart data by aggregating messages by date
  const chartData: SmsChartDataPoint[] = useMemo(() => {
    if (!apiData?.messages.length) return [];

    const byDate = new Map<string, { sent: number; delivered: number }>();

    for (const msg of apiData.messages) {
      if (msg.direction !== "OUTBOUND") continue;
      const dateKey = new Date(msg.createdAt).toISOString().split("T")[0];
      const entry = byDate.get(dateKey) || { sent: 0, delivered: 0 };
      entry.sent++;
      if (msg.twilioStatus === "DELIVERED") entry.delivered++;
      byDate.set(dateKey, entry);
    }

    return Array.from(byDate.entries())
      .map(([date, counts]) => ({ date, ...counts }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [apiData?.messages]);

  // Transform messages for the table
  const tableMessages: Message[] =
    apiData?.messages.map((msg, idx) => transformToTableMessage(msg, idx)) ?? [];

  return (
    <div className="@container/main flex flex-1 flex-col gap-2">
      <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
        <div className="flex items-center justify-between px-4 lg:px-6">
          <h1 className="text-2xl font-bold tracking-tight">SMS Messaging</h1>
          <Button
            variant="outline"
            size="icon"
            onClick={() => fetchMessages(true)}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
        </div>

        {error && (
          <div className="px-4 lg:px-6">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          </div>
        )}

        <SmsStatsCards stats={stats} />

        <div className="px-4 lg:px-6">
          <SmsChartAreaInteractive data={chartData} />
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : tableMessages.length > 0 ? (
          <MessagesTable data={tableMessages} onMessageClick={setSelectedMessage} />
        ) : (
          <div className="px-4 lg:px-6">
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <p className="text-muted-foreground">No messages sent yet.</p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      <Sheet open={!!selectedMessage} onOpenChange={(open) => !open && setSelectedMessage(null)}>
        <SheetContent className="sm:max-w-[540px]">
          <SheetHeader className="mb-6">
            <SheetTitle>Message Details</SheetTitle>
            <SheetDescription>View delivery status and details for this message.</SheetDescription>
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
                    <span>To: {selectedMessage.recipient || selectedMessage.audience}</span>
                    <span className="capitalize">
                      Status: {selectedMessage.status?.toLowerCase() || "unknown"}
                    </span>
                  </div>
                </CardContent>
              </Card>

              <div className="flex flex-col gap-4">
                <h3 className="text-sm font-semibold">Delivery Status</h3>
                <div className="flex items-center gap-2">
                  {selectedMessage.status === "DELIVERED" ? (
                    <Badge className="bg-green-100 text-green-800">Delivered</Badge>
                  ) : selectedMessage.status === "FAILED" ||
                    selectedMessage.status === "UNDELIVERED" ? (
                    <Badge variant="destructive">Failed</Badge>
                  ) : selectedMessage.status === "SENT" ? (
                    <Badge className="bg-blue-100 text-blue-800">Sent</Badge>
                  ) : selectedMessage.status === "QUEUED" ? (
                    <Badge className="bg-yellow-100 text-yellow-800">Queued</Badge>
                  ) : (
                    <Badge variant="secondary" className="capitalize">
                      {selectedMessage.status?.toLowerCase() || "Unknown"}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {selectedMessage.status === "SENT" || selectedMessage.status === "QUEUED"
                    ? "Message sent to carrier. Delivery confirmation requires webhook access (not available on localhost)."
                    : selectedMessage.status === "DELIVERED"
                      ? "Message was successfully delivered to the recipient."
                      : selectedMessage.status === "FAILED" ||
                          selectedMessage.status === "UNDELIVERED"
                        ? "Message could not be delivered."
                        : ""}
                </p>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
