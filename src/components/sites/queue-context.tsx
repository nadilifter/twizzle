"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface QueueReservation {
  id: string;
  expiresAt: string;
  remainingSeconds: number;
  programId: string;
}

interface QueueContextValue {
  sessionToken: string | null;
  isInQueue: boolean;
  hasReservation: boolean;
  reservation: QueueReservation | null;
  remainingSeconds: number;
  position: number | null;
  totalWaiting: number | null;
  estimatedWaitMinutes: number | null;
  queueStatus: string | null;
  canProceed: boolean;
  isEntering: boolean;
  error: string | null;
  enterQueue: (programId?: string | null) => Promise<void>;
  checkQueueStatus: () => Promise<void>;
  completeRegistration: () => Promise<void>;
  abandonQueue: () => Promise<void>;
}

const QueueContext = createContext<QueueContextValue | null>(null);

export function useQueue() {
  const context = useContext(QueueContext);
  if (!context) {
    throw new Error("useQueue must be used within a QueueProvider");
  }
  return context;
}

interface QueueProviderProps {
  children: ReactNode;
  organizationSlug: string;
}

export function QueueProvider({ children, organizationSlug }: QueueProviderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [isInQueue, setIsInQueue] = useState(false);
  const [reservation, setReservation] = useState<QueueReservation | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [showBlockingModal, setShowBlockingModal] = useState(false);
  const [position, setPosition] = useState<number | null>(null);
  const [totalWaiting, setTotalWaiting] = useState<number | null>(null);
  const [estimatedWaitMinutes, setEstimatedWaitMinutes] = useState<number | null>(null);
  const [queueStatus, setQueueStatus] = useState<string | null>(null);
  const [canProceed, setCanProceed] = useState(false);
  const [isEntering, setIsEntering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(`queue_session_${organizationSlug}`);
    if (stored) {
      setSessionToken(stored);
    }
  }, [organizationSlug]);

  const checkQueueStatus = useCallback(async () => {
    if (!sessionToken) return;

    try {
      const response = await fetch(`/api/queue/status?sessionToken=${sessionToken}`);
      const data = await response.json();

      setIsInQueue(data.inQueue);
      setCanProceed(!!data.canProceed);
      setPosition(data.position ?? null);
      setTotalWaiting(data.totalWaiting ?? null);
      setEstimatedWaitMinutes(data.estimatedWaitMinutes ?? null);
      setQueueStatus(data.status ?? null);

      if (data.reservation) {
        setReservation(data.reservation);
        setRemainingSeconds(data.reservation.remainingSeconds);
      } else {
        setReservation(null);
      }

      if (data.inQueue && !data.canProceed && !pathname.includes("/queue")) {
        setShowBlockingModal(true);
      }
    } catch (err) {
      console.error("Error checking queue status:", err);
    }
  }, [sessionToken, pathname]);

  useEffect(() => {
    if (sessionToken) {
      checkQueueStatus();
      const interval = setInterval(checkQueueStatus, 5000);
      return () => clearInterval(interval);
    }
  }, [sessionToken, checkQueueStatus]);

  useEffect(() => {
    if (!reservation || remainingSeconds <= 0) return;

    const timer = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          setReservation(null);
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [reservation]);

  const enterQueue = useCallback(
    async (programId?: string | null) => {
      setIsEntering(true);
      setError(null);
      try {
        const stored = localStorage.getItem(`queue_session_${organizationSlug}`);
        const response = await fetch("/api/queue/enter", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            organizationSlug,
            programId,
            sessionToken: stored,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to enter queue");
        }

        if (data.sessionToken) {
          localStorage.setItem(`queue_session_${organizationSlug}`, data.sessionToken);
          setSessionToken(data.sessionToken);
        }

        setCanProceed(!!data.canProceed);

        if (data.canProceed) {
          if (data.reservation) {
            setReservation(data.reservation);
            setRemainingSeconds(data.reservation.remainingSeconds);
          }
          return;
        }

        setIsInQueue(true);
        setPosition(data.position ?? null);
        setEstimatedWaitMinutes(data.estimatedWaitMinutes ?? null);
        setQueueStatus(data.entry?.status || "WAITING");
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setIsEntering(false);
      }
    },
    [organizationSlug]
  );

  const completeRegistration = useCallback(async () => {
    if (!sessionToken) return;

    try {
      await fetch("/api/queue/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionToken }),
      });
      localStorage.removeItem(`queue_session_${organizationSlug}`);
      setSessionToken(null);
      setReservation(null);
      setIsInQueue(false);
    } catch (err) {
      console.error("Error completing registration:", err);
    }
  }, [sessionToken, organizationSlug]);

  const abandonQueue = useCallback(async () => {
    if (!sessionToken) return;

    try {
      await fetch("/api/queue/abandon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionToken }),
      });
      localStorage.removeItem(`queue_session_${organizationSlug}`);
      setSessionToken(null);
      setReservation(null);
      setIsInQueue(false);
      setCanProceed(false);
      setPosition(null);
      setTotalWaiting(null);
      setEstimatedWaitMinutes(null);
      setQueueStatus(null);
      setShowBlockingModal(false);
    } catch (err) {
      console.error("Error abandoning queue:", err);
    }
  }, [sessionToken, organizationSlug]);

  const handleReturnToQueue = () => {
    setShowBlockingModal(false);
    router.push("/queue");
  };

  return (
    <QueueContext.Provider
      value={{
        sessionToken,
        isInQueue,
        hasReservation: !!reservation,
        reservation,
        remainingSeconds,
        position,
        totalWaiting,
        estimatedWaitMinutes,
        queueStatus,
        canProceed,
        isEntering,
        error,
        enterQueue,
        checkQueueStatus,
        completeRegistration,
        abandonQueue,
      }}
    >
      {children}

      <Dialog open={showBlockingModal} onOpenChange={setShowBlockingModal}>
        <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <div className="mx-auto mb-4 p-3 bg-amber-100 dark:bg-amber-900/20 rounded-full w-fit">
              <AlertTriangle className="h-6 w-6 text-amber-600" />
            </div>
            <DialogTitle className="text-center">You&apos;re in the Queue</DialogTitle>
            <DialogDescription className="text-center">
              You&apos;re currently waiting in the registration queue. Navigating away may cause you
              to lose your spot.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 mt-4">
            <Button onClick={handleReturnToQueue}>Return to Queue</Button>
            <Button variant="outline" onClick={abandonQueue}>
              Leave Queue
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </QueueContext.Provider>
  );
}
