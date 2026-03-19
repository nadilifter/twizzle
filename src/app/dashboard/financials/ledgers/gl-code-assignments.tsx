"use client"

import * as React from "react"
import Link from "next/link"
import { Loader2, Layers } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { toast } from "sonner"

interface GLCodeWithCounts {
  id: string
  code: string
  description: string
  type: string
  status: string
  isDefault: boolean
  defaultForType: string | null
  _count: {
    programs: number
    events: number
    competitions: number
    products: number
    membershipGroups: number
    passes: number
  }
}

const TYPE_BADGE_COLORS: Record<string, string> = {
  REVENUE: "bg-emerald-500 hover:bg-emerald-600 border-emerald-500/50 text-white",
  EXPENSE: "bg-rose-500 hover:bg-rose-600 border-rose-500/50 text-white",
  LIABILITY: "bg-amber-500 hover:bg-amber-600 border-amber-500/50 text-white",
  ASSET: "bg-blue-500 hover:bg-blue-600 border-blue-500/50 text-white",
  EQUITY: "bg-purple-500 hover:bg-purple-600 border-purple-500/50 text-white",
}

export function GLCodeAssignments() {
  const [glCodes, setGlCodes] = React.useState<GLCodeWithCounts[]>([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    async function fetchAll() {
      try {
        const response = await fetch("/api/ledgers?limit=200")
        if (!response.ok) throw new Error("Failed to fetch")
        const data = await response.json()

        // For each GL code, fetch assignment counts
        const detailPromises = data.data.map((code: { id: string }) =>
          fetch(`/api/ledgers/${code.id}`).then((r) => r.json())
        )
        const details = await Promise.all(detailPromises)
        setGlCodes(details)
      } catch (error) {
        console.error("Error fetching GL code assignments:", error)
        toast.error("Failed to load assignments")
      } finally {
        setLoading(false)
      }
    }
    fetchAll()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const codesWithAssignments = glCodes.filter(
    (c) =>
      c._count &&
      (c._count.programs + c._count.events + c._count.competitions + c._count.products + c._count.membershipGroups + c._count.passes) > 0
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Layers className="h-5 w-5" />
          GL Code Assignments
        </CardTitle>
        <CardDescription>
          Programs, events, competitions, products, memberships, and passes assigned to each GL code.
          Assign entities from their individual configuration pages.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {codesWithAssignments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Layers className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground text-center">
              No entities have been assigned to GL codes yet.
              <br />
              Go to Programs, Events, or Products to assign a GL code.
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>GL Code</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-center">Programs</TableHead>
                <TableHead className="text-center">Events</TableHead>
                <TableHead className="text-center">Competitions</TableHead>
                <TableHead className="text-center">Memberships</TableHead>
                <TableHead className="text-center">Passes</TableHead>
                <TableHead className="text-center">Products</TableHead>
                <TableHead className="text-center">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {codesWithAssignments.map((code) => {
                const total =
                  code._count.programs +
                  code._count.events +
                  code._count.competitions +
                  code._count.membershipGroups +
                  code._count.passes +
                  code._count.products

                return (
                  <TableRow key={code.id}>
                    <TableCell>
                      <Link
                        href={`/dashboard/financials/ledgers/${code.id}`}
                        className="font-mono text-primary hover:underline font-medium"
                      >
                        {code.code}
                      </Link>
                    </TableCell>
                    <TableCell>{code.description}</TableCell>
                    <TableCell>
                      <Badge className={TYPE_BADGE_COLORS[code.type] || ""}>
                        {code.type.charAt(0) + code.type.slice(1).toLowerCase()}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">{code._count.programs || "-"}</TableCell>
                    <TableCell className="text-center">{code._count.events || "-"}</TableCell>
                    <TableCell className="text-center">{code._count.competitions || "-"}</TableCell>
                    <TableCell className="text-center">{code._count.membershipGroups || "-"}</TableCell>
                    <TableCell className="text-center">{code._count.passes || "-"}</TableCell>
                    <TableCell className="text-center">{code._count.products || "-"}</TableCell>
                    <TableCell className="text-center font-bold">{total}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
