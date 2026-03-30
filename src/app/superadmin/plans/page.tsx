"use client";

import * as React from "react";
import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Plus,
  Pencil,
  Trash2,
  MoreHorizontal,
  Check,
  Star,
  Loader2,
  Users,
  Calendar,
  UserPlus,
  MessageSquare,
  Mail,
  HardDrive,
  Tag,
  GripVertical,
  ArrowUpDown,
  BookOpen,
} from "lucide-react";
import { toast } from "sonner";

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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";

import {
  FEATURE_KEYS,
  FEATURE_LABELS,
  DEFAULT_FEATURE_TOGGLES,
  parseFeatureToggles,
  type FeatureToggles,
  type FeatureKey,
} from "@/lib/feature-toggles";

interface SubscriptionPlan {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  monthlyPrice: string;
  yearlyPrice: string | null;
  transactionFee: string;
  perTransactionFee: string;
  maxAthletes: number | null;
  maxUsers: number | null;
  maxPrograms: number | null;
  maxEvents: number | null;
  // SMS Limits
  smsIncluded: number | null;
  smsOverageRate: string | null;
  // Email Limits
  emailIncluded: number | null;
  emailOverageRate: string | null;
  // Storage Limits
  maxStorageMB: number | null;
  // Membership Limits
  maxMembershipTypes: number | null;
  features: string[];
  featureToggles: FeatureToggles;
  isPopular: boolean;
  displayOrder: number;
  isActive: boolean;
  isPublic: boolean;
  _count?: {
    subscriptions: number;
  };
}

// Sortable Plan Item for reorder dialog
function SortablePlanItem({ plan }: { plan: SubscriptionPlan }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: plan.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 rounded-lg border bg-card p-3 ${
        isDragging ? "opacity-50 shadow-lg" : ""
      }`}
    >
      <button
        className="cursor-grab touch-none text-muted-foreground hover:text-foreground"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-5 w-5" />
      </button>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium">{plan.name}</span>
          {plan.isPopular && (
            <Badge variant="secondary" className="gap-1 text-xs">
              <Star className="h-3 w-3" /> Popular
            </Badge>
          )}
          {!plan.isActive && (
            <Badge variant="outline" className="text-xs">
              Inactive
            </Badge>
          )}
        </div>
        <span className="text-sm text-muted-foreground">{plan.slug}</span>
      </div>
      <span className="text-sm text-muted-foreground">
        ${Number(plan.monthlyPrice).toFixed(2)}/mo
      </span>
    </div>
  );
}

export default function PlansPage() {
  const [plans, setPlans] = React.useState<SubscriptionPlan[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [isReorderDialogOpen, setIsReorderDialogOpen] = React.useState(false);
  const [reorderPlans, setReorderPlans] = React.useState<SubscriptionPlan[]>([]);
  const [isSavingOrder, setIsSavingOrder] = React.useState(false);
  const [editingPlan, setEditingPlan] = React.useState<SubscriptionPlan | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);

  // DnD sensors
  const sensors = useSensors(
    useSensor(MouseSensor, {}),
    useSensor(TouchSensor, {}),
    useSensor(KeyboardSensor, {})
  );

  // Form state
  const [formData, setFormData] = React.useState({
    name: "",
    slug: "",
    description: "",
    monthlyPrice: "0",
    yearlyPrice: "",
    transactionFee: "0.029",
    perTransactionFee: "0.30",
    maxAthletes: "",
    maxUsers: "",
    maxPrograms: "",
    maxEvents: "",
    // SMS Limits
    smsIncluded: "",
    smsOverageRate: "",
    // Email Limits
    emailIncluded: "",
    emailOverageRate: "",
    // Storage Limits
    maxStorageMB: "",
    // Membership Limits
    maxMembershipTypes: "",
    features: "",
    featureToggles: { ...DEFAULT_FEATURE_TOGGLES } as FeatureToggles,
    isPopular: false,
    isActive: true,
    isPublic: true,
  });

  React.useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/superadmin/plans");
      if (!response.ok) throw new Error("Failed to fetch plans");
      const data = await response.json();
      setPlans(data);
    } catch (error) {
      toast.error("Failed to load plans");
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenCreate = () => {
    setEditingPlan(null);
    setFormData({
      name: "",
      slug: "",
      description: "",
      monthlyPrice: "0",
      yearlyPrice: "",
      transactionFee: "0.029",
      perTransactionFee: "0.30",
      maxAthletes: "",
      maxUsers: "",
      maxPrograms: "",
      maxEvents: "",
      smsIncluded: "",
      smsOverageRate: "",
      emailIncluded: "",
      emailOverageRate: "",
      maxStorageMB: "",
      maxMembershipTypes: "",
      features: "",
      featureToggles: { ...DEFAULT_FEATURE_TOGGLES },
      isPopular: false,
      isActive: true,
      isPublic: true,
    });
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (plan: SubscriptionPlan) => {
    setEditingPlan(plan);
    setFormData({
      name: plan.name,
      slug: plan.slug,
      description: plan.description || "",
      monthlyPrice: plan.monthlyPrice,
      yearlyPrice: plan.yearlyPrice || "",
      transactionFee: plan.transactionFee,
      perTransactionFee: plan.perTransactionFee,
      maxAthletes: plan.maxAthletes?.toString() || "",
      maxUsers: plan.maxUsers?.toString() || "",
      maxPrograms: plan.maxPrograms?.toString() || "",
      maxEvents: plan.maxEvents?.toString() || "",
      smsIncluded: plan.smsIncluded?.toString() || "",
      smsOverageRate: plan.smsOverageRate || "",
      emailIncluded: plan.emailIncluded?.toString() || "",
      emailOverageRate: plan.emailOverageRate || "",
      maxStorageMB: plan.maxStorageMB?.toString() || "",
      maxMembershipTypes: plan.maxMembershipTypes?.toString() || "",
      features: plan.features.join("\n"),
      featureToggles: parseFeatureToggles(plan.featureToggles),
      isPopular: plan.isPopular,
      isActive: plan.isActive,
      isPublic: plan.isPublic,
    });
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const payload = {
        name: formData.name,
        slug: formData.slug,
        description: formData.description || null,
        monthlyPrice: parseFloat(formData.monthlyPrice),
        yearlyPrice: formData.yearlyPrice ? parseFloat(formData.yearlyPrice) : null,
        transactionFee: parseFloat(formData.transactionFee),
        perTransactionFee: parseFloat(formData.perTransactionFee),
        maxAthletes: formData.maxAthletes ? parseInt(formData.maxAthletes) : null,
        maxUsers: formData.maxUsers ? parseInt(formData.maxUsers) : null,
        maxPrograms: formData.maxPrograms ? parseInt(formData.maxPrograms) : null,
        maxEvents: formData.maxEvents ? parseInt(formData.maxEvents) : null,
        smsIncluded: formData.smsIncluded ? parseInt(formData.smsIncluded) : null,
        smsOverageRate: formData.smsOverageRate ? parseFloat(formData.smsOverageRate) : null,
        emailIncluded: formData.emailIncluded ? parseInt(formData.emailIncluded) : null,
        emailOverageRate: formData.emailOverageRate ? parseFloat(formData.emailOverageRate) : null,
        maxStorageMB: formData.maxStorageMB ? parseInt(formData.maxStorageMB) : null,
        maxMembershipTypes: formData.maxMembershipTypes
          ? parseInt(formData.maxMembershipTypes)
          : null,
        features: formData.features
          .split("\n")
          .map((f) => f.trim())
          .filter(Boolean),
        featureToggles: formData.featureToggles,
        isPopular: formData.isPopular,
        // Auto-assign display order for new plans (add to end)
        ...(editingPlan ? {} : { displayOrder: plans.length }),
        isActive: formData.isActive,
        isPublic: formData.isPublic,
      };

      const url = editingPlan ? `/api/superadmin/plans/${editingPlan.id}` : "/api/superadmin/plans";

      const response = await fetch(url, {
        method: editingPlan ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to save plan");
      }

      toast.success(editingPlan ? "Plan updated" : "Plan created");
      setIsDialogOpen(false);
      fetchPlans();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save plan");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (plan: SubscriptionPlan) => {
    if (!confirm(`Are you sure you want to delete "${plan.name}"? This cannot be undone.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/superadmin/plans/${plan.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete plan");
      }

      toast.success("Plan deleted");
      fetchPlans();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete plan");
    }
  };

  const handleToggleActive = async (plan: SubscriptionPlan) => {
    try {
      const response = await fetch(`/api/superadmin/plans/${plan.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !plan.isActive }),
      });

      if (!response.ok) throw new Error("Failed to update plan");

      toast.success(plan.isActive ? "Plan deactivated" : "Plan activated");
      fetchPlans();
    } catch (error) {
      toast.error("Failed to update plan");
    }
  };

  const handleOpenReorder = () => {
    setReorderPlans([...plans]);
    setIsReorderDialogOpen(true);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setReorderPlans((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const handleSaveOrder = async () => {
    setIsSavingOrder(true);
    try {
      // Update each plan's displayOrder
      const updates = reorderPlans.map((plan, index) => ({
        id: plan.id,
        displayOrder: index,
      }));

      const response = await fetch("/api/superadmin/plans/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plans: updates }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to save order");
      }

      toast.success("Plan order updated");
      setIsReorderDialogOpen(false);
      fetchPlans();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save order");
    } finally {
      setIsSavingOrder(false);
    }
  };

  const formatCurrency = (amount: string | number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(Number(amount));
  };

  const formatPercent = (amount: string | number) => {
    return `${(Number(amount) * 100).toFixed(1)}%`;
  };

  return (
    <div className="flex flex-col gap-6 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Subscription Plans</h1>
          <p className="text-muted-foreground">
            Manage billing plans that organizations can subscribe to
          </p>
        </div>
        <div className="flex gap-2">
          {plans.length > 1 && (
            <Button variant="outline" onClick={handleOpenReorder}>
              <ArrowUpDown className="mr-2 h-4 w-4" />
              Reorder
            </Button>
          )}
          <Button onClick={handleOpenCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Create Plan
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : plans.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground mb-4">No subscription plans yet</p>
            <Button onClick={handleOpenCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Create Your First Plan
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan) => (
            <Card key={plan.id} className={!plan.isActive ? "opacity-60" : ""}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-lg">{plan.name}</CardTitle>
                      {plan.isPopular && (
                        <Badge variant="secondary" className="gap-1">
                          <Star className="h-3 w-3" /> Popular
                        </Badge>
                      )}
                    </div>
                    <CardDescription className="mt-1">{plan.slug}</CardDescription>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleOpenEdit(plan)}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleToggleActive(plan)}>
                        {plan.isActive ? "Deactivate" : "Activate"}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => handleDelete(plan)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold">{formatCurrency(plan.monthlyPrice)}</span>
                    <span className="text-muted-foreground">/mo</span>
                  </div>
                  {plan.yearlyPrice && (
                    <p className="text-sm text-muted-foreground">
                      or {formatCurrency(plan.yearlyPrice)}/year
                    </p>
                  )}
                </div>

                <div className="text-sm space-y-1">
                  <p>
                    <span className="text-muted-foreground">Transaction fee:</span>{" "}
                    <strong>
                      {formatPercent(plan.transactionFee)} +{" "}
                      {formatCurrency(plan.perTransactionFee)}
                    </strong>
                  </p>
                </div>

                <Separator />

                <div className="grid grid-cols-4 gap-2 text-center text-sm">
                  <div>
                    <Users className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                    <p className="font-medium">{plan.maxAthletes || "∞"}</p>
                    <p className="text-xs text-muted-foreground">Athletes</p>
                  </div>
                  <div>
                    <UserPlus className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                    <p className="font-medium">{plan.maxUsers || "∞"}</p>
                    <p className="text-xs text-muted-foreground">Users</p>
                  </div>
                  <div>
                    <BookOpen className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                    <p className="font-medium">{plan.maxPrograms || "∞"}</p>
                    <p className="text-xs text-muted-foreground">Programs</p>
                  </div>
                  <div>
                    <Calendar className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                    <p className="font-medium">{plan.maxEvents || "∞"}</p>
                    <p className="text-xs text-muted-foreground">Events</p>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-2 text-center text-sm">
                  <div>
                    <MessageSquare className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                    <p className="font-medium">{plan.smsIncluded || "—"}</p>
                    <p className="text-xs text-muted-foreground">SMS/mo</p>
                  </div>
                  <div>
                    <Mail className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                    <p className="font-medium">{plan.emailIncluded || "—"}</p>
                    <p className="text-xs text-muted-foreground">Email/mo</p>
                  </div>
                  <div>
                    <HardDrive className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                    <p className="font-medium">
                      {plan.maxStorageMB
                        ? `${plan.maxStorageMB >= 1000 ? `${plan.maxStorageMB / 1000}GB` : `${plan.maxStorageMB}MB`}`
                        : "∞"}
                    </p>
                    <p className="text-xs text-muted-foreground">Storage</p>
                  </div>
                  <div>
                    <Tag className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                    <p className="font-medium">{plan.maxMembershipTypes || "∞"}</p>
                    <p className="text-xs text-muted-foreground">Memberships</p>
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Modules
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {FEATURE_KEYS.map((key) => {
                      const enabled = parseFeatureToggles(plan.featureToggles)[key];
                      return (
                        <Badge
                          key={key}
                          variant={enabled ? "default" : "outline"}
                          className={`text-xs ${!enabled ? "opacity-40" : ""}`}
                        >
                          {FEATURE_LABELS[key]}
                        </Badge>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-2">
                  {plan.features.slice(0, 4).map((feature, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-green-500" />
                      <span>{feature}</span>
                    </div>
                  ))}
                  {plan.features.length > 4 && (
                    <p className="text-sm text-muted-foreground">
                      +{plan.features.length - 4} more features
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between pt-2">
                  <div className="flex gap-2">
                    {!plan.isActive && <Badge variant="secondary">Inactive</Badge>}
                    {!plan.isPublic && <Badge variant="outline">Hidden</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {plan._count?.subscriptions || 0} orgs
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPlan ? "Edit Plan" : "Create Plan"}</DialogTitle>
            <DialogDescription>
              {editingPlan ? "Update subscription plan details" : "Add a new subscription plan"}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-6 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Plan Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Gold"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="slug">Slug</Label>
                <Input
                  id="slug"
                  value={formData.slug}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      slug: e.target.value.toLowerCase().replace(/\s+/g, "-"),
                    })
                  }
                  placeholder="e.g., gold"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Brief description of this plan"
                rows={2}
              />
            </div>

            <Separator />

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="monthlyPrice">Monthly Price ($)</Label>
                <Input
                  id="monthlyPrice"
                  type="number"
                  step="0.01"
                  value={formData.monthlyPrice}
                  onChange={(e) => setFormData({ ...formData, monthlyPrice: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="yearlyPrice">Yearly Price ($) (optional)</Label>
                <Input
                  id="yearlyPrice"
                  type="number"
                  step="0.01"
                  value={formData.yearlyPrice}
                  onChange={(e) => setFormData({ ...formData, yearlyPrice: e.target.value })}
                  placeholder="Leave blank for no yearly option"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="transactionFee">Transaction Fee (%)</Label>
                <Input
                  id="transactionFee"
                  type="number"
                  step="0.001"
                  value={formData.transactionFee}
                  onChange={(e) => setFormData({ ...formData, transactionFee: e.target.value })}
                  placeholder="e.g., 0.029 for 2.9%"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="perTransactionFee">Per Transaction Fee ($)</Label>
                <Input
                  id="perTransactionFee"
                  type="number"
                  step="0.01"
                  value={formData.perTransactionFee}
                  onChange={(e) => setFormData({ ...formData, perTransactionFee: e.target.value })}
                  placeholder="e.g., 0.30"
                />
              </div>
            </div>

            <Separator />

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="maxAthletes">Max Athletes</Label>
                <Input
                  id="maxAthletes"
                  type="number"
                  value={formData.maxAthletes}
                  onChange={(e) => setFormData({ ...formData, maxAthletes: e.target.value })}
                  placeholder="Unlimited"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="maxUsers">Max Users</Label>
                <Input
                  id="maxUsers"
                  type="number"
                  value={formData.maxUsers}
                  onChange={(e) => setFormData({ ...formData, maxUsers: e.target.value })}
                  placeholder="Unlimited"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="maxPrograms">Max Programs</Label>
                <Input
                  id="maxPrograms"
                  type="number"
                  value={formData.maxPrograms}
                  onChange={(e) => setFormData({ ...formData, maxPrograms: e.target.value })}
                  placeholder="Unlimited"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="maxEvents">Max Events</Label>
                <Input
                  id="maxEvents"
                  type="number"
                  value={formData.maxEvents}
                  onChange={(e) => setFormData({ ...formData, maxEvents: e.target.value })}
                  placeholder="Unlimited"
                />
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <h4 className="font-medium">Usage Limits</h4>
              <p className="text-sm text-muted-foreground">Set monthly quotas and overage rates</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="smsIncluded">SMS Included (per month)</Label>
                <Input
                  id="smsIncluded"
                  type="number"
                  value={formData.smsIncluded}
                  onChange={(e) => setFormData({ ...formData, smsIncluded: e.target.value })}
                  placeholder="No SMS"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="smsOverageRate">SMS Overage Rate ($)</Label>
                <Input
                  id="smsOverageRate"
                  type="number"
                  step="0.01"
                  value={formData.smsOverageRate}
                  onChange={(e) => setFormData({ ...formData, smsOverageRate: e.target.value })}
                  placeholder="e.g., 0.05"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="emailIncluded">Emails Included (per month)</Label>
                <Input
                  id="emailIncluded"
                  type="number"
                  value={formData.emailIncluded}
                  onChange={(e) => setFormData({ ...formData, emailIncluded: e.target.value })}
                  placeholder="No emails"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="emailOverageRate">Email Overage Rate ($)</Label>
                <Input
                  id="emailOverageRate"
                  type="number"
                  step="0.001"
                  value={formData.emailOverageRate}
                  onChange={(e) => setFormData({ ...formData, emailOverageRate: e.target.value })}
                  placeholder="e.g., 0.005"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="maxStorageMB">Max Storage (MB)</Label>
                <Input
                  id="maxStorageMB"
                  type="number"
                  value={formData.maxStorageMB}
                  onChange={(e) => setFormData({ ...formData, maxStorageMB: e.target.value })}
                  placeholder="Unlimited"
                />
                <p className="text-xs text-muted-foreground">1000 MB = 1 GB</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="maxMembershipTypes">Max Membership Types</Label>
                <Input
                  id="maxMembershipTypes"
                  type="number"
                  value={formData.maxMembershipTypes}
                  onChange={(e) => setFormData({ ...formData, maxMembershipTypes: e.target.value })}
                  placeholder="Unlimited"
                />
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <h4 className="font-medium">Module Access</h4>
              <p className="text-sm text-muted-foreground">
                Toggle which modules organizations on this plan can access
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {FEATURE_KEYS.map((key) => (
                <div key={key} className="flex items-center justify-between rounded-lg border p-3">
                  <Label htmlFor={`toggle-${key}`} className="cursor-pointer">
                    {FEATURE_LABELS[key]}
                  </Label>
                  <Switch
                    id={`toggle-${key}`}
                    checked={formData.featureToggles[key]}
                    onCheckedChange={(checked) =>
                      setFormData({
                        ...formData,
                        featureToggles: { ...formData.featureToggles, [key]: checked },
                      })
                    }
                  />
                </div>
              ))}
            </div>

            <Separator />

            <div className="space-y-2">
              <Label htmlFor="features">Features (one per line)</Label>
              <Textarea
                id="features"
                value={formData.features}
                onChange={(e) => setFormData({ ...formData, features: e.target.value })}
                placeholder="Full Club Management Suite&#10;Unlimited Athletes&#10;Priority Support"
                rows={5}
              />
              <p className="text-xs text-muted-foreground">
                Display-only feature list shown on pricing pages
              </p>
            </div>

            <Separator />

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Mark as Popular</Label>
                  <p className="text-sm text-muted-foreground">Highlight this plan for users</p>
                </div>
                <Switch
                  checked={formData.isPopular}
                  onCheckedChange={(checked) => setFormData({ ...formData, isPopular: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Active</Label>
                  <p className="text-sm text-muted-foreground">Can be assigned to organizations</p>
                </div>
                <Switch
                  checked={formData.isActive}
                  onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Public</Label>
                  <p className="text-sm text-muted-foreground">
                    Organizations can self-select this plan
                  </p>
                </div>
                <Switch
                  checked={formData.isPublic}
                  onCheckedChange={(checked) => setFormData({ ...formData, isPublic: checked })}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingPlan ? "Save Changes" : "Create Plan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reorder Dialog */}
      <Dialog open={isReorderDialogOpen} onOpenChange={setIsReorderDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reorder Plans</DialogTitle>
            <DialogDescription>
              Drag and drop to reorder how plans appear to users
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              modifiers={[restrictToVerticalAxis]}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={reorderPlans.map((p) => p.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="flex flex-col gap-2">
                  {reorderPlans.map((plan) => (
                    <SortablePlanItem key={plan.id} plan={plan} />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsReorderDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveOrder} disabled={isSavingOrder}>
              {isSavingOrder && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
