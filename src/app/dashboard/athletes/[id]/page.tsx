"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ShieldAlert, Phone as PhoneIcon, FileHeart, CalendarCheck, CalendarX, User, Mail, CalendarDays, Trophy, TrendingUp, Star, FileText, ChevronDown, Plus, Loader2, AlertCircle, ArrowLeft, Heart } from "lucide-react"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { useAthlete } from "@/hooks/use-athletes"
import { useBreadcrumbOverride } from "@/components/breadcrumb-context"
import { useLevels } from "@/hooks/use-levels"
import { useAthleteMedicalInfo } from "@/hooks/use-medical"
import { MedicalDisplay, MedicalAlertBadge } from "@/components/medical/medical-display"
import { MedicalForm } from "@/components/medical/medical-form"
import { useFeatures } from "@/components/feature-context"
import { toast } from "sonner"
import Link from "next/link"
import { AthleteConfiguration } from "../athlete-configuration"

// Transform status for display
function formatStatus(status: string): string {
  return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase()
}

// Format date for display
function formatDate(dateString: string | null): string {
  if (!dateString) return "N/A"
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

// Format attendance status for display
function formatAttendanceStatus(status: string): string {
  const map: Record<string, string> = {
    PRESENT: "Present",
    ABSENT: "Absent",
    LATE: "Late",
    EXCUSED: "Excused",
  }
  return map[status] ?? status
}

export default function AthleteProfilePage() {
  const params = useParams()
  const router = useRouter()
  const athleteId = typeof params.id === "string" ? params.id : null
  const { isFeatureEnabled } = useFeatures()
  const trainingEnabled = isFeatureEnabled("training")
  
  const { athlete, isLoading, error, fetchAthlete, updateAthlete } = useAthlete(athleteId)
  const { levels: configuredLevels } = useLevels()
  const { 
    medicalInfo, 
    customQuestions, 
    config: medicalConfig, 
    isLoading: medicalLoading,
    isSaving: medicalSaving,
    saveMedicalInfo 
  } = useAthleteMedicalInfo(athleteId)
  const [isEditingMedical, setIsEditingMedical] = React.useState(false)
  const [isEditOpen, setIsEditOpen] = React.useState(false)

  const levelColor = React.useMemo(() => {
    if (!athlete) return null
    return configuredLevels.find((l) => l.name === athlete.level)?.color ?? null
  }, [athlete, configuredLevels])

  useBreadcrumbOverride(
    athlete ? `/dashboard/athletes/${athleteId}` : undefined,
    athlete?.name,
  )

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full p-6">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-muted-foreground">Loading athlete profile...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 gap-4">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <h1 className="text-2xl font-bold">Error Loading Profile</h1>
        <p className="text-muted-foreground">{error}</p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Go Back
          </Button>
          <Button onClick={() => fetchAthlete()}>Try Again</Button>
        </div>
      </div>
    )
  }

  // Not found state
  if (!athlete) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6">
        <h1 className="text-2xl font-bold">Athlete Not Found</h1>
        <p className="text-muted-foreground">The athlete you are looking for does not exist.</p>
        <Button className="mt-4" variant="outline" asChild>
          <Link href="/dashboard/athletes">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Athletes
          </Link>
        </Button>
      </div>
    )
  }

  // Calculate stats from real data
  const totalAttendances = athlete.attendances?.length ?? 0
  const presentCount = athlete.attendances?.filter(a => a.status === "PRESENT" || a.status === "LATE").length ?? 0
  const attendanceRate = totalAttendances > 0 ? Math.round((presentCount / totalAttendances) * 100) : 0
  
  const evaluationsCount = athlete.evaluations?.length ?? 0
  const latestEvaluation = athlete.evaluations?.[0]

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Back button */}
      <div>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/athletes">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Athletes
          </Link>
        </Button>
      </div>

      {/* Header Section */}
      <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
        <div className="flex flex-col md:flex-row gap-6 items-start">
          <Avatar className="h-24 w-24 border-4 border-background shadow-sm">
            <AvatarImage src={athlete.avatar ?? undefined} alt={athlete.name} />
            <AvatarFallback>{athlete.name.split(" ").map(n => n[0]).join("")}</AvatarFallback>
          </Avatar>
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight">{athlete.name}</h1>
            <div className="flex items-center gap-2 text-muted-foreground">
              {levelColor ? (
                <Badge
                  variant="outline"
                  className="rounded-md"
                  style={{ borderColor: levelColor, color: levelColor, backgroundColor: `${levelColor}15` }}
                >
                  {athlete.level}
                </Badge>
              ) : (
                <Badge variant="outline" className="rounded-md">{athlete.level}</Badge>
              )}
              <span>•</span>
              <Badge variant={athlete.status === "ACTIVE" ? "default" : "secondary"}>
                {formatStatus(athlete.status)}
              </Badge>
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground pt-1">
              {athlete.email && (
                <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> {athlete.email}</span>
              )}
              <span className="flex items-center gap-1">
                <User className="h-3 w-3" /> Parent: {athlete.family?.primaryContact ?? "N/A"}
              </span>
            </div>
            {athlete.birthDate && (
              <p className="text-sm text-muted-foreground">
                <CalendarDays className="h-3 w-3 inline mr-1" />
                Born: {formatDate(athlete.birthDate)}
              </p>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsEditOpen(true)}>Edit Profile</Button>
          <Button>Contact</Button>
        </div>
      </div>

      <Sheet open={isEditOpen} onOpenChange={setIsEditOpen}>
        <SheetContent className="sm:max-w-2xl p-0">
          <AthleteConfiguration
            athlete={{
              id: athlete.id,
              name: athlete.name,
              firstName: athlete.firstName,
              lastName: athlete.lastName,
              email: athlete.email,
              level: athlete.level,
              status: athlete.status as "ACTIVE" | "INACTIVE" | "TRIAL" | "GRADUATED",
              birthDate: athlete.birthDate,
              gender: athlete.gender ?? null,
              family: athlete.family ? { id: athlete.family.id, name: athlete.family.name } : null,
            }}
            onClose={() => setIsEditOpen(false)}
            onUpdated={async (data) => {
              await updateAthlete(data)
            }}
          />
        </SheetContent>
      </Sheet>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Attendance Rate</CardTitle>
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{attendanceRate}%</div>
            <p className="text-xs text-muted-foreground">
              {presentCount} of {totalAttendances} sessions
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Evaluations</CardTitle>
            <Trophy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{evaluationsCount}</div>
            <p className="text-xs text-muted-foreground">
              {latestEvaluation ? `Latest: ${formatDate(latestEvaluation.date)}` : "No evaluations yet"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Programs</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {athlete.enrollments?.filter(e => e.status === "ACTIVE").length ?? 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {athlete.enrollments?.length ?? 0} total enrollments
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Family Balance</CardTitle>
            <Star className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${Number(athlete.family?.balance ?? 0).toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">
              {athlete.lineItems?.length ?? 0} recent charges
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="medical" className="gap-1">
            <Heart className="h-4 w-4" />
            Medical
          </TabsTrigger>
          <TabsTrigger value="enrollments">Programs</TabsTrigger>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          {trainingEnabled && <TabsTrigger value="evaluations">Evaluations</TabsTrigger>}
          <TabsTrigger value="billing">Billing</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Family Information</CardTitle>
                <CardDescription>Contact and billing information</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Family Name</p>
                    <p className="font-medium">{athlete.family?.name ?? "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Primary Contact</p>
                    <p className="font-medium">{athlete.family?.primaryContact ?? "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Email</p>
                    <p className="font-medium">{athlete.family?.email ?? "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Phone</p>
                    <p className="font-medium">{athlete.family?.phone ?? "N/A"}</p>
                  </div>
                </div>
                {athlete.family?.address && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Address</p>
                    <p className="font-medium">{athlete.family.address}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Active Enrollments</CardTitle>
                <CardDescription>Current program memberships</CardDescription>
              </CardHeader>
              <CardContent>
                {athlete.enrollments && athlete.enrollments.length > 0 ? (
                  <div className="space-y-3">
                    {athlete.enrollments.filter(e => e.status === "ACTIVE").map((enrollment) => (
                      <div key={enrollment.id} className="flex items-center justify-between border-b pb-3 last:border-0 last:pb-0">
                        <div>
                          <p className="font-medium">{enrollment.program?.name ?? "Unknown Program"}</p>
                          <p className="text-sm text-muted-foreground">
                            Started {formatDate(enrollment.startDate)}
                          </p>
                        </div>
                        <Badge variant="default">Active</Badge>
                      </div>
                    ))}
                    {athlete.enrollments.filter(e => e.status === "ACTIVE").length === 0 && (
                      <p className="text-muted-foreground text-center py-4">No active enrollments</p>
                    )}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-4">No enrollments found</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="medical" className="space-y-4">
          {medicalLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : isEditingMedical ? (
            <MedicalForm
              medicalInfo={medicalInfo}
              config={medicalConfig}
              customQuestions={customQuestions}
              onSave={async (data) => {
                const success = await saveMedicalInfo(data);
                if (success) {
                  toast.success("Medical information saved");
                  setIsEditingMedical(false);
                } else {
                  toast.error("Failed to save medical information");
                }
                return success;
              }}
              isSaving={medicalSaving}
              onCancel={() => setIsEditingMedical(false)}
            />
          ) : (
            <div className="space-y-4">
              <div className="flex justify-end">
                <Button onClick={() => setIsEditingMedical(true)}>
                  Edit Medical Info
                </Button>
              </div>
              <MedicalDisplay
                medicalInfo={medicalInfo}
                config={medicalConfig}
                showEmptyState={true}
              />
            </div>
          )}
        </TabsContent>

        <TabsContent value="enrollments" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Program Enrollments</CardTitle>
              <CardDescription>All program memberships for this athlete</CardDescription>
            </CardHeader>
            <CardContent>
              {athlete.enrollments && athlete.enrollments.length > 0 ? (
                <div className="space-y-4">
                  {athlete.enrollments.map((enrollment) => (
                    <div key={enrollment.id} className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0">
                      <div className="flex items-center gap-4">
                        <div className="bg-primary/10 p-2 rounded-full">
                          <Trophy className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">{enrollment.program?.name ?? "Unknown Program"}</p>
                          <p className="text-sm text-muted-foreground">
                            {formatDate(enrollment.startDate)} - {enrollment.endDate ? formatDate(enrollment.endDate) : "Ongoing"}
                          </p>
                        </div>
                      </div>
                      <Badge variant={enrollment.status === "ACTIVE" ? "default" : "secondary"}>
                        {formatStatus(enrollment.status)}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-8">No enrollments found for this athlete.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="attendance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Attendance History</CardTitle>
              <CardDescription>Recent class attendance records</CardDescription>
            </CardHeader>
            <CardContent>
              {athlete.attendances && athlete.attendances.length > 0 ? (
                <div className="space-y-4">
                  {athlete.attendances.map((record) => (
                    <div key={record.id} className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0">
                      <div className="flex items-center gap-4">
                        <div className={`p-2 rounded-full ${
                          record.status === "PRESENT" || record.status === "LATE" 
                            ? "bg-green-100" 
                            : "bg-red-100"
                        }`}>
                          {record.status === "PRESENT" || record.status === "LATE" ? (
                            <CalendarCheck className="h-4 w-4 text-green-600" />
                          ) : (
                            <CalendarX className="h-4 w-4 text-red-600" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium">{record.event?.title ?? "Unknown Event"}</p>
                          <p className="text-sm text-muted-foreground">
                            {formatDate(record.event?.date ?? null)}
                            {record.checkedIn && ` • Checked in at ${new Date(record.checkedIn).toLocaleTimeString()}`}
                          </p>
                          {record.notes && (
                            <p className="text-sm text-muted-foreground italic">{record.notes}</p>
                          )}
                        </div>
                      </div>
                      <Badge variant={
                        record.status === "PRESENT" ? "default" : 
                        record.status === "LATE" ? "secondary" : "destructive"
                      }>
                        {formatAttendanceStatus(record.status)}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-8">No attendance records found.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {trainingEnabled && <TabsContent value="evaluations" className="space-y-4">
          <div className="flex justify-end">
            <Dialog>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" /> New Evaluation
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Add New Evaluation</DialogTitle>
                  <DialogDescription>
                    Create a new performance evaluation for {athlete.name}.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="eval-date" className="text-right">Date</Label>
                    <Input id="eval-date" type="date" className="col-span-3" defaultValue={new Date().toISOString().split("T")[0]} />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="eval-level" className="text-right">Level</Label>
                    <Input id="eval-level" defaultValue={athlete.level} className="col-span-3" />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="eval-score" className="text-right">Score</Label>
                    <div className="col-span-3 flex items-center gap-2">
                      <Input id="eval-score" type="number" min="0" max="5" step="0.5" defaultValue="0" />
                      <span className="text-sm text-muted-foreground">/ 5</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="eval-status" className="text-right">Status</Label>
                    <Select defaultValue="SATISFACTORY">
                      <SelectTrigger className="col-span-3">
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="EXCELLENT">Excellent</SelectItem>
                        <SelectItem value="SATISFACTORY">Satisfactory</SelectItem>
                        <SelectItem value="PASS">Pass</SelectItem>
                        <SelectItem value="RETRY">Retry</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-4 items-start gap-4">
                    <Label htmlFor="eval-notes" className="text-right pt-2">Notes</Label>
                    <Textarea id="eval-notes" className="col-span-3" placeholder="Enter detailed feedback here..." />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit">Save Evaluation</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          
          <div className="space-y-4">
            {athlete.evaluations && athlete.evaluations.length > 0 ? (
              athlete.evaluations.map((evaluation) => (
                <Card key={evaluation.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-base font-bold flex items-center gap-2">
                          <FileText className="h-4 w-4 text-primary" />
                          {formatDate(evaluation.date)}
                        </CardTitle>
                        <CardDescription>
                          {evaluation.level} Evaluation by {evaluation.coach?.name ?? "Unknown Coach"}
                        </CardDescription>
                      </div>
                      <Badge variant={evaluation.status === "EXCELLENT" ? "default" : "secondary"}>
                        {formatStatus(evaluation.status)}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <p className="text-sm font-medium mb-1">Overall Score: {evaluation.overallScore}/5</p>
                        <Progress value={(Number(evaluation.overallScore) / 5) * 100} className="h-2" />
                      </div>
                      
                      {evaluation.notes && (
                        <div className="bg-muted/50 p-3 rounded-md text-sm">
                          <p className="font-medium mb-1">Coach Notes:</p>
                          <p className="text-muted-foreground">{evaluation.notes}</p>
                        </div>
                      )}

                      {evaluation.skillRatings && evaluation.skillRatings.length > 0 && (
                        <Collapsible>
                          <CollapsibleTrigger asChild>
                            <Button variant="ghost" size="sm" className="w-full flex justify-between">
                              <span>View Skills Breakdown ({evaluation.skillRatings.length} skills)</span>
                              <ChevronDown className="h-4 w-4" />
                            </Button>
                          </CollapsibleTrigger>
                          <CollapsibleContent className="pt-2 space-y-2">
                            {evaluation.skillRatings.map((skillRating) => (
                              <div key={skillRating.id} className="flex flex-col gap-1 text-sm border-b pb-2 last:border-0">
                                <div className="flex justify-between items-center">
                                  <span>{skillRating.skill?.name ?? "Unknown Skill"}</span>
                                  <span className="font-medium">{skillRating.rating}/5</span>
                                </div>
                                {skillRating.comment && (
                                  <p className="text-xs text-muted-foreground italic">&quot;{skillRating.comment}&quot;</p>
                                )}
                              </div>
                            ))}
                          </CollapsibleContent>
                        </Collapsible>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No evaluations found for this athlete.
              </div>
            )}
          </div>
        </TabsContent>}

        <TabsContent value="billing" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Payment Methods</CardTitle>
                <CardDescription>Family payment methods on file</CardDescription>
              </CardHeader>
              <CardContent>
                {athlete.family?.paymentMethods && athlete.family.paymentMethods.length > 0 ? (
                  <div className="space-y-3">
                    {athlete.family.paymentMethods.map((method) => (
                      <div key={method.id} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="bg-muted p-2 rounded">
                            <PhoneIcon className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="font-medium">
                              {method.brand ?? method.type} •••• {method.last4}
                            </p>
                            {method.expiry && (
                              <p className="text-sm text-muted-foreground">Expires {method.expiry}</p>
                            )}
                          </div>
                        </div>
                        {method.isDefault && <Badge variant="secondary">Default</Badge>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-4">No payment methods on file</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent Charges</CardTitle>
                <CardDescription>Recent invoice line items for this athlete</CardDescription>
              </CardHeader>
              <CardContent>
                {athlete.lineItems && athlete.lineItems.length > 0 ? (
                  <div className="space-y-3">
                    {athlete.lineItems.map((item) => (
                      <div key={item.id} className="flex items-center justify-between border-b pb-3 last:border-0 last:pb-0">
                        <div>
                          <p className="font-medium">{item.description}</p>
                          <p className="text-sm text-muted-foreground">
                            Invoice #{item.invoice?.reference ?? "N/A"}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium">${Number(item.total).toFixed(2)}</p>
                          <Badge 
                            variant={item.invoice?.status === "PAID" ? "default" : "secondary"}
                            className="text-xs"
                          >
                            {item.invoice?.status ?? "N/A"}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-4">No recent charges</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
