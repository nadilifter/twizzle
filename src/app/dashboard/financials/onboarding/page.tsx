"use client"

import { useEffect, useState, useCallback } from "react"
import { OrganizationAddressForm } from "@/components/organization-address-form"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  CheckCircle2Icon,
  AlertCircleIcon,
  Building2Icon,
  UniversityIcon,
  UserIcon,
  Loader2,
  ExternalLinkIcon,
  RefreshCwIcon,
  ClockIcon,
  XCircleIcon,
} from "lucide-react"

type OnboardingAccount = {
  onboardingStatus: string
  verificationStatus: string | null
  capabilities: Record<string, any> | null
  hasStore: boolean
  hasSweep: boolean
  legalEntityId: string | null
  accountHolderId: string | null
  balanceAccountId: string | null
}

type OrganizationDetails = {
  id: string
  name: string
  street: string | null
  city: string | null
  stateProvince: string | null
  postalCode: string | null
  country: string | null
  phone: string | null
}

export default function OnboardingPage() {
  const [account, setAccount] = useState<OnboardingAccount | null>(null)
  const [organization, setOrganization] = useState<OrganizationDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/organization/adyen-onboarding")
      const data = await res.json()
      if (res.ok) {
        setAccount(data.account)
        setOrganization(data.organization)
      } else {
        setError(data.error)
      }
    } catch {
      setError("Failed to load onboarding status")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStatus()
  }, [fetchStatus])

  const handleInitiate = async () => {
    setActionLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/organization/adyen-onboarding", {
        method: "POST",
      })
      const data = await res.json()
      if (res.ok) {
        setAccount({
          onboardingStatus: data.account.onboardingStatus,
          verificationStatus: null,
          capabilities: null,
          hasStore: false,
          hasSweep: false,
          legalEntityId: data.account.legalEntityId,
          accountHolderId: data.account.accountHolderId,
          balanceAccountId: data.account.balanceAccountId,
        })
      } else {
        setError(data.error || "Failed to initiate onboarding")
      }
    } catch {
      setError("Failed to initiate onboarding")
    } finally {
      setActionLoading(false)
    }
  }

  const handleGetLink = async () => {
    setActionLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/organization/adyen-onboarding/link", {
        method: "POST",
      })
      const data = await res.json()
      if (res.ok && data.url) {
        window.location.href = data.url
      } else {
        setError(data.error || "Failed to generate onboarding link")
        setActionLoading(false)
      }
    } catch {
      setError("Failed to generate onboarding link")
      setActionLoading(false)
    }
  }

  const handleFinalize = async () => {
    setActionLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/organization/adyen-onboarding/finalize", {
        method: "POST",
      })
      const data = await res.json()
      if (res.ok) {
        await fetchStatus()
      } else {
        setError(data.error || "Failed to finalize setup")
      }
    } catch {
      setError("Failed to finalize setup")
    } finally {
      setActionLoading(false)
    }
  }

  const handleRefresh = async () => {
    setLoading(true)
    await fetchStatus()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold tracking-tight">
            Account Onboarding
          </h1>
          <p className="text-muted-foreground">
            Verify your business details to start processing payments.
          </p>
        </div>
        {account && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={loading}
          >
            <RefreshCwIcon className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        )}
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircleIcon className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {!account && organization && (
        <OrganizationAddressCard 
          organization={organization} 
          onUpdate={(org) => setOrganization(org)} 
        />
      )}
      {!account && <NotStartedState onInitiate={handleInitiate} loading={actionLoading} />}
      {account?.onboardingStatus === "PENDING_HOSTED" && (
        <PendingHostedState account={account} onGetLink={handleGetLink} loading={actionLoading} />
      )}
      {(account?.onboardingStatus === "IN_PROGRESS" ||
        account?.onboardingStatus === "IN_REVIEW" ||
        account?.onboardingStatus === "AWAITING_DATA") && (
        <InProgressState account={account} onGetLink={handleGetLink} onRefresh={handleRefresh} loading={actionLoading} />
      )}
      {account?.onboardingStatus === "VERIFIED" && (
        <VerifiedState account={account} onFinalize={handleFinalize} loading={actionLoading} />
      )}
      {account?.onboardingStatus === "REJECTED" && (
        <RejectedState account={account} onGetLink={handleGetLink} loading={actionLoading} />
      )}
    </div>
  )
}

function OrganizationAddressCard({ 
  organization, 
  onUpdate 
}: { 
  organization: OrganizationDetails
  onUpdate: (org: OrganizationDetails) => void 
}) {
  const [isEditing, setIsEditing] = useState(false)

  const isComplete = Boolean(
    organization.street &&
    organization.city &&
    organization.stateProvince &&
    organization.postalCode &&
    organization.country &&
    organization.phone
  )

  const address = [
    organization.street,
    organization.city,
    organization.stateProvince,
    organization.postalCode,
    organization.country,
  ]
    .filter(Boolean)
    .join(", ")

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium flex items-center justify-between">
          <span>Organization Contact Details</span>
          {!isEditing && (
            <Button variant="ghost" size="sm" onClick={() => setIsEditing(true)}>
              Edit
            </Button>
          )}
        </CardTitle>
        <CardDescription>
          Your organization&apos;s physical address and phone number. These must be complete before initiating Adyen onboarding.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isEditing ? (
          <OrganizationAddressForm 
            organization={organization} 
            onSuccess={(updated) => {
              onUpdate(updated)
              setIsEditing(false)
            }}
            onCancel={() => setIsEditing(false)}
          />
        ) : (
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              {address ? (
                <p className="text-sm font-medium">{address}</p>
              ) : (
                <p className="text-sm text-muted-foreground italic">No address provided</p>
              )}
              {organization.phone ? (
                <p className="text-sm text-muted-foreground">{organization.phone}</p>
              ) : (
                <p className="text-sm text-muted-foreground italic">No phone provided</p>
              )}
            </div>
            {!isComplete && (
              <Badge variant="destructive">Missing required fields</Badge>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function NotStartedState({
  onInitiate,
  loading,
}: {
  onInitiate: () => void
  loading: boolean
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Get Started with Payment Processing</CardTitle>
        <CardDescription>
          To accept payments and receive payouts, you need to verify your
          business details with our payment provider, Adyen.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3">
          {[
            {
              icon: Building2Icon,
              title: "Business Details",
              desc: "Legal name, address, and business type",
            },
            {
              icon: UserIcon,
              title: "Identity Verification",
              desc: "Business owners and representatives",
            },
            {
              icon: UniversityIcon,
              title: "Bank Account",
              desc: "Where you'll receive your payouts",
            },
          ].map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="flex items-center gap-4 p-4 border rounded-lg"
            >
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h4 className="font-semibold">{title}</h4>
                <p className="text-sm text-muted-foreground">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
      <CardFooter>
        <Button onClick={onInitiate} disabled={loading}>
          {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Begin Verification
        </Button>
      </CardFooter>
    </Card>
  )
}

function PendingHostedState({
  account,
  onGetLink,
  loading,
}: {
  account: OnboardingAccount
  onGetLink: () => void
  loading: boolean
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Complete Your Verification</CardTitle>
        <CardDescription>
          Your account structure has been created. Complete the verification
          process with Adyen to start accepting payments.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <ClockIcon className="h-4 w-4" />
          <AlertTitle>Verification Pending</AlertTitle>
          <AlertDescription>
            Click the button below to continue to Adyen&apos;s secure verification
            page where you&apos;ll provide business details, identity documents, and
            bank account information.
          </AlertDescription>
        </Alert>
        <StatusRows account={account} />
      </CardContent>
      <CardFooter>
        <Button onClick={onGetLink} disabled={loading}>
          {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Continue to Adyen
          <ExternalLinkIcon className="h-4 w-4 ml-2" />
        </Button>
      </CardFooter>
    </Card>
  )
}

function InProgressState({
  account,
  onGetLink,
  onRefresh,
  loading,
}: {
  account: OnboardingAccount
  onGetLink: () => void
  onRefresh: () => void
  loading: boolean
}) {
  return (
    <div className="grid gap-6 md:grid-cols-[2fr_1fr]">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Verification In Progress</CardTitle>
              <CardDescription>
                {account.verificationStatus || "Your verification is being processed."}
              </CardDescription>
            </div>
            <StatusBadge status={account.onboardingStatus} />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <CapabilitiesDisplay capabilities={account.capabilities} />
        </CardContent>
        <CardFooter className="flex gap-3">
          <Button variant="outline" onClick={onRefresh}>
            <RefreshCwIcon className="h-4 w-4 mr-2" />
            Check Status
          </Button>
          <Button variant="outline" onClick={onGetLink} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Return to Adyen
            <ExternalLinkIcon className="h-4 w-4 ml-2" />
          </Button>
        </CardFooter>
      </Card>

      <HelpCard />
    </div>
  )
}

function VerifiedState({
  account,
  onFinalize,
  loading,
}: {
  account: OnboardingAccount
  onFinalize: () => void
  loading: boolean
}) {
  const needsFinalize = !account.hasStore

  return (
    <div className="grid gap-6 md:grid-cols-[2fr_1fr]">
      <Card>
        <CardHeader>
          <CardTitle>Verification Status</CardTitle>
          <CardDescription>Your account capabilities based on provided information.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert className="bg-green-50 border-green-200 text-green-800">
            <CheckCircle2Icon className="h-4 w-4 text-green-600" />
            <AlertTitle>
              {needsFinalize ? "Verification Complete" : "Ready to Process"}
            </AlertTitle>
            <AlertDescription>
              {needsFinalize
                ? "Your account is verified. Finalize setup to start accepting payments."
                : "Your account is fully set up. You can now accept payments and receive payouts."}
            </AlertDescription>
          </Alert>
          <StatusRows account={account} verified />
        </CardContent>
        <CardFooter className="flex justify-between border-t pt-6">
          <div className="text-sm text-muted-foreground">
            Account Holder:{" "}
            <span className="font-mono text-foreground">
              {account.accountHolderId}
            </span>
          </div>
          {needsFinalize && (
            <Button onClick={onFinalize} disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Finalize Setup
            </Button>
          )}
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Account Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {account.balanceAccountId && (
            <div>
              <span className="text-muted-foreground">Balance Account</span>
              <p className="font-mono">{account.balanceAccountId}</p>
            </div>
          )}
          {account.hasStore && (
            <div>
              <span className="text-muted-foreground">Store</span>
              <p className="font-mono text-green-600">Configured</p>
            </div>
          )}
          {account.hasSweep && (
            <div>
              <span className="text-muted-foreground">Payouts</span>
              <p className="font-mono text-green-600">Daily sweep active</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function RejectedState({
  account,
  onGetLink,
  loading,
}: {
  account: OnboardingAccount
  onGetLink: () => void
  loading: boolean
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Verification Issues</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert variant="destructive">
          <XCircleIcon className="h-4 w-4" />
          <AlertTitle>Action Required</AlertTitle>
          <AlertDescription>
            {account.verificationStatus ||
              "There are issues with your verification. Please review and update your details."}
          </AlertDescription>
        </Alert>
        <CapabilitiesDisplay capabilities={account.capabilities} />
      </CardContent>
      <CardFooter>
        <Button onClick={onGetLink} disabled={loading}>
          {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Update Details on Adyen
          <ExternalLinkIcon className="h-4 w-4 ml-2" />
        </Button>
      </CardFooter>
    </Card>
  )
}

// --- Shared components ---

function StatusRows({
  account,
  verified = false,
}: {
  account: OnboardingAccount
  verified?: boolean
}) {
  const rows = [
    {
      icon: Building2Icon,
      title: "Legal Entity",
      desc: "Business details and address",
      done: !!account.legalEntityId,
    },
    {
      icon: UserIcon,
      title: "Identity Verification",
      desc: "Ultimate Beneficial Owners (UBOs)",
      done: verified,
    },
    {
      icon: UniversityIcon,
      title: "Bank Account",
      desc: "Payout destination details",
      done: verified && account.hasSweep,
    },
  ]

  return (
    <div className="grid gap-4">
      {rows.map(({ icon: Icon, title, desc, done }) => (
        <div
          key={title}
          className="flex items-center justify-between p-4 border rounded-lg"
        >
          <div className="flex items-center gap-4">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Icon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h4 className="font-semibold">{title}</h4>
              <p className="text-sm text-muted-foreground">{desc}</p>
            </div>
          </div>
          {done ? (
            <CheckCircle2Icon className="h-5 w-5 text-green-600" />
          ) : (
            <ClockIcon className="h-5 w-5 text-amber-500" />
          )}
        </div>
      ))}
    </div>
  )
}

function CapabilitiesDisplay({
  capabilities,
}: {
  capabilities: Record<string, any> | null
}) {
  if (!capabilities || Object.keys(capabilities).length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Capability information will appear here once verification begins.
      </p>
    )
  }

  return (
    <div className="grid gap-2">
      {Object.entries(capabilities).map(([name, cap]) => {
        const allowed = cap.allowed === true
        const pending = cap.verificationStatus === "pending"

        return (
          <div
            key={name}
            className="flex items-center justify-between py-2 px-3 rounded-md border text-sm"
          >
            <span className="capitalize">
              {name.replace(/([A-Z])/g, " $1").trim()}
            </span>
            {allowed ? (
              <Badge variant="default" className="bg-green-600">Allowed</Badge>
            ) : pending ? (
              <Badge variant="secondary">Pending</Badge>
            ) : (
              <Badge variant="destructive">Action needed</Badge>
            )}
          </div>
        )
      })}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, { label: string; className: string }> = {
    IN_PROGRESS: { label: "In Progress", className: "bg-blue-100 text-blue-800" },
    IN_REVIEW: { label: "Under Review", className: "bg-amber-100 text-amber-800" },
    AWAITING_DATA: { label: "Action Needed", className: "bg-orange-100 text-orange-800" },
  }
  const v = variants[status] || { label: status, className: "" }
  return <Badge className={v.className}>{v.label}</Badge>
}

function HelpCard() {
  return (
    <Card className="bg-muted/50">
      <CardHeader>
        <CardTitle className="text-sm font-medium">Need Help?</CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        <p>
          Verification typically takes 1-2 business days. Status updates arrive
          automatically. If you need assistance, contact our support team.
        </p>
        <Button variant="link" className="px-0 mt-2">
          Contact Support &rarr;
        </Button>
      </CardContent>
    </Card>
  )
}
