"use client"

import { useSearchParams } from "next/navigation"
import { Suspense } from "react"
import Link from "next/link"
import { CheckCircle2, ExternalLink, ArrowRight, ChevronRight, Settings, Users, Calendar, Globe, CreditCard } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { getBaseDomainFromHostname } from "@/lib/client-domains"
import { MARKETING_DOCS_URL, MARKETING_CONTACT_URL } from "@/lib/env-domains"

function SuccessContent() {
  const searchParams = useSearchParams()
  const subdomain = searchParams.get("subdomain") || "your-site"
  const orgName = searchParams.get("orgName") || "Your Organization"
  const planPrice = searchParams.get("planPrice")
  const isFreePlan = planPrice !== null && Number(planPrice) === 0

  const { baseDomain, protocol } = getBaseDomainFromHostname()
  const siteUrl = `${protocol}://${subdomain}.${baseDomain}`
  const adminUrl = `${protocol}://admin.${baseDomain}`

  const nextSteps = [
    {
      icon: Settings,
      title: "Configure your organization",
      description: "Add your logo, set up programs, and customize your settings",
      url: `${adminUrl}/organization/overview`,
    },
    {
      icon: Users,
      title: "Invite team members",
      description: "Add coaches, staff, and other administrators",
      url: `${adminUrl}/organization/users`,
    },
    {
      icon: Calendar,
      title: "Create events and programs",
      description: "Set up your schedule and registration options",
      url: `${adminUrl}/events`,
    },
    {
      icon: Globe,
      title: "Customize your website",
      description: "Update your public site with content and branding",
      url: `${adminUrl}/organization/website`,
    },
    {
      icon: CreditCard,
      title: "Set up payments",
      description: "Complete Adyen verification to accept payments and receive payouts",
      url: `${adminUrl}/financials/onboarding`,
    },
  ]

  return (
    <div className="w-full max-w-2xl mx-auto text-center">
      {/* Success Icon */}
      <div className="mb-6 flex justify-center">
        <div className="h-20 w-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
          <CheckCircle2 className="h-12 w-12 text-green-600 dark:text-green-400" />
        </div>
      </div>

      {/* Success Message */}
      <h1 className="text-3xl font-bold mb-2">Welcome to Uplifter!</h1>
      <p className="text-lg text-muted-foreground mb-8">
        <span className="font-semibold text-foreground">{orgName}</span> has been successfully created.
      </p>

      {/* Site URLs */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="text-lg">Your Sites</CardTitle>
          <CardDescription>
            {isFreePlan ? "Your free plan is active" : "Your 30-day free trial has started"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <div className="text-left">
              <p className="text-sm font-medium">Public Website</p>
              <p className="text-sm text-muted-foreground">{siteUrl}</p>
            </div>
            <Button variant="outline" size="sm" asChild>
              <a href={siteUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 mr-1" />
                Visit
              </a>
            </Button>
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <div className="text-left">
              <p className="text-sm font-medium">Admin Dashboard</p>
              <p className="text-sm text-muted-foreground">{adminUrl}</p>
            </div>
            <Button variant="outline" size="sm" asChild>
              <a href={adminUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 mr-1" />
                Open
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Next Steps */}
      <Card className="mb-8 text-left">
        <CardHeader>
          <CardTitle className="text-lg">Next Steps</CardTitle>
          <CardDescription>
            Get the most out of Uplifter
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {nextSteps.map((step, index) => (
              <li key={index}>
                <a
                  href={step.url}
                  className="flex items-center gap-3 rounded-lg p-3 -mx-3 transition-colors hover:bg-muted/50 group"
                >
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <step.icon className="h-4 w-4 text-primary" />
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

      {/* CTA Buttons */}
      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        <Button size="lg" asChild>
          <Link href={adminUrl}>
            Go to Dashboard
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
        <Button variant="outline" size="lg" asChild>
          <a href={siteUrl} target="_blank" rel="noopener noreferrer">
            View Your Website
            <ExternalLink className="ml-2 h-4 w-4" />
          </a>
        </Button>
      </div>

      <p className="text-sm text-muted-foreground mt-8">
        Need help? Check out our{" "}
        <a href={MARKETING_DOCS_URL} className="underline hover:text-foreground" target="_blank" rel="noopener noreferrer">documentation</a>
        {" "}or{" "}
        <a href={MARKETING_CONTACT_URL} className="underline hover:text-foreground" target="_blank" rel="noopener noreferrer">contact support</a>.
      </p>
    </div>
  )
}

export default function SuccessPage() {
  return (
    <Suspense fallback={
      <div className="w-full max-w-2xl mx-auto text-center">
        <div className="animate-pulse">
          <div className="h-20 w-20 rounded-full bg-muted mx-auto mb-6" />
          <div className="h-8 bg-muted rounded w-64 mx-auto mb-2" />
          <div className="h-4 bg-muted rounded w-48 mx-auto" />
        </div>
      </div>
    }>
      <SuccessContent />
    </Suspense>
  )
}
