"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Loader2, Eye, AlertCircle, CheckCircle2 } from "lucide-react"
import { getUserOrganizations } from "@/app/actions/organization"

interface Organization {
  id: string
  name: string
  slug: string
  logo: string | null
}

interface Coach {
  id: string
  name: string
  email: string
  avatar: string | null
  role: string
}

export default function ViewAsCoachPage() {
  const { data: session, update: updateSession } = useSession()
  const router = useRouter()
  
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [coaches, setCoaches] = useState<Coach[]>([])
  const [selectedOrgId, setSelectedOrgId] = useState<string>("")
  const [selectedCoachId, setSelectedCoachId] = useState<string>("")
  const [isLoadingOrgs, setIsLoadingOrgs] = useState(true)
  const [isLoadingCoaches, setIsLoadingCoaches] = useState(false)
  const [isStartingView, setIsStartingView] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Check if currently viewing as a coach
  const isCurrentlyViewing = !!(
    session?.user?.viewingAsCoachId && 
    session?.user?.viewingAsOrganizationId
  )

  // Load organizations on mount
  useEffect(() => {
    async function loadOrganizations() {
      try {
        const orgs = await getUserOrganizations()
        setOrganizations(orgs)
      } catch (err) {
        setError("Failed to load organizations")
        console.error(err)
      } finally {
        setIsLoadingOrgs(false)
      }
    }
    loadOrganizations()
  }, [])

  // Load coaches when organization is selected
  useEffect(() => {
    if (!selectedOrgId) {
      setCoaches([])
      setSelectedCoachId("")
      return
    }

    async function loadCoaches() {
      setIsLoadingCoaches(true)
      setError(null)
      try {
        const response = await fetch(`/api/superadmin/organizations/${selectedOrgId}/coaches`)
        if (!response.ok) {
          throw new Error("Failed to load coaches")
        }
        const data = await response.json()
        setCoaches(data.data || [])
      } catch (err) {
        setError("Failed to load coaches for this organization")
        console.error(err)
        setCoaches([])
      } finally {
        setIsLoadingCoaches(false)
      }
    }
    loadCoaches()
  }, [selectedOrgId])

  const selectedOrg = organizations.find(o => o.id === selectedOrgId)
  const selectedCoach = coaches.find(c => c.id === selectedCoachId)

  const handleStartViewing = async () => {
    if (!selectedOrgId || !selectedCoachId || !selectedOrg || !selectedCoach) {
      return
    }

    setIsStartingView(true)
    setError(null)

    try {
      // Update the session with impersonation data
      await updateSession({
        viewingAsCoachId: selectedCoach.id,
        viewingAsCoachName: selectedCoach.name,
        viewingAsOrganizationId: selectedOrg.id,
        viewingAsOrganizationName: selectedOrg.name,
      })

      // Redirect to coach portal
      router.push("/coach")
    } catch (err) {
      setError("Failed to start viewing as coach")
      console.error(err)
      setIsStartingView(false)
    }
  }

  const handleStopViewing = async () => {
    setIsStartingView(true)
    try {
      // Clear impersonation data from session
      await updateSession({
        viewingAsCoachId: "",
        viewingAsCoachName: "",
        viewingAsOrganizationId: "",
        viewingAsOrganizationName: "",
      })

      // Refresh the page
      router.refresh()
    } catch (err) {
      setError("Failed to stop viewing as coach")
      console.error(err)
    } finally {
      setIsStartingView(false)
    }
  }

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)
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
            <BreadcrumbPage>View as Coach</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div>
        <h1 className="text-2xl font-bold">View as Coach</h1>
        <p className="text-muted-foreground">
          Select an organization and coach to view the coaching portal from their perspective
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {isCurrentlyViewing && (
        <Alert>
          <CheckCircle2 className="h-4 w-4" />
          <AlertTitle>Currently Viewing as Coach</AlertTitle>
          <AlertDescription className="flex flex-col gap-2">
            <span>
              You are viewing as <strong>{session?.user?.viewingAsCoachName}</strong> in{" "}
              <strong>{session?.user?.viewingAsOrganizationName}</strong>
            </span>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleStopViewing}
              disabled={isStartingView}
              className="w-fit"
            >
              {isStartingView ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Stopping...
                </>
              ) : (
                "Stop Viewing as Coach"
              )}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Select Organization & Coach</CardTitle>
          <CardDescription>
            Choose which organization and coach to view the coaching portal as
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Organization Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Organization</label>
            {isLoadingOrgs ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading organizations...
              </div>
            ) : (
              <Select
                value={selectedOrgId}
                onValueChange={(value) => {
                  setSelectedOrgId(value)
                  setSelectedCoachId("")
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select an organization" />
                </SelectTrigger>
                <SelectContent>
                  {organizations.map((org) => (
                    <SelectItem key={org.id} value={org.id}>
                      <div className="flex items-center gap-2">
                        {org.logo ? (
                          <Avatar className="h-5 w-5">
                            <AvatarImage src={org.logo} />
                            <AvatarFallback className="text-[10px]">
                              {getInitials(org.name)}
                            </AvatarFallback>
                          </Avatar>
                        ) : null}
                        <span>{org.name}</span>
                        <span className="text-muted-foreground text-xs">({org.slug})</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Coach Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Coach</label>
            {!selectedOrgId ? (
              <p className="text-sm text-muted-foreground">
                Select an organization first
              </p>
            ) : isLoadingCoaches ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading coaches...
              </div>
            ) : coaches.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No coaches found in this organization
              </p>
            ) : (
              <Select
                value={selectedCoachId}
                onValueChange={setSelectedCoachId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a coach" />
                </SelectTrigger>
                <SelectContent>
                  {coaches.map((coach) => (
                    <SelectItem key={coach.id} value={coach.id}>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-5 w-5">
                          <AvatarImage src={coach.avatar || undefined} />
                          <AvatarFallback className="text-[10px]">
                            {getInitials(coach.name)}
                          </AvatarFallback>
                        </Avatar>
                        <span>{coach.name}</span>
                        <Badge variant="outline" className="ml-2 text-xs">
                          {coach.role}
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Preview of selection */}
          {selectedOrg && selectedCoach && (
            <div className="rounded-lg border bg-muted/50 p-4 space-y-3">
              <h4 className="font-medium text-sm">Preview</h4>
              <div className="flex items-center gap-4">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={selectedCoach.avatar || undefined} />
                  <AvatarFallback>{getInitials(selectedCoach.name)}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">{selectedCoach.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedCoach.email}
                  </p>
                </div>
                <Badge variant="secondary" className="ml-auto">
                  {selectedCoach.role}
                </Badge>
              </div>
              <div className="text-sm">
                <span className="text-muted-foreground">Organization: </span>
                <span className="font-medium">{selectedOrg.name}</span>
              </div>
            </div>
          )}
        </CardContent>
        <CardFooter>
          <Button
            onClick={handleStartViewing}
            disabled={!selectedOrgId || !selectedCoachId || isStartingView}
            className="w-full sm:w-auto"
          >
            {isStartingView ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Starting...
              </>
            ) : (
              <>
                <Eye className="mr-2 h-4 w-4" />
                View as Coach
              </>
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
