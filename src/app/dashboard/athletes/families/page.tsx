// @deprecated - Legacy Families page. Use /dashboard/athletes/guardians instead.
"use client"

import * as React from "react"
import { 
  Plus, 
  Search, 
  Filter, 
  MoreHorizontal, 
  Mail, 
  Phone, 
  Users,
  Loader2,
  AlertCircle
} from "lucide-react"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { useFamilies } from "@/hooks/use-families"
import { FamilyDialog } from "@/components/families/family-dialog"
import type { FamilyWithRelations, CreateFamilyPayload, UpdateFamilyPayload } from "@/types/families"

export default function FamiliesPage() {
  const [searchTerm, setSearchTerm] = React.useState("")
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editingFamily, setEditingFamily] = React.useState<FamilyWithRelations | null>(null)
  
  const { families, isLoading, isCreating, isUpdating, error, fetchFamilies, createFamily, updateFamily } = useFamilies()

  // Debounced search effect
  React.useEffect(() => {
    const timer = setTimeout(() => {
      fetchFamilies({ search: searchTerm })
    }, 500)

    return () => clearTimeout(timer)
  }, [searchTerm, fetchFamilies])

  const handleAddFamily = () => {
    setEditingFamily(null)
    setDialogOpen(true)
  }

  const handleEditFamily = (family: FamilyWithRelations) => {
    setEditingFamily(family)
    setDialogOpen(true)
  }

  const handleSubmit = async (data: CreateFamilyPayload | UpdateFamilyPayload) => {
    if (editingFamily) {
      return updateFamily(editingFamily.id, data as UpdateFamilyPayload)
    }
    return createFamily(data as CreateFamilyPayload)
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Guardians</h1>
          <p className="text-muted-foreground">
            Manage guardian accounts, billing, and contact information. Transitioning from family-based to guardian-based system.
          </p>
        </div>
        <Button onClick={handleAddFamily}>
          <Plus className="mr-2 h-4 w-4" />
          Add Guardian Family
        </Button>
      </div>

      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-1 max-w-sm">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search families..."
              className="pl-8"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Button variant="outline" size="icon">
            <Filter className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && families.length === 0 && (
        <div className="flex items-center justify-center h-64">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-muted-foreground">Loading guardians...</p>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && !isLoading && families.length === 0 && (
        <div className="flex items-center justify-center h-64">
          <div className="flex flex-col items-center gap-2 text-destructive">
            <AlertCircle className="h-8 w-8" />
            <p>Failed to load guardians</p>
            <Button variant="outline" onClick={() => fetchFamilies()}>
              Try Again
            </Button>
          </div>
        </div>
      )}

      {(!isLoading || families.length > 0) && !error && (
        <div className="rounded-md border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Guardian / Family</TableHead>
                <TableHead>Primary Contact</TableHead>
                <TableHead>Contact Info</TableHead>
                <TableHead>Athletes</TableHead>
                <TableHead className="text-right">Balance</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {families.map((family) => (
                <TableRow key={family.id}>
                  <TableCell className="font-medium">
                    <Link href={`/dashboard/athletes/families/${family.id}`} className="hover:underline">
                      {family.name}
                    </Link>
                  </TableCell>
                  <TableCell>{family.primaryContact}</TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Mail className="h-3 w-3" /> {family.email}
                      </div>
                      <div className="flex items-center gap-1">
                        <Phone className="h-3 w-3" /> {family.phone}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span>{family.athletes.length}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge 
                      variant={Number(family.balance) > 0 ? "destructive" : Number(family.balance) < 0 ? "secondary" : "outline"}
                      className={Number(family.balance) > 0 ? "" : Number(family.balance) < 0 ? "text-green-600 border-green-200 bg-green-50" : ""}
                    >
                      ${Math.abs(Number(family.balance)).toFixed(2)} {Number(family.balance) < 0 ? "CR" : ""}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <span className="sr-only">Open menu</span>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuItem asChild>
                          <Link href={`/dashboard/athletes/families/${family.id}`}>
                            View Details
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleEditFamily(family)}>
                          Edit Family
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem>Create Invoice</DropdownMenuItem>
                        <DropdownMenuItem>Process Payment</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
              {families.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center">
                    No guardians found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <FamilyDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        family={editingFamily}
        onSubmit={handleSubmit}
        isSubmitting={isCreating || isUpdating}
      />
    </div>
  )
}


