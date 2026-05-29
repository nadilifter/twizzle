"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ShineBorder } from "@/components/ui/shine-border";
import { ChevronLeft, Loader2, Mail } from "lucide-react";
import { AnimatedCheckmark } from "@/components/ui/animated-checkmark";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { UplifterLogo } from "@/components/uplifter-logo";
import { toast } from "sonner";

export function ForgotPasswordForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState(searchParams.get("email") || "");
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.toLowerCase().trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 429) {
          setError(data.message || "Too many requests. Please try again later.");
          toast.error(data.message || "Too many requests. Please try again later.");
        } else {
          setError(data.error || "An error occurred. Please try again.");
          toast.error(data.error || "An error occurred. Please try again.");
        }
        return;
      }

      setIsSuccess(true);
    } catch {
      setError("An error occurred. Please try again.");
      toast.error("An error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Success state - show confirmation message
  if (isSuccess) {
    return (
      <Card className="relative overflow-hidden w-full max-w-[400px]">
        <ShineBorder shineColor={["#5655ED", "#A07CFE"]} className="text-center" />
        <CardHeader className="items-center pb-2">
          <UplifterLogo width={180} height={36} className="h-9 mb-2" />
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 mb-4">
            <AnimatedCheckmark size={24} className="text-green-600 dark:text-green-400" />
          </div>
          <h1 className="text-2xl font-bold">Check Your Email</h1>
          <p className="text-sm text-muted-foreground">
            We&apos;ve sent password reset instructions to your email address.
          </p>
        </CardHeader>

        <CardContent className="grid gap-4">
          <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50">
            <Mail className="h-5 w-5 text-muted-foreground flex-shrink-0" />
            <div className="text-sm text-left">
              <p className="font-medium">{email}</p>
              <p className="text-muted-foreground">
                If an account exists, you&apos;ll receive an email shortly.
              </p>
            </div>
          </div>
          <p className="text-xs text-center text-muted-foreground">
            Didn&apos;t receive an email? Check your spam folder or{" "}
            <button
              type="button"
              onClick={() => setIsSuccess(false)}
              className="text-primary hover:underline"
            >
              try again
            </button>
          </p>
          <div className="text-center text-sm">
            <Link
              href={`/login?email=${encodeURIComponent(email)}`}
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

  return (
    <Card className="relative overflow-hidden w-full max-w-[400px]">
      <ShineBorder shineColor={["#5655ED", "#A07CFE"]} className="text-center" />
      <CardHeader className="items-center pb-2">
        <UplifterLogo width={180} height={36} className="h-9 mb-2" />
        <h1 className="text-2xl font-bold">Forgot Password</h1>
        <p className="text-sm text-muted-foreground">Enter your email to reset your password</p>
      </CardHeader>

      <CardContent className="grid gap-4">
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-2 text-left">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="m@example.com"
              required
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (error) setError(null);
              }}
              disabled={isLoading}
            />
          </div>
          {error && (
            <div className="rounded-md bg-destructive/15 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}
          <Button type="submit" className="w-full" disabled={isLoading || !email.trim()}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              "Send Reset Link"
            )}
          </Button>
        </form>
        <div className="text-center text-sm">
          <Link
            href={`/login?email=${encodeURIComponent(email)}`}
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
