"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ShineBorder } from "@/components/ui/shine-border";
import { UplifterLogo } from "@/components/uplifter-logo";
import { Loader2, ChevronLeft, AlertCircle, CheckCircle2 } from "lucide-react";
import { signIn } from "next-auth/react";
import { toast } from "sonner";
import { validatePassword, PASSWORD_PLACEHOLDER, PASSWORD_MIN_LENGTH } from "@/lib/password";

interface InvitationData {
  valid: boolean;
  error?: string;
  errorCode?: string;
  invitation?: {
    id: string;
    email: string;
    organizationId: string;
    organizationName: string;
    role: string;
    inviterName: string;
    expiresAt: string;
  };
  user?: {
    exists: boolean;
    name: string | null;
    email: string;
    needsPassword: boolean;
  };
}

function AcceptInvitationContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");

  const [invitationData, setInvitationData] = useState<InvitationData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [autoLoginFailed, setAutoLoginFailed] = useState(false);

  useEffect(() => {
    if (!token) {
      setIsLoading(false);
      setError("No invitation token provided");
      return;
    }

    async function fetchData() {
      try {
        const res = await fetch(`/api/invitations/${token}`);
        const data = await res.json();
        setInvitationData(data);

        if (!data.valid) {
          setError(data.error || "Invalid invitation");
        }
      } catch {
        setError("Failed to load invitation details");
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, [token]);

  // Handle form submission for new users (password setup)
  const handleNewUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const passwordError = validatePassword(password);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/invitations/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, confirmPassword }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success(`Welcome to ${data.organizationName}!`);

        const signInResult = await signIn("credentials", {
          email: invitationData?.invitation?.email,
          password,
          redirect: false,
        });

        if (signInResult?.ok) {
          setSuccess(true);
          router.push("/dashboard");
          router.refresh();
        } else {
          setAutoLoginFailed(true);
        }
      } else {
        setError(data.error || "Failed to accept invitation");
      }
    } catch {
      setError("An error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExistingUserAccept = async () => {
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/invitations/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(true);
        toast.success(data.message || `Welcome to ${data.organizationName}!`);

        setTimeout(() => {
          router.push(`/login?email=${encodeURIComponent(data.email || "")}`);
        }, 1500);
      } else {
        setError(data.error || "Failed to accept invitation");
      }
    } catch {
      setError("An error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <Card className="relative overflow-hidden w-full max-w-[400px]">
        <ShineBorder shineColor={["#5655ED", "#A07CFE"]} className="text-center" />
        <CardHeader className="items-center pb-2">
          <UplifterLogo width={180} height={36} className="h-9 mb-2" />
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="mt-4 text-muted-foreground">Loading invitation...</p>
        </CardContent>
      </Card>
    );
  }

  if (!invitationData?.valid) {
    return (
      <Card className="relative overflow-hidden w-full max-w-[400px]">
        <ShineBorder shineColor={["#5655ED", "#A07CFE"]} className="text-center" />
        <CardHeader className="items-center pb-2">
          <UplifterLogo width={180} height={36} className="h-9 mb-2" />
          <AlertCircle className="h-12 w-12 text-destructive mt-4" />
          <h1 className="text-2xl font-bold mt-4">Invitation Error</h1>
        </CardHeader>
        <CardContent className="grid gap-4">
          <p className="text-center text-muted-foreground">
            {error || invitationData?.error || "This invitation is invalid or has expired."}
          </p>
          {invitationData?.errorCode === "ALREADY_ACCEPTED" && (
            <Button asChild className="w-full">
              <Link href="/login">Go to Login</Link>
            </Button>
          )}
          {invitationData?.errorCode !== "ALREADY_ACCEPTED" && (
            <p className="text-center text-sm text-muted-foreground">
              Please contact the administrator for a new invitation.
            </p>
          )}
          <div className="text-center text-sm">
            <Link
              href="/login"
              className="flex items-center justify-center gap-2 text-muted-foreground hover:text-primary"
            >
              <ChevronLeft className="h-4 w-4" />
              Back to Login
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (autoLoginFailed) {
    return (
      <Card className="relative overflow-hidden w-full max-w-[400px]">
        <ShineBorder shineColor={["#5655ED", "#A07CFE"]} className="text-center" />
        <CardHeader className="items-center pb-2">
          <UplifterLogo width={180} height={36} className="h-9 mb-2" />
          <CheckCircle2 className="h-12 w-12 text-green-500 mt-4" />
          <h1 className="text-2xl font-bold mt-4">Account Created!</h1>
        </CardHeader>
        <CardContent className="grid gap-4">
          <p className="text-center text-muted-foreground">
            Your account for {invitationData.invitation?.organizationName} is ready. Log in with the
            password you just set to get started.
          </p>
          <Button asChild className="w-full">
            <Link
              href={`/login?email=${encodeURIComponent(invitationData.invitation?.email || "")}`}
            >
              Go to Login
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (success) {
    return (
      <Card className="relative overflow-hidden w-full max-w-[400px]">
        <ShineBorder shineColor={["#5655ED", "#A07CFE"]} className="text-center" />
        <CardHeader className="items-center pb-2">
          <UplifterLogo width={180} height={36} className="h-9 mb-2" />
          <CheckCircle2 className="h-12 w-12 text-green-500 mt-4" />
          <h1 className="text-2xl font-bold mt-4">Welcome!</h1>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-4">
          <p className="text-center text-muted-foreground">
            You&apos;ve joined {invitationData.invitation?.organizationName}
          </p>
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mt-4" />
          <p className="text-sm text-muted-foreground mt-2">Redirecting...</p>
        </CardContent>
      </Card>
    );
  }

  const { invitation, user } = invitationData;

  // New user flow - password setup
  if (user?.needsPassword) {
    return (
      <Card className="relative overflow-hidden w-full max-w-[400px]">
        <ShineBorder shineColor={["#5655ED", "#A07CFE"]} className="text-center" />
        <CardHeader className="items-center pb-2">
          <UplifterLogo width={180} height={36} className="h-9 mb-2" />
          <h1 className="text-2xl font-bold">Set Up Your Account</h1>
          <p className="text-sm text-muted-foreground">
            You&apos;ve been invited to join <strong>{invitation?.organizationName}</strong>
          </p>
        </CardHeader>

        <CardContent className="grid gap-4">
          <form onSubmit={handleNewUserSubmit} className="grid gap-4">
            <div className="rounded-md bg-muted/50 px-3 py-2 text-sm">
              <p className="text-muted-foreground">
                <span className="font-medium">Email:</span> {invitation?.email}
              </p>
              <p className="text-muted-foreground">
                <span className="font-medium">Role:</span> {invitation?.role}
              </p>
              <p className="text-muted-foreground">
                <span className="font-medium">Invited by:</span> {invitation?.inviterName}
              </p>
            </div>

            <div className="grid gap-2 text-left">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                required
                minLength={PASSWORD_MIN_LENGTH}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError(null);
                }}
                placeholder={PASSWORD_PLACEHOLDER}
                disabled={isSubmitting}
              />
            </div>

            <div className="grid gap-2 text-left">
              <Label htmlFor="confirm-password">Confirm Password</Label>
              <Input
                id="confirm-password"
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  if (error) setError(null);
                }}
                disabled={isSubmitting}
              />
            </div>

            {error && (
              <div className="rounded-md bg-destructive/15 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating Account...
                </>
              ) : (
                "Create Account & Join"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="relative overflow-hidden w-full max-w-[400px]">
      <ShineBorder shineColor={["#5655ED", "#A07CFE"]} className="text-center" />
      <CardHeader className="items-center pb-2">
        <UplifterLogo width={180} height={36} className="h-9 mb-2" />
        <h1 className="text-2xl font-bold">Join {invitation?.organizationName}</h1>
        <p className="text-sm text-muted-foreground">
          {invitation?.inviterName} has invited you to join their organization
        </p>
      </CardHeader>

      <CardContent className="grid gap-4">
        <div className="rounded-md bg-muted/50 px-3 py-2 text-sm">
          <p className="text-muted-foreground">
            <span className="font-medium">Email:</span> {invitation?.email}
          </p>
        </div>

        {error && (
          <div className="rounded-md bg-destructive/15 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        <Button onClick={handleExistingUserAccept} className="w-full" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Joining...
            </>
          ) : (
            "Accept Invitation"
          )}
        </Button>

        <div className="text-center text-sm">
          <Link
            href="/"
            className="flex items-center justify-center gap-2 text-muted-foreground hover:text-primary"
          >
            <ChevronLeft className="h-4 w-4" />
            Back to Home
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

// Loading fallback for Suspense
function LoadingFallback() {
  return (
    <Card className="relative overflow-hidden w-full max-w-[400px]">
      <ShineBorder shineColor={["#5655ED", "#A07CFE"]} className="text-center" />
      <CardHeader className="items-center pb-2">
        <UplifterLogo width={180} height={36} className="h-9 mb-2" />
      </CardHeader>
      <CardContent className="flex flex-col items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="mt-4 text-muted-foreground">Loading invitation...</p>
      </CardContent>
    </Card>
  );
}

// Wrap in Suspense for useSearchParams
export default function AcceptInvitationPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <AcceptInvitationContent />
    </Suspense>
  );
}
