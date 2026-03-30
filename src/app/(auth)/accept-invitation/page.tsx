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

interface SessionInfo {
  email: string | null;
  isLoggedIn: boolean;
}

function AcceptInvitationContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");

  const [invitationData, setInvitationData] = useState<InvitationData | null>(null);
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Fetch invitation data and session info on mount
  useEffect(() => {
    if (!token) {
      setIsLoading(false);
      setError("No invitation token provided");
      return;
    }

    async function fetchData() {
      try {
        // Fetch invitation and session in parallel
        const [invitationRes, sessionRes] = await Promise.all([
          fetch(`/api/invitations/${token}`),
          fetch("/api/auth/session"),
        ]);

        const invitationData = await invitationRes.json();
        const sessionData = await sessionRes.json();

        setInvitationData(invitationData);
        setSessionInfo({
          email: sessionData?.user?.email || null,
          isLoggedIn: !!sessionData?.user,
        });

        if (!invitationData.valid) {
          setError(invitationData.error || "Invalid invitation");
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
        setSuccess(true);
        toast.success(`Welcome to ${data.organizationName}!`);

        // Auto-login the user
        const signInResult = await signIn("credentials", {
          email: invitationData?.invitation?.email,
          password,
          redirect: false,
        });

        if (signInResult?.ok) {
          router.push("/dashboard");
          router.refresh();
        } else {
          // If auto-login fails, redirect to login page
          router.push(
            `/login?email=${encodeURIComponent(invitationData?.invitation?.email || "")}`
          );
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

  // Handle accepting invitation for existing users
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

        // In local development, we need to go through the credentials-bridge
        // to transfer the session to the correct cookie domain
        const isLocal = window.location.hostname.includes("localhost");
        if (isLocal) {
          const adminUrl = `http://admin.uplifterinc.localhost:3000/`;
          window.location.href = `/api/auth/credentials-bridge?callbackUrl=${encodeURIComponent(adminUrl)}`;
        } else {
          router.push("/dashboard");
          router.refresh();
        }
      } else if (data.requiresAuth) {
        // Redirect to login with callback
        router.push(data.redirectUrl);
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

  // Error state (invalid/expired token)
  if (!invitationData?.valid || error) {
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

  // Success state
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
          <p className="text-sm text-muted-foreground mt-2">Redirecting to dashboard...</p>
        </CardContent>
      </Card>
    );
  }

  const { invitation, user } = invitationData;

  // Existing user flow - accept invitation
  // Check if user is logged in (using fetched session info)
  const isLoggedIn = sessionInfo?.isLoggedIn ?? false;
  const isCorrectUser = sessionInfo?.email === invitation?.email;

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
          <p className="text-muted-foreground">
            <span className="font-medium">Role:</span> {invitation?.role}
          </p>
        </div>

        {!isLoggedIn ? (
          // Not logged in - show login prompt
          <>
            <p className="text-sm text-center text-muted-foreground">
              Please log in to accept this invitation
            </p>
            <Button asChild className="w-full">
              <Link href={`/login?callbackUrl=/accept-invitation?token=${token}`}>
                Log In to Accept
              </Link>
            </Button>
          </>
        ) : !isCorrectUser ? (
          // Logged in as wrong user
          <>
            <div className="rounded-md bg-yellow-500/15 px-3 py-2 text-sm text-yellow-700 dark:text-yellow-400">
              You&apos;re logged in as {sessionInfo?.email}, but this invitation was sent to{" "}
              {invitation?.email}.
            </div>
            <Button asChild variant="outline" className="w-full">
              <Link href={`/login?callbackUrl=/accept-invitation?token=${token}`}>
                Log In with {invitation?.email}
              </Link>
            </Button>
          </>
        ) : (
          // Logged in as correct user - show accept button
          <>
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
          </>
        )}

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
