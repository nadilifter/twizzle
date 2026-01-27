import { db } from "@/lib/db"
import Link from "next/link"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Globe, Shield, ExternalLink } from "lucide-react"

// Helper to get proper site URL using middleware-compatible subdomain
function getSiteUrl(subdomain: string): string {
  const isLocal = process.env.NODE_ENV === 'development'
  if (isLocal) {
    return `http://${subdomain}.uplifterinc.localhost:3000`
  }
  return `https://${subdomain}.uplifterinc.com`
}

export default async function AdminDomainsPage() {
  // Fetch all website configs with their organizations
  const websiteConfigs = await db.websiteConfig.findMany({
    include: {
      organization: {
        select: {
          id: true,
          name: true,
          slug: true,
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  })

  // Fetch reserved domain count
  const reservedCount = await db.reservedDomain.count()

  // Stats
  const totalDomains = websiteConfigs.length
  const publishedDomains = websiteConfigs.filter(c => c.isPublished).length
  const customDomains = websiteConfigs.filter(c => c.domain).length

  return (
    <div className="flex flex-col gap-6 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Site Domains</h1>
          <p className="text-muted-foreground">
            View and manage all issued site domains across organizations
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/domains/reserved">
            <Shield className="mr-2 h-4 w-4" />
            Manage Reserved Domains
          </Link>
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Sites</CardTitle>
            <Globe className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalDomains}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Published</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{publishedDomains}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Custom Domains</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{customDomains}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Reserved Patterns</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{reservedCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* Domains Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Site Domains</CardTitle>
          <CardDescription>
            Sites configured by organizations with their subdomain and custom domain settings
          </CardDescription>
        </CardHeader>
        <CardContent>
          {websiteConfigs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No sites have been configured yet.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Organization</TableHead>
                  <TableHead>Subdomain</TableHead>
                  <TableHead>Custom Domain</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {websiteConfigs.map((config) => (
                  <TableRow key={config.id}>
                    <TableCell className="font-medium">
                      <Link 
                        href={`/admin/organizations/${config.organization.id}`}
                        className="text-primary hover:underline"
                      >
                        {config.organization.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {config.subdomain ? (
                        <code className="px-2 py-1 bg-muted rounded text-sm">
                          {config.subdomain}.uplifterinc.com
                        </code>
                      ) : (
                        <span className="text-muted-foreground">Not set</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {config.domain ? (
                        <code className="px-2 py-1 bg-muted rounded text-sm">
                          {config.domain}
                        </code>
                      ) : (
                        <span className="text-muted-foreground">Not set</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {config.isPublished ? (
                        <Badge variant="default" className="bg-green-600">Published</Badge>
                      ) : (
                        <Badge variant="secondary">Draft</Badge>
                      )}
                    </TableCell>
                    <TableCell>{config.createdAt.toLocaleDateString()}</TableCell>
                    <TableCell className="text-right">
                      {config.subdomain && config.isPublished && (
                        <Button variant="ghost" size="sm" asChild>
                          <a 
                            href={getSiteUrl(config.subdomain)}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
