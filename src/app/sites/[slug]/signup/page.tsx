"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { Loader2, CheckCircle2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { validatePassword, PASSWORD_PLACEHOLDER, PASSWORD_MIN_LENGTH } from "@/lib/password";

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

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  // Fetch organization info on mount
  useEffect(() => {
    async function fetchOrgInfo() {
      try {
        // Use the checkout session endpoint's org lookup pattern
        const response = await fetch(`/api/sites/${slug}/info`);
        if (response.ok) {
          const data = await response.json();
          setOrgInfo({ name: data.organizationName, subdomain: slug });
        } else {
          // Fallback: just use the subdomain
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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (error) setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Client-side validation
    if (!formData.name.trim()) {
      setError("Name is required");
      return;
    }
    if (!formData.email.trim()) {
      setError("Email is required");
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

    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/sites/${slug}/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.code === "USER_EXISTS") {
          setError("An account with this email already exists. Please log in instead.");
        } else if (data.code === "UPLIFTER_EMAIL") {
          setError("Uplifter staff should sign in with Google instead.");
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
        // Redirect to dashboard or back to the site
        router.push("/");
        router.refresh();
      } else {
        // If auto-login fails, redirect to login page
        toast.info("Please log in with your new credentials.");
        router.push(`/login?email=${encodeURIComponent(formData.email)}`);
      }
    } catch {
      setError("An error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Loading state
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

  // Success state
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
              value={formData.name}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-input bg-background text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all placeholder:text-muted-foreground"
              placeholder="Your full name"
              disabled={isSubmitting}
              required
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium mb-1 text-foreground">
              Email
            </label>
            <input
              type="email"
              id="email"
              name="email"
              autoComplete="email"
              value={formData.email}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-input bg-background text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all placeholder:text-muted-foreground"
              placeholder="you@example.com"
              disabled={isSubmitting}
              required
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
              className="w-full px-3 py-2 border border-input bg-background text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all placeholder:text-muted-foreground"
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
              className="w-full px-3 py-2 border border-input bg-background text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all placeholder:text-muted-foreground"
              placeholder="Confirm your password"
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
            disabled={isSubmitting}
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
