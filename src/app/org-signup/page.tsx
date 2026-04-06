"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Loader2,
  Check,
  X,
  Info,
  Building2,
  User,
  UserCheck,
  Globe,
  CreditCard,
  Palette,
  Users,
  UserPlus,
  Calendar,
  BookOpen,
  MessageSquare,
  Mail,
  HardDrive,
  Tag,
  Trophy,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  RotateCw,
} from "lucide-react";
import { toast } from "sonner";
import { REGEXP_ONLY_DIGITS_AND_CHARS } from "input-otp";
import { validatePassword, PASSWORD_MESSAGES, PASSWORD_MIN_LENGTH } from "@/lib/password";

import { COUNTRIES, isValidPostalCode } from "@/lib/location-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import { PhoneInput } from "@/components/ui/phone-input";
import { isValidPhoneNumber } from "react-phone-number-input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StateProvinceCombobox } from "@/components/ui/state-province-combobox";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { getBaseDomainSuffix, getClientSubdomainUrl } from "@/lib/client-domains";
import { PlansComparisonDialog } from "./plans-comparison-dialog";
import {
  defineStepper,
  StepperNav,
  StepperItem,
  StepperIndicator,
  StepperSeparator,
  StepperTitle,
  getStepStatus,
} from "@/components/ui/stepper";

interface Sport {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
}

interface SubscriptionPlan {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  monthlyPrice: string;
  yearlyPrice: string | null;
  transactionFee: string;
  perTransactionFee: string;
  features: string[];
  featureToggles: Record<string, boolean>;
  isPopular: boolean;
  maxAthletes: number | null;
  maxUsers: number | null;
  maxPrograms: number | null;
  maxEvents: number | null;
  smsIncluded: number | null;
  smsOverageRate: string | null;
  emailIncluded: number | null;
  emailOverageRate: string | null;
  maxStorageMB: number | null;
  maxMembershipTypes: number | null;
}

const MAX_NAME_LENGTH = 50;
const HEX_COLOR_REGEX = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;

type SignupMode = "choosing" | "existingAccount" | "newAccount";
type EmailVerificationState = "idle" | "sending" | "sent" | "verifying" | "verified" | "exists";

const { useStepper } = defineStepper(
  { id: "account", title: "Account" },
  { id: "organization", title: "Organization" },
  { id: "website", title: "Website & Branding" },
  { id: "plan", title: "Plan" }
);

export default function SignupPage() {
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();
  const stepper = useStepper();
  const [signupMode, setSignupMode] = React.useState<SignupMode | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [plans, setPlans] = React.useState<SubscriptionPlan[]>([]);
  const [plansLoading, setPlansLoading] = React.useState(true);
  const [selectedPlan, setSelectedPlan] = React.useState<string | null>(null);
  const [sports, setSports] = React.useState<Sport[]>([]);
  const [sportsLoading, setSportsLoading] = React.useState(true);

  const useExistingAccount = signupMode === "existingAccount";
  const restoredFromSession = React.useRef(false);

  // Email verification state
  const [emailVerification, setEmailVerification] = React.useState<EmailVerificationState>("idle");
  const [verificationCode, setVerificationCode] = React.useState("");

  // Restore form data when returning from the payment page
  React.useEffect(() => {
    const raw = sessionStorage.getItem("org-signup-data");
    if (!raw) return;

    try {
      const data = JSON.parse(raw);
      const { planName, planPrice, useExistingAccount: wasExisting, ...formFields } = data;
      setFormData((prev) => ({ ...prev, ...formFields }));
      if (formFields.planId) setSelectedPlan(formFields.planId);

      if (wasExisting) {
        setSignupMode("existingAccount");
      } else {
        setSignupMode("newAccount");
        setEmailVerification("verified");
      }

      stepper.navigation.goTo("plan");
      restoredFromSession.current = true;
      // Clear the cache so that if the user navigates back through the stepper
      // and the page remounts, it doesn't auto-jump to the plan step again.
      sessionStorage.removeItem("org-signup-data");
    } catch {
      // Invalid saved data — ignore and start fresh
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  React.useEffect(() => {
    if (restoredFromSession.current) return;
    if (sessionStatus === "loading") return;
    if (sessionStatus === "authenticated") {
      setSignupMode("choosing");
    } else {
      setSignupMode("newAccount");
    }
  }, [sessionStatus]);

  // Organization name availability check
  const [orgNameStatus, setOrgNameStatus] = React.useState<
    "idle" | "checking" | "available" | "taken"
  >("idle");
  const [orgNameReason, setOrgNameReason] = React.useState<string>("");
  const orgNameCheckTimeout = React.useRef<NodeJS.Timeout | null>(null);

  // Subdomain availability check
  const [subdomainStatus, setSubdomainStatus] = React.useState<
    "idle" | "checking" | "available" | "taken"
  >("idle");
  const [subdomainReason, setSubdomainReason] = React.useState<string>("");
  const subdomainCheckTimeout = React.useRef<NodeJS.Timeout | null>(null);

  // Form state
  const [formData, setFormData] = React.useState({
    // User account
    email: "",
    password: "",
    confirmPassword: "",
    name: "",

    // Organization
    orgName: "",
    orgEmail: "",
    phone: "",
    street: "",
    city: "",
    stateProvince: "",
    postalCode: "",
    country: "",

    // Website
    subdomain: "",

    // Branding (optional)
    primaryColor: "#000000",
    secondaryColor: "#ffffff",

    // Sports (optional)
    sportIds: [] as string[],

    // Plan
    planId: "",
  });

  // Validation errors
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  // Default country from browser locale (US or CA only)
  React.useEffect(() => {
    if (typeof navigator === "undefined") return;
    const locale = navigator.language || (navigator.languages && navigator.languages[0]) || "";
    const region = locale.split("-")[1]?.toUpperCase();
    if (region === "US" || region === "CA") {
      setFormData((prev) => (prev.country ? prev : { ...prev, country: region }));
    }
  }, []);

  // Fetch plans on mount
  React.useEffect(() => {
    async function fetchPlans() {
      try {
        const response = await fetch("/api/org-signup/plans");
        if (!response.ok) throw new Error("Failed to fetch plans");
        const data = await response.json();
        setPlans(data);
      } catch (error) {
        toast.error("Failed to load subscription plans");
      } finally {
        setPlansLoading(false);
      }
    }
    fetchPlans();
  }, []);

  // Fetch sports on mount
  React.useEffect(() => {
    async function fetchSports() {
      try {
        const response = await fetch("/api/sports");
        if (!response.ok) throw new Error("Failed to fetch sports");
        const data = await response.json();
        setSports(data);
      } catch (error) {
        console.error("Failed to load sports:", error);
      } finally {
        setSportsLoading(false);
      }
    }
    fetchSports();
  }, []);

  // Check organization name availability
  const checkOrgName = React.useCallback(async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) {
      setOrgNameStatus("idle");
      setOrgNameReason("");
      return;
    }

    setOrgNameStatus("checking");
    try {
      const response = await fetch(
        `/api/org-signup/check-org-name?name=${encodeURIComponent(trimmed)}`
      );
      const data = await response.json();
      setOrgNameStatus(data.available ? "available" : "taken");
      setOrgNameReason(data.reason || "");
    } catch {
      setOrgNameStatus("idle");
      setOrgNameReason("");
    }
  }, []);

  // Debounced org name check
  const handleOrgNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target;
    setFormData((prev) => ({ ...prev, orgName: value }));
    if (errors.orgName) {
      setErrors((prev) => ({ ...prev, orgName: "" }));
    }

    if (orgNameCheckTimeout.current) {
      clearTimeout(orgNameCheckTimeout.current);
    }

    orgNameCheckTimeout.current = setTimeout(() => {
      checkOrgName(value);
    }, 500);
  };

  // Check subdomain availability
  const checkSubdomain = React.useCallback(async (subdomain: string) => {
    if (!subdomain || subdomain.length < 3) {
      setSubdomainStatus("idle");
      setSubdomainReason("");
      return;
    }

    setSubdomainStatus("checking");
    try {
      const response = await fetch(
        `/api/org-signup/check-subdomain?subdomain=${encodeURIComponent(subdomain)}`
      );
      const data = await response.json();
      setSubdomainStatus(data.available ? "available" : "taken");
      setSubdomainReason(data.reason || "");
    } catch (error) {
      setSubdomainStatus("idle");
      setSubdomainReason("");
    }
  }, []);

  // Debounced subdomain check
  const handleSubdomainChange = (value: string) => {
    const withDashes = value.replace(/\s/g, "-");
    const normalized = withDashes.toLowerCase().replace(/[^a-z0-9-]/g, "");
    setFormData((prev) => ({ ...prev, subdomain: normalized }));
    if (errors.subdomain) {
      setErrors((prev) => ({ ...prev, subdomain: "" }));
    }

    if (subdomainCheckTimeout.current) {
      clearTimeout(subdomainCheckTimeout.current);
    }

    subdomainCheckTimeout.current = setTimeout(() => {
      checkSubdomain(normalized);
    }, 500);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const handleEmailBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const trimmed = value.trim();
    if (trimmed && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setErrors((prev) => ({ ...prev, [name]: "Please enter a valid email" }));
    }
  };

  const handleSendVerificationCode = async () => {
    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) {
      newErrors.name = "Your name is required";
    } else if (formData.name.length > MAX_NAME_LENGTH) {
      newErrors.name = `Name must be ${MAX_NAME_LENGTH} characters or less`;
    }
    const email = formData.email.trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = "Please enter a valid email";
    }
    if (Object.keys(newErrors).length > 0) {
      setErrors((prev) => ({ ...prev, ...newErrors }));
      return;
    }

    setEmailVerification("sending");
    try {
      const response = await fetch("/api/org-signup/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.message || "Failed to send verification code");
      }

      if (data.sent) {
        setEmailVerification("sent");
        toast.success("Verification code sent to your email");
      }
    } catch (error) {
      setEmailVerification("idle");
      toast.error(error instanceof Error ? error.message : "Failed to send verification code");
    }
  };

  const handleVerifyCode = async (codeToVerify?: string) => {
    const code = codeToVerify || verificationCode;
    if (!code.trim()) return;

    setEmailVerification("verifying");
    try {
      const response = await fetch("/api/org-signup/verify-email/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: formData.email.trim().toLowerCase(),
          code: code.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.message || "Verification failed");
      }

      if (data.verified) {
        setEmailVerification("verified");
        toast.success("Email verified successfully");
      } else {
        setEmailVerification("sent");
        setVerificationCode("");
        toast.error("Invalid or expired code. Please try again.");
      }
    } catch (error) {
      setEmailVerification("sent");
      setVerificationCode("");
      toast.error(error instanceof Error ? error.message : "Verification failed");
    }
  };

  const getLoginUrl = () => {
    const loginBase = getClientSubdomainUrl("login");
    const callbackUrl = window.location.href;
    return `${loginBase}?callbackUrl=${encodeURIComponent(callbackUrl)}`;
  };

  const validateAccountStep = (): boolean => {
    if (useExistingAccount) return true;

    const newErrors: Record<string, string> = {};

    if (emailVerification !== "verified") {
      newErrors.email = "Please verify your email before continuing";
      setErrors(newErrors);
      return false;
    }

    if (!formData.password) {
      newErrors.password = "Password is required";
    } else {
      const pwError = validatePassword(formData.password);
      if (pwError) newErrors.password = pwError;
    }
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = PASSWORD_MESSAGES.mismatch;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateOrganizationStep = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.orgName.trim()) {
      newErrors.orgName = "Organization name is required";
    } else if (orgNameStatus === "taken") {
      newErrors.orgName = orgNameReason || "An organization with this name already exists";
    }
    if (!formData.orgEmail.trim()) {
      newErrors.orgEmail = "Organization email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.orgEmail)) {
      newErrors.orgEmail = "Please enter a valid email";
    }
    if (!formData.phone) {
      newErrors.phone = "Phone is required";
    } else if (!isValidPhoneNumber(formData.phone)) {
      newErrors.phone = "Please enter a valid phone number";
    }
    if (!formData.country) {
      newErrors.country = "Country is required";
    }
    if (!formData.street.trim()) {
      newErrors.street = "Street address is required";
    }
    if (!formData.city.trim()) {
      newErrors.city = "City is required";
    }
    if (!formData.stateProvince.trim()) {
      newErrors.stateProvince = "State / Province is required";
    }
    if (formData.country === "US" || formData.country === "CA") {
      if (!formData.postalCode.trim()) {
        newErrors.postalCode = "Postal code is required";
      } else if (!isValidPostalCode(formData.postalCode, formData.country)) {
        newErrors.postalCode =
          formData.country === "US"
            ? "Enter a valid US ZIP code (e.g. 12345 or 12345-6789)"
            : "Enter a valid Canadian postal code (e.g. A1A 1A1)";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateWebsiteStep = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.subdomain.trim()) {
      newErrors.subdomain = "Subdomain is required";
    } else if (formData.subdomain.length < 3) {
      newErrors.subdomain = "Subdomain must be at least 3 characters";
    } else if (subdomainStatus === "taken") {
      newErrors.subdomain = subdomainReason || "This subdomain is already taken";
    }

    if (!HEX_COLOR_REGEX.test(formData.primaryColor)) {
      newErrors.primaryColor = "Enter a valid hex color (e.g. #000000)";
    }
    if (!HEX_COLOR_REGEX.test(formData.secondaryColor)) {
      newErrors.secondaryColor = "Enter a valid hex color (e.g. #ffffff)";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validatePlanStep = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!selectedPlan) {
      newErrors.planId = "Please select a plan";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    const currentStepId = stepper.state.current.data.id;
    let valid = false;

    if (currentStepId === "account") valid = validateAccountStep();
    else if (currentStepId === "organization") valid = validateOrganizationStep();
    else if (currentStepId === "website") valid = validateWebsiteStep();
    else if (currentStepId === "plan") valid = validatePlanStep();

    if (valid) {
      stepper.navigation.next();
    } else {
      toast.error("Please fix the errors before continuing");
    }
  };

  // Prevents the form from submitting via Enter key or any other implicit mechanism.
  // All step navigation and plan submission are handled by explicit button onClick handlers.
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
  };

  const handlePlanContinue = async () => {
    if (!validatePlanStep()) {
      toast.error("Please fix the errors in the form");
      return;
    }

    const chosenPlan = plans.find((p) => p.id === selectedPlan);
    const isPaidPlan = chosenPlan && Number(chosenPlan.monthlyPrice) > 0;

    const submitData = useExistingAccount
      ? (() => {
          const { email, password, confirmPassword, name, ...orgFields } = formData;
          return { ...orgFields, useExistingAccount: true as const };
        })()
      : formData;

    setIsLoading(true);

    if (isPaidPlan) {
      const signupData = {
        ...submitData,
        planName: chosenPlan.name,
        planPrice: chosenPlan.monthlyPrice,
        ...(useExistingAccount ? { email: session?.user?.email ?? "" } : {}),
      };
      sessionStorage.setItem("org-signup-data", JSON.stringify(signupData));
      router.push("/org-signup/payment");
      return;
    }

    const signupData = {
      ...submitData,
      planName: chosenPlan?.name ?? "Free",
      planPrice: chosenPlan ? chosenPlan.monthlyPrice : "0",
      ...(useExistingAccount ? { email: session?.user?.email ?? "" } : {}),
    };
    sessionStorage.setItem("org-signup-data", JSON.stringify(signupData));
    router.push("/org-signup/review");
  };

  const formatCurrency = (amount: string | number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
    }).format(Number(amount));
  };

  if (signupMode === null || sessionStatus === "loading") {
    return (
      <div className="w-full max-w-5xl mx-auto flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const currentStepId = stepper.state.current.data.id;
  const currentIndex = stepper.state.all.findIndex((s) => s.id === currentStepId);

  return (
    <TooltipProvider>
      <div className="w-full max-w-5xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Create Your Organization</h1>
          <p className="text-muted-foreground">Get started with Uplifter in just a few minutes.</p>
        </div>

        {/* Stepper Navigation */}
        <div className="mb-8 max-w-2xl mx-auto">
          <StepperNav>
            {stepper.state.all.map((step, index) => {
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
                      {step.title}
                    </StepperTitle>
                  </StepperItem>
                  {index < stepper.state.all.length - 1 && <StepperSeparator status={status} />}
                </React.Fragment>
              );
            })}
          </StepperNav>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <fieldset disabled={isLoading} className="space-y-6">
            {/* Step 1: Account */}
            {currentStepId === "account" && (
              <>
                {signupMode === "choosing" ? (
                  <div className="space-y-4">
                    <Card
                      className="cursor-pointer transition-all hover:border-primary/50 hover:shadow-md"
                      onClick={() => {
                        setSignupMode("existingAccount");
                        stepper.navigation.next();
                      }}
                    >
                      <CardContent className="flex items-center gap-4 p-6">
                        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <UserCheck className="h-6 w-6 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold">
                            Continue as {session?.user?.name || "current user"}
                          </p>
                          <p className="text-sm text-muted-foreground truncate">
                            {session?.user?.email}
                          </p>
                        </div>
                        <ArrowRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                      </CardContent>
                    </Card>

                    <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t" />
                      </div>
                      <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-background px-2 text-muted-foreground">Or</span>
                      </div>
                    </div>

                    <Card
                      className="cursor-pointer transition-all hover:border-primary/50 hover:shadow-md"
                      onClick={() => setSignupMode("newAccount")}
                    >
                      <CardContent className="flex items-center gap-4 p-6">
                        <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                          <UserPlus className="h-6 w-6 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold">Use a different account</p>
                          <p className="text-sm text-muted-foreground">
                            Create a new account for this organization
                          </p>
                        </div>
                        <ArrowRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                      </CardContent>
                    </Card>
                  </div>
                ) : useExistingAccount ? (
                  <div>
                    <Card>
                      <CardContent className="flex items-center gap-4 p-6">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <UserCheck className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium">{session?.user?.name}</p>
                          <p className="text-sm text-muted-foreground">{session?.user?.email}</p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setSignupMode("choosing")}
                        >
                          Change
                        </Button>
                      </CardContent>
                    </Card>
                  </div>
                ) : emailVerification === "sent" || emailVerification === "verifying" ? (
                  <Card>
                    <CardHeader className="text-center">
                      <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                        <Mail className="h-6 w-6 text-primary" />
                      </div>
                      <CardTitle>Check your email</CardTitle>
                      <CardDescription>
                        We sent a verification code to{" "}
                        <span className="font-medium text-foreground">{formData.email}</span>
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col items-center gap-4">
                      <InputOTP
                        maxLength={6}
                        pattern={REGEXP_ONLY_DIGITS_AND_CHARS}
                        value={verificationCode}
                        onChange={setVerificationCode}
                        onComplete={(code) => handleVerifyCode(code)}
                        disabled={emailVerification === "verifying"}
                        autoFocus
                      >
                        <InputOTPGroup>
                          <InputOTPSlot index={0} />
                          <InputOTPSlot index={1} />
                          <InputOTPSlot index={2} />
                        </InputOTPGroup>
                        <InputOTPSeparator />
                        <InputOTPGroup>
                          <InputOTPSlot index={3} />
                          <InputOTPSlot index={4} />
                          <InputOTPSlot index={5} />
                        </InputOTPGroup>
                      </InputOTP>

                      {emailVerification === "verifying" && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span className="text-sm">Verifying...</span>
                        </div>
                      )}

                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <span>Didn&apos;t receive the code?</span>
                        <Button
                          type="button"
                          variant="link"
                          size="sm"
                          className="h-auto p-0 text-sm"
                          onClick={handleSendVerificationCode}
                          disabled={emailVerification === "verifying"}
                        >
                          <RotateCw className="mr-1 h-3 w-3" />
                          Resend
                        </Button>
                      </div>

                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground"
                        onClick={() => {
                          setEmailVerification("idle");
                          setVerificationCode("");
                        }}
                      >
                        <ArrowLeft className="mr-1 h-3 w-3" />
                        Use a different email
                      </Button>
                    </CardContent>
                  </Card>
                ) : emailVerification === "exists" ? (
                  <Card>
                    <CardHeader className="text-center">
                      <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-950">
                        <UserCheck className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                      </div>
                      <CardTitle>Account already exists</CardTitle>
                      <CardDescription>
                        An account with{" "}
                        <span className="font-medium text-foreground">{formData.email}</span>{" "}
                        already exists. Sign in to continue creating your organization.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col items-center gap-3">
                      <Button
                        type="button"
                        onClick={() => {
                          window.location.href = getLoginUrl();
                        }}
                      >
                        Sign in instead
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground"
                        onClick={() => {
                          setEmailVerification("idle");
                          setFormData((prev) => ({ ...prev, email: "" }));
                        }}
                      >
                        <ArrowLeft className="mr-1 h-3 w-3" />
                        Use a different email
                      </Button>
                    </CardContent>
                  </Card>
                ) : emailVerification === "verified" ? (
                  <Card>
                    <CardHeader>
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="h-5 w-5 text-green-600" />
                        <CardTitle>Create your password</CardTitle>
                      </div>
                      <CardDescription>
                        Email verified as{" "}
                        <span className="font-medium text-foreground">{formData.email}</span>. Set a
                        password to secure your account.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="password">Password</Label>
                        <Input
                          id="password"
                          name="password"
                          type="password"
                          autoComplete="new-password"
                          placeholder={`Min. ${PASSWORD_MIN_LENGTH} chars, upper, lower, number, special`}
                          value={formData.password}
                          onChange={handleInputChange}
                          className={errors.password ? "border-destructive" : ""}
                        />
                        {errors.password && (
                          <p className="text-sm text-destructive">{errors.password}</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="confirmPassword">Confirm Password</Label>
                        <Input
                          id="confirmPassword"
                          name="confirmPassword"
                          type="password"
                          autoComplete="new-password"
                          placeholder="Confirm your password"
                          value={formData.confirmPassword}
                          onChange={handleInputChange}
                          className={errors.confirmPassword ? "border-destructive" : ""}
                        />
                        {errors.confirmPassword && (
                          <p className="text-sm text-destructive">{errors.confirmPassword}</p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <Card>
                    <CardHeader>
                      <div className="flex items-center gap-2">
                        <User className="h-5 w-5 text-primary" />
                        <CardTitle>Your Account</CardTitle>
                      </div>
                      <CardDescription>Enter your name and email to get started</CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="name">Your Name</Label>
                        <Input
                          id="name"
                          name="name"
                          autoComplete="name"
                          placeholder="John Smith"
                          value={formData.name}
                          onChange={handleInputChange}
                          maxLength={MAX_NAME_LENGTH}
                          className={errors.name ? "border-destructive" : ""}
                        />
                        {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
                        <p className="text-xs text-muted-foreground">
                          {formData.name.length}/{MAX_NAME_LENGTH}
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="email">Email Address</Label>
                        <Input
                          id="email"
                          name="email"
                          type="email"
                          autoComplete="email"
                          placeholder="you@example.com"
                          value={formData.email}
                          onChange={handleInputChange}
                          onBlur={handleEmailBlur}
                          className={errors.email ? "border-destructive" : ""}
                        />
                        {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            )}

            {/* Step 2: Organization Details + Sports */}
            {currentStepId === "organization" && (
              <>
                <Card>
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <Building2 className="h-5 w-5 text-primary" />
                      <CardTitle>Organization Details</CardTitle>
                    </div>
                    <CardDescription>Tell us about your organization</CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="orgName">Organization Name</Label>
                      <div className="relative">
                        <Input
                          id="orgName"
                          name="orgName"
                          placeholder="Your Gymnastics Club"
                          value={formData.orgName}
                          onChange={handleOrgNameChange}
                          className={cn(
                            errors.orgName ? "border-destructive" : "",
                            orgNameStatus === "available"
                              ? "border-green-500 focus-visible:ring-green-500"
                              : "",
                            orgNameStatus === "taken" ? "border-destructive" : "",
                            "pr-8"
                          )}
                        />
                        {orgNameStatus !== "idle" && (
                          <div className="absolute right-2 top-1/2 -translate-y-1/2">
                            {orgNameStatus === "checking" && (
                              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                            )}
                            {orgNameStatus === "available" && (
                              <Check className="h-4 w-4 text-green-500" />
                            )}
                            {orgNameStatus === "taken" && (
                              <X className="h-4 w-4 text-destructive" />
                            )}
                          </div>
                        )}
                      </div>
                      {errors.orgName && (
                        <p className="text-sm text-destructive">{errors.orgName}</p>
                      )}
                      {!errors.orgName && orgNameStatus === "taken" && (
                        <p className="text-sm text-destructive">
                          {orgNameReason || "An organization with this name already exists"}
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="orgEmail">Organization Email</Label>
                      <Input
                        id="orgEmail"
                        name="orgEmail"
                        type="email"
                        placeholder="info@yourclub.com"
                        value={formData.orgEmail}
                        onChange={handleInputChange}
                        onBlur={handleEmailBlur}
                        className={errors.orgEmail ? "border-destructive" : ""}
                      />
                      {errors.orgEmail && (
                        <p className="text-sm text-destructive">{errors.orgEmail}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone</Label>
                      <PhoneInput
                        id="phone"
                        defaultCountry="US"
                        value={formData.phone}
                        onChange={(value) => {
                          setFormData((prev) => ({ ...prev, phone: value || "" }));
                          if (errors.phone) {
                            setErrors((prev) => ({ ...prev, phone: "" }));
                          }
                        }}
                        className={errors.phone ? "[&>input]:border-destructive" : ""}
                      />
                      {errors.phone && <p className="text-sm text-destructive">{errors.phone}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="country">Country</Label>
                      <Select
                        value={formData.country}
                        onValueChange={(value) => {
                          setFormData((prev) => ({
                            ...prev,
                            country: value,
                            stateProvince: prev.country !== value ? "" : prev.stateProvince,
                          }));
                          if (errors.country) setErrors((prev) => ({ ...prev, country: "" }));
                        }}
                      >
                        <SelectTrigger className={errors.country ? "border-destructive" : ""}>
                          <SelectValue placeholder="Select country" />
                        </SelectTrigger>
                        <SelectContent>
                          {COUNTRIES.map((country) => (
                            <SelectItem key={country.code} value={country.code}>
                              {country.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {errors.country && (
                        <p className="text-sm text-destructive">{errors.country}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="street">Street Address</Label>
                      <Input
                        id="street"
                        name="street"
                        autoComplete="street-address"
                        placeholder="123 Main Street"
                        value={formData.street}
                        onChange={handleInputChange}
                        className={errors.street ? "border-destructive" : ""}
                      />
                      {errors.street && <p className="text-sm text-destructive">{errors.street}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="city">City</Label>
                      <Input
                        id="city"
                        name="city"
                        autoComplete="address-level2"
                        placeholder="New York"
                        value={formData.city}
                        onChange={handleInputChange}
                        className={errors.city ? "border-destructive" : ""}
                      />
                      {errors.city && <p className="text-sm text-destructive">{errors.city}</p>}
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
                        onChange={(val) => {
                          setFormData((prev) => ({ ...prev, stateProvince: val }));
                          if (errors.stateProvince)
                            setErrors((prev) => ({ ...prev, stateProvince: "" }));
                        }}
                        error={!!errors.stateProvince}
                      />
                      {errors.stateProvince && (
                        <p className="text-sm text-destructive">{errors.stateProvince}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="postalCode">Postal Code</Label>
                      <Input
                        id="postalCode"
                        name="postalCode"
                        autoComplete="postal-code"
                        placeholder={formData.country === "CA" ? "A1A 1A1" : "10001"}
                        value={formData.postalCode}
                        onChange={handleInputChange}
                        className={errors.postalCode ? "border-destructive" : ""}
                      />
                      {errors.postalCode && (
                        <p className="text-sm text-destructive">{errors.postalCode}</p>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Sports (Optional) */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <Trophy className="h-5 w-5 text-primary" />
                      <CardTitle>Sports Offered</CardTitle>
                      <Badge variant="secondary" className="ml-2">
                        Optional
                      </Badge>
                    </div>
                    <CardDescription>
                      Select the sports your organization offers. You can update this later in your
                      dashboard.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {sportsLoading ? (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : sports.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No sports available yet.</p>
                    ) : (
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {sports.map((sport) => {
                          const isSelected = formData.sportIds.includes(sport.id);
                          return (
                            <label
                              key={sport.id}
                              className={cn(
                                "flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors",
                                isSelected ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                              )}
                            >
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={(checked) => {
                                  setFormData((prev) => ({
                                    ...prev,
                                    sportIds: checked
                                      ? [...prev.sportIds, sport.id]
                                      : prev.sportIds.filter((id) => id !== sport.id),
                                  }));
                                }}
                                className="mt-0.5"
                              />
                              <div className="flex-1 space-y-0.5">
                                <span className="font-medium text-sm">{sport.name}</span>
                                {sport.description && (
                                  <p className="text-xs text-muted-foreground">
                                    {sport.description}
                                  </p>
                                )}
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            )}

            {/* Step 3: Website & Branding */}
            {currentStepId === "website" && (
              <>
                <Card>
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <Globe className="h-5 w-5 text-primary" />
                      <CardTitle>Your Website</CardTitle>
                    </div>
                    <CardDescription>Choose your organization&apos;s web address</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Label htmlFor="subdomain">Subdomain</Label>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            <p>
                              A custom domain (e.g., yourclub.com) can be configured after initial
                              setup in your dashboard settings.
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <div className="relative flex w-full items-center">
                        <Input
                          id="subdomain"
                          name="subdomain"
                          placeholder="your-club"
                          value={formData.subdomain}
                          onChange={(e) => handleSubdomainChange(e.target.value)}
                          className={cn(
                            "flex-1 min-w-0 rounded-r-none",
                            errors.subdomain ? "border-destructive" : "",
                            subdomainStatus === "available"
                              ? "border-green-500 focus-visible:ring-green-500"
                              : "",
                            subdomainStatus === "taken" ? "border-destructive" : ""
                          )}
                        />
                        <span className="inline-flex items-center px-3 h-9 border border-l-0 rounded-r-md bg-muted text-muted-foreground text-sm whitespace-nowrap">
                          {getBaseDomainSuffix()}
                        </span>
                        {subdomainStatus !== "idle" && (
                          <div className="absolute right-2 top-1/2 -translate-y-1/2">
                            {subdomainStatus === "checking" && (
                              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                            )}
                            {subdomainStatus === "available" && (
                              <Check className="h-4 w-4 text-green-500" />
                            )}
                            {subdomainStatus === "taken" && (
                              <X className="h-4 w-4 text-destructive" />
                            )}
                          </div>
                        )}
                      </div>
                      {errors.subdomain && (
                        <p className="text-sm text-destructive">{errors.subdomain}</p>
                      )}
                      {subdomainStatus === "available" && (
                        <p className="text-sm text-green-600">This subdomain is available!</p>
                      )}
                      {subdomainStatus === "taken" && (
                        <p className="text-sm text-destructive">
                          {subdomainReason ||
                            "This subdomain is already taken. Please choose another."}
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <Palette className="h-5 w-5 text-primary" />
                      <CardTitle>Branding</CardTitle>
                      <Badge variant="secondary" className="ml-2">
                        Optional
                      </Badge>
                    </div>
                    <CardDescription>
                      Choose your brand colors. You can customize these later in your dashboard.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="primaryColor">Primary Color</Label>
                        <div className="flex gap-2">
                          <Input
                            id="primaryColor"
                            type="color"
                            className="w-12 p-1 h-10 cursor-pointer"
                            value={formData.primaryColor}
                            onChange={(e) =>
                              setFormData((prev) => ({ ...prev, primaryColor: e.target.value }))
                            }
                          />
                          <Input
                            value={formData.primaryColor}
                            onChange={(e) => {
                              const v = e.target.value;
                              if (v === "" || /^#?[A-Fa-f0-9]{0,6}$/.test(v.replace(/^#/, ""))) {
                                setFormData((prev) => ({
                                  ...prev,
                                  primaryColor: v.startsWith("#") ? v : "#" + v,
                                }));
                                if (errors.primaryColor)
                                  setErrors((prev) => ({ ...prev, primaryColor: "" }));
                              }
                            }}
                            className={cn("font-mono", errors.primaryColor && "border-destructive")}
                            placeholder="#000000"
                            maxLength={7}
                          />
                        </div>
                        {errors.primaryColor && (
                          <p className="text-sm text-destructive">{errors.primaryColor}</p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          Used for buttons, links, and accents (e.g. #000000)
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="secondaryColor">Secondary Color</Label>
                        <div className="flex gap-2">
                          <Input
                            id="secondaryColor"
                            type="color"
                            className="w-12 p-1 h-10 cursor-pointer"
                            value={formData.secondaryColor}
                            onChange={(e) =>
                              setFormData((prev) => ({ ...prev, secondaryColor: e.target.value }))
                            }
                          />
                          <Input
                            value={formData.secondaryColor}
                            onChange={(e) => {
                              const v = e.target.value;
                              if (v === "" || /^#?[A-Fa-f0-9]{0,6}$/.test(v.replace(/^#/, ""))) {
                                setFormData((prev) => ({
                                  ...prev,
                                  secondaryColor: v.startsWith("#") ? v : "#" + v,
                                }));
                                if (errors.secondaryColor)
                                  setErrors((prev) => ({ ...prev, secondaryColor: "" }));
                              }
                            }}
                            className={cn(
                              "font-mono",
                              errors.secondaryColor && "border-destructive"
                            )}
                            placeholder="#ffffff"
                            maxLength={7}
                          />
                        </div>
                        {errors.secondaryColor && (
                          <p className="text-sm text-destructive">{errors.secondaryColor}</p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          Used for backgrounds and highlights (e.g. #ffffff)
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}

            {/* Step 4: Choose Your Plan */}
            {currentStepId === "plan" && (
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5 text-primary" />
                    <CardTitle>Choose Your Plan</CardTitle>
                  </div>
                  <CardDescription>
                    {plans.find((p) => p.id === selectedPlan && Number(p.monthlyPrice) > 0)
                      ? "All paid plans include a 30-day free trial. Credit card required."
                      : "No credit card required. Get started instantly."}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {plansLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <>
                      <div
                        className={cn(
                          "grid gap-4",
                          plans.length === 1 && "grid-cols-1",
                          plans.length === 2 && "grid-cols-1 sm:grid-cols-2",
                          plans.length >= 3 && "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
                        )}
                      >
                        {plans.map((plan) => (
                          <div
                            key={plan.id}
                            onClick={() => {
                              setSelectedPlan(plan.id);
                              setFormData((prev) => ({ ...prev, planId: plan.id }));
                              if (errors.planId) setErrors((prev) => ({ ...prev, planId: "" }));
                            }}
                            className={cn(
                              "relative cursor-pointer rounded-lg border-2 p-4 transition-all hover:border-primary/50",
                              selectedPlan === plan.id
                                ? "border-primary bg-primary/5"
                                : plan.isPopular && selectedPlan === null
                                  ? "border-primary/40 bg-primary/[0.02]"
                                  : "border-border"
                            )}
                          >
                            {plan.isPopular && (
                              <Badge className="absolute -top-2 right-2 bg-primary">Popular</Badge>
                            )}
                            {selectedPlan === plan.id && (
                              <div className="absolute -top-2 -left-2">
                                <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center ring-2 ring-background">
                                  <Check className="h-3 w-3 text-primary-foreground" />
                                </div>
                              </div>
                            )}

                            <div className="mb-3">
                              <h3 className="font-semibold text-lg">{plan.name}</h3>
                              {plan.description && (
                                <p className="text-sm text-muted-foreground mt-0.5">
                                  {plan.description}
                                </p>
                              )}
                              <div className="flex items-baseline gap-1 mt-2">
                                <span className="text-3xl font-bold">
                                  {formatCurrency(plan.monthlyPrice)}
                                </span>
                                <span className="text-muted-foreground text-sm">/mo</span>
                              </div>
                              {plan.yearlyPrice && Number(plan.yearlyPrice) > 0 && (
                                <p className="text-sm text-muted-foreground">
                                  or {formatCurrency(plan.yearlyPrice)}/year
                                </p>
                              )}
                            </div>

                            {Number(plan.monthlyPrice) > 0 && (
                              <Badge variant="secondary" className="mb-3">
                                Free for 30 days
                              </Badge>
                            )}

                            <div className="grid grid-cols-4 gap-1 text-center text-xs mb-3 py-2 border-y">
                              <div>
                                <Users className="h-3.5 w-3.5 mx-auto mb-0.5 text-muted-foreground" />
                                <p className="font-medium">{plan.maxAthletes || "∞"}</p>
                                <p className="text-muted-foreground">Athletes</p>
                              </div>
                              <div>
                                <UserPlus className="h-3.5 w-3.5 mx-auto mb-0.5 text-muted-foreground" />
                                <p className="font-medium">{plan.maxUsers || "∞"}</p>
                                <p className="text-muted-foreground">Users</p>
                              </div>
                              <div>
                                <BookOpen className="h-3.5 w-3.5 mx-auto mb-0.5 text-muted-foreground" />
                                <p className="font-medium">{plan.maxPrograms || "∞"}</p>
                                <p className="text-muted-foreground">Programs</p>
                              </div>
                              <div>
                                <Calendar className="h-3.5 w-3.5 mx-auto mb-0.5 text-muted-foreground" />
                                <p className="font-medium">{plan.maxEvents || "∞"}</p>
                                <p className="text-muted-foreground">Events</p>
                              </div>
                            </div>

                            <div className="grid grid-cols-4 gap-1 text-center text-xs mb-3 pb-3 border-b">
                              <div>
                                <MessageSquare className="h-3.5 w-3.5 mx-auto mb-0.5 text-muted-foreground" />
                                <p className="font-medium">{plan.smsIncluded || "—"}</p>
                                <p className="text-muted-foreground">SMS/mo</p>
                              </div>
                              <div>
                                <Mail className="h-3.5 w-3.5 mx-auto mb-0.5 text-muted-foreground" />
                                <p className="font-medium">{plan.emailIncluded || "—"}</p>
                                <p className="text-muted-foreground">Email/mo</p>
                              </div>
                              <div>
                                <HardDrive className="h-3.5 w-3.5 mx-auto mb-0.5 text-muted-foreground" />
                                <p className="font-medium">
                                  {plan.maxStorageMB
                                    ? plan.maxStorageMB >= 1000
                                      ? `${plan.maxStorageMB / 1000}GB`
                                      : `${plan.maxStorageMB}MB`
                                    : "∞"}
                                </p>
                                <p className="text-muted-foreground">Storage</p>
                              </div>
                              <div>
                                <Tag className="h-3.5 w-3.5 mx-auto mb-0.5 text-muted-foreground" />
                                <p className="font-medium">{plan.maxMembershipTypes || "∞"}</p>
                                <p className="text-muted-foreground">Memberships</p>
                              </div>
                            </div>

                            <ul className="space-y-1.5 text-sm">
                              {plan.features.slice(0, 4).map((feature, i) => (
                                <li key={i} className="flex items-start gap-2">
                                  <Check className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                                  <span className="text-muted-foreground">{feature}</span>
                                </li>
                              ))}
                              {plan.features.length > 4 && (
                                <li className="text-xs text-muted-foreground pl-6">
                                  +{plan.features.length - 4} more features
                                </li>
                              )}
                            </ul>
                          </div>
                        ))}
                      </div>
                      <div className="mt-4 text-center">
                        <PlansComparisonDialog
                          plans={plans}
                          selectedPlanId={selectedPlan ?? ""}
                          onSelectPlan={(planId) => {
                            setSelectedPlan(planId);
                            setFormData((prev) => ({ ...prev, planId }));
                            if (errors.planId) setErrors((prev) => ({ ...prev, planId: "" }));
                          }}
                        >
                          <Button type="button" variant="link" className="text-sm text-primary">
                            Compare all plans in detail
                          </Button>
                        </PlansComparisonDialog>
                      </div>
                    </>
                  )}
                  {errors.planId && (
                    <p className="text-sm text-destructive mt-2">{errors.planId}</p>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Navigation Buttons */}
            {(() => {
              const isAccountStep = currentStepId === "account";
              const isChoosingOrMidVerification =
                isAccountStep &&
                (signupMode === "choosing" ||
                  emailVerification === "sent" ||
                  emailVerification === "verifying" ||
                  emailVerification === "exists");

              if (isChoosingOrMidVerification) return null;

              return (
                <div className="flex items-center justify-between">
                  <div>
                    {!stepper.state.isFirst && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          if (currentStepId === "plan") {
                            sessionStorage.removeItem("org-signup-data");
                          }
                          stepper.navigation.prev();
                        }}
                      >
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back
                      </Button>
                    )}
                  </div>

                  <div>
                    {isAccountStep && useExistingAccount ? (
                      <Button type="button" onClick={() => stepper.navigation.next()}>
                        Next
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    ) : isAccountStep &&
                      (emailVerification === "idle" || emailVerification === "sending") ? (
                      <Button
                        type="button"
                        onClick={handleSendVerificationCode}
                        disabled={emailVerification === "sending"}
                      >
                        {emailVerification === "sending" ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : null}
                        Continue
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    ) : stepper.state.isLast ? (
                      (() => {
                        const chosenPlan = plans.find((p) => p.id === selectedPlan);
                        const isPaidPlan = chosenPlan && Number(chosenPlan.monthlyPrice) > 0;
                        return (
                          <Button
                            type="button"
                            size="lg"
                            onClick={handlePlanContinue}
                            disabled={
                              isLoading ||
                              subdomainStatus === "checking" ||
                              orgNameStatus === "checking"
                            }
                            className="min-w-[200px]"
                          >
                            {isLoading ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                {isPaidPlan ? "Proceeding to Payment..." : "Continuing..."}
                              </>
                            ) : isPaidPlan ? (
                              <>
                                <CreditCard className="mr-2 h-4 w-4" />
                                Continue to Payment
                              </>
                            ) : (
                              "Review Organization"
                            )}
                          </Button>
                        );
                      })()
                    ) : (
                      <Button type="button" onClick={handleNext}>
                        Next
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })()}

            {stepper.state.isLast && (
              <p className="text-center text-sm text-muted-foreground">
                By {useExistingAccount ? "creating this organization" : "creating an account"}, you
                agree to our{" "}
                <a href="#" className="underline hover:text-foreground">
                  Terms of Service
                </a>{" "}
                and{" "}
                <a href="#" className="underline hover:text-foreground">
                  Privacy Policy
                </a>
                .
              </p>
            )}
          </fieldset>
        </form>
      </div>
    </TooltipProvider>
  );
}
