"use client";

import * as React from "react";
import { format } from "date-fns";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Plus, Search, Shield, Mail, Check, Loader2 } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { useFeatures } from "@/components/feature-context";
import { PERMISSION_GROUPS, PERMISSION_FEATURE_MAP, ROLE_PERMISSIONS } from "@/lib/permissions";
import type { FeatureKey } from "@/lib/feature-toggles";

// --- Roles ---
type RoleId = "admin" | "coach" | "volunteer" | "accountant" | "custom";

interface RoleDefinition {
  id: RoleId;
  name: string;
  description: string;
}

const ROLES: RoleDefinition[] = [
  {
    id: "admin",
    name: "Admin",
    description: "Full access to all settings, staff management, and financials.",
  },
  {
    id: "coach",
    name: "Coach",
    description: "Can manage athletes, training plans, and view events.",
  },
  {
    id: "accountant",
    name: "Accountant",
    description: "Access to financial overview, transactions, and reports.",
  },
  {
    id: "volunteer",
    name: "Volunteer",
    description: "Limited access to view event schedules and attendance.",
  },
];

interface User {
  id: string;
  memberId: string;
  name: string;
  email: string;
  avatar?: string;
  role: RoleId;
  permissions: string[];
  status: "active" | "invited";
  joinedDate: string;
  lastActive: string;
  title?: string | null;
  employmentType?: string | null;
}

/**
 * Checks whether an individual permission is available based on feature flags.
 * Permissions not in PERMISSION_FEATURE_MAP are always available.
 */
function isPermissionAvailable(
  permissionId: string,
  isFeatureEnabled: (key: FeatureKey) => boolean
): boolean {
  const requiredFeature =
    PERMISSION_FEATURE_MAP[permissionId as keyof typeof PERMISSION_FEATURE_MAP];
  if (!requiredFeature) return true;
  return isFeatureEnabled(requiredFeature);
}

export default function StaffPage() {
  const router = useRouter();
  const { isFeatureEnabled } = useFeatures();
  const [users, setUsers] = React.useState<User[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [roleFilter, setRoleFilter] = React.useState<string>("all");

  // Dialog State
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = React.useState(false);
  const [editingUser, setEditingUser] = React.useState<User | null>(null);
  const [viewingUser, setViewingUser] = React.useState<User | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);

  // Form State
  const [selectedRole, setSelectedRole] = React.useState<RoleId>("volunteer");
  const [selectedPermissions, setSelectedPermissions] = React.useState<string[]>([]);

  // Fetch users on mount
  React.useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/users");
      if (!response.ok) throw new Error("Failed to fetch users");
      const data = await response.json();
      setUsers(data);
    } catch (error) {
      toast.error("Failed to load staff. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Update permissions when role changes, filtering by enabled features
  const handleRoleChange = (roleId: RoleId) => {
    setSelectedRole(roleId);
    if (roleId !== "custom") {
      const roleKey = roleId.toUpperCase();
      const permissions = (ROLE_PERMISSIONS[roleKey] || []).filter((p) =>
        isPermissionAvailable(p, isFeatureEnabled)
      );
      setSelectedPermissions([...permissions]);
    }
  };

  const togglePermission = (permId: string) => {
    setSelectedPermissions((prev) =>
      prev.includes(permId) ? prev.filter((p) => p !== permId) : [...prev, permId]
    );
  };

  // Computed
  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === "all" || user.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const handleViewUser = (user: User) => {
    if (user.memberId) {
      router.push(`/dashboard/organization/staff/${user.memberId}`);
    } else {
      setViewingUser(user);
      setIsDetailsOpen(true);
    }
  };

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setSelectedRole(user.role);
    setSelectedPermissions([...user.permissions]);
    setIsDialogOpen(true);
  };

  const handleAddUser = () => {
    setEditingUser(null);
    setSelectedRole("volunteer");
    const roleKey = "VOLUNTEER";
    const permissions = ROLE_PERMISSIONS[roleKey] || [];
    setSelectedPermissions([...permissions]);
    setIsDialogOpen(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    const formData = new FormData(e.target as HTMLFormElement);
    const name = formData.get("name") as string;
    const email = formData.get("email") as string;

    try {
      if (editingUser) {
        // Update existing user
        const response = await fetch(`/api/users/${editingUser.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            email,
            role: selectedRole.toUpperCase(),
            permissions: selectedPermissions,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Failed to update staff member");
        }

        const updatedUser = await response.json();
        setUsers(users.map((u) => (u.id === editingUser.id ? updatedUser : u)));

        toast.success(`${name}'s profile has been updated.`);
      } else {
        // Create new user
        const response = await fetch("/api/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            email,
            role: selectedRole.toUpperCase(),
            permissions: selectedPermissions,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Failed to create staff member");
        }

        const newUser = await response.json();
        setUsers([newUser, ...users]);

        toast.success(`An invitation has been sent to ${email}.`);
      }

      setIsDialogOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong");
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveUser = async (user: User) => {
    if (!confirm(`Are you sure you want to remove ${user.name}? This action cannot be undone.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/users/${user.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to remove staff member");
      }

      setUsers(users.filter((u) => u.id !== user.id));

      toast.success(`${user.name} has been removed from the organization.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to remove staff member");
    }
  };

  const handleSendPasswordReset = async (user: User) => {
    try {
      const response = await fetch(`/api/users/${user.id}/send-password-reset`, {
        method: "POST",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to send password reset email");
      }

      toast.success(`Password reset email sent to ${user.email}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send password reset email");
    }
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Staff Management</h1>
        <p className="text-muted-foreground">
          Manage your staff and configure granular access permissions.
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div className="flex flex-col gap-1">
            <CardTitle>Staff</CardTitle>
            <CardDescription>
              View and manage staff who have access to the platform.
            </CardDescription>
          </div>
          <Button onClick={handleAddUser}>
            <Plus className="mr-2 h-4 w-4" />
            Add Staff Member
          </Button>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4 mb-6 justify-between items-end">
            <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto">
              <div className="relative w-full md:w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search staff..."
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
                  {ROLES.map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                      {role.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Staff Member</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="hidden md:table-cell">Title</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden lg:table-cell">Joined</TableHead>
                  <TableHead className="hidden lg:table-cell">Last Active</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center">
                      No staff found.
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
                              {user.name
                                .split(" ")
                                .map((n) => n[0])
                                .join("")}
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
                          {ROLES.find((r) => r.id === user.role)?.name || user.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                        {user.title || "—"}
                      </TableCell>
                      <TableCell>
                        {user.status === "active" ? (
                          <Badge
                            variant="outline"
                            className="bg-green-50 text-green-700 border-green-200"
                          >
                            Active
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="bg-yellow-50 text-yellow-700 border-yellow-200"
                          >
                            Invited
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell
                        className="hidden lg:table-cell text-sm text-muted-foreground"
                        suppressHydrationWarning
                      >
                        {format(new Date(user.joinedDate), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell
                        className="hidden lg:table-cell text-sm text-muted-foreground"
                        suppressHydrationWarning
                      >
                        {format(new Date(user.lastActive), "MMM d, h:mm a")}
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
                            <DropdownMenuItem onClick={() => handleViewUser(user)}>
                              Edit Staff Member
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleEditUser(user)}>
                              Edit Permissions
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleSendPasswordReset(user)}>
                              Send Password Reset
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => handleRemoveUser(user)}
                            >
                              Remove Staff Member
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
            <DialogTitle>Staff Details</DialogTitle>
          </DialogHeader>
          <ScrollArea className="flex-1 px-6 min-h-0">
            <div className="pr-4">
              {viewingUser && (
                <div className="flex flex-col gap-6 pb-6">
                  <div className="flex flex-col items-center gap-4 p-6 bg-muted/30 rounded-lg">
                    <Avatar className="h-24 w-24 border-4 border-background shadow-sm">
                      <AvatarImage src={viewingUser.avatar} alt={viewingUser.name} />
                      <AvatarFallback className="text-2xl">
                        {viewingUser.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")}
                      </AvatarFallback>
                    </Avatar>
                    <div className="text-center space-y-1">
                      <h3 className="text-xl font-semibold">{viewingUser.name}</h3>
                      <div className="flex items-center justify-center gap-2 text-muted-foreground">
                        <Mail className="h-3.5 w-3.5" />
                        <span className="text-sm">{viewingUser.email}</span>
                      </div>
                      <div className="pt-2">
                        <Badge variant="secondary" className="mr-2 capitalize">
                          {ROLES.find((r) => r.id === viewingUser.role)?.name || viewingUser.role}
                        </Badge>
                        {viewingUser.status === "active" ? (
                          <Badge
                            variant="outline"
                            className="bg-green-50 text-green-700 border-green-200"
                          >
                            Active Account
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="bg-yellow-50 text-yellow-700 border-yellow-200"
                          >
                            Invitation Pending
                          </Badge>
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
                      {PERMISSION_GROUPS.map((group) => {
                        const userHasInGroup = group.items.filter(
                          (i) =>
                            viewingUser.permissions.includes(i.id) ||
                            viewingUser.permissions.includes("*")
                        );
                        if (userHasInGroup.length === 0) return null;
                        return (
                          <div key={group.category} className="rounded-lg border p-4 space-y-3">
                            <h5 className="font-medium text-sm border-b pb-2">{group.category}</h5>
                            <div className="space-y-2">
                              {userHasInGroup.map((perm) => (
                                <div key={perm.id} className="flex items-start gap-2 text-sm">
                                  <Check className="h-4 w-4 text-green-500 mt-0.5" />
                                  <span className="text-muted-foreground">{perm.label}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
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
            </div>
          </ScrollArea>
          <div className="px-6 pb-6 pt-4 border-t flex-shrink-0">
            {viewingUser && (
              <div className="flex justify-end">
                <Button
                  onClick={() => {
                    setIsDetailsOpen(false);
                    handleEditUser(viewingUser);
                  }}
                >
                  Edit Profile
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[700px] h-[90vh] max-h-[90vh] flex flex-col p-0 overflow-hidden">
          <form onSubmit={handleSaveUser} className="flex flex-col h-full min-h-0 overflow-hidden">
            <DialogHeader className="p-6 pb-2 flex-shrink-0">
              <DialogTitle>
                {editingUser ? "Edit Staff Member" : "Add New Staff Member"}
              </DialogTitle>
              <DialogDescription>
                Configure staff member details and granular permissions.
              </DialogDescription>
            </DialogHeader>

            <ScrollArea className="flex-1 px-6 min-h-0">
              <div className="pr-4">
                <div className="grid gap-6 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Full Name</Label>
                      <Input id="name" name="name" defaultValue={editingUser?.name} required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email Address</Label>
                      <Input
                        id="email"
                        name="email"
                        type="email"
                        defaultValue={editingUser?.email}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <Label className="text-base">Role Template</Label>
                        <p className="text-xs text-muted-foreground">
                          Select a role to pre-fill permissions
                        </p>
                      </div>
                      <Select
                        value={selectedRole}
                        onValueChange={(val) => handleRoleChange(val as RoleId)}
                      >
                        <SelectTrigger className="w-[200px]">
                          <SelectValue placeholder="Select a role" />
                        </SelectTrigger>
                        <SelectContent>
                          {ROLES.map((role) => (
                            <SelectItem key={role.id} value={role.id}>
                              {role.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <Separator />

                    <div className="space-y-4">
                      <Label className="text-base">Granular Permissions</Label>
                      {PERMISSION_GROUPS.map((group) => {
                        const availableItems = group.items.filter((perm) =>
                          isPermissionAvailable(perm.id, isFeatureEnabled)
                        );
                        if (availableItems.length === 0) return null;
                        return (
                          <div key={group.category} className="space-y-3">
                            <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                              {group.category}
                            </h4>
                            <div className="grid grid-cols-1 gap-2">
                              {availableItems.map((perm) => {
                                const isChecked =
                                  selectedPermissions.includes(perm.id) ||
                                  selectedPermissions.includes("*");
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
                                      disabled={selectedPermissions.includes("*")}
                                    />
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </ScrollArea>

            <DialogFooter className="p-6 pt-2 border-t flex-shrink-0 bg-background">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingUser ? "Save Changes" : "Invite Staff Member"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
