"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useFeatures } from "@/components/feature-context";
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
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ResponsiveTabsList } from "@/components/ui/responsive-tabs";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import {
  Loader2,
  Trophy,
  MapPin,
  Clock,
  CalendarDays,
  Tag,
  Info,
  Users,
  CreditCard,
  BarChart3,
  Check,
  DollarSign,
  Plus,
  Trash2,
  Heart,
  FileText,
  Calendar as CalendarIcon,
  KeyRound,
  RefreshCw,
  Link2,
  Copy,
} from "lucide-react";
import { toast } from "sonner";
import { FileRequirementConfigEditor } from "@/components/ui/file-requirement-config";
import type { FileRequirementConfig } from "@/types/file-requirements";
import { useMemberships } from "@/hooks/use-memberships";
import { cn } from "@/lib/utils";
import { ColorSelector } from "@/components/color-selector";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";

interface CompetitionConfigurationProps {
  competitionId: string;
  onClose: () => void;
  onUpdated?: () => void | Promise<void>;
}

// -- Types copied/adapted from CompetitionStepper --

type PublishStatus = "LIVE" | "DRAFT" | "SCHEDULED" | "CLOSED" | "COMPLETED";

interface Level {
  id: string;
  name: string;
  color: string | null;
  order: number;
}

interface Facility {
  id: string;
  name: string;
  street: string | null;
  city: string | null;
  stateProvince: string | null;
  country: string | null;
}

interface MembershipInstance {
  id: string;
  name: string;
  price: number;
  groupName: string;
}

type ResultType = "TIME" | "DISTANCE" | "HEIGHT" | "SCORE" | "PLACEMENT";
type SortDir = "ASC" | "DESC";
type SubMode = "NONE" | "VERIFIED_RESULT" | "MANUAL_ENTRY";

interface CategoryResultConfig {
  combinationEntryId: string | null;
  individualEntryId: string | null;
  label: string;
  resultType: ResultType;
  sortDirection: SortDir;
  precision: number;
  seedMarkRequired: boolean;
  submissionMode: SubMode;
  qualifyingMark: number | null;
  isTeamEvent: boolean;
  teamSize: number | null;
  collectResults: boolean;
}

interface CompetitionFormData {
  // Step 1: General
  name: string;
  color: string;
  facilityId: string | null;
  country: string;
  stateProvince: string;
  city: string;
  streetAddress: string;
  startDate: Date | null;
  endDate: Date | null;
  startTime: string;
  endTime: string;

  // Step 2: Categories
  categoryMode: "ALL" | "SPECIFIC";
  selectedCategoryIds: string[];

  // Step 3: Restrictions
  hasLevelRestriction: boolean;
  levelRequirementIds: string[];
  hasCapacityRestriction: boolean;
  capacity: number | null;
  hasAgeRestriction: boolean;
  minAge: number | null;
  maxAge: number | null;
  hasMembershipRestriction: boolean;
  membershipRequirementIds: string[];
  hasWaiverRestriction: boolean;
  waiverRequirementIds: string[];
  hasMedicalRequirement: boolean;
  hasFileRequirement: boolean;
  fileRequirementConfig: FileRequirementConfig | null;

  // Step 4: Results
  categoryResults: CategoryResultConfig[];

  // Step 5: Registration
  registrationOpen: boolean;
  registrationStartDate: string;
  registrationStartTime: string;
  registrationEndDate: string;
  registrationEndTime: string;
  earlyAccessCode: string | null;

  // Step 6: Pricing
  pricingMode: "FREE" | "PER_COMPETITION" | "PER_EVENT" | "TIERED" | "PER_CATEGORY";
  entryFee: number | null;
  pricingTiers: Array<{ minEvents: number; maxEvents: number | null; pricePerEvent: number }>;
  categoryPrices: Record<string, number>;

  // Step 6: Confirmation
  publishStatus: PublishStatus;
  scheduledGoLiveDate: Date | null;
  scheduledGoLiveTime: string;
}

export function CompetitionConfiguration({
  competitionId,
  onClose,
  onUpdated,
}: CompetitionConfigurationProps) {
  const { isFeatureEnabled } = useFeatures();
  const trainingEnabled = isFeatureEnabled("training");
  const { memberships, isLoading: loadingMemberships } = useMemberships({
    initialParams: { include: "instances" },
  });

  const [activeTab, setActiveTab] = useState("general");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [initialPublishStatus, setInitialPublishStatus] = useState<PublishStatus>("DRAFT");

  // Data states
  const [levels, setLevels] = useState<Level[]>([]);
  const [loadingLevels, setLoadingLevels] = useState(true);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [loadingFacilities, setLoadingFacilities] = useState(true);
  const [waivers, setWaivers] = useState<Array<{ id: string; title: string; status: string }>>([]);
  const [loadingWaivers, setLoadingWaivers] = useState(true);
  // Form state
  const [formData, setFormData] = useState<CompetitionFormData>({
    name: "",
    color: "#3b82f6",
    facilityId: null,
    country: "",
    stateProvince: "",
    city: "",
    streetAddress: "",
    startDate: null,
    endDate: null,
    startTime: "09:00",
    endTime: "17:00",
    categoryMode: "ALL",
    selectedCategoryIds: [],
    hasLevelRestriction: false,
    levelRequirementIds: [],
    hasCapacityRestriction: false,
    capacity: null,
    hasAgeRestriction: false,
    minAge: null,
    maxAge: null,
    hasMembershipRestriction: false,
    membershipRequirementIds: [],
    hasWaiverRestriction: false,
    waiverRequirementIds: [],
    hasMedicalRequirement: false,
    hasFileRequirement: false,
    fileRequirementConfig: null,
    categoryResults: [],
    registrationOpen: true,
    registrationStartDate: "",
    registrationStartTime: "09:00",
    registrationEndDate: "",
    registrationEndTime: "23:59",
    earlyAccessCode: null,
    pricingMode: "FREE",
    entryFee: null,
    pricingTiers: [
      { minEvents: 1, maxEvents: 3, pricePerEvent: 20 },
      { minEvents: 4, maxEvents: null, pricePerEvent: 15 },
    ],
    categoryPrices: {},
    publishStatus: "DRAFT",
    scheduledGoLiveDate: null,
    scheduledGoLiveTime: "09:00",
  });

  // -- Initial Data Fetching --

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        const [compRes, levelsRes, facilitiesRes, waiversRes] = await Promise.all([
          fetch(`/api/competitions/${competitionId}`),
          trainingEnabled ? fetch("/api/levels") : Promise.resolve({ ok: true, json: () => [] }),
          fetch("/api/organization/facilities"),
          fetch("/api/waivers?status=ACTIVE"),
        ]);

        if (!compRes.ok) throw new Error("Failed to load competition");
        const compData = await compRes.json();

        if (levelsRes.ok) setLevels(await levelsRes.json());
        if (facilitiesRes.ok) {
          const facData = await facilitiesRes.json();
          setFacilities(Array.isArray(facData) ? facData : facData.facilities || []);
        }
        if (waiversRes.ok) {
          const wavData = await waiversRes.json();
          setWaivers(wavData.data || []);
        }

        // Reconstruct form data
        const categoryResults: CategoryResultConfig[] = (compData.categories || []).map(
          (cat: any) => ({
            combinationEntryId: cat.combinationEntryId || null,
            individualEntryId: cat.individualEntryId || null,
            label: cat.id,
            resultType: cat.resultType || "TIME",
            sortDirection: cat.sortDirection || "ASC",
            precision: cat.precision ?? 3,
            seedMarkRequired: cat.seedMarkRequired ?? false,
            submissionMode: cat.submissionMode || "NONE",
            qualifyingMark: cat.qualifyingMark ?? null,
            isTeamEvent: cat.isTeamEvent ?? false,
            teamSize: cat.teamSize ?? null,
            collectResults: true,
          })
        );

        const pricingTiers =
          (compData.pricingTiers || []).length > 0
            ? compData.pricingTiers.map((t: any) => ({
                minEvents: t.minEvents,
                maxEvents: t.maxEvents ?? null,
                pricePerEvent:
                  typeof t.pricePerEvent === "string"
                    ? parseFloat(t.pricePerEvent)
                    : t.pricePerEvent,
              }))
            : [
                { minEvents: 1, maxEvents: 3, pricePerEvent: 20 },
                { minEvents: 4, maxEvents: null, pricePerEvent: 15 },
              ];

        const categoryPrices: Record<string, number> = {};
        for (const cat of compData.categories || []) {
          if (cat.price != null) {
            const key = cat.combinationEntryId || cat.individualEntryId || "";
            if (key) {
              categoryPrices[key] =
                typeof cat.price === "string" ? parseFloat(cat.price) : cat.price;
            }
          }
        }

        const loadedPublishStatus: PublishStatus = compData.publishStatus || "DRAFT";
        setInitialPublishStatus(loadedPublishStatus);

        setFormData({
          name: compData.name || "",
          color: compData.color || "#3b82f6",
          facilityId: compData.facilityId || null,
          country: compData.country || "",
          stateProvince: compData.stateProvince || "",
          city: compData.city || "",
          streetAddress: compData.streetAddress || "",
          startDate: compData.startDate ? new Date(compData.startDate) : null,
          endDate: compData.endDate ? new Date(compData.endDate) : null,
          startTime: compData.startTime || "09:00",
          endTime: compData.endTime || "17:00",
          categoryMode: compData.categoryMode || "ALL",
          selectedCategoryIds: [],
          hasLevelRestriction: compData.hasLevelRestriction ?? false,
          levelRequirementIds: compData.levelRequirementIds || [],
          hasCapacityRestriction: compData.hasCapacityRestriction ?? false,
          capacity: compData.capacity ?? null,
          hasAgeRestriction: compData.hasAgeRestriction ?? false,
          minAge: compData.minAge ?? null,
          maxAge: compData.maxAge ?? null,
          hasMembershipRestriction: compData.hasMembershipRestriction ?? false,
          membershipRequirementIds: compData.membershipRequirementIds || [],
          hasWaiverRestriction: compData.hasWaiverRestriction ?? false,
          waiverRequirementIds: compData.waiverRequirementIds || [],
          hasMedicalRequirement: compData.hasMedicalRequirement ?? false,
          hasFileRequirement: compData.hasFileRequirement ?? false,
          fileRequirementConfig: compData.fileRequirementConfig ?? null,
          categoryResults,
          registrationOpen: compData.registrationOpen ?? true,
          registrationStartDate: compData.registrationStartDate
            ? new Date(compData.registrationStartDate).toISOString().split("T")[0]
            : compData.startDate
              ? new Date(compData.startDate).toISOString().split("T")[0]
              : "",
          registrationStartTime: compData.registrationStartTime || "09:00",
          registrationEndDate: compData.registrationEndDate
            ? new Date(compData.registrationEndDate).toISOString().split("T")[0]
            : compData.endDate
              ? new Date(compData.endDate).toISOString().split("T")[0]
              : "",
          registrationEndTime: compData.registrationEndTime || "23:59",
          earlyAccessCode: (compData.earlyAccessCode || null) as string | null,
          pricingMode: compData.pricingMode || "FREE",
          entryFee:
            compData.entryFee != null
              ? typeof compData.entryFee === "string"
                ? parseFloat(compData.entryFee)
                : compData.entryFee
              : null,
          pricingTiers,
          categoryPrices,
          publishStatus: loadedPublishStatus,
          scheduledGoLiveDate: compData.scheduledGoLiveDate
            ? new Date(compData.scheduledGoLiveDate)
            : null,
          scheduledGoLiveTime: compData.scheduledGoLiveTime || "09:00",
        });
      } catch (error) {
        console.error("Failed to load competition config:", error);
        toast.error("Failed to load competition data");
      } finally {
        setIsLoading(false);
        setLoadingLevels(false);
        setLoadingFacilities(false);
        setLoadingWaivers(false);
      }
    };
    fetchData();
  }, [competitionId, trainingEnabled]);

  // -- Helpers --

  const handleFacilityChange = (facilityId: string) => {
    if (facilityId === "__manual__") {
      setFormData((prev) => ({
        ...prev,
        facilityId: null,
        country: "",
        stateProvince: "",
        city: "",
        streetAddress: "",
      }));
      return;
    }
    const facility = facilities.find((f) => f.id === facilityId);
    if (facility) {
      setFormData((prev) => ({
        ...prev,
        facilityId: facility.id,
        country: facility.country || "",
        stateProvince: facility.stateProvince || "",
        city: facility.city || "",
        streetAddress: facility.street || "",
      }));
    }
  };

  const membershipInstances: MembershipInstance[] = useMemo(() => {
    if (!memberships) return [];
    return memberships.flatMap((group: any) =>
      (group.instances || []).map((inst: any) => ({
        id: inst.id,
        name: inst.name,
        price: inst.price ? Number(inst.price) : 0,
        groupName: group.name,
      }))
    );
  }, [memberships]);

  // -- Save Logic --

  const saveChanges = async (sectionName: string) => {
    const categoryResultsToSave = formData.categoryResults;

    setIsSaving(true);
    try {
      const payload = {
        name: formData.name,
        color: formData.color,
        facilityId: formData.facilityId,
        country: formData.country,
        stateProvince: formData.stateProvince,
        city: formData.city,
        streetAddress: formData.streetAddress,
        startDate: formData.startDate?.toISOString(),
        endDate: formData.endDate?.toISOString(),
        startTime: formData.startTime,
        endTime: formData.endTime,
        categoryMode: formData.categoryMode,
        selectedCategoryIds: formData.selectedCategoryIds,
        hasLevelRestriction: formData.hasLevelRestriction,
        levelRequirementIds: formData.levelRequirementIds,
        hasCapacityRestriction: formData.hasCapacityRestriction,
        capacity: formData.capacity,
        hasAgeRestriction: formData.hasAgeRestriction,
        minAge: formData.minAge,
        maxAge: formData.maxAge,
        hasMembershipRestriction: formData.hasMembershipRestriction,
        membershipRequirementIds: formData.membershipRequirementIds,
        hasWaiverRestriction: formData.hasWaiverRestriction,
        waiverRequirementIds: formData.waiverRequirementIds,
        hasMedicalRequirement: formData.hasMedicalRequirement,
        hasFileRequirement: formData.hasFileRequirement,
        fileRequirementConfig: formData.hasFileRequirement ? formData.fileRequirementConfig : null,
        categoryResults: categoryResultsToSave.map((c, i) => ({
          combinationEntryId: c.combinationEntryId,
          individualEntryId: c.individualEntryId,
          resultType: c.resultType,
          sortDirection: c.sortDirection,
          precision: c.precision,
          seedMarkRequired: c.seedMarkRequired,
          submissionMode: c.submissionMode,
          qualifyingMark: c.qualifyingMark,
          isTeamEvent: c.isTeamEvent,
          teamSize: c.teamSize,
          displayOrder: i,
        })),
        pricingMode: formData.pricingMode,
        entryFee: formData.entryFee,
        pricingTiers: formData.pricingMode === "TIERED" ? formData.pricingTiers : [],
        categoryPrices: formData.pricingMode === "PER_CATEGORY" ? formData.categoryPrices : {},
        registrationOpen: formData.registrationOpen,
        registrationStartDate:
          !formData.registrationOpen && formData.registrationStartDate
            ? formData.registrationStartDate
            : null,
        registrationStartTime: !formData.registrationOpen ? formData.registrationStartTime : null,
        registrationEndDate: formData.registrationEndDate || null,
        registrationEndTime: formData.registrationEndTime || null,
        earlyAccessCode: formData.earlyAccessCode,
        publishStatus: formData.publishStatus,
        scheduledGoLiveDate: formData.scheduledGoLiveDate?.toISOString(),
        scheduledGoLiveTime: formData.scheduledGoLiveTime,
      };

      const response = await fetch(`/api/competitions/${competitionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error("Failed to update competition");

      toast.success(`${sectionName} saved`);
      if (onUpdated) await onUpdated();
      onClose();
    } catch (error) {
      console.error("Save error:", error);
      toast.error("Failed to save changes");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <Loader2 className="h-6 w-6 animate-spin mx-auto" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="p-6 pb-2 border-b">
        <h2 className="text-xl font-semibold">{formData.name || "Configure Competition"}</h2>
        <p className="text-sm text-muted-foreground">Manage competition details and options.</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
        <div className="px-6 py-2 border-b bg-muted/30">
          <ResponsiveTabsList
            value={activeTab}
            onValueChange={setActiveTab}
            className="w-full justify-start"
          >
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="categories">Categories</TabsTrigger>
            <TabsTrigger value="restrictions">Restrictions</TabsTrigger>
            <TabsTrigger value="results">Results</TabsTrigger>
            <TabsTrigger value="pricing">Pricing</TabsTrigger>
            <TabsTrigger value="registration">Registration</TabsTrigger>
            <TabsTrigger value="publishing">Publishing</TabsTrigger>
          </ResponsiveTabsList>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {/* GENERAL TAB */}
          <TabsContent value="general" className="mt-0 space-y-6 max-w-2xl">
            <div className="space-y-2">
              <Label>Competition Name</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
              />
            </div>

            <ColorSelector
              value={formData.color}
              onChange={(color) => setFormData((prev) => ({ ...prev, color }))}
            />

            <div className="space-y-2">
              <Label>Facility</Label>
              <Select
                value={formData.facilityId || "__manual__"}
                onValueChange={handleFacilityChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select facility" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__manual__">Enter address manually</SelectItem>
                  {facilities.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !formData.startDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formData.startDate ? format(formData.startDate, "PPP") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={formData.startDate || undefined}
                      onSelect={(date) =>
                        setFormData((prev) => ({
                          ...prev,
                          startDate: date || null,
                          endDate:
                            prev.endDate && date && prev.endDate < date ? date : prev.endDate,
                        }))
                      }
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label>End Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !formData.endDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formData.endDate ? format(formData.endDate, "PPP") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={formData.endDate || undefined}
                      onSelect={(date) =>
                        setFormData((prev) => ({ ...prev, endDate: date || null }))
                      }
                      disabled={(date) => (formData.startDate ? date < formData.startDate : false)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </TabsContent>

          {/* CATEGORIES TAB */}
          <TabsContent value="categories" className="mt-0 space-y-6 max-w-3xl">
            <RadioGroup
              value={formData.categoryMode}
              onValueChange={(value: "ALL" | "SPECIFIC") => {
                setFormData((prev) => ({
                  ...prev,
                  categoryMode: value,
                  selectedCategoryIds: value === "ALL" ? [] : prev.selectedCategoryIds,
                }));
              }}
              className="space-y-4"
            >
              <label
                className={cn(
                  "flex items-start gap-4 rounded-lg border p-4 cursor-pointer transition-colors",
                  formData.categoryMode === "ALL"
                    ? "border-primary bg-primary/5"
                    : "hover:bg-muted/50"
                )}
              >
                <RadioGroupItem value="ALL" className="mt-1" />
                <div className="flex-1 space-y-1">
                  <span className="font-medium">All Eligible Categories</span>
                  <p className="text-sm text-muted-foreground">
                    Include all event/age combinations available for this competition
                  </p>
                </div>
              </label>
              <label
                className={cn(
                  "flex items-start gap-4 rounded-lg border p-4 cursor-pointer transition-colors",
                  formData.categoryMode === "SPECIFIC"
                    ? "border-primary bg-primary/5"
                    : "hover:bg-muted/50"
                )}
              >
                <RadioGroupItem value="SPECIFIC" className="mt-1" />
                <div className="flex-1 space-y-1">
                  <span className="font-medium">Specific Categories</span>
                  <p className="text-sm text-muted-foreground">
                    Manually select which event/age combinations to include
                  </p>
                </div>
              </label>
            </RadioGroup>
          </TabsContent>

          {/* RESTRICTIONS TAB */}
          <TabsContent value="restrictions" className="mt-0 space-y-6 max-w-2xl">
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
                      <div className="grid grid-cols-2 gap-3">
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
                            <div className="flex items-center gap-2">
                              {level.color && (
                                <div
                                  className="h-3 w-3 rounded-full"
                                  style={{ backgroundColor: level.color }}
                                />
                              )}
                              <span className="text-sm font-medium">{level.name}</span>
                            </div>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Capacity Limit */}
            <div className="rounded-lg border p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base font-medium">Capacity Limit</Label>
                  <p className="text-sm text-muted-foreground">
                    Set a maximum number of participants
                  </p>
                </div>
                <Switch
                  checked={formData.hasCapacityRestriction}
                  onCheckedChange={(checked) =>
                    setFormData((prev) => ({
                      ...prev,
                      hasCapacityRestriction: checked,
                      capacity: checked ? prev.capacity : null,
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
                    placeholder="e.g., 200"
                    value={formData.capacity ?? ""}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        capacity: e.target.value ? parseInt(e.target.value, 10) : null,
                      }))
                    }
                    className="mt-2 max-w-xs"
                  />
                </div>
              )}
            </div>

            {/* Age Restriction */}
            <div className="rounded-lg border p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base font-medium">Age Restriction</Label>
                  <p className="text-sm text-muted-foreground">
                    Restrict registration by age range
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
                <div className="pt-2 border-t">
                  <div className="grid grid-cols-2 gap-4 max-w-sm">
                    <div className="space-y-2">
                      <Label htmlFor="minAge">Minimum Age</Label>
                      <Input
                        id="minAge"
                        type="number"
                        min={0}
                        placeholder="e.g., 6"
                        value={formData.minAge ?? ""}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            minAge: e.target.value ? parseInt(e.target.value, 10) : null,
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
                        placeholder="e.g., 18"
                        value={formData.maxAge ?? ""}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            maxAge: e.target.value ? parseInt(e.target.value, 10) : null,
                          }))
                        }
                      />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    At least one of minimum or maximum age is required.
                  </p>
                </div>
              )}
            </div>

            {/* Membership Requirement */}
            <div className="rounded-lg border p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base font-medium">Membership Requirement</Label>
                  <p className="text-sm text-muted-foreground">
                    Require athletes to have an active membership
                  </p>
                </div>
                <Switch
                  checked={formData.hasMembershipRestriction}
                  onCheckedChange={(checked) =>
                    setFormData((prev) => ({
                      ...prev,
                      hasMembershipRestriction: checked,
                      membershipRequirementIds: checked ? prev.membershipRequirementIds : [],
                    }))
                  }
                />
              </div>

              {formData.hasMembershipRestriction && (
                <div className="pt-2 border-t">
                  {loadingMemberships ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading memberships...
                    </div>
                  ) : membershipInstances.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No memberships configured.{" "}
                      <a href="/dashboard/athletes/memberships" className="text-primary underline">
                        Create memberships
                      </a>{" "}
                      first.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 gap-3">
                      {membershipInstances.map((instance) => (
                        <label
                          key={instance.id}
                          className={cn(
                            "flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors",
                            formData.membershipRequirementIds.includes(instance.id)
                              ? "border-primary bg-primary/5"
                              : "hover:bg-muted/50"
                          )}
                        >
                          <Checkbox
                            checked={formData.membershipRequirementIds.includes(instance.id)}
                            onCheckedChange={(checked) => {
                              setFormData((prev) => ({
                                ...prev,
                                membershipRequirementIds: checked
                                  ? [...prev.membershipRequirementIds, instance.id]
                                  : prev.membershipRequirementIds.filter(
                                      (id) => id !== instance.id
                                    ),
                              }));
                            }}
                          />
                          <div>
                            <span className="text-sm font-medium">{instance.name}</span>
                            <span className="text-xs text-muted-foreground ml-1">
                              ({instance.groupName})
                            </span>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Waiver Requirement */}
            <div className="rounded-lg border p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base font-medium">Waiver Requirement</Label>
                  <p className="text-sm text-muted-foreground">
                    Require participants to sign a waiver before registering
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
                      <a href="/dashboard/athletes/waivers" className="text-primary underline">
                        Create a waiver
                      </a>{" "}
                      first.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 gap-3">
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
                          <span className="text-sm font-medium">{waiver.title}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Medical Information Requirement */}
            <div className="rounded-lg border p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base font-medium">Medical Information Requirement</Label>
                  <p className="text-sm text-muted-foreground">
                    Require athletes to have medical information on file
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
                    <Info className="h-4 w-4" />
                    <span>
                      Configure medical form fields in{" "}
                      <a href="/dashboard/athletes/medical" className="text-primary underline">
                        Medical Settings
                      </a>
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* File Upload Requirement */}
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label className="text-base font-medium">File Upload Requirement</Label>
                <p className="text-sm text-muted-foreground">
                  Require athletes to upload a file during registration (e.g. routine music)
                </p>
              </div>
              <Switch
                checked={formData.hasFileRequirement}
                onCheckedChange={(checked) =>
                  setFormData((prev) => ({
                    ...prev,
                    hasFileRequirement: checked,
                    fileRequirementConfig:
                      checked && !prev.fileRequirementConfig
                        ? { label: "", acceptedPresets: [], acceptedExtensions: [] }
                        : prev.fileRequirementConfig,
                  }))
                }
              />
            </div>

            {formData.hasFileRequirement && formData.fileRequirementConfig && (
              <div className="pt-2 border-t">
                <FileRequirementConfigEditor
                  config={formData.fileRequirementConfig}
                  onChange={(config) =>
                    setFormData((prev) => ({ ...prev, fileRequirementConfig: config }))
                  }
                />
              </div>
            )}
          </TabsContent>

          {/* RESULTS TAB */}
          <TabsContent value="results" className="mt-0 space-y-6 max-w-2xl">
            {formData.categoryResults.length === 0 ? (
              <div className="text-center p-8 text-muted-foreground border border-dashed rounded-lg">
                No categories configured yet.
              </div>
            ) : (
              <div className="space-y-4">
                <Label>Seed Marks & Result Collection</Label>
                <div className="border rounded-lg divide-y max-h-[400px] overflow-y-auto">
                  {formData.categoryResults.map((cat, idx) => (
                    <div key={idx} className="p-3 flex flex-col gap-2">
                      <div className="font-medium text-sm">{cat.label}</div>
                      <div className="flex gap-4">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            checked={cat.seedMarkRequired}
                            onCheckedChange={(checked) => {
                              setFormData((prev) => ({
                                ...prev,
                                categoryResults: prev.categoryResults.map((c, i) =>
                                  i === idx
                                    ? {
                                        ...c,
                                        seedMarkRequired: !!checked,
                                        submissionMode: checked ? "MANUAL_ENTRY" : "NONE",
                                      }
                                    : c
                                ),
                              }));
                            }}
                          />
                          <span className="text-xs">Require Seed</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Checkbox
                            checked={cat.collectResults}
                            onCheckedChange={(checked) => {
                              setFormData((prev) => ({
                                ...prev,
                                categoryResults: prev.categoryResults.map((c, i) =>
                                  i === idx ? { ...c, collectResults: !!checked } : c
                                ),
                              }));
                            }}
                          />
                          <span className="text-xs">Record Results</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>

          {/* PRICING TAB */}
          <TabsContent value="pricing" className="mt-0 space-y-6 max-w-2xl">
            <RadioGroup
              value={formData.pricingMode}
              onValueChange={(val: any) => setFormData((prev) => ({ ...prev, pricingMode: val }))}
              className="grid grid-cols-2 gap-4"
            >
              {["FREE", "PER_COMPETITION", "PER_EVENT", "TIERED", "PER_CATEGORY"].map((mode) => (
                <label
                  key={mode}
                  className={cn(
                    "border rounded-lg p-4 cursor-pointer hover:bg-muted/50",
                    formData.pricingMode === mode && "border-primary bg-primary/5"
                  )}
                >
                  <RadioGroupItem value={mode} className="sr-only" />
                  <span className="font-medium text-sm">{mode.replace("_", " ")}</span>
                </label>
              ))}
            </RadioGroup>

            {(formData.pricingMode === "PER_COMPETITION" ||
              formData.pricingMode === "PER_EVENT") && (
              <div className="space-y-2">
                <Label>Price Amount</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="number"
                    className="pl-9"
                    value={formData.entryFee || ""}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        entryFee: parseFloat(e.target.value) || 0,
                      }))
                    }
                  />
                </div>
              </div>
            )}

            {formData.pricingMode === "PER_CATEGORY" && (
              <div className="space-y-2 border rounded-lg p-4 max-h-[300px] overflow-y-auto">
                {formData.categoryResults.map((cat, idx) => {
                  const key = `cat-${idx}`;
                  return (
                    <div key={key} className="flex justify-between items-center text-sm">
                      <span>{cat.label}</span>
                      <Input
                        type="number"
                        className="w-24 h-8"
                        placeholder="0.00"
                        value={formData.categoryPrices[key] || ""}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            categoryPrices: {
                              ...prev.categoryPrices,
                              [key]: parseFloat(e.target.value) || 0,
                            },
                          }))
                        }
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* REGISTRATION TAB */}
          <TabsContent value="registration" className="mt-0 space-y-6 max-w-2xl">
            {/* Registration Availability */}
            <div className="space-y-4">
              <Label className="text-base font-medium flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-muted-foreground" />
                Registration Availability
              </Label>
              <RadioGroup
                value={formData.registrationOpen ? "now" : "scheduled"}
                onValueChange={(value) => {
                  const isNow = value === "now";
                  setFormData((prev) => ({
                    ...prev,
                    registrationOpen: isNow,
                    registrationStartDate: isNow ? "" : prev.registrationStartDate,
                  }));
                }}
                className="space-y-3"
              >
                <label
                  className={cn(
                    "flex items-start gap-4 rounded-lg border p-4 cursor-pointer transition-colors",
                    formData.registrationOpen ? "border-primary bg-primary/5" : "hover:bg-muted/50"
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
                    !formData.registrationOpen ? "border-primary bg-primary/5" : "hover:bg-muted/50"
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

            {/* Registration Opens */}
            {!formData.registrationOpen && (
              <div className="space-y-4">
                <Label className="text-base font-medium">Registration Opens</Label>
                <p className="text-sm text-muted-foreground">
                  Set when registration becomes available. Must be on or before the first day of the
                  competition{formData.startDate ? ` (${format(formData.startDate, "PPP")})` : ""}.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Open Date</Label>
                    <Input
                      type="date"
                      value={formData.registrationStartDate}
                      max={
                        formData.startDate
                          ? formData.startDate.toISOString().split("T")[0]
                          : undefined
                      }
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, registrationStartDate: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Open Time</Label>
                    <Input
                      type="time"
                      value={formData.registrationStartTime}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, registrationStartTime: e.target.value }))
                      }
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Registration End Date */}
            <div className="space-y-4">
              <Label className="text-base font-medium">Registration Closes</Label>
              <p className="text-sm text-muted-foreground">
                Set when registration closes. Defaults to the competition end date if not specified.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Close Date</Label>
                  <Input
                    type="date"
                    value={formData.registrationEndDate}
                    min={
                      !formData.registrationOpen && formData.registrationStartDate
                        ? formData.registrationStartDate
                        : new Date().toISOString().split("T")[0]
                    }
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, registrationEndDate: e.target.value }))
                    }
                    placeholder={
                      formData.endDate ? formData.endDate.toISOString().split("T")[0] : ""
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Close Time</Label>
                  <Input
                    type="time"
                    value={formData.registrationEndTime}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, registrationEndTime: e.target.value }))
                    }
                  />
                </div>
              </div>
            </div>

            {/* Early Access Code */}
            <div className="space-y-4">
              <Label className="text-base font-medium flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-muted-foreground" />
                Early Access Code
              </Label>
              <p className="text-sm text-muted-foreground">
                Generate or enter a code that allows registration before the registration window
                opens
              </p>
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Enter or generate a code"
                  value={formData.earlyAccessCode || ""}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, earlyAccessCode: e.target.value || null }))
                  }
                  className="max-w-[300px]"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    const code = crypto.randomUUID().slice(0, 8).toUpperCase();
                    setFormData((prev) => ({ ...prev, earlyAccessCode: code }));
                  }}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Generate
                </Button>
              </div>

              {formData.earlyAccessCode && (
                <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <Link2 className="h-4 w-4" />
                    Early Access Link
                  </Label>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-sm bg-background px-3 py-2 rounded border break-all">
                      {typeof window !== "undefined" ? `${window.location.origin}` : ""}
                      /competitions/{competitionId}?code={formData.earlyAccessCode}
                    </code>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const url = `${window.location.origin}/competitions/${competitionId}?code=${formData.earlyAccessCode}`;
                        navigator.clipboard.writeText(url);
                        toast.success("Link copied to clipboard");
                      }}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Share this link with athletes who should have early access to registration
                  </p>
                </div>
              )}
            </div>
          </TabsContent>

          {/* PUBLISHING TAB */}
          <TabsContent value="publishing" className="mt-0 space-y-6 max-w-2xl">
            {initialPublishStatus === "LIVE" ? (
              <>
                <p className="text-sm text-muted-foreground">
                  This competition is currently live. You can close registration or mark it as
                  completed.
                </p>
                <RadioGroup
                  value={formData.publishStatus}
                  onValueChange={(val: any) =>
                    setFormData((prev) => ({ ...prev, publishStatus: val }))
                  }
                  className="space-y-3"
                >
                  <label
                    className={cn(
                      "flex items-center gap-3 border p-4 rounded-lg cursor-pointer",
                      formData.publishStatus === "LIVE" && "border-primary"
                    )}
                  >
                    <RadioGroupItem value="LIVE" />
                    <div>
                      <div className="font-medium">Live</div>
                      <div className="text-xs text-muted-foreground">
                        Visible and open for registration
                      </div>
                    </div>
                  </label>
                  <label
                    className={cn(
                      "flex items-center gap-3 border p-4 rounded-lg cursor-pointer",
                      formData.publishStatus === "CLOSED" && "border-primary"
                    )}
                  >
                    <RadioGroupItem value="CLOSED" />
                    <div>
                      <div className="font-medium">Closed</div>
                      <div className="text-xs text-muted-foreground">
                        Registration closed, competition still visible
                      </div>
                    </div>
                  </label>
                  <label
                    className={cn(
                      "flex items-center gap-3 border p-4 rounded-lg cursor-pointer",
                      formData.publishStatus === "COMPLETED" && "border-primary"
                    )}
                  >
                    <RadioGroupItem value="COMPLETED" />
                    <div>
                      <div className="font-medium">Completed</div>
                      <div className="text-xs text-muted-foreground">Competition is finished</div>
                    </div>
                  </label>
                </RadioGroup>
              </>
            ) : initialPublishStatus === "CLOSED" || initialPublishStatus === "COMPLETED" ? (
              <>
                <p className="text-sm text-muted-foreground">
                  This competition has been{" "}
                  {initialPublishStatus === "CLOSED" ? "closed" : "completed"}. You can change its
                  final status below.
                </p>
                <RadioGroup
                  value={formData.publishStatus}
                  onValueChange={(val: any) =>
                    setFormData((prev) => ({ ...prev, publishStatus: val }))
                  }
                  className="space-y-3"
                >
                  <label
                    className={cn(
                      "flex items-center gap-3 border p-4 rounded-lg cursor-pointer",
                      formData.publishStatus === "CLOSED" && "border-primary"
                    )}
                  >
                    <RadioGroupItem value="CLOSED" />
                    <div>
                      <div className="font-medium">Closed</div>
                      <div className="text-xs text-muted-foreground">
                        Registration closed, competition still visible
                      </div>
                    </div>
                  </label>
                  <label
                    className={cn(
                      "flex items-center gap-3 border p-4 rounded-lg cursor-pointer",
                      formData.publishStatus === "COMPLETED" && "border-primary"
                    )}
                  >
                    <RadioGroupItem value="COMPLETED" />
                    <div>
                      <div className="font-medium">Completed</div>
                      <div className="text-xs text-muted-foreground">Competition is finished</div>
                    </div>
                  </label>
                </RadioGroup>
              </>
            ) : (
              <>
                <RadioGroup
                  value={formData.publishStatus}
                  onValueChange={(val: any) =>
                    setFormData((prev) => ({ ...prev, publishStatus: val }))
                  }
                  className="space-y-3"
                >
                  <label
                    className={cn(
                      "flex items-center gap-3 border p-4 rounded-lg cursor-pointer",
                      formData.publishStatus === "DRAFT" && "border-primary"
                    )}
                  >
                    <RadioGroupItem value="DRAFT" />
                    <div>
                      <div className="font-medium">Draft</div>
                      <div className="text-xs text-muted-foreground">Hidden from public</div>
                    </div>
                  </label>
                  <label
                    className={cn(
                      "flex items-center gap-3 border p-4 rounded-lg cursor-pointer",
                      formData.publishStatus === "LIVE" && "border-primary"
                    )}
                  >
                    <RadioGroupItem value="LIVE" />
                    <div>
                      <div className="font-medium">Live</div>
                      <div className="text-xs text-muted-foreground">
                        Visible and open for registration
                      </div>
                    </div>
                  </label>
                  <label
                    className={cn(
                      "flex items-center gap-3 border p-4 rounded-lg cursor-pointer",
                      formData.publishStatus === "SCHEDULED" && "border-primary"
                    )}
                  >
                    <RadioGroupItem value="SCHEDULED" />
                    <div>
                      <div className="font-medium">Scheduled</div>
                      <div className="text-xs text-muted-foreground">Go live at specific time</div>
                    </div>
                  </label>
                  <label
                    className={cn(
                      "flex items-center gap-3 border p-4 rounded-lg cursor-pointer",
                      formData.publishStatus === "CLOSED" && "border-primary"
                    )}
                  >
                    <RadioGroupItem value="CLOSED" />
                    <div>
                      <div className="font-medium">Closed</div>
                      <div className="text-xs text-muted-foreground">
                        Registration closed, competition still visible
                      </div>
                    </div>
                  </label>
                  <label
                    className={cn(
                      "flex items-center gap-3 border p-4 rounded-lg cursor-pointer",
                      formData.publishStatus === "COMPLETED" && "border-primary"
                    )}
                  >
                    <RadioGroupItem value="COMPLETED" />
                    <div>
                      <div className="font-medium">Completed</div>
                      <div className="text-xs text-muted-foreground">Competition is finished</div>
                    </div>
                  </label>
                </RadioGroup>

                {formData.publishStatus === "SCHEDULED" && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Date</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !formData.scheduledGoLiveDate && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {formData.scheduledGoLiveDate
                              ? format(formData.scheduledGoLiveDate, "PPP")
                              : "Pick a date"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <CalendarComponent
                            mode="single"
                            selected={formData.scheduledGoLiveDate || undefined}
                            onSelect={(date) =>
                              setFormData((prev) => ({
                                ...prev,
                                scheduledGoLiveDate: date || null,
                              }))
                            }
                            disabled={(date) => date < new Date()}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="space-y-2">
                      <Label>Time</Label>
                      <Input
                        type="time"
                        value={formData.scheduledGoLiveTime}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, scheduledGoLiveTime: e.target.value }))
                        }
                      />
                    </div>
                  </div>
                )}
              </>
            )}
          </TabsContent>
        </div>
      </Tabs>

      <div className="p-4 border-t flex justify-end gap-2 bg-background">
        <Button variant="outline" onClick={onClose}>
          Close
        </Button>
        <Button onClick={() => saveChanges("Competition")} disabled={isSaving}>
          {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save Changes
        </Button>
      </div>
    </div>
  );
}
