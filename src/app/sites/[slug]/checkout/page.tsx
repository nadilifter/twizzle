"use client";

import { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { sanitizeHtml } from "@/lib/sanitize";
import { useCart, CartItem } from "@/components/sites/cart-context";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { isValidPhoneNumber } from "react-phone-number-input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Loader2,
  Trash2,
  FileText,
  Check,
  ChevronRight,
  ChevronLeft,
  User,
  Heart,
  AlertCircle,
  Plus,
  Pencil,
  CreditCard,
  Clock,
  AlertTriangle,
} from "lucide-react";
import Link from "next/link";
import type { SignaturePadRef } from "@/components/ui/signature-pad";
import { toast } from "sonner";
import { useRouter, useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useQueueGate, useCompleteRegistration } from "@/hooks/use-queue-gate";
import { ReservationTimer } from "@/components/sites/reservation-timer";
import { RemoveItemDialog } from "@/components/sites/remove-item-dialog";
import { COUNTRIES, getRegionsForCountry } from "@/lib/location-data";
import { StateProvinceCombobox } from "@/components/ui/state-province-combobox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { MedicalFormConfig, CustomMedicalQuestion } from "@/types/medical";
import type { CustomInfoQuestion, CustomInfoResponse } from "@/types/custom-information";

const CustomInformationForm = dynamic(
  () => import("@/components/sites/custom-information-form").then((m) => m.CustomInformationForm),
  { ssr: false, loading: () => <div className="h-48 animate-pulse bg-muted rounded-lg" /> }
);

const SignaturePad = dynamic(
  () => import("@/components/ui/signature-pad").then((m) => m.SignaturePad),
  { ssr: false, loading: () => <div className="h-48 animate-pulse bg-muted rounded-lg" /> }
);

const CheckoutMedicalForm = dynamic(
  () => import("@/components/sites/checkout-medical-form").then((m) => m.CheckoutMedicalForm),
  { ssr: false, loading: () => <div className="h-48 animate-pulse bg-muted rounded-lg" /> }
);

const AdyenCheckoutComponent = dynamic(
  () => import("@/components/sites/adyen-checkout").then((m) => m.AdyenCheckoutComponent),
  { ssr: false, loading: () => <div className="h-48 animate-pulse bg-muted rounded-lg" /> }
);

interface SavedContact {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  relationship: string | null;
  isPrimary: boolean;
}

interface SavedBillingAddress {
  id: string;
  label: string | null;
  street: string;
  city: string;
  stateProvince: string | null;
  postalCode: string;
  country: string;
  isPrimary: boolean;
}

type CheckoutStep = "details" | "waivers" | "customInfo" | "medical" | "payment" | "confirmation";

interface WaiverToSign {
  waiverId: string;
  waiverTitle: string;
  isSigned: boolean;
}

interface WaiverPageData {
  id: string;
  pageNumber: number;
  title: string | null;
  content: string;
}

interface AthleteRequirements {
  athleteId: string;
  athleteName: string;
  requiredWaiverIds: string[];
  needsMedical: boolean;
}

export default function CheckoutPage({ params }: { params: { slug: string } }) {
  const {
    items,
    subtotal,
    removeItem,
    clearCart,
    getDependentItems,
    removeItemWithDependents,
    getItemsByAthlete,
  } = useCart();
  const router = useRouter();
  const { data: session } = useSession();
  const hasWaitlistItems = items.some((item) => item.details?.waitlist === true);
  const [checkoutStep, setCheckoutStep] = useState<CheckoutStep>("details");
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    stateProvince: "",
    postalCode: "",
    country: "US",
  });

  // Saved contacts & billing addresses
  const [savedContacts, setSavedContacts] = useState<SavedContact[]>([]);
  const [savedAddresses, setSavedAddresses] = useState<SavedBillingAddress[]>([]);
  const [selectedContactId, setSelectedContactId] = useState<string>("new");
  const [selectedAddressId, setSelectedAddressId] = useState<string>("new");
  const [isEditingContact, setIsEditingContact] = useState(false);
  const [isEditingAddress, setIsEditingAddress] = useState(false);
  const [isRedirectingToReceipt, setIsRedirectingToReceipt] = useState(false);
  const [freeCheckoutInvoiceId, setFreeCheckoutInvoiceId] = useState<string | null>(null);
  const formDataInitialized = useRef(false);

  // Persist formData to sessionStorage so it survives page navigations
  const FORM_STORAGE_KEY = `checkout-form-${params.slug}`;
  const CONTACT_STORAGE_KEY = `checkout-contact-${params.slug}`;
  const ADDRESS_STORAGE_KEY = `checkout-address-${params.slug}`;
  const EDITING_CONTACT_KEY = `checkout-editing-contact-${params.slug}`;
  const EDITING_ADDRESS_KEY = `checkout-editing-address-${params.slug}`;

  // Save form data to sessionStorage whenever it changes
  useEffect(() => {
    if (!formDataInitialized.current) return;
    try {
      sessionStorage.setItem(FORM_STORAGE_KEY, JSON.stringify(formData));
      sessionStorage.setItem(CONTACT_STORAGE_KEY, selectedContactId);
      sessionStorage.setItem(ADDRESS_STORAGE_KEY, selectedAddressId);
      sessionStorage.setItem(EDITING_CONTACT_KEY, isEditingContact ? "1" : "0");
      sessionStorage.setItem(EDITING_ADDRESS_KEY, isEditingAddress ? "1" : "0");
    } catch {
      // sessionStorage may not be available
    }
  }, [
    formData,
    selectedContactId,
    selectedAddressId,
    isEditingContact,
    isEditingAddress,
    FORM_STORAGE_KEY,
    CONTACT_STORAGE_KEY,
    ADDRESS_STORAGE_KEY,
    EDITING_CONTACT_KEY,
    EDITING_ADDRESS_KEY,
  ]);

  // Fetch saved contacts & addresses on mount when authenticated
  useEffect(() => {
    if (!session?.user?.email) return;
    const fetchSaved = async () => {
      try {
        const [contactsRes, addressesRes] = await Promise.all([
          fetch(`/api/user/contacts`),
          fetch(`/api/user/billing-addresses`),
        ]);

        // Try to restore from sessionStorage first
        let restoredForm: typeof formData | null = null;
        let restoredContactId: string | null = null;
        let restoredAddressId: string | null = null;
        let restoredEditingContact = false;
        let restoredEditingAddress = false;
        try {
          const stored = sessionStorage.getItem(FORM_STORAGE_KEY);
          if (stored) restoredForm = JSON.parse(stored);
          restoredContactId = sessionStorage.getItem(CONTACT_STORAGE_KEY);
          restoredAddressId = sessionStorage.getItem(ADDRESS_STORAGE_KEY);
          restoredEditingContact = sessionStorage.getItem(EDITING_CONTACT_KEY) === "1";
          restoredEditingAddress = sessionStorage.getItem(EDITING_ADDRESS_KEY) === "1";
        } catch {
          // ignore
        }

        if (contactsRes.ok) {
          const { contacts } = await contactsRes.json();
          setSavedContacts(contacts || []);

          if (restoredForm && restoredContactId) {
            // Restore previously entered data
            setSelectedContactId(restoredContactId);
            setIsEditingContact(restoredEditingContact);
            setFormData((prev) => ({
              ...prev,
              firstName: restoredForm!.firstName,
              lastName: restoredForm!.lastName,
              email: restoredForm!.email,
              phone: restoredForm!.phone,
            }));
          } else {
            // Auto-select primary contact if available
            const primary = (contacts || []).find((c: SavedContact) => c.isPrimary);
            if (primary) {
              setSelectedContactId(primary.id);
              setFormData((prev) => ({
                ...prev,
                firstName: primary.firstName,
                lastName: primary.lastName,
                email: primary.email,
                phone: primary.phone,
              }));
            }
          }
        }
        if (addressesRes.ok) {
          const { addresses } = await addressesRes.json();
          setSavedAddresses(addresses || []);

          if (restoredForm && restoredAddressId) {
            // Restore previously entered data
            setSelectedAddressId(restoredAddressId);
            setIsEditingAddress(restoredEditingAddress);
            setFormData((prev) => ({
              ...prev,
              address: restoredForm!.address,
              city: restoredForm!.city,
              stateProvince: restoredForm!.stateProvince,
              postalCode: restoredForm!.postalCode,
              country: restoredForm!.country || "US",
            }));
          } else {
            // Auto-select primary address if available
            const primary = (addresses || []).find((a: SavedBillingAddress) => a.isPrimary);
            if (primary) {
              setSelectedAddressId(primary.id);
              setFormData((prev) => ({
                ...prev,
                address: primary.street,
                city: primary.city,
                stateProvince: primary.stateProvince || "",
                postalCode: primary.postalCode,
                country: primary.country || "US",
              }));
            }
          }
        }
      } catch (err) {
        // Silently fail -- user can still fill in manually
        console.error("Failed to fetch saved data:", err);
      } finally {
        formDataInitialized.current = true;
      }
    };
    fetchSaved();
  }, [
    session,
    params.slug,
    FORM_STORAGE_KEY,
    CONTACT_STORAGE_KEY,
    ADDRESS_STORAGE_KEY,
    EDITING_CONTACT_KEY,
    EDITING_ADDRESS_KEY,
  ]);

  // Pre-fill contact info from session when available (only if no saved contacts loaded)
  useEffect(() => {
    if (session?.user && savedContacts.length === 0) {
      setFormData((prev) => {
        // Only pre-fill empty fields to avoid overwriting user edits
        const nameParts = (session.user?.name || "").split(" ");
        return {
          ...prev,
          firstName: prev.firstName || nameParts[0] || "",
          lastName: prev.lastName || nameParts.slice(1).join(" ") || "",
          email: prev.email || session.user?.email || "",
        };
      });
    }
  }, [session, savedContacts.length]);

  // Handle saved contact selection
  const handleContactSelect = (contactId: string) => {
    setSelectedContactId(contactId);
    setIsEditingContact(false);
    if (contactId === "new") {
      setFormData((prev) => ({ ...prev, firstName: "", lastName: "", email: "", phone: "" }));
    } else {
      const contact = savedContacts.find((c) => c.id === contactId);
      if (contact) {
        setFormData((prev) => ({
          ...prev,
          firstName: contact.firstName,
          lastName: contact.lastName,
          email: contact.email,
          phone: contact.phone,
        }));
      }
    }
  };

  // Handle saved address selection
  const handleAddressSelect = (addressId: string) => {
    setSelectedAddressId(addressId);
    setIsEditingAddress(false);
    if (addressId === "new") {
      setFormData((prev) => ({
        ...prev,
        address: "",
        city: "",
        stateProvince: "",
        postalCode: "",
        country: "US",
      }));
    } else {
      const addr = savedAddresses.find((a) => a.id === addressId);
      if (addr) {
        setFormData((prev) => ({
          ...prev,
          address: addr.street,
          city: addr.city,
          stateProvince: addr.stateProvince || "",
          postalCode: addr.postalCode,
          country: addr.country || "US",
        }));
      }
    }
  };
  const [discountCode, setDiscountCode] = useState("");
  const [appliedDiscount, setAppliedDiscount] = useState<{
    id: string;
    name: string;
    code: string;
    type: string;
    discountAmount: number;
    description: string;
  } | null>(null);
  const [isValidatingDiscount, setIsValidatingDiscount] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentSession, setPaymentSession] = useState<{ id: string; sessionData: string } | null>(
    null
  );
  const [checkoutInvoiceId, setCheckoutInvoiceId] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  // Waiver state
  const [requiredWaivers, setRequiredWaivers] = useState<WaiverToSign[]>([]);
  const [currentWaiverIndex, setCurrentWaiverIndex] = useState(0);
  const [currentWaiverPages, setCurrentWaiverPages] = useState<WaiverPageData[]>([]);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [isLoadingWaiver, setIsLoadingWaiver] = useState(false);
  const [isSigningWaiver, setIsSigningWaiver] = useState(false);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [taxRate, setTaxRate] = useState(0);
  const [taxPaidBy, setTaxPaidBy] = useState<"CUSTOMER" | "ORGANIZATION">("CUSTOMER");
  const [processingFeePaidBy, setProcessingFeePaidBy] = useState<"CUSTOMER" | "ORGANIZATION">(
    "CUSTOMER"
  );
  const [planTransactionFee, setPlanTransactionFee] = useState(0);
  const [planPerTransactionFee, setPlanPerTransactionFee] = useState(0);
  const [signAllMode, setSignAllMode] = useState(false);
  const signaturePadRef = useRef<SignaturePadRef>(null);
  const [signatureEmpty, setSignatureEmpty] = useState(true);

  // Medical state
  const [medicalConfig, setMedicalConfig] = useState<MedicalFormConfig | null>(null);
  const [medicalCustomQuestions, setMedicalCustomQuestions] = useState<CustomMedicalQuestion[]>([]);

  // Custom info state
  const [customInfoQuestions, setCustomInfoQuestions] = useState<CustomInfoQuestion[]>([]);
  const [customInfoResponses, setCustomInfoResponses] = useState<CustomInfoResponse[]>([]);
  const [athleteCustomInfoComplete, setAthleteCustomInfoComplete] = useState<Set<string>>(
    new Set()
  );

  // Per-athlete requirements flow
  const [athleteQueue, setAthleteQueue] = useState<AthleteRequirements[]>([]);
  const [currentAthleteIndex, setCurrentAthleteIndex] = useState(0);
  const [athleteWaiverComplete, setAthleteWaiverComplete] = useState<Set<string>>(new Set());
  const [athleteMedicalComplete, setAthleteMedicalComplete] = useState<Set<string>>(new Set());
  // Track signed waivers per athlete: Map<athleteId, Set<waiverId>>
  const signedWaiverIdsRef = useRef<Map<string, Set<string>>>(new Map());
  const athleteQueueRef = useRef<AthleteRequirements[]>([]);
  const organizationIdRef = useRef<string | null>(null);

  // State for remove confirmation dialog
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
  const [itemToRemove, setItemToRemove] = useState<CartItem | null>(null);
  const [dependentItems, setDependentItems] = useState<CartItem[]>([]);

  const handleRemoveClick = (item: CartItem) => {
    const dependents = getDependentItems(item.id);

    if (dependents.length > 0) {
      setItemToRemove(item);
      setDependentItems(dependents);
      setRemoveDialogOpen(true);
    } else {
      removeItem(item.id);
    }
  };

  const handleConfirmRemove = () => {
    if (itemToRemove) {
      removeItemWithDependents(itemToRemove.id);
    }
    setRemoveDialogOpen(false);
    setItemToRemove(null);
    setDependentItems([]);
  };

  const handleCancelRemove = () => {
    setRemoveDialogOpen(false);
    setItemToRemove(null);
    setDependentItems([]);
  };

  // Queue gate
  const { isChecking, isAllowed, hasReservation, reservation } = useQueueGate(params.slug);
  const { complete: completeRegistration } = useCompleteRegistration(params.slug);

  useEffect(() => {
    fetch(`/api/public/site-config?slug=${params.slug}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          if (data.organizationId) {
            setOrganizationId(data.organizationId);
            organizationIdRef.current = data.organizationId;
          }
          if (data.taxRate != null) {
            setTaxRate(Number(data.taxRate));
          }
          if (data.taxPaidBy) setTaxPaidBy(data.taxPaidBy);
          if (data.processingFeePaidBy) setProcessingFeePaidBy(data.processingFeePaidBy);
          if (data.transactionFee != null) setPlanTransactionFee(Number(data.transactionFee));
          if (data.perTransactionFee != null)
            setPlanPerTransactionFee(Number(data.perTransactionFee));
        }
      })
      .catch((err) => console.error("Failed to load organization settings:", err));
  }, [params.slug]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Process per-athlete requirements starting from the given index
  // Iterates through the queue, showing waivers/medical as needed per athlete
  const advanceToNextRequirement = async (startIndex: number) => {
    const queue = athleteQueueRef.current;
    const orgId = organizationIdRef.current;

    for (let i = startIndex; i < queue.length; i++) {
      const athlete = queue[i];
      setCurrentAthleteIndex(i);

      // Check unsigned waivers for this specific athlete
      const athleteSigned = signedWaiverIdsRef.current.get(athlete.athleteId) || new Set();
      const unsignedIds = athlete.requiredWaiverIds.filter((id) => !athleteSigned.has(id));

      if (unsignedIds.length > 0 && orgId) {
        // Verify with server which are actually unsigned
        const checkResponse = await fetch("/api/public/waivers/check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: formData.email,
            waiverIds: unsignedIds,
            organizationId: orgId,
            athleteId: athlete.athleteId,
          }),
        });

        if (!checkResponse.ok) {
          throw new Error("Failed to check waiver status");
        }

        const checkData = await checkResponse.json();

        // Update local signed set with server data (per athlete)
        if (!signedWaiverIdsRef.current.has(athlete.athleteId)) {
          signedWaiverIdsRef.current.set(athlete.athleteId, new Set());
        }
        const athleteSignedSet = signedWaiverIdsRef.current.get(athlete.athleteId)!;
        checkData.data.forEach((w: WaiverToSign) => {
          if (w.isSigned) athleteSignedSet.add(w.waiverId);
        });

        const stillUnsigned = checkData.data.filter((w: WaiverToSign) => !w.isSigned);

        if (stillUnsigned.length > 0) {
          // Show waiver signing step for this athlete
          setRequiredWaivers(stillUnsigned);
          setCurrentWaiverIndex(0);
          setCheckoutStep("waivers");
          setSignAllMode(false);
          signaturePadRef.current?.clear();
          setSignatureEmpty(true);
          await loadWaiverContent(stillUnsigned[0].waiverId, orgId);
          return; // Exit — waiver step shown, flow continues after signing
        }
      }

      // All waivers for this athlete are done
      setAthleteWaiverComplete((prev) => {
        const next = new Set(prev);
        next.add(athlete.athleteId);
        return next;
      });

      // Check custom info
      if (orgId && !athleteCustomInfoComplete.has(athlete.athleteId)) {
        try {
          const itemsByAthlete = getItemsByAthlete();
          const athleteEntry = itemsByAthlete.get(athlete.athleteId);
          const athleteItems = athleteEntry?.items || [];
          const programIds = athleteItems
            .filter((it: CartItem) => it.type === "program")
            .map((it: CartItem) => it.details?.programId)
            .filter(Boolean);
          const competitionIds = athleteItems
            .filter((it: CartItem) => it.type === "competition")
            .map((it: CartItem) => it.details?.competitionId)
            .filter(Boolean);
          const membershipIds = athleteItems
            .filter((it: CartItem) => it.type === "membership")
            .map((it: CartItem) => it.details?.membershipInstanceId)
            .filter(Boolean);
          const passIds = athleteItems
            .filter((it: CartItem) => it.type === "pass")
            .map((it: CartItem) => it.details?.passId)
            .filter(Boolean);

          const ciParams = new URLSearchParams({ organizationId: orgId });
          if (programIds.length > 0) ciParams.set("programIds", programIds.join(","));
          if (competitionIds.length > 0) ciParams.set("competitionIds", competitionIds.join(","));
          if (membershipIds.length > 0) ciParams.set("membershipIds", membershipIds.join(","));
          if (passIds.length > 0) ciParams.set("passIds", passIds.join(","));

          const ciRes = await fetch(`/api/public/custom-information?${ciParams}`);
          if (ciRes.ok) {
            const { questions } = await ciRes.json();
            if (questions && questions.length > 0) {
              const respRes = await fetch(
                `/api/public/athletes/${athlete.athleteId}/custom-information?organizationId=${orgId}&email=${encodeURIComponent(formData.email)}`
              );
              let existingResponses: CustomInfoResponse[] = [];
              let isCurrent = false;
              if (respRes.ok) {
                const rd = await respRes.json();
                existingResponses = rd.responses || [];
                isCurrent = rd.isCurrent && existingResponses.length >= questions.length;
              }

              if (!isCurrent) {
                setCustomInfoQuestions(questions);
                setCustomInfoResponses(existingResponses);
                setCheckoutStep("customInfo");
                return; // Exit — custom info step shown
              }
            }
          }
        } catch (err) {
          console.error("Failed to check custom info:", err);
        }
        setAthleteCustomInfoComplete((prev) => {
          const next = new Set(prev);
          next.add(athlete.athleteId);
          return next;
        });
      }

      // Check medical
      if (athlete.needsMedical) {
        setCheckoutStep("medical");
        return; // Exit — medical step shown, flow continues after completion
      }

      // No medical needed — mark complete and continue to next athlete
      setAthleteMedicalComplete((prev) => {
        const next = new Set(prev);
        next.add(athlete.athleteId);
        return next;
      });
    }

    // All athletes processed — proceed to payment
    await createPaymentSession();
  };

  // Check for per-athlete requirements (waivers + medical) and proceed accordingly
  const handleProceedToPayment = async () => {
    if (!formData.firstName || !formData.lastName || !formData.email) {
      toast.error("Please fill in all required fields");
      return;
    }
    if (formData.phone && !isValidPhoneNumber(formData.phone)) {
      toast.error("Please enter a valid phone number");
      return;
    }

    setIsProcessing(true);

    try {
      let orgId = organizationId;
      if (!orgId) {
        const siteResponse = await fetch(`/api/public/site-config?slug=${params.slug}`);
        if (siteResponse.ok) {
          const siteData = await siteResponse.json();
          orgId = siteData.organizationId;
          setOrganizationId(orgId);
          organizationIdRef.current = orgId;
        }
      }

      if (!orgId) {
        toast.error("Unable to determine organization. Please try again.");
        return;
      }

      // Collect program items from cart
      const programItems = items.filter((item) => item.type === "program");
      const programIds = programItems
        .map((item) => item.details?.programId || item.referenceId)
        .filter(Boolean);

      if (programIds.length === 0) {
        // No programs — go straight to payment
        await createPaymentSession();
        return;
      }

      // Fetch waiver and medical requirements in parallel
      const [waiverResponse, medicalResponse] = await Promise.all([
        fetch(
          `/api/public/programs/waiver-requirements?programIds=${programIds.join(",")}&organizationId=${orgId}`
        ),
        fetch(
          `/api/public/programs/medical-requirements?programIds=${programIds.join(",")}&organizationId=${orgId}`
        ),
      ]);

      let programWaiverMap: Record<string, string[]> = {};
      if (waiverResponse.ok) {
        const waiverData = await waiverResponse.json();
        programWaiverMap = waiverData.programWaiverMap || {};
      }

      let programIdsRequiringMedical: string[] = [];
      if (medicalResponse.ok) {
        const medData = await medicalResponse.json();
        if (medData.required && medData.config) {
          programIdsRequiringMedical = medData.programIdsRequiringMedical || [];
          setMedicalConfig(medData.config);
          setMedicalCustomQuestions(medData.customQuestions || []);
        }
      }

      // Build per-athlete requirements queue
      const athleteMap = new Map<string, { athleteName: string; programIds: string[] }>();
      programItems.forEach((item) => {
        const programId = item.details?.programId || item.referenceId;
        if (!programId || !item.athleteId) return;
        const existing = athleteMap.get(item.athleteId) || {
          athleteName: item.athleteName,
          programIds: [],
        };
        if (!existing.programIds.includes(programId)) {
          existing.programIds.push(programId);
        }
        athleteMap.set(item.athleteId, existing);
      });

      const queue: AthleteRequirements[] = Array.from(athleteMap.entries()).map(
        ([athleteId, { athleteName, programIds: athleteProgramIds }]) => {
          const waiverIdSet = new Set<string>();
          athleteProgramIds.forEach((pid) => {
            const waiverIds = programWaiverMap[pid] || [];
            waiverIds.forEach((wid) => waiverIdSet.add(wid));
          });

          const needsMedical = athleteProgramIds.some((pid) =>
            programIdsRequiringMedical.includes(pid)
          );

          return {
            athleteId,
            athleteName,
            requiredWaiverIds: Array.from(waiverIdSet),
            needsMedical,
          };
        }
      );

      // For athletes flagged as needing medical, check if their info is still current
      const athletesNeedingMedical = queue.filter((a) => a.needsMedical);
      if (athletesNeedingMedical.length > 0) {
        const medicalChecks = await Promise.all(
          athletesNeedingMedical.map(async (athlete) => {
            try {
              const res = await fetch(
                `/api/public/athletes/${athlete.athleteId}/medical?organizationId=${orgId}&email=${encodeURIComponent(formData.email)}`
              );
              if (res.ok) {
                const data = await res.json();
                return { athleteId: athlete.athleteId, isCurrent: !!data.isCurrent };
              }
            } catch {}
            return { athleteId: athlete.athleteId, isCurrent: false };
          })
        );
        for (const check of medicalChecks) {
          if (check.isCurrent) {
            const entry = queue.find((a) => a.athleteId === check.athleteId);
            if (entry) entry.needsMedical = false;
          }
        }
      }

      // Store queue in both state and ref
      setAthleteQueue(queue);
      athleteQueueRef.current = queue;
      signedWaiverIdsRef.current = new Map();

      // If no requirements at all, go straight to payment
      if (
        queue.length === 0 ||
        queue.every((a) => a.requiredWaiverIds.length === 0 && !a.needsMedical)
      ) {
        await createPaymentSession();
        return;
      }

      // Start processing from the first athlete
      await advanceToNextRequirement(0);
    } catch (error) {
      console.error(error);
      toast.error("Failed to process. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const loadWaiverContent = async (waiverId: string, orgId: string) => {
    setIsLoadingWaiver(true);
    try {
      const response = await fetch(`/api/public/waivers/${waiverId}?organizationId=${orgId}`);
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
  };

  const handleSignCurrentPage = async () => {
    if (signaturePadRef.current?.isEmpty()) {
      toast.error("Please provide your signature");
      return;
    }

    const signatureData = signaturePadRef.current!.toDataURL();
    setIsSigningWaiver(true);

    try {
      const currentWaiver = requiredWaivers[currentWaiverIndex];

      // Determine which pages to sign
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

      const currentAthlete = athleteQueueRef.current[currentAthleteIndex];

      const response = await fetch(`/api/public/waivers/${currentWaiver.waiverId}/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: organizationIdRef.current,
          athleteId: currentAthlete?.athleteId || null,
          email: formData.email,
          name: `${formData.firstName} ${formData.lastName}`,
          signatures: pagesToSign,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to sign waiver");
      }

      const result = await response.json();

      if (result.allPagesSigned || signAllMode) {
        // This waiver is complete - move to next waiver or check medical/payment
        toast.success(`"${currentWaiver.waiverTitle}" signed successfully`);

        if (currentWaiverIndex < requiredWaivers.length - 1) {
          const nextIndex = currentWaiverIndex + 1;
          setCurrentWaiverIndex(nextIndex);
          setSignAllMode(false);
          signaturePadRef.current?.clear();
          setSignatureEmpty(true);
          await loadWaiverContent(requiredWaivers[nextIndex].waiverId, organizationIdRef.current!);
        } else {
          // All waivers for this athlete signed
          const currentAthlete = athleteQueueRef.current[currentAthleteIndex];
          if (currentAthlete) {
            // Track all of this athlete's required waivers as signed (per athlete)
            if (!signedWaiverIdsRef.current.has(currentAthlete.athleteId)) {
              signedWaiverIdsRef.current.set(currentAthlete.athleteId, new Set());
            }
            const signedSet = signedWaiverIdsRef.current.get(currentAthlete.athleteId)!;
            currentAthlete.requiredWaiverIds.forEach((id) => signedSet.add(id));
            setAthleteWaiverComplete((prev) => {
              const next = new Set(prev);
              next.add(currentAthlete.athleteId);
              return next;
            });

            // Re-enter flow to handle custom info -> medical -> next athlete
            await advanceToNextRequirement(currentAthleteIndex);
          }
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
  };

  const createPaymentSession = async () => {
    setIsProcessing(true);
    try {
      const response = await fetch(`/api/sites/${params.slug}/checkout/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items,
          userDetails: formData,
          contactId: selectedContactId !== "new" ? selectedContactId : undefined,
          billingAddressId: selectedAddressId !== "new" ? selectedAddressId : undefined,
          editingContact: isEditingContact && selectedContactId !== "new",
          editingAddress: isEditingAddress && selectedAddressId !== "new",
          discountCode,
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Failed to create payment session");
      }

      const data = await response.json();

      if (data.freeCheckout) {
        setFreeCheckoutInvoiceId(data.invoiceId);
        setCheckoutStep("confirmation");
        return;
      }

      setPaymentSession({ id: data.sessionId, sessionData: data.sessionData });
      setCheckoutInvoiceId(data.invoiceId);
      setPaymentError(null);
      setCheckoutStep("payment");
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Failed to initialize payment. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCompleteFreeCheckout = async () => {
    if (!freeCheckoutInvoiceId) return;
    setIsRedirectingToReceipt(true);
    try {
      sessionStorage.removeItem(FORM_STORAGE_KEY);
      sessionStorage.removeItem(CONTACT_STORAGE_KEY);
      sessionStorage.removeItem(ADDRESS_STORAGE_KEY);
      sessionStorage.removeItem(EDITING_CONTACT_KEY);
      sessionStorage.removeItem(EDITING_ADDRESS_KEY);
    } catch {
      // ignore
    }
    await completeRegistration();
    clearCart();
    router.push(`/receipt/${freeCheckoutInvoiceId}`);
  };

  const handlePaymentCompleted = async (result: any) => {
    if (
      result.resultCode === "Authorised" ||
      result.resultCode === "Pending" ||
      result.resultCode === "Received"
    ) {
      try {
        sessionStorage.removeItem(FORM_STORAGE_KEY);
        sessionStorage.removeItem(CONTACT_STORAGE_KEY);
        sessionStorage.removeItem(ADDRESS_STORAGE_KEY);
        sessionStorage.removeItem(EDITING_CONTACT_KEY);
        sessionStorage.removeItem(EDITING_ADDRESS_KEY);
      } catch {
        // ignore
      }
      clearCart();
      await completeRegistration();
      if (checkoutInvoiceId) {
        try {
          await fetch(`/api/sites/${params.slug}/checkout/finalize`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ invoiceId: checkoutInvoiceId }),
          });
        } catch {
          // Adyen webhook will handle it if reachable
        }
        router.push(`/receipt/${checkoutInvoiceId}`);
      }
    } else {
      setPaymentError(`Payment was not successful (${result.resultCode}). Please try again.`);
    }
  };

  const handlePaymentError = (error: any) => {
    console.error("Payment error:", error);
    const message = error?.message || error?.resultCode || "An error occurred during payment.";
    setPaymentError(message);
    toast.error("Payment failed. Please try again.");
  };

  const handleApplyDiscount = async () => {
    if (!discountCode.trim()) return;
    setIsValidatingDiscount(true);
    try {
      const res = await fetch(`/api/sites/${params.slug}/discount/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: discountCode.trim(), amount: subtotal }),
      });
      const data = await res.json();
      if (data.valid) {
        setAppliedDiscount({
          id: data.discount.id,
          name: data.discount.name,
          code: data.discount.code,
          type: data.discount.type,
          discountAmount: data.calculation?.discountAmount ?? 0,
          description: data.calculation?.discountDescription ?? "",
        });
        toast.success(`Discount applied: ${data.calculation?.discountDescription}`);
      } else {
        toast.error(data.error || "Invalid discount code");
        setAppliedDiscount(null);
      }
    } catch {
      toast.error("Failed to validate discount code");
    } finally {
      setIsValidatingDiscount(false);
    }
  };

  const handleRemoveDiscount = () => {
    setAppliedDiscount(null);
    setDiscountCode("");
  };

  const discountAmount = appliedDiscount?.discountAmount ?? 0;
  const taxableSubtotal = Math.max(subtotal - discountAmount, 0);
  const taxAmount = Math.round(taxableSubtotal * taxRate * 100) / 100;

  const feeBase = taxPaidBy === "CUSTOMER" ? taxableSubtotal + taxAmount : taxableSubtotal;
  const processingFeeRaw = feeBase > 0 ? feeBase * planTransactionFee + planPerTransactionFee : 0;
  const processingFee = Math.round(processingFeeRaw * 100) / 100;

  let total = taxableSubtotal;
  if (taxPaidBy === "CUSTOMER") total += taxAmount;
  if (processingFeePaidBy === "CUSTOMER") total += processingFee;
  total = Math.round(total * 100) / 100;

  // Show loading while checking queue status
  if (isChecking) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 md:px-8 py-12 text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
        <p className="text-muted-foreground">Checking availability...</p>
      </div>
    );
  }

  if (!isAllowed) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 md:px-8 py-12 text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
        <p className="text-muted-foreground">Redirecting to queue...</p>
      </div>
    );
  }

  if (items.length === 0 && !isRedirectingToReceipt) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 md:px-8 py-12 text-center">
        <h1 className="text-3xl font-bold mb-4">Checkout</h1>
        <p className="text-muted-foreground mb-8">Your cart is empty.</p>
        <Button asChild>
          <Link href="/register">Browse Programs</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 md:px-8 py-12">
      <h1 className="text-3xl font-bold mb-8">Checkout</h1>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Left Column - Forms */}
        <div className="lg:col-span-2 space-y-8">
          {/* User Details */}
          <Card>
            <CardHeader>
              <CardTitle>Contact Information</CardTitle>
              <CardDescription>
                We&apos;ll use this to create your account and send your receipt.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              {savedContacts.length > 0 && checkoutStep === "details" && (
                <div className="space-y-2 md:col-span-2">
                  <Label>Saved Contacts</Label>
                  <Select value={selectedContactId} onValueChange={handleContactSelect}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a contact" />
                    </SelectTrigger>
                    <SelectContent>
                      {savedContacts.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.firstName} {c.lastName} — {c.email}
                          {c.isPrimary ? " (Primary)" : ""}
                        </SelectItem>
                      ))}
                      <SelectItem value="new">
                        <span className="flex items-center gap-1">
                          <Plus className="h-3 w-3" /> Add new contact
                        </span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              {selectedContactId !== "new" && !isEditingContact && checkoutStep === "details" && (
                <div className="md:col-span-2 flex justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsEditingContact(true)}
                  >
                    <Pencil className="h-3.5 w-3.5 mr-1" />
                    Edit Contact
                  </Button>
                </div>
              )}
              {isEditingContact && selectedContactId !== "new" && checkoutStep === "details" && (
                <div className="md:col-span-2">
                  <p className="text-sm text-muted-foreground">
                    Editing saved contact. Changes will be saved when you continue.
                  </p>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  name="firstName"
                  autoComplete="given-name"
                  value={formData.firstName}
                  onChange={handleInputChange}
                  required
                  disabled={
                    checkoutStep !== "details" || (selectedContactId !== "new" && !isEditingContact)
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  name="lastName"
                  autoComplete="family-name"
                  value={formData.lastName}
                  onChange={handleInputChange}
                  required
                  disabled={
                    checkoutStep !== "details" || (selectedContactId !== "new" && !isEditingContact)
                  }
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  required
                  disabled={
                    checkoutStep !== "details" || (selectedContactId !== "new" && !isEditingContact)
                  }
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="phone">Phone Number</Label>
                <PhoneInput
                  id="phone"
                  defaultCountry="US"
                  value={formData.phone}
                  onChange={(value) => setFormData((prev) => ({ ...prev, phone: value || "" }))}
                  disabled={
                    checkoutStep !== "details" || (selectedContactId !== "new" && !isEditingContact)
                  }
                />
              </div>
            </CardContent>
          </Card>

          {/* Billing Address */}
          <Card>
            <CardHeader>
              <CardTitle>Billing Address</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              {savedAddresses.length > 0 && checkoutStep === "details" && (
                <div className="space-y-2 md:col-span-2">
                  <Label>Saved Addresses</Label>
                  <Select value={selectedAddressId} onValueChange={handleAddressSelect}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select an address" />
                    </SelectTrigger>
                    <SelectContent>
                      {savedAddresses.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.label ? `${a.label} — ` : ""}
                          {a.street}, {a.city}
                          {a.stateProvince
                            ? `, ${getRegionsForCountry(a.country).find((r) => r.code === a.stateProvince)?.name ?? a.stateProvince}`
                            : ""}{" "}
                          {a.postalCode}
                          {a.isPrimary ? " (Primary)" : ""}
                        </SelectItem>
                      ))}
                      <SelectItem value="new">
                        <span className="flex items-center gap-1">
                          <Plus className="h-3 w-3" /> Add new address
                        </span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              {selectedAddressId !== "new" && !isEditingAddress && checkoutStep === "details" && (
                <div className="md:col-span-2 flex justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsEditingAddress(true)}
                  >
                    <Pencil className="h-3.5 w-3.5 mr-1" />
                    Edit Address
                  </Button>
                </div>
              )}
              {isEditingAddress && selectedAddressId !== "new" && checkoutStep === "details" && (
                <div className="md:col-span-2">
                  <p className="text-sm text-muted-foreground">
                    Editing saved address. Changes will be saved when you continue.
                  </p>
                </div>
              )}
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="address">Street Address</Label>
                <Input
                  id="address"
                  name="address"
                  autoComplete="street-address"
                  value={formData.address}
                  onChange={handleInputChange}
                  disabled={
                    checkoutStep !== "details" || (selectedAddressId !== "new" && !isEditingAddress)
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  name="city"
                  autoComplete="address-level2"
                  value={formData.city}
                  onChange={handleInputChange}
                  disabled={
                    checkoutStep !== "details" || (selectedAddressId !== "new" && !isEditingAddress)
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="stateProvince">
                  {formData.country === "CA"
                    ? "Province"
                    : formData.country === "US"
                      ? "State"
                      : "State / Province"}
                </Label>
                <StateProvinceCombobox
                  country={formData.country}
                  value={formData.stateProvince}
                  onChange={(val) => setFormData((prev) => ({ ...prev, stateProvince: val }))}
                  disabled={
                    checkoutStep !== "details" || (selectedAddressId !== "new" && !isEditingAddress)
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="postalCode">
                  {formData.country === "CA"
                    ? "Postal Code"
                    : formData.country === "US"
                      ? "ZIP Code"
                      : "Postal Code"}
                </Label>
                <Input
                  id="postalCode"
                  name="postalCode"
                  autoComplete="postal-code"
                  value={formData.postalCode}
                  onChange={handleInputChange}
                  placeholder={
                    formData.country === "CA" ? "A1A 1A1" : formData.country === "US" ? "12345" : ""
                  }
                  disabled={
                    checkoutStep !== "details" || (selectedAddressId !== "new" && !isEditingAddress)
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="country">Country</Label>
                <Select
                  value={formData.country}
                  onValueChange={(value) =>
                    setFormData((prev) => ({
                      ...prev,
                      country: value,
                      stateProvince: prev.country !== value ? "" : prev.stateProvince,
                    }))
                  }
                  disabled={
                    checkoutStep !== "details" || (selectedAddressId !== "new" && !isEditingAddress)
                  }
                >
                  <SelectTrigger>
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
              </div>
            </CardContent>
            {checkoutStep === "details" && (
              <CardFooter>
                <Button onClick={handleProceedToPayment} disabled={isProcessing} className="w-full">
                  {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Continue
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </CardFooter>
            )}
          </Card>

          {/* Waiver Signing Step */}
          {checkoutStep === "waivers" && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Waiver Required
                  {athleteQueue.length > 0 && (
                    <span className="text-sm font-normal text-muted-foreground">
                      — for {athleteQueue[currentAthleteIndex]?.athleteName}
                    </span>
                  )}
                </CardTitle>
                <CardDescription>
                  Please review and sign the following waiver{requiredWaivers.length > 1 ? "s" : ""}{" "}
                  before proceeding.
                  {requiredWaivers.length > 1 && (
                    <span className="block mt-1">
                      Waiver {currentWaiverIndex + 1} of {requiredWaivers.length}:{" "}
                      <strong>{requiredWaivers[currentWaiverIndex]?.waiverTitle}</strong>
                    </span>
                  )}
                  {athleteQueue.length > 1 && (
                    <span className="block mt-1 text-xs">
                      Athlete {currentAthleteIndex + 1} of {athleteQueue.length}
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
                          onChange={(e) => setSignAllMode(e.target.checked)}
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
                        By signing below, I acknowledge that I have read and agree to the terms
                        above.
                      </p>
                      <SignaturePad
                        ref={signaturePadRef}
                        height={150}
                        onSignatureChange={(isEmpty) => setSignatureEmpty(isEmpty)}
                      />
                    </div>
                  </>
                )}
              </CardContent>
              <CardFooter className="flex justify-between">
                <Button
                  variant="outline"
                  onClick={() => {
                    setCheckoutStep("details");
                    setRequiredWaivers([]);
                  }}
                >
                  <ChevronLeft className="mr-1 h-4 w-4" />
                  Back
                </Button>
                <Button
                  onClick={handleSignCurrentPage}
                  disabled={isSigningWaiver || signatureEmpty || isLoadingWaiver}
                >
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
          )}

          {/* Custom Information Step */}
          {checkoutStep === "customInfo" &&
            customInfoQuestions.length > 0 &&
            athleteQueue.length > 0 && (
              <>
                {athleteQueue.length > 1 && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <FileText className="h-4 w-4" />
                    <span>
                      Athlete {currentAthleteIndex + 1} of {athleteQueue.length}
                    </span>
                  </div>
                )}
                <Card>
                  <CardContent className="pt-6">
                    <CustomInformationForm
                      key={athleteQueue[currentAthleteIndex]?.athleteId}
                      questions={customInfoQuestions}
                      existingResponses={customInfoResponses}
                      athleteId={athleteQueue[currentAthleteIndex]?.athleteId}
                      organizationId={organizationId!}
                      onComplete={async () => {
                        const currentAthlete = athleteQueueRef.current[currentAthleteIndex];
                        setAthleteCustomInfoComplete((prev) => {
                          const next = new Set(prev);
                          next.add(currentAthlete.athleteId);
                          return next;
                        });

                        // Continue to medical or next athlete
                        if (currentAthlete.needsMedical) {
                          setCheckoutStep("medical");
                        } else {
                          setAthleteMedicalComplete((prev) => {
                            const next = new Set(prev);
                            next.add(currentAthlete.athleteId);
                            return next;
                          });
                          setIsProcessing(true);
                          try {
                            await advanceToNextRequirement(currentAthleteIndex + 1);
                          } finally {
                            setIsProcessing(false);
                          }
                        }
                      }}
                      onBack={() => {
                        setCheckoutStep("details");
                      }}
                    />
                  </CardContent>
                </Card>
              </>
            )}

          {/* Medical Information Step */}
          {checkoutStep === "medical" && medicalConfig && athleteQueue.length > 0 && (
            <>
              {athleteQueue.length > 1 && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Heart className="h-4 w-4" />
                  <span>
                    Athlete {currentAthleteIndex + 1} of {athleteQueue.length}
                  </span>
                </div>
              )}
              <CheckoutMedicalForm
                key={athleteQueue[currentAthleteIndex]?.athleteId}
                athleteId={athleteQueue[currentAthleteIndex]?.athleteId}
                athleteName={athleteQueue[currentAthleteIndex]?.athleteName}
                config={medicalConfig}
                customQuestions={medicalCustomQuestions}
                organizationId={organizationId!}
                email={formData.email}
                onComplete={async () => {
                  const currentAthlete = athleteQueueRef.current[currentAthleteIndex];
                  // Mark this athlete's medical as complete
                  setAthleteMedicalComplete((prev) => {
                    const next = new Set(prev);
                    next.add(currentAthlete.athleteId);
                    return next;
                  });

                  // Advance to next athlete or payment
                  setIsProcessing(true);
                  try {
                    await advanceToNextRequirement(currentAthleteIndex + 1);
                  } finally {
                    setIsProcessing(false);
                  }
                }}
                onBack={() => {
                  // Go back to details — signed waivers and saved medical info persist server-side
                  setCheckoutStep("details");
                }}
              />
            </>
          )}

          {/* Payment Section */}
          {checkoutStep === "payment" && (
            <>
              {hasWaitlistItems ? (
                <Card className="text-center">
                  <CardHeader className="pb-4">
                    <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                      <Clock className="h-7 w-7 text-primary" />
                    </div>
                    <CardTitle className="text-xl">Waitlist Registration</CardTitle>
                    <CardDescription>
                      Payment information will be collected when a spot becomes available.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="rounded-lg border border-dashed p-4 space-y-2">
                      <div className="flex items-center justify-center gap-2 text-sm font-medium">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span>You will not be charged yet</span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        You will be added to the waitlist. When a spot opens and you are promoted,
                        we will collect payment at that time.
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => setCheckoutStep("details")}
                    >
                      <ChevronLeft className="mr-1 h-4 w-4" />
                      Back to Details
                    </Button>
                  </CardContent>
                </Card>
              ) : paymentSession ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold">Payment</h2>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setCheckoutStep("details");
                        setPaymentSession(null);
                        setPaymentError(null);
                      }}
                    >
                      <ChevronLeft className="mr-1 h-4 w-4" />
                      Back to Details
                    </Button>
                  </div>

                  {paymentError && (
                    <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 flex items-start gap-3">
                      <AlertTriangle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-destructive">Payment failed</p>
                        <p className="text-sm text-muted-foreground">{paymentError}</p>
                      </div>
                    </div>
                  )}

                  <Card>
                    <CardContent className="pt-6">
                      <AdyenCheckoutComponent
                        sessionId={paymentSession.id}
                        sessionData={paymentSession.sessionData}
                        onPaymentCompleted={handlePaymentCompleted}
                        onError={handlePaymentError}
                      />
                    </CardContent>
                  </Card>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Preparing payment...</p>
                </div>
              )}
            </>
          )}

          {/* Confirmation Step for $0 orders */}
          {checkoutStep === "confirmation" && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Check className="h-5 w-5 text-green-500" />
                  Confirm Your Registration
                </CardTitle>
                <CardDescription>Review your order and complete your registration.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg border p-4 space-y-3">
                  {Array.from(getItemsByAthlete().entries()).map(
                    ([athleteId, { athleteName, items: athleteItems }]) => (
                      <div key={athleteId}>
                        <div className="flex items-center gap-2 mb-1">
                          <User className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-sm font-semibold">{athleteName}</span>
                        </div>
                        <div className="pl-5 space-y-1">
                          {athleteItems.map((item) => (
                            <div key={item.id} className="flex justify-between text-sm">
                              <div>
                                <span>{item.name}</span>
                                {item.details?.variantLabel && (
                                  <span className="text-xs text-muted-foreground ml-1">
                                    ({item.details.variantLabel})
                                  </span>
                                )}
                              </div>
                              <span className="text-muted-foreground">
                                ${(item.price * item.quantity).toFixed(2)}
                                {item.details?.billingInterval &&
                                  item.details.billingInterval !== "ONE_TIME" &&
                                  item.details.billingInterval !== "SESSION" && (
                                    <span className="text-xs">
                                      /
                                      {item.details.billingInterval === "MONTHLY"
                                        ? "mo"
                                        : item.details.billingInterval === "YEARLY"
                                          ? "yr"
                                          : item.details.billingInterval.toLowerCase()}
                                    </span>
                                  )}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  )}
                </div>
                <Separator />
                <div className="flex justify-between font-semibold text-lg">
                  <span>Total</span>
                  <span>${total.toFixed(2)}</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  No payment is required. Click below to complete your registration.
                </p>
              </CardContent>
              <CardFooter>
                <Button
                  onClick={handleCompleteFreeCheckout}
                  disabled={isRedirectingToReceipt}
                  className="w-full"
                >
                  {isRedirectingToReceipt && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Complete Registration
                </Button>
              </CardFooter>
            </Card>
          )}
        </div>

        {/* Right Column - Order Summary */}
        <div className="lg:col-span-1">
          <Card className="sticky top-24">
            <CardHeader>
              <CardTitle>Order Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                {Array.from(getItemsByAthlete().entries()).map(
                  ([athleteId, { athleteName, items: athleteItems }]) => (
                    <div key={athleteId}>
                      {/* Athlete section header */}
                      <div className="flex items-center gap-2 mb-2">
                        <div className="flex items-center justify-center h-5 w-5 rounded-full bg-primary/10 text-primary">
                          <User className="h-3 w-3" />
                        </div>
                        <span className="text-xs font-semibold text-foreground">{athleteName}</span>
                        {/* Requirement status indicators */}
                        {checkoutStep !== "details" &&
                          (() => {
                            const reqs = athleteQueue.find((a) => a.athleteId === athleteId);
                            if (!reqs) return null;
                            return (
                              <>
                                {reqs.requiredWaiverIds.length > 0 &&
                                  (athleteWaiverComplete.has(athleteId) ? (
                                    <span className="inline-flex items-center gap-1 text-[10px] text-green-600 bg-green-50 dark:bg-green-950/50 px-1.5 py-0.5 rounded-full">
                                      <Check className="h-2.5 w-2.5" />
                                      Waivers
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 text-[10px] text-amber-600 bg-amber-50 dark:bg-amber-950/50 px-1.5 py-0.5 rounded-full">
                                      <AlertCircle className="h-2.5 w-2.5" />
                                      Waivers
                                    </span>
                                  ))}
                                {reqs.needsMedical &&
                                  (athleteMedicalComplete.has(athleteId) ? (
                                    <span className="inline-flex items-center gap-1 text-[10px] text-green-600 bg-green-50 dark:bg-green-950/50 px-1.5 py-0.5 rounded-full">
                                      <Check className="h-2.5 w-2.5" />
                                      Medical
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 text-[10px] text-amber-600 bg-amber-50 dark:bg-amber-950/50 px-1.5 py-0.5 rounded-full">
                                      <AlertCircle className="h-2.5 w-2.5" />
                                      Medical
                                    </span>
                                  ))}
                              </>
                            );
                          })()}
                      </div>
                      <div className="space-y-2 pl-2 mb-3">
                        {athleteItems.map((item) => (
                          <div key={item.id} className="flex justify-between gap-4 text-sm">
                            <div className="flex-1">
                              <span className="font-medium">{item.name}</span>
                              {item.details?.variantLabel && (
                                <span className="text-xs text-muted-foreground ml-1">
                                  ({item.details.variantLabel})
                                </span>
                              )}
                              <div className="text-xs text-muted-foreground mt-1">
                                Qty: {item.quantity}
                                {checkoutStep === "details" && (
                                  <button
                                    onClick={() => handleRemoveClick(item)}
                                    className="ml-2 text-destructive hover:underline"
                                  >
                                    Remove
                                  </button>
                                )}
                              </div>
                            </div>
                            <span>
                              ${(item.price * item.quantity).toFixed(2)}
                              {item.details?.billingInterval &&
                                item.details.billingInterval !== "ONE_TIME" &&
                                item.details.billingInterval !== "SESSION" && (
                                  <span className="text-xs text-muted-foreground">
                                    /
                                    {item.details.billingInterval === "MONTHLY"
                                      ? "mo"
                                      : item.details.billingInterval === "YEARLY"
                                        ? "yr"
                                        : item.details.billingInterval.toLowerCase()}
                                  </span>
                                )}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                )}
              </div>

              <Separator />

              <div className="space-y-2">
                <Label htmlFor="discount">Discount Code</Label>
                {appliedDiscount ? (
                  <div className="flex items-center justify-between rounded-md border bg-green-50 dark:bg-green-950/20 p-2 text-sm">
                    <div>
                      <span className="font-medium text-green-700 dark:text-green-400">
                        {appliedDiscount.code}
                      </span>
                      <span className="text-muted-foreground ml-1">
                        — {appliedDiscount.description}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-muted-foreground hover:text-destructive"
                      onClick={handleRemoveDiscount}
                      disabled={checkoutStep !== "details"}
                    >
                      Remove
                    </Button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Input
                      id="discount"
                      value={discountCode}
                      onChange={(e) => setDiscountCode(e.target.value)}
                      placeholder="Enter code"
                      disabled={checkoutStep !== "details" || isValidatingDiscount}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleApplyDiscount();
                        }
                      }}
                    />
                    <Button
                      variant="outline"
                      disabled={
                        checkoutStep !== "details" || isValidatingDiscount || !discountCode.trim()
                      }
                      onClick={handleApplyDiscount}
                    >
                      {isValidatingDiscount ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Apply"
                      )}
                    </Button>
                  </div>
                )}
              </div>

              <Separator />

              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>${subtotal.toFixed(2)}</span>
                </div>
                {appliedDiscount && discountAmount > 0 && (
                  <div className="flex justify-between text-green-600 dark:text-green-400">
                    <span>Discount ({appliedDiscount.description})</span>
                    <span>-${discountAmount.toFixed(2)}</span>
                  </div>
                )}
                {taxPaidBy === "CUSTOMER" && taxAmount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      Tax ({(taxRate * 100).toFixed(2).replace(/\.?0+$/, "")}%)
                    </span>
                    <span>${taxAmount.toFixed(2)}</span>
                  </div>
                )}
                {processingFeePaidBy === "CUSTOMER" && processingFee > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Processing Fee</span>
                    <span>${processingFee.toFixed(2)}</span>
                  </div>
                )}
                <Separator className="my-2" />
                <div className="flex justify-between font-bold text-lg">
                  <span>Total</span>
                  <span>${total.toFixed(2)}</span>
                </div>
              </div>

              {/* Checkout step indicator */}
              <Separator />
              <div className="space-y-2 text-xs">
                <div className="flex items-center gap-2">
                  <div
                    className={`h-2 w-2 rounded-full ${checkoutStep === "details" ? "bg-primary" : "bg-green-500"}`}
                  />
                  <span className={checkoutStep !== "details" ? "text-green-600" : ""}>
                    {checkoutStep !== "details" ? "Contact info complete" : "Fill in contact info"}
                  </span>
                </div>
                {athleteQueue.length > 0 && (
                  <div className="flex items-center gap-2">
                    <div
                      className={`h-2 w-2 rounded-full ${
                        checkoutStep === "payment" || checkoutStep === "confirmation"
                          ? "bg-green-500"
                          : checkoutStep === "waivers" || checkoutStep === "medical"
                            ? "bg-primary"
                            : "bg-muted"
                      }`}
                    />
                    <span
                      className={
                        checkoutStep === "payment" || checkoutStep === "confirmation"
                          ? "text-green-600"
                          : ""
                      }
                    >
                      {checkoutStep === "payment" || checkoutStep === "confirmation"
                        ? "All requirements complete"
                        : checkoutStep === "waivers" || checkoutStep === "medical"
                          ? `Athlete requirements (${currentAthleteIndex + 1}/${athleteQueue.length})`
                          : "Complete requirements"}
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <div
                    className={`h-2 w-2 rounded-full ${
                      checkoutStep === "confirmation"
                        ? "bg-primary"
                        : checkoutStep === "payment"
                          ? "bg-primary"
                          : "bg-muted"
                    }`}
                  />
                  <span>{total === 0 ? "Confirm registration" : "Complete payment"}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Reservation Timer */}
      {hasReservation && reservation && (
        <ReservationTimer expiresAt={reservation.expiresAt} organizationSlug={params.slug} />
      )}

      {/* Remove item confirmation dialog */}
      <RemoveItemDialog
        open={removeDialogOpen}
        onOpenChange={setRemoveDialogOpen}
        itemToRemove={itemToRemove}
        dependentItems={dependentItems}
        onCancel={handleCancelRemove}
        onConfirmRemove={handleConfirmRemove}
      />
    </div>
  );
}
