"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useSession, signIn } from "next-auth/react";
import { toast } from "sonner";
import { sanitizeHtml } from "@/lib/sanitize";
import { calculateAge, isAgeEligible } from "@/lib/age-utils";
import { useCart } from "@/components/sites/cart-context";
import { getClientSubdomainUrl } from "@/lib/client-domains";
import {
  defineStepper,
  StepperNav,
  StepperItem,
  StepperIndicator,
  StepperSeparator,
  StepperTitle,
  getStepStatus,
} from "@/components/ui/stepper";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SignaturePad, type SignaturePadRef } from "@/components/ui/signature-pad";
import { CheckoutMedicalForm } from "@/components/sites/checkout-medical-form";
import { FileUploadStep } from "@/components/sites/file-upload-step";
import { CustomInformationForm } from "@/components/sites/custom-information-form";
import type { MedicalFormConfig, CustomMedicalQuestion } from "@/types/medical";
import type { CustomInfoQuestion, CustomInfoResponse } from "@/types/custom-information";
import type { FileRequirementConfig } from "@/types/file-requirements";
import {
  User,
  Calendar,
  Plus,
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertCircle,
  ShoppingCart,
  Trophy,
  Check,
  Tag,
  Shield,
  CreditCard,
  FileText,
  Heart,
  Gauge,
  ExternalLink,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

// ---------- Types ----------

interface SportEvent {
  id: string;
  name: string;
  code: string;
  eventGroup: string | null;
}

interface AgeCategory {
  id: string;
  name: string;
  code: string;
  minAge: number;
  maxAge: number | null;
}

interface CompetitionCategory {
  id: string;
  sportEvent: SportEvent | null;
  ageCategory: AgeCategory | null;
  isTeamEvent: boolean;
  price: number | null;
  displayOrder: number;
  seedMarkRequired: boolean;
  submissionMode: "NONE" | "VERIFIED_RESULT" | "MANUAL_ENTRY";
  resultType: "TIME" | "DISTANCE" | "HEIGHT" | "SCORE" | "PLACEMENT";
  precision: number;
  qualifyingMark: number | null;
}

interface PricingTier {
  id: string;
  minEvents: number;
  maxEvents: number | null;
  pricePerEvent: number;
  displayOrder: number;
}

interface CompetitionData {
  id: string;
  name: string;
  competitionType: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  city?: string | null;
  stateProvince?: string | null;
  facility?: {
    id: string;
    name: string;
    city?: string | null;
    stateProvince?: string | null;
  } | null;
  pricingMode: string;
  entryFee: number | null;
  hasAgeRestriction: boolean;
  minAge: number | null;
  maxAge: number | null;
  hasLevelRestriction: boolean;
  levelRequirementIds: string[];
  hasCapacityRestriction: boolean;
  capacity: number | null;
  hasMembershipRestriction: boolean;
  membershipRequirementIds: string[];
  hasWaiverRestriction: boolean;
  waiverRequirementIds: string[];
  hasMedicalRequirement: boolean;
  hasFileRequirement: boolean;
  fileRequirementConfig: FileRequirementConfig | null;
  organizationId: string;
  categories: CompetitionCategory[];
  pricingTiers: PricingTier[];
}

interface WaiverToSign {
  waiverId: string;
  waiverTitle: string;
  isSigned: boolean;
}

interface WaiverPage {
  id: string;
  pageNumber: number;
  title: string | null;
  content: string;
}

interface AthleteOption {
  id: string;
  firstName: string;
  lastName: string;
  name: string;
  birthDate: string | null;
  gender: string | null;
}

interface AvailableMembership {
  id: string;
  name: string;
  price: number;
  billingInterval: string;
  groupId: string;
  groupName: string;
}

interface EligibilityResult {
  eligible: boolean;
  reasons: string[];
  eligibleCategoryIds: string[];
  requiresMembershipPurchase: boolean;
  availableMemberships: AvailableMembership[];
}

interface CompetitionRegistrationFlowProps {
  competition: CompetitionData;
  slug: string;
  primaryColor?: string;
  earlyAccessCode?: string | null;
}

// ---------- Stepper definition ----------

const { useStepper } = defineStepper(
  { id: "athlete", title: "Select Athlete" },
  { id: "categories", title: "Select Events" },
  { id: "seedMarks", title: "Seed Marks" },
  { id: "waivers", title: "Sign Waivers" },
  { id: "customInfo", title: "Custom Info" },
  { id: "medical", title: "Medical Info" },
  { id: "files", title: "File Upload" },
  { id: "review", title: "Review & Add to Cart" }
);

// ---------- Helpers ----------

const GENDER_LABELS: Record<string, string> = {
  MALE: "Male",
  FEMALE: "Female",
  OTHER: "Other",
  PREFER_NOT_TO_SAY: "Prefer Not to Say",
};

function formatPrice(price: number): string {
  if (price === 0) return "Free";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(price);
}

function getCategoryLabel(cat: CompetitionCategory): string {
  const parts: string[] = [];
  if (cat.sportEvent) parts.push(cat.sportEvent.name);
  if (cat.ageCategory) parts.push(cat.ageCategory.name);
  return parts.join(" – ") || `Category ${cat.displayOrder + 1}`;
}

type SeedMarkValue =
  | {
      type: "TIME";
      hours: string;
      minutes: string;
      seconds: string;
      ms: string;
      handTimed: boolean;
    }
  | { type: "DISTANCE" | "HEIGHT"; value: string }
  | { type: "SCORE"; value: string }
  | { type: "PLACEMENT"; value: string };

function defaultSeedMark(resultType: CompetitionCategory["resultType"]): SeedMarkValue {
  switch (resultType) {
    case "TIME":
      return { type: "TIME", hours: "", minutes: "", seconds: "", ms: "", handTimed: false };
    case "DISTANCE":
    case "HEIGHT":
      return { type: resultType, value: "" };
    case "SCORE":
      return { type: "SCORE", value: "" };
    case "PLACEMENT":
      return { type: "PLACEMENT", value: "" };
    default:
      return { type: "SCORE", value: "" };
  }
}

function getSeedMarkMeta(resultType: CompetitionCategory["resultType"]): {
  label: string;
  placeholder: string;
  unit: string;
  step: string;
} {
  switch (resultType) {
    case "TIME":
      return { label: "Time", placeholder: "", unit: "", step: "1" };
    case "DISTANCE":
      return { label: "Distance", placeholder: "e.g. 70.88", unit: "m", step: "0.01" };
    case "HEIGHT":
      return { label: "Height", placeholder: "e.g. 2.01", unit: "m", step: "0.01" };
    case "SCORE":
      return { label: "Score", placeholder: "e.g. 8000", unit: "pts", step: "1" };
    case "PLACEMENT":
      return { label: "Placement", placeholder: "e.g. 1 or 3h5", unit: "", step: "" };
    default:
      return { label: "Mark", placeholder: "Enter value", unit: "", step: "0.001" };
  }
}

function formatSeedMarkDisplay(
  value: number,
  resultType: CompetitionCategory["resultType"]
): string {
  switch (resultType) {
    case "TIME": {
      const totalMs = Math.round(value);
      const m = Math.floor(totalMs / 60000);
      const s = Math.floor((totalMs % 60000) / 1000);
      const cs = Math.floor((totalMs % 1000) / 10);
      if (m > 0) return `${m}:${s.toString().padStart(2, "0")}.${cs.toString().padStart(2, "0")}`;
      return `${s}.${cs.toString().padStart(2, "0")}`;
    }
    case "DISTANCE":
    case "HEIGHT":
      return `${Number(value).toFixed(2)}m`;
    case "SCORE":
      return `${value} pts`;
    case "PLACEMENT":
      return String(value);
    default:
      return String(value);
  }
}

function isSeedMarkValid(mark: SeedMarkValue): boolean {
  switch (mark.type) {
    case "TIME": {
      const hasAnyTimeValue =
        (mark.seconds !== "" && !isNaN(Number(mark.seconds))) ||
        (mark.minutes !== "" && !isNaN(Number(mark.minutes))) ||
        (mark.hours !== "" && !isNaN(Number(mark.hours)));
      return hasAnyTimeValue;
    }
    case "DISTANCE":
    case "HEIGHT":
    case "SCORE":
      return mark.value !== "" && !isNaN(Number(mark.value));
    case "PLACEMENT":
      return /^\d+$|^\d+h\d+$/.test(mark.value.trim());
    default:
      return false;
  }
}

function seedMarkToApiFields(mark: SeedMarkValue): Record<string, unknown> {
  switch (mark.type) {
    case "TIME":
      return {
        seedHours: mark.hours !== "" ? Number(mark.hours) : null,
        seedMinutes: mark.minutes !== "" ? Number(mark.minutes) : null,
        seedSeconds: mark.seconds !== "" ? Number(mark.seconds) : null,
        seedMs: mark.ms !== "" ? Number(mark.ms) : null,
        seedHandTimed: mark.handTimed,
      };
    case "DISTANCE":
    case "HEIGHT":
      return { seedDistance: mark.value !== "" ? Number(mark.value) : null };
    case "SCORE":
      return { seedPoints: mark.value !== "" ? Number(mark.value) : null };
    case "PLACEMENT":
      return { seedPlacement: mark.value.trim() || null };
    default:
      return {};
  }
}

function categoryNeedsSeedMark(cat: CompetitionCategory): boolean {
  return cat.seedMarkRequired && cat.submissionMode !== "NONE";
}

// ---------- Main Component ----------

export function CompetitionRegistrationFlow({
  competition,
  slug,
  primaryColor,
  earlyAccessCode,
}: CompetitionRegistrationFlowProps) {
  const { data: session } = useSession();
  const { addItem } = useCart();
  const stepper = useStepper();

  // State
  const [athletes, setAthletes] = useState<AthleteOption[]>([]);
  const [isLoadingAthletes, setIsLoadingAthletes] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [isCreatingAthlete, setIsCreatingAthlete] = useState(false);
  const [newAthlete, setNewAthlete] = useState({
    firstName: "",
    lastName: "",
    birthDate: "",
    gender: "",
  });

  const [selectedAthlete, setSelectedAthlete] = useState<AthleteOption | null>(null);
  const [isCheckingEligibility, setIsCheckingEligibility] = useState(false);
  const [eligibilityResult, setEligibilityResult] = useState<EligibilityResult | null>(null);

  const [selectedMembership, setSelectedMembership] = useState<AvailableMembership | null>(null);

  const [selectedCategoryIds, setSelectedCategoryIds] = useState<Set<string>>(new Set());
  const [seedMarks, setSeedMarks] = useState<Record<string, SeedMarkValue>>({});
  const [isAddingToCart, setIsAddingToCart] = useState(false);

  // Waiver state
  const [requiredWaivers, setRequiredWaivers] = useState<WaiverToSign[]>([]);
  const [currentWaiverIndex, setCurrentWaiverIndex] = useState(0);
  const [currentWaiverPages, setCurrentWaiverPages] = useState<WaiverPage[]>([]);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [isLoadingWaiver, setIsLoadingWaiver] = useState(false);
  const [isSigningWaiver, setIsSigningWaiver] = useState(false);
  const [signatureEmpty, setSignatureEmpty] = useState(true);
  const [signAllMode, setSignAllMode] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [isCheckingWaivers, setIsCheckingWaivers] = useState(false);
  const signaturePadRef = useRef<SignaturePadRef>(null);

  // Medical state
  const [medicalConfig, setMedicalConfig] = useState<MedicalFormConfig | null>(null);
  const [medicalCustomQuestions, setMedicalCustomQuestions] = useState<CustomMedicalQuestion[]>([]);
  const [isLoadingMedicalConfig, setIsLoadingMedicalConfig] = useState(false);
  const [needsMedical, setNeedsMedical] = useState(false);

  // Custom info state
  const [customInfoQuestions, setCustomInfoQuestions] = useState<CustomInfoQuestion[]>([]);
  const [customInfoResponses, setCustomInfoResponses] = useState<CustomInfoResponse[]>([]);
  const [needsCustomInfo, setNeedsCustomInfo] = useState(false);
  const [isLoadingCustomInfo, setIsLoadingCustomInfo] = useState(false);

  // File upload state
  const [uploadedFileId, setUploadedFileId] = useState<string | null>(null);

  // Navigation direction: only auto-skip completed steps on the first forward pass
  const isNavigatingBackRef = useRef(false);

  // Determine which steps are visible based on competition settings
  const needsWaivers =
    competition.hasWaiverRestriction && competition.waiverRequirementIds.length > 0;
  const needsMedicalStep = competition.hasMedicalRequirement;
  const needsFiles = competition.hasFileRequirement && !!competition.fileRequirementConfig;

  const needsSeedMarks = useMemo(() => {
    return competition.categories.some(
      (cat) => selectedCategoryIds.has(cat.id) && categoryNeedsSeedMark(cat)
    );
  }, [competition.categories, selectedCategoryIds]);

  // Ordered step IDs with conditional inclusion
  const visibleStepIds = useMemo(() => {
    const ids = ["athlete", "categories"];
    if (needsSeedMarks) ids.push("seedMarks");
    if (needsWaivers) ids.push("waivers");
    ids.push("customInfo");
    if (needsMedicalStep) ids.push("medical");
    if (needsFiles) ids.push("files");
    ids.push("review");
    return ids;
  }, [needsSeedMarks, needsWaivers, needsMedicalStep, needsFiles]);

  // Navigation helpers that skip invisible steps
  const getNextStepId = useCallback(
    (currentId: string): string | null => {
      isNavigatingBackRef.current = false;
      const idx = visibleStepIds.indexOf(currentId);
      if (idx === -1 || idx >= visibleStepIds.length - 1) return null;
      return visibleStepIds[idx + 1];
    },
    [visibleStepIds]
  );

  const getPreviousStepId = useCallback(
    (currentId: string): string | null => {
      isNavigatingBackRef.current = true;
      const idx = visibleStepIds.indexOf(currentId);
      if (idx <= 0) return null;
      return visibleStepIds[idx - 1];
    },
    [visibleStepIds]
  );

  // Fetch athletes on mount (if signed in)
  useEffect(() => {
    if (session?.user) {
      fetchAthletes();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user, slug]);

  const fetchAthletes = async () => {
    setIsLoadingAthletes(true);
    try {
      const response = await fetch(`/api/sites/${slug}/athletes`);
      if (response.ok) {
        const data = await response.json();
        setAthletes(data.athletes || []);
      }
    } catch (error) {
      console.error("Error fetching athletes:", error);
    } finally {
      setIsLoadingAthletes(false);
    }
  };

  const handleCreateAthlete = async () => {
    if (!newAthlete.firstName.trim()) {
      toast.error("First name is required");
      return;
    }
    if (!newAthlete.lastName.trim()) {
      toast.error("Last name is required");
      return;
    }
    if (!newAthlete.birthDate) {
      toast.error("Date of birth is required");
      return;
    }
    if (!newAthlete.gender) {
      toast.error("Gender declaration is required");
      return;
    }

    setIsCreatingAthlete(true);
    try {
      const response = await fetch(`/api/sites/${slug}/athletes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newAthlete),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Failed to create athlete");
      }

      const data = await response.json();
      const created = data.athlete;
      toast.success(`${created.firstName} ${created.lastName} added successfully`);
      await fetchAthletes();
      setShowCreateForm(false);
      setNewAthlete({ firstName: "", lastName: "", birthDate: "", gender: "" });

      // Auto-select and check eligibility for the newly created athlete
      const athleteOption: AthleteOption = {
        id: created.id,
        firstName: created.firstName,
        lastName: created.lastName,
        name: `${created.firstName} ${created.lastName}`,
        birthDate: created.birthDate,
        gender: created.gender,
      };
      await handleSelectAthlete(athleteOption);
    } catch (error: any) {
      toast.error(error.message || "Failed to create athlete");
    } finally {
      setIsCreatingAthlete(false);
    }
  };

  const handleSelectAthlete = async (athlete: AthleteOption) => {
    setSelectedAthlete(athlete);
    setEligibilityResult(null);
    setSelectedMembership(null);
    setSelectedCategoryIds(new Set());
    setSeedMarks({});
    setIsCheckingEligibility(true);

    try {
      const response = await fetch(
        `/api/sites/${slug}/competitions/${competition.id}/eligibility`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ athleteId: athlete.id }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to check eligibility");
      }

      const result: EligibilityResult = await response.json();
      setEligibilityResult(result);

      if (result.eligible) {
        // Auto-select membership if only one option
        if (result.requiresMembershipPurchase && result.availableMemberships.length === 1) {
          setSelectedMembership(result.availableMemberships[0]);
        }

        toast.success(
          `${athlete.firstName} is eligible! ${result.eligibleCategoryIds.length} event${result.eligibleCategoryIds.length !== 1 ? "s" : ""} available.`
        );
      }
    } catch (error) {
      toast.error("Failed to check eligibility. Please try again.");
      setSelectedAthlete(null);
    } finally {
      setIsCheckingEligibility(false);
    }
  };

  // Split athletes into competition-level eligible and ineligible
  const { eligibleAthletes, ineligibleAthletes } = useMemo(() => {
    if (!competition.hasAgeRestriction) {
      return { eligibleAthletes: athletes, ineligibleAthletes: [] as AthleteOption[] };
    }
    const eligible: AthleteOption[] = [];
    const ineligible: AthleteOption[] = [];
    for (const athlete of athletes) {
      const age = calculateAge(athlete.birthDate);
      if (isAgeEligible(age, competition.minAge, competition.maxAge)) {
        eligible.push(athlete);
      } else {
        ineligible.push(athlete);
      }
    }
    return { eligibleAthletes: eligible, ineligibleAthletes: ineligible };
  }, [athletes, competition.hasAgeRestriction, competition.minAge, competition.maxAge]);

  // Filter categories to only show eligible ones
  const eligibleCategories = useMemo(() => {
    if (!eligibilityResult) return [];
    return competition.categories.filter((cat) =>
      eligibilityResult.eligibleCategoryIds.includes(cat.id)
    );
  }, [competition.categories, eligibilityResult]);

  // Group eligible categories by event group (for display)
  const categoriesByGroup = useMemo(() => {
    const groups = new Map<string, CompetitionCategory[]>();
    for (const cat of eligibleCategories) {
      const group = cat.sportEvent?.eventGroup || "Other";
      if (!groups.has(group)) {
        groups.set(group, []);
      }
      groups.get(group)!.push(cat);
    }
    return groups;
  }, [eligibleCategories]);

  // Calculate price
  const calculatedPrice = useMemo(() => {
    const count = selectedCategoryIds.size;
    if (count === 0) return 0;

    switch (competition.pricingMode) {
      case "FREE":
        return 0;
      case "PER_COMPETITION":
        return competition.entryFee || 0;
      case "PER_EVENT":
        return (competition.entryFee || 0) * count;
      case "TIERED": {
        const tiers = [...competition.pricingTiers].sort((a, b) => a.minEvents - b.minEvents);
        let applicableTier = tiers[0];
        for (const tier of tiers) {
          if (count >= tier.minEvents && (tier.maxEvents === null || count <= tier.maxEvents)) {
            applicableTier = tier;
          }
        }
        return applicableTier ? applicableTier.pricePerEvent * count : 0;
      }
      case "PER_CATEGORY": {
        let total = 0;
        Array.from(selectedCategoryIds).forEach((catId) => {
          const cat = competition.categories.find((c) => c.id === catId);
          if (cat?.price != null) total += cat.price;
        });
        return total;
      }
      default:
        return 0;
    }
  }, [selectedCategoryIds, competition]);

  const toggleCategory = useCallback((categoryId: string) => {
    setSelectedCategoryIds((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  }, []);

  // ---------- Waiver helpers ----------

  const loadWaiverContent = useCallback(
    async (waiverId: string) => {
      setIsLoadingWaiver(true);
      try {
        const response = await fetch(
          `/api/public/waivers/${waiverId}?organizationId=${competition.organizationId}`
        );
        if (response.ok) {
          const data = await response.json();
          setCurrentWaiverPages(data.pages || []);
          setCurrentPageIndex(0);
        }
      } catch (error) {
        console.error("Failed to load waiver:", error);
      } finally {
        setIsLoadingWaiver(false);
      }
    },
    [competition.organizationId]
  );

  const handleEnterWaiversStep = useCallback(async () => {
    if (!selectedAthlete || !session?.user?.email) return;
    setIsCheckingWaivers(true);

    try {
      const checkResponse = await fetch("/api/public/waivers/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: session.user.email,
          waiverIds: competition.waiverRequirementIds,
          organizationId: competition.organizationId,
          athleteId: selectedAthlete.id,
        }),
      });

      if (!checkResponse.ok) throw new Error("Failed to check waiver status");

      const checkData = await checkResponse.json();
      setUserId(checkData.userId);

      const stillUnsigned: WaiverToSign[] = (checkData.data || []).filter(
        (w: WaiverToSign) => !w.isSigned
      );

      if (stillUnsigned.length === 0) {
        if (!isNavigatingBackRef.current) {
          const nextId = getNextStepId("waivers");
          if (nextId) stepper.navigation.goTo(nextId as any);
        }
        return;
      }

      setRequiredWaivers(stillUnsigned);
      setCurrentWaiverIndex(0);
      setSignAllMode(false);
      signaturePadRef.current?.clear();
      setSignatureEmpty(true);
      await loadWaiverContent(stillUnsigned[0].waiverId);
    } catch (error) {
      console.error("Failed to check waivers:", error);
      toast.error("Failed to check waiver requirements. Please try again.");
    } finally {
      setIsCheckingWaivers(false);
    }
  }, [
    selectedAthlete,
    session?.user?.email,
    competition.waiverRequirementIds,
    competition.organizationId,
    getNextStepId,
    loadWaiverContent,
    stepper.navigation,
  ]);

  const handleSignCurrentPage = useCallback(async () => {
    if (signaturePadRef.current?.isEmpty()) {
      toast.error("Please provide your signature");
      return;
    }

    const signatureData = signaturePadRef.current!.toDataURL();
    setIsSigningWaiver(true);

    try {
      const currentWaiver = requiredWaivers[currentWaiverIndex];

      const pagesToSign = signAllMode
        ? currentWaiverPages.map((page) => ({
            waiverPageId: page.id,
            signatureData,
          }))
        : [
            {
              waiverPageId: currentWaiverPages[currentPageIndex].id,
              signatureData,
            },
          ];

      const response = await fetch(`/api/public/waivers/${currentWaiver.waiverId}/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: competition.organizationId,
          userId,
          athleteId: selectedAthlete?.id || null,
          email: session?.user?.email,
          name: session?.user?.name || "",
          signatures: pagesToSign,
        }),
      });

      if (!response.ok) throw new Error("Failed to sign waiver");

      const result = await response.json();
      setUserId(result.userId);

      if (result.allPagesSigned || signAllMode) {
        toast.success(`"${currentWaiver.waiverTitle}" signed successfully`);

        if (currentWaiverIndex < requiredWaivers.length - 1) {
          const nextIndex = currentWaiverIndex + 1;
          setCurrentWaiverIndex(nextIndex);
          setSignAllMode(false);
          signaturePadRef.current?.clear();
          setSignatureEmpty(true);
          await loadWaiverContent(requiredWaivers[nextIndex].waiverId);
        } else {
          // All waivers signed -- advance to next step
          const nextId = getNextStepId("waivers");
          if (nextId) stepper.navigation.goTo(nextId as any);
        }
      } else {
        // More pages to sign for this waiver
        setCurrentPageIndex((prev) => prev + 1);
        signaturePadRef.current?.clear();
        setSignatureEmpty(true);
      }
    } catch (error: any) {
      console.error("Failed to sign waiver:", error);
      toast.error(error.message || "Failed to sign waiver");
    } finally {
      setIsSigningWaiver(false);
    }
  }, [
    requiredWaivers,
    currentWaiverIndex,
    currentWaiverPages,
    currentPageIndex,
    signAllMode,
    competition.organizationId,
    userId,
    selectedAthlete?.id,
    session?.user?.email,
    session?.user?.name,
    getNextStepId,
    loadWaiverContent,
    stepper.navigation,
  ]);

  // ---------- Custom info helpers ----------

  const handleEnterCustomInfoStep = useCallback(async () => {
    if (!selectedAthlete) return;
    setIsLoadingCustomInfo(true);

    try {
      const params = new URLSearchParams({
        organizationId: competition.organizationId,
        competitionIds: competition.id,
      });

      const questionsRes = await fetch(`/api/public/custom-information?${params}`);
      if (!questionsRes.ok) {
        setNeedsCustomInfo(false);
        if (!isNavigatingBackRef.current) {
          const nextId = getNextStepId("customInfo");
          if (nextId) stepper.navigation.goTo(nextId as any);
        }
        return;
      }

      const { questions } = await questionsRes.json();
      if (!questions || questions.length === 0) {
        setNeedsCustomInfo(false);
        if (!isNavigatingBackRef.current) {
          const nextId = getNextStepId("customInfo");
          if (nextId) stepper.navigation.goTo(nextId as any);
        }
        return;
      }

      const responsesRes = await fetch(
        `/api/public/athletes/${selectedAthlete.id}/custom-information?organizationId=${competition.organizationId}&email=${encodeURIComponent(session?.user?.email || "")}`
      );
      if (responsesRes.ok) {
        const { responses, isCurrent } = await responsesRes.json();
        if (isCurrent && responses.length >= questions.length) {
          setNeedsCustomInfo(false);
          if (!isNavigatingBackRef.current) {
            const nextId = getNextStepId("customInfo");
            if (nextId) stepper.navigation.goTo(nextId as any);
          }
          return;
        }
        setCustomInfoResponses(responses || []);
      }

      setCustomInfoQuestions(questions);
      setNeedsCustomInfo(true);
    } catch (error) {
      console.error("Failed to load custom info:", error);
      setNeedsCustomInfo(false);
      if (!isNavigatingBackRef.current) {
        const nextId = getNextStepId("customInfo");
        if (nextId) stepper.navigation.goTo(nextId as any);
      }
    } finally {
      setIsLoadingCustomInfo(false);
    }
  }, [
    selectedAthlete,
    competition.organizationId,
    competition.id,
    session?.user?.email,
    getNextStepId,
    stepper.navigation,
  ]);

  // ---------- Medical helpers ----------

  const handleEnterMedicalStep = useCallback(async () => {
    if (!selectedAthlete) return;
    setIsLoadingMedicalConfig(true);

    try {
      const medicalCheckResponse = await fetch(
        `/api/public/athletes/${selectedAthlete.id}/medical?organizationId=${competition.organizationId}&email=${encodeURIComponent(session?.user?.email || "")}`
      );

      if (medicalCheckResponse.ok) {
        const data = await medicalCheckResponse.json();
        if (data.isCurrent) {
          setNeedsMedical(false);
          if (!isNavigatingBackRef.current) {
            const nextId = getNextStepId("medical");
            if (nextId) stepper.navigation.goTo(nextId as any);
          }
          return;
        }
      }

      const configResponse = await fetch(
        `/api/public/medical-config?organizationId=${competition.organizationId}`
      );

      if (configResponse.ok) {
        const configData = await configResponse.json();
        setMedicalConfig(configData.config);
        setMedicalCustomQuestions(configData.customQuestions || []);
        setNeedsMedical(true);
      }
    } catch (error) {
      console.error("Failed to load medical config:", error);
      toast.error("Failed to load medical form. Please try again.");
    } finally {
      setIsLoadingMedicalConfig(false);
    }
  }, [
    selectedAthlete,
    competition.organizationId,
    session?.user?.email,
    getNextStepId,
    stepper.navigation,
  ]);

  // ---------- Step transition: categories -> next ----------

  const handleProceedFromCategories = useCallback(async () => {
    const nextId = getNextStepId("categories");
    if (!nextId) return;
    stepper.navigation.goTo(nextId as any);
  }, [getNextStepId, stepper.navigation]);

  // ---------- Step transition: seedMarks -> next ----------

  const handleProceedFromSeedMarks = useCallback(async () => {
    const nextId = getNextStepId("seedMarks");
    if (!nextId) return;
    stepper.navigation.goTo(nextId as any);
  }, [getNextStepId, stepper.navigation]);

  // Categories that require seed mark input from the user
  const categoriesNeedingSeedMark = useMemo(() => {
    return competition.categories.filter(
      (cat) => selectedCategoryIds.has(cat.id) && categoryNeedsSeedMark(cat)
    );
  }, [competition.categories, selectedCategoryIds]);

  const canProceedFromSeedMarks = useMemo(() => {
    return categoriesNeedingSeedMark.every((cat) => {
      const mark = seedMarks[cat.id];
      return mark !== undefined && isSeedMarkValid(mark);
    });
  }, [categoriesNeedingSeedMark, seedMarks]);

  // Membership price for the review/total
  const membershipPrice =
    eligibilityResult?.requiresMembershipPurchase && selectedMembership
      ? selectedMembership.price
      : 0;

  const combinedTotal = calculatedPrice + membershipPrice;

  const handleAddToCart = () => {
    if (!selectedAthlete || selectedCategoryIds.size === 0) return;

    setIsAddingToCart(true);

    const athleteName = `${selectedAthlete.firstName} ${selectedAthlete.lastName}`.trim();

    // Add membership to cart first if required
    if (eligibilityResult?.requiresMembershipPurchase && selectedMembership) {
      addItem({
        referenceId: selectedMembership.id,
        type: "membership",
        name: selectedMembership.name,
        description: `${selectedMembership.groupName} Membership`,
        price: selectedMembership.price,
        quantity: 1,
        athleteId: selectedAthlete.id,
        athleteName,
        details: {
          membershipInstanceId: selectedMembership.id,
          groupId: selectedMembership.groupId,
          groupName: selectedMembership.groupName,
          billingInterval: selectedMembership.billingInterval,
        },
      });
    }

    const selectedCats = competition.categories.filter((c) => selectedCategoryIds.has(c.id));
    const eventSummary = selectedCats.map((c) => getCategoryLabel(c)).join(", ");

    // Convert structured seed marks to API-ready objects
    const structuredSeedMarks: Record<string, Record<string, unknown>> = {};
    for (const [catId, mark] of Object.entries(seedMarks)) {
      if (selectedCategoryIds.has(catId) && isSeedMarkValid(mark)) {
        structuredSeedMarks[catId] = seedMarkToApiFields(mark);
      }
    }

    addItem({
      referenceId: competition.id,
      type: "competition",
      name: `${competition.name} – ${selectedCats.length} event${selectedCats.length !== 1 ? "s" : ""}`,
      description: eventSummary,
      price: calculatedPrice,
      quantity: 1,
      athleteId: selectedAthlete.id,
      athleteName,
      details: {
        competitionId: competition.id,
        competitionName: competition.name,
        categoryIds: Array.from(selectedCategoryIds),
        pricingMode: competition.pricingMode,
        entryFee: competition.entryFee,
        requiredMemberships: selectedMembership ? [selectedMembership.id] : [],
        ...(Object.keys(structuredSeedMarks).length > 0 && { seedMarks: structuredSeedMarks }),
        ...(uploadedFileId && { fileUploadId: uploadedFileId }),
        ...(earlyAccessCode && { earlyAccessCode }),
      },
    });

    setIsAddingToCart(false);

    // Reset for another registration
    setSelectedAthlete(null);
    setEligibilityResult(null);
    setSelectedMembership(null);
    setSelectedCategoryIds(new Set());
    setSeedMarks({});
    stepper.navigation.goTo("athlete");
  };

  // ---------- Auth gate ----------

  if (!session?.user) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <User className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
          <h2 className="text-xl font-semibold mb-2">Sign In to Register</h2>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            You need to be signed in to register for this competition.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button onClick={() => signIn(undefined, { callbackUrl: window.location.href })}>
              Sign In
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                window.location.href = "/signup";
              }}
            >
              Create Account
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ---------- Stepper rendering ----------

  const allSteps = stepper.state.all;
  const currentStepId = stepper.state.current.data.id;

  // Only show steps that are relevant to this competition
  const visibleSteps = allSteps.filter((s: { id: string }) => visibleStepIds.includes(s.id));
  const currentVisibleIndex = visibleSteps.findIndex((s: { id: string }) => s.id === currentStepId);

  const canProceedToCategories =
    selectedAthlete !== null &&
    eligibilityResult?.eligible === true &&
    (!eligibilityResult?.requiresMembershipPurchase || selectedMembership !== null);

  const canProceedToReview = selectedCategoryIds.size > 0;

  const ageLabel =
    competition.hasAgeRestriction && (competition.minAge != null || competition.maxAge != null)
      ? competition.minAge != null && competition.maxAge != null
        ? `Ages ${competition.minAge}–${competition.maxAge}`
        : competition.minAge != null
          ? `Ages ${competition.minAge}+`
          : `Up to age ${competition.maxAge}`
      : null;

  return (
    <div className="space-y-8">
      {/* Stepper Navigation */}
      <StepperNav>
        {visibleSteps.map((step: { id: string; title: string }, index: number) => {
          const status = getStepStatus(index, currentVisibleIndex);
          return (
            <div key={step.id} className="flex items-center flex-1 last:flex-initial">
              <StepperItem status={status}>
                <StepperIndicator status={status} step={index + 1} />
                <StepperTitle status={status}>{step.title}</StepperTitle>
              </StepperItem>
              {index < visibleSteps.length - 1 && (
                <StepperSeparator status={status} className="mx-2" />
              )}
            </div>
          );
        })}
      </StepperNav>

      {/* Step 1: Select Athlete */}
      {currentStepId === "athlete" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Who is competing?
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingAthletes ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : showCreateForm ? (
              /* Create New Athlete Form */
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="comp-athlete-first">First Name</Label>
                    <Input
                      id="comp-athlete-first"
                      value={newAthlete.firstName}
                      onChange={(e) =>
                        setNewAthlete((prev) => ({ ...prev, firstName: e.target.value }))
                      }
                      placeholder="First name"
                      disabled={isCreatingAthlete}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="comp-athlete-last">Last Name</Label>
                    <Input
                      id="comp-athlete-last"
                      value={newAthlete.lastName}
                      onChange={(e) =>
                        setNewAthlete((prev) => ({ ...prev, lastName: e.target.value }))
                      }
                      placeholder="Last name"
                      disabled={isCreatingAthlete}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Date of Birth</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={isCreatingAthlete}
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !newAthlete.birthDate && "text-muted-foreground"
                        )}
                      >
                        <Calendar className="mr-2 h-4 w-4" />
                        {newAthlete.birthDate
                          ? format(new Date(newAthlete.birthDate + "T12:00:00Z"), "PPP")
                          : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarPicker
                        mode="single"
                        selected={
                          newAthlete.birthDate
                            ? new Date(newAthlete.birthDate + "T12:00:00Z")
                            : undefined
                        }
                        onSelect={(date) =>
                          setNewAthlete((prev) => ({
                            ...prev,
                            birthDate: date ? format(date, "yyyy-MM-dd") : "",
                          }))
                        }
                        captionLayout="dropdown"
                        fromYear={1940}
                        toYear={new Date().getFullYear()}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="comp-athlete-gender">Gender Declaration</Label>
                  <Select
                    value={newAthlete.gender}
                    onValueChange={(value) => setNewAthlete((prev) => ({ ...prev, gender: value }))}
                    disabled={isCreatingAthlete}
                  >
                    <SelectTrigger id="comp-athlete-gender">
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MALE">Male</SelectItem>
                      <SelectItem value="FEMALE">Female</SelectItem>
                      <SelectItem value="OTHER">Other</SelectItem>
                      <SelectItem value="PREFER_NOT_TO_SAY">Prefer Not to Say</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => setShowCreateForm(false)}
                    disabled={isCreatingAthlete}
                    className="flex-1"
                  >
                    <ChevronLeft className="mr-1 h-4 w-4" />
                    Back
                  </Button>
                  <Button
                    onClick={handleCreateAthlete}
                    disabled={isCreatingAthlete}
                    className="flex-1"
                  >
                    {isCreatingAthlete && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Add Athlete
                  </Button>
                </div>
              </div>
            ) : (
              /* Athlete Selection */
              <div className="space-y-3">
                {/* Age restriction banner */}
                {ageLabel && (
                  <div className="flex items-center gap-2 text-xs font-medium text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 px-3 py-2 rounded-lg">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    This competition requires athletes to be {ageLabel.toLowerCase()}
                  </div>
                )}

                {/* Eligibility checking indicator */}
                {isCheckingEligibility && (
                  <div className="flex items-center gap-2 text-xs font-medium text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 rounded-lg">
                    <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
                    Checking eligibility...
                  </div>
                )}

                {/* Eligibility error */}
                {eligibilityResult && !eligibilityResult.eligible && (
                  <div className="flex items-start gap-2 text-xs font-medium text-destructive bg-destructive/10 px-3 py-2 rounded-lg">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold mb-1">
                        {selectedAthlete?.firstName} is not eligible for this competition
                      </p>
                      <ul className="list-disc list-inside space-y-0.5">
                        {eligibilityResult.reasons.map((r, i) => (
                          <li key={i}>{r}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}

                {/* Selected athlete confirmation */}
                {selectedAthlete && eligibilityResult?.eligible && (
                  <div className="flex items-center gap-3 p-3 rounded-lg border border-primary/40 bg-primary/5">
                    <div className="flex items-center justify-center h-10 w-10 rounded-full bg-primary/10 text-primary shrink-0">
                      <Check className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">
                        {selectedAthlete.firstName} {selectedAthlete.lastName}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Eligible – {eligibilityResult.eligibleCategoryIds.length} event
                        {eligibilityResult.eligibleCategoryIds.length !== 1 ? "s" : ""} available
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedAthlete(null);
                        setEligibilityResult(null);
                        setSelectedMembership(null);
                        setSelectedCategoryIds(new Set());
                      }}
                    >
                      Change
                    </Button>
                  </div>
                )}

                {/* Membership purchase banner */}
                {selectedAthlete &&
                  eligibilityResult?.eligible &&
                  eligibilityResult.requiresMembershipPurchase && (
                    <div className="rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 p-3 space-y-2">
                      <div className="flex items-center gap-2 text-sm font-medium text-amber-800 dark:text-amber-300">
                        <Shield className="h-4 w-4 shrink-0" />
                        Membership Required
                      </div>
                      {eligibilityResult.availableMemberships.length === 1 ? (
                        <div className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-400">
                          <CreditCard className="h-3.5 w-3.5 shrink-0" />
                          <span>
                            <strong>{eligibilityResult.availableMemberships[0].name}</strong> (
                            {formatPrice(eligibilityResult.availableMemberships[0].price)}) will be
                            added to your cart.
                          </span>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <p className="text-xs text-amber-700 dark:text-amber-400">
                            Select a membership to continue:
                          </p>
                          <Select
                            value={selectedMembership?.id ?? ""}
                            onValueChange={(value) => {
                              const membership = eligibilityResult.availableMemberships.find(
                                (m) => m.id === value
                              );
                              setSelectedMembership(membership ?? null);
                            }}
                          >
                            <SelectTrigger className="bg-white dark:bg-background">
                              <SelectValue placeholder="Choose a membership" />
                            </SelectTrigger>
                            <SelectContent>
                              {eligibilityResult.availableMemberships.map((m) => (
                                <SelectItem key={m.id} value={m.id}>
                                  {m.name} – {formatPrice(m.price)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>
                  )}

                {/* Athlete list (only show if no athlete selected or eligibility failed) */}
                {(!selectedAthlete || (eligibilityResult && !eligibilityResult.eligible)) && (
                  <>
                    {athletes.length > 0 && (
                      <div className="space-y-2 max-h-[300px] overflow-y-auto">
                        {eligibleAthletes.map((athlete) => {
                          const displayName = `${athlete.firstName} ${athlete.lastName}`.trim();
                          const birthLabel = athlete.birthDate
                            ? new Date(athlete.birthDate).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })
                            : null;
                          const genderLabel = athlete.gender
                            ? GENDER_LABELS[athlete.gender] || athlete.gender
                            : null;

                          return (
                            <button
                              key={athlete.id}
                              onClick={() => handleSelectAthlete(athlete)}
                              disabled={isCheckingEligibility}
                              className="w-full flex items-center gap-3 p-3 rounded-lg border border-border bg-card hover:bg-accent hover:border-primary/40 transition-colors text-left disabled:opacity-50"
                            >
                              <div className="flex items-center justify-center h-10 w-10 rounded-full bg-primary/10 text-primary shrink-0">
                                <User className="h-5 w-5" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-sm truncate">{displayName}</div>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                                  {birthLabel && (
                                    <span className="flex items-center gap-1">
                                      <Calendar className="h-3 w-3" />
                                      {birthLabel}
                                    </span>
                                  )}
                                  {genderLabel && <span>{genderLabel}</span>}
                                </div>
                              </div>
                            </button>
                          );
                        })}

                        {ineligibleAthletes.length > 0 && (
                          <>
                            <div className="pt-2 pb-1">
                              <p className="text-xs font-medium text-muted-foreground">
                                Ineligible for this competition
                              </p>
                            </div>
                            {ineligibleAthletes.map((athlete) => {
                              const displayName = `${athlete.firstName} ${athlete.lastName}`.trim();
                              const age = calculateAge(athlete.birthDate);

                              return (
                                <div
                                  key={athlete.id}
                                  className="w-full flex items-center gap-3 p-3 rounded-lg border border-border bg-card opacity-50 cursor-not-allowed text-left"
                                >
                                  <div className="flex items-center justify-center h-10 w-10 rounded-full bg-muted text-muted-foreground shrink-0">
                                    <User className="h-5 w-5" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="font-medium text-sm truncate">
                                      {displayName}
                                    </div>
                                    <div className="text-xs text-destructive mt-1">
                                      Age {age} — requires {ageLabel?.toLowerCase()}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </>
                        )}
                      </div>
                    )}

                    {athletes.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No athletes found on your account. Add one to get started.
                      </p>
                    )}

                    <Button
                      variant="outline"
                      className="w-full gap-2"
                      onClick={() => setShowCreateForm(true)}
                    >
                      <Plus className="h-4 w-4" />
                      Add New Athlete
                    </Button>
                  </>
                )}

                {/* Next button */}
                {canProceedToCategories && (
                  <div className="pt-4">
                    <Button
                      className="w-full gap-2"
                      onClick={() => stepper.navigation.goTo("categories")}
                    >
                      Continue to Event Selection
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 2: Select Events/Categories */}
      {currentStepId === "categories" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Tag className="h-5 w-5" />
              Select Events for {selectedAthlete?.firstName}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {eligibleCategories.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p>No eligible events found for this athlete.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {Array.from(categoriesByGroup.entries()).map(([groupName, cats]) => (
                  <div key={groupName}>
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                      {groupName}
                    </h3>
                    <div className="space-y-2">
                      {cats.map((cat) => {
                        const isSelected = selectedCategoryIds.has(cat.id);
                        const label = getCategoryLabel(cat);
                        const showPrice =
                          competition.pricingMode === "PER_CATEGORY" && cat.price != null;

                        return (
                          <label
                            key={cat.id}
                            className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                              isSelected
                                ? "border-primary/40 bg-primary/5"
                                : "border-border hover:bg-accent"
                            }`}
                          >
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => toggleCategory(cat.id)}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-sm">{label}</div>
                              {cat.isTeamEvent && (
                                <Badge variant="secondary" className="mt-1 text-[10px]">
                                  Team Event
                                </Badge>
                              )}
                            </div>
                            {showPrice && (
                              <span className="text-sm font-medium text-muted-foreground">
                                {formatPrice(cat.price!)}
                              </span>
                            )}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}

                {/* Pricing summary */}
                <div className="rounded-lg border bg-muted/30 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      {selectedCategoryIds.size} event{selectedCategoryIds.size !== 1 ? "s" : ""}{" "}
                      selected
                    </span>
                    <span className="text-lg font-bold">{formatPrice(calculatedPrice)}</span>
                  </div>
                  {competition.pricingMode === "TIERED" && competition.pricingTiers.length > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Tiered pricing applies – more events may lower your per-event cost
                    </p>
                  )}
                </div>

                {/* Navigation */}
                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => stepper.navigation.goTo("athlete")}
                    className="gap-2"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Back
                  </Button>
                  <Button
                    className="flex-1 gap-2"
                    disabled={!canProceedToReview}
                    onClick={handleProceedFromCategories}
                  >
                    Continue
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step: Seed Marks */}
      {currentStepId === "seedMarks" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gauge className="h-5 w-5" />
              Enter Seed Marks
            </CardTitle>
            <CardDescription>
              Provide qualifying marks for the selected events. These will be reviewed by the
              competition organizer.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {categoriesNeedingSeedMark.map((cat) => {
                const meta = getSeedMarkMeta(cat.resultType);
                const mark = seedMarks[cat.id] ?? defaultSeedMark(cat.resultType);

                const updateMark = (updater: (prev: SeedMarkValue) => SeedMarkValue) => {
                  setSeedMarks((prev) => ({
                    ...prev,
                    [cat.id]: updater(prev[cat.id] ?? defaultSeedMark(cat.resultType)),
                  }));
                };

                return (
                  <div key={cat.id} className="space-y-2">
                    <Label className="text-sm font-medium">{getCategoryLabel(cat)}</Label>

                    {cat.resultType === "TIME" && mark.type === "TIME" ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-1.5">
                          <div className="flex-1">
                            <Input
                              type="number"
                              min="0"
                              placeholder="H"
                              value={mark.hours}
                              onChange={(e) =>
                                updateMark((prev) =>
                                  prev.type === "TIME" ? { ...prev, hours: e.target.value } : prev
                                )
                              }
                              className="text-center"
                            />
                          </div>
                          <span className="text-muted-foreground font-medium">:</span>
                          <div className="flex-1">
                            <Input
                              type="number"
                              min="0"
                              max="59"
                              placeholder="M"
                              value={mark.minutes}
                              onChange={(e) =>
                                updateMark((prev) =>
                                  prev.type === "TIME" ? { ...prev, minutes: e.target.value } : prev
                                )
                              }
                              className="text-center"
                            />
                          </div>
                          <span className="text-muted-foreground font-medium">:</span>
                          <div className="flex-1">
                            <Input
                              type="number"
                              min="0"
                              max="59"
                              placeholder="S"
                              value={mark.seconds}
                              onChange={(e) =>
                                updateMark((prev) =>
                                  prev.type === "TIME" ? { ...prev, seconds: e.target.value } : prev
                                )
                              }
                              className="text-center"
                            />
                          </div>
                          <span className="text-muted-foreground font-medium">.</span>
                          <div className="flex-1">
                            <Input
                              type="number"
                              min="0"
                              max="999"
                              placeholder="ms"
                              value={mark.ms}
                              onChange={(e) =>
                                updateMark((prev) =>
                                  prev.type === "TIME" ? { ...prev, ms: e.target.value } : prev
                                )
                              }
                              className="text-center"
                            />
                          </div>
                        </div>
                        <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
                          <Checkbox
                            checked={mark.handTimed}
                            onCheckedChange={(checked) =>
                              updateMark((prev) =>
                                prev.type === "TIME" ? { ...prev, handTimed: !!checked } : prev
                              )
                            }
                          />
                          Hand-timed
                        </label>
                      </div>
                    ) : cat.resultType === "PLACEMENT" && mark.type === "PLACEMENT" ? (
                      <Input
                        placeholder={meta.placeholder}
                        value={mark.value}
                        onChange={(e) =>
                          updateMark((prev) =>
                            prev.type === "PLACEMENT" ? { ...prev, value: e.target.value } : prev
                          )
                        }
                      />
                    ) : (
                      <div className="flex items-center gap-3">
                        <div className="flex-1">
                          <Input
                            type="number"
                            step={meta.step}
                            min="0"
                            placeholder={meta.placeholder}
                            value={"value" in mark ? mark.value : ""}
                            onChange={(e) =>
                              updateMark((prev) =>
                                "value" in prev ? { ...prev, value: e.target.value } : prev
                              )
                            }
                          />
                        </div>
                        {meta.unit && (
                          <span className="text-sm text-muted-foreground shrink-0 w-16">
                            {meta.unit}
                          </span>
                        )}
                      </div>
                    )}

                    {cat.qualifyingMark != null && (
                      <p className="text-xs text-muted-foreground">
                        Qualifying mark: {formatSeedMarkDisplay(cat.qualifyingMark, cat.resultType)}
                      </p>
                    )}
                  </div>
                );
              })}

              {/* Navigation */}
              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    const prevId = getPreviousStepId("seedMarks");
                    if (prevId) stepper.navigation.goTo(prevId as any);
                  }}
                  className="gap-2"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Back
                </Button>
                <Button
                  className="flex-1 gap-2"
                  disabled={!canProceedFromSeedMarks}
                  onClick={handleProceedFromSeedMarks}
                >
                  Continue
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step: Sign Waivers */}
      {currentStepId === "waivers" && (
        <WaiverStep
          isCheckingWaivers={isCheckingWaivers}
          isLoadingWaiver={isLoadingWaiver}
          isSigningWaiver={isSigningWaiver}
          requiredWaivers={requiredWaivers}
          currentWaiverIndex={currentWaiverIndex}
          currentWaiverPages={currentWaiverPages}
          currentPageIndex={currentPageIndex}
          signAllMode={signAllMode}
          signatureEmpty={signatureEmpty}
          signaturePadRef={signaturePadRef}
          selectedAthleteName={selectedAthlete?.firstName || ""}
          onEnterStep={handleEnterWaiversStep}
          onSign={handleSignCurrentPage}
          onSetSignAllMode={setSignAllMode}
          onSetSignatureEmpty={setSignatureEmpty}
          onBack={() => {
            const prevId = getPreviousStepId("waivers");
            if (prevId) stepper.navigation.goTo(prevId as any);
          }}
          onContinue={() => {
            const nextId = getNextStepId("waivers");
            if (nextId) stepper.navigation.goTo(nextId as any);
          }}
        />
      )}

      {/* Step: Custom Info */}
      {currentStepId === "customInfo" && (
        <CustomInfoStepComp
          isLoading={isLoadingCustomInfo}
          needsCustomInfo={needsCustomInfo}
          questions={customInfoQuestions}
          existingResponses={customInfoResponses}
          athleteId={selectedAthlete?.id || ""}
          organizationId={competition.organizationId}
          onEnterStep={handleEnterCustomInfoStep}
          onComplete={() => {
            const nextId = getNextStepId("customInfo");
            if (nextId) stepper.navigation.goTo(nextId as any);
          }}
          onBack={() => {
            const prevId = getPreviousStepId("customInfo");
            if (prevId) stepper.navigation.goTo(prevId as any);
          }}
        />
      )}

      {/* Step: Medical Info */}
      {currentStepId === "medical" && (
        <MedicalStep
          isLoadingConfig={isLoadingMedicalConfig}
          needsMedical={needsMedical}
          medicalConfig={medicalConfig}
          medicalCustomQuestions={medicalCustomQuestions}
          organizationId={competition.organizationId}
          athleteId={selectedAthlete?.id || ""}
          athleteName={`${selectedAthlete?.firstName || ""} ${selectedAthlete?.lastName || ""}`.trim()}
          email={session?.user?.email || ""}
          onEnterStep={handleEnterMedicalStep}
          onComplete={() => {
            const nextId = getNextStepId("medical");
            if (nextId) stepper.navigation.goTo(nextId as any);
          }}
          onBack={() => {
            const prevId = getPreviousStepId("medical");
            if (prevId) stepper.navigation.goTo(prevId as any);
          }}
        />
      )}

      {/* Step: File Upload */}
      {currentStepId === "files" && needsFiles && competition.fileRequirementConfig && (
        <FileUploadStep
          config={competition.fileRequirementConfig}
          organizationId={competition.organizationId}
          athleteId={selectedAthlete?.id || ""}
          competitionId={competition.id}
          onComplete={(fileId) => {
            setUploadedFileId(fileId);
            const nextId = getNextStepId("files");
            if (nextId) stepper.navigation.goTo(nextId as any);
          }}
          onBack={() => {
            const prevId = getPreviousStepId("files");
            if (prevId) stepper.navigation.goTo(prevId as any);
          }}
        />
      )}

      {/* Step: Review & Add to Cart */}
      {currentStepId === "review" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5" />
              Review Registration
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Athlete */}
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Athlete
                </h3>
                <div className="flex items-center gap-3 p-3 rounded-lg border bg-card">
                  <div className="flex items-center justify-center h-10 w-10 rounded-full bg-primary/10 text-primary shrink-0">
                    <User className="h-5 w-5" />
                  </div>
                  <div className="font-medium text-sm">
                    {selectedAthlete?.firstName} {selectedAthlete?.lastName}
                  </div>
                </div>
              </div>

              {/* Selected Events */}
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Events ({selectedCategoryIds.size})
                </h3>
                <div className="space-y-1.5">
                  {competition.categories
                    .filter((c) => selectedCategoryIds.has(c.id))
                    .map((cat) => {
                      const seedVal = seedMarks[cat.id];
                      const hasSeedMark =
                        categoryNeedsSeedMark(cat) && seedVal && !isNaN(Number(seedVal));

                      return (
                        <div
                          key={cat.id}
                          className="flex items-center justify-between p-2 rounded-lg border bg-card"
                        >
                          <div className="min-w-0">
                            <span className="text-sm">{getCategoryLabel(cat)}</span>
                            {hasSeedMark && (
                              <span className="ml-2 text-xs text-muted-foreground">
                                Seed: {formatSeedMarkDisplay(Number(seedVal), cat.resultType)}
                              </span>
                            )}
                          </div>
                          {competition.pricingMode === "PER_CATEGORY" && cat.price != null && (
                            <span className="text-sm text-muted-foreground shrink-0">
                              {formatPrice(cat.price)}
                            </span>
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* Membership (if required) */}
              {eligibilityResult?.requiresMembershipPurchase && selectedMembership && (
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    Required Membership
                  </h3>
                  <div className="flex items-center justify-between p-2 rounded-lg border bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800">
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                      <span className="text-sm">{selectedMembership.name}</span>
                    </div>
                    <span className="text-sm font-medium">
                      {formatPrice(selectedMembership.price)}
                    </span>
                  </div>
                </div>
              )}

              {/* Price Breakdown */}
              <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {competition.pricingMode === "FREE"
                      ? "Free Entry"
                      : competition.pricingMode === "PER_COMPETITION"
                        ? "Competition Entry Fee"
                        : competition.pricingMode === "PER_EVENT"
                          ? `${selectedCategoryIds.size} event${selectedCategoryIds.size !== 1 ? "s" : ""} × ${formatPrice(competition.entryFee || 0)}`
                          : competition.pricingMode === "TIERED"
                            ? `${selectedCategoryIds.size} event${selectedCategoryIds.size !== 1 ? "s" : ""} (tiered pricing)`
                            : `${selectedCategoryIds.size} event${selectedCategoryIds.size !== 1 ? "s" : ""}`}
                  </span>
                  <span className="font-medium">{formatPrice(calculatedPrice)}</span>
                </div>
                {eligibilityResult?.requiresMembershipPurchase && selectedMembership && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {selectedMembership.name} (Membership)
                    </span>
                    <span className="font-medium">{formatPrice(selectedMembership.price)}</span>
                  </div>
                )}
                <div className="border-t pt-2 flex items-center justify-between">
                  <span className="font-semibold">Total</span>
                  <span className="text-lg font-bold">{formatPrice(combinedTotal)}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    const prevId = getPreviousStepId("review");
                    if (prevId) stepper.navigation.goTo(prevId as any);
                  }}
                  className="gap-2"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Back
                </Button>
                <Button
                  className="flex-1 gap-2"
                  onClick={handleAddToCart}
                  disabled={isAddingToCart}
                >
                  {isAddingToCart ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ShoppingCart className="h-4 w-4" />
                  )}
                  Add to Cart
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ---------- Waiver Step Sub-component ----------

function WaiverStep({
  isCheckingWaivers,
  isLoadingWaiver,
  isSigningWaiver,
  requiredWaivers,
  currentWaiverIndex,
  currentWaiverPages,
  currentPageIndex,
  signAllMode,
  signatureEmpty,
  signaturePadRef,
  selectedAthleteName,
  onEnterStep,
  onSign,
  onSetSignAllMode,
  onSetSignatureEmpty,
  onBack,
  onContinue,
}: {
  isCheckingWaivers: boolean;
  isLoadingWaiver: boolean;
  isSigningWaiver: boolean;
  requiredWaivers: WaiverToSign[];
  currentWaiverIndex: number;
  currentWaiverPages: WaiverPage[];
  currentPageIndex: number;
  signAllMode: boolean;
  signatureEmpty: boolean;
  signaturePadRef: React.RefObject<SignaturePadRef>;
  selectedAthleteName: string;
  onEnterStep: () => void;
  onSign: () => void;
  onSetSignAllMode: (v: boolean) => void;
  onSetSignatureEmpty: (v: boolean) => void;
  onBack: () => void;
  onContinue: () => void;
}) {
  useEffect(() => {
    onEnterStep();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (isCheckingWaivers) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">Checking waiver requirements...</p>
        </CardContent>
      </Card>
    );
  }

  if (requiredWaivers.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Check className="h-8 w-8 text-primary mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">All waivers have been signed.</p>
          <a
            href={`${getClientSubdomainUrl("athletes")}/waivers`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-primary hover:underline mt-2"
          >
            <FileText className="h-3.5 w-3.5" />
            View signed waivers
            <ExternalLink className="h-3 w-3" />
          </a>
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button variant="outline" onClick={onBack}>
            <ChevronLeft className="mr-1 h-4 w-4" />
            Back
          </Button>
          <Button onClick={onContinue}>
            Continue
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Waiver Required
          <span className="text-sm font-normal text-muted-foreground">
            — for {selectedAthleteName}
          </span>
        </CardTitle>
        <CardDescription>
          Please review and sign the following waiver
          {requiredWaivers.length > 1 ? "s" : ""} before proceeding.
          {requiredWaivers.length > 1 && (
            <span className="block mt-1">
              Waiver {currentWaiverIndex + 1} of {requiredWaivers.length}:{" "}
              <strong>{requiredWaivers[currentWaiverIndex]?.waiverTitle}</strong>
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {isLoadingWaiver ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Page indicator */}
            {currentWaiverPages.length > 1 && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                Page {currentPageIndex + 1} of {currentWaiverPages.length}
                {currentWaiverPages[currentPageIndex]?.title && (
                  <span>: {currentWaiverPages[currentPageIndex].title}</span>
                )}
              </div>
            )}

            {/* Waiver content */}
            <div className="border rounded-lg p-6 max-h-[400px] overflow-y-auto bg-card">
              <div
                className="prose prose-sm dark:prose-invert max-w-none"
                dangerouslySetInnerHTML={{
                  __html: sanitizeHtml(currentWaiverPages[currentPageIndex]?.content || ""),
                }}
              />
            </div>

            {/* Sign all option */}
            {currentWaiverPages.length > 1 && currentPageIndex === 0 && (
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={signAllMode}
                  onChange={(e) => onSetSignAllMode(e.target.checked)}
                  className="rounded border-border"
                />
                <span className="text-sm">
                  Sign all {currentWaiverPages.length} pages at once with a single signature
                </span>
              </label>
            )}

            {/* Signature pad */}
            <div className="space-y-2">
              <Label>Your Signature</Label>
              <p className="text-sm text-muted-foreground">
                By signing below, I acknowledge that I have read and agree to the terms above.
              </p>
              <SignaturePad
                ref={signaturePadRef}
                height={150}
                onSignatureChange={(isEmpty) => onSetSignatureEmpty(isEmpty)}
              />
            </div>
          </>
        )}
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          <ChevronLeft className="mr-1 h-4 w-4" />
          Back
        </Button>
        <Button onClick={onSign} disabled={isSigningWaiver || signatureEmpty || isLoadingWaiver}>
          {isSigningWaiver && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {signAllMode
            ? "Sign All Pages & Continue"
            : currentPageIndex < currentWaiverPages.length - 1
              ? "Sign & Next Page"
              : currentWaiverIndex < requiredWaivers.length - 1
                ? "Sign & Next Waiver"
                : "Sign & Continue"}
          <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
      </CardFooter>
    </Card>
  );
}

// ---------- Custom Info Step Sub-component ----------

function CustomInfoStepComp({
  isLoading,
  needsCustomInfo,
  questions,
  existingResponses,
  athleteId,
  organizationId,
  onEnterStep,
  onComplete,
  onBack,
}: {
  isLoading: boolean;
  needsCustomInfo: boolean;
  questions: CustomInfoQuestion[];
  existingResponses: CustomInfoResponse[];
  athleteId: string;
  organizationId: string;
  onEnterStep: () => void;
  onComplete: () => void;
  onBack: () => void;
}) {
  useEffect(() => {
    onEnterStep();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </CardContent>
      </Card>
    );
  }

  if (!needsCustomInfo || questions.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <CustomInformationForm
          questions={questions}
          existingResponses={existingResponses}
          athleteId={athleteId}
          organizationId={organizationId}
          onComplete={onComplete}
          onBack={onBack}
        />
      </CardContent>
    </Card>
  );
}

// ---------- Medical Step Sub-component ----------

function MedicalStep({
  isLoadingConfig,
  needsMedical,
  medicalConfig,
  medicalCustomQuestions,
  organizationId,
  athleteId,
  athleteName,
  email,
  onEnterStep,
  onComplete,
  onBack,
}: {
  isLoadingConfig: boolean;
  needsMedical: boolean;
  medicalConfig: MedicalFormConfig | null;
  medicalCustomQuestions: CustomMedicalQuestion[];
  organizationId: string;
  athleteId: string;
  athleteName: string;
  email: string;
  onEnterStep: () => void;
  onComplete: () => void;
  onBack: () => void;
}) {
  useEffect(() => {
    onEnterStep();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (isLoadingConfig) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">Loading medical form...</p>
        </CardContent>
      </Card>
    );
  }

  if (!needsMedical || !medicalConfig) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Check className="h-8 w-8 text-primary mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">Medical information is up to date.</p>
          <a
            href={`${getClientSubdomainUrl("athletes")}/medical`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-primary hover:underline mt-2"
          >
            <Heart className="h-3.5 w-3.5" />
            View medical information
            <ExternalLink className="h-3 w-3" />
          </a>
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button variant="outline" onClick={onBack}>
            <ChevronLeft className="mr-1 h-4 w-4" />
            Back
          </Button>
          <Button onClick={onComplete}>
            Continue
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <CheckoutMedicalForm
      key={athleteId}
      athleteId={athleteId}
      athleteName={athleteName}
      config={medicalConfig}
      customQuestions={medicalCustomQuestions}
      organizationId={organizationId}
      email={email}
      onComplete={onComplete}
      onBack={onBack}
    />
  );
}
