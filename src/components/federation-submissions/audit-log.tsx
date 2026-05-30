"use client";

import { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { FederationSubmissionEventType } from "@prisma/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";

interface EventActor {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
}

interface AuditEvent {
  id: string;
  eventType: FederationSubmissionEventType;
  data: unknown;
  note: string | null;
  actor: EventActor | null;
  createdAt: string;
}

const EVENT_LABELS: Record<FederationSubmissionEventType, string> = {
  CREATED: "Submission created",
  PAYLOAD_UPDATED: "Payload updated",
  ATHLETE_ADDED: "Athlete added",
  ATHLETE_REMOVED: "Athlete removed",
  STATUS_TRANSITIONED: "Status changed",
  EXTERNAL_REF_SET: "External reference set",
  RESOLUTION_NOTE_SET: "Resolution note set",
  NOTE_ADDED: "Note added",
};

function actorInitials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0] ?? "")
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

interface StatusData {
  previousStatus?: string;
  nextStatus?: string;
}

function EventEntry({ event }: { event: AuditEvent }) {
  const label = EVENT_LABELS[event.eventType] ?? event.eventType;
  const actorName = event.actor?.name ?? "System";
  const initials = event.actor ? actorInitials(event.actor.name) : "SY";
  const relativeTime = formatDistanceToNow(new Date(event.createdAt), {
    addSuffix: true,
  });

  const statusData =
    event.eventType === "STATUS_TRANSITIONED" && event.data != null
      ? (event.data as StatusData)
      : null;

  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <Avatar className="h-8 w-8 shrink-0">
          {event.actor?.avatar && <AvatarImage src={event.actor.avatar} alt={actorName} />}
          <AvatarFallback className="text-xs">{initials}</AvatarFallback>
        </Avatar>
        <div className="mt-1 w-px flex-1 bg-border" />
      </div>
      <div className="pb-6 pt-1 min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="font-medium text-sm">{actorName}</span>
          <span className="text-sm text-muted-foreground">{label}</span>
          <span className="text-xs text-muted-foreground">{relativeTime}</span>
        </div>
        {statusData && (
          <p className="mt-0.5 text-xs text-muted-foreground">
            {statusData.previousStatus} → {statusData.nextStatus}
          </p>
        )}
        {event.note && (
          <div className="mt-1.5 rounded-md border bg-muted/40 px-3 py-2 text-sm text-foreground/80">
            {event.note}
          </div>
        )}
      </div>
    </div>
  );
}

export function FederationSubmissionAuditLog({ submissionId }: { submissionId: string }) {
  const [events, setEvents] = useState<AuditEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch(`/api/federation-submissions/${submissionId}/events`);
        if (!res.ok) throw new Error(await res.text());
        const json = (await res.json()) as { events: AuditEvent[] };
        if (!cancelled) setEvents(json.events);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load events");
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [submissionId]);

  if (error) {
    return <p className="text-sm text-destructive">{error}</p>;
  }

  if (events === null) {
    return (
      <div className="space-y-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex gap-3">
            <Skeleton width="w-8" height="h-8" rounded="full" />
            <div className="flex-1 space-y-2 pt-1">
              <Skeleton height="h-4" width="w-48" />
              <Skeleton height="h-3" width="w-32" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (events.length === 0) {
    return <p className="text-sm text-muted-foreground">No events yet.</p>;
  }

  return (
    <div>
      {events.map((event) => (
        <EventEntry key={event.id} event={event} />
      ))}
    </div>
  );
}
