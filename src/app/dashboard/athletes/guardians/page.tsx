"use client";

import * as React from "react";
import {
  Plus,
  Search,
  Filter,
  MoreHorizontal,
  Mail,
  Phone,
  Users,
  Loader2,
  AlertCircle,
} from "lucide-react";
import Link from "next/link";

import { formatPhoneNumberIntl } from "react-phone-number-input";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

interface GuardianAthlete {
  id: string;
  name: string;
  status: string;
}

interface Guardian {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  balance: number | string | null;
  status: string | null;
  athletes: GuardianAthlete[];
}

export default function GuardiansPage() {
  const [searchTerm, setSearchTerm] = React.useState("");
  const [guardians, setGuardians] = React.useState<Guardian[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [inviteEmail, setInviteEmail] = React.useState("");
  const [inviteName, setInviteName] = React.useState("");
  const [isInviting, setIsInviting] = React.useState(false);

  const fetchGuardians = React.useCallback(async (search?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      const res = await fetch(`/api/guardians?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch guardians");
      const json = await res.json();
      setGuardians(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch guardians");
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      fetchGuardians(searchTerm);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm, fetchGuardians]);

  const handleInviteGuardian = async () => {
    if (!inviteEmail) return;
    setIsInviting(true);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: inviteName || inviteEmail,
          email: inviteEmail,
          role: "PARENT",
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to invite guardian");
      }
      setDialogOpen(false);
      setInviteEmail("");
      setInviteName("");
      fetchGuardians(searchTerm);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to invite guardian");
    } finally {
      setIsInviting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Guardians</h1>
          <p className="text-muted-foreground">
            Manage guardian accounts, billing, and contact information.
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Guardian
        </Button>
      </div>

      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-1 max-w-sm">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search guardians..."
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

      {isLoading && guardians.length === 0 && (
        <div className="flex items-center justify-center h-64">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-muted-foreground">Loading guardians...</p>
          </div>
        </div>
      )}

      {error && !isLoading && guardians.length === 0 && (
        <div className="flex items-center justify-center h-64">
          <div className="flex flex-col items-center gap-2 text-destructive">
            <AlertCircle className="h-8 w-8" />
            <p>Failed to load guardians</p>
            <Button variant="outline" onClick={() => fetchGuardians()}>
              Try Again
            </Button>
          </div>
        </div>
      )}

      {(!isLoading || guardians.length > 0) && !error && (
        <div className="rounded-md border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Guardian Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Athletes</TableHead>
                <TableHead className="text-right">Balance</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {guardians.map((guardian) => (
                <TableRow key={guardian.id}>
                  <TableCell className="font-medium">
                    <Link
                      href={`/dashboard/athletes/guardians/${guardian.id}`}
                      className="hover:underline"
                    >
                      {guardian.name || "—"}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Mail className="h-3 w-3" /> {guardian.email || "—"}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Phone className="h-3 w-3" />{" "}
                      {guardian.phone
                        ? formatPhoneNumberIntl(guardian.phone) || guardian.phone
                        : "—"}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span>{guardian.athletes.length}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge
                      variant={
                        Number(guardian.balance) > 0
                          ? "destructive"
                          : Number(guardian.balance) < 0
                            ? "secondary"
                            : "outline"
                      }
                      className={
                        Number(guardian.balance) < 0
                          ? "text-green-600 border-green-200 bg-green-50"
                          : ""
                      }
                    >
                      ${Math.abs(Number(guardian.balance || 0)).toFixed(2)}
                      {Number(guardian.balance) < 0 ? " CR" : ""}
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
                          <Link href={`/dashboard/athletes/guardians/${guardian.id}`}>
                            View Details
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem>Create Invoice</DropdownMenuItem>
                        <DropdownMenuItem>Process Payment</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
              {guardians.length === 0 && (
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Guardian</DialogTitle>
            <DialogDescription>
              Invite a guardian by email. They will receive an invitation to create their account.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="invite-name">Name</Label>
              <Input
                id="invite-name"
                placeholder="Guardian name"
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-email">Email</Label>
              <Input
                id="invite-email"
                type="email"
                placeholder="guardian@example.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={isInviting}>
              Cancel
            </Button>
            <Button onClick={handleInviteGuardian} disabled={!inviteEmail || isInviting}>
              {isInviting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Inviting...
                </>
              ) : (
                "Send Invitation"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
