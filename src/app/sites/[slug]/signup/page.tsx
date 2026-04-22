"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { Loader2, CheckCircle2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { validatePassword, PASSWORD_PLACEHOLDER, PASSWORD_MIN_LENGTH } from "@/lib/password";
import { SmsConsentCheckbox } from "@/components/sms-consent-checkbox";
import { isValidPhoneNumber } from "libphonenumber-js";
import { PhoneInput } from "@/components/ui/phone-input";

type SignupStep = "email" | "verify" | "details";

interface OrganizationInfo {
  name: string;
  subdomain: string;
}

export default function MarketingSiteSignupPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const [orgInfo, setOrgInfo] = useState<OrganizationInfo | null>(null);
  const [isLoadingOrg, setIsLoadingOrg] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<SignupStep>("email");
  const [verificationCode, setVerificationCode] = useState("");
  const [verificationToken, setVerificationToken] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [smsConsent, setSmsConsent] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
  });

  // Fetch organization info on mount
  useEffect(() => {
    async function fetchOrgInfo() {
      try {
        const response = await fetch(`/api/sites/${slug}/info`);
        if (response.ok) {
          const data = await response.json();
          setOrgInfo({ name: data.organizationName, subdomain: slug });
        } else {
          setOrgInfo({ name: slug, subdomain: slug });
        }
      } catch {
        setOrgInfo({ name: slug, subdomain: slug });
      } finally {
        setIsLoadingOrg(false);
      }
    }
    fetchOrgInfo();
  }, [slug]);

  const startResendCooldown = useCallback(() => {
    setResendCooldown(30);
    if (cooldownRef.current) clearInterval(cooldownRef.current);
    cooldownRef.current = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(cooldownRef.current!);
          cooldownRef.current = null;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  useEffect(() => {
    return () => {
      if (cooldownRef.current) clearInterval(cooldownRef.current);
    };
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (error) setError(null);
  };

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/org-signup/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: formData.email }),
      });

      if (res.status === 429) {
        const data = await res.json();
        setError(data.message || "Too many attempts. Please wait and try again.");
        return;
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data.code === "UPLIFTER_EMAIL") {
          setError("UPLIFTER_EMAIL");
        } else {
          setError("Failed to send verification code. Please try again.");
        }
        return;
      }

      setStep("verify");
      startResendCooldown();
      toast.success("Verification code sent to your email.");
    } catch {
      setError("An error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/org-signup/verify-email/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: formData.email, code: verificationCode }),
      });

      if (res.status === 429) {
        const data = await res.json();
        setError(data.message || "Too many attempts. Please wait and try again.");
        return;
      }

      const data = await res.json();

      if (!res.ok || !data.verified) {
        setError("Invalid or expired code. Please try again.");
        return;
      }

      setVerificationToken(data.proofToken);
      setStep("details");
    } catch {
      setError("An error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendCode = async () => {
    setError(null);
    setIsSubmitting(true);
    setVerificationCode("");

    try {
      const res = await fetch("/api/org-signup/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: formData.email }),
      });

      if (res.ok) {
        startResendCooldown();
        toast.success("A new verification code has been sent to your email.");
      } else if (res.status === 429) {
        const data = await res.json();
        setError(data.message || "Too many attempts. Please wait and try again.");
      } else {
        setError("Failed to resend code. Please try again.");
      }
    } catch {
      setError("An error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.name.trim()) {
      setError("Name is required");
      return;
    }
    if (!formData.phone) {
      setError("Phone number is required");
      return;
    }
    if (!isValidPhoneNumber(formData.phone)) {
      setError("Please enter a valid phone number");
      return;
    }
    const pwError = validatePassword(formData.password);
    if (pwError) {
      setError(pwError);
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (!acceptedTerms) {
      setError("You must accept the terms and conditions to continue.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/sites/${slug}/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          password: formData.password,
          confirmPassword: formData.confirmPassword,
          verificationToken,
          acceptedTerms,
          smsConsent,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.code === "USER_EXISTS") {
          setError("An account with this email already exists. Please log in instead.");
        } else if (data.code === "UPLIFTER_EMAIL") {
          setError("Uplifter staff should sign in with Google instead.");
        } else if (data.code === "EMAIL_NOT_VERIFIED") {
          setStep("email");
          setVerificationToken("");
          setError("Your email verification expired. Please verify again.");
        } else {
          setError(data.error || "Failed to create account");
        }
        return;
      }

      setSuccess(true);
      toast.success(`Welcome to ${data.organizationName}!`);

      // Auto-login the user
      const signInResult = await signIn("credentials", {
        email: formData.email,
        password: formData.password,
        redirect: false,
      });

      if (signInResult?.ok) {
        router.push("/");
        router.refresh();
      } else {
        toast.info("Please log in with your new credentials.");
        router.push(`/login?email=${encodeURIComponent(formData.email)}`);
      }
    } catch {
      setError("An error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoadingOrg) {
    return (
      <div className="container mx-auto px-4 py-12 max-w-md">
        <div className="flex flex-col items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="container mx-auto px-4 py-12 max-w-md">
        <div className="bg-card p-8 rounded-xl shadow-sm border border-border text-center">
          <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Account Created!</h1>
          <p className="text-muted-foreground mb-4">
            Welcome to {orgInfo?.name}. Redirecting you now...
          </p>
          <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
        </div>
      </div>
    );
  }

  const inputClass =
    "w-full px-3 py-2 border border-input bg-background text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all placeholder:text-muted-foreground";

  // ── Step 1: Email entry ───────────────────────────────────────────────
  if (step === "email") {
    return (
      <div className="container mx-auto px-4 py-12 max-w-md">
        <div className="bg-card p-8 rounded-xl shadow-sm border border-border">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-primary/10 text-primary rounded-full mb-4">
              <UserPlus className="h-6 w-6" />
            </div>
            <h1 className="text-2xl font-bold">Create Your Account</h1>
            <p className="text-muted-foreground mt-2">
              Join <span className="font-medium text-foreground">{orgInfo?.name}</span>
            </p>
          </div>

          <form onSubmit={handleSendCode} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-1 text-foreground">
                Email
              </label>
              <input
                type="email"
                id="email"
                name="email"
                autoComplete="email"
                autoFocus
                value={formData.email}
                onChange={handleInputChange}
                className={inputClass}
                placeholder="you@example.com"
                disabled={isSubmitting}
                required
              />
            </div>

            {error && (
              <div className="rounded-md bg-destructive/15 px-3 py-2 text-sm text-destructive">
                {error === "UPLIFTER_EMAIL" ? (
                  <>
                    Uplifter staff cannot sign up here. Please use the{" "}
                    <Link href="/login" className="underline font-medium">
                      login page
                    </Link>{" "}
                    to sign in with Microsoft.
                  </>
                ) : (
                  error
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting || !formData.email}
              className="w-full bg-primary text-primary-foreground py-3 rounded-md hover:bg-primary/90 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                "Send verification code"
              )}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="text-primary hover:underline font-medium">
              Log in
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── Step 2: Verify email code ─────────────────────────────────────────
  if (step === "verify") {
    return (
      <div className="container mx-auto px-4 py-12 max-w-md">
        <div className="bg-card p-8 rounded-xl shadow-sm border border-border">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-primary/10 text-primary rounded-full mb-4">
              <UserPlus className="h-6 w-6" />
            </div>
            <h1 className="text-2xl font-bold">Check your email</h1>
            <p className="text-muted-foreground mt-2">
              Enter the verification code sent to{" "}
              <span className="font-medium text-foreground">{formData.email}</span>
            </p>
          </div>

          <form onSubmit={handleVerifyCode} className="space-y-4">
            <div>
              <label
                htmlFor="verification-code"
                className="block text-sm font-medium mb-1 text-foreground"
              >
                Verification Code
              </label>
              <input
                type="text"
                id="verification-code"
                autoFocus
                autoComplete="one-time-code"
                placeholder="e.g. A3K9X2"
                maxLength={6}
                className="w-full px-3 py-2 text-center text-lg tracking-widest font-mono uppercase border border-input bg-background text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all placeholder:text-muted-foreground"
                value={verificationCode}
                onChange={(e) => {
                  setVerificationCode(e.target.value.toUpperCase());
                  if (error) setError(null);
                }}
                disabled={isSubmitting}
                required
              />
            </div>

            {error && (
              <div className="rounded-md bg-destructive/15 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting || verificationCode.length < 6}
              className="w-full bg-primary text-primary-foreground py-3 rounded-md hover:bg-primary/90 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                "Verify email"
              )}
            </button>

            <div className="flex items-center justify-between text-sm">
              <button
                type="button"
                className="text-muted-foreground underline underline-offset-4 hover:text-foreground disabled:no-underline disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={handleResendCode}
                disabled={isSubmitting || resendCooldown > 0}
              >
                {resendCooldown > 0 ? `Resend code (${resendCooldown}s)` : "Resend code"}
              </button>
              <button
                type="button"
                className="text-muted-foreground underline underline-offset-4 hover:text-foreground"
                onClick={() => {
                  setStep("email");
                  setVerificationCode("");
                  setError(null);
                }}
                disabled={isSubmitting}
              >
                Change email
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // ── Step 3: Complete profile ──────────────────────────────────────────
  return (
    <div className="container mx-auto px-4 py-12 max-w-md">
      <div className="bg-card p-8 rounded-xl shadow-sm border border-border">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-primary/10 text-primary rounded-full mb-4">
            <UserPlus className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold">Complete your account</h1>
          <p className="text-muted-foreground mt-2">
            Signing up as <span className="font-medium text-foreground">{formData.email}</span>
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium mb-1 text-foreground">
              Full Name
            </label>
            <input
              type="text"
              id="name"
              name="name"
              autoComplete="name"
              autoFocus
              value={formData.name}
              onChange={handleInputChange}
              className={inputClass}
              placeholder="Your full name"
              disabled={isSubmitting}
              required
            />
          </div>

          <div>
            <label htmlFor="phone" className="block text-sm font-medium mb-1 text-foreground">
              Phone Number
            </label>
            <PhoneInput
              id="phone"
              defaultCountry="US"
              value={formData.phone}
              onChange={(value) => {
                setFormData((prev) => ({ ...prev, phone: value || "" }));
                if (error) setError(null);
              }}
              disabled={isSubmitting}
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium mb-1 text-foreground">
              Password
            </label>
            <input
              type="password"
              id="password"
              name="password"
              autoComplete="new-password"
              value={formData.password}
              onChange={handleInputChange}
              className={inputClass}
              placeholder={PASSWORD_PLACEHOLDER}
              disabled={isSubmitting}
              required
              minLength={PASSWORD_MIN_LENGTH}
            />
          </div>

          <div>
            <label
              htmlFor="confirmPassword"
              className="block text-sm font-medium mb-1 text-foreground"
            >
              Confirm Password
            </label>
            <input
              type="password"
              id="confirmPassword"
              name="confirmPassword"
              autoComplete="new-password"
              value={formData.confirmPassword}
              onChange={handleInputChange}
              className={inputClass}
              placeholder="Confirm your password"
              disabled={isSubmitting}
              required
            />
          </div>

          <div className="flex items-start gap-3 pt-1">
            <input
              type="checkbox"
              id="acceptTerms"
              checked={acceptedTerms}
              onChange={(e) => {
                setAcceptedTerms(e.target.checked);
                if (error) setError(null);
              }}
              disabled={isSubmitting}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border border-input accent-primary cursor-pointer"
            />
            <label
              htmlFor="acceptTerms"
              className="text-sm text-muted-foreground leading-snug cursor-pointer"
            >
              I confirm I am 18 years of age or older and I agree to the{" "}
              <a
                href="https://www.uplifterinc.com/terms-of-service"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline font-medium"
              >
                Terms of Service
              </a>{" "}
              and{" "}
              <a
                href="https://www.uplifterinc.com/privacy-policy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline font-medium"
              >
                Privacy Policy
              </a>
            </label>
          </div>

          {/*
            Standalone SMS consent checkbox. Twilio TFV (30475) requires this
            be visually and structurally separate from the Terms checkbox above
            and not gate form submission. Do NOT bundle into the same <label>.
          */}
          <SmsConsentCheckbox
            checked={smsConsent}
            onChange={setSmsConsent}
            disabled={isSubmitting}
          />

          {error && (
            <div className="rounded-md bg-destructive/15 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting || !acceptedTerms}
            className="w-full bg-primary text-primary-foreground py-3 rounded-md hover:bg-primary/90 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Creating Account...
              </>
            ) : (
              "Create Account"
            )}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="text-primary hover:underline font-medium">
            Log in
          </Link>
        </div>
      </div>
    </div>
  );
}
