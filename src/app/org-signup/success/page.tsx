"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import { ArrowRight, ChevronRight, Users, Calendar, CreditCard } from "lucide-react";
import { AnimatedCheckmark } from "@/components/ui/animated-checkmark";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getBaseDomainFromHostname } from "@/lib/client-domains";
import { MARKETING_DOCS_URL, MARKETING_CONTACT_URL } from "@/lib/env-domains";
import { FREE_TRIAL_DAYS } from "@/lib/billing-config";

function SuccessContent() {
  const searchParams = useSearchParams();

  useEffect(() => {
    sessionStorage.removeItem("org-signup-data");
  }, []);

  const orgName = searchParams.get("orgName") || "Your Organization";
  const orgId = searchParams.get("orgId");
  const planPrice = searchParams.get("planPrice");
  const isFreePlan = planPrice !== null && Number(planPrice) === 0;

  const { baseDomain, protocol } = getBaseDomainFromHostname();
  const adminBase = `${protocol}://admin.${baseDomain}`;
  const actionItemsUrl = orgId
    ? `${adminBase}/dashboard/switch-org?orgId=${encodeURIComponent(orgId)}&orgName=${encodeURIComponent(orgName)}&redirect=/dashboard/action-items`
    : `${adminBase}/dashboard/action-items`;

  const nextSteps = [
    {
      icon: CreditCard,
      title: "Set up payments",
      description: "Payment processing must be set up before this site can go live",
      url: `${adminBase}/financials/onboarding`,
      highlight: true,
    },
    {
      icon: Users,
      title: "Invite team members",
      description: "Add coaches, staff, and other administrators",
      url: orgId
        ? `${adminBase}/dashboard/switch-org?orgId=${encodeURIComponent(orgId)}&orgName=${encodeURIComponent(orgName)}&redirect=/dashboard/organization/staff`
        : `${adminBase}/dashboard/organization/staff`,
    },
    {
      icon: Calendar,
      title: "Create programs",
      description: "Manage your registration programs and enrollment options",
      url: `${adminBase}/dashboard/registrations/programs`,
    },
  ];

  return (
    <div className="w-full max-w-2xl mx-auto text-center">
      {/* Success Icon */}
      <div className="mb-6 flex justify-center">
        <div className="h-20 w-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
          <AnimatedCheckmark size={48} className="text-green-600 dark:text-green-400" />
        </div>
      </div>

      {/* Success Message */}
      <h1 className="text-3xl font-bold mb-2">Welcome to Uplifter!</h1>
      <p className="text-lg text-muted-foreground mb-2">
        <span className="font-semibold text-foreground">{orgName}</span> has been successfully
        created.
      </p>
      <p className="text-sm text-muted-foreground mb-8">
        {isFreePlan
          ? "Your free plan is active."
          : `Your ${FREE_TRIAL_DAYS}-day free trial has started.`}
      </p>

      {/* Next Steps */}
      <Card className="mb-8 text-left">
        <CardHeader>
          <CardTitle className="text-lg">Next Steps</CardTitle>
          <CardDescription>Get the most out of Uplifter</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {nextSteps.map((step, index) => (
              <li key={index}>
                <a
                  href={step.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex items-center gap-3 rounded-lg p-3 -mx-3 transition-colors group ${"highlight" in step && step.highlight ? "bg-yellow-50 dark:bg-yellow-900/10 hover:bg-yellow-100/70 dark:hover:bg-yellow-900/20" : "hover:bg-muted/50"}`}
                >
                  <div
                    className={`h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 ${"highlight" in step && step.highlight ? "bg-yellow-200/60 dark:bg-yellow-800/40" : "bg-primary/10"}`}
                  >
                    <step.icon
                      className={`h-4 w-4 ${"highlight" in step && step.highlight ? "text-yellow-700 dark:text-yellow-400" : "text-primary"}`}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium group-hover:underline">{step.title}</p>
                    <p className="text-sm text-muted-foreground">{step.description}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 group-hover:text-foreground transition-colors" />
                </a>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* CTA Button */}
      <div className="flex justify-center">
        <Button size="lg" asChild>
          <a href={actionItemsUrl}>
            Go To Dashboard
            <ArrowRight className="ml-2 h-4 w-4" />
          </a>
        </Button>
      </div>

      <p className="text-sm text-muted-foreground mt-8">
        Need help? Check out our{" "}
        <a
          href={MARKETING_DOCS_URL}
          className="underline hover:text-foreground"
          target="_blank"
          rel="noopener noreferrer"
        >
          documentation
        </a>{" "}
        or{" "}
        <a
          href={MARKETING_CONTACT_URL}
          className="underline hover:text-foreground"
          target="_blank"
          rel="noopener noreferrer"
        >
          contact support
        </a>
        .
      </p>
    </div>
  );
}

export default function SuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="w-full max-w-2xl mx-auto text-center">
          <div className="animate-pulse">
            <div className="h-20 w-20 rounded-full bg-muted mx-auto mb-6" />
            <div className="h-8 bg-muted rounded w-64 mx-auto mb-2" />
            <div className="h-4 bg-muted rounded w-48 mx-auto" />
          </div>
        </div>
      }
    >
      <SuccessContent />
    </Suspense>
  );
}
