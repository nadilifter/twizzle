import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { db } from "@/lib/db"
import { getPhonePool } from "@/lib/sms-number-pool"
import { fetchVerifiedTollFreeNumbers, isTwilioConfigured } from "@/lib/twilio"
import { Phone, AlertTriangle, CheckCircle2, Clock, ShieldCheck } from "lucide-react"

export const dynamic = "force-dynamic"

interface PoolNumber {
  number: string
  status: "verified" | "pending" | "unverified"
  assignmentCount: number
}

async function getPoolUtilizationData() {
  const pool = getPhonePool()

  let verifiedNumbers = new Set<string>()
  if (isTwilioConfigured()) {
    try {
      verifiedNumbers = await fetchVerifiedTollFreeNumbers()
    } catch {
      // If Twilio API fails, treat all as unknown
    }
  }

  const assignmentCounts = await db.smsNumberAssignment.groupBy({
    by: ["twilioNumber"],
    _count: { id: true },
  })
  const countMap = new Map(assignmentCounts.map((a) => [a.twilioNumber, a._count.id]))

  const poolNumbers: PoolNumber[] = pool.map((number) => ({
    number,
    status: verifiedNumbers.has(number) ? "verified" : "pending",
    assignmentCount: countMap.get(number) ?? 0,
  }))

  // Max conversations any single guardian phone has across all orgs
  const maxAssignments = await db.smsNumberAssignment.groupBy({
    by: ["phone"],
    _count: { id: true },
    orderBy: { _count: { id: "desc" } },
    take: 1,
  })

  const peakUsage = maxAssignments[0]?._count.id ?? 0

  // Top 5 phones by assignment count for detail
  const topPhones = await db.smsNumberAssignment.groupBy({
    by: ["phone"],
    _count: { id: true },
    orderBy: { _count: { id: "desc" } },
    take: 5,
  })

  const totalAssignments = await db.smsNumberAssignment.count()
  const activePoolSize = poolNumbers.filter((n) => n.status === "verified").length

  return {
    poolNumbers,
    peakUsage,
    activePoolSize,
    totalPoolSize: pool.length,
    totalAssignments,
    topPhones: topPhones.map((p) => ({ phone: p.phone, count: p._count.id })),
  }
}

export default async function UsagePage() {
  const data = await getPoolUtilizationData()

  const utilizationPct =
    data.activePoolSize > 0
      ? Math.round((data.peakUsage / data.activePoolSize) * 100)
      : 0

  const isNearCapacity = data.peakUsage >= data.activePoolSize - 1 && data.activePoolSize > 0

  return (
    <div className="flex flex-col gap-6 p-4">
      <div>
        <h1 className="text-2xl font-bold">Platform Usage</h1>
        <p className="text-muted-foreground">
          Monitor SMS pool capacity and system utilization
        </p>
      </div>

      {/* Pool Capacity Overview */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Peak Conversations</CardTitle>
            {isNearCapacity ? (
              <AlertTriangle className="h-4 w-4 text-amber-500" />
            ) : (
              <Phone className="h-4 w-4 text-muted-foreground" />
            )}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.peakUsage}</div>
            <p className="text-xs text-muted-foreground">
              max orgs texting one guardian
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Verified Numbers</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{data.activePoolSize}</div>
            <p className="text-xs text-muted-foreground">
              of {data.totalPoolSize} in pool
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pool Utilization</CardTitle>
            <ShieldCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${utilizationPct >= 80 ? "text-amber-600" : ""}`}>
              {utilizationPct}%
            </div>
            <p className="text-xs text-muted-foreground">
              peak / verified capacity
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Assignments</CardTitle>
            <Phone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.totalAssignments}</div>
            <p className="text-xs text-muted-foreground">
              phone-org-number pairings
            </p>
          </CardContent>
        </Card>
      </div>

      {isNearCapacity && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
              Pool is at or near capacity. A guardian texting with {data.activePoolSize} or more
              orgs will force number reuse, breaking inbound routing for that guardian.
              Consider purchasing additional toll-free numbers.
            </p>
          </div>
        </div>
      )}

      {/* Phone Number Pool */}
      <Card>
        <CardHeader>
          <CardTitle>Phone Number Pool</CardTitle>
          <CardDescription>
            All toll-free numbers in the pool with their verification and assignment status
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Phone Number</TableHead>
                <TableHead>Verification</TableHead>
                <TableHead className="text-right">Assignments</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.poolNumbers.map((num) => (
                <TableRow key={num.number}>
                  <TableCell className="font-mono">{num.number}</TableCell>
                  <TableCell>
                    {num.status === "verified" ? (
                      <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                        <CheckCircle2 className="mr-1 h-3 w-3" />
                        Verified
                      </Badge>
                    ) : (
                      <Badge variant="secondary">
                        <Clock className="mr-1 h-3 w-3" />
                        Pending
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">{num.assignmentCount}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Top Phones by Assignment Count */}
      {data.topPhones.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Highest Utilization Phones</CardTitle>
            <CardDescription>
              Guardian phone numbers with the most org assignments — these are closest to exhausting pool capacity
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Phone Number</TableHead>
                  <TableHead className="text-right">Org Assignments</TableHead>
                  <TableHead className="text-right">Headroom</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.topPhones.map((entry) => {
                  const headroom = data.activePoolSize - entry.count
                  return (
                    <TableRow key={entry.phone}>
                      <TableCell className="font-mono">{entry.phone}</TableCell>
                      <TableCell className="text-right">{entry.count}</TableCell>
                      <TableCell className="text-right">
                        <span className={headroom <= 1 ? "text-amber-600 font-medium" : ""}>
                          {headroom >= 0 ? headroom : 0} remaining
                        </span>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
