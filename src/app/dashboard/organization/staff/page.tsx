"use client"

import { useState } from "react"
import { 
  Plus, 
  Search, 
  Mail, 
  Phone, 
  MoreHorizontal, 
  Filter,
  UserCircle
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"

// Mock data for staff
const initialStaff = [
  {
    id: 1,
    name: "Sarah Miller",
    role: "Head Coach",
    email: "sarah.m@example.com",
    phone: "(555) 123-4567",
    status: "Active",
    certifications: ["USAG Safety", "CPR/First Aid", "SafeSport"],
    avatar: "/avatars/01.png",
    initials: "SM"
  },
  {
    id: 2,
    name: "David Chen",
    role: "Coach (Boys)",
    email: "david.c@example.com",
    phone: "(555) 987-6543",
    status: "Active",
    certifications: ["USAG Safety", "SafeSport"],
    avatar: "/avatars/02.png",
    initials: "DC"
  },
  {
    id: 3,
    name: "Jessica Williams",
    role: "Front Desk / Admin",
    email: "jessica.w@example.com",
    phone: "(555) 456-7890",
    status: "Part-time",
    certifications: ["CPR/First Aid"],
    avatar: "/avatars/03.png",
    initials: "JW"
  },
  {
    id: 4,
    name: "Michael Brown",
    role: "Coach (Recreational)",
    email: "michael.b@example.com",
    phone: "(555) 789-0123",
    status: "Active",
    certifications: ["USAG Safety"],
    avatar: "/avatars/04.png",
    initials: "MB"
  },
  {
    id: 5,
    name: "Emily Davis",
    role: "Choreographer",
    email: "emily.d@example.com",
    phone: "(555) 234-5678",
    status: "Contractor",
    certifications: [],
    avatar: "/avatars/05.png",
    initials: "ED"
  },
]

export default function StaffPage() {
  const [staff, setStaff] = useState(initialStaff)
  const [searchQuery, setSearchQuery] = useState("")

  const filteredStaff = staff.filter(person => 
    person.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    person.role.toLowerCase().includes(searchQuery.toLowerCase()) ||
    person.email.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Staff Directory</h1>
          <p className="text-muted-foreground">
            Manage your coaches, administrators, and support staff.
          </p>
        </div>
        <Sheet>
          <SheetTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Staff
            </Button>
          </SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Add New Staff Member</SheetTitle>
              <SheetDescription>
                Create a new staff profile. Click save when you're done.
              </SheetDescription>
            </SheetHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Full Name</Label>
                <Input id="name" placeholder="e.g. Jane Doe" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" placeholder="jane@example.com" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="role">Role</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="head-coach">Head Coach</SelectItem>
                    <SelectItem value="coach">Coach</SelectItem>
                    <SelectItem value="admin">Administrator</SelectItem>
                    <SelectItem value="front-desk">Front Desk</SelectItem>
                    <SelectItem value="maintenance">Maintenance</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="status">Status</Label>
                <Select defaultValue="active">
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active (Full-time)</SelectItem>
                    <SelectItem value="part-time">Part-time</SelectItem>
                    <SelectItem value="contractor">Contractor</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Certifications</Label>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox id="cert-safety" />
                    <Label htmlFor="cert-safety">USAG Safety Certification</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="cert-cpr" />
                    <Label htmlFor="cert-cpr">CPR / First Aid</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="cert-safesport" />
                    <Label htmlFor="cert-safesport">SafeSport Trained</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="cert-bg" />
                    <Label htmlFor="cert-bg">Background Check Cleared</Label>
                  </div>
                </div>
              </div>
            </div>
            <SheetFooter>
              <SheetClose asChild>
                <Button type="submit">Save Staff Member</Button>
              </SheetClose>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search by name, role, or email..."
            className="pl-8"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Button variant="outline" size="icon">
          <Filter className="h-4 w-4" />
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[250px]">Name</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden md:table-cell">Contact</TableHead>
              <TableHead className="hidden lg:table-cell">Certifications</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredStaff.map((person) => (
              <TableRow key={person.id}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarImage src={person.avatar} alt={person.name} />
                      <AvatarFallback>{person.initials}</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                      <span>{person.name}</span>
                      <span className="text-xs text-muted-foreground md:hidden">{person.role}</span>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="hidden md:table-cell">{person.role}</TableCell>
                <TableCell>
                  <Badge variant={person.status === "Active" ? "default" : "secondary"}>
                    {person.status}
                  </Badge>
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  <div className="flex flex-col text-sm">
                    <div className="flex items-center gap-1">
                      <Mail className="h-3 w-3 text-muted-foreground" />
                      {person.email}
                    </div>
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Phone className="h-3 w-3" />
                      {person.phone}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="hidden lg:table-cell">
                  <div className="flex flex-wrap gap-1">
                    {person.certifications.map((cert) => (
                      <Badge key={cert} variant="outline" className="text-xs font-normal">
                        {cert}
                      </Badge>
                    ))}
                  </div>
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
                      <DropdownMenuItem>View Profile</DropdownMenuItem>
                      <DropdownMenuItem>Edit Details</DropdownMenuItem>
                      <DropdownMenuItem>Manage Schedule</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-red-600">Deactivate</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
