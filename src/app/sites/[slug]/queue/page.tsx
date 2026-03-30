"use client";

import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Loader2, Clock, Users, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { useQueue } from "@/components/sites/queue-context";

export default function QueuePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const programId = searchParams.get("programId");
  const returnUrl = searchParams.get("returnUrl") || "/register";
  const hasEnteredRef = useRef(false);

  const {
    sessionToken,
    isInQueue,
    canProceed,
    queueStatus,
    position,
    totalWaiting,
    estimatedWaitMinutes,
    reservation,
    remainingSeconds,
    isEntering,
    error,
    enterQueue,
    abandonQueue,
  } = useQueue();

  useEffect(() => {
    if (hasEnteredRef.current) return;
    hasEnteredRef.current = true;

    if (!sessionToken) {
      enterQueue(programId);
    }
  }, [sessionToken, programId, enterQueue]);

  useEffect(() => {
    if (canProceed) {
      router.push(returnUrl);
    }
  }, [canProceed, router, returnUrl]);

  if (isEntering) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Checking queue status...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 p-3 bg-destructive/10 rounded-full w-fit">
              <AlertCircle className="h-8 w-8 text-destructive" />
            </div>
            <CardTitle>Error</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Button onClick={() => router.push("/")}>Return to Home</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!isInQueue && !canProceed && !reservation) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (queueStatus === "ADMITTED" && reservation) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 p-3 bg-green-100 dark:bg-green-900/20 rounded-full w-fit">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <CardTitle>You&apos;re In!</CardTitle>
            <CardDescription>Your spot is reserved. Please complete registration.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="text-center">
              <div className="text-4xl font-bold mb-1">
                {Math.floor(remainingSeconds / 60)}:{String(remainingSeconds % 60).padStart(2, "0")}
              </div>
              <p className="text-sm text-muted-foreground">remaining to complete registration</p>
            </div>
            <Button className="w-full" size="lg" onClick={() => router.push(returnUrl)}>
              Continue to Registration
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 p-3 bg-primary/10 rounded-full w-fit">
            <Users className="h-8 w-8 text-primary" />
          </div>
          <CardTitle>You&apos;re in the Queue</CardTitle>
          <CardDescription>
            Please wait while we prepare your spot. Do not close this page.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="text-center">
            <div className="text-6xl font-bold text-primary mb-2">#{position}</div>
            <p className="text-muted-foreground">Your position in line</p>
          </div>

          {totalWaiting && (
            <div className="space-y-2">
              <Progress value={((totalWaiting - (position || 0)) / totalWaiting) * 100} />
              <p className="text-xs text-center text-muted-foreground">
                {totalWaiting} people waiting
              </p>
            </div>
          )}

          {estimatedWaitMinutes != null && (
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>
                Estimated wait: ~{estimatedWaitMinutes} minute
                {estimatedWaitMinutes !== 1 ? "s" : ""}
              </span>
            </div>
          )}

          <div className="bg-muted/50 rounded-lg p-4 text-sm text-center">
            <p>
              When it&apos;s your turn, you&apos;ll have <strong>10 minutes</strong> to complete
              your registration.
            </p>
          </div>

          <Button
            variant="outline"
            className="w-full"
            onClick={() => {
              abandonQueue();
              router.push("/");
            }}
          >
            <XCircle className="h-4 w-4 mr-2" />
            Leave Queue
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            <Loader2 className="h-3 w-3 inline animate-spin mr-1" />
            Updating automatically...
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
