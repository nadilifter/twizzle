"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
} from "@/components/ui/alert-dialog";
import { ArrowLeft, Plus, Trash2, Shield } from "lucide-react";
import { toast } from "sonner";

type ReservedDomain = {
  id: string;
  pattern: string;
  type: "EXACT" | "PREFIX";
  reason: string | null;
  createdAt: string;
};

export default function AdminReservedDomainsPage() {
  const [reservedDomains, setReservedDomains] = useState<ReservedDomain[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [pattern, setPattern] = useState("");
  const [type, setType] = useState<"EXACT" | "PREFIX">("EXACT");
  const [reason, setReason] = useState("");

  const fetchReservedDomains = async () => {
    try {
      const res = await fetch("/api/admin/reserved-domains");
      if (res.ok) {
        const data = await res.json();
        setReservedDomains(data);
      }
    } catch (error) {
      console.error("Failed to fetch reserved domains:", error);
      toast.error("Failed to load reserved domains");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReservedDomains();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const res = await fetch("/api/admin/reserved-domains", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pattern: pattern.toLowerCase(), type, reason }),
      });

      if (res.ok) {
        toast.success("Reserved domain added successfully");
        setDialogOpen(false);
        setPattern("");
        setType("EXACT");
        setReason("");
        fetchReservedDomains();
      } else {
        const error = await res.json();
        toast.error(error.error || "Failed to add reserved domain");
      }
    } catch (error) {
      toast.error("Failed to add reserved domain");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/reserved-domains/${id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        toast.success("Reserved domain removed");
        fetchReservedDomains();
      } else {
        toast.error("Failed to remove reserved domain");
      }
    } catch (error) {
      toast.error("Failed to remove reserved domain");
    }
  };

  return (
    <div className="flex flex-col gap-6 p-4">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/superadmin/domains">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Domains
          </Link>
        </Button>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6" />
            Reserved Domains
          </h1>
          <p className="text-muted-foreground">
            Manage reserved domain patterns that organizations cannot use
          </p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Reserved Domain
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>Add Reserved Domain</DialogTitle>
                <DialogDescription>
                  Reserve a domain pattern to prevent organizations from using it.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="pattern">Pattern</Label>
                  <Input
                    id="pattern"
                    placeholder="e.g., admin, test-, support"
                    value={pattern}
                    onChange={(e) => setPattern(e.target.value)}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    The domain pattern to reserve. Use lowercase letters, numbers, and hyphens.
                  </p>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="type">Match Type</Label>
                  <Select value={type} onValueChange={(v) => setType(v as "EXACT" | "PREFIX")}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="EXACT">
                        Exact Match - Blocks only this exact subdomain
                      </SelectItem>
                      <SelectItem value="PREFIX">
                        Prefix Match - Blocks any subdomain starting with this pattern
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="reason">Reason (optional)</Label>
                  <Input
                    id="reason"
                    placeholder="e.g., Brand protection, System use"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting || !pattern}>
                  {submitting ? "Adding..." : "Add Reserved Domain"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Reserved Domains Table */}
      <Card>
        <CardHeader>
          <CardTitle>Reserved Patterns</CardTitle>
          <CardDescription>
            These patterns are blocked and cannot be used by organizations for their sites
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : reservedDomains.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No reserved domains configured. Add patterns that should be blocked.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pattern</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reservedDomains.map((domain) => (
                  <TableRow key={domain.id}>
                    <TableCell className="font-mono">
                      {domain.pattern}
                      {domain.type === "PREFIX" && <span className="text-muted-foreground">*</span>}
                    </TableCell>
                    <TableCell>
                      <Badge variant={domain.type === "EXACT" ? "default" : "secondary"}>
                        {domain.type === "EXACT" ? "Exact" : "Prefix"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{domain.reason || "-"}</TableCell>
                    <TableCell>{new Date(domain.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remove Reserved Domain?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will allow organizations to use &quot;{domain.pattern}&quot; as a
                              subdomain. This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDelete(domain.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Remove
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
