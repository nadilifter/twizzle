"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import {
  ArrowLeft,
  Edit,
  Loader2,
  DollarSign,
  Hash,
  Activity,
  Layers,
  Save,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ResponsiveTabsList } from "@/components/ui/responsive-tabs";
import { useBreadcrumbOverride } from "@/components/breadcrumb-context";
import { toast } from "sonner";

interface AssignedProgram {
  id: string;
  name: string;
  status: string;
  basePrice: number | null;
}

interface AssignedEvent {
  id: string;
  title: string;
  date: string;
  type: string;
}

interface AssignedCompetition {
  id: string;
  name: string;
  status: string;
  startDate: string;
}

interface AssignedProduct {
  id: string;
  name: string;
  price: number;
  isActive: boolean;
}

interface AssignedMembershipGroup {
  id: string;
  name: string;
  defaultPrice: number | null;
}

interface AssignedPass {
  id: string;
  name: string;
  price: number;
  status: string;
}

interface GLCodeDetail {
  id: string;
  code: string;
  description: string;
  type: string;
  status: string;
  isDefault: boolean;
  defaultForType: string | null;
  createdAt: string;
  updatedAt: string;
  programs: AssignedProgram[];
  events: AssignedEvent[];
  competitions: AssignedCompetition[];
  products: AssignedProduct[];
  membershipGroups: AssignedMembershipGroup[];
  passes: AssignedPass[];
  _count: {
    programs: number;
    events: number;
    competitions: number;
    products: number;
    membershipGroups: number;
    passes: number;
    lineItems: number;
    ledgerEntries: number;
  };
  totalAmount: number;
  transactionCount: number;
}

const TYPE_BADGE_COLORS: Record<string, string> = {
  REVENUE: "bg-emerald-500 hover:bg-emerald-600 border-emerald-500/50 text-white",
  EXPENSE: "bg-rose-500 hover:bg-rose-600 border-rose-500/50 text-white",
  LIABILITY: "bg-amber-500 hover:bg-amber-600 border-amber-500/50 text-white",
  ASSET: "bg-blue-500 hover:bg-blue-600 border-blue-500/50 text-white",
  EQUITY: "bg-purple-500 hover:bg-purple-600 border-purple-500/50 text-white",
};

const ENTITY_TYPE_LABELS: Record<string, string> = {
  PROGRAM: "Programs",
  EVENT: "Events",
  COMPETITION: "Competitions",
  MEMBERSHIP: "Memberships",
  PASS: "Passes",
  PRODUCT: "Products",
};

export default function GLCodeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [glCode, setGlCode] = useState<GLCodeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState({ code: "", description: "", type: "", status: "" });

  useBreadcrumbOverride(
    `/dashboard/financials/ledgers/${id}`,
    glCode ? `${glCode.code} - ${glCode.description}` : "GL Code"
  );

  const fetchGlCode = useCallback(async () => {
    try {
      const response = await fetch(`/api/ledgers/${id}`);
      if (!response.ok) {
        if (response.status === 404) {
          toast.error("GL code not found");
          router.push("/dashboard/financials/ledgers");
          return;
        }
        throw new Error("Failed to fetch GL code");
      }
      const data = await response.json();
      setGlCode(data);
      setEditForm({
        code: data.code,
        description: data.description,
        type: data.type,
        status: data.status,
      });
    } catch (error) {
      console.error("Error fetching GL code:", error);
      toast.error("Failed to load GL code");
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    fetchGlCode();
  }, [fetchGlCode]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch(`/api/ledgers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update");
      }
      toast.success("GL code updated");
      setEditing(false);
      fetchGlCode();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update GL code");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-8 w-48" />
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!glCode) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <p className="text-muted-foreground">GL code not found</p>
        <Button asChild>
          <Link href="/dashboard/financials/ledgers">Back to Ledgers</Link>
        </Button>
      </div>
    );
  }

  const totalAssignedEntities =
    glCode._count.programs +
    glCode._count.events +
    glCode._count.competitions +
    glCode._count.products +
    glCode._count.membershipGroups +
    glCode._count.passes;

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <Link
          href="/dashboard/financials/ledgers"
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Ledgers
        </Link>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div>
              {editing ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={editForm.code}
                    onChange={(e) => setEditForm((p) => ({ ...p, code: e.target.value }))}
                    className="font-bold text-lg w-32"
                  />
                  <span className="text-muted-foreground">-</span>
                  <Input
                    value={editForm.description}
                    onChange={(e) => setEditForm((p) => ({ ...p, description: e.target.value }))}
                    className="text-lg w-64"
                  />
                </div>
              ) : (
                <h1 className="text-2xl font-bold tracking-tight">
                  {glCode.code} - {glCode.description}
                </h1>
              )}
              <div className="flex items-center gap-2 mt-1">
                {editing ? (
                  <Select
                    value={editForm.type}
                    onValueChange={(v) => setEditForm((p) => ({ ...p, type: v }))}
                  >
                    <SelectTrigger className="w-32 h-7 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {["REVENUE", "EXPENSE", "LIABILITY", "ASSET", "EQUITY"].map((t) => (
                        <SelectItem key={t} value={t}>
                          {t.charAt(0) + t.slice(1).toLowerCase()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Badge className={TYPE_BADGE_COLORS[glCode.type] || ""}>
                    {glCode.type.charAt(0) + glCode.type.slice(1).toLowerCase()}
                  </Badge>
                )}
                {editing ? (
                  <Select
                    value={editForm.status}
                    onValueChange={(v) => setEditForm((p) => ({ ...p, status: v }))}
                  >
                    <SelectTrigger className="w-28 h-7 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ACTIVE">Active</SelectItem>
                      <SelectItem value="INACTIVE">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <Badge
                    variant={glCode.status === "ACTIVE" ? "default" : "secondary"}
                    className={glCode.status === "ACTIVE" ? "bg-green-500 hover:bg-green-600" : ""}
                  >
                    {glCode.status === "ACTIVE" ? "Active" : "Inactive"}
                  </Badge>
                )}
                {glCode.isDefault && <Badge variant="outline">System Default</Badge>}
                {glCode.defaultForType && (
                  <Badge variant="outline" className="text-muted-foreground">
                    Default for {ENTITY_TYPE_LABELS[glCode.defaultForType] || glCode.defaultForType}
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {editing ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditing(false)}
                  disabled={saving}
                >
                  <X className="mr-2 h-4 w-4" />
                  Cancel
                </Button>
                <Button size="sm" onClick={handleSave} disabled={saving}>
                  {saving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  Save
                </Button>
              </>
            ) : (
              <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Amount</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${glCode.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground">
              From {glCode.transactionCount} line items
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Assigned Entities</CardTitle>
            <Layers className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalAssignedEntities}</div>
            <p className="text-xs text-muted-foreground">Programs, events, products, etc.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Transactions</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{glCode.transactionCount}</div>
            <p className="text-xs text-muted-foreground">Invoiced line items</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ledger Entries</CardTitle>
            <Hash className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{glCode._count.ledgerEntries}</div>
            <p className="text-xs text-muted-foreground">Manual journal entries</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <ResponsiveTabsList value={activeTab} onValueChange={setActiveTab}>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="assignments">Assignments ({totalAssignedEntities})</TabsTrigger>
          <TabsTrigger value="activity">Activity ({glCode.transactionCount})</TabsTrigger>
        </ResponsiveTabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground text-xs">Code</Label>
                    <p className="font-mono font-medium">{glCode.code}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">Type</Label>
                    <p>{glCode.type.charAt(0) + glCode.type.slice(1).toLowerCase()}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">Status</Label>
                    <p>{glCode.status === "ACTIVE" ? "Active" : "Inactive"}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">System Default</Label>
                    <p>{glCode.isDefault ? "Yes" : "No"}</p>
                  </div>
                  {glCode.defaultForType && (
                    <div className="col-span-2">
                      <Label className="text-muted-foreground text-xs">Default For</Label>
                      <p>{ENTITY_TYPE_LABELS[glCode.defaultForType]}</p>
                    </div>
                  )}
                  <div>
                    <Label className="text-muted-foreground text-xs">Created</Label>
                    <p className="text-sm">{format(new Date(glCode.createdAt), "MMM d, yyyy")}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">Last Updated</Label>
                    <p className="text-sm">{format(new Date(glCode.updatedAt), "MMM d, yyyy")}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Assignment Breakdown</CardTitle>
                <CardDescription>Entities using this GL code</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    { label: "Programs", count: glCode._count.programs },
                    { label: "Events", count: glCode._count.events },
                    { label: "Competitions", count: glCode._count.competitions },
                    { label: "Memberships", count: glCode._count.membershipGroups },
                    { label: "Passes", count: glCode._count.passes },
                    { label: "Products", count: glCode._count.products },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">{item.label}</span>
                      <span className="text-sm font-medium">{item.count}</span>
                    </div>
                  ))}
                  <Separator />
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Total</span>
                    <span className="text-sm font-bold">{totalAssignedEntities}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Assignments Tab */}
        <TabsContent value="assignments" className="space-y-6">
          {glCode.programs.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Programs ({glCode.programs.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Price</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {glCode.programs.map((program) => (
                      <TableRow key={program.id}>
                        <TableCell>
                          <Link
                            href={`/dashboard/registrations/programs/${program.id}`}
                            className="text-primary hover:underline font-medium"
                          >
                            {program.name}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={program.status === "ACTIVE" ? "default" : "secondary"}
                            className={
                              program.status === "ACTIVE" ? "bg-green-500 hover:bg-green-600" : ""
                            }
                          >
                            {program.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {program.basePrice != null
                            ? `$${Number(program.basePrice).toFixed(2)}`
                            : "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {glCode.events.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Events ({glCode.events.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {glCode.events.map((event) => (
                      <TableRow key={event.id}>
                        <TableCell>
                          <Link
                            href={`/dashboard/events/${event.id}`}
                            className="text-primary hover:underline font-medium"
                          >
                            {event.title}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{event.type}</Badge>
                        </TableCell>
                        <TableCell>{format(new Date(event.date), "MMM d, yyyy")}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {glCode.competitions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Competitions ({glCode.competitions.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Start Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {glCode.competitions.map((comp) => (
                      <TableRow key={comp.id}>
                        <TableCell>
                          <Link
                            href={`/dashboard/competitions/${comp.id}`}
                            className="text-primary hover:underline font-medium"
                          >
                            {comp.name}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{comp.status}</Badge>
                        </TableCell>
                        <TableCell>{format(new Date(comp.startDate), "MMM d, yyyy")}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {glCode.membershipGroups.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Memberships ({glCode.membershipGroups.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead className="text-right">Default Price</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {glCode.membershipGroups.map((group) => (
                      <TableRow key={group.id}>
                        <TableCell className="font-medium">{group.name}</TableCell>
                        <TableCell className="text-right font-mono">
                          {group.defaultPrice != null
                            ? `$${Number(group.defaultPrice).toFixed(2)}`
                            : "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {glCode.passes.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Passes ({glCode.passes.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Price</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {glCode.passes.map((pass) => (
                      <TableRow key={pass.id}>
                        <TableCell className="font-medium">{pass.name}</TableCell>
                        <TableCell>
                          <Badge
                            variant={pass.status === "ACTIVE" ? "default" : "secondary"}
                            className={
                              pass.status === "ACTIVE" ? "bg-green-500 hover:bg-green-600" : ""
                            }
                          >
                            {pass.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          ${Number(pass.price).toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {glCode.products.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Products ({glCode.products.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Price</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {glCode.products.map((product) => (
                      <TableRow key={product.id}>
                        <TableCell className="font-medium">{product.name}</TableCell>
                        <TableCell>
                          <Badge
                            variant={product.isActive ? "default" : "secondary"}
                            className={product.isActive ? "bg-green-500 hover:bg-green-600" : ""}
                          >
                            {product.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          ${Number(product.price).toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {totalAssignedEntities === 0 && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Layers className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground text-center">
                  No entities are assigned to this GL code yet.
                  <br />
                  Assign programs, events, or products from their configuration pages.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Activity Tab */}
        <TabsContent value="activity">
          <Card>
            <CardHeader>
              <CardTitle>Transaction Activity</CardTitle>
              <CardDescription>
                Invoice line items that were recorded with this GL code
              </CardDescription>
            </CardHeader>
            <CardContent>
              {glCode.transactionCount === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Activity className="h-12 w-12 text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground text-center">
                    No transactions recorded yet.
                    <br />
                    Activity will appear here as invoices are created with this GL code.
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {glCode.transactionCount} line items totaling $
                  {glCode.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
