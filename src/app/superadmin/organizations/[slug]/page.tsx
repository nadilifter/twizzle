import { db } from "@/lib/db"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Metadata } from "next"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Building2, Users, FileText, Globe, ExternalLink, LayoutDashboard, CreditCard, AlertTriangle } from "lucide-react"
import { SubscriptionManager } from "./subscription-manager"
import { FeatureOverrides } from "./feature-overrides"
import { getSubdomainUrl } from "@/lib/env-domains"

function getMarketingSiteUrl(slug: string, websiteConfig: { domain?: string | null; subdomain?: string | null } | null): string {
  // Custom domain takes priority (always external)
  if (websiteConfig?.domain) {
    return `https://${websiteConfig.domain}`
  }
  
  // Subdomain on platform - use env-aware URL
  if (websiteConfig?.subdomain) {
    return getSubdomainUrl(websiteConfig.subdomain)
  }
  
  // Fallback to slug-based URL
  return getSubdomainUrl(slug)
}

function getAdminDashboardSwitchUrl(orgId: string, orgName: string): string {
  const adminBase = getSubdomainUrl('admin')
  return `${adminBase}/dashboard/switch-org?orgId=${encodeURIComponent(orgId)}&orgName=${encodeURIComponent(orgName)}`
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const organization = await db.organization.findUnique({
    where: { slug },
    select: { name: true }
  })
  
  return {
    title: organization ? `${organization.name} | Superadmin` : 'Organization | Superadmin'
  }
}

interface Props {
  params: Promise<{ slug: string }>
}

export default async function OrganizationDetailPage({ params }: Props) {
  const { slug } = await params
  
  const organization = await db.organization.findUnique({
    where: { slug },
    include: {
      _count: {
        select: { 
          members: true, 
          invoices: true,
          programs: true,
          events: true,
          families: true,
          athletes: true,
        }
      },
      members: {
        include: {
          user: true
        },
        take: 5,
        orderBy: { joinedAt: 'desc' }
      },
      invoices: {
        take: 5,
        orderBy: { createdAt: 'desc' }
      },
      subscription: {
        include: {
          plan: true
        }
      },
      websiteConfig: true,
      organizationPaymentMethods: {
        where: { isActive: true },
        orderBy: [
          { isDefault: "desc" },
          { createdAt: "desc" },
        ],
      }
    }
  })

  if (!organization) {
    notFound()
  }

  return (
    <div className="flex flex-col gap-6 p-4">
      <Breadcrumb className="hidden md:block">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/superadmin">Admin</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/superadmin/organizations">Organizations</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{organization.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-primary/10">
            <Building2 className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{organization.name}</h1>
            <p className="text-muted-foreground">{organization.slug}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline">
            <a href={getMarketingSiteUrl(organization.slug, organization.websiteConfig)} target="_blank" rel="noopener noreferrer">
              <Globe className="mr-2 h-4 w-4" />
              Marketing Site
              <ExternalLink className="ml-2 h-3 w-3" />
            </a>
          </Button>
          <Button asChild variant="outline">
            <a href={getAdminDashboardSwitchUrl(organization.id, organization.name)}>
              <LayoutDashboard className="mr-2 h-4 w-4" />
              Admin Dashboard
              <ExternalLink className="ml-2 h-3 w-3" />
            </a>
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Link href={`/superadmin/organizations/${slug}/members`}>
          <Card className="cursor-pointer transition-colors hover:bg-muted/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Members</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{organization._count.members}</div>
              <p className="text-xs text-muted-foreground">Click to view roster</p>
            </CardContent>
          </Card>
        </Link>

        <Link href={`/superadmin/organizations/${slug}/invoices`}>
          <Card className="cursor-pointer transition-colors hover:bg-muted/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Invoices</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{organization._count.invoices}</div>
              <p className="text-xs text-muted-foreground">Click to view all</p>
            </CardContent>
          </Card>
        </Link>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Programs</CardTitle>
            <Globe className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{organization._count.programs}</div>
            <p className="text-xs text-muted-foreground">Active programs</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Families</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{organization._count.families}</div>
            <p className="text-xs text-muted-foreground">Registered families</p>
          </CardContent>
        </Card>
      </div>

      {/* Subscription Management */}
      <SubscriptionManager
        organizationId={organization.id}
        organizationName={organization.name}
        initialSubscription={organization.subscription ? {
          id: organization.subscription.id,
          planId: organization.subscription.planId,
          status: organization.subscription.status,
          billingCycle: organization.subscription.billingCycle,
          isLocked: organization.subscription.isLocked,
          lockedReason: organization.subscription.lockedReason,
          currentPeriodStart: organization.subscription.currentPeriodStart.toISOString(),
          currentPeriodEnd: organization.subscription.currentPeriodEnd.toISOString(),
          plan: {
            id: organization.subscription.plan.id,
            name: organization.subscription.plan.name,
            slug: organization.subscription.plan.slug,
            monthlyPrice: organization.subscription.plan.monthlyPrice.toString(),
          }
        } : null}
      />

      {/* Feature Overrides */}
      <FeatureOverrides
        organizationId={organization.id}
        organizationName={organization.name}
      />

      {/* Organization Details */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Organization Details</CardTitle>
            <CardDescription>Basic information about this organization</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Name</p>
                <p className="font-medium">{organization.name}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Slug</p>
                <p className="font-medium">{organization.slug}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Created</p>
                <p className="font-medium">{organization.createdAt.toLocaleDateString()}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Last Updated</p>
                <p className="font-medium">{organization.updatedAt.toLocaleDateString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Recent Members</CardTitle>
              <CardDescription>Latest members to join</CardDescription>
            </div>
            <Link 
              href={`/superadmin/organizations/${slug}/members`}
              className="text-sm text-primary hover:underline"
            >
              View all
            </Link>
          </CardHeader>
          <CardContent>
            {organization.members.length === 0 ? (
              <p className="text-sm text-muted-foreground">No members yet</p>
            ) : (
              <div className="space-y-3">
                {organization.members.map((member) => (
                  <div key={member.id} className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{member.user.name}</p>
                      <p className="text-sm text-muted-foreground">{member.user.email}</p>
                    </div>
                    <Badge variant={member.status === "ACTIVE" ? "default" : "secondary"}>
                      {member.role}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Invoices */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Recent Invoices</CardTitle>
            <CardDescription>Latest invoices for this organization</CardDescription>
          </div>
          <Link 
            href={`/superadmin/organizations/${slug}/invoices`}
            className="text-sm text-primary hover:underline"
          >
            View all
          </Link>
        </CardHeader>
        <CardContent>
          {organization.invoices.length === 0 ? (
            <p className="text-sm text-muted-foreground">No invoices yet</p>
          ) : (
            <div className="space-y-3">
              {organization.invoices.map((invoice) => (
                <div key={invoice.id} className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{invoice.reference}</p>
                    <p className="text-sm text-muted-foreground">
                      Due: {invoice.dueDate.toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">${invoice.total.toString()}</span>
                    <Badge 
                      variant={
                        invoice.status === "PAID" ? "default" : 
                        invoice.status === "OVERDUE" ? "destructive" : 
                        "secondary"
                      }
                    >
                      {invoice.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payment Methods (Adyen Integration) */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            <CardTitle>Payment Methods</CardTitle>
          </div>
          <CardDescription>Stored payment methods for subscription billing</CardDescription>
        </CardHeader>
        <CardContent>
          {organization.organizationPaymentMethods.length === 0 ? (
            <p className="text-sm text-muted-foreground">No payment methods on file</p>
          ) : (
            <div className="space-y-3">
              {organization.organizationPaymentMethods.map((method) => {
                const isExpired = method.expiryMonth && method.expiryYear ? 
                  new Date() > new Date(parseInt(method.expiryYear), parseInt(method.expiryMonth), 0) : false
                const isExpiringSoon = method.expiryMonth && method.expiryYear ? (() => {
                  const expiryDate = new Date(parseInt(method.expiryYear), parseInt(method.expiryMonth), 0)
                  const twoMonthsFromNow = new Date()
                  twoMonthsFromNow.setMonth(twoMonthsFromNow.getMonth() + 2)
                  return !isExpired && expiryDate <= twoMonthsFromNow
                })() : false

                return (
                  <div key={method.id} className={`flex items-center justify-between p-3 border rounded-lg ${
                    isExpired ? "border-destructive/50 bg-destructive/5" : 
                    isExpiringSoon ? "border-amber-500/50 bg-amber-500/5" : ""
                  }`}>
                    <div className="flex items-center gap-3">
                      <CreditCard className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium capitalize">{method.brand || method.type}</span>
                          <span className="text-muted-foreground">•••• {method.lastFour}</span>
                          {method.isDefault && (
                            <Badge variant="secondary" className="text-xs">Default</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          {method.expiryMonth && method.expiryYear && (
                            <span>Expires {method.expiryMonth}/{method.expiryYear.slice(-2)}</span>
                          )}
                          {method.holderName && (
                            <>
                              <span>•</span>
                              <span>{method.holderName}</span>
                            </>
                          )}
                        </div>
                        {isExpired && (
                          <div className="flex items-center gap-1 text-sm text-destructive mt-1">
                            <AlertTriangle className="h-3 w-3" />
                            <span>Card expired - billing may fail</span>
                          </div>
                        )}
                        {isExpiringSoon && !isExpired && (
                          <div className="flex items-center gap-1 text-sm text-amber-600 mt-1">
                            <AlertTriangle className="h-3 w-3" />
                            <span>Expiring soon</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Added {method.createdAt.toLocaleDateString()}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
