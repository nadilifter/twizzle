import { Check, Download, AlertCircle, Lock, MessageSquare, Mail, HardDrive, Tag } from "lucide-react"
import { redirect } from "next/navigation"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert"
import { getAuthSession } from "@/lib/auth"
import { db } from "@/lib/db"
import { PlanSelector } from "./plan-selector"
import { getUsageStats } from "@/lib/sms-service"
import { getEmailUsageStats, checkEmailUsageLimits } from "@/lib/email-campaign-service"
import { PaymentMethodsCard } from "@/components/billing/payment-methods-card"

export default async function BillingPage() {
  const session = await getAuthSession()
  
  if (!session?.user?.organizationId) {
    redirect("/login")
  }

  // Fetch organization with subscription and payment methods
  const organization = await db.organization.findUnique({
    where: { id: session.user.organizationId },
    include: {
      _count: {
        select: {
          invoices: true,
          families: true,
          athletes: true,
          members: true,
          programs: true,
          events: true,
        }
      },
      invoices: {
        where: { status: "PAID" },
        select: { total: true },
        take: 100,
      },
      subscription: {
        include: {
          plan: true
        }
      },
      organizationPaymentMethods: {
        where: { isActive: true },
        orderBy: [
          { isDefault: "desc" },
          { createdAt: "desc" },
        ],
      },
    },
  })

  if (!organization) {
    redirect("/login")
  }

  // Fetch available plans
  const availablePlans = await db.subscriptionPlan.findMany({
    where: {
      isActive: true,
      isPublic: true,
    },
    orderBy: { displayOrder: "asc" }
  })

  // Calculate some basic metrics
  const totalRevenue = organization.invoices.reduce((sum, inv) => sum + Number(inv.total), 0)
  
  const currentPlan = organization.subscription?.plan
  const subscription = organization.subscription

  // Get SMS usage
  const smsUsage = await getUsageStats(session.user.organizationId)

  // Get Email usage
  const [emailStats, emailLimits] = await Promise.all([
    getEmailUsageStats(session.user.organizationId),
    checkEmailUsageLimits(session.user.organizationId),
  ])

  // Get Storage usage (aggregate Media.fileSize)
  const storageUsage = await db.media.aggregate({
    where: { organizationId: session.user.organizationId },
    _sum: { fileSize: true },
    _count: true,
  })
  const storageUsedBytes = storageUsage._sum.fileSize || 0
  const storageUsedMB = Math.round(storageUsedBytes / (1024 * 1024) * 100) / 100

  // Get Membership types count
  const membershipTypesCount = await db.membershipGroup.count({
    where: { organizationId: session.user.organizationId },
  })

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount)
  }

  const formatPercent = (amount: number) => {
    return `${(amount * 100).toFixed(1)}%`
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Billing & Plans</h1>
          <p className="text-muted-foreground">
            Manage your subscription plan, view usage, and download invoices.
          </p>
        </div>
      </div>

      {subscription?.isLocked && (
        <Alert>
          <Lock className="h-4 w-4" />
          <AlertTitle>Subscription Locked</AlertTitle>
          <AlertDescription>
            {subscription.lockedReason || "Your subscription has been locked by an administrator. Contact support if you need to make changes."}
          </AlertDescription>
        </Alert>
      )}

      {!subscription && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>No Subscription</AlertTitle>
          <AlertDescription>
            Your organization does not have an active subscription. During the beta period, all features are available. Select a plan below to get started.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Current Plan Card */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
            <div className="grid gap-1">
              <CardTitle>Current Plan</CardTitle>
              <CardDescription>
                {currentPlan ? (
                  <>
                    {organization.name} is on the <span className="font-medium text-foreground">{currentPlan.name}</span> plan.
                  </>
                ) : (
                  <>No plan selected. Using beta access.</>
                )}
              </CardDescription>
            </div>
            {currentPlan && (
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-sm">
                  {currentPlan.name}
                </Badge>
                {subscription?.isLocked && (
                  <Badge variant="outline" className="gap-1">
                    <Lock className="h-3 w-3" />
                  </Badge>
                )}
              </div>
            )}
          </CardHeader>
          <CardContent className="grid gap-4">
            {currentPlan ? (
              <>
                <div className="flex items-center justify-between">
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold">{formatCurrency(Number(currentPlan.monthlyPrice))}</span>
                    <span className="text-muted-foreground">/{subscription?.billingCycle.toLowerCase()}</span>
                  </div>
                  {subscription && (
                    <div className="text-sm text-muted-foreground">
                      Renews {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                    </div>
                  )}
                </div>
                
                <div className="grid gap-2 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-primary" />
                    <span>
                      Transaction Fee: <strong>
                        {formatPercent(Number(currentPlan.transactionFee))} + {formatCurrency(Number(currentPlan.perTransactionFee))}
                      </strong> per transaction
                    </span>
                  </div>
                  {(currentPlan.features as string[]).map((feature, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-primary" />
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p>Select a plan below to see pricing and features.</p>
              </div>
            )}
          </CardContent>
          {!subscription?.isLocked && (
            <CardFooter>
              <PlanSelector 
                currentPlanId={subscription?.planId || null}
                plans={availablePlans.map(p => ({
                  id: p.id,
                  name: p.name,
                  slug: p.slug,
                  monthlyPrice: Number(p.monthlyPrice),
                  yearlyPrice: p.yearlyPrice ? Number(p.yearlyPrice) : null,
                  transactionFee: Number(p.transactionFee),
                  perTransactionFee: Number(p.perTransactionFee),
                  maxAthletes: p.maxAthletes,
                  maxUsers: p.maxUsers,
                  maxPrograms: p.maxPrograms,
                  maxEvents: p.maxEvents,
                  smsIncluded: p.smsIncluded,
                  emailIncluded: p.emailIncluded,
                  maxStorageMB: p.maxStorageMB,
                  maxMembershipTypes: p.maxMembershipTypes,
                  features: p.features as string[],
                  isPopular: p.isPopular,
                }))}
                currentUsage={{
                  athletes: organization._count.athletes,
                  users: organization._count.members,
                  programs: organization._count.programs,
                  events: organization._count.events,
                  storageMB: storageUsedMB,
                  membershipTypes: membershipTypesCount,
                }}
                billingCycle={subscription?.billingCycle || "MONTHLY"}
              />
            </CardFooter>
          )}
        </Card>

        {/* Organization Stats */}
        <Card>
          <CardHeader>
            <CardTitle>Organization Stats</CardTitle>
            <CardDescription>Your current usage</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-medium">Athletes</span>
              <div className="text-right">
                <span className="text-2xl font-bold">{organization._count.athletes}</span>
                <span className="text-sm text-muted-foreground"> / {currentPlan?.maxAthletes ?? "∞"}</span>
              </div>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-medium">Users</span>
              <div className="text-right">
                <span className="text-2xl font-bold">{organization._count.members}</span>
                <span className="text-sm text-muted-foreground"> / {currentPlan?.maxUsers ?? "∞"}</span>
              </div>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-medium">Programs</span>
              <div className="text-right">
                <span className="text-2xl font-bold">{organization._count.programs}</span>
                <span className="text-sm text-muted-foreground"> / {currentPlan?.maxPrograms ?? "∞"}</span>
              </div>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-medium">Events</span>
              <div className="text-right">
                <span className="text-2xl font-bold">{organization._count.events}</span>
                <span className="text-sm text-muted-foreground"> / {currentPlan?.maxEvents ?? "∞"}</span>
              </div>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-medium">Families</span>
              <div className="text-right">
                <span className="text-2xl font-bold">{organization._count.families}</span>
                <span className="text-sm text-muted-foreground"> / ∞</span>
              </div>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-medium">Membership Types</span>
              <div className="text-right">
                <span className="text-2xl font-bold">{membershipTypesCount}</span>
                <span className="text-sm text-muted-foreground"> / {currentPlan?.maxMembershipTypes ?? "∞"}</span>
              </div>
            </div>
            <Separator />
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-medium">Storage Used</span>
              <div className="text-right">
                <span className="text-2xl font-bold">{storageUsedMB >= 1000 ? `${(storageUsedMB / 1000).toFixed(1)} GB` : `${storageUsedMB} MB`}</span>
                <span className="text-sm text-muted-foreground">
                  {" / "}
                  {currentPlan?.maxStorageMB 
                    ? (currentPlan.maxStorageMB >= 1000 ? `${currentPlan.maxStorageMB / 1000} GB` : `${currentPlan.maxStorageMB} MB`)
                    : "∞"}
                </span>
              </div>
            </div>
            <Separator />
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-medium">Total Collected</span>
              <span className="font-bold text-green-600">{formatCurrency(totalRevenue)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* SMS Usage Card */}
      {currentPlan?.smsIncluded && currentPlan.smsIncluded > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  SMS Usage
                </CardTitle>
                <CardDescription>
                  Your SMS messaging usage for this billing period
                </CardDescription>
              </div>
              {smsUsage && smsUsage.overageMessages > 0 && (
                <Badge variant="outline" className="text-amber-600 border-amber-300">
                  Over limit
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Messages Used</span>
                <span className="font-medium">
                  {smsUsage?.messagesSent ?? 0} / {currentPlan.smsIncluded}
                </span>
              </div>
              <Progress 
                value={Math.min(100, ((smsUsage?.messagesSent ?? 0) / currentPlan.smsIncluded) * 100)} 
                className="h-2"
              />
            </div>

            <div className="grid grid-cols-3 gap-4 pt-2">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {smsUsage?.messagesDelivered ?? 0}
                </div>
                <div className="text-xs text-muted-foreground">Delivered</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">
                  {smsUsage?.messagesFailed ?? 0}
                </div>
                <div className="text-xs text-muted-foreground">Failed</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">
                  {smsUsage ? Math.round((smsUsage.messagesDelivered / Math.max(1, smsUsage.messagesSent)) * 100) : 0}%
                </div>
                <div className="text-xs text-muted-foreground">Delivery Rate</div>
              </div>
            </div>

            {smsUsage && smsUsage.overageMessages > 0 && currentPlan.smsOverageRate && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Overage Charges</AlertTitle>
                <AlertDescription>
                  You&apos;ve sent {smsUsage.overageMessages} messages over your plan limit.
                  Overage cost: {formatCurrency(smsUsage.overageCost)} ({formatCurrency(Number(currentPlan.smsOverageRate))}/message)
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* Email Usage Card */}
      {currentPlan?.emailIncluded && currentPlan.emailIncluded > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5" />
                  Email Usage
                </CardTitle>
                <CardDescription>
                  Your email campaign usage for this billing period
                </CardDescription>
              </div>
              {emailLimits && emailLimits.used > emailLimits.included && (
                <Badge variant="outline" className="text-amber-600 border-amber-300">
                  Over limit
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Emails Sent</span>
                <span className="font-medium">
                  {emailLimits?.used ?? 0} / {currentPlan.emailIncluded}
                </span>
              </div>
              <Progress 
                value={Math.min(100, ((emailLimits?.used ?? 0) / currentPlan.emailIncluded) * 100)} 
                className="h-2"
              />
            </div>

            {emailStats && (
              <div className="grid grid-cols-4 gap-4 pt-2">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {emailStats.emailsDelivered ?? 0}
                  </div>
                  <div className="text-xs text-muted-foreground">Delivered</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {emailStats.emailsOpened ?? 0}
                  </div>
                  <div className="text-xs text-muted-foreground">Opened</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">
                    {emailStats.emailsClicked ?? 0}
                  </div>
                  <div className="text-xs text-muted-foreground">Clicked</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">
                    {emailStats.emailsBounced ?? 0}
                  </div>
                  <div className="text-xs text-muted-foreground">Bounced</div>
                </div>
              </div>
            )}

            {emailLimits && emailLimits.used > emailLimits.included && currentPlan.emailOverageRate && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Overage Charges</AlertTitle>
                <AlertDescription>
                  You&apos;ve sent {emailLimits.used - emailLimits.included} emails over your plan limit.
                  Overage cost: {formatCurrency((emailLimits.used - emailLimits.included) * Number(currentPlan.emailOverageRate))} ({formatCurrency(Number(currentPlan.emailOverageRate))}/email)
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* Storage Usage Card */}
      {currentPlan?.maxStorageMB && currentPlan.maxStorageMB > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <HardDrive className="h-5 w-5" />
                  Storage Usage
                </CardTitle>
                <CardDescription>
                  Your file storage usage
                </CardDescription>
              </div>
              {storageUsedMB > currentPlan.maxStorageMB && (
                <Badge variant="outline" className="text-amber-600 border-amber-300">
                  Over limit
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Storage Used</span>
                <span className="font-medium">
                  {storageUsedMB >= 1000 ? `${(storageUsedMB / 1000).toFixed(2)} GB` : `${storageUsedMB} MB`} / {currentPlan.maxStorageMB >= 1000 ? `${currentPlan.maxStorageMB / 1000} GB` : `${currentPlan.maxStorageMB} MB`}
                </span>
              </div>
              <Progress 
                value={Math.min(100, (storageUsedMB / currentPlan.maxStorageMB) * 100)} 
                className="h-2"
              />
            </div>

            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="text-center">
                <div className="text-2xl font-bold">
                  {storageUsage._count}
                </div>
                <div className="text-xs text-muted-foreground">Total Files</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">
                  {Math.round(100 - (storageUsedMB / currentPlan.maxStorageMB) * 100)}%
                </div>
                <div className="text-xs text-muted-foreground">Remaining</div>
              </div>
            </div>

            {storageUsedMB > currentPlan.maxStorageMB && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Storage Limit Exceeded</AlertTitle>
                <AlertDescription>
                  You&apos;ve exceeded your storage limit. Please delete some files or upgrade your plan to continue uploading.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <PaymentMethodsCard
          paymentMethods={organization.organizationPaymentMethods.map(pm => ({
            id: pm.id,
            storedPaymentMethodId: pm.storedPaymentMethodId,
            type: pm.type,
            brand: pm.brand,
            lastFour: pm.lastFour,
            expiryMonth: pm.expiryMonth,
            expiryYear: pm.expiryYear,
            holderName: pm.holderName,
            isDefault: pm.isDefault,
            isActive: pm.isActive,
            createdAt: pm.createdAt.toISOString(),
          }))}
          organizationId={organization.id}
          hasSubscription={!!subscription}
        />

        <Card>
          <CardHeader>
            <CardTitle>Billing History</CardTitle>
            <CardDescription>Your platform subscription invoices</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <div className="text-center">
                <Download className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                <p className="font-medium">No invoices yet</p>
                <p className="text-sm">Billing history will appear here once subscription billing begins.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Available Plans Comparison */}
      <Card>
        <CardHeader>
          <CardTitle>Available Plans</CardTitle>
          <CardDescription>
            Compare features and choose the right plan for your organization
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Plan</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Transaction Fee</TableHead>
                <TableHead>Limits</TableHead>
                <TableHead>SMS</TableHead>
                <TableHead className="text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {availablePlans.map((plan) => (
                <TableRow key={plan.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {plan.name}
                      {plan.isPopular && (
                        <Badge variant="secondary">Popular</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {Number(plan.monthlyPrice) === 0 ? "Free" : `${formatCurrency(Number(plan.monthlyPrice))}/mo`}
                  </TableCell>
                  <TableCell>
                    {formatPercent(Number(plan.transactionFee))} + {formatCurrency(Number(plan.perTransactionFee))}
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">
                      {plan.maxAthletes ? `${plan.maxAthletes} athletes` : "Unlimited"}
                      {plan.maxUsers ? `, ${plan.maxUsers} users` : ""}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">
                      {plan.smsIncluded ? `${plan.smsIncluded}/mo` : "—"}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    {subscription?.planId === plan.id ? (
                      <Badge>Current Plan</Badge>
                    ) : subscription?.isLocked ? (
                      <Badge variant="outline">Locked</Badge>
                    ) : (
                      <PlanSelector
                        currentPlanId={subscription?.planId || null}
                        plans={[{
                          id: plan.id,
                          name: plan.name,
                          slug: plan.slug,
                          monthlyPrice: Number(plan.monthlyPrice),
                          yearlyPrice: plan.yearlyPrice ? Number(plan.yearlyPrice) : null,
                          transactionFee: Number(plan.transactionFee),
                          perTransactionFee: Number(plan.perTransactionFee),
                          maxAthletes: plan.maxAthletes,
                          maxUsers: plan.maxUsers,
                          maxPrograms: plan.maxPrograms,
                          maxEvents: plan.maxEvents,
                          smsIncluded: plan.smsIncluded,
                          emailIncluded: plan.emailIncluded,
                          maxStorageMB: plan.maxStorageMB,
                          maxMembershipTypes: plan.maxMembershipTypes,
                          features: plan.features as string[],
                          isPopular: plan.isPopular,
                        }]}
                        currentUsage={{
                          athletes: organization._count.athletes,
                          users: organization._count.members,
                          programs: organization._count.programs,
                          events: organization._count.events,
                          storageMB: storageUsedMB,
                          membershipTypes: membershipTypesCount,
                        }}
                        billingCycle={subscription?.billingCycle || "MONTHLY"}
                        variant="compact"
                        targetPlanId={plan.id}
                      />
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
