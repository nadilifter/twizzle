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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const organization = await db.organization.findUnique({
    where: { slug },
    select: { name: true }
  })
  
  return {
    title: organization ? `${organization.name} - Members | Superadmin` : 'Members | Superadmin'
  }
}

interface Props {
  params: Promise<{ slug: string }>
}

export default async function OrganizationMembersPage({ params }: Props) {
  const { slug } = await params
  
  const organization = await db.organization.findUnique({
    where: { slug },
    include: {
      members: {
        include: {
          user: true
        },
        orderBy: { joinedAt: 'desc' }
      }
    }
  })

  if (!organization) {
    notFound()
  }

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'ADMIN':
        return 'destructive'
      case 'COACH':
        return 'default'
      default:
        return 'secondary'
    }
  }

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'default'
      case 'INVITED':
        return 'outline'
      default:
        return 'secondary'
    }
  }

  return (
    <div className="flex flex-col gap-6 p-4">
      <Breadcrumb>
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
            <BreadcrumbLink asChild>
              <Link href={`/superadmin/organizations/${slug}`}>{organization.name}</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Members</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div>
        <h1 className="text-2xl font-bold">Members Roster</h1>
        <p className="text-muted-foreground">
          All members of {organization.name}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Members ({organization.members.length})</CardTitle>
          <CardDescription>
            Staff and coaches associated with this organization
          </CardDescription>
        </CardHeader>
        <CardContent>
          {organization.members.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No members found for this organization
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Joined</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {organization.members.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={member.user.avatar || undefined} />
                          <AvatarFallback className="text-xs">
                            {getInitials(member.user.name)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{member.user.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>{member.user.email}</TableCell>
                    <TableCell>
                      <Badge variant={getRoleBadgeVariant(member.role) as "default" | "destructive" | "secondary" | "outline"}>
                        {member.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusBadgeVariant(member.status) as "default" | "destructive" | "secondary" | "outline"}>
                        {member.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{member.joinedAt.toLocaleDateString()}</TableCell>
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
