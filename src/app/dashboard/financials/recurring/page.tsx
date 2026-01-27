"use client"

import * as React from "react"
import { 
  Calendar, 
  CheckCircle2, 
  AlertCircle, 
  Play, 
  Search, 
  Filter,
  Loader2
} from "lucide-react"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useAthletes } from "@/hooks/use-athletes"

export default function RecurringBillingPage() {
  const [statusFilter, setStatusFilter] = React.useState("all")
  const [searchTerm, setSearchTerm] = React.useState("")
  
  const { athletes, isLoading } = useAthletes()

  // Generate mock charges based on fetched athletes
  // In a real implementation, this would fetch from a /api/billing/recurring endpoint
  const upcomingCharges = React.useMemo(() => {
    if (!athletes || athletes.length === 0) return []
    
    return athletes.slice(0, 10).map((athlete, i) => ({
      id: `CHG-${1000 + i}`,
      athleteId: athlete.id,
      athleteName: athlete.name,
      description: `Monthly Tuition - ${athlete.level}`,
      amount: athlete.level.includes("Elite") ? 350.00 : athlete.level.includes("Level") ? 185.00 : 120.00,
      date: new Date().toISOString().split('T')[0], // Today or start of month
      status: i === 2 ? "failed" : "scheduled", // Mock one failure
      method: i % 3 === 0 ? "Bank Transfer" : "Visa •••• 4242"
    }))
  }, [athletes])

  const filteredCharges = upcomingCharges.filter(charge => {
    const matchesSearch = charge.athleteName.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === "all" || charge.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const totalAmount = filteredCharges.reduce((acc, curr) => acc + curr.amount, 0)

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Recurring Billing</h1>
          <p className="text-muted-foreground">
            Manage automated tuition collection and payment schedules.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline">
            <Calendar className="mr-2 h-4 w-4" />
            Schedule
          </Button>
          <Button>
            <Play className="mr-2 h-4 w-4" />
            Run Batch Now
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Scheduled
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalAmount.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              For {new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pending Charges
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filteredCharges.filter(c => c.status === 'scheduled').length}</div>
            <p className="text-xs text-muted-foreground">
              Ready to process
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Failed/Retry
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
               {upcomingCharges.filter(c => c.status === 'failed').length}
            </div>
            <p className="text-xs text-muted-foreground">
              Requires attention
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-1 max-w-sm">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search athlete..."
              className="pl-8"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="scheduled">Scheduled</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="processed">Processed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Athlete</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Scheduled Date</TableHead>
              <TableHead>Payment Method</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && filteredCharges.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
                  <div className="flex items-center justify-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading billing data...
                  </div>
                </TableCell>
              </TableRow>
            ) : filteredCharges.map((charge) => (
              <TableRow key={charge.id}>
                <TableCell className="font-medium">{charge.athleteName}</TableCell>
                <TableCell>{charge.description}</TableCell>
                <TableCell>{charge.date}</TableCell>
                <TableCell className="text-muted-foreground text-sm">{charge.method}</TableCell>
                <TableCell>
                  {charge.status === 'scheduled' && (
                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Scheduled</Badge>
                  )}
                  {charge.status === 'failed' && (
                    <Badge variant="destructive" className="bg-red-50 text-red-700 border-red-200 hover:bg-red-50">Failed</Badge>
                  )}
                  {charge.status === 'processed' && (
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Processed</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">${charge.amount.toFixed(2)}</TableCell>
              </TableRow>
            ))}
             {!isLoading && filteredCharges.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
                  No scheduled charges found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}


