"use client";

import { useState, useCallback, useEffect } from "react";
import dynamic from "next/dynamic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle2, XCircle, AlertCircle, Search, Loader2, ScanLine } from "lucide-react";
import Link from "next/link";
import { parseQRPayload } from "@/components/events/qr-code-generator";

const QRScanner = dynamic(() => import("@/components/events/qr-scanner"), {
  ssr: false,
  loading: () => <Skeleton className="h-[300px] w-[300px]" />,
});
import { useAttendance } from "@/hooks/use-attendance";
import { athleteDisplayName } from "@/lib/athlete-name";
import { format } from "date-fns";

interface ScanResult {
  status: "success" | "error" | "warning";
  message: string;
  athleteName?: string;
  eventTitle?: string;
  checkedInAt?: string;
}

export default function ScanPage() {
  const [lastResult, setLastResult] = useState<ScanResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const { markAttendance } = useAttendance();

  // Clear result after 5 seconds
  useEffect(() => {
    if (lastResult) {
      const timer = setTimeout(() => {
        setLastResult(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [lastResult]);

  const handleScan = useCallback(
    async (data: string) => {
      if (isProcessing) return;

      setIsProcessing(true);

      try {
        const payload = parseQRPayload(data);

        if (!payload) {
          setLastResult({
            status: "error",
            message: "Invalid QR code format",
          });
          setIsProcessing(false);
          return;
        }

        // Check if QR code is too old (24 hours)
        const age = Date.now() - payload.timestamp;
        if (age > 24 * 60 * 60 * 1000) {
          setLastResult({
            status: "warning",
            message: "QR code has expired. Please generate a new one.",
          });
          setIsProcessing(false);
          return;
        }

        // If event ID is specified in QR, use it. Otherwise, we need to determine the event
        if (!payload.eventId) {
          setLastResult({
            status: "warning",
            message: "QR code missing event information. Use manual check-in.",
          });
          setIsProcessing(false);
          return;
        }

        // Mark attendance
        const result = await markAttendance({
          athleteId: payload.athleteId,
          eventId: payload.eventId,
          status: "PRESENT",
        });

        if (result) {
          setLastResult({
            status: "success",
            message: "Check-in successful!",
            athleteName: result.athlete
              ? athleteDisplayName(result.athlete) || "Athlete"
              : "Athlete",
            eventTitle: result.event?.title,
            checkedInAt: format(new Date(), "h:mm a"),
          });
        } else {
          setLastResult({
            status: "error",
            message: "Failed to process check-in",
          });
        }
      } catch (error) {
        console.error("Scan error:", error);
        setLastResult({
          status: "error",
          message: "An error occurred while processing the scan",
        });
      }

      setIsProcessing(false);
    },
    [isProcessing, markAttendance]
  );

  const handleError = useCallback((error: string) => {
    console.error("Scanner error:", error);
  }, []);

  return (
    <div className="p-4 md:p-6 lg:px-8 max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">QR Check-in</h1>
        <p className="text-muted-foreground mt-1">Scan athlete QR codes for quick check-in</p>
      </div>

      {/* Scanner Card */}
      <Card className="mb-6">
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2">
            <ScanLine className="h-5 w-5" />
            Scanner
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center">
          <QRScanner onScan={handleScan} onError={handleError} width={320} height={320} />
        </CardContent>
      </Card>

      {/* Result Display */}
      {isProcessing && (
        <Card className="mb-6 border-blue-200 bg-blue-50 dark:bg-blue-950 dark:border-blue-800">
          <CardContent className="p-6 flex items-center justify-center gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
            <span className="text-blue-800 dark:text-blue-200 font-medium">
              Processing check-in...
            </span>
          </CardContent>
        </Card>
      )}

      {lastResult && !isProcessing && (
        <Card
          className={`mb-6 ${
            lastResult.status === "success"
              ? "border-green-200 bg-green-50 dark:bg-green-950 dark:border-green-800"
              : lastResult.status === "warning"
                ? "border-yellow-200 bg-yellow-50 dark:bg-yellow-950 dark:border-yellow-800"
                : "border-red-200 bg-red-50 dark:bg-red-950 dark:border-red-800"
          }`}
        >
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div
                className={`rounded-full p-2 ${
                  lastResult.status === "success"
                    ? "bg-green-100 dark:bg-green-900"
                    : lastResult.status === "warning"
                      ? "bg-yellow-100 dark:bg-yellow-900"
                      : "bg-red-100 dark:bg-red-900"
                }`}
              >
                {lastResult.status === "success" ? (
                  <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
                ) : lastResult.status === "warning" ? (
                  <AlertCircle className="h-8 w-8 text-yellow-600 dark:text-yellow-400" />
                ) : (
                  <XCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
                )}
              </div>
              <div className="flex-1">
                <p
                  className={`font-semibold text-lg ${
                    lastResult.status === "success"
                      ? "text-green-800 dark:text-green-200"
                      : lastResult.status === "warning"
                        ? "text-yellow-800 dark:text-yellow-200"
                        : "text-red-800 dark:text-red-200"
                  }`}
                >
                  {lastResult.message}
                </p>
                {lastResult.athleteName && (
                  <div className="flex items-center gap-3 mt-3">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                        {lastResult.athleteName.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{lastResult.athleteName}</p>
                      {lastResult.eventTitle && (
                        <p className="text-sm text-muted-foreground">{lastResult.eventTitle}</p>
                      )}
                    </div>
                    {lastResult.checkedInAt && (
                      <Badge variant="outline" className="ml-auto">
                        {lastResult.checkedInAt}
                      </Badge>
                    )}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Manual Search Link */}
      <Card>
        <CardContent className="p-6 text-center">
          <p className="text-muted-foreground mb-4">
            Can&apos;t scan? Search for the athlete manually
          </p>
          <Button variant="outline" asChild className="gap-2">
            <Link href="/events/search">
              <Search className="h-4 w-4" />
              Manual Search
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
