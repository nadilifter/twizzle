"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { ProgramCalendar } from "@/components/program-calendar";
import type { CalendarEvent } from "@/components/program-calendar";

interface SiteCalendarProps {
  slug: string;
  organizationId: string;
  organizationName: string;
}

/**
 * Build the admin portal URL that routes through switch-org to ensure
 * the admin session is set to the correct organization before landing
 * on the program page.
 */
function getAdminProgramUrl(
  programId: string,
  organizationId: string,
  organizationName: string
): string {
  const { protocol, host } = window.location;
  const hostWithoutPort = host.split(":")[0];
  const port = host.includes(":") ? `:${host.split(":")[1]}` : "";

  // Extract base domain by removing the first subdomain segment
  const parts = hostWithoutPort.split(".");
  const baseDomain = parts.length > 1 ? parts.slice(1).join(".") : hostWithoutPort;

  const adminBase = `${protocol}//admin.${baseDomain}${port}`;
  const redirectPath = `/dashboard/registrations/programs/${programId}`;

  const params = new URLSearchParams({
    orgId: organizationId,
    orgName: organizationName,
    redirect: redirectPath,
  });

  return `${adminBase}/switch-org?${params.toString()}`;
}

export function SiteCalendar({ slug, organizationId, organizationName }: SiteCalendarProps) {
  const router = useRouter();
  const { data: session, status } = useSession();

  const isAdmin =
    status === "authenticated" &&
    (session?.user?.role === "ADMIN" ||
      session?.user?.permissions?.includes("*"));

  const handleEventClick = useCallback(
    (event: CalendarEvent) => {
      if (isAdmin) {
        // Cross-subdomain navigation to admin portal via switch-org
        window.location.href = getAdminProgramUrl(
          event.programId,
          organizationId,
          organizationName
        );
      } else {
        // Stay on marketing site - navigate to program details with instance context
        router.push(`/programs/${event.programId}?instance=${event.id}`);
      }
    },
    [isAdmin, router, organizationId, organizationName]
  );

  return (
    <ProgramCalendar
      slug={slug}
      isPublic={true}
      onEventClick={handleEventClick}
      className="shadow-none"
    />
  );
}
