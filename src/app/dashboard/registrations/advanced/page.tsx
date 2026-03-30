"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Legacy redirect: Advanced Registrations has been renamed to Competitions.
 * Redirects to the new Competitions page.
 */
export default function AdvancedRegistrationsRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard/competitions");
  }, [router]);

  return null;
}
