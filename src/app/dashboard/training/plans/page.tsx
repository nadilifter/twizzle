"use client"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { 
  Plus, 
  Search, 
  CalendarDays, 
  FileText, 
  MoreHorizontal,
  Copy,
  Trash2
} from "lucide-react"
import Link from "next/link"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { useState } from "react"
import { useLessonPlanStore } from "@/store/lesson-plan-store"
import { format, parseISO, isValid } from "date-fns"

export default function PlansPage() {
  const { plans, deletePlan, duplicatePlan } = useLessonPlanStore()
  const [planToDelete, setPlanToDelete] = useState<string | null>(null)

  const handleDelete = () => {
    if (planToDelete) {
      deletePlan(planToDelete)
      setPlanToDelete(null)
    }
  }

  const handleDuplicate = (id: string) => {
    duplicatePlan(id)
  }

  const formatPlanDate = (dateStr: string) => {
    if (dateStr.includes(" - ")) return dateStr
    const date = parseISO(dateStr)
    if (isValid(date)) {
      return `Week of ${format(date, "MMM dd, yyyy")}`
    }
    return dateStr
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Lesson Plans</h1>
          <p className="text-muted-foreground">
            Create and manage weekly training schedules for all programs.
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/training/plans/new">
            <Plus className="mr-2 h-4 w-4" />
            New Lesson Plan
          </Link>
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 md:max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search plans..."
            className="pl-8"
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {plans.map((plan) => (
          <Card key={plan.id}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-base">{plan.name}</CardTitle>
                  <CardDescription>{plan.program}</CardDescription>
                </div>
                <Badge variant={plan.status === "Active" ? "default" : "secondary"}>
                  {plan.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pb-3">
              <div className="grid gap-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4" />
                  {formatPlanDate(plan.date)}
                </div>
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Theme: {plan.theme}
                </div>
              </div>
            </CardContent>
            <CardFooter className="pt-3 border-t flex justify-between items-center">
              <div className="text-xs text-muted-foreground">
                By {plan.author}
              </div>
              <AlertDialog open={planToDelete === plan.id} onOpenChange={(open) => !open && setPlanToDelete(null)}>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                        <span className="sr-only">Menu</span>
                    </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                    <DropdownMenuItem asChild>
                        <Link href={`/dashboard/training/plans/new`}>Edit Plan</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleDuplicate(plan.id)}>
                        <Copy className="mr-2 h-4 w-4" /> Duplicate
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <AlertDialogTrigger asChild>
                        <DropdownMenuItem className="text-destructive" onSelect={() => setPlanToDelete(plan.id)}>
                            <Trash2 className="mr-2 h-4 w-4" /> Delete
                        </DropdownMenuItem>
                    </AlertDialogTrigger>
                    </DropdownMenuContent>
                </DropdownMenu>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete the lesson plan &quot;{plan.name}&quot;.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  )
}
