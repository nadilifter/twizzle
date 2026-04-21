"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
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
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  Layers,
  CreditCard,
  Shield,
  Clock,
  Calendar as CalendarIcon,
  Trash2,
  Info,
  Heart,
  FileText,
  Plus,
  RefreshCw,
  KeyRound,
} from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { GLCodeSelector } from "@/components/gl-code-selector";
import { useFeatures } from "@/components/feature-context";
import { useSeasons } from "@/hooks/use-seasons";
import { SeasonDateWarning } from "@/components/season-date-warning";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import type {
  BillingInterval,
  CreateMembershipGroupPayload,
  GenderDeclaration,
  MembershipInstanceStatus,
} from "@/types/memberships";

interface Level {
  id: string;
  name: string;
  color: string | null;
  order: number;
}

interface Waiver {
  id: string;
  title: string;
  status: string;
}

interface PendingInstance {
  tempId: string;
  name: string;
  price: number;
  billingInterval: BillingInterval;
  startDate: Date | null;
  endDate: Date | null;
  autoRenewDate: Date | null;
  status: MembershipInstanceStatus;
  registrationOpen: boolean;
  registrationStartDate: Date | null;
  registrationStartTime: string;
  registrationEndDate: Date | null;
  registrationEndTime: string;
  earlyAccessCode: string | null;
}

interface MembershipFormData {
  // Season
  seasonId: string | null;

  // Step 1: Details
  name: string;
  description: string;
  isRecurring: boolean;
  glCodeId: string | null;

  // Step 2: Pricing & Billing
  defaultPrice: number | null;
  defaultBillingInterval: BillingInterval;
  allowAutoRenew: boolean;
  autoGenerateInstances: boolean;
  generationLeadDays: number;
  purchaseWindowDays: number | null;

  // Step 3: Requirements
  hasAgeRestriction: boolean;
  minAge: number | null;
  maxAge: number | null;
  hasGenderRestriction: boolean;
  allowedGenders: GenderDeclaration[];
  hasCapacityRestriction: boolean;
  capacity: number | null;
  hasMedicalRequirement: boolean;
  hasLevelRestriction: boolean;
  levelRequirementIds: string[];
  hasWaiverRestriction: boolean;
  waiverRequirementIds: string[];

  // Step 4: Instances (recurring only, held in separate array)
}

const { useStepper } = defineStepper(
  { id: "season", title: "Season" },
  { id: "details", title: "Details" },
  { id: "pricing", title: "Pricing" },
  { id: "requirements", title: "Requirements" },
  { id: "instances", title: "Instances" }
);

export function MembershipStepper() {
  const router = useRouter();
  const { isFeatureEnabled } = useFeatures();
  const trainingEnabled = isFeatureEnabled("training");
  const seasonsEnabled = isFeatureEnabled("seasons");

  const { seasons, isLoading: seasonsLoading } = useSeasons({ autoFetch: seasonsEnabled });

  const [levels, setLevels] = React.useState<Level[]>([]);
  const [loadingLevels, setLoadingLevels] = React.useState(true);
  const [waivers, setWaivers] = React.useState<Waiver[]>([]);
  const [loadingWaivers, setLoadingWaivers] = React.useState(true);

  const [formData, setFormData] = React.useState<MembershipFormData>({
    seasonId: null,
    name: "",
    description: "",
    isRecurring: false,
    glCodeId: null,

    defaultPrice: null,
    defaultBillingInterval: "ONE_TIME",
    allowAutoRenew: false,
    autoGenerateInstances: false,
    generationLeadDays: 30,
    purchaseWindowDays: null,

    hasAgeRestriction: false,
    minAge: null,
    maxAge: null,
    hasGenderRestriction: false,
    allowedGenders: [],
    hasCapacityRestriction: false,
    capacity: null,
    hasMedicalRequirement: false,
    hasLevelRestriction: false,
    levelRequirementIds: [],
    hasWaiverRestriction: false,
    waiverRequirementIds: [],
  });

  const showSeasonStep = seasonsEnabled && (seasons.length > 0 || seasonsLoading);
  const selectedSeason = React.useMemo(() => {
    if (!formData.seasonId) return null;
    return seasons.find((s) => s.id === formData.seasonId) ?? null;
  }, [formData.seasonId, seasons]);

  const visibleStepIds = React.useMemo(() => {
    const ids: string[] = [];
    if (showSeasonStep) ids.push("season");
    ids.push("details", "pricing", "requirements", "instances");
    return ids;
  }, [showSeasonStep]);

  const [pendingInstances, setPendingInstances] = React.useState<PendingInstance[]>([]);
  const [isAddingInstance, setIsAddingInstance] = React.useState(false);
  const [newInstance, setNewInstance] = React.useState<PendingInstance>(() => makeEmptyInstance());
  const [isSaving, setIsSaving] = React.useState(false);
  const stepper = useStepper();

  React.useEffect(() => {
    if (!visibleStepIds.includes(stepper.state.current.data.id)) {
      stepper.navigation.goTo(visibleStepIds[0] as "details");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleStepIds, stepper.state.current.data.id, stepper.navigation]);

  function makeEmptyInstance(): PendingInstance {
    return {
      tempId: crypto.randomUUID(),
      name: "",
      price: 0,
      billingInterval: "YEARLY",
      startDate: null,
      endDate: null,
      autoRenewDate: null,
      status: "DRAFT",
      registrationOpen: true,
      registrationStartDate: null,
      registrationStartTime: "09:00",
      registrationEndDate: null,
      registrationEndTime: "23:59",
      earlyAccessCode: null,
    };
  }

  React.useEffect(() => {
    const fetchLevels = async () => {
      try {
        const response = await fetch("/api/levels");
        if (response.ok) {
          const data = await response.json();
          setLevels(data);
        }
      } catch (error) {
        console.error("Failed to fetch levels:", error);
      } finally {
        setLoadingLevels(false);
      }
    };
    fetchLevels();
  }, []);

  React.useEffect(() => {
    const fetchWaivers = async () => {
      try {
        const response = await fetch("/api/waivers?status=ACTIVE");
        if (response.ok) {
          const data = await response.json();
          setWaivers(data.data || []);
        }
      } catch (error) {
        console.error("Failed to fetch waivers:", error);
      } finally {
        setLoadingWaivers(false);
      }
    };
    fetchWaivers();
  }, []);

  const validateStep = (stepId: string): boolean => {
    switch (stepId) {
      case "details":
        if (!formData.name.trim()) {
          toast.error("Membership name is required");
          return false;
        }
        return true;

      case "pricing":
        if (formData.defaultPrice !== null && formData.defaultPrice < 0) {
          toast.error("Price cannot be negative");
          return false;
        }
        if (formData.autoGenerateInstances && formData.generationLeadDays < 1) {
          toast.error("Generation lead days must be at least 1");
          return false;
        }
        if (formData.purchaseWindowDays !== null && formData.purchaseWindowDays < 0) {
          toast.error("Purchase window days cannot be negative");
          return false;
        }
        return true;

      case "requirements":
        if (formData.hasCapacityRestriction && (!formData.capacity || formData.capacity < 1)) {
          toast.error("Capacity must be at least 1 when enabled");
          return false;
        }
        if (formData.hasAgeRestriction) {
          if (formData.minAge === null && formData.maxAge === null) {
            toast.error("At least one age value is required when age restriction is enabled");
            return false;
          }
          if (formData.minAge !== null && (formData.minAge < 0 || formData.minAge > 100)) {
            toast.error("Minimum age must be between 0 and 100");
            return false;
          }
          if (formData.maxAge !== null && (formData.maxAge < 0 || formData.maxAge > 100)) {
            toast.error("Maximum age must be between 0 and 100");
            return false;
          }
          if (
            formData.minAge !== null &&
            formData.maxAge !== null &&
            formData.minAge > formData.maxAge
          ) {
            toast.error("Minimum age cannot be greater than maximum age");
            return false;
          }
        }
        if (formData.hasLevelRestriction && formData.levelRequirementIds.length === 0) {
          toast.error("Select at least one level when level restriction is enabled");
          return false;
        }
        if (formData.hasWaiverRestriction && formData.waiverRequirementIds.length === 0) {
          toast.error("Select at least one waiver when waiver restriction is enabled");
          return false;
        }
        return true;

      case "instances":
        if (formData.isRecurring && pendingInstances.length === 0) {
          // Not an error — instances are optional during creation
        }
        return true;

      default:
        return true;
    }
  };

  const handleNext = () => {
    if (validateStep(stepper.state.current.data.id)) {
      const nextIdx = currentVisibleIndex + 1;
      if (nextIdx < visibleSteps.length) {
        stepper.navigation.goTo(visibleSteps[nextIdx].id);
      }
    }
  };

  const handlePrev = () => {
    const prevIdx = currentVisibleIndex - 1;
    if (prevIdx >= 0) {
      stepper.navigation.goTo(visibleSteps[prevIdx].id);
    }
  };

  const handleAddInstance = () => {
    if (!newInstance.name.trim()) {
      toast.error("Instance name is required");
      return;
    }
    if (newInstance.price < 0) {
      toast.error("Instance price cannot be negative");
      return;
    }
    if (!newInstance.startDate) {
      toast.error("Start date is required");
      return;
    }
    if (!newInstance.endDate) {
      toast.error("End date is required");
      return;
    }
    if (newInstance.startDate >= newInstance.endDate) {
      toast.error("End date must be after start date");
      return;
    }

    setPendingInstances((prev) => [...prev, { ...newInstance, tempId: crypto.randomUUID() }]);
    setNewInstance(makeEmptyInstance());
    setIsAddingInstance(false);
    toast.success("Instance added");
  };

  const handleRemoveInstance = (tempId: string) => {
    setPendingInstances((prev) => prev.filter((i) => i.tempId !== tempId));
  };

  const handleSubmit = async () => {
    if (
      !validateStep("details") ||
      !validateStep("pricing") ||
      !validateStep("requirements") ||
      !validateStep("instances")
    ) {
      return;
    }

    setIsSaving(true);

    try {
      const groupPayload: CreateMembershipGroupPayload = {
        name: formData.name,
        description: formData.description || undefined,
        isRecurring: formData.isRecurring,
        glCodeId: formData.glCodeId,

        defaultPrice: formData.defaultPrice ?? undefined,
        defaultBillingInterval: formData.defaultBillingInterval,
        allowAutoRenew: formData.isRecurring ? formData.allowAutoRenew : false,
        autoGenerateInstances: formData.isRecurring ? formData.autoGenerateInstances : false,
        generationLeadDays: formData.isRecurring ? formData.generationLeadDays : 30,
        purchaseWindowDays: formData.purchaseWindowDays,

        hasAgeRestriction: formData.hasAgeRestriction,
        minAge: formData.hasAgeRestriction ? formData.minAge : null,
        maxAge: formData.hasAgeRestriction ? formData.maxAge : null,
        hasGenderRestriction: formData.hasGenderRestriction,
        allowedGenders: formData.hasGenderRestriction ? formData.allowedGenders : [],
        hasCapacityRestriction: formData.hasCapacityRestriction,
        capacity: formData.hasCapacityRestriction ? formData.capacity : null,
        hasMedicalRequirement: formData.hasMedicalRequirement,
        hasLevelRestriction: formData.hasLevelRestriction,
        hasWaiverRestriction: formData.hasWaiverRestriction,
        seasonId: formData.seasonId,
      };

      // 1. Create the membership group
      const groupResponse = await fetch("/api/memberships", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(groupPayload),
      });

      if (!groupResponse.ok) {
        const error = await groupResponse.json();
        throw new Error(error.error || "Failed to create membership group");
      }

      const group = await groupResponse.json();
      const groupId = group.id;

      // 2. Create instances for recurring groups
      if (formData.isRecurring && pendingInstances.length > 0) {
        for (const instance of pendingInstances) {
          const instancePayload = {
            membershipGroupId: groupId,
            name: instance.name,
            price: instance.price,
            billingInterval: instance.billingInterval,
            startDate: instance.startDate ? format(instance.startDate, "yyyy-MM-dd") : "",
            endDate: instance.endDate ? format(instance.endDate, "yyyy-MM-dd") : "",
            autoRenewDate: instance.autoRenewDate
              ? format(instance.autoRenewDate, "yyyy-MM-dd")
              : undefined,
            status: instance.status,
            registrationOpen: instance.registrationOpen,
            registrationStartDate:
              !instance.registrationOpen && instance.registrationStartDate
                ? format(instance.registrationStartDate, "yyyy-MM-dd")
                : null,
            registrationStartTime: !instance.registrationOpen
              ? instance.registrationStartTime
              : null,
            registrationEndDate: instance.registrationEndDate
              ? format(instance.registrationEndDate, "yyyy-MM-dd")
              : null,
            registrationEndTime: instance.registrationEndTime || null,
            earlyAccessCode: instance.earlyAccessCode,
          };

          const instResponse = await fetch(`/api/memberships/${groupId}/instances`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(instancePayload),
          });

          if (!instResponse.ok) {
            const error = await instResponse.json();
            console.error("Failed to create instance:", error);
            toast.error(`Failed to create instance "${instance.name}": ${error.error}`);
          }
        }
      }

      // 3. Add level requirements
      if (formData.hasLevelRestriction && formData.levelRequirementIds.length > 0) {
        for (const levelId of formData.levelRequirementIds) {
          await fetch(`/api/memberships/${groupId}/restrictions`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type: "level", levelId }),
          });
        }
      }

      // 4. Add waiver requirements
      if (formData.hasWaiverRestriction && formData.waiverRequirementIds.length > 0) {
        for (const waiverId of formData.waiverRequirementIds) {
          await fetch(`/api/memberships/${groupId}/restrictions`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type: "waiver", waiverId }),
          });
        }
      }

      toast.success("Membership group created successfully");
      router.push("/dashboard/athletes/memberships");
    } catch (error: any) {
      console.error("Failed to create membership group:", error);
      toast.error(error.message || "Failed to create membership group");
    } finally {
      setIsSaving(false);
    }
  };

  const visibleSteps = stepper.state.all.filter((s) => visibleStepIds.includes(s.id));
  const currentVisibleIndex = visibleSteps.findIndex((s) => s.id === stepper.state.current.data.id);
  const currentIndex = stepper.state.all.findIndex((s) => s.id === stepper.state.current.data.id);

  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="flex flex-col gap-4">
        <StepperNav className="mb-4">
          {visibleSteps.map((step, index) => {
            const status = getStepStatus(index, currentVisibleIndex);
            return (
              <React.Fragment key={step.id}>
                <StepperItem status={status}>
                  <StepperIndicator
                    status={status}
                    step={index + 1}
                    onClick={() => {
                      if (index < currentVisibleIndex) stepper.navigation.goTo(step.id);
                    }}
                  />
                  <StepperTitle status={status} className="hidden sm:block">
                    {step.title}
                  </StepperTitle>
                </StepperItem>
                {index < visibleSteps.length - 1 && (
                  <StepperSeparator status={status} className="hidden sm:block" />
                )}
              </React.Fragment>
            );
          })}
        </StepperNav>

        {/* Season Step */}
        {stepper.state.current.data.id === "season" && (
          <Card>
            <CardHeader>
              <CardTitle>Season</CardTitle>
              <CardDescription>Optionally assign this membership to a season</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Season</Label>
                <Select
                  value={formData.seasonId || "none"}
                  onValueChange={(val) =>
                    setFormData((prev) => ({ ...prev, seasonId: val === "none" ? null : val }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a season" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {seasons.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: s.color }}
                          />
                          {s.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {selectedSeason && (
                <div className="rounded-lg border p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: selectedSeason.color }}
                    />
                    <span className="font-medium">{selectedSeason.name}</span>
                    <Badge variant="outline" className="text-xs">
                      {selectedSeason.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(selectedSeason.startDate), "MMM d, yyyy")} –{" "}
                    {format(new Date(selectedSeason.endDate), "MMM d, yyyy")}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Step 1: Details */}
        {stepper.state.current.data.id === "details" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Layers className="h-5 w-5" />
                Membership Details
              </CardTitle>
              <CardDescription>
                Define the basic information for this membership group
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="name">Membership Name *</Label>
                <Input
                  id="name"
                  placeholder="e.g., Annual Membership"
                  value={formData.name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Describe this membership type..."
                  value={formData.description}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, description: e.target.value }))
                  }
                />
              </div>

              <div className="rounded-lg border p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base font-medium">Recurring Membership</Label>
                    <p className="text-sm text-muted-foreground">
                      Generates periodic instances (e.g., annual FY periods)
                    </p>
                  </div>
                  <Switch
                    checked={formData.isRecurring}
                    onCheckedChange={(checked) =>
                      setFormData((prev) => ({
                        ...prev,
                        isRecurring: checked,
                        defaultBillingInterval: checked ? "YEARLY" : "ONE_TIME",
                        allowAutoRenew: checked ? prev.allowAutoRenew : false,
                        autoGenerateInstances: checked ? prev.autoGenerateInstances : false,
                      }))
                    }
                  />
                </div>
              </div>

              <GLCodeSelector
                value={formData.glCodeId}
                onChange={(v) => setFormData((prev) => ({ ...prev, glCodeId: v }))}
                entityType="MEMBERSHIP"
              />
            </CardContent>
          </Card>
        )}

        {/* Step 2: Pricing & Billing */}
        {stepper.state.current.data.id === "pricing" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Pricing & Billing
              </CardTitle>
              <CardDescription>
                Configure default pricing, billing intervals, and purchase settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="defaultPrice">Default Price ($)</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                      $
                    </span>
                    <Input
                      id="defaultPrice"
                      type="number"
                      min={0}
                      step={0.01}
                      placeholder="0.00"
                      className="pl-7"
                      value={formData.defaultPrice === null ? "" : formData.defaultPrice}
                      onChange={(e) => {
                        const raw = e.target.value;
                        if (raw === "") {
                          setFormData((prev) => ({ ...prev, defaultPrice: null }));
                          return;
                        }
                        const parsed = parseFloat(raw);
                        if (!Number.isNaN(parsed) && parsed >= 0) {
                          setFormData((prev) => ({
                            ...prev,
                            defaultPrice: Math.round(parsed * 100) / 100,
                          }));
                        }
                      }}
                    />
                  </div>
                  {!formData.isRecurring && (
                    <p className="text-sm text-muted-foreground">
                      Setting a price will auto-create a single active instance
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="defaultBillingInterval">Billing Interval</Label>
                  <Select
                    value={formData.defaultBillingInterval}
                    onValueChange={(value: BillingInterval) =>
                      setFormData((prev) => ({ ...prev, defaultBillingInterval: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {!formData.isRecurring && <SelectItem value="ONE_TIME">One-time</SelectItem>}
                      <SelectItem value="YEARLY">Yearly</SelectItem>
                      <SelectItem value="MONTHLY">Monthly</SelectItem>
                      <SelectItem value="SESSION">Per Session</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {formData.isRecurring && (
                <>
                  <Separator />

                  <div className="rounded-lg border p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label className="text-base font-medium flex items-center gap-2">
                          <RefreshCw className="h-4 w-4 text-muted-foreground" />
                          Allow Auto-Renewal
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          Members can opt in to automatic renewal
                        </p>
                      </div>
                      <Switch
                        checked={formData.allowAutoRenew}
                        onCheckedChange={(checked) =>
                          setFormData((prev) => ({ ...prev, allowAutoRenew: checked }))
                        }
                      />
                    </div>
                  </div>

                  <div className="rounded-lg border p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label className="text-base font-medium">Auto-Generate Instances</Label>
                        <p className="text-sm text-muted-foreground">
                          Automatically create new draft instances ahead of schedule
                        </p>
                      </div>
                      <Switch
                        checked={formData.autoGenerateInstances}
                        onCheckedChange={(checked) =>
                          setFormData((prev) => ({ ...prev, autoGenerateInstances: checked }))
                        }
                      />
                    </div>

                    {formData.autoGenerateInstances && (
                      <div className="pt-2 border-t">
                        <Label htmlFor="generationLeadDays">Generation Lead Days</Label>
                        <Input
                          id="generationLeadDays"
                          type="number"
                          min={1}
                          value={formData.generationLeadDays}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              generationLeadDays: parseInt(e.target.value) || 30,
                            }))
                          }
                          className="mt-2 max-w-[200px]"
                        />
                        <p className="text-sm text-muted-foreground mt-1">
                          Days in advance to auto-generate draft instances
                        </p>
                      </div>
                    )}
                  </div>
                </>
              )}

              <Separator />

              <div className="space-y-2">
                <Label
                  htmlFor="purchaseWindowDays"
                  className="text-base font-medium flex items-center gap-2"
                >
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  Purchase Window (days before start)
                </Label>
                <Input
                  id="purchaseWindowDays"
                  type="number"
                  min={0}
                  placeholder="Leave empty for always available"
                  value={formData.purchaseWindowDays ?? ""}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      purchaseWindowDays: e.target.value ? parseInt(e.target.value) : null,
                    }))
                  }
                  className="max-w-[300px]"
                />
                <p className="text-sm text-muted-foreground">
                  Number of days before an instance&apos;s start date that it becomes available for
                  purchase. Leave empty for always available.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Requirements */}
        {stepper.state.current.data.id === "requirements" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Requirements & Restrictions
              </CardTitle>
              <CardDescription>
                Configure eligibility requirements for this membership. Toggle on the restrictions
                you want to apply.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Age Restriction */}
              <div className="rounded-lg border p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base font-medium">Age Restriction</Label>
                    <p className="text-sm text-muted-foreground">
                      Restrict membership by athlete age
                    </p>
                  </div>
                  <Switch
                    checked={formData.hasAgeRestriction}
                    onCheckedChange={(checked) =>
                      setFormData((prev) => ({
                        ...prev,
                        hasAgeRestriction: checked,
                        minAge: checked ? prev.minAge : null,
                        maxAge: checked ? prev.maxAge : null,
                      }))
                    }
                  />
                </div>

                {formData.hasAgeRestriction && (
                  <div className="pt-2 border-t space-y-4">
                    <div className="flex items-center gap-2 p-2 rounded bg-muted/50">
                      <Info className="h-4 w-4 text-muted-foreground shrink-0" />
                      <p className="text-xs text-muted-foreground">
                        At least one age value is required. Leave the other blank for no limit in
                        that direction.
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="minAge">Minimum Age</Label>
                        <Input
                          id="minAge"
                          type="number"
                          min={0}
                          max={100}
                          placeholder="No minimum"
                          value={formData.minAge ?? ""}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              minAge: e.target.value ? parseInt(e.target.value) : null,
                            }))
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="maxAge">Maximum Age</Label>
                        <Input
                          id="maxAge"
                          type="number"
                          min={0}
                          max={100}
                          placeholder="No maximum"
                          value={formData.maxAge ?? ""}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              maxAge: e.target.value ? parseInt(e.target.value) : null,
                            }))
                          }
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Gender Restriction */}
              <div className="rounded-lg border p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base font-medium">Gender Restriction</Label>
                    <p className="text-sm text-muted-foreground">Restrict membership by gender</p>
                  </div>
                  <Switch
                    checked={formData.hasGenderRestriction}
                    onCheckedChange={(checked) =>
                      setFormData((prev) => ({
                        ...prev,
                        hasGenderRestriction: checked,
                        allowedGenders: checked ? prev.allowedGenders : [],
                      }))
                    }
                  />
                </div>

                {formData.hasGenderRestriction && (
                  <div className="pt-2 border-t">
                    <div className="flex flex-wrap gap-2">
                      {(["MALE", "FEMALE", "OTHER", "PREFER_NOT_TO_SAY"] as const).map((gender) => {
                        const selected = formData.allowedGenders.includes(gender);
                        return (
                          <Badge
                            key={gender}
                            variant={selected ? "default" : "outline"}
                            className="cursor-pointer"
                            onClick={() => {
                              setFormData((prev) => ({
                                ...prev,
                                allowedGenders: selected
                                  ? prev.allowedGenders.filter((g) => g !== gender)
                                  : [...prev.allowedGenders, gender],
                              }));
                            }}
                          >
                            {gender
                              .replaceAll("_", " ")
                              .toLowerCase()
                              .replace(/\b\w/g, (l) => l.toUpperCase())}
                          </Badge>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Capacity Restriction */}
              <div className="rounded-lg border p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base font-medium">Capacity Limit</Label>
                    <p className="text-sm text-muted-foreground">
                      Limit the number of members per instance
                    </p>
                  </div>
                  <Switch
                    checked={formData.hasCapacityRestriction}
                    onCheckedChange={(checked) =>
                      setFormData((prev) => ({
                        ...prev,
                        hasCapacityRestriction: checked,
                        capacity: checked ? prev.capacity || 50 : null,
                      }))
                    }
                  />
                </div>

                {formData.hasCapacityRestriction && (
                  <div className="pt-2 border-t">
                    <Label htmlFor="capacity">Maximum Capacity</Label>
                    <Input
                      id="capacity"
                      type="number"
                      min={1}
                      placeholder="Enter maximum number of members"
                      value={formData.capacity || ""}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          capacity: e.target.value ? parseInt(e.target.value) : null,
                        }))
                      }
                      className="mt-2 max-w-[200px]"
                    />
                  </div>
                )}
              </div>

              {/* Medical Requirement */}
              <div className="rounded-lg border p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base font-medium">Medical Information Requirement</Label>
                    <p className="text-sm text-muted-foreground">
                      Require members to provide medical information during checkout
                    </p>
                  </div>
                  <Switch
                    checked={formData.hasMedicalRequirement}
                    onCheckedChange={(checked) =>
                      setFormData((prev) => ({
                        ...prev,
                        hasMedicalRequirement: checked,
                      }))
                    }
                  />
                </div>

                {formData.hasMedicalRequirement && (
                  <div className="pt-2 border-t">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Heart className="h-4 w-4" />
                      <span>
                        Medical information categories are configured in your{" "}
                        <a href="/dashboard/athletes/medical" className="text-primary underline">
                          Medical Information Settings
                        </a>
                        .
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Level Restriction */}
              {trainingEnabled && (
                <div className="rounded-lg border p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-base font-medium">Level Restriction</Label>
                      <p className="text-sm text-muted-foreground">
                        Require athletes to be at one of the selected levels
                      </p>
                    </div>
                    <Switch
                      checked={formData.hasLevelRestriction}
                      onCheckedChange={(checked) =>
                        setFormData((prev) => ({
                          ...prev,
                          hasLevelRestriction: checked,
                          levelRequirementIds: checked ? prev.levelRequirementIds : [],
                        }))
                      }
                    />
                  </div>

                  {formData.hasLevelRestriction && (
                    <div className="pt-2 border-t">
                      {loadingLevels ? (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Loading levels...
                        </div>
                      ) : levels.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          No levels configured.{" "}
                          <a href="/dashboard/training/levels" className="text-primary underline">
                            Create levels
                          </a>{" "}
                          first.
                        </p>
                      ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                          {levels.map((level) => (
                            <label
                              key={level.id}
                              className={cn(
                                "flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors",
                                formData.levelRequirementIds.includes(level.id)
                                  ? "border-primary bg-primary/5"
                                  : "hover:bg-muted/50"
                              )}
                            >
                              <Checkbox
                                checked={formData.levelRequirementIds.includes(level.id)}
                                onCheckedChange={(checked) => {
                                  setFormData((prev) => ({
                                    ...prev,
                                    levelRequirementIds: checked
                                      ? [...prev.levelRequirementIds, level.id]
                                      : prev.levelRequirementIds.filter((id) => id !== level.id),
                                  }));
                                }}
                              />
                              <div
                                className="w-3 h-3 rounded-full shrink-0"
                                style={{ backgroundColor: level.color || "#64748b" }}
                              />
                              <span className="text-sm font-medium">{level.name}</span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Waiver Requirement */}
              <div className="rounded-lg border p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base font-medium">Waiver Requirement</Label>
                    <p className="text-sm text-muted-foreground">
                      Require members to sign a waiver before checkout
                    </p>
                  </div>
                  <Switch
                    checked={formData.hasWaiverRestriction}
                    onCheckedChange={(checked) =>
                      setFormData((prev) => ({
                        ...prev,
                        hasWaiverRestriction: checked,
                        waiverRequirementIds: checked ? prev.waiverRequirementIds : [],
                      }))
                    }
                  />
                </div>

                {formData.hasWaiverRestriction && (
                  <div className="pt-2 border-t">
                    {loadingWaivers ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading waivers...
                      </div>
                    ) : waivers.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No active waivers found.{" "}
                        <a
                          href="/dashboard/athletes/waivers?create=true"
                          className="text-primary underline"
                        >
                          Create a waiver
                        </a>{" "}
                        first.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {waivers.map((waiver) => (
                          <label
                            key={waiver.id}
                            className={cn(
                              "flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors",
                              formData.waiverRequirementIds.includes(waiver.id)
                                ? "border-primary bg-primary/5"
                                : "hover:bg-muted/50"
                            )}
                          >
                            <Checkbox
                              checked={formData.waiverRequirementIds.includes(waiver.id)}
                              onCheckedChange={(checked) => {
                                setFormData((prev) => ({
                                  ...prev,
                                  waiverRequirementIds: checked
                                    ? [...prev.waiverRequirementIds, waiver.id]
                                    : prev.waiverRequirementIds.filter((id) => id !== waiver.id),
                                }));
                              }}
                            />
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <FileText className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm font-medium">{waiver.title}</span>
                              </div>
                            </div>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 4: Instances */}
        {stepper.state.current.data.id === "instances" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarIcon className="h-5 w-5" />
                Membership Instances
              </CardTitle>
              <CardDescription>
                {formData.isRecurring
                  ? "Add one or more membership instances. Each instance represents a period (e.g., FY2026). All instances will be created as drafts that you can publish when ready."
                  : "A single instance will be auto-generated when the group is created."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {!formData.isRecurring ? (
                <div className="rounded-lg border border-dashed p-6 text-center space-y-2">
                  <CalendarIcon className="h-8 w-8 mx-auto text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground">
                    This is a one-time membership.
                    {formData.defaultPrice != null
                      ? ` An active instance will be automatically created at $${formData.defaultPrice.toFixed(2)}.`
                      : " Set a default price in the Pricing step to auto-create an instance."}
                  </p>
                </div>
              ) : (
                <>
                  {/* Instance list */}
                  {pendingInstances.length > 0 && (
                    <div className="space-y-3">
                      {pendingInstances.map((instance) => (
                        <div
                          key={instance.tempId}
                          className="flex items-center gap-3 rounded-lg border p-4 bg-card"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium">{instance.name}</span>
                              <Badge
                                variant={instance.status === "ACTIVE" ? "default" : "secondary"}
                              >
                                {instance.status}
                              </Badge>
                            </div>
                            <div className="text-sm text-muted-foreground">
                              ${instance.price.toFixed(2)} /{" "}
                              {instance.billingInterval.toLowerCase().replace("_", "-")}
                              {instance.startDate && instance.endDate && (
                                <span className="ml-2">
                                  {format(instance.startDate, "MMM d, yyyy")} -{" "}
                                  {format(instance.endDate, "MMM d, yyyy")}
                                </span>
                              )}
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveInstance(instance.tempId)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add instance form */}
                  {isAddingInstance ? (
                    <div className="rounded-lg border p-4 space-y-4 bg-muted/20">
                      <h4 className="font-medium text-sm">New Instance</h4>
                      <div className="space-y-2">
                        <Label>Instance Name *</Label>
                        <Input
                          placeholder="e.g., FY2026"
                          value={newInstance.name}
                          onChange={(e) =>
                            setNewInstance((prev) => ({ ...prev, name: e.target.value }))
                          }
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Price ($) *</Label>
                          <Input
                            type="number"
                            min={0}
                            step={0.01}
                            value={newInstance.price || ""}
                            onChange={(e) =>
                              setNewInstance((prev) => ({
                                ...prev,
                                price: parseFloat(e.target.value) || 0,
                              }))
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Billing Interval</Label>
                          <Select
                            value={newInstance.billingInterval}
                            onValueChange={(value: BillingInterval) =>
                              setNewInstance((prev) => ({ ...prev, billingInterval: value }))
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="YEARLY">Yearly</SelectItem>
                              <SelectItem value="MONTHLY">Monthly</SelectItem>
                              <SelectItem value="SESSION">Per Session</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {selectedSeason && (
                        <div className="flex items-center justify-between rounded-lg border p-3 bg-muted/30">
                          <div className="flex items-center gap-2 text-sm">
                            <div
                              className="w-2.5 h-2.5 rounded-full"
                              style={{ backgroundColor: selectedSeason.color }}
                            />
                            <span className="font-medium">{selectedSeason.name}</span>
                            <span className="text-muted-foreground">
                              {format(new Date(selectedSeason.startDate), "MMM d")} –{" "}
                              {format(new Date(selectedSeason.endDate), "MMM d, yyyy")}
                            </span>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setNewInstance((prev) => ({
                                ...prev,
                                startDate: new Date(selectedSeason.startDate),
                                endDate: new Date(selectedSeason.endDate),
                              }));
                            }}
                          >
                            Use Season Dates
                          </Button>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Start Date *</Label>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                type="button"
                                variant="outline"
                                className={cn(
                                  "w-full justify-start text-left font-normal",
                                  !newInstance.startDate && "text-muted-foreground"
                                )}
                              >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {newInstance.startDate
                                  ? format(newInstance.startDate, "PPP")
                                  : "Pick a date"}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto overflow-hidden p-0" align="start">
                              <Calendar
                                mode="single"
                                fixedWeeks
                                selected={newInstance.startDate || undefined}
                                onSelect={(date) => {
                                  setNewInstance((prev) => ({
                                    ...prev,
                                    startDate: date || null,
                                    endDate:
                                      prev.endDate && date && prev.endDate < date
                                        ? null
                                        : prev.endDate,
                                  }));
                                }}
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>
                        </div>
                        <div className="space-y-2">
                          <Label>End Date *</Label>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                type="button"
                                variant="outline"
                                className={cn(
                                  "w-full justify-start text-left font-normal",
                                  !newInstance.endDate && "text-muted-foreground"
                                )}
                              >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {newInstance.endDate
                                  ? format(newInstance.endDate, "PPP")
                                  : "Pick a date"}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto overflow-hidden p-0" align="start">
                              <Calendar
                                mode="single"
                                fixedWeeks
                                selected={newInstance.endDate || undefined}
                                onSelect={(date) =>
                                  setNewInstance((prev) => ({ ...prev, endDate: date || null }))
                                }
                                disabled={(date) =>
                                  newInstance.startDate ? date < newInstance.startDate : false
                                }
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Status</Label>
                          <Select
                            value={newInstance.status}
                            onValueChange={(value: MembershipInstanceStatus) =>
                              setNewInstance((prev) => ({ ...prev, status: value }))
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="DRAFT">Draft</SelectItem>
                              <SelectItem value="ACTIVE">Active</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Auto-Renew Date</Label>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                type="button"
                                variant="outline"
                                className={cn(
                                  "w-full justify-start text-left font-normal",
                                  !newInstance.autoRenewDate && "text-muted-foreground"
                                )}
                              >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {newInstance.autoRenewDate
                                  ? format(newInstance.autoRenewDate, "PPP")
                                  : "Optional"}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto overflow-hidden p-0" align="start">
                              <Calendar
                                mode="single"
                                fixedWeeks
                                selected={newInstance.autoRenewDate || undefined}
                                onSelect={(date) =>
                                  setNewInstance((prev) => ({
                                    ...prev,
                                    autoRenewDate: date || null,
                                  }))
                                }
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>
                        </div>
                      </div>

                      <Separator />

                      {/* Registration Window */}
                      <div className="space-y-4">
                        <Label className="text-base font-medium">Registration Availability</Label>
                        <RadioGroup
                          value={newInstance.registrationOpen ? "now" : "scheduled"}
                          onValueChange={(value) => {
                            const isNow = value === "now";
                            setNewInstance((prev) => ({
                              ...prev,
                              registrationOpen: isNow,
                              registrationStartDate: isNow ? null : prev.registrationStartDate,
                            }));
                          }}
                          className="space-y-3"
                        >
                          <label
                            className={cn(
                              "flex items-start gap-4 rounded-lg border p-4 cursor-pointer transition-colors",
                              newInstance.registrationOpen
                                ? "border-primary bg-primary/5"
                                : "hover:bg-muted/50"
                            )}
                          >
                            <RadioGroupItem value="now" className="mt-1" />
                            <div className="flex-1 space-y-1">
                              <span className="font-medium">Open Registration Now</span>
                              <p className="text-sm text-muted-foreground">
                                Registration is immediately available for athletes
                              </p>
                            </div>
                          </label>

                          <label
                            className={cn(
                              "flex items-start gap-4 rounded-lg border p-4 cursor-pointer transition-colors",
                              !newInstance.registrationOpen
                                ? "border-primary bg-primary/5"
                                : "hover:bg-muted/50"
                            )}
                          >
                            <RadioGroupItem value="scheduled" className="mt-1" />
                            <div className="flex-1 space-y-1">
                              <span className="font-medium">Schedule Registration</span>
                              <p className="text-sm text-muted-foreground">
                                Set a specific date and time for registration to open
                              </p>
                            </div>
                          </label>
                        </RadioGroup>
                      </div>

                      {!newInstance.registrationOpen && (
                        <div className="space-y-4">
                          <Label className="text-base font-medium">Registration Opens</Label>
                          <p className="text-sm text-muted-foreground">
                            Set when registration becomes available
                          </p>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label>Open Date</Label>
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    className={cn(
                                      "w-full justify-start text-left font-normal",
                                      !newInstance.registrationStartDate && "text-muted-foreground"
                                    )}
                                  >
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {newInstance.registrationStartDate
                                      ? format(newInstance.registrationStartDate, "PPP")
                                      : "Pick a date"}
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent
                                  className="w-auto overflow-hidden p-0"
                                  align="start"
                                >
                                  <Calendar
                                    mode="single"
                                    fixedWeeks
                                    selected={newInstance.registrationStartDate || undefined}
                                    onSelect={(date) =>
                                      setNewInstance((prev) => ({
                                        ...prev,
                                        registrationStartDate: date || null,
                                      }))
                                    }
                                    disabled={(date) =>
                                      newInstance.startDate ? date > newInstance.startDate : false
                                    }
                                    initialFocus
                                  />
                                </PopoverContent>
                              </Popover>
                            </div>
                            <div className="space-y-2">
                              <Label>Open Time</Label>
                              <div className="relative">
                                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                  type="time"
                                  value={newInstance.registrationStartTime}
                                  onChange={(e) =>
                                    setNewInstance((prev) => ({
                                      ...prev,
                                      registrationStartTime: e.target.value,
                                    }))
                                  }
                                  className="pl-10"
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="space-y-4">
                        <Label className="text-base font-medium">Registration Closes</Label>
                        <p className="text-sm text-muted-foreground">
                          Set when registration closes. Defaults to the instance end date if not
                          specified.
                        </p>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Close Date</Label>
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button
                                  type="button"
                                  variant="outline"
                                  className={cn(
                                    "w-full justify-start text-left font-normal",
                                    !newInstance.registrationEndDate && "text-muted-foreground"
                                  )}
                                >
                                  <CalendarIcon className="mr-2 h-4 w-4" />
                                  {newInstance.registrationEndDate
                                    ? format(newInstance.registrationEndDate, "PPP")
                                    : newInstance.endDate
                                      ? `Instance end: ${format(newInstance.endDate, "PPP")}`
                                      : "Pick a date"}
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto overflow-hidden p-0" align="start">
                                <Calendar
                                  mode="single"
                                  fixedWeeks
                                  selected={newInstance.registrationEndDate || undefined}
                                  onSelect={(date) =>
                                    setNewInstance((prev) => ({
                                      ...prev,
                                      registrationEndDate: date || null,
                                    }))
                                  }
                                  disabled={(date) => {
                                    const earliest =
                                      !newInstance.registrationOpen &&
                                      newInstance.registrationStartDate
                                        ? newInstance.registrationStartDate
                                        : new Date();
                                    return date < earliest;
                                  }}
                                  initialFocus
                                />
                              </PopoverContent>
                            </Popover>
                          </div>
                          <div className="space-y-2">
                            <Label>Close Time</Label>
                            <div className="relative">
                              <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                              <Input
                                type="time"
                                value={newInstance.registrationEndTime}
                                onChange={(e) =>
                                  setNewInstance((prev) => ({
                                    ...prev,
                                    registrationEndTime: e.target.value,
                                  }))
                                }
                                className="pl-10"
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <Label className="text-base font-medium flex items-center gap-2">
                          <KeyRound className="h-4 w-4 text-muted-foreground" />
                          Early Access Code
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          Generate or enter a code that allows registration before the registration
                          window opens
                        </p>
                        <div className="flex items-center gap-2">
                          <Input
                            placeholder="Enter or generate a code"
                            value={newInstance.earlyAccessCode || ""}
                            onChange={(e) =>
                              setNewInstance((prev) => ({
                                ...prev,
                                earlyAccessCode: e.target.value || null,
                              }))
                            }
                            className="max-w-[300px]"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                              const code = crypto.randomUUID().slice(0, 8).toUpperCase();
                              setNewInstance((prev) => ({ ...prev, earlyAccessCode: code }));
                            }}
                          >
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Generate
                          </Button>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button type="button" onClick={handleAddInstance}>
                          <Plus className="h-4 w-4 mr-2" />
                          Add Instance
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setIsAddingInstance(false);
                            setNewInstance(makeEmptyInstance());
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setNewInstance({
                          ...makeEmptyInstance(),
                          price: formData.defaultPrice ?? 0,
                          billingInterval:
                            formData.defaultBillingInterval === "ONE_TIME"
                              ? "YEARLY"
                              : formData.defaultBillingInterval,
                        });
                        setIsAddingInstance(true);
                      }}
                      className="w-full"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Instance
                    </Button>
                  )}

                  {pendingInstances.length === 0 && !isAddingInstance && (
                    <div className="flex items-center gap-2 p-3 rounded bg-muted/50">
                      <Info className="h-4 w-4 text-muted-foreground shrink-0" />
                      <p className="text-sm text-muted-foreground">
                        You can create instances now or add them later from the manage panel.
                      </p>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between mt-6">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/dashboard/athletes/memberships")}
          >
            Cancel
          </Button>

          <div className="flex items-center gap-2">
            {currentVisibleIndex > 0 && (
              <Button type="button" variant="outline" onClick={handlePrev}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Previous
              </Button>
            )}

            {currentVisibleIndex < visibleSteps.length - 1 ? (
              <Button type="button" onClick={handleNext}>
                Next
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            ) : (
              <Button type="button" onClick={handleSubmit} disabled={isSaving}>
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Create Membership
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
