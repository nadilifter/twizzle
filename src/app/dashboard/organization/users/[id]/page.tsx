"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import { format } from "date-fns"
import {
  ArrowLeft,
  Mail,
  Phone,
  Shield,
  Clock,
  Award,
  Calendar,
  Briefcase,
  Loader2,
  Save,
  Check,
  AlertCircle,
} from "lucide-react"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { toast } from "sonner"
import { useFeatures } from "@/components/feature-context"
import {
  PERMISSION_GROUPS,
  PERMISSION_FEATURE_MAP,
  ROLE_PERMISSIONS,
} from "@/lib/permissions"
import type { FeatureKey } from "@/lib/feature-toggles"

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

const CERTIFICATIONS_LIST = [
  "USAG Safety Certification",
  "CPR / First Aid",
  "SafeSport Trained",
  "Background Check Cleared",
]

interface MemberData {
  id: string
  organizationId: string
  userId: string
  role: string
  status: string
  joinedAt: string
  employmentType: string | null
  title: string | null
  hourlyRate: number | null
  hireDate: string | null
  certifications: Array<{ name: string; expiresAt?: string | null; verified?: boolean }> | null
  phone: string | null
  emergencyContact: { name: string; phone: string; relationship?: string } | null
  user: {
    id: string
    name: string
    email: string
    avatar: string | null
    phone: string | null
    status: string
    createdAt: string
    lastActiveAt: string | null
  }
  permissions: Array<{ id: string; permission: string }>
  availability: Array<{
    id: string
    dayOfWeek: number
    startTime: string
    endTime: string
    isAvailable: boolean
  }>
  shifts: Array<{
    id: string
    date: string
    startTime: string
    endTime: string
    shiftType: string
    status: string
    facility: { name: string } | null
  }>
  programAssignments: Array<{
    id: string
    role: string
    isPrimary: boolean
    program: { id: string; name: string }
  }>
  _count: {
    shifts: number
    eventAssignments: number
    programAssignments: number
  }
}

function isPermissionAvailable(
  permissionId: string,
  isFeatureEnabled: (key: FeatureKey) => boolean
): boolean {
  const requiredFeature = PERMISSION_FEATURE_MAP[permissionId as keyof typeof PERMISSION_FEATURE_MAP]
  if (!requiredFeature) return true
  return isFeatureEnabled(requiredFeature)
}

export default function UserDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { isFeatureEnabled } = useFeatures()
  const memberId = params.id as string

  const [member, setMember] = React.useState<MemberData | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [isSaving, setIsSaving] = React.useState(false)

  // Employment form state
  const [employmentType, setEmploymentType] = React.useState<string>("")
  const [title, setTitle] = React.useState("")
  const [hourlyRate, setHourlyRate] = React.useState("")
  const [hireDate, setHireDate] = React.useState("")
  const [phone, setPhone] = React.useState("")
  const [emergencyContactName, setEmergencyContactName] = React.useState("")
  const [emergencyContactPhone, setEmergencyContactPhone] = React.useState("")
  const [emergencyContactRelationship, setEmergencyContactRelationship] = React.useState("")

  // Certifications state
  const [certifications, setCertifications] = React.useState<
    Array<{ name: string; expiresAt: string; verified: boolean }>
  >([])

  // Permissions state
  const [selectedRole, setSelectedRole] = React.useState<string>("")
  const [selectedPermissions, setSelectedPermissions] = React.useState<string[]>([])

  // Availability state
  const [availability, setAvailability] = React.useState<
    Array<{ dayOfWeek: number; startTime: string; endTime: string; isAvailable: boolean }>
  >([])

  React.useEffect(() => {
    fetchMember()
  }, [memberId])

  const fetchMember = async () => {
    try {
      setIsLoading(true)
      const response = await fetch(`/api/organization/members/${memberId}`)
      if (!response.ok) throw new Error("Failed to fetch member")
      const data: MemberData = await response.json()
      setMember(data)
      populateFormState(data)
    } catch {
      toast.error("Failed to load user details")
      router.push("/dashboard/organization/users")
    } finally {
      setIsLoading(false)
    }
  }

  const populateFormState = (data: MemberData) => {
    setEmploymentType(data.employmentType || "")
    setTitle(data.title || "")
    setHourlyRate(data.hourlyRate?.toString() || "")
    setHireDate(data.hireDate ? data.hireDate.split("T")[0] : "")
    setPhone(data.phone || "")
    setEmergencyContactName(data.emergencyContact?.name || "")
    setEmergencyContactPhone(data.emergencyContact?.phone || "")
    setEmergencyContactRelationship(data.emergencyContact?.relationship || "")
    setCertifications(
      (data.certifications || []).map((c) => ({
        name: c.name,
        expiresAt: c.expiresAt || "",
        verified: c.verified || false,
      }))
    )
    setSelectedRole(data.role.toLowerCase())
    setSelectedPermissions(data.permissions.map((p) => p.permission))
    setAvailability(
      data.availability.map((a) => ({
        dayOfWeek: a.dayOfWeek,
        startTime: a.startTime,
        endTime: a.endTime,
        isAvailable: a.isAvailable,
      }))
    )
  }

  const handleSaveEmployment = async () => {
    setIsSaving(true)
    try {
      const response = await fetch(`/api/organization/members/${memberId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employmentType: employmentType || null,
          title: title || null,
          hourlyRate: hourlyRate ? parseFloat(hourlyRate) : null,
          hireDate: hireDate || null,
          phone: phone || null,
          emergencyContact:
            emergencyContactName && emergencyContactPhone
              ? {
                  name: emergencyContactName,
                  phone: emergencyContactPhone,
                  relationship: emergencyContactRelationship || undefined,
                }
              : null,
        }),
      })
      if (!response.ok) throw new Error("Failed to save")
      const updated = await response.json()
      setMember(updated)
      toast.success("Employment details saved")
    } catch {
      toast.error("Failed to save employment details")
    } finally {
      setIsSaving(false)
    }
  }

  const handleSaveCertifications = async () => {
    setIsSaving(true)
    try {
      const response = await fetch(`/api/organization/members/${memberId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          certifications: certifications.length > 0 ? certifications : null,
        }),
      })
      if (!response.ok) throw new Error("Failed to save")
      const updated = await response.json()
      setMember(updated)
      toast.success("Certifications saved")
    } catch {
      toast.error("Failed to save certifications")
    } finally {
      setIsSaving(false)
    }
  }

  const handleSavePermissions = async () => {
    setIsSaving(true)
    try {
      const response = await fetch(`/api/organization/members/${memberId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: selectedRole.toUpperCase(),
          permissions: selectedPermissions,
        }),
      })
      if (!response.ok) throw new Error("Failed to save")
      const updated = await response.json()
      setMember(updated)
      toast.success("Permissions saved")
    } catch {
      toast.error("Failed to save permissions")
    } finally {
      setIsSaving(false)
    }
  }

  const handleSaveAvailability = async () => {
    setIsSaving(true)
    try {
      const response = await fetch(`/api/organization/members/${memberId}/availability`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(availability),
      })
      if (!response.ok) throw new Error("Failed to save")
      toast.success("Availability saved")
    } catch {
      toast.error("Failed to save availability")
    } finally {
      setIsSaving(false)
    }
  }

  const handleRoleChange = (roleId: string) => {
    setSelectedRole(roleId)
    if (roleId !== "custom") {
      const roleKey = roleId.toUpperCase()
      const permissions = (ROLE_PERMISSIONS[roleKey] || []).filter((p) =>
        isPermissionAvailable(p, isFeatureEnabled)
      )
      setSelectedPermissions([...permissions])
    }
  }

  const togglePermission = (permId: string) => {
    setSelectedPermissions((prev) =>
      prev.includes(permId) ? prev.filter((p) => p !== permId) : [...prev, permId]
    )
  }

  const toggleCertification = (certName: string) => {
    setCertifications((prev) => {
      const existing = prev.find((c) => c.name === certName)
      if (existing) {
        return prev.filter((c) => c.name !== certName)
      }
      return [...prev, { name: certName, expiresAt: "", verified: false }]
    })
  }

  const updateAvailabilityDay = (
    dayOfWeek: number,
    field: string,
    value: string | boolean
  ) => {
    setAvailability((prev) => {
      const existing = prev.find((a) => a.dayOfWeek === dayOfWeek)
      if (existing) {
        return prev.map((a) =>
          a.dayOfWeek === dayOfWeek ? { ...a, [field]: value } : a
        )
      }
      return [
        ...prev,
        {
          dayOfWeek,
          startTime: "09:00",
          endTime: "17:00",
          isAvailable: true,
          [field]: value,
        },
      ]
    })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!member) return null

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/organization/users">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex items-center gap-4 flex-1">
          <Avatar className="h-16 w-16 border-2 border-background shadow">
            <AvatarImage src={member.user.avatar || undefined} alt={member.user.name} />
            <AvatarFallback className="text-lg">
              {member.user.name.split(" ").map((n) => n[0]).join("")}
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{member.user.name}</h1>
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Mail className="h-3.5 w-3.5" />
                {member.user.email}
              </span>
              {(member.phone || member.user.phone) && (
                <span className="flex items-center gap-1">
                  <Phone className="h-3.5 w-3.5" />
                  {member.phone || member.user.phone}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="secondary" className="capitalize">{member.role.toLowerCase()}</Badge>
              {member.title && <Badge variant="outline">{member.title}</Badge>}
              {member.employmentType && (
                <Badge variant="outline" className="capitalize">
                  {member.employmentType.toLowerCase().replace("_", " ")}
                </Badge>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Programs</div>
            <div className="text-2xl font-bold">{member._count.programAssignments}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Events</div>
            <div className="text-2xl font-bold">{member._count.eventAssignments}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Shifts</div>
            <div className="text-2xl font-bold">{member._count.shifts}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Joined</div>
            <div className="text-lg font-semibold" suppressHydrationWarning>
              {format(new Date(member.joinedAt), "MMM yyyy")}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile" className="gap-1.5">
            <Shield className="h-4 w-4" /> Profile & Permissions
          </TabsTrigger>
          <TabsTrigger value="employment" className="gap-1.5">
            <Briefcase className="h-4 w-4" /> Employment
          </TabsTrigger>
          <TabsTrigger value="certifications" className="gap-1.5">
            <Award className="h-4 w-4" /> Certifications
          </TabsTrigger>
          <TabsTrigger value="availability" className="gap-1.5">
            <Clock className="h-4 w-4" /> Availability
          </TabsTrigger>
          <TabsTrigger value="schedule" className="gap-1.5">
            <Calendar className="h-4 w-4" /> Schedule
          </TabsTrigger>
        </TabsList>

        {/* Profile & Permissions Tab */}
        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle>Role & Permissions</CardTitle>
              <CardDescription>
                Configure the role template and granular permissions for this user in this organization.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label className="text-base">Role Template</Label>
                  <p className="text-xs text-muted-foreground">Select a role to pre-fill permissions</p>
                </div>
                <Select value={selectedRole} onValueChange={handleRoleChange}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="coach">Coach</SelectItem>
                    <SelectItem value="accountant">Accountant</SelectItem>
                    <SelectItem value="volunteer">Volunteer</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              <div className="space-y-4">
                <Label className="text-base">Granular Permissions</Label>
                {PERMISSION_GROUPS.map((group) => {
                  const availableItems = group.items.filter((perm) =>
                    isPermissionAvailable(perm.id, isFeatureEnabled)
                  )
                  if (availableItems.length === 0) return null
                  return (
                    <div key={group.category} className="space-y-3">
                      <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                        {group.category}
                      </h4>
                      <div className="grid grid-cols-1 gap-2">
                        {availableItems.map((perm) => {
                          const isChecked =
                            selectedPermissions.includes(perm.id) ||
                            selectedPermissions.includes("*")
                          return (
                            <div
                              key={perm.id}
                              className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm"
                            >
                              <div className="space-y-0.5">
                                <Label
                                  htmlFor={`perm-detail-${perm.id}`}
                                  className="text-base font-medium cursor-pointer"
                                >
                                  {perm.label}
                                </Label>
                                <p className="text-sm text-muted-foreground">{perm.description}</p>
                              </div>
                              <Switch
                                id={`perm-detail-${perm.id}`}
                                checked={isChecked}
                                onCheckedChange={() => togglePermission(perm.id)}
                                disabled={selectedPermissions.includes("*")}
                              />
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="flex justify-end">
                <Button onClick={handleSavePermissions} disabled={isSaving}>
                  {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Save Permissions
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Employment Tab */}
        <TabsContent value="employment">
          <Card>
            <CardHeader>
              <CardTitle>Employment Details</CardTitle>
              <CardDescription>
                Manage employment information for this user at this organization.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Job Title</Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g., Head Coach"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="employmentType">Employment Type</Label>
                  <Select value={employmentType} onValueChange={setEmploymentType}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="FULL_TIME">Full Time</SelectItem>
                      <SelectItem value="PART_TIME">Part Time</SelectItem>
                      <SelectItem value="CONTRACTOR">Contractor</SelectItem>
                      <SelectItem value="VOLUNTEER">Volunteer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="hourlyRate">Hourly Rate ($)</Label>
                  <Input
                    id="hourlyRate"
                    type="number"
                    step="0.01"
                    value={hourlyRate}
                    onChange={(e) => setHourlyRate(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="hireDate">Hire Date</Label>
                  <Input
                    id="hireDate"
                    type="date"
                    value={hireDate}
                    onChange={(e) => setHireDate(e.target.value)}
                  />
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                  Contact Override
                </h4>
                <div className="space-y-2">
                  <Label htmlFor="memberPhone">Work Phone</Label>
                  <Input
                    id="memberPhone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Work phone number"
                  />
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                  Emergency Contact
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Name</Label>
                    <Input
                      value={emergencyContactName}
                      onChange={(e) => setEmergencyContactName(e.target.value)}
                      placeholder="Contact name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone</Label>
                    <Input
                      value={emergencyContactPhone}
                      onChange={(e) => setEmergencyContactPhone(e.target.value)}
                      placeholder="Contact phone"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Relationship</Label>
                    <Input
                      value={emergencyContactRelationship}
                      onChange={(e) => setEmergencyContactRelationship(e.target.value)}
                      placeholder="e.g., Spouse"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={handleSaveEmployment} disabled={isSaving}>
                  {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Save Employment
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Certifications Tab */}
        <TabsContent value="certifications">
          <Card>
            <CardHeader>
              <CardTitle>Certifications</CardTitle>
              <CardDescription>
                Track certifications and their expiration dates.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {CERTIFICATIONS_LIST.map((certName) => {
                const cert = certifications.find((c) => c.name === certName)
                const isActive = !!cert
                return (
                  <div
                    key={certName}
                    className="flex flex-row items-center justify-between rounded-lg border p-4"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <div
                        className={`flex items-center justify-center h-8 w-8 rounded-full ${
                          isActive ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {isActive ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <AlertCircle className="h-4 w-4" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium">{certName}</div>
                        {isActive && cert.expiresAt && (
                          <div className="text-xs text-muted-foreground" suppressHydrationWarning>
                            Expires: {format(new Date(cert.expiresAt), "MMM d, yyyy")}
                          </div>
                        )}
                      </div>
                      {isActive && (
                        <Input
                          type="date"
                          className="w-40"
                          value={cert.expiresAt}
                          onChange={(e) => {
                            setCertifications((prev) =>
                              prev.map((c) =>
                                c.name === certName ? { ...c, expiresAt: e.target.value } : c
                              )
                            )
                          }}
                          placeholder="Expiry date"
                        />
                      )}
                    </div>
                    <Switch
                      checked={isActive}
                      onCheckedChange={() => toggleCertification(certName)}
                    />
                  </div>
                )
              })}

              <div className="flex justify-end pt-4">
                <Button onClick={handleSaveCertifications} disabled={isSaving}>
                  {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Save Certifications
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Availability Tab */}
        <TabsContent value="availability">
          <Card>
            <CardHeader>
              <CardTitle>Weekly Availability</CardTitle>
              <CardDescription>
                Set available hours for each day of the week.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {DAYS.map((day, idx) => {
                const dayAvail = availability.find((a) => a.dayOfWeek === idx)
                const isAvailable = dayAvail?.isAvailable ?? false
                return (
                  <div
                    key={day}
                    className="flex flex-row items-center gap-4 rounded-lg border p-3"
                  >
                    <div className="w-28 font-medium text-sm">{day}</div>
                    <Switch
                      checked={isAvailable}
                      onCheckedChange={(checked) =>
                        updateAvailabilityDay(idx, "isAvailable", checked)
                      }
                    />
                    {isAvailable && (
                      <>
                        <Input
                          type="time"
                          className="w-32"
                          value={dayAvail?.startTime || "09:00"}
                          onChange={(e) =>
                            updateAvailabilityDay(idx, "startTime", e.target.value)
                          }
                        />
                        <span className="text-muted-foreground">to</span>
                        <Input
                          type="time"
                          className="w-32"
                          value={dayAvail?.endTime || "17:00"}
                          onChange={(e) =>
                            updateAvailabilityDay(idx, "endTime", e.target.value)
                          }
                        />
                      </>
                    )}
                  </div>
                )
              })}

              <div className="flex justify-end pt-4">
                <Button onClick={handleSaveAvailability} disabled={isSaving}>
                  {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Save Availability
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Schedule Tab */}
        <TabsContent value="schedule">
          <div className="space-y-6">
            {/* Program Assignments */}
            <Card>
              <CardHeader>
                <CardTitle>Program Assignments</CardTitle>
              </CardHeader>
              <CardContent>
                {member.programAssignments.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    Not assigned to any programs.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {member.programAssignments.map((pa) => (
                      <div key={pa.id} className="flex items-center justify-between rounded-lg border p-3">
                        <div>
                          <span className="font-medium">{pa.program.name}</span>
                          {pa.isPrimary && (
                            <Badge variant="secondary" className="ml-2">Primary</Badge>
                          )}
                        </div>
                        <Badge variant="outline" className="capitalize">
                          {pa.role.toLowerCase().replace("_", " ")}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recent Shifts */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Shifts</CardTitle>
              </CardHeader>
              <CardContent>
                {member.shifts.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    No shifts scheduled.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {member.shifts.map((shift) => (
                      <div key={shift.id} className="flex items-center justify-between rounded-lg border p-3">
                        <div>
                          <span className="font-medium" suppressHydrationWarning>
                            {format(new Date(shift.date), "EEE, MMM d")}
                          </span>
                          <span className="text-muted-foreground ml-2">
                            {shift.startTime} - {shift.endTime}
                          </span>
                          {shift.facility && (
                            <span className="text-muted-foreground ml-2">
                              @ {shift.facility.name}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{shift.shiftType}</Badge>
                          <Badge
                            variant={shift.status === "COMPLETED" ? "secondary" : "outline"}
                            className="capitalize"
                          >
                            {shift.status.toLowerCase()}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
