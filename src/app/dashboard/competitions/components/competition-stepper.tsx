"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
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
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
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
  ChevronsUpDown,
  Loader2,
  Users,
  Layers,
  CreditCard,
  Trophy,
  MapPin,
  Clock,
  CalendarDays,
  Info,
  Heart,
  Shield,
  Tag,
  BarChart3,
  Settings,
  DollarSign,
  Plus,
  Trash2,
  Copy,
  Link2,
  KeyRound,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { GLCodeSelector } from "@/components/gl-code-selector";
import { FileRequirementConfigEditor } from "@/components/ui/file-requirement-config";
import type { FileRequirementConfig } from "@/types/file-requirements";
import { useFeatures } from "@/components/feature-context";
import { useMemberships } from "@/hooks/use-memberships";
import { useSeasons } from "@/hooks/use-seasons";
import { SeasonDateWarning } from "@/components/season-date-warning";
import { cn } from "@/lib/utils";
import { CopySettingsDialog } from "@/components/copy-settings-dialog";
import { ColorSelector } from "@/components/color-selector";
import { useCategories } from "@/hooks/use-categories";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { format } from "date-fns";
import { COUNTRIES, getRegionsForCountry, isValidPostalCode } from "@/lib/location-data";

interface OrgSport {
  id: string;
  name: string;
  slug: string;
}

type PublishStatus = "LIVE" | "DRAFT" | "SCHEDULED";

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
  postalCode: string | null;
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
  sportEventId: string | null;
  ageCategoryId: string | null;
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

interface SportEventEntry {
  id: string;
  code: string;
  name: string;
  eventGroup: string;
  eventType: string;
  resultType: ResultType;
  sortDirection: SortDir;
  defaultPrecision: number;
  isActive: boolean;
  displayOrder: number;
  eligibility?: Array<{
    id: string;
    sportEventId: string;
    ageCategoryId: string;
    isEnabled: boolean;
    ageCategory: { id: string; code: string; name: string };
  }>;
}

interface SportAgeCategoryEntry {
  id: string;
  code: string;
  name: string;
  minAge: number;
  maxAge: number | null;
  isActive: boolean;
  displayOrder: number;
}

const EVENT_GROUP_LABELS: Record<string, string> = {
  sprints: "Sprints",
  hurdles: "Hurdles",
  middle_distance: "Middle Distance",
  distance: "Distance",
  relays: "Relays",
  jumps: "Jumps",
  throws: "Throws",
  combined: "Combined Events",
  racewalk: "Race Walk",
  road: "Road",
};

interface CompetitionFormData {
  // Season (optional first step)
  seasonId: string | null;

  // Category
  categoryId: string | null;

  // Step 1: General
  name: string;
  color: string;
  facilityId: string | null;
  country: string;
  stateProvince: string;
  city: string;
  streetAddress: string;
  postalCode: string;
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

  // Step 5: Pricing
  pricingMode: "FREE" | "PER_COMPETITION" | "PER_EVENT" | "TIERED" | "PER_CATEGORY";
  entryFee: number | null;
  pricingTiers: Array<{ minEvents: number; maxEvents: number | null; pricePerEvent: number }>;
  categoryPrices: Record<string, number>;

  // Step 6: Confirmation
  publishStatus: PublishStatus;
  scheduledGoLiveDate: Date | null;
  scheduledGoLiveTime: string;

  // Registration
  registrationOpen: boolean;
  registrationStartDate: Date | null;
  registrationStartTime: string;
  registrationEndDate: Date | null;
  registrationEndTime: string;
  earlyAccessCode: string | null;

  // GL Code
  glCodeId: string | null;
}

interface CompetitionStepperProps {
  competitionId?: string | null;
  embedded?: boolean;
  onSaved?: (competition: any) => void;
  onCancel?: () => void;
}

const { useStepper } = defineStepper(
  { id: "season", title: "Season" },
  { id: "general", title: "General" },
  { id: "categories", title: "Categories" },
  { id: "restrictions", title: "Restrictions" },
  { id: "results", title: "Results" },
  { id: "pricing", title: "Pricing" },
  { id: "registration", title: "Registration" },
  { id: "confirmation", title: "Confirmation" }
);

export function CompetitionStepper({
  competitionId,
  embedded = false,
  onSaved,
  onCancel,
}: CompetitionStepperProps) {
  const router = useRouter();
  const isEditing = !!competitionId;
  const { isFeatureEnabled } = useFeatures();
  const trainingEnabled = isFeatureEnabled("training");
  const membershipsEnabled = isFeatureEnabled("memberships");
  const seasonsEnabled = isFeatureEnabled("seasons");

  const { memberships, isLoading: loadingMemberships } = useMemberships({
    initialParams: { include: "instances" },
  });
  const { seasons, isLoading: seasonsLoading } = useSeasons({ autoFetch: seasonsEnabled });
  const { categories, isLoading: categoriesLoading } = useCategories();

  // Levels state
  const [levels, setLevels] = React.useState<Level[]>([]);
  const [loadingLevels, setLoadingLevels] = React.useState(true);

  // Facilities state
  const [facilities, setFacilities] = React.useState<Facility[]>([]);
  const [loadingFacilities, setLoadingFacilities] = React.useState(true);

  // Waivers state
  const [waivers, setWaivers] = React.useState<
    Array<{ id: string; title: string; status: string }>
  >([]);
  const [loadingWaivers, setLoadingWaivers] = React.useState(true);

  // Organization sports state
  const [orgSports, setOrgSports] = React.useState<OrgSport[]>([]);

  // Sport-specific structured data for categories step
  const [sportEvents, setSportEvents] = React.useState<SportEventEntry[]>([]);
  const [sportAgeCategories, setSportAgeCategories] = React.useState<SportAgeCategoryEntry[]>([]);
  const [eligibilitySet, setEligibilitySet] = React.useState<Set<string>>(new Set());
  const [loadingSportData, setLoadingSportData] = React.useState(false);
  const [hasSportSpecificData, setHasSportSpecificData] = React.useState(false);

  // selectedCombos: Set of "eventId:ageCategoryId" keys the user picked
  const [selectedCombos, setSelectedCombos] = React.useState<Set<string>>(new Set());

  // Location field validation errors
  const [locationErrors, setLocationErrors] = React.useState<Record<string, string>>({});
  const [stateProvinceOpen, setStateProvinceOpen] = React.useState(false);

  // Form state
  const [formData, setFormData] = React.useState<CompetitionFormData>({
    // Season
    seasonId: null,

    // Category
    categoryId: null,

    // Step 1: General
    name: "",
    color: "#3b82f6",
    facilityId: null,
    country: "",
    stateProvince: "",
    city: "",
    streetAddress: "",
    postalCode: "",
    startDate: null,
    endDate: null,
    startTime: "09:00",
    endTime: "17:00",

    // Step 2: Categories
    categoryMode: "ALL",
    selectedCategoryIds: [],

    // Step 3: Restrictions
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

    // Step 4: Results
    categoryResults: [],

    // Step 5: Pricing
    pricingMode: "FREE",
    entryFee: null,
    pricingTiers: [
      { minEvents: 1, maxEvents: 3, pricePerEvent: 20 },
      { minEvents: 4, maxEvents: null, pricePerEvent: 15 },
    ],
    categoryPrices: {},

    // Registration
    registrationOpen: true,
    registrationStartDate: null,
    registrationStartTime: "09:00",
    registrationEndDate: null,
    registrationEndTime: "23:59",
    earlyAccessCode: null,

    // Step 7: Confirmation
    publishStatus: "DRAFT",
    scheduledGoLiveDate: null,
    scheduledGoLiveTime: "09:00",

    // GL Code
    glCodeId: null,
  });

  const showSeasonStep = seasonsEnabled && (seasons.length > 0 || seasonsLoading);
  const selectedSeason = React.useMemo(() => {
    if (!formData.seasonId) return null;
    return seasons.find((s) => s.id === formData.seasonId) ?? null;
  }, [formData.seasonId, seasons]);

  const [isSaving, setIsSaving] = React.useState(false);
  const [loadingCompetition, setLoadingCompetition] = React.useState(!!competitionId);
  const [copyDialogOpen, setCopyDialogOpen] = React.useState(false);
  const stepper = useStepper();

  const handleCopyFromCompetition = React.useCallback(async (sourceId: string) => {
    try {
      const response = await fetch(`/api/competitions/${sourceId}`);
      if (!response.ok) throw new Error("Failed to fetch competition");
      const data = await response.json();

      const categoryResults: CategoryResultConfig[] = (data.categories || []).map((cat: any) => ({
        combinationEntryId: cat.combinationEntryId || null,
        individualEntryId: cat.individualEntryId || null,
        sportEventId: cat.sportEventId || null,
        ageCategoryId: cat.ageCategoryId || null,
        label: [cat.sportEvent?.name, cat.ageCategory?.code].filter(Boolean).join(" - ") || cat.id,
        resultType: cat.resultType || "TIME",
        sortDirection: cat.sortDirection || "ASC",
        precision: cat.precision ?? 3,
        seedMarkRequired: cat.seedMarkRequired ?? false,
        submissionMode: cat.submissionMode || "NONE",
        qualifyingMark: cat.qualifyingMark ?? null,
        isTeamEvent: cat.isTeamEvent ?? false,
        teamSize: cat.teamSize ?? null,
        collectResults: true,
      }));

      const combos = new Set<string>();
      for (const cat of data.categories || []) {
        if (cat.sportEventId && cat.ageCategoryId) {
          combos.add(`${cat.sportEventId}:${cat.ageCategoryId}`);
        }
      }
      setSelectedCombos(combos);

      const pricingTiers =
        (data.pricingTiers || []).length > 0
          ? data.pricingTiers.map((t: any) => ({
              minEvents: t.minEvents,
              maxEvents: t.maxEvents ?? null,
              pricePerEvent:
                typeof t.pricePerEvent === "string" ? parseFloat(t.pricePerEvent) : t.pricePerEvent,
            }))
          : [
              { minEvents: 1, maxEvents: 3, pricePerEvent: 20 },
              { minEvents: 4, maxEvents: null, pricePerEvent: 15 },
            ];

      const categoryPrices: Record<string, number> = {};
      for (const cat of data.categories || []) {
        if (cat.price != null) {
          const key =
            cat.sportEventId && cat.ageCategoryId
              ? `${cat.sportEventId}:${cat.ageCategoryId}`
              : cat.combinationEntryId || cat.individualEntryId || "";
          if (key) {
            categoryPrices[key] = typeof cat.price === "string" ? parseFloat(cat.price) : cat.price;
          }
        }
      }

      setFormData((prev) => ({
        ...prev,
        color: data.color || "#3b82f6",
        facilityId: data.facilityId || null,
        country: data.country || "",
        stateProvince: data.stateProvince || "",
        city: data.city || "",
        streetAddress: data.streetAddress || "",
        postalCode: data.postalCode || "",
        startDate: data.startDate ? new Date(data.startDate) : null,
        endDate: data.endDate ? new Date(data.endDate) : null,
        startTime: data.startTime || "09:00",
        endTime: data.endTime || "17:00",
        categoryMode: data.categoryMode || "ALL",
        selectedCategoryIds: [],
        hasLevelRestriction: data.hasLevelRestriction ?? false,
        levelRequirementIds: data.levelRequirementIds || [],
        hasCapacityRestriction: data.hasCapacityRestriction ?? false,
        capacity: data.capacity ?? null,
        hasAgeRestriction: data.hasAgeRestriction ?? false,
        minAge: data.minAge ?? null,
        maxAge: data.maxAge ?? null,
        hasMembershipRestriction: data.hasMembershipRestriction ?? false,
        membershipRequirementIds: data.membershipRequirementIds || [],
        hasWaiverRestriction: data.hasWaiverRestriction ?? false,
        waiverRequirementIds: data.waiverRequirementIds || [],
        hasMedicalRequirement: data.hasMedicalRequirement ?? false,
        hasFileRequirement: data.hasFileRequirement ?? false,
        fileRequirementConfig: data.fileRequirementConfig ?? null,
        categoryResults,
        pricingMode: data.pricingMode || "FREE",
        entryFee:
          data.entryFee != null
            ? typeof data.entryFee === "string"
              ? parseFloat(data.entryFee)
              : data.entryFee
            : null,
        pricingTiers,
        categoryPrices,
        registrationOpen: data.registrationOpen ?? true,
        registrationStartDate: data.registrationStartDate
          ? new Date(data.registrationStartDate)
          : null,
        registrationStartTime: data.registrationStartTime || "09:00",
        registrationEndDate: data.registrationEndDate ? new Date(data.registrationEndDate) : null,
        registrationEndTime: data.registrationEndTime || "23:59",
        earlyAccessCode: data.earlyAccessCode || null,
        publishStatus: "DRAFT",
        scheduledGoLiveDate: null,
        scheduledGoLiveTime: "09:00",
        seasonId: data.seasonId || null,
      }));

      toast.success(`Settings copied from "${data.name}"`);
    } catch (error) {
      console.error("Failed to copy competition settings:", error);
      toast.error("Failed to copy competition settings");
      throw error;
    }
  }, []);

  // Fetch existing competition data when editing
  React.useEffect(() => {
    if (!competitionId) return;
    const fetchCompetition = async () => {
      try {
        const response = await fetch(`/api/competitions/${competitionId}`);
        if (!response.ok) {
          toast.error("Failed to load competition");
          return;
        }
        const data = await response.json();

        // Build categoryResults from the API categories
        const categoryResults: CategoryResultConfig[] = (data.categories || []).map((cat: any) => ({
          combinationEntryId: cat.combinationEntryId || null,
          individualEntryId: cat.individualEntryId || null,
          sportEventId: cat.sportEventId || null,
          ageCategoryId: cat.ageCategoryId || null,
          label:
            [cat.sportEvent?.name, cat.ageCategory?.code].filter(Boolean).join(" - ") || cat.id,
          resultType: cat.resultType || "TIME",
          sortDirection: cat.sortDirection || "ASC",
          precision: cat.precision ?? 3,
          seedMarkRequired: cat.seedMarkRequired ?? false,
          submissionMode: cat.submissionMode || "NONE",
          qualifyingMark: cat.qualifyingMark ?? null,
          isTeamEvent: cat.isTeamEvent ?? false,
          teamSize: cat.teamSize ?? null,
          collectResults: true,
        }));

        // Rebuild selectedCombos from categories
        const combos = new Set<string>();
        for (const cat of data.categories || []) {
          if (cat.sportEventId && cat.ageCategoryId) {
            combos.add(`${cat.sportEventId}:${cat.ageCategoryId}`);
          }
        }
        setSelectedCombos(combos);

        // Build pricing tiers
        const pricingTiers =
          (data.pricingTiers || []).length > 0
            ? data.pricingTiers.map((t: any) => ({
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

        // Build per-category prices from categories that have a price
        const categoryPrices: Record<string, number> = {};
        for (const cat of data.categories || []) {
          if (cat.price != null) {
            const key =
              cat.sportEventId && cat.ageCategoryId
                ? `${cat.sportEventId}:${cat.ageCategoryId}`
                : cat.combinationEntryId || cat.individualEntryId || "";
            if (key) {
              categoryPrices[key] =
                typeof cat.price === "string" ? parseFloat(cat.price) : cat.price;
            }
          }
        }

        setFormData({
          seasonId: data.seasonId || null,
          name: data.name || "",
          color: data.color || "#3b82f6",
          facilityId: data.facilityId || null,
          country: data.country || "",
          stateProvince: data.stateProvince || "",
          city: data.city || "",
          streetAddress: data.streetAddress || "",
          postalCode: data.postalCode || "",
          startDate: data.startDate ? new Date(data.startDate) : null,
          endDate: data.endDate ? new Date(data.endDate) : null,
          startTime: data.startTime || "09:00",
          endTime: data.endTime || "17:00",

          categoryMode: data.categoryMode || "ALL",
          selectedCategoryIds: [],

          hasLevelRestriction: data.hasLevelRestriction ?? false,
          levelRequirementIds: data.levelRequirementIds || [],
          hasCapacityRestriction: data.hasCapacityRestriction ?? false,
          capacity: data.capacity ?? null,
          hasAgeRestriction: data.hasAgeRestriction ?? false,
          minAge: data.minAge ?? null,
          maxAge: data.maxAge ?? null,
          hasMembershipRestriction: data.hasMembershipRestriction ?? false,
          membershipRequirementIds: data.membershipRequirementIds || [],
          hasWaiverRestriction: data.hasWaiverRestriction ?? false,
          waiverRequirementIds: data.waiverRequirementIds || [],
          hasMedicalRequirement: data.hasMedicalRequirement ?? false,
          hasFileRequirement: data.hasFileRequirement ?? false,
          fileRequirementConfig: data.fileRequirementConfig ?? null,

          categoryResults,

          pricingMode: data.pricingMode || "FREE",
          entryFee:
            data.entryFee != null
              ? typeof data.entryFee === "string"
                ? parseFloat(data.entryFee)
                : data.entryFee
              : null,
          pricingTiers,
          categoryPrices,

          registrationOpen: data.registrationOpen ?? true,
          registrationStartDate: data.registrationStartDate
            ? new Date(data.registrationStartDate)
            : null,
          registrationStartTime: data.registrationStartTime || "09:00",
          registrationEndDate: data.registrationEndDate ? new Date(data.registrationEndDate) : null,
          registrationEndTime: data.registrationEndTime || "23:59",
          earlyAccessCode: data.earlyAccessCode || null,

          publishStatus: data.publishStatus || "DRAFT",
          scheduledGoLiveDate: data.scheduledGoLiveDate ? new Date(data.scheduledGoLiveDate) : null,
          scheduledGoLiveTime: data.scheduledGoLiveTime || "09:00",
          glCodeId: data.glCodeId || null,
          categoryId: data.categoryId || null,
        });
      } catch (error) {
        console.error("Failed to load competition:", error);
        toast.error("Failed to load competition data");
      } finally {
        setLoadingCompetition(false);
      }
    };
    fetchCompetition();
  }, [competitionId]);

  // Fetch levels
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
    if (trainingEnabled) fetchLevels();
    else setLoadingLevels(false);
  }, [trainingEnabled]);

  // Fetch facilities
  React.useEffect(() => {
    const fetchFacilities = async () => {
      try {
        const response = await fetch("/api/organization/facilities");
        if (response.ok) {
          const data = await response.json();
          setFacilities(Array.isArray(data) ? data : data.facilities || []);
        }
      } catch (error) {
        console.error("Failed to fetch facilities:", error);
      } finally {
        setLoadingFacilities(false);
      }
    };
    fetchFacilities();
  }, []);

  // Fetch waivers
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

  // Fetch organization sports
  React.useEffect(() => {
    const fetchOrgSports = async () => {
      try {
        const response = await fetch("/api/organization/sports");
        if (response.ok) {
          const data: OrgSport[] = await response.json();
          setOrgSports(data);
        }
      } catch (error) {
        console.error("Failed to fetch org sports:", error);
      }
    };
    fetchOrgSports();
  }, []);

  // Fetch sport-specific structured data for the categories step.
  // Twizzle is skating-only, so we always use the org's first sport (typically
  // Figure Skating) — the previous competitionType-keyed lookup was deleted
  // along with the Competition.competitionType column.
  const fetchSportData = React.useCallback(async () => {
    if (orgSports.length === 0) return;
    const matchingSport = orgSports[0];

    setLoadingSportData(true);
    try {
      const res = await fetch(`/api/sports/${matchingSport.id}/events`);
      if (!res.ok) {
        setHasSportSpecificData(false);
        return;
      }
      const data = await res.json();
      const events: SportEventEntry[] = data.events || [];

      if (events.length === 0) {
        setHasSportSpecificData(false);
        return;
      }

      setSportEvents(events);
      setHasSportSpecificData(true);

      // Extract age categories from eligibility data
      const ageCatMap = new Map<string, SportAgeCategoryEntry>();
      const eligKeys = new Set<string>();
      for (const evt of events) {
        for (const elig of evt.eligibility || []) {
          if (elig.isEnabled !== false) {
            eligKeys.add(`${evt.id}:${elig.ageCategory.id}`);
            if (!ageCatMap.has(elig.ageCategory.id)) {
              ageCatMap.set(elig.ageCategory.id, {
                id: elig.ageCategory.id,
                code: elig.ageCategory.code,
                name: elig.ageCategory.name,
                minAge: 0,
                maxAge: null,
                isActive: true,
                displayOrder: 0,
              });
            }
          }
        }
      }
      setEligibilitySet(eligKeys);

      // Also fetch age categories with full data
      const ageCatRes = await fetch(`/api/sports/${matchingSport.id}/age-categories`);
      if (ageCatRes.ok) {
        const ageCatData = await ageCatRes.json();
        setSportAgeCategories(ageCatData.ageCategories || []);
      } else {
        setSportAgeCategories(Array.from(ageCatMap.values()));
      }
    } catch (error) {
      console.error("Failed to fetch sport data:", error);
      setHasSportSpecificData(false);
    } finally {
      setLoadingSportData(false);
    }
  }, [orgSports]);

  // Handle facility selection to auto-fill address
  const handleFacilityChange = (facilityId: string) => {
    setLocationErrors({});
    if (facilityId === "__manual__") {
      setFormData((prev) => ({
        ...prev,
        facilityId: null,
        country: "",
        stateProvince: "",
        city: "",
        streetAddress: "",
        postalCode: "",
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
        postalCode: facility.postalCode || "",
      }));
    }
  };

  // Flatten membership instances for the restriction picker
  const membershipInstances: MembershipInstance[] = React.useMemo(() => {
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

  // Step validation
  const validateStep = (stepId: string): boolean => {
    switch (stepId) {
      case "general":
        if (!formData.name.trim()) {
          toast.error("Please enter a competition name");
          return false;
        }
        if (!formData.startDate) {
          toast.error("Please select a start date");
          return false;
        }
        if (!formData.endDate) {
          toast.error("Please select an end date");
          return false;
        }
        if (!formData.facilityId) {
          const locErrors: Record<string, string> = {};
          if (!formData.country) locErrors.country = "Country is required";
          if (!formData.stateProvince)
            locErrors.stateProvince =
              formData.country === "CA" ? "Province is required" : "State is required";
          if (!formData.city.trim()) locErrors.city = "City is required";
          if (!formData.streetAddress.trim())
            locErrors.streetAddress = "Street address is required";
          if (!formData.postalCode.trim()) {
            locErrors.postalCode =
              formData.country === "CA" ? "Postal code is required" : "ZIP code is required";
          } else if (
            formData.country &&
            !isValidPostalCode(formData.postalCode, formData.country)
          ) {
            locErrors.postalCode =
              formData.country === "US"
                ? "Enter a valid ZIP code (e.g. 12345 or 12345-6789)"
                : "Enter a valid postal code (e.g. A1A 1A1)";
          }
          if (Object.keys(locErrors).length > 0) {
            setLocationErrors(locErrors);
            toast.error("Please fill in all required location fields");
            return false;
          }
        }
        setLocationErrors({});
        return true;
      case "categories":
        return true;
      case "restrictions":
        if (formData.hasAgeRestriction && !formData.minAge && !formData.maxAge) {
          toast.error("Please set at least a minimum or maximum age");
          return false;
        }
        if (formData.hasCapacityRestriction && (!formData.capacity || formData.capacity <= 0)) {
          toast.error("Please set a valid capacity");
          return false;
        }
        if (formData.hasLevelRestriction && formData.levelRequirementIds.length === 0) {
          toast.error("Please select at least one level");
          return false;
        }
        if (formData.hasMembershipRestriction && formData.membershipRequirementIds.length === 0) {
          toast.error("Please select at least one membership");
          return false;
        }
        if (formData.hasWaiverRestriction && formData.waiverRequirementIds.length === 0) {
          toast.error("Please select at least one waiver");
          return false;
        }
        return true;
      case "results":
        return true;
      case "pricing":
        return true;
      case "registration":
        if (!formData.registrationOpen) {
          if (!formData.registrationStartDate) {
            toast.error("Please select a registration start date");
            return false;
          }
          if (formData.startDate && formData.registrationStartDate > formData.startDate) {
            toast.error(
              "Registration start date cannot be later than the first day of the competition"
            );
            return false;
          }
        }
        if (
          formData.registrationEndDate &&
          formData.registrationStartDate &&
          !formData.registrationOpen
        ) {
          if (formData.registrationEndDate < formData.registrationStartDate) {
            toast.error("Registration end date cannot be before registration start date");
            return false;
          }
        }
        return true;
      case "confirmation":
        if (formData.publishStatus === "SCHEDULED" && !formData.scheduledGoLiveDate) {
          toast.error("Please select a scheduled go-live date");
          return false;
        }
        return true;
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (validateStep(stepper.state.current.data.id)) {
      const currentStepId = stepper.state.current.data.id;
      const nextStepIndex = stepper.state.all.findIndex((s) => s.id === currentStepId) + 1;
      const nextStepId =
        nextStepIndex < stepper.state.all.length ? stepper.state.all[nextStepIndex].id : null;

      // Fetch sport-specific data when entering the categories step
      if (nextStepId === "categories" && sportEvents.length === 0) {
        fetchSportData();
      }

      // Build categoryResults from selection when leaving the categories step
      if (currentStepId === "categories" && hasSportSpecificData) {
        const combos = formData.categoryMode === "ALL" ? eligibilitySet : selectedCombos;
        const comboKeys = Array.from(combos);
        const results: CategoryResultConfig[] = [];
        for (const key of comboKeys) {
          const [eventId, ageCatId] = key.split(":");
          const evt = sportEvents.find((e) => e.id === eventId);
          const ageCat = sportAgeCategories.find((c) => c.id === ageCatId);
          if (!evt || !ageCat) continue;

          const existing = formData.categoryResults.find(
            (c) => c.sportEventId === eventId && c.ageCategoryId === ageCatId
          );

          results.push({
            combinationEntryId: null,
            individualEntryId: null,
            sportEventId: eventId,
            ageCategoryId: ageCatId,
            label: `${evt.name} - ${ageCat.code}`,
            resultType: evt.resultType,
            sortDirection: evt.sortDirection,
            precision: evt.defaultPrecision,
            seedMarkRequired: existing?.seedMarkRequired ?? false,
            submissionMode: existing?.submissionMode ?? "NONE",
            qualifyingMark: existing?.qualifyingMark ?? null,
            isTeamEvent: evt.eventType === "relay",
            teamSize: evt.eventType === "relay" ? 4 : null,
            collectResults: existing?.collectResults ?? true,
          });
        }

        results.sort((a, b) => {
          const evtA = sportEvents.find((e) => e.id === a.sportEventId);
          const evtB = sportEvents.find((e) => e.id === b.sportEventId);
          const ageCatA = sportAgeCategories.find((c) => c.id === a.ageCategoryId);
          const ageCatB = sportAgeCategories.find((c) => c.id === b.ageCategoryId);
          const evtOrder = (evtA?.displayOrder ?? 0) - (evtB?.displayOrder ?? 0);
          if (evtOrder !== 0) return evtOrder;
          return (ageCatA?.displayOrder ?? 0) - (ageCatB?.displayOrder ?? 0);
        });

        setFormData((prev) => ({ ...prev, categoryResults: results }));
      }

      const nextVisibleIndex = currentVisibleIndex + 1;
      if (nextVisibleIndex < visibleSteps.length) {
        stepper.navigation.goTo(visibleSteps[nextVisibleIndex].id);
      }
    }
  };

  const handlePrev = () => {
    const prevVisibleIndex = currentVisibleIndex - 1;
    if (prevVisibleIndex >= 0) {
      stepper.navigation.goTo(visibleSteps[prevVisibleIndex].id);
    }
  };

  const handleSubmit = async () => {
    if (
      !validateStep("general") ||
      !validateStep("categories") ||
      !validateStep("restrictions") ||
      !validateStep("results") ||
      !validateStep("pricing") ||
      !validateStep("registration") ||
      !validateStep("confirmation")
    ) {
      return;
    }

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
        postalCode: formData.postalCode,
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
        categoryResults: formData.categoryResults.map((c, i) => ({
          combinationEntryId: c.combinationEntryId,
          individualEntryId: c.individualEntryId,
          sportEventId: c.sportEventId,
          ageCategoryId: c.ageCategoryId,
          resultType: c.resultType,
          sortDirection: c.sortDirection,
          precision: c.precision,
          seedMarkRequired: c.seedMarkRequired,
          submissionMode: c.submissionMode,
          qualifyingMark: c.qualifyingMark,
          isTeamEvent: c.isTeamEvent,
          teamSize: c.teamSize,
          displayOrder: i,
          // collectResults is used by the UI; backend stores the category regardless
        })),
        pricingMode: formData.pricingMode,
        entryFee: formData.entryFee,
        pricingTiers: formData.pricingMode === "TIERED" ? formData.pricingTiers : [],
        categoryPrices: formData.pricingMode === "PER_CATEGORY" ? formData.categoryPrices : {},
        publishStatus: formData.publishStatus,
        scheduledGoLiveDate: formData.scheduledGoLiveDate?.toISOString(),
        scheduledGoLiveTime: formData.scheduledGoLiveTime,
        registrationOpen: formData.registrationOpen,
        registrationStartDate: !formData.registrationOpen
          ? formData.registrationStartDate?.toISOString()
          : null,
        registrationStartTime: !formData.registrationOpen ? formData.registrationStartTime : null,
        registrationEndDate: formData.registrationEndDate?.toISOString() ?? null,
        registrationEndTime: formData.registrationEndTime || null,
        earlyAccessCode: formData.earlyAccessCode,
        glCodeId: formData.glCodeId,
        seasonId: formData.seasonId,
        categoryId: formData.categoryId,
      };

      const url = isEditing ? `/api/competitions/${competitionId}` : "/api/competitions";
      const method = isEditing ? "PATCH" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to save competition");
      }

      const savedCompetition = await response.json();
      toast.success(isEditing ? "Competition updated!" : "Competition created!");
      if (onSaved) {
        onSaved(savedCompetition);
      } else {
        router.push("/dashboard/competitions");
      }
    } catch (error) {
      console.error("Failed to save competition:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to save competition. Please try again."
      );
    } finally {
      setIsSaving(false);
    }
  };

  const visibleStepIds = React.useMemo(() => {
    const ids: string[] = [];
    if (showSeasonStep) ids.push("season");
    ids.push(
      "general",
      "categories",
      "restrictions",
      "results",
      "pricing",
      "registration",
      "confirmation"
    );
    return ids;
  }, [showSeasonStep]);

  React.useEffect(() => {
    if (!visibleStepIds.includes(stepper.state.current.data.id)) {
      stepper.navigation.goTo(visibleStepIds[0] as "general");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleStepIds, stepper.state.current.data.id, stepper.navigation]);

  React.useEffect(() => {
    if (stepper.state.current.data.id === "registration") {
      setFormData((prev) => {
        const updates: Partial<CompetitionFormData> = {};
        if (!prev.registrationStartDate && prev.startDate) {
          updates.registrationStartDate = prev.startDate;
        }
        if (!prev.registrationEndDate && prev.endDate) {
          updates.registrationEndDate = prev.endDate;
        }
        if (Object.keys(updates).length === 0) return prev;
        return { ...prev, ...updates };
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepper.state.current.data.id]);

  const visibleSteps = stepper.state.all.filter((s) => visibleStepIds.includes(s.id));
  const currentVisibleIndex = visibleSteps.findIndex((s) => s.id === stepper.state.current.data.id);
  const currentIndex = stepper.state.all.findIndex((s) => s.id === stepper.state.current.data.id);

  if (loadingCompetition) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="flex flex-col gap-4">
        {/* Step Navigation */}
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
              <CardDescription>Optionally assign this competition to a season</CardDescription>
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
              {selectedSeason && formData.startDate && (
                <SeasonDateWarning
                  itemStartDate={formData.startDate}
                  itemEndDate={formData.endDate}
                  seasonStartDate={selectedSeason.startDate}
                  seasonEndDate={selectedSeason.endDate}
                  itemLabel="competition"
                />
              )}
            </CardContent>
          </Card>
        )}

        {/* Step 1: General */}
        {stepper.state.current.data.id === "general" && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="space-y-1.5">
                  <CardTitle className="flex items-center gap-2">
                    <Trophy className="h-5 w-5" />
                    Competition Details
                  </CardTitle>
                  <CardDescription>
                    Enter the basic information about your competition
                  </CardDescription>
                </div>
                {!isEditing && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setCopyDialogOpen(true)}
                  >
                    <Copy className="mr-2 h-4 w-4" />
                    Copy from Existing
                  </Button>
                )}
              </div>
            </CardHeader>

            <CopySettingsDialog
              entityType="competition"
              open={copyDialogOpen}
              onOpenChange={setCopyDialogOpen}
              onSelect={handleCopyFromCompetition}
            />

            <CardContent className="space-y-6">
              {/* Competition Name */}
              <div className="space-y-2">
                <Label htmlFor="name">Competition Name *</Label>
                <Input
                  id="name"
                  placeholder="e.g., Spring Invitational Meet 2026"
                  value={formData.name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                />
              </div>

              <ColorSelector
                value={formData.color}
                onChange={(color) => setFormData((prev) => ({ ...prev, color }))}
              />

              {/* Category */}
              {!categoriesLoading && categories.length > 0 && (
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select
                    value={formData.categoryId || "none"}
                    onValueChange={(val) =>
                      setFormData((prev) => ({ ...prev, categoryId: val === "none" ? null : val }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="No Category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No Category</SelectItem>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Location */}
              <div className="space-y-4">
                <Label className="text-base font-medium">Location *</Label>

                {/* Facility Selector */}
                <div className="space-y-2">
                  <Label htmlFor="facility">Select a Facility (optional)</Label>
                  <Select
                    value={formData.facilityId || "__manual__"}
                    onValueChange={handleFacilityChange}
                    disabled={loadingFacilities}
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={
                          loadingFacilities ? "Loading facilities..." : "Enter address manually"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__manual__">Enter address manually</SelectItem>
                      {facilities.map((facility) => (
                        <SelectItem key={facility.id} value={facility.id}>
                          {facility.name}
                          {facility.city ? ` - ${facility.city}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {formData.facilityId
                      ? "Address fields are populated from the selected facility."
                      : "Select a facility to auto-fill the address, or enter it manually below."}
                  </p>
                </div>

                {/* Address Fields */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Country */}
                  <div className="space-y-2">
                    <Label htmlFor="country">Country *</Label>
                    <Select
                      value={formData.country || undefined}
                      onValueChange={(value) => {
                        setFormData((prev) => ({
                          ...prev,
                          country: value,
                          stateProvince: prev.country !== value ? "" : prev.stateProvince,
                        }));
                        if (locationErrors.country)
                          setLocationErrors((prev) => ({ ...prev, country: "" }));
                        if (locationErrors.postalCode)
                          setLocationErrors((prev) => ({ ...prev, postalCode: "" }));
                      }}
                      disabled={!!formData.facilityId}
                    >
                      <SelectTrigger className={locationErrors.country ? "border-destructive" : ""}>
                        <SelectValue placeholder="Select country" />
                      </SelectTrigger>
                      <SelectContent>
                        {COUNTRIES.map((c) => (
                          <SelectItem key={c.code} value={c.code}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {locationErrors.country && (
                      <p className="text-sm text-destructive">{locationErrors.country}</p>
                    )}
                  </div>

                  {/* State / Province */}
                  <div className="space-y-2">
                    <Label>{formData.country === "CA" ? "Province" : "State"} *</Label>
                    <Popover open={stateProvinceOpen} onOpenChange={setStateProvinceOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={stateProvinceOpen}
                          disabled={!!formData.facilityId || !formData.country}
                          className={cn(
                            "w-full justify-between font-normal",
                            !formData.stateProvince && "text-muted-foreground",
                            locationErrors.stateProvince && "border-destructive"
                          )}
                        >
                          {formData.stateProvince
                            ? (getRegionsForCountry(formData.country).find(
                                (r) => r.code === formData.stateProvince
                              )?.name ?? formData.stateProvince)
                            : formData.country
                              ? `Select ${formData.country === "CA" ? "province" : "state"}...`
                              : "Select country first"}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent
                        className="w-[--radix-popover-trigger-width] p-0"
                        align="start"
                      >
                        <Command>
                          <CommandInput
                            placeholder={`Search ${formData.country === "CA" ? "provinces" : "states"}...`}
                          />
                          <CommandList>
                            <CommandEmpty>No results found.</CommandEmpty>
                            <CommandGroup>
                              {getRegionsForCountry(formData.country).map((region) => (
                                <CommandItem
                                  key={region.code}
                                  value={region.name}
                                  onSelect={() => {
                                    setFormData((prev) => ({
                                      ...prev,
                                      stateProvince: region.code,
                                    }));
                                    setStateProvinceOpen(false);
                                    if (locationErrors.stateProvince)
                                      setLocationErrors((prev) => ({ ...prev, stateProvince: "" }));
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      formData.stateProvince === region.code
                                        ? "opacity-100"
                                        : "opacity-0"
                                    )}
                                  />
                                  {region.name}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    {locationErrors.stateProvince && (
                      <p className="text-sm text-destructive">{locationErrors.stateProvince}</p>
                    )}
                  </div>

                  {/* City */}
                  <div className="space-y-2">
                    <Label htmlFor="city">City *</Label>
                    <Input
                      id="city"
                      placeholder="e.g., Toronto"
                      value={formData.city}
                      disabled={!!formData.facilityId}
                      onChange={(e) => {
                        setFormData((prev) => ({ ...prev, city: e.target.value }));
                        if (locationErrors.city)
                          setLocationErrors((prev) => ({ ...prev, city: "" }));
                      }}
                      className={locationErrors.city ? "border-destructive" : ""}
                    />
                    {locationErrors.city && (
                      <p className="text-sm text-destructive">{locationErrors.city}</p>
                    )}
                  </div>

                  {/* Street Address */}
                  <div className="space-y-2">
                    <Label htmlFor="streetAddress">Street Address *</Label>
                    <Input
                      id="streetAddress"
                      placeholder="e.g., 123 Main St"
                      value={formData.streetAddress}
                      disabled={!!formData.facilityId}
                      onChange={(e) => {
                        setFormData((prev) => ({ ...prev, streetAddress: e.target.value }));
                        if (locationErrors.streetAddress)
                          setLocationErrors((prev) => ({ ...prev, streetAddress: "" }));
                      }}
                      className={locationErrors.streetAddress ? "border-destructive" : ""}
                    />
                    {locationErrors.streetAddress && (
                      <p className="text-sm text-destructive">{locationErrors.streetAddress}</p>
                    )}
                  </div>

                  {/* Postal Code / ZIP Code */}
                  <div className="space-y-2">
                    <Label htmlFor="postalCode">
                      {formData.country === "CA" ? "Postal Code" : "ZIP Code"} *
                    </Label>
                    <Input
                      id="postalCode"
                      placeholder={formData.country === "CA" ? "A1A 1A1" : "12345"}
                      value={formData.postalCode}
                      disabled={!!formData.facilityId}
                      onChange={(e) => {
                        setFormData((prev) => ({ ...prev, postalCode: e.target.value }));
                        if (locationErrors.postalCode)
                          setLocationErrors((prev) => ({ ...prev, postalCode: "" }));
                      }}
                      className={locationErrors.postalCode ? "border-destructive" : ""}
                    />
                    {locationErrors.postalCode && (
                      <p className="text-sm text-destructive">{locationErrors.postalCode}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Dates & Times */}
              <div className="space-y-4">
                <Label className="text-base font-medium">Dates & Times *</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Start Date */}
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
                          <CalendarDays className="mr-2 h-4 w-4" />
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

                  {/* End Date */}
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
                          <CalendarDays className="mr-2 h-4 w-4" />
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
                          disabled={(date) =>
                            formData.startDate ? date < formData.startDate : false
                          }
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  {/* Start Time */}
                  <div className="space-y-2">
                    <Label htmlFor="startTime">Start Time</Label>
                    <div className="relative">
                      <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="startTime"
                        type="time"
                        value={formData.startTime}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, startTime: e.target.value }))
                        }
                        className="pl-10"
                      />
                    </div>
                  </div>

                  {/* End Time */}
                  <div className="space-y-2">
                    <Label htmlFor="endTime">End Time</Label>
                    <div className="relative">
                      <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="endTime"
                        type="time"
                        value={formData.endTime}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, endTime: e.target.value }))
                        }
                        className="pl-10"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Categories */}
        {stepper.state.current.data.id === "categories" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Tag className="h-5 w-5" />
                Categories
              </CardTitle>
              <CardDescription>
                Choose which event / age group combinations are available for this competition
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Mode selector */}
              <RadioGroup
                value={formData.categoryMode}
                onValueChange={(value: "ALL" | "SPECIFIC") => {
                  setFormData((prev) => ({
                    ...prev,
                    categoryMode: value,
                    selectedCategoryIds: value === "ALL" ? [] : prev.selectedCategoryIds,
                  }));
                  if (value === "ALL" && hasSportSpecificData) {
                    // Select all eligible combos
                    setSelectedCombos(new Set(eligibilitySet));
                  }
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
                    <span className="font-medium">Use All Eligible Categories</span>
                    <p className="text-sm text-muted-foreground">
                      All enabled event/age combinations will be available for registration
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
                    <span className="font-medium">Pick Specific Categories</span>
                    <p className="text-sm text-muted-foreground">
                      Select exactly which event/age combinations to include
                    </p>
                  </div>
                </label>
              </RadioGroup>

              {/* Sport-specific category picker */}
              {hasSportSpecificData && formData.categoryMode === "SPECIFIC" && (
                <>
                  {loadingSportData ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-muted-foreground">
                          {selectedCombos.size} of {eligibilitySet.size} categories selected
                        </p>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedCombos(new Set(eligibilitySet))}
                          >
                            Select All
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedCombos(new Set())}
                          >
                            Clear All
                          </Button>
                        </div>
                      </div>

                      <div className="overflow-x-auto rounded-lg border">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b bg-muted/50">
                              <th className="text-left py-2.5 px-3 font-medium min-w-[180px] sticky left-0 bg-muted/50 z-10">
                                Event
                              </th>
                              {sportAgeCategories.map((cat) => (
                                <th
                                  key={cat.id}
                                  className="text-center py-2.5 px-1 font-medium min-w-[60px]"
                                >
                                  <div className="flex flex-col items-center gap-0.5">
                                    <span className="text-xs font-semibold">{cat.code}</span>
                                    <span className="text-[10px] font-normal text-muted-foreground">
                                      {cat.minAge}-{cat.maxAge ?? "∞"}
                                    </span>
                                  </div>
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {(() => {
                              const grouped = sportEvents.reduce<Record<string, SportEventEntry[]>>(
                                (acc, evt) => {
                                  if (!acc[evt.eventGroup]) acc[evt.eventGroup] = [];
                                  acc[evt.eventGroup].push(evt);
                                  return acc;
                                },
                                {}
                              );

                              return Object.entries(grouped).map(([group, events]) => (
                                <React.Fragment key={group}>
                                  {/* Group header with select all for this group */}
                                  <tr className="bg-muted/30">
                                    <td
                                      colSpan={1 + sportAgeCategories.length}
                                      className="py-1.5 px-3"
                                    >
                                      <div className="flex items-center justify-between">
                                        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                          {EVENT_GROUP_LABELS[group] || group}
                                        </span>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-5 text-[10px] px-2"
                                          onClick={() => {
                                            const groupKeys = events.flatMap((evt) =>
                                              sportAgeCategories
                                                .filter((cat) =>
                                                  eligibilitySet.has(`${evt.id}:${cat.id}`)
                                                )
                                                .map((cat) => `${evt.id}:${cat.id}`)
                                            );
                                            const allSelected = groupKeys.every((k) =>
                                              selectedCombos.has(k)
                                            );
                                            setSelectedCombos((prev) => {
                                              const next = new Set(prev);
                                              for (const k of groupKeys) {
                                                if (allSelected) next.delete(k);
                                                else next.add(k);
                                              }
                                              return next;
                                            });
                                          }}
                                        >
                                          Toggle group
                                        </Button>
                                      </div>
                                    </td>
                                  </tr>
                                  {events.map((evt) => (
                                    <tr
                                      key={evt.id}
                                      className="border-b border-border/40 hover:bg-muted/20"
                                    >
                                      <td className="py-1.5 px-3 sticky left-0 bg-background z-10">
                                        <div className="flex items-center gap-2">
                                          <span className="font-medium text-sm">{evt.name}</span>
                                          <Badge
                                            variant="outline"
                                            className="text-[10px] px-1.5 py-0 shrink-0"
                                          >
                                            {evt.resultType}
                                          </Badge>
                                        </div>
                                      </td>
                                      {sportAgeCategories.map((cat) => {
                                        const key = `${evt.id}:${cat.id}`;
                                        const eligible = eligibilitySet.has(key);
                                        const selected = selectedCombos.has(key);
                                        return (
                                          <td key={cat.id} className="py-1.5 px-1">
                                            <div className="flex items-center justify-center">
                                              {eligible ? (
                                                <Checkbox
                                                  checked={selected}
                                                  onCheckedChange={(checked) => {
                                                    setSelectedCombos((prev) => {
                                                      const next = new Set(prev);
                                                      if (checked) next.add(key);
                                                      else next.delete(key);
                                                      return next;
                                                    });
                                                  }}
                                                />
                                              ) : (
                                                <span className="text-muted-foreground/20 text-xs">
                                                  &mdash;
                                                </span>
                                              )}
                                            </div>
                                          </td>
                                        );
                                      })}
                                    </tr>
                                  ))}
                                </React.Fragment>
                              ));
                            })()}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Non-sport-specific fallback */}
              {!hasSportSpecificData && formData.categoryMode === "SPECIFIC" && (
                <div className="rounded-lg border border-dashed p-6 text-center">
                  <Info className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Categories will be configurable from the{" "}
                    <a href="/dashboard/competitions/categories" className="text-primary underline">
                      Categories page
                    </a>{" "}
                    once defined.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Step 3: Restrictions */}
        {stepper.state.current.data.id === "restrictions" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Requirements & Restrictions
              </CardTitle>
              <CardDescription>
                Configure who can register for this competition. Toggle on the restrictions you want
                to apply.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
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

              {membershipsEnabled && (
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
                          <a
                            href="/dashboard/athletes/memberships"
                            className="text-primary underline"
                          >
                            Create memberships
                          </a>{" "}
                          first.
                        </p>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
              )}

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
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
                  <Label className="text-base">File Upload Requirement</Label>
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
            </CardContent>
          </Card>
        )}

        {/* Step 4: Results */}
        {stepper.state.current.data.id === "results" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Results Configuration
              </CardTitle>
              <CardDescription>
                Choose which events require seed marks during registration, and which events will
                have results recorded.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {formData.categoryResults.length === 0 ? (
                <div className="rounded-lg border border-dashed p-8 text-center">
                  <BarChart3 className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
                  <p className="font-medium text-muted-foreground mb-1">No Categories Selected</p>
                  <p className="text-sm text-muted-foreground">
                    Go back to the Categories step and select events to configure.
                  </p>
                </div>
              ) : (
                <>
                  {/* Seed Marks Section */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-semibold">Seed Marks (Registration)</h3>
                        <p className="text-xs text-muted-foreground">
                          Which events should collect a qualifying result during registration?
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs h-7"
                          onClick={() =>
                            setFormData((prev) => ({
                              ...prev,
                              categoryResults: prev.categoryResults.map((c) => ({
                                ...c,
                                seedMarkRequired: true,
                                submissionMode: "MANUAL_ENTRY" as SubMode,
                              })),
                            }))
                          }
                        >
                          All
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs h-7"
                          onClick={() =>
                            setFormData((prev) => ({
                              ...prev,
                              categoryResults: prev.categoryResults.map((c) => ({
                                ...c,
                                seedMarkRequired: false,
                                submissionMode: "NONE" as SubMode,
                              })),
                            }))
                          }
                        >
                          None
                        </Button>
                      </div>
                    </div>

                    <div className="rounded-lg border divide-y max-h-[300px] overflow-y-auto">
                      {formData.categoryResults.map((cat, index) => (
                        <label
                          key={`seed-${index}`}
                          className={cn(
                            "flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors hover:bg-muted/30",
                            cat.seedMarkRequired && "bg-primary/5"
                          )}
                        >
                          <Checkbox
                            checked={cat.seedMarkRequired}
                            onCheckedChange={(checked) =>
                              setFormData((prev) => ({
                                ...prev,
                                categoryResults: prev.categoryResults.map((c, i) =>
                                  i === index
                                    ? {
                                        ...c,
                                        seedMarkRequired: !!checked,
                                        submissionMode: checked
                                          ? ("MANUAL_ENTRY" as SubMode)
                                          : ("NONE" as SubMode),
                                      }
                                    : c
                                ),
                              }))
                            }
                          />
                          <span className="text-sm flex-1">{cat.label}</span>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">
                            {cat.resultType}
                          </Badge>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Record Results Section */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-semibold">Record Results (Post-Competition)</h3>
                        <p className="text-xs text-muted-foreground">
                          Which events will have results recorded after the competition?
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs h-7"
                          onClick={() =>
                            setFormData((prev) => ({
                              ...prev,
                              categoryResults: prev.categoryResults.map((c) => ({
                                ...c,
                                collectResults: true,
                              })),
                            }))
                          }
                        >
                          All
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs h-7"
                          onClick={() =>
                            setFormData((prev) => ({
                              ...prev,
                              categoryResults: prev.categoryResults.map((c) => ({
                                ...c,
                                collectResults: false,
                              })),
                            }))
                          }
                        >
                          None
                        </Button>
                      </div>
                    </div>

                    <div className="rounded-lg border divide-y max-h-[300px] overflow-y-auto">
                      {formData.categoryResults.map((cat, index) => (
                        <label
                          key={`result-${index}`}
                          className={cn(
                            "flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors hover:bg-muted/30",
                            cat.collectResults && "bg-primary/5"
                          )}
                        >
                          <Checkbox
                            checked={cat.collectResults}
                            onCheckedChange={(checked) =>
                              setFormData((prev) => ({
                                ...prev,
                                categoryResults: prev.categoryResults.map((c, i) =>
                                  i === index ? { ...c, collectResults: !!checked } : c
                                ),
                              }))
                            }
                          />
                          <span className="text-sm flex-1">{cat.label}</span>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">
                            {cat.resultType}
                          </Badge>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Summary */}
                  <div className="rounded-lg bg-muted/30 p-3 text-xs text-muted-foreground">
                    <p>
                      <strong>
                        {formData.categoryResults.filter((c) => c.seedMarkRequired).length}
                      </strong>{" "}
                      events will collect seed marks during registration.{" "}
                      <strong>
                        {formData.categoryResults.filter((c) => c.collectResults).length}
                      </strong>{" "}
                      events will record results.
                    </p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* Step 5: Pricing */}
        {stepper.state.current.data.id === "pricing" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Pricing
              </CardTitle>
              <CardDescription>Set registration fees for this competition</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Pricing Mode Selector */}
              <RadioGroup
                value={formData.pricingMode}
                onValueChange={(value: typeof formData.pricingMode) =>
                  setFormData((prev) => ({ ...prev, pricingMode: value }))
                }
                className="space-y-3"
              >
                {/* Free */}
                <label
                  className={cn(
                    "flex items-start gap-4 rounded-lg border p-4 cursor-pointer transition-colors",
                    formData.pricingMode === "FREE"
                      ? "border-primary bg-primary/5"
                      : "hover:bg-muted/50"
                  )}
                >
                  <RadioGroupItem value="FREE" className="mt-1" />
                  <div className="flex-1 space-y-1">
                    <span className="font-medium">Free</span>
                    <p className="text-sm text-muted-foreground">No registration fee</p>
                  </div>
                </label>

                {/* Per Competition */}
                <label
                  className={cn(
                    "flex items-start gap-4 rounded-lg border p-4 cursor-pointer transition-colors",
                    formData.pricingMode === "PER_COMPETITION"
                      ? "border-primary bg-primary/5"
                      : "hover:bg-muted/50"
                  )}
                >
                  <RadioGroupItem value="PER_COMPETITION" className="mt-1" />
                  <div className="flex-1 space-y-1">
                    <span className="font-medium">Flat Fee</span>
                    <p className="text-sm text-muted-foreground">
                      One price to participate in the competition, regardless of how many events
                      entered
                    </p>
                  </div>
                </label>

                {/* Per Event */}
                <label
                  className={cn(
                    "flex items-start gap-4 rounded-lg border p-4 cursor-pointer transition-colors",
                    formData.pricingMode === "PER_EVENT"
                      ? "border-primary bg-primary/5"
                      : "hover:bg-muted/50"
                  )}
                >
                  <RadioGroupItem value="PER_EVENT" className="mt-1" />
                  <div className="flex-1 space-y-1">
                    <span className="font-medium">Per Event</span>
                    <p className="text-sm text-muted-foreground">
                      A flat price for each event entered
                    </p>
                  </div>
                </label>

                {/* Tiered */}
                <label
                  className={cn(
                    "flex items-start gap-4 rounded-lg border p-4 cursor-pointer transition-colors",
                    formData.pricingMode === "TIERED"
                      ? "border-primary bg-primary/5"
                      : "hover:bg-muted/50"
                  )}
                >
                  <RadioGroupItem value="TIERED" className="mt-1" />
                  <div className="flex-1 space-y-1">
                    <span className="font-medium">Tiered</span>
                    <p className="text-sm text-muted-foreground">
                      Discounts for entering multiple events (e.g., 1-3 events at $20/ea, 4+ at
                      $15/ea)
                    </p>
                  </div>
                </label>

                {/* Per Category */}
                <label
                  className={cn(
                    "flex items-start gap-4 rounded-lg border p-4 cursor-pointer transition-colors",
                    formData.pricingMode === "PER_CATEGORY"
                      ? "border-primary bg-primary/5"
                      : "hover:bg-muted/50"
                  )}
                >
                  <RadioGroupItem value="PER_CATEGORY" className="mt-1" />
                  <div className="flex-1 space-y-1">
                    <span className="font-medium">Per Category</span>
                    <p className="text-sm text-muted-foreground">
                      Set a specific price for each event / age group combination
                    </p>
                  </div>
                </label>
              </RadioGroup>

              {/* Flat Fee / Per Event input */}
              {(formData.pricingMode === "PER_COMPETITION" ||
                formData.pricingMode === "PER_EVENT") && (
                <div className="rounded-lg border p-4 space-y-3">
                  <Label className="text-sm font-medium">
                    {formData.pricingMode === "PER_COMPETITION"
                      ? "Competition Entry Fee"
                      : "Price Per Event"}
                  </Label>
                  <div className="relative max-w-[200px]">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      placeholder="0.00"
                      value={formData.entryFee ?? ""}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          entryFee: e.target.value ? parseFloat(e.target.value) : null,
                        }))
                      }
                      className="pl-9"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {formData.pricingMode === "PER_COMPETITION"
                      ? "This fee is charged once per athlete to enter the competition."
                      : "This fee is charged for each event the athlete registers for."}
                  </p>
                </div>
              )}

              {/* Tiered pricing editor */}
              {formData.pricingMode === "TIERED" && (
                <div className="rounded-lg border p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">Pricing Tiers</Label>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const lastTier = formData.pricingTiers[formData.pricingTiers.length - 1];
                        const nextMin = lastTier
                          ? lastTier.maxEvents
                            ? lastTier.maxEvents + 1
                            : lastTier.minEvents + 1
                          : 1;
                        setFormData((prev) => ({
                          ...prev,
                          pricingTiers: [
                            ...prev.pricingTiers,
                            { minEvents: nextMin, maxEvents: null, pricePerEvent: 0 },
                          ],
                        }));
                      }}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Add Tier
                    </Button>
                  </div>

                  {formData.pricingTiers.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No tiers configured. Add at least one pricing tier.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {formData.pricingTiers.map((tier, index) => (
                        <div
                          key={index}
                          className="flex items-center gap-3 rounded-lg bg-muted/30 p-3"
                        >
                          <div className="flex items-center gap-2 flex-1">
                            <div className="space-y-1">
                              <Label className="text-xs">Min Events</Label>
                              <Input
                                type="number"
                                min={1}
                                value={tier.minEvents}
                                onChange={(e) =>
                                  setFormData((prev) => ({
                                    ...prev,
                                    pricingTiers: prev.pricingTiers.map((t, i) =>
                                      i === index
                                        ? { ...t, minEvents: parseInt(e.target.value) || 1 }
                                        : t
                                    ),
                                  }))
                                }
                                className="h-8 w-20 text-xs"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Max Events</Label>
                              <Input
                                type="number"
                                min={tier.minEvents}
                                placeholder="∞"
                                value={tier.maxEvents ?? ""}
                                onChange={(e) =>
                                  setFormData((prev) => ({
                                    ...prev,
                                    pricingTiers: prev.pricingTiers.map((t, i) =>
                                      i === index
                                        ? {
                                            ...t,
                                            maxEvents: e.target.value
                                              ? parseInt(e.target.value)
                                              : null,
                                          }
                                        : t
                                    ),
                                  }))
                                }
                                className="h-8 w-20 text-xs"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Price / Event</Label>
                              <div className="relative">
                                <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                                <Input
                                  type="number"
                                  min={0}
                                  step="0.01"
                                  value={tier.pricePerEvent}
                                  onChange={(e) =>
                                    setFormData((prev) => ({
                                      ...prev,
                                      pricingTiers: prev.pricingTiers.map((t, i) =>
                                        i === index
                                          ? { ...t, pricePerEvent: parseFloat(e.target.value) || 0 }
                                          : t
                                      ),
                                    }))
                                  }
                                  className="h-8 w-24 pl-6 text-xs"
                                />
                              </div>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                            onClick={() =>
                              setFormData((prev) => ({
                                ...prev,
                                pricingTiers: prev.pricingTiers.filter((_, i) => i !== index),
                              }))
                            }
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  <p className="text-xs text-muted-foreground">
                    Athletes are charged the per-event price from the tier matching their total
                    number of events. Leave &quot;Max Events&quot; empty for unlimited.
                  </p>
                </div>
              )}

              {/* Per Category pricing */}
              {formData.pricingMode === "PER_CATEGORY" && (
                <div className="rounded-lg border p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">Category Prices</Label>
                    {formData.categoryResults.length > 0 && (
                      <div className="flex items-center gap-2">
                        <Label className="text-xs text-muted-foreground">Set all to:</Label>
                        <div className="relative">
                          <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                          <Input
                            type="number"
                            min={0}
                            step="0.01"
                            placeholder="0.00"
                            className="h-7 w-24 pl-6 text-xs"
                            onBlur={(e) => {
                              const val = parseFloat(e.target.value);
                              if (isNaN(val)) return;
                              const prices: Record<string, number> = {};
                              for (const cat of formData.categoryResults) {
                                const key =
                                  cat.sportEventId && cat.ageCategoryId
                                    ? `${cat.sportEventId}:${cat.ageCategoryId}`
                                    : "";
                                if (key) prices[key] = val;
                              }
                              setFormData((prev) => ({ ...prev, categoryPrices: prices }));
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {formData.categoryResults.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No categories selected. Go back to the Categories step to select events.
                    </p>
                  ) : (
                    <div className="rounded-lg border divide-y max-h-[400px] overflow-y-auto">
                      {formData.categoryResults.map((cat, index) => {
                        const key =
                          cat.sportEventId && cat.ageCategoryId
                            ? `${cat.sportEventId}:${cat.ageCategoryId}`
                            : `cat-${index}`;
                        return (
                          <div key={key} className="flex items-center gap-3 px-3 py-2">
                            <span className="text-sm flex-1">{cat.label}</span>
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">
                              {cat.resultType}
                            </Badge>
                            <div className="relative shrink-0">
                              <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                              <Input
                                type="number"
                                min={0}
                                step="0.01"
                                placeholder="0.00"
                                value={formData.categoryPrices[key] ?? ""}
                                onChange={(e) =>
                                  setFormData((prev) => ({
                                    ...prev,
                                    categoryPrices: {
                                      ...prev.categoryPrices,
                                      [key]: e.target.value ? parseFloat(e.target.value) : 0,
                                    },
                                  }))
                                }
                                className="h-7 w-24 pl-6 text-xs"
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <p className="text-xs text-muted-foreground">
                    Set a specific registration price for each event / age group combination.
                  </p>
                </div>
              )}

              {/* GL Code */}
              <GLCodeSelector
                value={formData.glCodeId}
                onChange={(v) => setFormData((prev) => ({ ...prev, glCodeId: v }))}
                entityType="COMPETITION"
              />
            </CardContent>
          </Card>
        )}

        {/* Registration Step */}
        {stepper.state.current.data.id === "registration" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5" />
                Registration Window
              </CardTitle>
              <CardDescription>
                Configure when registration opens and closes for this competition
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Registration Open / Schedule */}
              <div className="space-y-4">
                <Label className="text-base font-medium">Registration Availability</Label>
                <RadioGroup
                  value={formData.registrationOpen ? "now" : "scheduled"}
                  onValueChange={(value) => {
                    const isNow = value === "now";
                    setFormData((prev) => ({
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
                      formData.registrationOpen
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
                      !formData.registrationOpen
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

              {/* Registration Opens */}
              {!formData.registrationOpen && (
                <div className="space-y-4">
                  <Label className="text-base font-medium">Registration Opens</Label>
                  <p className="text-sm text-muted-foreground">
                    Set when registration becomes available. Must be on or before the first day of
                    the competition
                    {formData.startDate ? ` (${format(formData.startDate, "PPP")})` : ""}.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Open Date</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !formData.registrationStartDate && "text-muted-foreground"
                            )}
                          >
                            <CalendarDays className="mr-2 h-4 w-4" />
                            {formData.registrationStartDate
                              ? format(formData.registrationStartDate, "PPP")
                              : "Pick a date"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <CalendarComponent
                            mode="single"
                            selected={formData.registrationStartDate || undefined}
                            onSelect={(date) =>
                              setFormData((prev) => ({
                                ...prev,
                                registrationStartDate: date || null,
                              }))
                            }
                            disabled={(date) => {
                              if (formData.startDate && date > formData.startDate) return true;
                              return false;
                            }}
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
                          value={formData.registrationStartTime}
                          onChange={(e) =>
                            setFormData((prev) => ({
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

              {/* Registration End Date */}
              <div className="space-y-4">
                <Label className="text-base font-medium">Registration Closes</Label>
                <p className="text-sm text-muted-foreground">
                  Set when registration closes. Defaults to the competition end date if not
                  specified.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Close Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !formData.registrationEndDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarDays className="mr-2 h-4 w-4" />
                          {formData.registrationEndDate
                            ? format(formData.registrationEndDate, "PPP")
                            : formData.endDate
                              ? `Competition end: ${format(formData.endDate, "PPP")}`
                              : "Pick a date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <CalendarComponent
                          mode="single"
                          selected={formData.registrationEndDate || undefined}
                          onSelect={(date) =>
                            setFormData((prev) => ({ ...prev, registrationEndDate: date || null }))
                          }
                          disabled={(date) => {
                            const earliest =
                              !formData.registrationOpen && formData.registrationStartDate
                                ? formData.registrationStartDate
                                : new Date();
                            if (date < earliest) return true;
                            return false;
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
                        value={formData.registrationEndTime}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, registrationEndTime: e.target.value }))
                        }
                        className="pl-10"
                      />
                    </div>
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

                {formData.earlyAccessCode && isEditing && competitionId && (
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
            </CardContent>
          </Card>
        )}

        {/* Confirmation */}
        {stepper.state.current.data.id === "confirmation" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Check className="h-5 w-5" />
                Confirmation & Publishing
              </CardTitle>
              <CardDescription>
                Review your competition settings and choose when to publish
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Publish Status */}
              <div className="space-y-4">
                <Label className="text-base font-medium">Publishing Status</Label>
                <RadioGroup
                  value={formData.publishStatus}
                  onValueChange={(value: PublishStatus) =>
                    setFormData((prev) => ({
                      ...prev,
                      publishStatus: value,
                      scheduledGoLiveDate: value === "SCHEDULED" ? prev.scheduledGoLiveDate : null,
                    }))
                  }
                  className="space-y-3"
                >
                  <label
                    className={cn(
                      "flex items-start gap-4 rounded-lg border p-4 cursor-pointer transition-colors",
                      formData.publishStatus === "LIVE"
                        ? "border-primary bg-primary/5"
                        : "hover:bg-muted/50"
                    )}
                  >
                    <RadioGroupItem value="LIVE" className="mt-1" />
                    <div className="flex-1 space-y-1">
                      <span className="font-medium">Go Live Now</span>
                      <p className="text-sm text-muted-foreground">
                        The competition will be immediately visible and open for registration
                      </p>
                    </div>
                  </label>

                  <label
                    className={cn(
                      "flex items-start gap-4 rounded-lg border p-4 cursor-pointer transition-colors",
                      formData.publishStatus === "DRAFT"
                        ? "border-primary bg-primary/5"
                        : "hover:bg-muted/50"
                    )}
                  >
                    <RadioGroupItem value="DRAFT" className="mt-1" />
                    <div className="flex-1 space-y-1">
                      <span className="font-medium">Save as Draft</span>
                      <p className="text-sm text-muted-foreground">
                        The competition will be saved but not visible to the public
                      </p>
                    </div>
                  </label>

                  <label
                    className={cn(
                      "flex items-start gap-4 rounded-lg border p-4 cursor-pointer transition-colors",
                      formData.publishStatus === "SCHEDULED"
                        ? "border-primary bg-primary/5"
                        : "hover:bg-muted/50"
                    )}
                  >
                    <RadioGroupItem value="SCHEDULED" className="mt-1" />
                    <div className="flex-1 space-y-1">
                      <span className="font-medium">Schedule Go-Live</span>
                      <p className="text-sm text-muted-foreground">
                        Set a specific date and time for the competition to go live
                      </p>
                    </div>
                  </label>
                </RadioGroup>

                {/* Scheduled date/time picker */}
                {formData.publishStatus === "SCHEDULED" && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-8">
                    <div className="space-y-2">
                      <Label>Go-Live Date</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !formData.scheduledGoLiveDate && "text-muted-foreground"
                            )}
                          >
                            <CalendarDays className="mr-2 h-4 w-4" />
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
                      <Label htmlFor="scheduledTime">Go-Live Time</Label>
                      <div className="relative">
                        <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="scheduledTime"
                          type="time"
                          value={formData.scheduledGoLiveTime}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              scheduledGoLiveTime: e.target.value,
                            }))
                          }
                          className="pl-10"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Pricing Summary */}
              <div className="rounded-lg border p-4 space-y-2">
                <div className="flex items-center gap-2 mb-1">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium text-sm">Pricing</span>
                </div>
                {formData.pricingMode === "FREE" && (
                  <p className="text-sm text-muted-foreground">Free — no registration fee</p>
                )}
                {formData.pricingMode === "PER_COMPETITION" && (
                  <p className="text-sm text-muted-foreground">
                    Flat fee: ${formData.entryFee?.toFixed(2) ?? "0.00"} per athlete
                  </p>
                )}
                {formData.pricingMode === "PER_EVENT" && (
                  <p className="text-sm text-muted-foreground">
                    ${formData.entryFee?.toFixed(2) ?? "0.00"} per event entered
                  </p>
                )}
                {formData.pricingMode === "TIERED" && (
                  <div className="space-y-1">
                    {formData.pricingTiers.map((t, i) => (
                      <p key={i} className="text-sm text-muted-foreground">
                        {t.minEvents}–{t.maxEvents ?? "∞"} events: ${t.pricePerEvent.toFixed(2)}
                        /event
                      </p>
                    ))}
                  </div>
                )}
                {formData.pricingMode === "PER_CATEGORY" && (
                  <p className="text-sm text-muted-foreground">
                    Per-category pricing — {Object.keys(formData.categoryPrices).length} categories
                    configured
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between mt-6">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              if (onCancel) {
                onCancel();
                return;
              }
              router.push("/dashboard/competitions");
            }}
          >
            {embedded ? "Close" : "Cancel"}
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
                    {isEditing ? "Saving..." : "Creating..."}
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    {isEditing ? "Save Competition" : "Create Competition"}
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
