"use client";

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  forwardRef,
  useImperativeHandle,
} from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  defineStepper,
  StepperNav,
  StepperItem,
  StepperIndicator,
  StepperSeparator,
  StepperTitle,
  getStepStatus,
} from "@/components/ui/stepper";
import {
  Send,
  Save,
  ArrowRight,
  ArrowLeft,
  Eye,
  Clock,
  Loader2,
  Users,
  CheckCircle2,
  Monitor,
  Smartphone,
  Calendar as CalendarIcon,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatTime12h } from "@/lib/date-utils";
import {
  TARGET_TYPE_LABELS,
  TARGET_TYPE_DESCRIPTIONS,
  type TargetType,
  type ProgramOption,
  type ProgramInstanceOption,
  type MembershipGroupOption,
  type GuardianOption,
} from "./constants";
import { EmailComposeStep, type EmailComposeStepHandle } from "./EmailComposeStep";
import { SmsComposeStep, type SmsComposeStepHandle } from "./SmsComposeStep";
import { calculateSegmentsClient } from "./sms-segments";

const { useStepper: useCampaignStepper } = defineStepper(
  { id: "campaign", title: "Campaign" },
  { id: "content", title: "Content" },
  { id: "preview", title: "Preview" },
  { id: "send", title: "Send" }
);

export type CampaignChannel = "email" | "sms";

const EMAIL_CLASSIFICATION_LABELS: Record<string, string> = {
  GENERAL: "General",
  PROGRAM_UPDATE: "Program Update",
  EVENT_UPDATE: "Event Update",
  MEMBERSHIP: "Membership",
  BILLING: "Billing",
  NEWSLETTER: "Newsletter",
};

const SMS_CLASSIFICATION_LABELS: Record<string, string> = {
  GENERAL: "General",
  REMINDER: "Reminder",
  ALERT: "Alert",
  BILLING: "Billing",
  EVENT: "Event",
  NEWS: "News",
};

export type CampaignWizardHandle = {
  openNew: () => void;
  openDuplicateEmail: (campaign: {
    name: string;
    subject: string;
    htmlBody: string;
    classification: string;
  }) => void;
  openDuplicateSms: (campaign: { name: string; body: string; classification: string }) => void;
};

type Props = {
  channel: CampaignChannel;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  membershipsEnabled: boolean;
  onSuccess?: () => void;
};

export const CampaignWizard = forwardRef<CampaignWizardHandle, Props>(function CampaignWizard(
  { channel, open, onOpenChange, membershipsEnabled, onSuccess },
  ref
) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const apiBase = channel === "email" ? "/api/email" : "/api/sms";
  const stepper = useCampaignStepper();
  const emailComposeRef = useRef<EmailComposeStepHandle>(null);
  const smsComposeRef = useRef<SmsComposeStepHandle>(null);
  const didConsumeComposeQuery = useRef(false);

  const [campaignName, setCampaignName] = useState("");
  const [subject, setSubject] = useState("");
  const [messageBody, setMessageBody] = useState("");
  const [classification, setClassification] = useState("GENERAL");
  const [targetType, setTargetType] = useState<TargetType>("ALL_MEMBERS");
  const [targetProgramId, setTargetProgramId] = useState("");
  const [targetProgramInstanceId, setTargetProgramInstanceId] = useState("");
  const [targetMembershipGroupIds, setTargetMembershipGroupIds] = useState<string[]>([]);
  const [targetUserIds, setTargetUserIds] = useState<string[]>([]);
  const [scheduledAt, setScheduledAt] = useState("");

  const [programs, setPrograms] = useState<ProgramOption[]>([]);
  const [programInstances, setProgramInstances] = useState<ProgramInstanceOption[]>([]);
  const [membershipGroups, setMembershipGroups] = useState<MembershipGroupOption[]>([]);
  const [guardians, setGuardians] = useState<GuardianOption[]>([]);
  const [guardianSearch, setGuardianSearch] = useState("");
  const [isLoadingGuardians, setIsLoadingGuardians] = useState(false);

  const [recipientCount, setRecipientCount] = useState<number | null>(null);
  const [isLoadingRecipients, setIsLoadingRecipients] = useState(false);

  const [previewHtml, setPreviewHtml] = useState("");
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  const [previewBody, setPreviewBody] = useState("");
  const [previewSegments, setPreviewSegments] = useState(0);

  const [composeStepValid, setComposeStepValid] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const classificationLabels =
    channel === "email" ? EMAIL_CLASSIFICATION_LABELS : SMS_CLASSIFICATION_LABELS;

  const currentStepId = stepper.state.current.data.id;

  const segmentInfo = useMemo(() => calculateSegmentsClient(messageBody), [messageBody]);

  const mobilePreviewHtml = useMemo(() => {
    if (!previewHtml || previewDevice !== "mobile") return previewHtml;
    const mobileStyles = `<style type="text/css">
      table { max-width: 100% !important; width: 100% !important; }
      td { word-break: break-word !important; }
      .email-container { width: 100% !important; max-width: 100% !important; }
      .email-content { padding: 24px 16px !important; }
      img { max-width: 100% !important; height: auto !important; }
    </style>`;
    return previewHtml.replace("</head>", `${mobileStyles}\n</head>`);
  }, [previewHtml, previewDevice]);

  const displayRecipientCount = useMemo(() => {
    if (targetType === "SPECIFIC_USERS") return targetUserIds.length;
    return recipientCount;
  }, [targetType, targetUserIds.length, recipientCount]);

  const resetWizardState = useCallback(() => {
    setCampaignName("");
    setSubject("");
    setMessageBody("");
    setClassification("GENERAL");
    setTargetType("ALL_MEMBERS");
    setTargetProgramId("");
    setTargetProgramInstanceId("");
    setTargetMembershipGroupIds([]);
    setTargetUserIds([]);
    setScheduledAt("");
    setRecipientCount(null);
    setPreviewHtml("");
    setPreviewBody("");
    setPreviewSegments(0);
    setComposeStepValid(false);
    stepper.navigation.goTo("campaign");
    emailComposeRef.current?.reset();
    smsComposeRef.current?.reset();
  }, [stepper.navigation]);

  useImperativeHandle(ref, () => ({
    openNew: () => {
      resetWizardState();
      onOpenChange(true);
    },
    openDuplicateEmail: (campaign) => {
      resetWizardState();
      setCampaignName(`${campaign.name} (Copy)`);
      setSubject(campaign.subject);
      setClassification(campaign.classification);
      setTimeout(() => {
        emailComposeRef.current?.applyDuplicate(campaign.subject, campaign.htmlBody);
      }, 0);
      stepper.navigation.goTo("campaign");
      onOpenChange(true);
    },
    openDuplicateSms: (campaign) => {
      resetWizardState();
      setCampaignName(`${campaign.name} (Copy)`);
      setMessageBody(campaign.body);
      setClassification(campaign.classification);
      setComposeStepValid(campaign.body.trim().length > 0);
      setTimeout(() => {
        smsComposeRef.current?.applyDraft(campaign.body);
      }, 0);
      stepper.navigation.goTo("campaign");
      onOpenChange(true);
    },
  }));

  useEffect(() => {
    fetch("/api/programs")
      .then((r) => r.json())
      .then((data) =>
        setPrograms(
          (data.data || data.programs || []).map((p: { id: string; name: string }) => ({
            id: p.id,
            name: p.name,
          }))
        )
      )
      .catch((err) => console.error("Failed to load programs:", err));
  }, []);

  useEffect(() => {
    if (!membershipsEnabled) return;
    fetch("/api/memberships")
      .then((r) => r.json())
      .then((data) =>
        setMembershipGroups(
          (data.data || data.groups || []).map((g: { id: string; name: string }) => ({
            id: g.id,
            name: g.name,
          }))
        )
      )
      .catch((err) => console.error("Failed to load membership groups:", err));
  }, [membershipsEnabled]);

  useEffect(() => {
    if (!targetProgramId) {
      setProgramInstances([]);
      return;
    }
    fetch(`/api/programs/${targetProgramId}/instances`)
      .then((r) => r.json())
      .then((data) => setProgramInstances(data.data || data.instances || []))
      .catch((err) => console.error("Failed to load program instances:", err));
  }, [targetProgramId]);

  useEffect(() => {
    if (targetType !== "SPECIFIC_USERS") return;
    setIsLoadingGuardians(true);
    const params = guardianSearch ? `?search=${encodeURIComponent(guardianSearch)}` : "";
    fetch(`/api/guardians${params}`)
      .then((r) => r.json())
      .then((data) =>
        setGuardians(
          (data.data || data.guardians || []).map(
            (g: { id: string; name: string; email: string }) => ({
              id: g.id,
              name: g.name,
              email: g.email,
            })
          )
        )
      )
      .catch((err) => console.error("Failed to load guardians:", err))
      .finally(() => setIsLoadingGuardians(false));
  }, [targetType, guardianSearch]);

  useEffect(() => {
    if (!open) return;
    if (targetType === "SPECIFIC_USERS") return;
    const fetchRecipients = async () => {
      setIsLoadingRecipients(true);
      try {
        const body: Record<string, unknown> = { targetType };
        if (targetProgramId) body.targetProgramId = targetProgramId;
        if (targetProgramInstanceId) body.targetProgramInstanceId = targetProgramInstanceId;
        if (targetMembershipGroupIds.length > 0)
          body.targetMembershipGroupIds = targetMembershipGroupIds;
        if (targetUserIds.length > 0) body.targetUserIds = targetUserIds;
        const response = await fetch(`${apiBase}/campaigns/recipients`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (response.ok) {
          const data = await response.json();
          setRecipientCount(data.count);
        }
      } catch {
        setRecipientCount(null);
      } finally {
        setIsLoadingRecipients(false);
      }
    };
    const timeout = setTimeout(fetchRecipients, 300);
    return () => clearTimeout(timeout);
  }, [
    open,
    targetType,
    targetProgramId,
    targetProgramInstanceId,
    targetMembershipGroupIds,
    targetUserIds,
    apiBase,
  ]);

  const fetchEmailPreview = useCallback(async () => {
    if (!subject || !emailComposeRef.current) return;
    const serialized = emailComposeRef.current.getSerializedHtml();
    if (!serialized.trim() || serialized === "<p></p>") return;
    setIsLoadingPreview(true);
    try {
      const response = await fetch("/api/email/campaigns/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject,
          htmlBody: serialized,
          targetType,
          targetProgramId: targetProgramId || undefined,
          targetProgramInstanceId: targetProgramInstanceId || undefined,
          targetMembershipGroupIds:
            targetMembershipGroupIds.length > 0 ? targetMembershipGroupIds : undefined,
          targetUserIds: targetUserIds.length > 0 ? targetUserIds : undefined,
        }),
      });
      if (response.ok) {
        const data = await response.json();
        setPreviewHtml(data.html);
      }
    } catch {
      // ignore
    } finally {
      setIsLoadingPreview(false);
    }
  }, [
    subject,
    targetType,
    targetProgramId,
    targetProgramInstanceId,
    targetMembershipGroupIds,
    targetUserIds,
  ]);

  const fetchSmsPreview = useCallback(async () => {
    if (!messageBody.trim()) return;
    setIsLoadingPreview(true);
    try {
      const response = await fetch("/api/sms/campaigns/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          body: messageBody,
          targetType,
          targetProgramId: targetProgramId || undefined,
          targetProgramInstanceId: targetProgramInstanceId || undefined,
          targetMembershipGroupIds:
            targetMembershipGroupIds.length > 0 ? targetMembershipGroupIds : undefined,
          targetUserIds: targetUserIds.length > 0 ? targetUserIds : undefined,
        }),
      });
      if (response.ok) {
        const data = await response.json();
        setPreviewBody(data.previewBody);
        setPreviewSegments(data.segments);
      }
    } catch {
      // ignore
    } finally {
      setIsLoadingPreview(false);
    }
  }, [
    messageBody,
    targetType,
    targetProgramId,
    targetProgramInstanceId,
    targetMembershipGroupIds,
    targetUserIds,
  ]);

  useEffect(() => {
    if (currentStepId !== "preview") return;
    if (channel === "email") {
      void fetchEmailPreview();
    } else {
      void fetchSmsPreview();
    }
  }, [currentStepId, channel, fetchEmailPreview, fetchSmsPreview]);

  useEffect(() => {
    if (channel !== "email") return;
    if (didConsumeComposeQuery.current) return;
    if (searchParams.get("compose") !== "1") return;
    didConsumeComposeQuery.current = true;

    const qTargetType = searchParams.get("targetType") as TargetType | null;
    const qProgramId = searchParams.get("programId");
    const qInstanceId = searchParams.get("instanceId");

    if (qTargetType) setTargetType(qTargetType);
    if (qProgramId) setTargetProgramId(qProgramId);
    if (qInstanceId) setTargetProgramInstanceId(qInstanceId);

    stepper.navigation.goTo("campaign");
    onOpenChange(true);

    router.replace("/dashboard/communication/email", { scroll: false });
  }, [channel, searchParams, router, stepper.navigation, onOpenChange]);

  const canProceedFromStep1 =
    !!campaignName.trim() &&
    (targetType === "SPECIFIC_USERS"
      ? targetUserIds.length > 0
      : recipientCount !== null && recipientCount > 0);

  const handleSubmit = async (mode: "send" | "schedule" | "draft") => {
    if (isSending || isSaving) return;

    let url: string;
    let channelPayload: Record<string, unknown>;

    if (channel === "email") {
      if (!campaignName || !subject.trim()) {
        toast.error("Campaign name and subject are required");
        return;
      }
      const content = emailComposeRef.current?.getSerializedHtml() ?? "";
      if (mode !== "draft" && (!content || content === "<p></p>")) {
        toast.error("Email body is required");
        return;
      }
      url = "/api/email/campaigns";
      channelPayload = { name: campaignName, subject, htmlBody: content };
    } else {
      if (!campaignName) {
        toast.error("Campaign name is required");
        return;
      }
      if (mode !== "draft" && !messageBody.trim()) {
        toast.error("Message body is required");
        return;
      }
      url = "/api/sms/campaigns";
      channelPayload = { name: campaignName, body: messageBody };
    }

    if (mode === "schedule" && !scheduledAt) {
      toast.error("Please select a date and time to schedule");
      return;
    }

    const setter = mode === "draft" ? setIsSaving : setIsSending;
    setter(true);
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...channelPayload,
          classification,
          targetType,
          targetProgramId: targetProgramId || undefined,
          targetProgramInstanceId: targetProgramInstanceId || undefined,
          targetMembershipGroupIds:
            targetMembershipGroupIds.length > 0 ? targetMembershipGroupIds : undefined,
          targetUserIds: targetUserIds.length > 0 ? targetUserIds : undefined,
          sendImmediately: mode === "send",
          scheduledAt: mode === "schedule" ? new Date(scheduledAt).toISOString() : undefined,
        }),
      });
      if (response.ok) {
        const data = await response.json();
        const msg =
          mode === "send"
            ? `Campaign sent to ${data.totalRecipients} recipients`
            : mode === "schedule"
              ? "Campaign scheduled successfully"
              : "Campaign saved as draft";
        toast.success(msg);
        onOpenChange(false);
        resetWizardState();
        onSuccess?.();
      } else {
        const data = await response.json();
        toast.error(data.error || "Failed to save campaign");
      }
    } catch {
      toast.error("Failed to save campaign");
    } finally {
      setter(false);
    }
  };

  const dialogTitle = channel === "email" ? "New Email Campaign" : "New SMS Campaign";
  const dialogDescription =
    channel === "email"
      ? "Follow the steps to compose and send your campaign."
      : "Follow the steps to compose and send your text message campaign.";
  const campaignNamePlaceholder =
    channel === "email" ? "e.g., February Newsletter" : "e.g., February Reminder";
  const recipientNoun = channel === "email" ? "email" : "text";

  const stepperTitleFor = (stepId: string, defaultTitle: string) => {
    if (stepId === "content" && channel === "sms") return "Compose";
    return defaultTitle;
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onOpenChange(false);
      }}
    >
      <DialogContent className="sm:max-w-[900px] max-h-[90vh] flex flex-col overflow-hidden p-0">
        <DialogHeader className="px-6 pt-6 pb-0">
          <DialogTitle>{dialogTitle}</DialogTitle>
          <DialogDescription>{dialogDescription}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 px-6 pt-4">
          <StepperNav>
            {stepper.state.all.map((step, index) => {
              const currentIndex = stepper.state.all.findIndex(
                (s) => s.id === stepper.state.current.data.id
              );
              const status = getStepStatus(index, currentIndex);
              return (
                <React.Fragment key={step.id}>
                  <StepperItem status={status}>
                    <StepperIndicator
                      status={status}
                      step={index + 1}
                      onClick={() => {
                        if (index < currentIndex) stepper.navigation.goTo(step.id);
                      }}
                    />
                    <StepperTitle status={status} className="hidden sm:block">
                      {stepperTitleFor(step.id, step.title)}
                    </StepperTitle>
                  </StepperItem>
                  {index < stepper.state.all.length - 1 && <StepperSeparator status={status} />}
                </React.Fragment>
              );
            })}
          </StepperNav>

          {currentStepId === "campaign" && (
            <div className="overflow-y-auto max-h-[calc(90vh-280px)] px-1 space-y-5 py-2">
              <div className="grid gap-2">
                <Label htmlFor="campaign-wizard-name">Campaign Name</Label>
                <Input
                  id="campaign-wizard-name"
                  placeholder={campaignNamePlaceholder}
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  This is for your internal reference only and won&apos;t be visible to recipients.
                </p>
              </div>

              <div className="grid gap-2">
                <Label>Classification</Label>
                <Select value={classification} onValueChange={setClassification}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {channel === "email"
                      ? Object.entries(classificationLabels)
                          .filter(([key]) => membershipsEnabled || key !== "MEMBERSHIP")
                          .map(([key, label]) => (
                            <SelectItem key={key} value={key}>
                              {label}
                            </SelectItem>
                          ))
                      : Object.entries(classificationLabels).map(([key, label]) => (
                          <SelectItem key={key} value={key}>
                            {label}
                          </SelectItem>
                        ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label>Send To</Label>
                <Select value={targetType} onValueChange={(v) => setTargetType(v as TargetType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.entries(TARGET_TYPE_LABELS) as [TargetType, string][])
                      .filter(([key]) => membershipsEnabled || key !== "MEMBERSHIP_HOLDERS")
                      .map(([key, label]) => (
                        <SelectItem key={key} value={key}>
                          {label}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {TARGET_TYPE_DESCRIPTIONS[targetType]}
                </p>

                {(targetType === "PROGRAM_ANY_INSTANCE" ||
                  targetType === "PROGRAM_SPECIFIC_INSTANCE") && (
                  <div className="grid gap-2 mt-2">
                    <Label>Program</Label>
                    <Select value={targetProgramId} onValueChange={setTargetProgramId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a program" />
                      </SelectTrigger>
                      <SelectContent>
                        {programs.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {targetType === "PROGRAM_SPECIFIC_INSTANCE" && targetProgramId && (
                  <div className="grid gap-2 mt-2">
                    <Label>Instance</Label>
                    <Select
                      value={targetProgramInstanceId}
                      onValueChange={setTargetProgramInstanceId}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select an instance" />
                      </SelectTrigger>
                      <SelectContent>
                        {programInstances.map((i) => (
                          <SelectItem key={i.id} value={i.id}>
                            {new Date(i.date).toLocaleDateString()} {formatTime12h(i.startTime)} -{" "}
                            {formatTime12h(i.endTime)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {targetType === "MEMBERSHIP_HOLDERS" && (
                  <div className="grid gap-2 mt-2">
                    <Label>Membership Types</Label>
                    <div className="flex flex-wrap gap-2 p-3 border rounded-md min-h-[40px]">
                      {membershipGroups.map((g) => {
                        const isSelected = targetMembershipGroupIds.includes(g.id);
                        return (
                          <button
                            key={g.id}
                            type="button"
                            onClick={() =>
                              setTargetMembershipGroupIds((prev) =>
                                isSelected ? prev.filter((id) => id !== g.id) : [...prev, g.id]
                              )
                            }
                            className={cn(
                              "px-3 py-1 rounded-full text-xs font-medium border transition-colors",
                              isSelected
                                ? "bg-primary text-primary-foreground border-primary"
                                : "bg-muted text-muted-foreground border-transparent hover:bg-muted/80"
                            )}
                          >
                            {g.name}
                          </button>
                        );
                      })}
                      {membershipGroups.length === 0 && (
                        <p className="text-xs text-muted-foreground">No membership types found.</p>
                      )}
                    </div>
                  </div>
                )}

                {targetType === "SPECIFIC_USERS" && (
                  <div className="grid gap-2 mt-2">
                    <Label>Select Guardians</Label>
                    <Input
                      placeholder="Search guardians..."
                      value={guardianSearch}
                      onChange={(e) => setGuardianSearch(e.target.value)}
                      className="mb-1"
                    />
                    <div className="border rounded-md max-h-[160px] overflow-y-auto">
                      {guardians.map((g) => {
                        const isSelected = targetUserIds.includes(g.id);
                        return (
                          <button
                            key={g.id}
                            type="button"
                            onClick={() =>
                              setTargetUserIds((prev) =>
                                isSelected ? prev.filter((id) => id !== g.id) : [...prev, g.id]
                              )
                            }
                            className={cn(
                              "flex items-center justify-between w-full px-3 py-2 text-sm text-left hover:bg-muted/50 transition-colors",
                              isSelected && "bg-primary/5"
                            )}
                          >
                            <div>
                              <p className="font-medium">{g.name}</p>
                              <p className="text-xs text-muted-foreground">{g.email}</p>
                            </div>
                            {isSelected && <CheckCircle2 className="h-4 w-4 text-primary" />}
                          </button>
                        );
                      })}
                      {guardians.length === 0 && (
                        <p className="text-xs text-muted-foreground text-center py-4">
                          {isLoadingGuardians
                            ? "Loading guardians..."
                            : guardianSearch
                              ? "No guardians match your search."
                              : "No guardians available."}
                        </p>
                      )}
                    </div>
                    {targetUserIds.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {targetUserIds.length}{" "}
                        {targetUserIds.length === 1 ? "guardian" : "guardians"} selected
                      </p>
                    )}
                  </div>
                )}

                <div className="flex items-center gap-2 mt-2 p-3 rounded-md bg-muted/50">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  {(() => {
                    const count =
                      targetType === "SPECIFIC_USERS" ? targetUserIds.length : recipientCount;
                    return isLoadingRecipients ? (
                      <span className="text-sm text-muted-foreground">Counting recipients...</span>
                    ) : count !== null ? (
                      <span className="text-sm">
                        <span className="font-semibold">{count}</span>{" "}
                        <span className="text-muted-foreground">
                          {count === 1
                            ? `recipient will receive this ${recipientNoun}`
                            : `recipients will receive this ${recipientNoun}`}
                        </span>
                      </span>
                    ) : (
                      <span className="text-sm text-muted-foreground">
                        Select targeting to see recipient count
                      </span>
                    );
                  })()}
                </div>
              </div>
            </div>
          )}

          {channel === "email" && (
            <div
              className="px-0"
              style={{ display: currentStepId === "content" ? undefined : "none" }}
            >
              <EmailComposeStep
                ref={emailComposeRef}
                membershipsEnabled={membershipsEnabled}
                subject={subject}
                onSubjectChange={setSubject}
                onValidityChange={setComposeStepValid}
              />
            </div>
          )}

          {channel === "sms" && (
            <div
              className="px-0"
              style={{ display: currentStepId === "content" ? undefined : "none" }}
            >
              <SmsComposeStep
                ref={smsComposeRef}
                membershipsEnabled={membershipsEnabled}
                onMessageBodyChange={setMessageBody}
                onValidityChange={setComposeStepValid}
              />
            </div>
          )}

          {currentStepId === "preview" && channel === "email" && (
            <div className="overflow-y-auto max-h-[calc(90vh-280px)] px-1 py-2">
              <div className="space-y-4">
                <Card className="bg-muted/50">
                  <CardContent className="p-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Campaign:</span>{" "}
                        <span className="font-medium">{campaignName}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Recipients:</span>{" "}
                        <span className="font-medium">{displayRecipientCount ?? "..."}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Subject:</span>{" "}
                        <span className="font-medium">{subject}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Audience:</span>{" "}
                        <span className="font-medium">{TARGET_TYPE_LABELS[targetType]}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Email Preview</Label>
                  <div className="flex items-center gap-1 bg-muted rounded-md p-0.5">
                    <Button
                      variant={previewDevice === "desktop" ? "secondary" : "ghost"}
                      size="sm"
                      className="h-7 px-2"
                      onClick={() => setPreviewDevice("desktop")}
                    >
                      <Monitor className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant={previewDevice === "mobile" ? "secondary" : "ghost"}
                      size="sm"
                      className="h-7 px-2"
                      onClick={() => setPreviewDevice("mobile")}
                    >
                      <Smartphone className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                <div
                  className={cn(
                    "relative bg-gray-100 dark:bg-gray-900 rounded-md overflow-hidden transition-all duration-300 mx-auto border",
                    previewDevice === "desktop" ? "w-full" : "w-[375px]"
                  )}
                >
                  {isLoadingPreview && (
                    <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  )}
                  {previewHtml ? (
                    <iframe
                      key={previewDevice}
                      srcDoc={mobilePreviewHtml}
                      className={cn(
                        "w-full border-0 bg-white transition-all duration-300",
                        previewDevice === "desktop" ? "h-[450px]" : "h-[550px]"
                      )}
                      title="Email Preview"
                      sandbox="allow-same-origin"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-[300px] text-sm text-muted-foreground">
                      <div className="text-center">
                        <Eye className="h-8 w-8 mx-auto mb-2 opacity-30" />
                        <p>Loading preview...</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {currentStepId === "preview" && channel === "sms" && (
            <div className="overflow-y-auto max-h-[calc(90vh-280px)] px-1 py-2">
              <div className="space-y-4">
                <Card className="bg-muted/50">
                  <CardContent className="p-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Campaign:</span>{" "}
                        <span className="font-medium">{campaignName}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Recipients:</span>{" "}
                        <span className="font-medium">{displayRecipientCount ?? "..."}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Segments/msg:</span>{" "}
                        <span className="font-medium">{segmentInfo.segments}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Audience:</span>{" "}
                        <span className="font-medium">{TARGET_TYPE_LABELS[targetType]}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Label className="text-sm font-medium">Message Preview</Label>

                <div className="mx-auto w-[320px]">
                  <div className="relative bg-gray-100 dark:bg-gray-900 rounded-[2rem] border-4 border-gray-300 dark:border-gray-700 p-4 pt-8 pb-6">
                    <div className="absolute top-2 left-1/2 -translate-x-1/2 w-20 h-1.5 bg-gray-300 dark:bg-gray-600 rounded-full" />

                    <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm min-h-[120px]">
                      {isLoadingPreview ? (
                        <div className="flex items-center justify-center h-[120px]">
                          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                      ) : (
                        <p className="text-sm whitespace-pre-wrap leading-relaxed">
                          {previewBody || messageBody}
                        </p>
                      )}
                    </div>

                    <div className="mt-3 text-center">
                      <p className="text-[10px] text-muted-foreground">
                        {previewSegments || segmentInfo.segments} segment
                        {(previewSegments || segmentInfo.segments) !== 1 ? "s" : ""} &times;{" "}
                        {displayRecipientCount ?? 0} recipients ={" "}
                        <span className="font-semibold">
                          {(previewSegments || segmentInfo.segments) * (displayRecipientCount ?? 0)}{" "}
                          total segments
                        </span>
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {currentStepId === "send" && (
            <div className="overflow-y-auto max-h-[calc(90vh-280px)] px-1 py-2">
              <div className="space-y-6">
                <p className="text-sm text-muted-foreground">
                  Your campaign &quot;{campaignName}&quot; is ready to go to{" "}
                  <span className="font-medium text-foreground">{displayRecipientCount ?? 0}</span>{" "}
                  {displayRecipientCount === 1 ? "recipient" : "recipients"}. Choose how you&apos;d
                  like to proceed.
                </p>

                <Card
                  className={`border-2 hover:border-primary/50 transition-colors ${isSending ? "opacity-50 pointer-events-none" : "cursor-pointer"}`}
                  onClick={() => handleSubmit("send")}
                >
                  <CardContent className="p-5 flex items-start gap-4">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Send className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-base">Send Now</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        Immediately send this campaign to all {displayRecipientCount ?? 0}{" "}
                        {displayRecipientCount === 1 ? "recipient" : "recipients"}.
                      </p>
                    </div>
                    {isSending && <Loader2 className="h-5 w-5 animate-spin text-primary mt-1" />}
                  </CardContent>
                </Card>

                <Card className="border-2 hover:border-primary/50 transition-colors">
                  <CardContent className="p-5 flex items-start gap-4">
                    <div className="h-10 w-10 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0">
                      <Clock className="h-5 w-5 text-blue-500" />
                    </div>
                    <div className="flex-1 space-y-3">
                      <div>
                        <h3 className="font-semibold text-base">Schedule for Later</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          Pick a date and time to automatically send this campaign.
                        </p>
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
                          {isSaving ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <CalendarIcon className="mr-2 h-4 w-4" />
                          )}
                          Schedule
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card
                  className="border-2 hover:border-muted-foreground/30 transition-colors cursor-pointer"
                  onClick={() => handleSubmit("draft")}
                >
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
                    {isSaving && (
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mt-1" />
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t px-6 py-4 mt-auto">
          <Button
            variant="outline"
            onClick={() => {
              if (stepper.state.isFirst) onOpenChange(false);
              else stepper.navigation.prev();
            }}
          >
            {stepper.state.isFirst ? (
              "Cancel"
            ) : (
              <>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </>
            )}
          </Button>
          {!stepper.state.isLast && (
            <Button
              onClick={() => stepper.navigation.next()}
              disabled={
                (currentStepId === "campaign" && !canProceedFromStep1) ||
                (currentStepId === "content" && !composeStepValid)
              }
            >
              Next
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
});
