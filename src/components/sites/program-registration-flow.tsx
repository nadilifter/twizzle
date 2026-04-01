"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useSession, signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { sanitizeHtml } from "@/lib/sanitize";
import { toast } from "sonner";
import { format } from "date-fns";
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
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  Plus,
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertCircle,
  ShoppingCart,
  Check,
  Shield,
  CreditCard,
  FileText,
  Heart,
  ClipboardList,
  ExternalLink,
  Ticket,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

// ---------- Types ----------

interface Instance {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  capacity?: number;
  registrationCount: number;
  facility?: { name: string; city?: string | null };
}

interface RequiredMembership {
  id: string;
  name: string;
  price: number;
  billingInterval: string;
  group: {
    id: string;
    name: string;
    hasGenderRestriction?: boolean;
    allowedGenders?: ("MALE" | "FEMALE" | "OTHER" | "PREFER_NOT_TO_SAY")[];
  };
}

interface RequiredPass {
  id: string;
  name: string;
  price: number;
  billingInterval: string;
  sessionLimit: number;
  limitPeriod: string;
  hasGenderRestriction?: boolean;
  allowedGenders?: ("MALE" | "FEMALE" | "OTHER" | "PREFER_NOT_TO_SAY")[];
}

interface WaiverRequirement {
  id: string;
  waiverId: string;
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

interface ProgramData {
  id: string;
  name: string;
  description: string | null;
  pricingModel: string;
  basePrice: number | null;
  perSessionPrice: number | null;
  billingInterval?: string;
  recurringPrice?: number | null;
  registrationType: string | null;
  hasAgeRestriction: boolean;
  minAge: number | null;
  maxAge: number | null;
  hasGenderRestriction: boolean;
  allowedGenders: ("MALE" | "FEMALE" | "OTHER" | "PREFER_NOT_TO_SAY")[];
  hasWaiverRestriction: boolean;
  hasMedicalRequirement: boolean;
  hasFileRequirement: boolean;
  fileRequirementConfig: FileRequirementConfig | null;
  hasMembershipRestriction: boolean;
  hasPassRestriction: boolean;
  organizationId: string;
  capacity: number | null;
  hasCapacityRestriction: boolean;
  waitlistEnabled?: boolean;
  waitlistCapacity?: number | null;
  enrolled?: number;
  waitlistedCount?: number;
  requiredMemberships: RequiredMembership[];
  requiredPasses?: RequiredPass[];
  waiverRequirements: WaiverRequirement[];
  registrationOpen?: boolean;
  registrationStartDate?: string | null;
  registrationStartTime?: string | null;
  registrationEndDate?: string | null;
  registrationEndTime?: string | null;
}

interface ProgramRegistrationFlowProps {
  program: ProgramData;
  instances: Instance[];
  slug: string;
  primaryColor?: string;
  earlyAccessCode?: string | null;
}

// ---------- Stepper definition ----------

const { useStepper } = defineStepper(
  { id: "athlete", title: "Select Athlete" },
  { id: "sessions", title: "Select Sessions" },
  { id: "membership", title: "Membership" },
  { id: "pass", title: "Pass" },
  { id: "waivers", title: "Sign Waivers" },
  { id: "customInfo", title: "Custom Info" },
  { id: "medical", title: "Medical Info" },
  { id: "files", title: "File Upload" },
  { id: "review", title: "Review & Register" }
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

// ---------- Main Component ----------

export function ProgramRegistrationFlow({
  program,
  instances,
  slug,
  earlyAccessCode,
}: ProgramRegistrationFlowProps) {
  const { data: session } = useSession();
  const { addItem, setIsOpen, items: cartItems } = useCart();
  const router = useRouter();
  const stepper = useStepper();

  const isPerInstance = program.registrationType === "PER_INSTANCE";
  const needsWaivers = program.hasWaiverRestriction && program.waiverRequirements.length > 0;
  const needsMedicalStep = program.hasMedicalRequirement;
  const needsFiles = program.hasFileRequirement && !!program.fileRequirementConfig;
  const needsMembership =
    program.hasMembershipRestriction && program.requiredMemberships.length > 0;
  const needsPass = program.hasPassRestriction && (program.requiredPasses?.length ?? 0) > 0;

  const programIsFull =
    program.hasCapacityRestriction &&
    program.capacity != null &&
    (program.enrolled ?? 0) >= program.capacity;
  const waitlistHasRoom =
    program.waitlistEnabled &&
    (program.waitlistCapacity == null || (program.waitlistedCount ?? 0) < program.waitlistCapacity);
  const isWaitlistMode = programIsFull && waitlistHasRoom;

  const price =
    program.pricingModel === "PER_SESSION" ? program.perSessionPrice || 0 : program.basePrice || 0;

  // ---------- State ----------

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
  const [selectedInstanceIds, setSelectedInstanceIds] = useState<Set<string>>(new Set());
  const [selectedMembership, setSelectedMembership] = useState<RequiredMembership | null>(null);
  const [athleteHasMembership, setAthleteHasMembership] = useState(false);
  const [isCheckingMembership, setIsCheckingMembership] = useState(false);
  const [selectedPass, setSelectedPass] = useState<RequiredPass | null>(null);
  const [athleteHasPass, setAthleteHasPass] = useState(false);
  const [isCheckingPass, setIsCheckingPass] = useState(false);

  // Existing registration check
  const [alreadyRegisteredIds, setAlreadyRegisteredIds] = useState<Set<string>>(new Set());
  const [hasFullEnrollment, setHasFullEnrollment] = useState(false);
  const [isCheckingRegistrations, setIsCheckingRegistrations] = useState(false);

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

  // ---------- Visible steps ----------

  const needsMembershipPurchase = needsMembership && !athleteHasMembership;

  const visibleStepIds = useMemo(() => {
    const ids = ["athlete"];
    if (isPerInstance) ids.push("sessions");
    if (needsMembershipPurchase) ids.push("membership");
    if (needsPass) ids.push("pass");
    if (needsWaivers) ids.push("waivers");
    ids.push("customInfo");
    if (needsMedicalStep) ids.push("medical");
    if (needsFiles) ids.push("files");
    ids.push("review");
    return ids;
  }, [
    isPerInstance,
    needsMembershipPurchase,
    needsPass,
    needsWaivers,
    needsMedicalStep,
    needsFiles,
  ]);

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

  // ---------- Athlete helpers ----------

  useEffect(() => {
    if (session?.user) fetchAthletes();
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

      const athleteOption: AthleteOption = {
        id: created.id,
        firstName: created.firstName,
        lastName: created.lastName,
        name: `${created.firstName} ${created.lastName}`,
        birthDate: created.birthDate,
        gender: created.gender,
      };
      setSelectedAthlete(athleteOption);
    } catch (error: any) {
      toast.error(error.message || "Failed to create athlete");
    } finally {
      setIsCreatingAthlete(false);
    }
  };

  const { eligibleAthletes, ineligibleAthletes } = useMemo(() => {
    const hasRestrictions = program.hasAgeRestriction || program.hasGenderRestriction;
    if (!hasRestrictions) {
      return { eligibleAthletes: athletes, ineligibleAthletes: [] as AthleteOption[] };
    }
    const eligible: AthleteOption[] = [];
    const ineligible: AthleteOption[] = [];
    for (const athlete of athletes) {
      let isEligible = true;
      if (program.hasAgeRestriction) {
        const age = calculateAge(athlete.birthDate);
        if (!isAgeEligible(age, program.minAge, program.maxAge)) isEligible = false;
      }
      if (program.hasGenderRestriction && program.allowedGenders.length > 0) {
        if (!athlete.gender || !program.allowedGenders.includes(athlete.gender as any))
          isEligible = false;
      }
      if (isEligible) {
        eligible.push(athlete);
      } else {
        ineligible.push(athlete);
      }
    }
    return { eligibleAthletes: eligible, ineligibleAthletes: ineligible };
  }, [
    athletes,
    program.hasAgeRestriction,
    program.minAge,
    program.maxAge,
    program.hasGenderRestriction,
    program.allowedGenders,
  ]);

  const ageLabel =
    program.hasAgeRestriction && (program.minAge != null || program.maxAge != null)
      ? program.minAge != null && program.maxAge != null
        ? `Ages ${program.minAge}–${program.maxAge}`
        : program.minAge != null
          ? `Ages ${program.minAge}+`
          : `Up to age ${program.maxAge}`
      : null;

  // ---------- Existing registration check ----------

  const inCartIds = useMemo(() => {
    if (!selectedAthlete) return new Set<string>();
    return new Set(
      cartItems
        .filter(
          (item) =>
            item.type === "program" &&
            item.athleteId === selectedAthlete.id &&
            item.details?.instanceId
        )
        .map((item) => item.details!.instanceId as string)
    );
  }, [cartItems, selectedAthlete]);

  const isFullProgramInCart = useMemo(() => {
    if (!selectedAthlete) return false;
    return cartItems.some(
      (item) =>
        item.type === "program" &&
        item.athleteId === selectedAthlete.id &&
        item.referenceId === program.id &&
        !item.details?.instanceId
    );
  }, [cartItems, selectedAthlete, program.id]);

  const isAlreadyFullyRegistered = hasFullEnrollment || isFullProgramInCart;

  const checkExistingRegistrations = useCallback(
    async (athleteId: string) => {
      setIsCheckingRegistrations(true);
      try {
        const res = await fetch(
          `/api/public/programs/registrations?programId=${encodeURIComponent(program.id)}&athleteId=${encodeURIComponent(athleteId)}`
        );
        if (res.ok) {
          const data = await res.json();
          const registered = new Set<string>(data.registeredInstanceIds || []);
          setAlreadyRegisteredIds(registered);
          setHasFullEnrollment(!!data.hasFullEnrollment);
          // Deselect any instances that are already registered
          if (registered.size > 0) {
            setSelectedInstanceIds((prev) => {
              const next = new Set(prev);
              for (const id of registered) next.delete(id);
              return next.size !== prev.size ? next : prev;
            });
          }
        }
      } catch {
        // non-critical — just leave sets empty
      } finally {
        setIsCheckingRegistrations(false);
      }
    },
    [program.id]
  );

  useEffect(() => {
    if (selectedAthlete) {
      checkExistingRegistrations(selectedAthlete.id);
    } else {
      setAlreadyRegisteredIds(new Set());
      setHasFullEnrollment(false);
    }
  }, [selectedAthlete, checkExistingRegistrations]);

  // ---------- Session helpers ----------

  const toggleInstance = useCallback(
    (id: string) => {
      if (alreadyRegisteredIds.has(id) || inCartIds.has(id)) return;
      setSelectedInstanceIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    },
    [alreadyRegisteredIds, inCartIds]
  );

  const selectAllInstances = () => {
    const available = instances
      .filter((i) => !i.capacity || i.registrationCount < i.capacity)
      .filter((i) => !alreadyRegisteredIds.has(i.id))
      .filter((i) => !inCartIds.has(i.id))
      .map((i) => i.id);
    setSelectedInstanceIds(new Set(available));
  };

  // ---------- Gender-eligible memberships & passes ----------

  const genderEligibleMemberships = useMemo(() => {
    if (!selectedAthlete || !needsMembership) return program.requiredMemberships;
    return program.requiredMemberships.filter((m) => {
      if (!m.group.hasGenderRestriction || !m.group.allowedGenders?.length) return true;
      return (
        !!selectedAthlete.gender && m.group.allowedGenders.includes(selectedAthlete.gender as any)
      );
    });
  }, [selectedAthlete, needsMembership, program.requiredMemberships]);

  const genderEligiblePasses = useMemo(() => {
    if (!selectedAthlete || !needsPass) return program.requiredPasses ?? [];
    return (program.requiredPasses ?? []).filter((p) => {
      if (!p.hasGenderRestriction || !p.allowedGenders?.length) return true;
      return !!selectedAthlete.gender && p.allowedGenders.includes(selectedAthlete.gender as any);
    });
  }, [selectedAthlete, needsPass, program.requiredPasses]);

  // ---------- Membership helpers ----------

  useEffect(() => {
    if (needsMembership && selectedAthlete && session?.user?.email) {
      setIsCheckingMembership(true);
      setAthleteHasMembership(false);
      fetch(
        `/api/public/athletes/${selectedAthlete.id}/memberships?email=${encodeURIComponent(session.user.email)}`
      )
        .then((r) => r.json())
        .then((data) => {
          const activeIds: string[] = data.activeMembershipInstanceIds || [];
          const requiredIds = program.requiredMemberships.map((m) => m.id);
          const alreadyHas = requiredIds.some((id) => activeIds.includes(id));
          setAthleteHasMembership(alreadyHas);
          if (!alreadyHas && genderEligibleMemberships.length === 1) {
            setSelectedMembership(genderEligibleMemberships[0]);
          }
        })
        .catch(() => {
          setAthleteHasMembership(false);
          if (genderEligibleMemberships.length === 1) {
            setSelectedMembership(genderEligibleMemberships[0]);
          }
        })
        .finally(() => setIsCheckingMembership(false));
    } else if (needsMembership && genderEligibleMemberships.length === 1) {
      setSelectedMembership(genderEligibleMemberships[0]);
    }
  }, [
    needsMembership,
    selectedAthlete,
    session?.user?.email,
    program.requiredMemberships,
    genderEligibleMemberships,
  ]);

  // ---------- Pass helpers ----------

  useEffect(() => {
    if (needsPass && selectedAthlete) {
      setIsCheckingPass(true);
      fetch(`/api/public/passes?organizationId=${program.organizationId}`)
        .then((r) => r.json())
        .then((data) => {
          const requiredPassIds = new Set(program.requiredPasses?.map((p) => p.id) || []);
          const activePasses = (data.data || []).filter((p: { id: string }) =>
            requiredPassIds.has(p.id)
          );
          if (activePasses.length > 0) {
            setAthleteHasPass(false);
            if (genderEligiblePasses.length === 1) {
              setSelectedPass(genderEligiblePasses[0]);
            }
          }
        })
        .catch((err) => console.error("Failed to check athlete passes:", err))
        .finally(() => setIsCheckingPass(false));
    }
  }, [
    needsPass,
    selectedAthlete,
    program.organizationId,
    program.requiredPasses,
    genderEligiblePasses,
  ]);

  // ---------- Waiver helpers ----------

  const loadWaiverContent = useCallback(
    async (waiverId: string) => {
      setIsLoadingWaiver(true);
      try {
        const response = await fetch(
          `/api/public/waivers/${waiverId}?organizationId=${program.organizationId}`
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
    [program.organizationId]
  );

  const handleEnterWaiversStep = useCallback(async () => {
    if (!selectedAthlete || !session?.user?.email) return;
    setIsCheckingWaivers(true);

    try {
      const waiverIds = program.waiverRequirements.map((w) => w.waiverId);
      const checkResponse = await fetch("/api/public/waivers/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: session.user.email,
          waiverIds,
          organizationId: program.organizationId,
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
    program.waiverRequirements,
    program.organizationId,
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
        ? currentWaiverPages.map((page) => ({ waiverPageId: page.id, signatureData }))
        : [{ waiverPageId: currentWaiverPages[currentPageIndex].id, signatureData }];

      const response = await fetch(`/api/public/waivers/${currentWaiver.waiverId}/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: program.organizationId,
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
          const nextId = getNextStepId("waivers");
          if (nextId) stepper.navigation.goTo(nextId as any);
        }
      } else {
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
    program.organizationId,
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
      const membershipIds = selectedMembership ? [selectedMembership.id] : [];
      const passIds = selectedPass ? [selectedPass.id] : [];
      const params = new URLSearchParams({
        organizationId: program.organizationId,
        programIds: program.id,
      });
      if (membershipIds.length > 0) params.set("membershipIds", membershipIds.join(","));
      if (passIds.length > 0) params.set("passIds", passIds.join(","));

      const questionsRes = await fetch(`/api/public/custom-information?${params}`);
      if (!questionsRes.ok) {
        setNeedsCustomInfo(false);
        if (!isNavigatingBackRef.current) {
          const nextId = getNextStepId("customInfo");
          if (nextId) stepper.navigation.goTo(nextId as any);
        }
        return;
      }

      const { questions, config } = await questionsRes.json();
      if (!questions || questions.length === 0) {
        setNeedsCustomInfo(false);
        if (!isNavigatingBackRef.current) {
          const nextId = getNextStepId("customInfo");
          if (nextId) stepper.navigation.goTo(nextId as any);
        }
        return;
      }

      // Check existing responses
      const responsesRes = await fetch(
        `/api/public/athletes/${selectedAthlete.id}/custom-information?organizationId=${program.organizationId}&email=${encodeURIComponent(session?.user?.email || "")}`
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
    selectedMembership,
    selectedPass,
    program.organizationId,
    program.id,
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
        `/api/public/athletes/${selectedAthlete.id}/medical?organizationId=${program.organizationId}&email=${encodeURIComponent(session?.user?.email || "")}`
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
        `/api/public/medical-config?organizationId=${program.organizationId}`
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
    program.organizationId,
    session?.user?.email,
    getNextStepId,
    stepper.navigation,
  ]);

  // ---------- Pricing ----------

  const isRecurringProgram =
    program.billingInterval &&
    program.billingInterval !== "ONE_TIME" &&
    program.billingInterval !== "SESSION" &&
    program.recurringPrice;

  const totalPrice = useMemo(() => {
    if (isPerInstance) {
      return selectedInstanceIds.size * (program.perSessionPrice || 0);
    }
    if (isRecurringProgram) {
      return program.recurringPrice || 0;
    }
    return program.basePrice || 0;
  }, [
    isPerInstance,
    selectedInstanceIds.size,
    program.perSessionPrice,
    program.basePrice,
    isRecurringProgram,
    program.recurringPrice,
  ]);

  const membershipPrice =
    needsMembershipPurchase && selectedMembership ? selectedMembership.price : 0;
  const passPrice = needsPass && selectedPass && !athleteHasPass ? selectedPass.price : 0;
  const combinedTotal = totalPrice + membershipPrice + passPrice;

  // ---------- Add to cart ----------

  const handleAddToCart = (goToCheckout: boolean) => {
    if (!selectedAthlete) return;

    const athleteName = `${selectedAthlete.firstName} ${selectedAthlete.lastName}`.trim();

    if (needsMembershipPurchase && selectedMembership) {
      addItem({
        referenceId: selectedMembership.id,
        type: "membership",
        name: selectedMembership.name,
        description: `${selectedMembership.group.name} Membership`,
        price: selectedMembership.price,
        quantity: 1,
        athleteId: selectedAthlete.id,
        athleteName,
        details: {
          membershipInstanceId: selectedMembership.id,
          groupId: selectedMembership.group.id,
          groupName: selectedMembership.group.name,
          billingInterval: selectedMembership.billingInterval,
        },
      });
    }

    if (needsPass && selectedPass && !athleteHasPass) {
      addItem({
        referenceId: selectedPass.id,
        type: "pass",
        name: selectedPass.name,
        description: `${selectedPass.sessionLimit} sessions / ${selectedPass.limitPeriod === "WEEKLY" ? "week" : "month"}`,
        price: selectedPass.price,
        quantity: 1,
        athleteId: selectedAthlete.id,
        athleteName,
        details: {
          passId: selectedPass.id,
          billingInterval: selectedPass.billingInterval,
        },
      });
    }

    if (isPerInstance) {
      const selectedInstances = instances.filter((i) => selectedInstanceIds.has(i.id));
      for (const instance of selectedInstances) {
        const instanceIsFull =
          instance.capacity !== undefined && instance.registrationCount >= instance.capacity;
        addItem({
          referenceId: instance.id,
          type: "program",
          name: `${program.name} – ${format(new Date(instance.date), "MMM d, yyyy")}`,
          description: `${instance.startTime} – ${instance.endTime}`,
          price: program.perSessionPrice || 0,
          quantity: 1,
          athleteId: selectedAthlete.id,
          athleteName,
          details: {
            programId: program.id,
            instanceId: instance.id,
            date: instance.date,
            startTime: instance.startTime,
            waitlist: instanceIsFull && program.waitlistEnabled,
            endTime: instance.endTime,
            ...(uploadedFileId && { fileUploadId: uploadedFileId }),
            ...(earlyAccessCode && { earlyAccessCode }),
          },
        });
      }
    } else {
      addItem({
        referenceId: program.id,
        type: "program",
        name: program.name,
        description: program.description || undefined,
        price: isRecurringProgram ? program.recurringPrice || 0 : program.basePrice || 0,
        quantity: 1,
        athleteId: selectedAthlete.id,
        athleteName,
        details: {
          programId: program.id,
          pricingModel: program.pricingModel,
          billingInterval: program.billingInterval,
          requiredMemberships: program.requiredMemberships.map((m) => m.id),
          waitlist: isWaitlistMode,
          ...(uploadedFileId && { fileUploadId: uploadedFileId }),
          ...(earlyAccessCode && { earlyAccessCode }),
        },
      });
    }

    if (goToCheckout) {
      setIsOpen(false);
      router.push(`/checkout`);
    } else {
      router.push(`/`);
    }
  };

  // ---------- Auth gate ----------

  if (!session?.user) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <User className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
          <h2 className="text-xl font-semibold mb-2">Sign In to Register</h2>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            You need to be signed in to register for this program.
          </p>
          <Button onClick={() => signIn(undefined, { callbackUrl: window.location.href })}>
            Sign In
          </Button>
        </CardContent>
      </Card>
    );
  }

  // ---------- Rendering ----------

  const allSteps = stepper.state.all;
  const currentStepId = stepper.state.current.data.id;
  const visibleSteps = allSteps.filter((s: { id: string }) => visibleStepIds.includes(s.id));
  const currentVisibleIndex = visibleSteps.findIndex((s: { id: string }) => s.id === currentStepId);

  const canProceedFromAthlete = selectedAthlete !== null;
  const canProceedFromSessions = selectedInstanceIds.size > 0;
  const canProceedFromMembership = athleteHasMembership || selectedMembership !== null;
  const canProceedFromPass = athleteHasPass || selectedPass !== null;

  return (
    <div className="space-y-6">
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

      {/* Waitlist Banner */}
      {isWaitlistMode && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                This program is currently full
              </p>
              <p className="text-sm text-amber-700 dark:text-amber-300">
                You are joining the waitlist. You will not be charged until a spot becomes available
                and you are moved into the program.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Step: Select Athlete */}
      {currentStepId === "athlete" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Who is registering?
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingAthletes ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : showCreateForm ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="prog-athlete-first">First Name</Label>
                    <Input
                      id="prog-athlete-first"
                      value={newAthlete.firstName}
                      onChange={(e) =>
                        setNewAthlete((prev) => ({ ...prev, firstName: e.target.value }))
                      }
                      placeholder="First name"
                      disabled={isCreatingAthlete}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="prog-athlete-last">Last Name</Label>
                    <Input
                      id="prog-athlete-last"
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
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {newAthlete.birthDate
                          ? format(new Date(newAthlete.birthDate + "T12:00:00Z"), "PPP")
                          : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
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
                  <Label htmlFor="prog-athlete-gender">Gender Declaration</Label>
                  <Select
                    value={newAthlete.gender}
                    onValueChange={(value) => setNewAthlete((prev) => ({ ...prev, gender: value }))}
                    disabled={isCreatingAthlete}
                  >
                    <SelectTrigger id="prog-athlete-gender">
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
              <div className="space-y-3">
                {ageLabel && (
                  <div className="flex items-center gap-2 text-xs font-medium text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 px-3 py-2 rounded-lg">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    This program requires athletes to be {ageLabel.toLowerCase()}
                  </div>
                )}

                {selectedAthlete && (
                  <div className="flex items-center gap-3 p-3 rounded-lg border border-primary/40 bg-primary/5">
                    <div className="flex items-center justify-center h-10 w-10 rounded-full bg-primary/10 text-primary shrink-0">
                      <Check className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">
                        {selectedAthlete.firstName} {selectedAthlete.lastName}
                      </div>
                      <div className="text-xs text-muted-foreground">Selected</div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedAthlete(null);
                        setSelectedInstanceIds(new Set());
                        setAthleteHasMembership(false);
                        setSelectedMembership(null);
                      }}
                    >
                      Change
                    </Button>
                  </div>
                )}

                {!selectedAthlete && (
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
                              onClick={() => setSelectedAthlete(athlete)}
                              className="w-full flex items-center gap-3 p-3 rounded-lg border border-border bg-card hover:bg-accent hover:border-primary/40 transition-colors text-left"
                            >
                              <div className="flex items-center justify-center h-10 w-10 rounded-full bg-primary/10 text-primary shrink-0">
                                <User className="h-5 w-5" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-sm truncate">{displayName}</div>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                                  {birthLabel && (
                                    <span className="flex items-center gap-1">
                                      <CalendarIcon className="h-3 w-3" />
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
                                Ineligible for this program
                              </p>
                            </div>
                            {ineligibleAthletes.map((athlete) => {
                              const displayName = `${athlete.firstName} ${athlete.lastName}`.trim();
                              const age = calculateAge(athlete.birthDate);
                              const reasons: string[] = [];
                              if (
                                program.hasAgeRestriction &&
                                !isAgeEligible(age, program.minAge, program.maxAge)
                              ) {
                                reasons.push(`Age ${age} — requires ${ageLabel?.toLowerCase()}`);
                              }
                              if (
                                program.hasGenderRestriction &&
                                program.allowedGenders.length > 0
                              ) {
                                if (
                                  !athlete.gender ||
                                  !program.allowedGenders.includes(athlete.gender as any)
                                ) {
                                  const allowed = program.allowedGenders
                                    .map((g) => GENDER_LABELS[g] || g)
                                    .join(", ");
                                  reasons.push(`Gender — restricted to ${allowed}`);
                                }
                              }
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
                                      {reasons.join(" · ")}
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

                {canProceedFromAthlete && (
                  <div className="pt-4">
                    <Button
                      className="w-full gap-2"
                      onClick={() => {
                        const nextId = getNextStepId("athlete");
                        if (nextId) stepper.navigation.goTo(nextId as any);
                      }}
                    >
                      Continue
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step: Select Sessions (PER_INSTANCE only) */}
      {currentStepId === "sessions" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5" />
              Select Sessions for {selectedAthlete?.firstName}
            </CardTitle>
            <CardDescription>Choose individual sessions you&apos;d like to attend.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {hasFullEnrollment && (
                <div className="rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950 p-4 text-sm text-blue-800 dark:text-blue-200">
                  {selectedAthlete?.firstName} is already enrolled in this program for the full
                  season.
                </div>
              )}

              {isCheckingRegistrations && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Checking existing registrations…
                </div>
              )}

              <div className="flex items-center justify-between pb-3 border-b border-border">
                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={selectAllInstances}
                    disabled={instances.length === 0}
                  >
                    Select All
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedInstanceIds(new Set())}
                    disabled={selectedInstanceIds.size === 0}
                  >
                    Clear
                  </Button>
                </div>
                <div className="text-sm text-muted-foreground">
                  {selectedInstanceIds.size} of {instances.length} selected
                </div>
              </div>

              <div className="divide-y divide-border max-h-[400px] overflow-y-auto">
                {instances.map((instance) => {
                  const isFull =
                    instance.capacity !== undefined &&
                    instance.registrationCount >= instance.capacity;
                  const isAlreadyRegistered = alreadyRegisteredIds.has(instance.id);
                  const isInCart = inCartIds.has(instance.id);
                  const instanceWaitlistAvailable = isFull && program.waitlistEnabled;
                  const isUnavailable =
                    (isFull && !instanceWaitlistAvailable) || isAlreadyRegistered || isInCart;
                  const isSelected = selectedInstanceIds.has(instance.id);
                  const spotsLeft = instance.capacity
                    ? instance.capacity - instance.registrationCount
                    : null;

                  return (
                    <div
                      key={instance.id}
                      className={`flex items-center gap-4 py-3 px-2 rounded transition-colors ${
                        isSelected ? "bg-primary/5" : isUnavailable ? "" : "hover:bg-muted/50"
                      } ${isUnavailable ? "opacity-50" : "cursor-pointer"}`}
                      onClick={() => !isUnavailable && toggleInstance(instance.id)}
                    >
                      <Checkbox
                        checked={isSelected}
                        disabled={isUnavailable}
                        onCheckedChange={() => !isUnavailable && toggleInstance(instance.id)}
                        className="shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium text-foreground">
                            {format(new Date(instance.date), "EEE, MMM d")}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" />
                            {instance.startTime} – {instance.endTime}
                          </div>
                          {instance.facility && (
                            <div className="flex items-center gap-1">
                              <MapPin className="h-3.5 w-3.5" />
                              {instance.facility.name}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        {program.perSessionPrice != null &&
                          program.perSessionPrice > 0 &&
                          !isAlreadyRegistered &&
                          !isInCart && (
                            <div className="font-medium text-foreground">
                              {formatPrice(program.perSessionPrice)}
                            </div>
                          )}
                        {isAlreadyRegistered ? (
                          <div className="text-xs font-medium text-blue-600 dark:text-blue-400">
                            Already registered
                          </div>
                        ) : isInCart ? (
                          <div className="text-xs font-medium text-amber-600 dark:text-amber-400">
                            In cart
                          </div>
                        ) : spotsLeft !== null ? (
                          <div
                            className={`text-xs ${
                              isFull && instanceWaitlistAvailable
                                ? "text-amber-600 dark:text-amber-400"
                                : isFull
                                  ? "text-red-600 dark:text-red-400"
                                  : spotsLeft <= 3
                                    ? "text-orange-600 dark:text-orange-400"
                                    : "text-green-600 dark:text-green-400"
                            }`}
                          >
                            {isFull && instanceWaitlistAvailable
                              ? "Waitlist"
                              : isFull
                                ? "Full"
                                : `${spotsLeft} spot${spotsLeft !== 1 ? "s" : ""} left`}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>

              {instances.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No upcoming sessions available for this program.
                </div>
              )}

              {selectedInstanceIds.size > 0 && program.perSessionPrice != null && (
                <div className="rounded-lg border bg-muted/30 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      {selectedInstanceIds.size} session{selectedInstanceIds.size !== 1 ? "s" : ""}{" "}
                      selected
                    </span>
                    <span className="text-lg font-bold">{formatPrice(totalPrice)}</span>
                  </div>
                </div>
              )}

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
                  disabled={!canProceedFromSessions}
                  onClick={() => {
                    const nextId = getNextStepId("sessions");
                    if (nextId) stepper.navigation.goTo(nextId as any);
                  }}
                >
                  Continue
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step: Membership */}
      {currentStepId === "membership" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Membership Required
            </CardTitle>
            <CardDescription>
              This program requires an active membership. Select one to continue.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {genderEligibleMemberships.length === 0 ? (
                <div className="flex items-start gap-3 p-4 rounded-lg border border-destructive/40 bg-destructive/5">
                  <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-sm">No eligible memberships</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {selectedAthlete?.firstName} does not meet the gender requirements for any of
                      the available membership options.
                    </p>
                  </div>
                </div>
              ) : genderEligibleMemberships.length === 1 ? (
                <div className="flex items-center gap-3 p-4 rounded-lg border border-primary/40 bg-primary/5">
                  <CreditCard className="h-5 w-5 text-primary shrink-0" />
                  <div className="flex-1">
                    <div className="font-medium text-sm">{genderEligibleMemberships[0].name}</div>
                    <div className="text-xs text-muted-foreground">
                      {genderEligibleMemberships[0].group.name}
                    </div>
                  </div>
                  <span className="font-bold">
                    {formatPrice(genderEligibleMemberships[0].price)}
                  </span>
                </div>
              ) : (
                <div className="space-y-2">
                  {genderEligibleMemberships.map((m) => {
                    const isSelected = selectedMembership?.id === m.id;
                    return (
                      <button
                        key={m.id}
                        onClick={() => setSelectedMembership(m)}
                        className={`w-full flex items-center gap-3 p-4 rounded-lg border transition-colors text-left ${
                          isSelected
                            ? "border-primary/40 bg-primary/5"
                            : "border-border hover:bg-accent"
                        }`}
                      >
                        <CreditCard
                          className={`h-5 w-5 shrink-0 ${isSelected ? "text-primary" : "text-muted-foreground"}`}
                        />
                        <div className="flex-1">
                          <div className="font-medium text-sm">{m.name}</div>
                          <div className="text-xs text-muted-foreground">{m.group.name}</div>
                        </div>
                        <span className="font-bold">{formatPrice(m.price)}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    const prevId = getPreviousStepId("membership");
                    if (prevId) stepper.navigation.goTo(prevId as any);
                  }}
                  className="gap-2"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Back
                </Button>
                <Button
                  className="flex-1 gap-2"
                  disabled={!canProceedFromMembership}
                  onClick={() => {
                    const nextId = getNextStepId("membership");
                    if (nextId) stepper.navigation.goTo(nextId as any);
                  }}
                >
                  Continue
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step: Pass */}
      {currentStepId === "pass" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Ticket className="h-5 w-5" />
              Pass Required
            </CardTitle>
            <CardDescription>
              This program requires an active pass. Select a pass to purchase or continue if you
              already have one.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {isCheckingPass ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : athleteHasPass ? (
                <div className="flex items-center gap-3 p-4 rounded-lg border border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/30">
                  <Check className="h-5 w-5 text-green-600 shrink-0" />
                  <div>
                    <p className="font-medium text-sm text-green-800 dark:text-green-200">
                      Active pass found
                    </p>
                    <p className="text-xs text-green-700 dark:text-green-300">
                      You already have an active pass that covers this program.
                    </p>
                  </div>
                </div>
              ) : genderEligiblePasses.length === 0 ? (
                <div className="flex items-start gap-3 p-4 rounded-lg border border-destructive/40 bg-destructive/5">
                  <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-sm">No eligible passes</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {selectedAthlete?.firstName} does not meet the gender requirements for any of
                      the available pass options.
                    </p>
                  </div>
                </div>
              ) : genderEligiblePasses.length === 1 ? (
                <div className="flex items-center gap-3 p-4 rounded-lg border border-primary/40 bg-primary/5">
                  <Ticket className="h-5 w-5 text-primary shrink-0" />
                  <div className="flex-1">
                    <div className="font-medium text-sm">{genderEligiblePasses[0].name}</div>
                    <div className="text-xs text-muted-foreground">
                      {genderEligiblePasses[0].sessionLimit} sessions /{" "}
                      {genderEligiblePasses[0].limitPeriod === "WEEKLY" ? "week" : "month"}
                    </div>
                  </div>
                  <span className="font-bold">
                    {formatPrice(genderEligiblePasses[0].price)}/
                    {genderEligiblePasses[0].billingInterval.toLowerCase().replace("_", "-")}
                  </span>
                </div>
              ) : (
                <div className="space-y-2">
                  {genderEligiblePasses.map((p) => {
                    const isSelected = selectedPass?.id === p.id;
                    return (
                      <button
                        key={p.id}
                        onClick={() => setSelectedPass(p)}
                        className={`w-full flex items-center gap-3 p-4 rounded-lg border transition-colors text-left ${
                          isSelected
                            ? "border-primary/40 bg-primary/5"
                            : "border-border hover:bg-accent"
                        }`}
                      >
                        <Ticket
                          className={`h-5 w-5 shrink-0 ${isSelected ? "text-primary" : "text-muted-foreground"}`}
                        />
                        <div className="flex-1">
                          <div className="font-medium text-sm">{p.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {p.sessionLimit} sessions /{" "}
                            {p.limitPeriod === "WEEKLY" ? "week" : "month"}
                          </div>
                        </div>
                        <span className="font-bold">
                          {formatPrice(p.price)}/{p.billingInterval.toLowerCase().replace("_", "-")}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    const prevId = getPreviousStepId("pass");
                    if (prevId) stepper.navigation.goTo(prevId as any);
                  }}
                  className="gap-2"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Back
                </Button>
                <Button
                  className="flex-1 gap-2"
                  disabled={!canProceedFromPass}
                  onClick={() => {
                    const nextId = getNextStepId("pass");
                    if (nextId) stepper.navigation.goTo(nextId as any);
                  }}
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
        <CustomInfoStep
          isLoading={isLoadingCustomInfo}
          needsCustomInfo={needsCustomInfo}
          questions={customInfoQuestions}
          existingResponses={customInfoResponses}
          athleteId={selectedAthlete?.id || ""}
          organizationId={program.organizationId}
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
          organizationId={program.organizationId}
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
      {currentStepId === "files" && needsFiles && program.fileRequirementConfig && (
        <FileUploadStep
          config={program.fileRequirementConfig}
          organizationId={program.organizationId}
          athleteId={selectedAthlete?.id || ""}
          programId={program.id}
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

      {/* Step: Review & Register */}
      {currentStepId === "review" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5" />
              {isWaitlistMode ? "Review & Join Waitlist" : "Review Registration"}
            </CardTitle>
            {isWaitlistMode && (
              <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                You will be added to the waitlist. You will not be charged until a spot becomes
                available.
              </p>
            )}
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

              {/* Program / Sessions */}
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  {isPerInstance ? `Sessions (${selectedInstanceIds.size})` : "Program"}
                </h3>
                {isPerInstance ? (
                  <div className="space-y-1.5">
                    {instances
                      .filter((i) => selectedInstanceIds.has(i.id))
                      .map((instance) => (
                        <div
                          key={instance.id}
                          className="flex items-center justify-between p-2 rounded-lg border bg-card"
                        >
                          <div className="min-w-0">
                            <span className="text-sm">
                              {format(new Date(instance.date), "EEE, MMM d")} — {instance.startTime}{" "}
                              – {instance.endTime}
                            </span>
                          </div>
                          {program.perSessionPrice != null && program.perSessionPrice > 0 && (
                            <span className="text-sm text-muted-foreground shrink-0 ml-2">
                              {formatPrice(program.perSessionPrice)}
                            </span>
                          )}
                        </div>
                      ))}
                  </div>
                ) : (
                  <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
                    <span className="text-sm font-medium">{program.name}</span>
                    <span className="text-sm text-muted-foreground">
                      {formatPrice(program.basePrice || 0)}
                    </span>
                  </div>
                )}
              </div>

              {/* Membership */}
              {needsMembership && athleteHasMembership && (
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    Membership
                  </h3>
                  <div className="flex items-center gap-3 p-2 rounded-lg border border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/30">
                    <Check className="h-4 w-4 text-green-600 dark:text-green-400 shrink-0" />
                    <span className="text-sm text-green-800 dark:text-green-200">
                      Active membership on file
                    </span>
                  </div>
                </div>
              )}
              {needsMembershipPurchase && selectedMembership && (
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    Membership
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
                    {isPerInstance
                      ? `${selectedInstanceIds.size} session${selectedInstanceIds.size !== 1 ? "s" : ""}`
                      : isRecurringProgram
                        ? program.billingInterval === "MONTHLY"
                          ? "Monthly fee"
                          : "Annual fee"
                        : "Program fee"}
                  </span>
                  <span className="font-medium">
                    {formatPrice(totalPrice)}
                    {isRecurringProgram && totalPrice > 0 && (
                      <span className="text-muted-foreground">
                        {program.billingInterval === "MONTHLY" ? "/mo" : "/yr"}
                      </span>
                    )}
                  </span>
                </div>
                {needsMembershipPurchase && selectedMembership && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{selectedMembership.name}</span>
                    <span className="font-medium">{formatPrice(selectedMembership.price)}</span>
                  </div>
                )}
                <div className="border-t pt-2 flex items-center justify-between">
                  <span className="font-semibold">Total</span>
                  <span className="text-lg font-bold">{formatPrice(combinedTotal)}</span>
                </div>
              </div>

              {/* Duplicate warning for full-program enrollment */}
              {!isPerInstance && isAlreadyFullyRegistered && (
                <div className="rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950 p-4 text-sm text-blue-800 dark:text-blue-200">
                  {selectedAthlete?.firstName} is already{" "}
                  {hasFullEnrollment ? "enrolled in" : "in your cart for"} this program.
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-col gap-2 pt-2">
                <Button
                  className="w-full gap-2"
                  onClick={() => handleAddToCart(true)}
                  disabled={!isPerInstance && isAlreadyFullyRegistered}
                >
                  <ClipboardList className="h-4 w-4" />
                  {isWaitlistMode ? "Join Waitlist & Checkout" : "Register & Checkout"}
                </Button>
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  onClick={() => handleAddToCart(false)}
                  disabled={!isPerInstance && isAlreadyFullyRegistered}
                >
                  <ShoppingCart className="h-4 w-4" />
                  {isWaitlistMode
                    ? "Add to Cart & Continue Browsing"
                    : "Add to Cart & Continue Browsing"}
                </Button>
                <Button
                  variant="ghost"
                  className="w-full gap-2"
                  onClick={() => {
                    const prevId = getPreviousStepId("review");
                    if (prevId) stepper.navigation.goTo(prevId as any);
                  }}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Back
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
            {currentWaiverPages.length > 1 && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                Page {currentPageIndex + 1} of {currentWaiverPages.length}
                {currentWaiverPages[currentPageIndex]?.title && (
                  <span>: {currentWaiverPages[currentPageIndex].title}</span>
                )}
              </div>
            )}

            <div className="border rounded-lg p-6 max-h-[400px] overflow-y-auto bg-card">
              <div
                className="prose prose-sm dark:prose-invert max-w-none"
                dangerouslySetInnerHTML={{
                  __html: sanitizeHtml(currentWaiverPages[currentPageIndex]?.content || ""),
                }}
              />
            </div>

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

function CustomInfoStep({
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
