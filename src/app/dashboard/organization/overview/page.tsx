"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Building2,
  Mail,
  Phone,
  MapPin,
  Trophy,
  Users,
  BookOpen,
  Loader2,
  Check,
} from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

interface OrgDetails {
  id: string
  name: string
  slug: string
  email: string | null
  phone: string | null
  street: string | null
  city: string | null
  stateProvince: string | null
  postalCode: string | null
  country: string | null
  createdAt: string
  _count: {
    members: number
    athletes: number
    programs: number
  }
  subscription: {
    status: string
    plan: {
      name: string
    }
  } | null
  sports: {
    sport: Sport
  }[]
}

interface Sport {
  id: string
  name: string
  slug: string
  description: string | null
  icon: string | null
}

export default function OrganizationOverviewPage() {
  const [orgDetails, setOrgDetails] = useState<OrgDetails | null>(null)
  const [allSports, setAllSports] = useState<Sport[]>([])
  const [selectedSportIds, setSelectedSportIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [savingSports, setSavingSports] = useState(false)
  const [sportsChanged, setSportsChanged] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      const [orgRes, sportsRes, allSportsRes] = await Promise.all([
        fetch("/api/organization/details"),
        fetch("/api/organization/sports"),
        fetch("/api/sports"),
      ])

      if (orgRes.ok) {
        const org = await orgRes.json()
        setOrgDetails(org)
      }

      if (sportsRes.ok) {
        const orgSports: Sport[] = await sportsRes.json()
        setSelectedSportIds(orgSports.map((s) => s.id))
      }

      if (allSportsRes.ok) {
        const sports: Sport[] = await allSportsRes.json()
        setAllSports(sports)
      }
    } catch (error) {
      toast.error("Failed to load organization details")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleSportToggle = (sportId: string, checked: boolean) => {
    setSelectedSportIds((prev) => {
      const updated = checked
        ? [...prev, sportId]
        : prev.filter((id) => id !== sportId)
      return updated
    })
    setSportsChanged(true)
  }

  const handleSaveSports = async () => {
    setSavingSports(true)
    try {
      const response = await fetch("/api/organization/sports", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sportIds: selectedSportIds }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to update sports")
      }

      const updatedSports: Sport[] = await response.json()
      setSelectedSportIds(updatedSports.map((s) => s.id))
      setSportsChanged(false)
      toast.success("Sports updated successfully")
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update sports"
      )
    } finally {
      setSavingSports(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-6 p-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    )
  }

  if (!orgDetails) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground">
          Unable to load organization details.
        </p>
      </div>
    )
  }

  const address = [
    orgDetails.street,
    orgDetails.city,
    orgDetails.stateProvince,
    orgDetails.postalCode,
    orgDetails.country,
  ]
    .filter(Boolean)
    .join(", ")

  return (
    <div className="flex flex-col gap-6 p-4">
      <div>
        <h1 className="text-2xl font-bold">Organization Overview</h1>
        <p className="text-muted-foreground">
          View and manage your organization details.
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Members</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{orgDetails._count.members}</div>
            <p className="text-xs text-muted-foreground">Active team members</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Athletes</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{orgDetails._count.athletes}</div>
            <p className="text-xs text-muted-foreground">Registered athletes</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Programs</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{orgDetails._count.programs}</div>
            <p className="text-xs text-muted-foreground">Active programs</p>
          </CardContent>
        </Card>
      </div>

      {/* Organization Details */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            <CardTitle>Organization Details</CardTitle>
          </div>
          <CardDescription>Basic information about your organization</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-sm text-muted-foreground">Organization Name</p>
              <p className="font-medium">{orgDetails.name}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Subdomain</p>
              <p className="font-medium font-mono">{orgDetails.slug}</p>
            </div>
            {orgDetails.email && (
              <div className="flex items-start gap-2">
                <Mail className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="font-medium">{orgDetails.email}</p>
                </div>
              </div>
            )}
            {orgDetails.phone && (
              <div className="flex items-start gap-2">
                <Phone className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Phone</p>
                  <p className="font-medium">{orgDetails.phone}</p>
                </div>
              </div>
            )}
            {address && (
              <div className="flex items-start gap-2 sm:col-span-2">
                <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Address</p>
                  <p className="font-medium">{address}</p>
                </div>
              </div>
            )}
            {orgDetails.subscription && (
              <div>
                <p className="text-sm text-muted-foreground">Subscription Plan</p>
                <div className="flex items-center gap-2">
                  <p className="font-medium">{orgDetails.subscription.plan.name}</p>
                  <Badge
                    variant={
                      orgDetails.subscription.status === "ACTIVE"
                        ? "default"
                        : orgDetails.subscription.status === "TRIALING"
                          ? "secondary"
                          : "destructive"
                    }
                  >
                    {orgDetails.subscription.status}
                  </Badge>
                </div>
              </div>
            )}
            <div>
              <p className="text-sm text-muted-foreground">Member Since</p>
              <p className="font-medium">
                {new Date(orgDetails.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sports Selection */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-primary" />
              <CardTitle>Sports Offered</CardTitle>
            </div>
            {sportsChanged && (
              <Button onClick={handleSaveSports} disabled={savingSports} size="sm">
                {savingSports ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Check className="mr-2 h-4 w-4" />
                )}
                Save Changes
              </Button>
            )}
          </div>
          <CardDescription>
            Select the sports your organization offers. This helps tailor the
            platform experience for your needs.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {allSports.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No sports have been configured by the platform yet.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {allSports.map((sport) => {
                const isSelected = selectedSportIds.includes(sport.id)
                return (
                  <label
                    key={sport.id}
                    className={cn(
                      "flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors",
                      isSelected
                        ? "border-primary bg-primary/5"
                        : "hover:bg-muted/50"
                    )}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={(checked) =>
                        handleSportToggle(sport.id, !!checked)
                      }
                      className="mt-0.5"
                    />
                    <div className="flex-1 space-y-0.5">
                      <span className="font-medium text-sm">{sport.name}</span>
                      {sport.description && (
                        <p className="text-xs text-muted-foreground">
                          {sport.description}
                        </p>
                      )}
                    </div>
                  </label>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
