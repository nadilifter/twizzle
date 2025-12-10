"use client"

import * as React from "react"
import { 
  Plus, 
  Search, 
  Filter, 
  MoreHorizontal, 
  Mail, 
  Phone, 
  CreditCard,
  Users
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
import { Card, CardContent } from "@/components/ui/card"
import { families, Family } from "@/mock-data/families"

export default function FamiliesPage() {
  const [searchTerm, setSearchTerm] = React.useState("")
  
  const filteredFamilies = families.filter(family => 
    family.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    family.primaryContact.toLowerCase().includes(searchTerm.toLowerCase()) ||
    family.email.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Families</h1>
          <p className="text-muted-foreground">
            Manage family accounts, billing, and contact information.
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Family
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

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Family Name</TableHead>
              <TableHead>Primary Contact</TableHead>
              <TableHead>Contact Info</TableHead>
              <TableHead>Athletes</TableHead>
              <TableHead className="text-right">Balance</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredFamilies.map((family) => (
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
                    variant={family.balance > 0 ? "destructive" : family.balance < 0 ? "secondary" : "outline"}
                    className={family.balance > 0 ? "" : family.balance < 0 ? "text-green-600 border-green-200 bg-green-50" : ""}
                  >
                    ${Math.abs(family.balance).toFixed(2)} {family.balance < 0 ? "CR" : ""}
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
                      <DropdownMenuItem>Edit Family</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem>Create Invoice</DropdownMenuItem>
                      <DropdownMenuItem>Process Payment</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
            {filteredFamilies.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
                  No families found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}


