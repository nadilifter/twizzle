"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { ImageUpload } from "@/components/ui/image-upload";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  User,
  Star,
  Users,
  Calendar,
  Layers,
  CreditCard,
  Trash2,
  Plus,
  Info,
  MapPin,
  Clock,
  Repeat,
  CalendarDays,
  FileText,
  Heart,
  AlertTriangle,
  ClipboardList,
  ShieldAlert,
  Copy,
  Ticket,
  Link2,
  KeyRound,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { FileRequirementConfigEditor } from "@/components/ui/file-requirement-config";
import type { FileRequirementConfig } from "@/types/file-requirements";
import { useFeatures } from "@/components/feature-context";
import { useStaff } from "@/hooks/use-staff";
import { useStaffCertStatus } from "@/hooks/use-staff-cert-status";
import { useMemberships } from "@/hooks/use-memberships";
import { usePasses } from "@/hooks/use-passes";
import { useSeasons } from "@/hooks/use-seasons";
import { useCategories } from "@/hooks/use-categories";
import { SeasonDateWarning } from "@/components/season-date-warning";
import type { ProgramStaffRole } from "@/types/staff";
import type {
  ProgramWithRelations,
  CreateProgramPayload,
  UpdateProgramPayload,
  SpaceWithAvailability,
} from "@/types/programs";
import { cn } from "@/lib/utils";
import { CopySettingsDialog } from "@/components/copy-settings-dialog";
import { ColorSelector } from "@/components/color-selector";
import {
  RecurrencePicker,
  type RecurrenceConfig,
  configToRRule,
  parseRRule,
} from "@/components/ui/recurrence-picker";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { format, addMonths } from "date-fns";

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
}

interface MembershipInstance {
  id: string;
  name: string;
  price: number;
  groupName: string;
}

interface StaffAssignment {
  memberId: string;
  role: ProgramStaffRole;
  isPrimary: boolean;
  member?: {
    id: string;
    user: {
      name: string;
      avatar: string | null;
    };
    title: string | null;
  };
}

interface ProgramFormData {
  // Season (optional first step)
  seasonId: string | null;

  // Category
  categoryId: string | null;

  // Step 1: General
  name: string;
  description: string;
  color: string;
  imageUrl: string | null;
  registrationType: "ALL_INSTANCES" | "PER_INSTANCE";
  /** Single price: per-session (per-class) or flat rate (entire program). Null/0 = free. */
  price: number | null;
  billingInterval: "ONE_TIME" | "MONTHLY" | "YEARLY";
  recurringPrice: number | null;

  // Step 2: Date & Location
  startDate: Date | null;
  endDate: Date | null;
  startTime: string;
  duration: number | null;
  facilityId: string | null;
  rrule: string | null;
  spaceIds: string[];

  // Step 3: Requirements
  hasLevelRestriction: boolean;
  levelRequirementIds: string[];
  hasCapacityRestriction: boolean;
  hasSpaceRestriction: boolean;
  spaceCapacityMode: "MINIMUM" | "SUM";
  capacity: number | null;
  hasAgeRestriction: boolean;
  minAge: number | null;
  maxAge: number | null;
  hasGenderRestriction: boolean;
  allowedGenders: ("MALE" | "FEMALE" | "OTHER" | "PREFER_NOT_TO_SAY")[];
  hasMembershipRestriction: boolean;
  membershipRequirementIds: string[];
  hasPassRestriction: boolean;
  passRequirementIds: string[];
  hasWaiverRestriction: boolean;
  waiverRequirementIds: string[];
  hasMedicalRequirement: boolean;
  hasFileRequirement: boolean;
  fileRequirementConfig: FileRequirementConfig | null;

  // Waitlist
  waitlistEnabled: boolean;
  waitlistAutoPromote: boolean;
  waitlistCapacity: number | null;

  // Step 4: Evaluation
  evaluationTemplateId: string | null;

  // Step 5: Staff
  staffAssignments: StaffAssignment[];
  showCoachOnSite: boolean;

  // Step 6: Registration
  registrationOpen: boolean;
  registrationStartDate: Date | null;
  registrationStartTime: string;
  registrationEndDate: Date | null;
  registrationEndTime: string;
  earlyAccessCode: string | null;
}

interface ProgramStepperProps {
  program?: ProgramWithRelations | null;
  onSuccess?: (program: ProgramWithRelations) => void;
}

const ROLE_LABELS: Record<ProgramStaffRole, string> = {
  LEAD_COACH: "Lead Coach",
  ASSISTANT_COACH: "Assistant Coach",
  SUBSTITUTE: "Substitute",
  VOLUNTEER: "Volunteer",
};

const { useStepper } = defineStepper(
  { id: "season", title: "Season" },
  { id: "general", title: "General" },
  { id: "schedule", title: "Schedule" },
  { id: "requirements", title: "Requirements" },
  { id: "waitlist", title: "Waitlist" },
  { id: "evaluation", title: "Evaluation" },
  { id: "staff", title: "Staff" },
  { id: "registration", title: "Registration" }
);

export function ProgramStepper({ program, onSuccess }: ProgramStepperProps) {
  const router = useRouter();
  const isEditing = !!program;
  const { isFeatureEnabled } = useFeatures();
  const trainingEnabled = isFeatureEnabled("training");
  const membershipsEnabled = isFeatureEnabled("memberships");
  const waitlistsEnabled = isFeatureEnabled("waitlists");
  const seasonsEnabled = isFeatureEnabled("seasons");

  // Hooks for data
  const { staff: availableStaff, isLoading: loadingStaff } = useStaff();
  const { memberships, isLoading: loadingMemberships } = useMemberships({
    initialParams: { include: "instances" },
  });
  const { seasons, isLoading: seasonsLoading } = useSeasons({ autoFetch: seasonsEnabled });
  const { categories, isLoading: categoriesLoading } = useCategories();
  const { passes: availablePasses, isLoading: loadingPasses } = usePasses();
  const {
    requiredCertNames,
    hasRequirements: hasCertRequirements,
    getMemberStatus,
  } = useStaffCertStatus("programs");

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

  // Spaces state
  const [spaces, setSpaces] = React.useState<SpaceWithAvailability[]>([]);
  const [loadingSpaces, setLoadingSpaces] = React.useState(false);
  const [fullyBookedOverride, setFullyBookedOverride] = React.useState<string | null>(null);
  const [conflictDetailsSpaceId, setConflictDetailsSpaceId] = React.useState<string | null>(null);

  // Evaluation templates state
  const [evaluationTemplates, setEvaluationTemplates] = React.useState<
    Array<{
      id: string;
      name: string;
      description: string | null;
      scoringType: string;
      pointScaleMin: number;
      pointScaleMax: number;
      pointScalePassThreshold: number;
      level: { id: string; name: string; color: string | null } | null;
      skills: Array<{
        id: string;
        skill: { id: string; name: string; category: string };
        order: number;
      }>;
    }>
  >([]);
  const [loadingEvalTemplates, setLoadingEvalTemplates] = React.useState(false);
  const [existingTemplateAssignment, setExistingTemplateAssignment] = React.useState<string | null>(
    null
  );

  const showSeasonStep = seasonsEnabled && (seasons.length > 0 || seasonsLoading);

  // Form state
  const [formData, setFormData] = React.useState<ProgramFormData>(() => ({
    // Season
    seasonId: (program as any)?.seasonId || null,

    // Category
    categoryId: program?.categoryId || null,

    // Step 1: General
    name: program?.name || "",
    description: program?.description || "",
    color: (program as any)?.color || "#3b82f6",
    imageUrl: (program as any)?.imageUrl || null,
    registrationType: (program as any)?.registrationType || "ALL_INSTANCES",
    price: (() => {
      const p = program as any;
      if (!p) return null;
      const isFlat = p.pricingModel === "FLAT_RATE";
      const val = isFlat ? p.basePrice : p.perSessionPrice;
      return val != null ? Number(val) : null;
    })(),
    billingInterval: (program?.billingInterval || "ONE_TIME") as "ONE_TIME" | "MONTHLY" | "YEARLY",
    recurringPrice: program?.recurringPrice != null ? Number(program.recurringPrice) : null,

    // Step 2: Date & Location
    startDate: program?.startDate ? new Date(program.startDate) : null,
    endDate: program?.endDate ? new Date(program.endDate) : null,
    startTime: (program as any)?.startTime || "09:00",
    duration: (program as any)?.duration || 60,
    facilityId: (program as any)?.facilityId || null,
    rrule: (program as any)?.rrule || null,
    spaceIds: program?.spaces?.map((s) => s.spaceId) || [],

    // Step 3: Requirements
    hasLevelRestriction: program?.hasLevelRestriction || false,
    levelRequirementIds: program?.levelRequirements?.map((lr) => lr.levelId) || [],
    hasCapacityRestriction: program?.hasCapacityRestriction || false,
    hasSpaceRestriction: program?.hasSpaceRestriction || false,
    spaceCapacityMode: program?.spaceCapacityMode || "MINIMUM",
    capacity: program?.capacity || null,
    hasAgeRestriction: program?.hasAgeRestriction || false,
    minAge: program?.minAge || null,
    maxAge: program?.maxAge || null,
    hasGenderRestriction: (program as any)?.hasGenderRestriction || false,
    allowedGenders: (program as any)?.allowedGenders || [],
    hasMembershipRestriction: program?.hasMembershipRestriction || false,
    membershipRequirementIds: program?.requiredMemberships?.map((m) => m.id) || [],
    hasPassRestriction: (program as any)?.hasPassRestriction || false,
    passRequirementIds: (program as any)?.requiredPasses?.map((p: any) => p.id) || [],
    hasWaiverRestriction: (program as any)?.hasWaiverRestriction || false,
    waiverRequirementIds: (program as any)?.waiverRequirements?.map((wr: any) => wr.waiverId) || [],
    hasMedicalRequirement: program?.hasMedicalRequirement || false,
    hasFileRequirement: (program as any)?.hasFileRequirement || false,
    fileRequirementConfig: (program as any)?.fileRequirementConfig || null,

    // Waitlist
    waitlistEnabled: (program as any)?.waitlistEnabled || false,
    waitlistAutoPromote: (program as any)?.waitlistAutoPromote || false,
    waitlistCapacity: (program as any)?.waitlistCapacity || null,

    // Step 4: Evaluation
    evaluationTemplateId: null,

    // Step 5: Staff
    staffAssignments:
      program?.staffAssignments?.map((sa) => ({
        memberId: sa.memberId,
        role: sa.role,
        isPrimary: sa.isPrimary,
        member: sa.member,
      })) || [],
    showCoachOnSite: program?.showCoachOnSite ?? true,

    // Step 6: Registration
    registrationOpen: program?.registrationOpen ?? true,
    registrationStartDate: program?.registrationStartDate
      ? new Date(program.registrationStartDate)
      : null,
    registrationStartTime: program?.registrationStartTime || "09:00",
    registrationEndDate: program?.registrationEndDate
      ? new Date(program.registrationEndDate)
      : null,
    registrationEndTime: program?.registrationEndTime || "23:59",
    earlyAccessCode: program?.earlyAccessCode || null,
  }));

  const selectedSeason = React.useMemo(() => {
    if (!formData.seasonId) return null;
    return seasons.find((s) => s.id === formData.seasonId) ?? null;
  }, [formData.seasonId, seasons]);

  const visibleStepIds = React.useMemo(() => {
    const ids: string[] = [];
    if (showSeasonStep) ids.push("season");
    ids.push("general", "schedule", "requirements");
    if (waitlistsEnabled) ids.push("waitlist");
    if (trainingEnabled) ids.push("evaluation");
    ids.push("staff", "registration");
    return ids;
  }, [trainingEnabled, waitlistsEnabled, showSeasonStep]);

  const [isSaving, setIsSaving] = React.useState(false);
  const [copyDialogOpen, setCopyDialogOpen] = React.useState(false);
  const stepper = useStepper();

  React.useEffect(() => {
    if (!visibleStepIds.includes(stepper.state.current.data.id)) {
      stepper.navigation.goTo(visibleStepIds[0] as "general");
    }
  }, [visibleStepIds, stepper.state.current.data.id, stepper.navigation]);

  React.useEffect(() => {
    if (stepper.state.current.data.id === "registration") {
      setFormData((prev) => {
        const updates: Partial<ProgramFormData> = {};
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
  }, [stepper.state.current.data.id]);

  const handleCopyFromProgram = React.useCallback(
    async (sourceId: string) => {
      try {
        const response = await fetch(`/api/programs/${sourceId}`);
        if (!response.ok) throw new Error("Failed to fetch program");
        const data = await response.json();

        let evalTemplateId: string | null = null;
        if (trainingEnabled) {
          try {
            const evalRes = await fetch(`/api/programs/${sourceId}/evaluation-templates`);
            if (evalRes.ok) {
              const evalData = await evalRes.json();
              if (evalData.templates?.length > 0) {
                evalTemplateId = evalData.templates[0].templateId;
              }
            }
          } catch {}
        }

        const isFlat = data.pricingModel === "FLAT_RATE";
        const priceVal = isFlat ? data.basePrice : data.perSessionPrice;

        setFormData((prev) => ({
          ...prev,
          description: data.description || "",
          color: data.color || "#3b82f6",
          imageUrl: data.imageUrl || null,
          registrationType: data.registrationType || "ALL_INSTANCES",
          price: priceVal != null ? Number(priceVal) : null,
          startDate: data.startDate ? new Date(data.startDate) : null,
          endDate: data.endDate ? new Date(data.endDate) : null,
          startTime: data.startTime || "09:00",
          duration: data.duration || 60,
          facilityId: data.facilityId || null,
          rrule: data.rrule || null,
          spaceIds: data.spaces?.map((s: any) => s.spaceId) || [],
          hasLevelRestriction: data.hasLevelRestriction || false,
          levelRequirementIds: data.levelRequirements?.map((lr: any) => lr.levelId) || [],
          hasCapacityRestriction: data.hasCapacityRestriction || false,
          hasSpaceRestriction: data.hasSpaceRestriction || false,
          spaceCapacityMode: data.spaceCapacityMode || "MINIMUM",
          capacity: data.capacity || null,
          hasAgeRestriction: data.hasAgeRestriction || false,
          minAge: data.minAge || null,
          maxAge: data.maxAge || null,
          hasGenderRestriction: data.hasGenderRestriction || false,
          allowedGenders: data.allowedGenders || [],
          hasMembershipRestriction: data.hasMembershipRestriction || false,
          membershipRequirementIds: data.requiredMemberships?.map((m: any) => m.id) || [],
          hasPassRestriction: data.hasPassRestriction || false,
          passRequirementIds: data.requiredPasses?.map((p: any) => p.id) || [],
          hasWaiverRestriction: data.hasWaiverRestriction || false,
          waiverRequirementIds: data.waiverRequirements?.map((wr: any) => wr.waiverId) || [],
          hasMedicalRequirement: data.hasMedicalRequirement || false,
          hasFileRequirement: data.hasFileRequirement || false,
          fileRequirementConfig: data.fileRequirementConfig || null,
          waitlistEnabled: data.waitlistEnabled || false,
          waitlistAutoPromote: data.waitlistAutoPromote || false,
          waitlistCapacity: data.waitlistCapacity || null,
          evaluationTemplateId: evalTemplateId,
          staffAssignments: [],
          showCoachOnSite: true,
        }));

        toast.success(`Settings copied from "${data.name}"`);
      } catch (error) {
        console.error("Failed to copy program settings:", error);
        toast.error("Failed to copy program settings");
        throw error;
      }
    },
    [trainingEnabled]
  );

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
    fetchLevels();
  }, []);

  // Fetch facilities
  React.useEffect(() => {
    const fetchFacilities = async () => {
      try {
        const response = await fetch("/api/organization/facilities");
        if (response.ok) {
          const data = await response.json();
          setFacilities(data);
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

  // Fetch evaluation templates (only when training is enabled)
  React.useEffect(() => {
    if (!trainingEnabled) return;
    const fetchEvalTemplates = async () => {
      setLoadingEvalTemplates(true);
      try {
        const response = await fetch("/api/evaluation-templates?isActive=true&limit=100");
        if (response.ok) {
          const data = await response.json();
          setEvaluationTemplates(data.data || []);
        }
      } catch (error) {
        console.error("Failed to fetch evaluation templates:", error);
      } finally {
        setLoadingEvalTemplates(false);
      }
    };
    fetchEvalTemplates();
  }, [trainingEnabled]);

  // Fetch existing evaluation template assignment when editing
  React.useEffect(() => {
    if (!isEditing || !program || !trainingEnabled) return;
    const fetchAssignment = async () => {
      try {
        const response = await fetch(`/api/programs/${program.id}/evaluation-templates`);
        if (response.ok) {
          const data = await response.json();
          if (data.templates && data.templates.length > 0) {
            const templateId = data.templates[0].templateId;
            setExistingTemplateAssignment(templateId);
            setFormData((prev) => ({ ...prev, evaluationTemplateId: templateId }));
          }
        }
      } catch (error) {
        console.error("Failed to fetch evaluation template assignment:", error);
      }
    };
    fetchAssignment();
  }, [isEditing, program, trainingEnabled]);

  // Fetch spaces + availability when facility or time changes
  // Extract ISO weekdays from rrule string (e.g. BYDAY=MO,WE,FR -> [0,2,4])
  const rruleDays = React.useMemo(() => {
    if (!formData.rrule) return [];
    const match = formData.rrule.match(/BYDAY=([A-Z,]+)/);
    if (!match) return [];
    const dayMap: Record<string, number> = { MO: 0, TU: 1, WE: 2, TH: 3, FR: 4, SA: 5, SU: 6 };
    return match[1]
      .split(",")
      .map((d) => dayMap[d])
      .filter((d): d is number => d != null);
  }, [formData.rrule]);

  const fetchSpaceAvailability = React.useCallback(
    async (
      facilityId: string,
      startTime?: string,
      duration?: number | null,
      daysOfWeek?: number[],
      programStartDate?: Date | null,
      programEndDate?: Date | null
    ) => {
      setLoadingSpaces(true);
      try {
        const params = new URLSearchParams();
        if (startTime && duration) {
          params.set("startTime", startTime);
          const [h, m] = startTime.split(":").map(Number);
          const endDate = new Date(2000, 0, 1, h, m + duration);
          params.set(
            "endTime",
            `${String(endDate.getHours()).padStart(2, "0")}:${String(endDate.getMinutes()).padStart(2, "0")}`
          );
        }
        if (daysOfWeek && daysOfWeek.length > 0) {
          params.set("daysOfWeek", daysOfWeek.join(","));
        }
        if (programStartDate) {
          params.set("programStartDate", programStartDate.toISOString().slice(0, 10));
        }
        if (programEndDate) {
          params.set("programEndDate", programEndDate.toISOString().slice(0, 10));
        }
        if (isEditing && program) {
          params.set("excludeProgramId", program.id);
        }
        const qs = params.toString();
        const response = await fetch(
          `/api/organization/facilities/${facilityId}/spaces/availability${qs ? `?${qs}` : ""}`
        );
        if (response.ok) {
          const data = await response.json();
          setSpaces(data);
        }
      } catch (error) {
        console.error("Failed to fetch spaces:", error);
      } finally {
        setLoadingSpaces(false);
      }
    },
    [isEditing, program]
  );

  React.useEffect(() => {
    if (formData.facilityId) {
      fetchSpaceAvailability(
        formData.facilityId,
        formData.startTime,
        formData.duration,
        rruleDays,
        formData.startDate,
        formData.endDate
      );
    } else {
      setSpaces([]);
      setFormData((prev) => ({ ...prev, spaceIds: [] }));
    }
  }, [
    formData.facilityId,
    formData.startTime,
    formData.duration,
    rruleDays,
    formData.startDate,
    formData.endDate,
    fetchSpaceAvailability,
  ]);

  // Compute space-derived capacity
  const spaceDerivedCapacity = React.useMemo(() => {
    if (formData.spaceIds.length === 0) return null;
    const selectedSpaces = spaces.filter((s) => formData.spaceIds.includes(s.id));
    const capacities = selectedSpaces.map((s) => s.capacity).filter((c): c is number => c != null);
    if (capacities.length === 0) return null;
    if (formData.spaceCapacityMode === "SUM") {
      return capacities.reduce((sum, c) => sum + c, 0);
    }
    return Math.min(...capacities);
  }, [formData.spaceIds, formData.spaceCapacityMode, spaces]);

  // Flatten membership instances from groups
  const allMembershipInstances = React.useMemo(() => {
    return (
      memberships?.flatMap(
        (group) =>
          group.instances?.map((instance: any) => ({
            id: instance.id,
            name: instance.name,
            price: Number(instance.price),
            groupName: group.name,
          })) || []
      ) || []
    );
  }, [memberships]);

  // Filter out already assigned staff
  const unassignedStaff = React.useMemo(() => {
    return (
      availableStaff?.filter((s) => !formData.staffAssignments.some((a) => a.memberId === s.id)) ||
      []
    );
  }, [availableStaff, formData.staffAssignments]);

  // Validation
  const validateStep = (stepId: string): boolean => {
    switch (stepId) {
      case "general":
        if (!formData.name.trim()) {
          toast.error("Program name is required");
          return false;
        }
        if (formData.price !== null && formData.price !== undefined && formData.price < 0) {
          toast.error("Price cannot be negative");
          return false;
        }
        return true;
      case "schedule":
        if (!formData.startDate) {
          toast.error("Start date is required");
          return false;
        }
        if (!formData.endDate) {
          toast.error("End date is required");
          return false;
        }
        if (formData.endDate && formData.startDate && formData.endDate < formData.startDate) {
          toast.error("End date must be after start date");
          return false;
        }
        if (!formData.startTime) {
          toast.error("Start time is required");
          return false;
        }
        if (!formData.duration || formData.duration < 1) {
          toast.error("Duration must be at least 1 minute");
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
        if (formData.hasGenderRestriction && formData.allowedGenders.length === 0) {
          toast.error("Select at least one gender when gender restriction is enabled");
          return false;
        }
        if (formData.hasLevelRestriction && formData.levelRequirementIds.length === 0) {
          toast.error("Select at least one level when level restriction is enabled");
          return false;
        }
        if (formData.hasMembershipRestriction && formData.membershipRequirementIds.length === 0) {
          toast.error("Select at least one membership when membership restriction is enabled");
          return false;
        }
        if (formData.hasPassRestriction && formData.passRequirementIds.length === 0) {
          toast.error("Select at least one pass when pass restriction is enabled");
          return false;
        }
        if (formData.hasWaiverRestriction && formData.waiverRequirementIds.length === 0) {
          toast.error("Select at least one waiver when waiver restriction is enabled");
          return false;
        }
        if (formData.hasFileRequirement && !formData.fileRequirementConfig?.label?.trim()) {
          toast.error("Provide a label for the file upload requirement");
          return false;
        }
        if (formData.hasFileRequirement && formData.fileRequirementConfig) {
          const { acceptedPresets, acceptedExtensions } = formData.fileRequirementConfig;
          if (acceptedPresets.length === 0 && acceptedExtensions.length === 0) {
            toast.error("Select at least one file type preset or add a custom extension");
            return false;
          }
        }
        return true;
      case "evaluation":
        return true;
      case "staff":
        return true;
      case "registration":
        if (!formData.registrationOpen) {
          if (!formData.registrationStartDate) {
            toast.error("Please select a registration start date");
            return false;
          }
          if (formData.startDate && formData.registrationStartDate > formData.startDate) {
            toast.error(
              "Registration start date cannot be later than the first day of the program"
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
      default:
        return true;
    }
  };

  type StepId = "general" | "schedule" | "requirements" | "evaluation" | "staff" | "registration";

  const getNextVisibleStepId = (currentId: string): StepId | null => {
    const idx = visibleStepIds.indexOf(currentId);
    if (idx === -1 || idx >= visibleStepIds.length - 1) return null;
    return visibleStepIds[idx + 1] as StepId;
  };

  const getPrevVisibleStepId = (currentId: string): StepId | null => {
    const idx = visibleStepIds.indexOf(currentId);
    if (idx <= 0) return null;
    return visibleStepIds[idx - 1] as StepId;
  };

  const handleNext = () => {
    const currentId = stepper.state.current.data.id;
    if (validateStep(currentId)) {
      const nextId = getNextVisibleStepId(currentId);
      if (nextId) stepper.navigation.goTo(nextId);
    }
  };

  const handlePrev = () => {
    const currentId = stepper.state.current.data.id;
    const prevId = getPrevVisibleStepId(currentId);
    if (prevId) stepper.navigation.goTo(prevId);
  };

  const handleSubmit = async () => {
    for (const stepId of visibleStepIds) {
      if (!validateStep(stepId)) return;
    }

    setIsSaving(true);

    try {
      const isFlatRate = formData.registrationType === "ALL_INSTANCES";
      const priceValue =
        formData.price != null ? Math.max(0, Math.round(formData.price * 100) / 100) : null;
      const recurringPriceValue =
        formData.recurringPrice != null
          ? Math.max(0, Math.round(formData.recurringPrice * 100) / 100)
          : null;

      const payload: CreateProgramPayload | UpdateProgramPayload = {
        name: formData.name,
        description: formData.description || undefined,
        color: formData.color,
        registrationType: formData.registrationType,
        pricingModel: isFlatRate ? "FLAT_RATE" : "PER_SESSION",
        basePrice: isFlatRate ? priceValue : null,
        perSessionPrice: !isFlatRate ? priceValue : null,
        billingInterval: formData.billingInterval,
        recurringPrice: formData.billingInterval !== "ONE_TIME" ? recurringPriceValue : null,
        startDate: formData.startDate?.toISOString(),
        endDate: formData.endDate?.toISOString(),
        startTime: formData.startTime,
        duration: formData.duration,
        facilityId: formData.facilityId,
        rrule: formData.rrule,
        hasLevelRestriction: formData.hasLevelRestriction,
        hasCapacityRestriction: formData.hasCapacityRestriction,
        hasAgeRestriction: formData.hasAgeRestriction,
        hasGenderRestriction: formData.hasGenderRestriction,
        allowedGenders: formData.hasGenderRestriction ? formData.allowedGenders : [],
        hasMembershipRestriction: formData.hasMembershipRestriction,
        hasPassRestriction: formData.hasPassRestriction,
        hasWaiverRestriction: formData.hasWaiverRestriction,
        hasMedicalRequirement: formData.hasMedicalRequirement,
        hasFileRequirement: formData.hasFileRequirement,
        fileRequirementConfig: formData.hasFileRequirement ? formData.fileRequirementConfig : null,
        hasSpaceRestriction: formData.hasSpaceRestriction,
        spaceCapacityMode: formData.spaceCapacityMode,
        capacity: formData.hasCapacityRestriction ? formData.capacity : null,
        spaceIds: formData.spaceIds,
        minAge: formData.hasAgeRestriction ? formData.minAge : null,
        maxAge: formData.hasAgeRestriction ? formData.maxAge : null,
        showCoachOnSite: formData.showCoachOnSite,
        imageUrl: formData.imageUrl,
        waitlistEnabled: formData.waitlistEnabled,
        waitlistAutoPromote: formData.waitlistEnabled ? formData.waitlistAutoPromote : false,
        waitlistCapacity: formData.waitlistEnabled ? formData.waitlistCapacity : null,
        levelRequirementIds: formData.hasLevelRestriction ? formData.levelRequirementIds : [],
        membershipRequirementIds: formData.hasMembershipRestriction
          ? formData.membershipRequirementIds
          : [],
        passRequirementIds: formData.hasPassRestriction ? formData.passRequirementIds : [],
        waiverRequirementIds: formData.hasWaiverRestriction ? formData.waiverRequirementIds : [],
        staffAssignments: formData.staffAssignments.map((sa) => ({
          memberId: sa.memberId,
          role: sa.role,
          isPrimary: sa.isPrimary,
        })),
        seasonId: formData.seasonId,
        categoryId: formData.categoryId,
        registrationOpen: formData.registrationOpen,
        registrationStartDate: !formData.registrationOpen
          ? formData.registrationStartDate?.toISOString()
          : null,
        registrationStartTime: !formData.registrationOpen ? formData.registrationStartTime : null,
        registrationEndDate: formData.registrationEndDate?.toISOString() ?? null,
        registrationEndTime: formData.registrationEndTime || null,
        earlyAccessCode: formData.earlyAccessCode,
      };

      const url = isEditing ? `/api/programs/${program.id}` : "/api/programs";
      const method = isEditing ? "PATCH" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        if (response.status === 422 && error.certifications) {
          const names = error.certifications
            .map((c: { certificationName: string }) => c.certificationName)
            .join(", ");
          throw new Error(`Staff missing required certifications: ${names}`);
        }
        throw new Error(error.error || "Failed to save program");
      }

      const savedProgram = await response.json();

      // Save evaluation template assignment if training is enabled
      if (trainingEnabled) {
        const programId = savedProgram.id;
        const newTemplateId = formData.evaluationTemplateId;
        const oldTemplateId = existingTemplateAssignment;

        if (newTemplateId !== oldTemplateId) {
          // Remove old assignment if it existed
          if (oldTemplateId) {
            await fetch(
              `/api/programs/${programId}/evaluation-templates?templateId=${oldTemplateId}`,
              {
                method: "DELETE",
              }
            );
          }
          // Add new assignment if selected
          if (newTemplateId) {
            await fetch(`/api/programs/${programId}/evaluation-templates`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ templateId: newTemplateId }),
            });
          }
        }
      }

      toast.success(isEditing ? "Program updated successfully" : "Program created successfully");

      if (onSuccess) {
        onSuccess(savedProgram);
      } else {
        router.push("/dashboard/registrations/programs");
      }
    } catch (error: any) {
      console.error("Failed to save program:", error);
      toast.error(error.message || "Failed to save program");
    } finally {
      setIsSaving(false);
    }
  };

  // Staff management
  const handleAddStaff = (memberId: string) => {
    const staff = availableStaff?.find((s) => s.id === memberId);
    if (!staff) return;

    setFormData((prev) => ({
      ...prev,
      staffAssignments: [
        ...prev.staffAssignments,
        {
          memberId,
          role: "ASSISTANT_COACH" as ProgramStaffRole,
          isPrimary: prev.staffAssignments.length === 0, // First staff is primary
          member: {
            id: staff.id,
            user: {
              name: staff.user?.name || "Unknown",
              avatar: staff.user?.avatar || null,
            },
            title: staff.title,
          },
        },
      ],
    }));
  };

  const handleRemoveStaff = (memberId: string) => {
    setFormData((prev) => {
      const newAssignments = prev.staffAssignments.filter((a) => a.memberId !== memberId);
      // If we removed the primary, make the first one primary
      if (newAssignments.length > 0 && !newAssignments.some((a) => a.isPrimary)) {
        newAssignments[0].isPrimary = true;
      }
      return { ...prev, staffAssignments: newAssignments };
    });
  };

  const handleSetPrimary = (memberId: string) => {
    setFormData((prev) => ({
      ...prev,
      staffAssignments: prev.staffAssignments.map((a) => ({
        ...a,
        isPrimary: a.memberId === memberId,
      })),
    }));
  };

  const handleUpdateStaffRole = (memberId: string, role: ProgramStaffRole) => {
    setFormData((prev) => ({
      ...prev,
      staffAssignments: prev.staffAssignments.map((a) =>
        a.memberId === memberId ? { ...a, role } : a
      ),
    }));
  };

  const visibleSteps = stepper.state.all.filter((s) => visibleStepIds.includes(s.id));
  const currentVisibleIndex = visibleSteps.findIndex((s) => s.id === stepper.state.current.data.id);
  const isFirstVisible = currentVisibleIndex === 0;
  const isLastVisible = currentVisibleIndex === visibleSteps.length - 1;

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

        {/* Step Content */}
        {stepper.state.current.data.id === "season" && (
          <Card>
            <CardHeader>
              <CardTitle>Season</CardTitle>
              <CardDescription>Optionally assign this program to a season</CardDescription>
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
                  {selectedSeason.description && (
                    <p className="text-sm text-muted-foreground">{selectedSeason.description}</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {stepper.state.current.data.id === "general" && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="space-y-1.5">
                  <CardTitle className="flex items-center gap-2">
                    <Layers className="h-5 w-5" />
                    Program Details
                  </CardTitle>
                  <CardDescription>Enter the basic information about your program</CardDescription>
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
              entityType="program"
              open={copyDialogOpen}
              onOpenChange={setCopyDialogOpen}
              onSelect={handleCopyFromProgram}
            />

            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="name">Program Name *</Label>
                <Input
                  id="name"
                  placeholder="e.g., Recreational Gymnastics - Bronze"
                  value={formData.name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <RichTextEditor
                  value={formData.description}
                  onChange={(value) => setFormData((prev) => ({ ...prev, description: value }))}
                  placeholder="Describe what this program offers, who it's for, and what participants will learn..."
                />
              </div>

              <ColorSelector
                value={formData.color}
                onChange={(color) => setFormData((prev) => ({ ...prev, color }))}
              />

              <ImageUpload
                label="Program Image"
                value={formData.imageUrl}
                onChange={(url) => setFormData((prev) => ({ ...prev, imageUrl: url }))}
                type="program"
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

              {/* Registration Style */}
              <div className="space-y-4 rounded-lg border p-4 bg-muted/20">
                <Label className="text-base font-medium">Registration Style</Label>
                <RadioGroup
                  value={formData.registrationType}
                  onValueChange={(value: "ALL_INSTANCES" | "PER_INSTANCE") =>
                    setFormData((prev) => ({ ...prev, registrationType: value }))
                  }
                  className="space-y-3"
                >
                  <label
                    className={cn(
                      "flex items-start gap-3 rounded-lg border bg-background p-3 cursor-pointer transition-colors",
                      formData.registrationType === "ALL_INSTANCES"
                        ? "border-primary bg-primary/5"
                        : "hover:bg-muted/50"
                    )}
                  >
                    <RadioGroupItem value="ALL_INSTANCES" className="mt-0.5" />
                    <div className="flex-1 space-y-1">
                      <span className="font-medium text-sm">Enroll in entire program</span>
                      <p className="text-xs text-muted-foreground">
                        Athletes register once for all sessions during the program period
                      </p>
                    </div>
                  </label>

                  <label
                    className={cn(
                      "flex items-start gap-3 rounded-lg border bg-background p-3 cursor-pointer transition-colors",
                      formData.registrationType === "PER_INSTANCE"
                        ? "border-primary bg-primary/5"
                        : "hover:bg-muted/50"
                    )}
                  >
                    <RadioGroupItem value="PER_INSTANCE" className="mt-0.5" />
                    <div className="flex-1 space-y-1">
                      <span className="font-medium text-sm">Sign up per class</span>
                      <p className="text-xs text-muted-foreground">
                        Athletes register individually for each session they want to attend
                      </p>
                    </div>
                  </label>
                </RadioGroup>
              </div>

              {/* Billing Schedule (only for full-program / ALL_INSTANCES registration) */}
              {formData.registrationType === "ALL_INSTANCES" && (
                <div className="space-y-3">
                  <Label className="text-base font-medium flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-muted-foreground" />
                    Billing Schedule
                  </Label>
                  <RadioGroup
                    value={formData.billingInterval}
                    onValueChange={(val) =>
                      setFormData((prev) => ({
                        ...prev,
                        billingInterval: val as "ONE_TIME" | "MONTHLY" | "YEARLY",
                      }))
                    }
                    className="grid gap-2"
                  >
                    <label className="flex items-center gap-3 rounded-lg border p-3 cursor-pointer hover:bg-accent/50 transition-colors">
                      <RadioGroupItem value="ONE_TIME" />
                      <div>
                        <p className="font-medium text-sm">One-time payment</p>
                        <p className="text-xs text-muted-foreground">
                          Guardian pays the flat rate once at checkout
                        </p>
                      </div>
                    </label>
                    <label className="flex items-center gap-3 rounded-lg border p-3 cursor-pointer hover:bg-accent/50 transition-colors">
                      <RadioGroupItem value="MONTHLY" />
                      <div>
                        <p className="font-medium text-sm">Monthly recurring</p>
                        <p className="text-xs text-muted-foreground">
                          Guardian is billed a set amount each month while enrolled
                        </p>
                      </div>
                    </label>
                    <label className="flex items-center gap-3 rounded-lg border p-3 cursor-pointer hover:bg-accent/50 transition-colors">
                      <RadioGroupItem value="YEARLY" />
                      <div>
                        <p className="font-medium text-sm">Annual recurring</p>
                        <p className="text-xs text-muted-foreground">
                          Guardian is billed a set amount each year while enrolled
                        </p>
                      </div>
                    </label>
                  </RadioGroup>
                </div>
              )}

              {/* Price — contextual based on billing schedule */}
              {(formData.registrationType === "PER_INSTANCE" ||
                formData.billingInterval === "ONE_TIME") && (
                <div className="space-y-2">
                  <Label htmlFor="price" className="text-base font-medium flex items-center gap-2">
                    {formData.registrationType === "PER_INSTANCE" && (
                      <CreditCard className="h-4 w-4 text-muted-foreground" />
                    )}
                    {formData.registrationType === "ALL_INSTANCES"
                      ? "Price (flat rate)"
                      : "Price (per session)"}
                  </Label>
                  <div className="relative max-w-[200px]">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                      $
                    </span>
                    <Input
                      id="price"
                      type="number"
                      min={0}
                      step={0.01}
                      placeholder="0.00"
                      className="pl-7"
                      value={formData.price === null ? "" : formData.price}
                      onChange={(e) => {
                        const raw = e.target.value;
                        if (raw === "") {
                          setFormData((prev) => ({ ...prev, price: null }));
                          return;
                        }
                        const parsed = parseFloat(raw);
                        if (Number.isNaN(parsed)) return;
                        if (parsed < 0) return;
                        const rounded = Math.round(parsed * 100) / 100;
                        setFormData((prev) => ({ ...prev, price: rounded }));
                      }}
                      onBlur={(e) => {
                        const raw = e.target.value;
                        if (raw === "") return;
                        const parsed = parseFloat(raw);
                        if (!Number.isNaN(parsed) && parsed >= 0) {
                          const rounded = Math.round(parsed * 100) / 100;
                          if (rounded !== formData.price) {
                            setFormData((prev) => ({ ...prev, price: rounded }));
                          }
                        }
                      }}
                    />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Optional. Leave blank or set to 0 for free programs. Maximum 2 decimal places.
                  </p>
                </div>
              )}

              {/* Recurring Price — only for monthly/yearly billing */}
              {formData.registrationType === "ALL_INSTANCES" &&
                formData.billingInterval !== "ONE_TIME" && (
                  <div className="space-y-2">
                    <Label className="text-base font-medium">
                      {formData.billingInterval === "MONTHLY" ? "Monthly" : "Annual"} Price
                    </Label>
                    <div className="relative max-w-[200px]">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                        $
                      </span>
                      <Input
                        type="number"
                        min={0}
                        step={0.01}
                        placeholder="0.00"
                        className="pl-7"
                        value={formData.recurringPrice === null ? "" : formData.recurringPrice}
                        onChange={(e) => {
                          const raw = e.target.value;
                          if (raw === "") {
                            setFormData((prev) => ({ ...prev, recurringPrice: null }));
                            return;
                          }
                          const parsed = parseFloat(raw);
                          if (Number.isNaN(parsed) || parsed < 0) return;
                          setFormData((prev) => ({
                            ...prev,
                            recurringPrice: Math.round(parsed * 100) / 100,
                          }));
                        }}
                      />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Amount charged per {formData.billingInterval === "MONTHLY" ? "month" : "year"}
                      . First payment collected at checkout.
                    </p>
                  </div>
                )}
            </CardContent>
          </Card>
        )}

        {/* Step 2: Date & Location */}
        {stepper.state.current.data.id === "schedule" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5" />
                Date & Location
              </CardTitle>
              <CardDescription>Set when and where this program takes place</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Use Season Dates */}
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
                      setFormData((prev) => ({
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

              {/* Date Selection */}
              <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Start Date *</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !formData.startDate && "text-muted-foreground"
                        )}
                      >
                        <Calendar className="mr-2 h-4 w-4" />
                        {formData.startDate ? format(formData.startDate, "PPP") : "Select date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        mode="single"
                        selected={formData.startDate || undefined}
                        onSelect={(date) => {
                          setFormData((prev) => ({
                            ...prev,
                            startDate: date || null,
                            endDate:
                              date && prev.endDate && prev.endDate < date ? null : prev.endDate,
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
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !formData.endDate && "text-muted-foreground"
                        )}
                      >
                        <Calendar className="mr-2 h-4 w-4" />
                        {formData.endDate ? format(formData.endDate, "PPP") : "Select end date"}
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
              </div>

              {/* Season Date Warning */}
              {selectedSeason && (
                <SeasonDateWarning
                  itemStartDate={formData.startDate}
                  itemEndDate={formData.endDate}
                  seasonStartDate={selectedSeason.startDate}
                  seasonEndDate={selectedSeason.endDate}
                  itemLabel="program"
                />
              )}

              {/* Time and Duration */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startTime">Start Time *</Label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="startTime"
                      type="time"
                      value={formData.startTime}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, startTime: e.target.value }))
                      }
                      className="pl-9"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="duration">Duration (minutes) *</Label>
                  <Input
                    id="duration"
                    type="number"
                    min={1}
                    max={480}
                    placeholder="60"
                    value={formData.duration || ""}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        duration: e.target.value ? parseInt(e.target.value) : null,
                      }))
                    }
                  />
                  {formData.duration && (
                    <p className="text-xs text-muted-foreground">
                      {Math.floor(formData.duration / 60)}h {formData.duration % 60}m
                    </p>
                  )}
                </div>
              </div>

              {/* Recurrence Pattern */}
              {formData.startDate && formData.endDate && (
                <div className="space-y-4 rounded-lg border p-4">
                  <div className="flex items-center gap-2">
                    <Repeat className="h-4 w-4 text-muted-foreground" />
                    <Label className="text-base font-medium">Recurrence Pattern</Label>
                  </div>
                  <RecurrencePicker
                    startDate={formData.startDate}
                    endDate={formData.endDate}
                    onRRuleChange={(rrule) => setFormData((prev) => ({ ...prev, rrule }))}
                  />
                </div>
              )}

              {/* Facility Selection */}
              <div className="space-y-2">
                <Label>Location</Label>
                {loadingFacilities ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading facilities...
                  </div>
                ) : facilities.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-4 text-center">
                    <MapPin className="h-6 w-6 mx-auto text-muted-foreground/50 mb-2" />
                    <p className="text-sm text-muted-foreground">
                      No facilities configured.{" "}
                      <a href="/dashboard/settings/facilities" className="text-primary underline">
                        Add a facility
                      </a>
                    </p>
                  </div>
                ) : (
                  <Select
                    value={formData.facilityId || "__none__"}
                    onValueChange={(value) =>
                      setFormData((prev) => ({
                        ...prev,
                        facilityId: value === "__none__" ? null : value,
                        spaceIds: value === "__none__" ? [] : prev.spaceIds,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a facility (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">No specific location</SelectItem>
                      {facilities.map((facility) => (
                        <SelectItem key={facility.id} value={facility.id}>
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-muted-foreground" />
                            <span>{facility.name}</span>
                            {facility.city && (
                              <span className="text-muted-foreground">
                                - {facility.city}
                                {facility.stateProvince && `, ${facility.stateProvince}`}
                              </span>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Space Selection - shown when a facility is selected */}
              {formData.facilityId && (
                <div className="space-y-3">
                  <Label>Spaces (optional)</Label>
                  {loadingSpaces ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading spaces...
                    </div>
                  ) : spaces.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No spaces configured for this facility.
                    </p>
                  ) : (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {spaces.map((space) => {
                          const isSelected = formData.spaceIds.includes(space.id);
                          const hasConflicts = space.totalConflicts > 0;
                          const hasClosed = space.closedDays?.length > 0;
                          const hasWarnings = hasConflicts || hasClosed;
                          return (
                            <label
                              key={space.id}
                              className={cn(
                                "flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors",
                                isSelected ? "border-primary bg-primary/5" : "hover:bg-muted/50",
                                (space.isFullyBooked || !space.isAvailable) &&
                                  !isSelected &&
                                  "opacity-60"
                              )}
                            >
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={(checked) => {
                                  if (checked && hasWarnings) {
                                    setFullyBookedOverride(space.id);
                                    return;
                                  }
                                  setFormData((prev) => {
                                    const newIds = checked
                                      ? [...prev.spaceIds, space.id]
                                      : prev.spaceIds.filter((id) => id !== space.id);
                                    const hasSpaces = newIds.length > 0;
                                    const selectedSpaces = spaces.filter((s) =>
                                      newIds.includes(s.id)
                                    );
                                    const capacities = selectedSpaces
                                      .map((s) => s.capacity)
                                      .filter((c): c is number => c != null);
                                    const derived =
                                      capacities.length > 0
                                        ? prev.spaceCapacityMode === "SUM"
                                          ? capacities.reduce((sum, c) => sum + c, 0)
                                          : Math.min(...capacities)
                                        : null;
                                    return {
                                      ...prev,
                                      spaceIds: newIds,
                                      hasCapacityRestriction: hasSpaces
                                        ? true
                                        : prev.hasCapacityRestriction,
                                      hasSpaceRestriction: hasSpaces ? true : false,
                                      capacity:
                                        hasSpaces && derived != null ? derived : prev.capacity,
                                    };
                                  });
                                }}
                                className="mt-0.5"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-sm font-medium">{space.name}</span>
                                  {space.isFullyBooked ? (
                                    <Badge variant="destructive" className="text-xs">
                                      <AlertTriangle className="h-3 w-3 mr-1" />
                                      Fully booked
                                    </Badge>
                                  ) : hasConflicts && space.totalConflicts <= 3 ? (
                                    <Badge
                                      variant="secondary"
                                      className="text-xs text-amber-600 border-amber-300 bg-amber-50"
                                    >
                                      <AlertTriangle className="h-3 w-3 mr-1" />
                                      Full on{" "}
                                      {space.conflictDates
                                        .map((c) => format(new Date(c.date + "T00:00:00"), "MMM d"))
                                        .join(", ")}
                                    </Badge>
                                  ) : hasConflicts ? (
                                    <Badge
                                      variant="secondary"
                                      className="text-xs text-amber-600 border-amber-300 bg-amber-50 cursor-pointer"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setConflictDetailsSpaceId(space.id);
                                      }}
                                    >
                                      <AlertTriangle className="h-3 w-3 mr-1" />
                                      {space.totalConflicts} date conflicts
                                    </Badge>
                                  ) : null}
                                  {hasClosed && (
                                    <Badge
                                      variant="secondary"
                                      className="text-xs text-orange-600 border-orange-300 bg-orange-50"
                                    >
                                      <Clock className="h-3 w-3 mr-1" />
                                      {space.closedDays.length === 1
                                        ? `Closed ${space.closedDays[0].day}`
                                        : space.closedDays.every((d) => d.reason === "closed")
                                          ? `Closed ${space.closedDays.map((d) => d.day).join(", ")}`
                                          : `${space.closedDays.length} day${space.closedDays.length !== 1 ? "s" : ""} outside hours`}
                                    </Badge>
                                  )}
                                </div>
                                {space.capacity != null && (
                                  <p className="text-xs text-muted-foreground mt-1">
                                    Capacity: {space.capacity}
                                    {hasConflicts && !space.isFullyBooked && (
                                      <>
                                        {" "}
                                        &middot;{" "}
                                        <span className="text-amber-600">
                                          {space.totalConflicts} date
                                          {space.totalConflicts !== 1 ? "s" : ""} at capacity
                                        </span>
                                      </>
                                    )}
                                  </p>
                                )}
                              </div>
                            </label>
                          );
                        })}
                      </div>

                      {/* Conflict details dialog */}
                      <Dialog
                        open={!!conflictDetailsSpaceId}
                        onOpenChange={(open) => !open && setConflictDetailsSpaceId(null)}
                      >
                        <DialogContent className="max-w-md">
                          <DialogHeader>
                            <DialogTitle>
                              Conflict Details &mdash;{" "}
                              {spaces.find((s) => s.id === conflictDetailsSpaceId)?.name}
                            </DialogTitle>
                          </DialogHeader>
                          {(() => {
                            const space = spaces.find((s) => s.id === conflictDetailsSpaceId);
                            if (!space) return null;
                            return (
                              <div className="space-y-2">
                                <p className="text-sm text-muted-foreground">
                                  This space (capacity {space.capacity}) is fully booked on the
                                  following {space.totalConflicts} date
                                  {space.totalConflicts !== 1 ? "s" : ""}:
                                </p>
                                <div className="max-h-64 overflow-y-auto rounded border divide-y">
                                  {space.conflictDates.map((c) => (
                                    <div
                                      key={c.date}
                                      className="flex items-center justify-between px-3 py-2 text-sm"
                                    >
                                      <span>
                                        {format(new Date(c.date + "T00:00:00"), "EEE, MMM d, yyyy")}
                                      </span>
                                      <span className="text-destructive font-medium">
                                        {c.used}/{space.capacity} used
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })()}
                        </DialogContent>
                      </Dialog>

                      {/* Conflict / closed-hours override dialog */}
                      <AlertDialog
                        open={!!fullyBookedOverride}
                        onOpenChange={(open) => !open && setFullyBookedOverride(null)}
                      >
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle className="flex items-center gap-2">
                              <AlertTriangle className="h-5 w-5 text-destructive" />
                              Space Warning
                            </AlertDialogTitle>
                            <AlertDialogDescription asChild>
                              <div className="space-y-3">
                                {(() => {
                                  const space = spaces.find((s) => s.id === fullyBookedOverride);
                                  if (!space) return <p>This space has issues.</p>;
                                  const sections: React.ReactNode[] = [];

                                  if (space.closedDays?.length > 0) {
                                    sections.push(
                                      <div key="closed">
                                        <p className="font-medium text-foreground">
                                          Outside operating hours
                                        </p>
                                        <ul className="mt-1 space-y-0.5 text-sm">
                                          {space.closedDays.map((d) => (
                                            <li key={d.day} className="text-orange-600">
                                              {d.day}:{" "}
                                              {d.reason === "closed"
                                                ? "Space is closed"
                                                : `Space is ${d.reason}`}
                                            </li>
                                          ))}
                                        </ul>
                                      </div>
                                    );
                                  }

                                  if (space.isFullyBooked) {
                                    sections.push(
                                      <div key="full">
                                        <p className="font-medium text-foreground">Fully booked</p>
                                        <p className="text-sm">
                                          This space is at capacity on all dates during the selected
                                          time slot.
                                        </p>
                                      </div>
                                    );
                                  } else if (space.totalConflicts > 0) {
                                    sections.push(
                                      <div key="conflicts">
                                        <p className="font-medium text-foreground">
                                          Capacity conflicts
                                        </p>
                                        {space.totalConflicts <= 5 ? (
                                          <ul className="mt-1 space-y-0.5 text-sm">
                                            {space.conflictDates.map((c) => (
                                              <li key={c.date} className="text-destructive">
                                                {format(
                                                  new Date(c.date + "T00:00:00"),
                                                  "EEE, MMM d, yyyy"
                                                )}{" "}
                                                ({c.used}/{space.capacity} used)
                                              </li>
                                            ))}
                                          </ul>
                                        ) : (
                                          <p className="text-sm text-muted-foreground">
                                            {space.totalConflicts} dates at capacity, from{" "}
                                            {format(
                                              new Date(space.conflictDates[0].date + "T00:00:00"),
                                              "MMM d"
                                            )}{" "}
                                            through{" "}
                                            {format(
                                              new Date(
                                                space.conflictDates[space.conflictDates.length - 1]
                                                  .date + "T00:00:00"
                                              ),
                                              "MMM d, yyyy"
                                            )}
                                            .
                                          </p>
                                        )}
                                      </div>
                                    );
                                  }

                                  return sections.length > 0 ? (
                                    sections
                                  ) : (
                                    <p>This space has issues.</p>
                                  );
                                })()}
                                <p>Are you sure you want to proceed?</p>
                              </div>
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => {
                                if (fullyBookedOverride) {
                                  setFormData((prev) => {
                                    const newIds = [...prev.spaceIds, fullyBookedOverride];
                                    const selectedSpaces = spaces.filter((s) =>
                                      newIds.includes(s.id)
                                    );
                                    const capacities = selectedSpaces
                                      .map((s) => s.capacity)
                                      .filter((c): c is number => c != null);
                                    const derived =
                                      capacities.length > 0
                                        ? prev.spaceCapacityMode === "SUM"
                                          ? capacities.reduce((sum, c) => sum + c, 0)
                                          : Math.min(...capacities)
                                        : null;
                                    return {
                                      ...prev,
                                      spaceIds: newIds,
                                      hasCapacityRestriction: true,
                                      hasSpaceRestriction: true,
                                      capacity: derived ?? prev.capacity,
                                    };
                                  });
                                }
                                setFullyBookedOverride(null);
                              }}
                            >
                              Proceed Anyway
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Step 3: Requirements */}
        {stepper.state.current.data.id === "requirements" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Requirements & Restrictions
              </CardTitle>
              <CardDescription>
                Configure who can register for this program. Toggle on the restrictions you want to
                apply.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Level Restriction - only shown when Training feature is enabled */}
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

              {/* Capacity Restriction */}
              <div className="rounded-lg border p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base font-medium">Capacity Limit</Label>
                    <p className="text-sm text-muted-foreground">
                      Limit the number of athletes who can enroll
                    </p>
                  </div>
                  <Switch
                    checked={formData.hasCapacityRestriction}
                    onCheckedChange={(checked) =>
                      setFormData((prev) => ({
                        ...prev,
                        hasCapacityRestriction: checked,
                        capacity: checked ? prev.capacity || spaceDerivedCapacity || 20 : null,
                      }))
                    }
                  />
                </div>

                {formData.hasCapacityRestriction && (
                  <div className="pt-2 border-t space-y-4">
                    {/* Space capacity restriction */}
                    {formData.spaceIds.length > 0 && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <Label className="text-sm font-medium">
                              Restrict by Space Capacity
                            </Label>
                            <p className="text-xs text-muted-foreground">
                              Derive capacity from the selected spaces
                            </p>
                          </div>
                          <Switch
                            checked={formData.hasSpaceRestriction}
                            onCheckedChange={(checked) => {
                              setFormData((prev) => ({
                                ...prev,
                                hasSpaceRestriction: checked,
                                capacity:
                                  checked && spaceDerivedCapacity
                                    ? spaceDerivedCapacity
                                    : prev.capacity,
                              }));
                            }}
                          />
                        </div>

                        {formData.hasSpaceRestriction && formData.spaceIds.length > 1 && (
                          <div className="pl-4 border-l-2 space-y-2">
                            <Label className="text-sm">Multi-space capacity mode</Label>
                            <RadioGroup
                              value={formData.spaceCapacityMode}
                              onValueChange={(value: "MINIMUM" | "SUM") => {
                                setFormData((prev) => {
                                  const selectedSpaces = spaces.filter((s) =>
                                    prev.spaceIds.includes(s.id)
                                  );
                                  const capacities = selectedSpaces
                                    .map((s) => s.capacity)
                                    .filter((c): c is number => c != null);
                                  const derived =
                                    value === "SUM"
                                      ? capacities.reduce((s, c) => s + c, 0)
                                      : capacities.length > 0
                                        ? Math.min(...capacities)
                                        : null;
                                  return {
                                    ...prev,
                                    spaceCapacityMode: value,
                                    capacity: derived ?? prev.capacity,
                                  };
                                });
                              }}
                              className="space-y-2"
                            >
                              <label className="flex items-center gap-2 cursor-pointer">
                                <RadioGroupItem value="MINIMUM" />
                                <span className="text-sm">Use smallest space capacity</span>
                              </label>
                              <label className="flex items-center gap-2 cursor-pointer">
                                <RadioGroupItem value="SUM" />
                                <span className="text-sm">Use combined space capacity</span>
                              </label>
                            </RadioGroup>
                            {spaceDerivedCapacity != null && (
                              <p className="text-xs text-muted-foreground">
                                Derived capacity: {spaceDerivedCapacity} athletes
                              </p>
                            )}
                          </div>
                        )}

                        {formData.hasSpaceRestriction &&
                          spaceDerivedCapacity != null &&
                          formData.spaceIds.length === 1 && (
                            <p className="text-xs text-muted-foreground pl-4 border-l-2">
                              Space capacity: {spaceDerivedCapacity} athletes
                            </p>
                          )}
                      </div>
                    )}

                    <div>
                      <Label htmlFor="capacity">Maximum Capacity</Label>
                      <Input
                        id="capacity"
                        type="number"
                        min={1}
                        max={
                          formData.hasSpaceRestriction && spaceDerivedCapacity
                            ? spaceDerivedCapacity
                            : undefined
                        }
                        placeholder="Max athletes"
                        value={formData.capacity || ""}
                        onChange={(e) => {
                          const val = e.target.value ? parseInt(e.target.value) : null;
                          const capped =
                            formData.hasSpaceRestriction && spaceDerivedCapacity && val
                              ? Math.min(val, spaceDerivedCapacity)
                              : val;
                          setFormData((prev) => ({ ...prev, capacity: capped }));
                        }}
                        className="mt-2 max-w-[200px]"
                      />
                      {formData.hasSpaceRestriction && spaceDerivedCapacity != null && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Cannot exceed space capacity of {spaceDerivedCapacity}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Age Restriction */}
              <div className="rounded-lg border p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base font-medium">Age Restriction</Label>
                    <p className="text-sm text-muted-foreground">
                      Restrict registration by athlete age
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
                    <p className="text-sm text-muted-foreground">Restrict registration by gender</p>
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
                      ) : allMembershipInstances.length === 0 ? (
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
                        <div className="space-y-2">
                          {allMembershipInstances.map((instance: MembershipInstance) => (
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
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <CreditCard className="h-4 w-4 text-muted-foreground" />
                                  <span className="text-sm font-medium">
                                    {instance.groupName} - {instance.name}
                                  </span>
                                </div>
                                <span className="text-xs text-muted-foreground">
                                  ${instance.price.toFixed(2)}
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

              {/* Pass Requirement */}
              {isFeatureEnabled("passes") && (
                <div className="rounded-lg border p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-base font-medium">Pass Requirement</Label>
                      <p className="text-sm text-muted-foreground">
                        Require athletes to have an active pass to register
                      </p>
                    </div>
                    <Switch
                      checked={formData.hasPassRestriction}
                      onCheckedChange={(checked) =>
                        setFormData((prev) => ({
                          ...prev,
                          hasPassRestriction: checked,
                          passRequirementIds: checked ? prev.passRequirementIds : [],
                        }))
                      }
                    />
                  </div>

                  {formData.hasPassRestriction && (
                    <div className="pt-2 border-t">
                      {loadingPasses ? (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Loading passes...
                        </div>
                      ) : availablePasses.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          No passes configured.{" "}
                          <a
                            href="/dashboard/registrations/passes"
                            className="text-primary underline"
                          >
                            Create passes
                          </a>{" "}
                          first.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {availablePasses.map((pass) => (
                            <label
                              key={pass.id}
                              className={cn(
                                "flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors",
                                formData.passRequirementIds.includes(pass.id)
                                  ? "border-primary bg-primary/5"
                                  : "hover:bg-muted/50"
                              )}
                            >
                              <Checkbox
                                checked={formData.passRequirementIds.includes(pass.id)}
                                onCheckedChange={(checked) => {
                                  setFormData((prev) => ({
                                    ...prev,
                                    passRequirementIds: checked
                                      ? [...prev.passRequirementIds, pass.id]
                                      : prev.passRequirementIds.filter((id) => id !== pass.id),
                                  }));
                                }}
                              />
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <Ticket className="h-4 w-4 text-muted-foreground" />
                                  <span className="text-sm font-medium">{pass.name}</span>
                                </div>
                                <span className="text-xs text-muted-foreground">
                                  ${Number(pass.price).toFixed(2)} /{" "}
                                  {pass.billingInterval.toLowerCase().replace("_", "-")} ·{" "}
                                  {pass.sessionLimit} sessions /{" "}
                                  {pass.limitPeriod === "WEEKLY" ? "week" : "month"}
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
                      Require customers to sign a waiver before checkout
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
                          href="/dashboard/athletes/waivers/new"
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

              {/* Medical Information Requirement */}
              <div className="rounded-lg border p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base font-medium">Medical Information Requirement</Label>
                    <p className="text-sm text-muted-foreground">
                      Require athletes to provide medical information during checkout
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

        {/* Waitlist Step */}
        {stepper.state.current.data.id === "waitlist" && waitlistsEnabled && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Waitlist Settings
              </CardTitle>
              <CardDescription>
                Configure how waitlists work when this program reaches capacity
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label htmlFor="waitlist-enabled" className="text-base">
                    Enable Waitlist
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Allow athletes to join a waitlist when the program is full
                  </p>
                </div>
                <Switch
                  id="waitlist-enabled"
                  checked={formData.waitlistEnabled}
                  onCheckedChange={(checked) =>
                    setFormData((prev) => ({ ...prev, waitlistEnabled: checked }))
                  }
                />
              </div>

              {formData.waitlistEnabled && (
                <>
                  <div className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <Label htmlFor="waitlist-auto-promote" className="text-base">
                        Automatic Promotion
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Automatically promote the next person on the waitlist when a spot opens, in
                        registration order
                      </p>
                    </div>
                    <Switch
                      id="waitlist-auto-promote"
                      checked={formData.waitlistAutoPromote}
                      onCheckedChange={(checked) =>
                        setFormData((prev) => ({ ...prev, waitlistAutoPromote: checked }))
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="waitlist-capacity">Maximum Waitlist Size</Label>
                    <p className="text-sm text-muted-foreground">
                      Limit how many people can join the waitlist. Leave empty for unlimited.
                    </p>
                    <Input
                      id="waitlist-capacity"
                      type="number"
                      min={1}
                      placeholder="Unlimited"
                      value={formData.waitlistCapacity ?? ""}
                      onChange={(e) => {
                        const val = e.target.value ? parseInt(e.target.value, 10) : null;
                        setFormData((prev) => ({ ...prev, waitlistCapacity: val }));
                      }}
                      className="max-w-[200px]"
                    />
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* Step 4: Evaluation */}
        {stepper.state.current.data.id === "evaluation" && trainingEnabled && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5" />
                Evaluation Template
              </CardTitle>
              <CardDescription>
                Select an evaluation template to assess athletes in this program
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Evaluation Template</Label>
                <p className="text-sm text-muted-foreground">
                  Choose how athletes in this program will be evaluated during sessions
                </p>
                {loadingEvalTemplates ? (
                  <div className="flex items-center gap-2 py-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm text-muted-foreground">Loading templates...</span>
                  </div>
                ) : (
                  <Select
                    value={formData.evaluationTemplateId || "none"}
                    onValueChange={(value) =>
                      setFormData((prev) => ({
                        ...prev,
                        evaluationTemplateId: value === "none" ? null : value,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="No evaluation template" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No evaluation template</SelectItem>
                      {evaluationTemplates.map((template) => (
                        <SelectItem key={template.id} value={template.id}>
                          <div className="flex items-center gap-2">
                            <span>{template.name}</span>
                            {template.level && (
                              <Badge
                                className="text-xs"
                                style={
                                  template.level.color
                                    ? {
                                        backgroundColor: `${template.level.color}20`,
                                        color: template.level.color,
                                      }
                                    : undefined
                                }
                                variant={template.level.color ? "outline" : "secondary"}
                              >
                                {template.level.name}
                              </Badge>
                            )}
                            <span className="text-xs text-muted-foreground">
                              ({template.skills.length} skills)
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Template Preview */}
              {formData.evaluationTemplateId &&
                (() => {
                  const selected = evaluationTemplates.find(
                    (t) => t.id === formData.evaluationTemplateId
                  );
                  if (!selected) return null;
                  return (
                    <div className="rounded-lg border p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium">{selected.name}</h4>
                        <Badge variant="outline">
                          {selected.scoringType === "POINT_SCALE"
                            ? `Point Scale (${selected.pointScaleMin}-${selected.pointScaleMax}, pass at ${selected.pointScalePassThreshold}+)`
                            : "Pass / Fail"}
                        </Badge>
                      </div>
                      {selected.description && (
                        <p className="text-sm text-muted-foreground">{selected.description}</p>
                      )}
                      <div className="space-y-1">
                        <Label className="text-sm">Skills ({selected.skills.length})</Label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 max-h-48 overflow-y-auto">
                          {selected.skills
                            .sort((a, b) => a.order - b.order)
                            .map((ts) => (
                              <div
                                key={ts.id}
                                className="flex items-center gap-2 text-sm py-1 px-2 rounded-md bg-muted/50"
                              >
                                <Star className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                                <span>{ts.skill.name}</span>
                                <span className="text-xs text-muted-foreground ml-auto">
                                  {ts.skill.category}
                                </span>
                              </div>
                            ))}
                        </div>
                      </div>
                    </div>
                  );
                })()}

              {evaluationTemplates.length === 0 && !loadingEvalTemplates && (
                <div className="rounded-lg border border-dashed p-6 text-center">
                  <ClipboardList className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">
                    No evaluation templates have been created yet.
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Create templates in Training &gt; Evaluations to get started.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Step 5: Staff */}
        {stepper.state.current.data.id === "staff" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Staff Assignments
              </CardTitle>
              <CardDescription>Assign coaches and staff to this program</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Add Staff */}
              <div className="space-y-2">
                <Label>Add Staff Member</Label>
                <div className="flex gap-2">
                  <Select
                    value=""
                    onValueChange={handleAddStaff}
                    disabled={loadingStaff || unassignedStaff.length === 0}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue
                        placeholder={
                          loadingStaff
                            ? "Loading..."
                            : unassignedStaff.length === 0
                              ? "All staff assigned"
                              : "Select staff member to add"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {unassignedStaff.map((s) => {
                        const certResult = getMemberStatus(s.id);
                        return (
                          <SelectItem key={s.id} value={s.id} disabled={!certResult.valid}>
                            <div className="flex items-center gap-2">
                              <Avatar className="h-6 w-6">
                                <AvatarImage src={s.user?.avatar || ""} />
                                <AvatarFallback>
                                  <User className="h-3 w-3" />
                                </AvatarFallback>
                              </Avatar>
                              <span>{s.user?.name || "Unknown"}</span>
                              {s.title && (
                                <span className="text-muted-foreground">({s.title})</span>
                              )}
                              {!certResult.valid && (
                                <span className="text-destructive text-xs ml-1 shrink-0">
                                  Missing:{" "}
                                  {certResult.missing.map((m) => m.certificationName).join(", ")}
                                </span>
                              )}
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {hasCertRequirements && (
                <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30 p-3">
                  <ShieldAlert className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                  <div className="text-sm text-amber-800 dark:text-amber-300">
                    <span className="font-medium">Required certifications: </span>
                    {requiredCertNames.join(", ")}
                    <span className="block text-xs mt-0.5 text-amber-600 dark:text-amber-400">
                      Staff missing these certifications cannot be assigned.
                    </span>
                  </div>
                </div>
              )}

              {/* Assigned Staff List */}
              <div className="space-y-3">
                <Label>Assigned Staff ({formData.staffAssignments.length})</Label>

                {formData.staffAssignments.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-8 text-center">
                    <Users className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
                    <p className="text-sm text-muted-foreground">
                      No staff assigned yet. Add staff members above.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {formData.staffAssignments.map((assignment) => (
                      <div
                        key={assignment.memberId}
                        className="flex items-center gap-3 rounded-lg border p-3 bg-card"
                      >
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={assignment.member?.user?.avatar || ""} />
                          <AvatarFallback>
                            <User className="h-4 w-4" />
                          </AvatarFallback>
                        </Avatar>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium truncate">
                              {assignment.member?.user?.name || "Unknown"}
                            </span>
                            {assignment.isPrimary && (
                              <Badge variant="secondary" className="text-xs shrink-0">
                                <Star className="h-3 w-3 mr-1" />
                                Primary
                              </Badge>
                            )}
                          </div>
                          {assignment.member?.title && (
                            <p className="text-xs text-muted-foreground truncate">
                              {assignment.member.title}
                            </p>
                          )}
                        </div>

                        <Select
                          value={assignment.role}
                          onValueChange={(value: ProgramStaffRole) =>
                            handleUpdateStaffRole(assignment.memberId, value)
                          }
                        >
                          <SelectTrigger className="w-[150px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="LEAD_COACH">Lead Coach</SelectItem>
                            <SelectItem value="ASSISTANT_COACH">Assistant Coach</SelectItem>
                            <SelectItem value="SUBSTITUTE">Substitute</SelectItem>
                            <SelectItem value="VOLUNTEER">Volunteer</SelectItem>
                          </SelectContent>
                        </Select>

                        <div className="flex items-center gap-1">
                          {!assignment.isPrimary && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleSetPrimary(assignment.memberId)}
                              title="Set as primary"
                            >
                              <Star className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveStaff(assignment.memberId)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Display Settings */}
              <div className="rounded-lg border p-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base font-medium">Show Coach on Marketing Site</Label>
                    <p className="text-sm text-muted-foreground">
                      Display the primary coach on the public program listing
                    </p>
                  </div>
                  <Switch
                    checked={formData.showCoachOnSite}
                    onCheckedChange={(checked) =>
                      setFormData((prev) => ({
                        ...prev,
                        showCoachOnSite: checked,
                      }))
                    }
                  />
                </div>
              </div>
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
                Configure when registration opens and closes for this program
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
                      earlyAccessCode: isNow ? null : prev.earlyAccessCode,
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
                    the program{formData.startDate ? ` (${format(formData.startDate, "PPP")})` : ""}
                    .
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
                  Set when registration closes. Defaults to the program end date if not specified.
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
                              ? `Program end: ${format(formData.endDate, "PPP")}`
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

              {/* Early Access Code — only relevant when registration is scheduled */}
              {!formData.registrationOpen && (
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
                        setFormData((prev) => ({
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
                        setFormData((prev) => ({ ...prev, earlyAccessCode: code }));
                      }}
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Generate
                    </Button>
                  </div>

                  {formData.earlyAccessCode && isEditing && program && (
                    <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
                      <Label className="text-sm font-medium flex items-center gap-2">
                        <Link2 className="h-4 w-4" />
                        Early Access Link
                      </Label>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 text-sm bg-background px-3 py-2 rounded border break-all">
                          {typeof window !== "undefined" ? `${window.location.origin}` : ""}
                          /programs/{program.id}?code={formData.earlyAccessCode}
                        </code>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const url = `${window.location.origin}/programs/${program.id}?code=${formData.earlyAccessCode}`;
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
              )}
            </CardContent>
          </Card>
        )}

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between mt-6">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/dashboard/registrations/programs")}
          >
            Cancel
          </Button>

          <div className="flex items-center gap-2">
            {!isFirstVisible && (
              <Button type="button" variant="outline" onClick={handlePrev}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Previous
              </Button>
            )}

            {!isLastVisible ? (
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
                    {isEditing ? "Save Program" : "Create Program"}
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
