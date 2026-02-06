"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { format } from "date-fns"
import {
  ArrowLeft,
  Clock,
  Users,
  MapPin,
  ExternalLink,
  Loader2,
  CalendarDays,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"

interface Program {
  id: string
  name: string
  recurrenceType: string | null
  registrationType: string | null
  _count: { instances: number; enrollments: number }
}

interface Instance {
  id: string
  date: string
  startTime: string
  endTime: string
  status: string
  capacity: number | null
  notes: string | null
  facility: { id: string; name: string; city?: string } | null
  _count: { registrations: number; attendances: number }
}

export default function ProgramSessionsPage() {
  const params = useParams()
  const router = useRouter()
  const programId = params.id as string

  const [program, setProgram] = useState<Program | null>(null)
  const [instances, setInstances] = useState<Instance[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [progRes, instRes] = await Promise.all([
          fetch(`/api/programs/${programId}`),
          fetch(`/api/programs/${programId}/instances`),
        ])

        if (!progRes.ok) throw new Error("Failed to fetch program")
        if (!instRes.ok) throw new Error("Failed to fetch instances")

        const progData = await progRes.json()
        const instData = await instRes.json()
        const instanceList: Instance[] = instData.instances || []

        // For single-session programs with exactly 1 instance, redirect directly
        if (
          progData.recurrenceType === "NON_RECURRING" &&
          instanceList.length === 1
        ) {
          router.replace(
            `/dashboard/calendar/instance/${instanceList[0].id}`
          )
          return
        }

        setProgram(progData)
        setInstances(instanceList)
      } catch (error) {
        console.error("Failed to load sessions:", error)
        toast.error("Failed to load sessions")
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [programId, router])

  if (loading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10 rounded" />
          <div className="space-y-2">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))}
        </div>
      </div>
    )
  }

  if (!program) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center py-12">
          <h2 className="text-xl font-semibold">Program not found</h2>
          <Button asChild className="mt-4">
            <Link href="/dashboard/registrations/programs">
              Back to Programs
            </Link>
          </Button>
        </div>
      </div>
    )
  }

  const statusBadge = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return <Badge variant="secondary">Completed</Badge>
      case "CANCELLED":
        return <Badge variant="destructive">Cancelled</Badge>
      default:
        return <Badge variant="outline">Scheduled</Badge>
    }
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/registrations/programs">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{program.name}</h1>
          <p className="text-muted-foreground">
            {instances.length} session{instances.length !== 1 ? "s" : ""}{" "}
            scheduled
          </p>
        </div>
      </div>

      {/* Sessions List */}
      {instances.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <CalendarDays className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p className="text-lg font-medium">No sessions scheduled</p>
            <p className="text-sm mt-1">
              Sessions will appear here once the program schedule is configured.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {instances.map((instance) => (
            <Link
              key={instance.id}
              href={`/dashboard/calendar/instance/${instance.id}`}
              className="block"
            >
              <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
                <CardContent className="flex items-center justify-between py-4">
                  <div className="flex items-center gap-4">
                    {/* Date block */}
                    <div className="text-center min-w-[50px]">
                      <div className="text-xs font-medium text-muted-foreground uppercase">
                        {format(new Date(instance.date), "MMM")}
                      </div>
                      <div className="text-2xl font-bold">
                        {format(new Date(instance.date), "d")}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {format(new Date(instance.date), "EEE")}
                      </div>
                    </div>

                    {/* Details */}
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {format(
                            new Date(instance.date),
                            "EEEE, MMMM d, yyyy"
                          )}
                        </span>
                        {statusBadge(instance.status)}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          {instance.startTime} - {instance.endTime}
                        </span>
                        {instance.facility && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3.5 w-3.5" />
                            {instance.facility.name}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Users className="h-3.5 w-3.5" />
                          {instance._count.registrations}
                          {instance.capacity
                            ? `/${instance.capacity}`
                            : ""}{" "}
                          registered
                        </span>
                      </div>
                    </div>
                  </div>

                  <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
