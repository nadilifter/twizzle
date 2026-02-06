import { db } from "@/lib/db"
import Link from "next/link"
import { notFound } from "next/navigation"
import { formatDistanceToNow } from "date-fns"
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { 
  User as UserIcon, 
  Building2, 
  Mail, 
  Calendar, 
  Clock, 
  Shield,
  ExternalLink,
  LayoutDashboard,
} from "lucide-react"

interface Props {
  params: Promise<{ id: string }>
}

// Helper function for role badge variants
const getRoleBadgeVariant = (role: string, isSuperAdmin: boolean): "default" | "secondary" | "destructive" | "outline" => {
  if (isSuperAdmin) return "destructive"
  switch (role) {
    case "ADMIN":
      return "destructive"
    case "COACH":
    case "STAFF":
      return "default"
    case "VOLUNTEER":
    case "ACCOUNTANT":
    case "PARENT":
      return "secondary"
    case "CUSTOM":
      return "outline"
    default:
      return "secondary"
  }
}

// Helper function for status badge variants
const getStatusBadgeVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
  switch (status) {
    case "ACTIVE":
      return "default"
    case "INVITED":
      return "outline"
    case "INACTIVE":
      return "secondary"
    default:
      return "secondary"
  }
}

// Helper function for initials
const getInitials = (name: string) => {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

// Format last active date
const formatLastActive = (date: Date | null) => {
  if (!date) return "Never"
  try {
    return formatDistanceToNow(date, { addSuffix: true })
  } catch {
    return "Unknown"
  }
}

import { getSubdomainUrl } from "@/lib/env-domains"

function getImpersonationUrl(userId: string, userName: string): string {
  const adminBase = getSubdomainUrl('admin')
  return `${adminBase}/dashboard/impersonate?userId=${encodeURIComponent(userId)}&userName=${encodeURIComponent(userName)}`
}

export default async function UserDetailPage({ params }: Props) {
  const { id } = await params
  
  const user = await db.user.findUnique({
    where: { id },
    include: {
      memberships: {
        include: {
          organization: true
        },
        orderBy: { joinedAt: 'desc' }
      },
      _count: {
        select: {
          memberships: true,
        }
      }
    }
  })

  if (!user) {
    notFound()
  }

  const displayRole = user.isSuperAdmin ? "Super Admin" : user.role

  return (
    <div className="flex flex-col gap-6 p-4">
      {/* Breadcrumb */}
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
              <Link href="/superadmin/users">Users</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{user.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Avatar className="h-16 w-16">
            <AvatarImage src={user.avatar || undefined} />
            <AvatarFallback className="text-lg">
              {getInitials(user.name)}
            </AvatarFallback>
          </Avatar>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{user.name}</h1>
              <Badge variant={getRoleBadgeVariant(user.role, user.isSuperAdmin)}>
                {displayRole}
              </Badge>
              <Badge variant={getStatusBadgeVariant(user.status)}>
                {user.status}
              </Badge>
            </div>
            <p className="text-muted-foreground">{user.email}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!user.isSuperAdmin && (
            <Button asChild variant="outline">
              <a href={getImpersonationUrl(user.id, user.name)}>
                <LayoutDashboard className="mr-2 h-4 w-4" />
                View as User
                <ExternalLink className="ml-2 h-3 w-3" />
              </a>
            </Button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Organizations</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{user._count.memberships}</div>
            <p className="text-xs text-muted-foreground">
              Organization memberships
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Platform Role</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{displayRole}</div>
            <p className="text-xs text-muted-foreground">
              Base platform permissions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Last Active</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {user.lastActiveAt ? formatLastActive(user.lastActiveAt) : "Never"}
            </div>
            <p className="text-xs text-muted-foreground">
              Last login activity
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Member Since</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {user.createdAt.toLocaleDateString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Account created
            </p>
          </CardContent>
        </Card>
      </div>

      {/* User Details & Memberships */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* User Details Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserIcon className="h-5 w-5" />
              User Details
            </CardTitle>
            <CardDescription>Account information and settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Full Name</p>
                <p className="font-medium">{user.name}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Email</p>
                <div className="flex items-center gap-1">
                  <Mail className="h-3 w-3 text-muted-foreground" />
                  <p className="font-medium">{user.email}</p>
                </div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Platform Role</p>
                <Badge variant={getRoleBadgeVariant(user.role, user.isSuperAdmin)}>
                  {displayRole}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Status</p>
                <Badge variant={getStatusBadgeVariant(user.status)}>
                  {user.status}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Created</p>
                <p className="font-medium">{user.createdAt.toLocaleDateString()}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Last Updated</p>
                <p className="font-medium">{user.updatedAt.toLocaleDateString()}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Last Active</p>
                <p className="font-medium">
                  {user.lastActiveAt 
                    ? `${user.lastActiveAt.toLocaleDateString()} (${formatLastActive(user.lastActiveAt)})`
                    : "Never"
                  }
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Super Admin</p>
                <p className="font-medium">{user.isSuperAdmin ? "Yes" : "No"}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Organization Memberships Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Organization Memberships
            </CardTitle>
            <CardDescription>
              Organizations this user belongs to ({user.memberships.length})
            </CardDescription>
          </CardHeader>
          <CardContent>
            {user.memberships.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                This user is not a member of any organizations
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Organization</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Joined</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {user.memberships.map((membership) => (
                    <TableRow key={membership.id}>
                      <TableCell>
                        <Link 
                          href={`/superadmin/organizations/${membership.organization.slug}`}
                          className="font-medium hover:underline"
                        >
                          {membership.organization.name}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getRoleBadgeVariant(membership.role, false)}>
                          {membership.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {membership.joinedAt.toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
