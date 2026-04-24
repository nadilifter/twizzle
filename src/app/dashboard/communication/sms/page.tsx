"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useFeatures } from "@/components/feature-context";
import { Card, CardContent } from "@/components/ui/card";
import { DashboardPageHeader } from "@/components/dashboard-page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
} from "lucide-react";
import { toast } from "sonner";
import {
  CampaignWizard,
  type CampaignWizardHandle,
  SMS_PLACEHOLDER_LABEL_MAP,
} from "@/components/campaign-wizard";
import { TARGET_TYPE_LABELS, type TargetType } from "@/components/campaign-wizard/constants";

interface SmsCampaign {
  id: string;
  name: string;
  body: string;
  status: string;
  targetType: string;
  totalRecipients: number;
  sentCount: number;
  deliveredCount: number;
  failedCount: number;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  classification: string;
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
  SCHEDULED: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  SENDING: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
  COMPLETED: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  FAILED: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
  CANCELLED: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
};

function renderPlaceholderPills(text: string) {
  if (!text) return null;
  const parts = text.split(/(\{\{\w+\}\})/g);
  return parts.map((part, i) => {
    const match = part.match(/^\{\{(\w+)\}\}$/);
    if (match) {
      const label = SMS_PLACEHOLDER_LABEL_MAP[match[1]] || match[1];
      return (
        <span
          key={i}
          className="inline-flex items-center px-1.5 py-0 rounded-full bg-blue-50 text-blue-700 text-xs font-medium border border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800 mx-0.5 whitespace-nowrap"
        >
          {label}
        </span>
      );
    }
    return part ? <span key={i}>{part}</span> : null;
  });
}

export default function SmsCampaignsPage() {
  const { isFeatureEnabled } = useFeatures();
  const membershipsEnabled = isFeatureEnabled("memberships");
  const campaignWizardRef = useRef<CampaignWizardHandle>(null);

  const [campaigns, setCampaigns] = useState<SmsCampaign[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedCampaign, setSelectedCampaign] = useState<SmsCampaign | null>(null);
  const [isComposeOpen, setIsComposeOpen] = useState(false);

  const fetchCampaigns = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.set("search", searchQuery);
      if (statusFilter !== "all") params.set("status", statusFilter);
      const response = await fetch(`/api/sms/campaigns?${params}`);
      if (!response.ok) throw new Error("Failed to fetch campaigns");
      const data = await response.json();
      setCampaigns(data.campaigns || []);
    } catch (error) {
      console.error("Error fetching campaigns:", error);
      toast.error("Failed to load SMS campaigns");
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, statusFilter]);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  const handleOpenCompose = useCallback(() => {
    campaignWizardRef.current?.openNew();
  }, []);

  const handleDeleteCampaign = useCallback(
    async (id: string) => {
      try {
        const response = await fetch(`/api/sms/campaigns/${id}`, { method: "DELETE" });
        if (response.ok) {
          toast.success("Campaign deleted");
          setSelectedCampaign(null);
          fetchCampaigns();
        } else toast.error("Failed to delete campaign");
      } catch {
        toast.error("Failed to delete campaign");
      }
    },
    [fetchCampaigns]
  );

  const handleDuplicateCampaign = useCallback((campaign: SmsCampaign) => {
    campaignWizardRef.current?.openDuplicateSms({
      name: campaign.name,
      body: campaign.body,
      classification: campaign.classification,
    });
    setSelectedCampaign(null);
  }, []);

  const handleSendExisting = useCallback(
    async (id: string) => {
      try {
        const response = await fetch(`/api/sms/campaigns/${id}/send`, { method: "POST" });
        if (response.ok) {
          toast.success("Campaign is being sent");
          setSelectedCampaign(null);
          fetchCampaigns();
        } else {
          const data = await response.json();
          toast.error(data.error || "Failed to send campaign");
        }
      } catch {
        toast.error("Failed to send campaign");
      }
    },
    [fetchCampaigns]
  );

  const filteredCampaigns = useMemo(() => {
    return campaigns.filter((c) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!c.name.toLowerCase().includes(q) && !c.body.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [campaigns, searchQuery]);

  return (
    <div className="flex flex-col gap-6 p-6">
      <DashboardPageHeader
        variant="small"
        title="SMS Campaigns"
        description="Create and send personalized text message campaigns to your community."
        actions={
          <Button onClick={handleOpenCompose}>
            <Plus className="mr-2 h-4 w-4" />
            New Campaign
          </Button>
        }
      />

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search campaigns..."
            className="pl-8"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
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

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-5 w-48" />
                    <Skeleton className="h-4 w-64" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                  <div className="flex gap-6">
                    <Skeleton className="h-8 w-12" />
                    <Skeleton className="h-8 w-12" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredCampaigns.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="font-medium">
                {searchQuery || statusFilter !== "all"
                  ? "No campaigns match your filters."
                  : "No SMS campaigns yet."}
              </p>
              <p className="text-sm mt-1">
                {!searchQuery &&
                  statusFilter === "all" &&
                  "Create your first campaign to get started."}
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {filteredCampaigns.map((campaign) => (
                <div
                  key={campaign.id}
                  className="flex items-center justify-between p-4 hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => setSelectedCampaign(campaign)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium truncate">{campaign.name}</h3>
                      <Badge className={STATUS_COLORS[campaign.status] || STATUS_COLORS.DRAFT}>
                        {campaign.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                      {campaign.body.substring(0, 80)}
                      {campaign.body.length > 80 ? "..." : ""}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-muted-foreground">
                        {TARGET_TYPE_LABELS[campaign.targetType as TargetType] ||
                          campaign.targetType}
                      </span>
                      <span className="text-xs text-muted-foreground">&middot;</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(campaign.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-6 text-sm text-muted-foreground ml-4">
                    <div className="text-center hidden sm:block">
                      <p className="font-semibold text-foreground">{campaign.totalRecipients}</p>
                      <p className="text-xs">Recipients</p>
                    </div>
                    <div className="text-center hidden md:block">
                      <p className="font-semibold text-foreground">{campaign.deliveredCount}</p>
                      <p className="text-xs">Delivered</p>
                    </div>
                    <div className="text-center hidden md:block">
                      <p className="font-semibold text-foreground">{campaign.failedCount}</p>
                      <p className="text-xs">Failed</p>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {campaign.status === "DRAFT" && (
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSendExisting(campaign.id);
                            }}
                          >
                            <Send className="mr-2 h-4 w-4" />
                            Send Now
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDuplicateCampaign(campaign);
                          }}
                        >
                          <Copy className="mr-2 h-4 w-4" />
                          Duplicate
                        </DropdownMenuItem>
                        {campaign.status === "DRAFT" && (
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteCampaign(campaign.id);
                            }}
                            className="text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Sheet open={!!selectedCampaign} onOpenChange={(o) => !o && setSelectedCampaign(null)}>
        <SheetContent className="sm:max-w-[540px] overflow-y-auto">
          <SheetHeader className="mb-6">
            <SheetTitle>Campaign Details</SheetTitle>
            <SheetDescription>Performance metrics for this SMS campaign.</SheetDescription>
          </SheetHeader>
          {selectedCampaign && (
            <div className="flex flex-col gap-6">
              <Card className="bg-muted/50">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <Badge
                      className={STATUS_COLORS[selectedCampaign.status] || STATUS_COLORS.DRAFT}
                    >
                      {selectedCampaign.status}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(selectedCampaign.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <h3 className="font-semibold text-lg">{selectedCampaign.name}</h3>
                  <div className="flex justify-between text-xs text-muted-foreground pt-2 border-t">
                    <span>
                      To:{" "}
                      {TARGET_TYPE_LABELS[selectedCampaign.targetType as TargetType] ||
                        selectedCampaign.targetType}
                    </span>
                    <span>{selectedCampaign.totalRecipients} Recipients</span>
                  </div>
                </CardContent>
              </Card>
              <div className="flex gap-2">
                {selectedCampaign.status === "DRAFT" && (
                  <Button size="sm" onClick={() => handleSendExisting(selectedCampaign.id)}>
                    <Send className="mr-2 h-4 w-4" />
                    Send Now
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleDuplicateCampaign(selectedCampaign)}
                >
                  <Copy className="mr-2 h-4 w-4" />
                  Duplicate
                </Button>
                {selectedCampaign.status === "DRAFT" && (
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleDeleteCampaign(selectedCampaign.id)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-3 gap-4">
                <Card>
                  <CardContent className="p-4 flex flex-col items-center text-center">
                    <div className="text-2xl font-bold flex items-center gap-1">
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                      {selectedCampaign.deliveredCount}
                    </div>
                    <div className="text-xs text-muted-foreground">Delivered</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 flex flex-col items-center text-center">
                    <div className="text-2xl font-bold flex items-center gap-1">
                      <Send className="h-5 w-5 text-blue-500" />
                      {selectedCampaign.sentCount}
                    </div>
                    <div className="text-xs text-muted-foreground">Sent</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 flex flex-col items-center text-center">
                    <div className="text-2xl font-bold flex items-center gap-1">
                      <AlertTriangle className="h-5 w-5 text-red-500" />
                      {selectedCampaign.failedCount}
                    </div>
                    <div className="text-xs text-muted-foreground">Failed</div>
                  </CardContent>
                </Card>
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

      <CampaignWizard
        ref={campaignWizardRef}
        channel="sms"
        open={isComposeOpen}
        onOpenChange={setIsComposeOpen}
        membershipsEnabled={membershipsEnabled}
        onSuccess={fetchCampaigns}
      />
    </div>
  );
}
