"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Shield, Check, X, User, Clock } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface ClaimRequest {
  id: string;
  status: string;
  relationship: string | null;
  createdAt: string;
  athlete: {
    id: string;
    firstName: string;
    lastName: string;
  };
  requestingUser: {
    id: string;
    name: string;
    email: string;
  };
}

export default function GuardianRequestsPage() {
  const [claims, setClaims] = useState<ClaimRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    fetchClaims();
  }, []);

  const fetchClaims = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/guardian-claims");
      if (res.ok) {
        const data = await res.json();
        setClaims(data.claims || []);
      }
    } catch (error) {
      console.error("Error fetching claims:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAction = async (claimId: string, action: "approve" | "deny") => {
    setProcessingId(claimId);
    try {
      const res = await fetch(`/api/guardian-claims/${claimId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      if (res.ok) {
        toast.success(action === "approve" ? "Guardian request approved" : "Guardian request denied");
        setClaims((prev) => prev.filter((c) => c.id !== claimId));
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to process request");
      }
    } catch {
      toast.error("Failed to process request");
    } finally {
      setProcessingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Guardian Requests</h1>
        {claims.length > 0 && (
          <Badge variant="secondary">{claims.length} pending</Badge>
        )}
      </div>

      {claims.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Shield className="w-12 h-12 mx-auto mb-3 text-muted-foreground/40" />
            <h3 className="font-semibold text-lg mb-1">No pending requests</h3>
            <p className="text-sm text-muted-foreground">
              When someone requests to be added as a guardian of one of your athletes, it will appear here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {claims.map((claim) => {
            const athleteName = `${claim.athlete.firstName} ${claim.athlete.lastName}`.trim();
            const isProcessing = processingId === claim.id;

            return (
              <Card key={claim.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
                        <User className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">
                          <span className="font-semibold">{claim.requestingUser.name}</span>{" "}
                          wants to be a guardian of{" "}
                          <span className="font-semibold">{athleteName}</span>
                        </p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                          <span>{claim.requestingUser.email}</span>
                          {claim.relationship && (
                            <>
                              <span>·</span>
                              <span>{claim.relationship}</span>
                            </>
                          )}
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                          <Clock className="w-3 h-3" />
                          {format(new Date(claim.createdAt), "MMM d, yyyy 'at' h:mm a")}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleAction(claim.id, "deny")}
                        disabled={isProcessing}
                        className="gap-1"
                      >
                        <X className="w-3.5 h-3.5" />
                        Deny
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleAction(claim.id, "approve")}
                        disabled={isProcessing}
                        className="gap-1"
                      >
                        <Check className="w-3.5 h-3.5" />
                        Approve
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
