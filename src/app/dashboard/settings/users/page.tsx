"use client"

import * as React from "react"
import { format } from "date-fns"
import { 
  MoreHorizontal, 
  Plus, 
  Search, 
  Shield, 
  Mail,
  Check,
  Calendar,
  Clock
} from "lucide-react"

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Checkbox } from "@/components/ui/checkbox"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"

// --- Permissions Data ---

type PermissionCategory = "General" | "Athletes" | "Training" | "Events" | "Financials" | "Users"

interface PermissionItem {
  id: string
  label: string
  description: string
}

interface PermissionGroup {
  category: PermissionCategory
  items: PermissionItem[]
}

const PERMISSIONS_DATA: PermissionGroup[] = [
  {
    category: "General",
    items: [
      { id: "view_dashboard", label: "View Dashboard", description: "Access to the main dashboard overview" },
      { id: "view_settings", label: "View Settings", description: "Access to view club settings" },
    ]
  },
  {
    category: "Athletes",
    items: [
      { id: "view_athletes", label: "View Profiles", description: "View athlete contact info and details" },
      { id: "edit_athletes", label: "Edit Profiles", description: "Modify athlete details and medical info" },
      { id: "delete_athletes", label: "Delete Profiles", description: "Remove athletes from the system" },
      { id: "view_medical", label: "View Medical Records", description: "Access sensitive medical information" },
    ]
  },
  {
    category: "Training",
    items: [
      { id: "view_plans", label: "View Plans", description: "View training plans and assignments" },
      { id: "manage_plans", label: "Manage Plans", description: "Create and edit training plans" },
      { id: "assign_plans", label: "Assign Plans", description: "Assign plans to athletes" },
    ]
  },
  {
    category: "Events",
    items: [
      { id: "view_events", label: "View Events", description: "View club calendar and events" },
      { id: "manage_events", label: "Manage Events", description: "Create and edit events" },
      { id: "manage_registrations", label: "Manage Registrations", description: "Handle event sign-ups" },
    ]
  },
  {
    category: "Financials",
    items: [
      { id: "view_financials", label: "View Financials", description: "Access financial overview and reports" },
      { id: "manage_invoices", label: "Manage Invoices", description: "Create and send invoices to members" },
      { id: "process_payments", label: "Process Payments", description: "Record and refund payments" },
    ]
  },
  {
    category: "Users",
    items: [
      { id: "view_users", label: "View Users", description: "See other users" },
      { id: "manage_users", label: "Manage Users", description: "Invite and remove users" },
      { id: "manage_roles", label: "Manage Roles", description: "Modify user permissions" },
    ]
  }
]

// --- Roles ---

type RoleId = "admin" | "coach" | "volunteer" | "accountant" | "custom"

interface RoleDefinition {
  id: RoleId
  name: string
  description: string
  defaultPermissions: string[]
}

const ROLES: RoleDefinition[] = [
  {
    id: "admin",
    name: "Admin",
    description: "Full access to all settings, user management, and financials.",
    defaultPermissions: PERMISSIONS_DATA.flatMap(g => g.items.map(i => i.id))
  },
  {
    id: "coach",
    name: "Coach",
    description: "Can manage athletes, training plans, and view events.",
    defaultPermissions: [
      "view_dashboard", 
      "view_athletes", "edit_athletes", 
      "view_plans", "manage_plans", "assign_plans",
      "view_events", "manage_events",
      "view_users"
    ]
  },
  {
    id: "accountant",
    name: "Accountant",
    description: "Access to financial overview, transactions, and reports.",
    defaultPermissions: [
      "view_dashboard",
      "view_financials", "manage_invoices", "process_payments"
    ]
  },
  {
    id: "volunteer",
    name: "Volunteer",
    description: "Limited access to view event schedules and attendance.",
    defaultPermissions: ["view_events"]
  }
]

interface User {
  id: string
  name: string
  email: string
  avatar?: string
  role: RoleId // Primary role for quick classification
  permissions: string[] // Granular permissions
  status: "active" | "invited"
  joinedDate: Date
  lastActive: Date
}

const INITIAL_USERS: User[] = [
  {
    id: "1",
    name: "Andrew Karzel",
    email: "andrewkarzel@uplifterinc.com",
    avatar: "/avatars/01.png",
    role: "admin",
    permissions: ROLES.find(r => r.id === "admin")?.defaultPermissions || [],
    status: "active",
    joinedDate: new Date("2023-01-15T12:00:00"),
    lastActive: new Date()
  },
  {
    id: "2",
    name: "Sarah Miller",
    email: "sarah.miller@example.com",
    avatar: "/avatars/02.png",
    role: "coach",
    permissions: ROLES.find(r => r.id === "coach")?.defaultPermissions || [],
    status: "active",
    joinedDate: new Date("2023-03-10T12:00:00"),
    lastActive: new Date(Date.now() - 1000 * 60 * 30) // 30 mins ago
  },
  {
    id: "3",
    name: "James Chen",
    email: "james.c@example.com",
    avatar: "/avatars/03.png",
    role: "accountant",
    permissions: ROLES.find(r => r.id === "accountant")?.defaultPermissions || [],
    status: "active",
    joinedDate: new Date("2023-06-22T12:00:00"),
    lastActive: new Date(Date.now() - 1000 * 60 * 60 * 24) // 1 day ago
  },
  {
    id: "4",
    name: "Emily Davis",
    email: "emily.d@example.com",
    avatar: "/avatars/04.png",
    role: "volunteer",
    permissions: ROLES.find(r => r.id === "volunteer")?.defaultPermissions || [],
    status: "invited",
    joinedDate: new Date("2024-01-05T12:00:00"),
    lastActive: new Date("2024-01-05T12:00:00")
  },
]

export default function UsersPage() {
  const [users, setUsers] = React.useState<User[]>(INITIAL_USERS)
  const [searchQuery, setSearchQuery] = React.useState("")
  const [roleFilter, setRoleFilter] = React.useState<string>("all")
  
  // Dialog State
  const [isDialogOpen, setIsDialogOpen] = React.useState(false)
  const [isDetailsOpen, setIsDetailsOpen] = React.useState(false)
  const [editingUser, setEditingUser] = React.useState<User | null>(null)
  const [viewingUser, setViewingUser] = React.useState<User | null>(null)
  
  // Form State
  const [selectedRole, setSelectedRole] = React.useState<RoleId>("volunteer")
  const [selectedPermissions, setSelectedPermissions] = React.useState<string[]>([])

  // Update permissions when role changes
  const handleRoleChange = (roleId: RoleId) => {
    setSelectedRole(roleId)
    if (roleId !== "custom") {
      const role = ROLES.find(r => r.id === roleId)
      if (role) {
        setSelectedPermissions([...role.defaultPermissions])
      }
    }
  }

  const togglePermission = (permId: string) => {
    setSelectedPermissions(prev => {
      const next = prev.includes(permId) 
        ? prev.filter(p => p !== permId)
        : [...prev, permId]
      
      // If we modify permissions manually, check if it still matches the selected role
      // If not, we could switch to 'custom', or just keep the role label as is but it acts as a 'base'.
      // For simplicity, let's switch to custom if it diverges? Or just leave it.
      // Let's stick to the prompt's granular nature.
      
      return next
    })
  }

  // Computed
  const filteredUsers = users.filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         user.email.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesRole = roleFilter === "all" || user.role === roleFilter
    return matchesSearch && matchesRole
  })

  const handleViewUser = (user: User) => {
    setViewingUser(user)
    setIsDetailsOpen(true)
  }

  const handleEditUser = (user: User) => {
    setEditingUser(user)
    setSelectedRole(user.role)
    setSelectedPermissions([...user.permissions])
    setIsDialogOpen(true)
  }

  const handleAddUser = () => {
    setEditingUser(null)
    setSelectedRole("volunteer")
    const defaultRole = ROLES.find(r => r.id === "volunteer")
    setSelectedPermissions(defaultRole ? [...defaultRole.defaultPermissions] : [])
    setIsDialogOpen(true)
  }

  const handleSaveUser = (e: React.FormEvent) => {
    e.preventDefault()
    const formData = new FormData(e.target as HTMLFormElement)
    const name = formData.get("name") as string
    const email = formData.get("email") as string

    // Determine if role should be custom based on permissions? 
    // For now we just trust the selectedRole dropdown or "custom" if implemented.
    // Let's keep the selectedRole as the label.

    if (editingUser) {
      // Update existing
      setUsers(users.map(u => u.id === editingUser.id ? { 
        ...u, 
        name, 
        email, 
        role: selectedRole,
        permissions: selectedPermissions 
      } : u))
    } else {
      // Create new
      const newUser: User = {
        id: Math.random().toString(36).substring(7),
        name,
        email,
        role: selectedRole,
        permissions: selectedPermissions,
        status: "invited",
        joinedDate: new Date(),
        lastActive: new Date()
      }
      setUsers([...users, newUser])
    }
    setIsDialogOpen(false)
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Users Management</h1>
        <p className="text-muted-foreground">
          Manage your users and configure granular access permissions.
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div className="flex flex-col gap-1">
            <CardTitle>Members</CardTitle>
            <CardDescription>
              View and manage users who have access to the platform.
            </CardDescription>
          </div>
          <Button onClick={handleAddUser}>
            <Plus className="mr-2 h-4 w-4" />
            Add Member
          </Button>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4 mb-6 justify-between items-end">
            <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto">
              <div className="relative w-full md:w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search users..."
                  className="pl-8"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-full md:w-[180px]">
                  <SelectValue placeholder="Filter by Role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  {ROLES.map(role => (
                    <SelectItem key={role.id} value={role.id}>{role.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden md:table-cell">Joined</TableHead>
                  <TableHead className="hidden md:table-cell">Last Active</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center">
                      No members found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div 
                          className="flex items-center gap-3 cursor-pointer hover:bg-muted/50 p-1 rounded-md transition-colors"
                          onClick={() => handleViewUser(user)}
                        >
                          <Avatar className="h-9 w-9">
                            <AvatarImage src={user.avatar} alt={user.name} />
                            <AvatarFallback>
                              {user.name.split(" ").map(n => n[0]).join("")}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex flex-col">
                            <span className="font-medium text-sm hover:underline decoration-dotted underline-offset-4">
                              {user.name}
                            </span>
                            <span className="text-muted-foreground text-xs">{user.email}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                         <Badge variant="secondary" className="rounded-sm font-normal capitalize">
                           {ROLES.find(r => r.id === user.role)?.name || user.role}
                         </Badge>
                      </TableCell>
                      <TableCell>
                        {user.status === "active" ? (
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Active</Badge>
                        ) : (
                          <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">Invited</Badge>
                        )}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                        {format(user.joinedDate, "MMM d, yyyy")}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                        {format(user.lastActive, "MMM d, h:mm a")}
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
                            <DropdownMenuItem onClick={() => handleEditUser(user)}>
                              Edit Permissions
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive">
                              Remove Member
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* User Details Dialog */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[85vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-4 flex-shrink-0">
            <DialogTitle>Member Details</DialogTitle>
          </DialogHeader>
          <ScrollArea className="flex-1 px-6 min-h-0">
            {viewingUser && (
              <div className="flex flex-col gap-6 pb-6">
                <div className="flex flex-col items-center gap-4 p-6 bg-muted/30 rounded-lg">
                  <Avatar className="h-24 w-24 border-4 border-background shadow-sm">
                    <AvatarImage src={viewingUser.avatar} alt={viewingUser.name} />
                    <AvatarFallback className="text-2xl">
                      {viewingUser.name.split(" ").map(n => n[0]).join("")}
                    </AvatarFallback>
                  </Avatar>
                  <div className="text-center space-y-1">
                    <h3 className="text-xl font-semibold">{viewingUser.name}</h3>
                    <div className="flex items-center justify-center gap-2 text-muted-foreground">
                      <Mail className="h-3.5 w-3.5" />
                      <span className="text-sm">{viewingUser.email}</span>
                    </div>
                    <div className="pt-2">
                       <Badge variant="secondary" className="mr-2">
                         {ROLES.find(r => r.id === viewingUser.role)?.name}
                       </Badge>
                      {viewingUser.status === "active" ? (
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Active Account</Badge>
                      ) : (
                        <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">Invitation Pending</Badge>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-sm font-medium flex items-center gap-2 text-muted-foreground uppercase tracking-wider">
                    <Shield className="h-4 w-4" />
                    Access & Permissions
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     {PERMISSIONS_DATA.map(group => {
                       const userHasInGroup = group.items.filter(i => viewingUser.permissions.includes(i.id))
                       if (userHasInGroup.length === 0) return null
                       return (
                         <div key={group.category} className="rounded-lg border p-4 space-y-3">
                           <h5 className="font-medium text-sm border-b pb-2">{group.category}</h5>
                           <div className="space-y-2">
                             {userHasInGroup.map(perm => (
                               <div key={perm.id} className="flex items-start gap-2 text-sm">
                                 <Check className="h-4 w-4 text-green-500 mt-0.5" />
                                 <span className="text-muted-foreground">{perm.label}</span>
                               </div>
                             ))}
                           </div>
                         </div>
                       )
                     })}
                  </div>
                  {viewingUser.permissions.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      No specific permissions assigned.
                    </div>
                  )}
                </div>
              </div>
            )}
          </ScrollArea>
          <div className="px-6 pb-6 pt-4 border-t">
            {viewingUser && (
              <div className="flex justify-end">
                <Button onClick={() => {
                  setIsDetailsOpen(false)
                  handleEditUser(viewingUser)
                }}>
                  Edit Profile
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] flex flex-col p-0 gap-0">
          <form onSubmit={handleSaveUser} className="flex flex-col h-full overflow-hidden">
            <DialogHeader className="p-6 pb-2">
              <DialogTitle>{editingUser ? "Edit Member" : "Add New Member"}</DialogTitle>
              <DialogDescription>
                Configure user details and granular permissions.
              </DialogDescription>
            </DialogHeader>
            
            <ScrollArea className="flex-1 px-6">
              <div className="grid gap-6 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name</Label>
                    <Input id="name" name="name" defaultValue={editingUser?.name} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <Input id="email" name="email" type="email" defaultValue={editingUser?.email} required />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                     <div className="space-y-1">
                        <Label className="text-base">Role Template</Label>
                        <p className="text-xs text-muted-foreground">Select a role to pre-fill permissions</p>
                     </div>
                     <Select value={selectedRole} onValueChange={(val) => handleRoleChange(val as RoleId)}>
                        <SelectTrigger className="w-[200px]">
                          <SelectValue placeholder="Select a role" />
                        </SelectTrigger>
                        <SelectContent>
                          {ROLES.map(role => (
                            <SelectItem key={role.id} value={role.id}>{role.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <Label className="text-base">Granular Permissions</Label>
                    {PERMISSIONS_DATA.map((group) => (
                      <div key={group.category} className="space-y-3">
                        <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">{group.category}</h4>
                        <div className="grid grid-cols-1 gap-2">
                          {group.items.map((perm) => {
                            const isChecked = selectedPermissions.includes(perm.id)
                            return (
                              <div 
                                key={perm.id} 
                                className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm"
                              >
                                <div className="space-y-0.5">
                                  <Label 
                                    htmlFor={`perm-${perm.id}`}
                                    className="text-base font-medium cursor-pointer"
                                  >
                                    {perm.label}
                                  </Label>
                                  <p className="text-sm text-muted-foreground">
                                    {perm.description}
                                  </p>
                                </div>
                                <Switch
                                  id={`perm-${perm.id}`}
                                  checked={isChecked}
                                  onCheckedChange={() => togglePermission(perm.id)}
                                />
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </ScrollArea>

            <DialogFooter className="p-6 pt-2 border-t mt-auto bg-background">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">
                {editingUser ? "Save Changes" : "Invite Member"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

