"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DashboardPageHeader } from "@/components/dashboard-page-header";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import { DataTablePagination } from "@/components/data-table/data-table-pagination";
import { DataTableViewOptions } from "@/components/data-table/data-table-view-options";
import {
  MoreHorizontal,
  Plus,
  Search,
  Package,
  AlertCircle,
  Infinity,
  RefreshCw,
  Loader2,
  Trash2,
  Filter,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { GLCodeSelector } from "@/components/gl-code-selector";
import { ImageUpload } from "@/components/ui/image-upload";
import {
  FulfillmentTypePicker,
  type FulfillmentType,
} from "@/components/dashboard/fulfillment-type-picker";
import { useFacilities } from "@/hooks/use-facilities";

type ProductVariant = {
  id?: string;
  label: string;
  price: number | null;
  imageUrl: string | null;
  maxInventory: number | null;
  currentInventory: number | null;
  sortOrder: number;
  isActive: boolean;
};

type Product = {
  id: string;
  name: string;
  description: string | null;
  sku: string | null;
  category: string;
  price: number;
  imageUrl: string | null;
  maxInventory: number | null;
  currentInventory: number | null;
  typeName: string | null;
  variants: ProductVariant[];
  isActive: boolean;
  fulfillmentType: FulfillmentType;
  pickupFacilityId: string | null;
  createdAt: string;
  updatedAt: string;
};

type VariantFormData = {
  id?: string;
  label: string;
  price: string;
  imageUrl: string;
  maxInventory: string;
  currentInventory: string;
};

type ProductFormData = {
  name: string;
  description: string;
  sku: string;
  category: string;
  price: number;
  imageUrl: string;
  maxInventory: number | null;
  currentInventory: number | null;
  isUnlimited: boolean;
  isActive: boolean;
  glCodeId: string | null;
  hasType: boolean;
  typeName: string;
  variants: VariantFormData[];
  fulfillmentType: FulfillmentType;
  pickupFacilityId: string | null;
};

const defaultVariant: VariantFormData = {
  label: "",
  price: "",
  imageUrl: "",
  maxInventory: "",
  currentInventory: "",
};

const defaultFormData: ProductFormData = {
  name: "",
  description: "",
  sku: "",
  category: "General",
  price: 0,
  imageUrl: "",
  maxInventory: null,
  currentInventory: null,
  isUnlimited: true,
  isActive: true,
  glCodeId: null,
  hasType: false,
  typeName: "",
  variants: [],
  fulfillmentType: "PICKUP_ONLY",
  pickupFacilityId: null,
};

const defaultCategories = ["General", "Drinks/Snacks", "Equipment", "Merchandise", "Services"];

export default function StorePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>(defaultCategories);
  const [isLoading, setIsLoading] = useState(true);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([
    { id: "isActive", value: [true] },
  ]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = useState({});

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [restockDialogOpen, setRestockDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [restockingProduct, setRestockingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState<ProductFormData>(defaultFormData);
  const [isSaving, setIsSaving] = useState(false);
  const [restockQuantity, setRestockQuantity] = useState<number>(0);
  const [restockType, setRestockType] = useState<"add" | "set" | "max">("add");
  const [restockVariantStocks, setRestockVariantStocks] = useState<Record<string, string>>({});

  const { facilities, isLoading: isLoadingFacilities } = useFacilities();
  const facilityOptions = useMemo(
    () =>
      facilities
        .filter((f) => f.status === "ACTIVE")
        .map((f) => ({
          id: f.id,
          name: f.name,
          city: f.city,
          stateProvince: f.stateProvince,
          isDefault: f.isDefault,
        })),
    [facilities]
  );

  // Fetch products
  const fetchProducts = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/products");
      if (!response.ok) throw new Error("Failed to fetch products");
      const data = await response.json();
      setProducts(data.data || []);
      if (data.categories?.length > 0) {
        const allCats = Array.from(new Set([...defaultCategories, ...data.categories]));
        const sorted = allCats.filter((c) => c !== "General").sort((a, b) => a.localeCompare(b));
        setCategories(["General", ...sorted]);
      }
    } catch (error) {
      console.error("Error fetching products:", error);
      toast.error("Failed to load products");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // Handle form submission
  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast.error("Product name is required");
      return;
    }

    if (formData.price < 0) {
      toast.error("Price cannot be negative");
      return;
    }

    if (formData.hasType) {
      if (!formData.typeName.trim()) {
        toast.error('Type name is required (e.g., "Size", "Color")');
        return;
      }
      if (formData.variants.length === 0) {
        toast.error("Add at least one type option");
        return;
      }
      for (const v of formData.variants) {
        if (!v.label.trim()) {
          toast.error("All type options must have a label");
          return;
        }
      }
    }

    setIsSaving(true);
    try {
      const variants = formData.hasType
        ? formData.variants.map((v, i) => {
            const maxRaw = v.maxInventory.trim();
            const currentRaw = v.currentInventory.trim();
            // Both blank → unlimited (null/null). If either is filled,
            // coerce the blank one to the filled value so we never save a
            // half-tracked variant.
            const maxParsed = maxRaw !== "" ? parseInt(maxRaw) : null;
            const currentParsed = currentRaw !== "" ? parseInt(currentRaw) : null;
            const maxInventory = maxParsed ?? currentParsed;
            const currentInventory = currentParsed ?? maxParsed;
            return {
              id: v.id,
              label: v.label,
              price: v.price ? parseFloat(v.price) : null,
              imageUrl: v.imageUrl || null,
              maxInventory,
              currentInventory,
              sortOrder: i,
            };
          })
        : undefined;

      const payload = {
        name: formData.name,
        description: formData.description || null,
        sku: formData.sku || null,
        category: formData.category,
        price: formData.price,
        imageUrl: formData.imageUrl || null,
        maxInventory: formData.hasType ? null : formData.isUnlimited ? null : formData.maxInventory,
        currentInventory: formData.hasType
          ? null
          : formData.isUnlimited
            ? null
            : formData.currentInventory,
        isActive: formData.isActive,
        glCodeId: formData.glCodeId,
        typeName: formData.hasType ? formData.typeName : null,
        variants: formData.hasType ? variants : null,
        fulfillmentType: formData.fulfillmentType,
        pickupFacilityId: formData.pickupFacilityId,
      };

      let response: Response;
      if (editingProduct) {
        response = await fetch(`/api/products/${editingProduct.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        response = await fetch("/api/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to save product");
      }

      toast.success(editingProduct ? "Product updated" : "Product created");
      setDialogOpen(false);
      setEditingProduct(null);
      setFormData(defaultFormData);
      fetchProducts();
    } catch (error) {
      console.error("Error saving product:", error);
      toast.error(error instanceof Error ? error.message : "Failed to save product");
    } finally {
      setIsSaving(false);
    }
  };

  // Handle restock (non-variant product)
  const handleRestock = async () => {
    if (!restockingProduct) return;

    setIsSaving(true);
    try {
      const response = await fetch(`/api/products/${restockingProduct.id}/inventory`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: restockType,
          quantity: restockType !== "max" ? restockQuantity : undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to restock");
      }

      toast.success("Inventory updated");
      setRestockDialogOpen(false);
      setRestockingProduct(null);
      setRestockQuantity(0);
      fetchProducts();
    } catch (error) {
      console.error("Error restocking:", error);
      toast.error(error instanceof Error ? error.message : "Failed to restock");
    } finally {
      setIsSaving(false);
    }
  };

  // Handle bulk variant restock — set stock per variant from the dialog inputs.
  const handleBulkVariantRestock = async () => {
    if (!restockingProduct) return;

    const changes: { variant: ProductVariant; newQty: number }[] = [];
    for (const variant of restockingProduct.variants) {
      if (!variant.id) continue;
      const raw = restockVariantStocks[variant.id]?.trim() ?? "";
      if (raw === "") continue;
      const newQty = parseInt(raw, 10);
      if (Number.isNaN(newQty) || newQty < 0) continue;
      if (newQty === (variant.currentInventory ?? 0)) continue;
      changes.push({ variant, newQty });
    }

    if (changes.length === 0) {
      toast.info("No stock changes to save");
      setRestockDialogOpen(false);
      return;
    }

    setIsSaving(true);
    try {
      const results = await Promise.allSettled(
        changes.map(({ variant, newQty }) =>
          fetch(`/api/products/${restockingProduct.id}/inventory`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type: "set", quantity: newQty, variantId: variant.id }),
          }).then(async (res) => {
            if (!res.ok) {
              const err = await res.json().catch(() => ({}));
              throw new Error(err.error || `Failed to update ${variant.label}`);
            }
          })
        )
      );
      const failures = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
      if (failures.length > 0) {
        const msg = failures.map((f) => (f.reason as Error).message).join("; ");
        toast.error(`${failures.length} update${failures.length === 1 ? "" : "s"} failed: ${msg}`);
      } else {
        const label = restockingProduct.typeName?.toLowerCase() || "variant";
        toast.success(
          `Updated stock for ${changes.length} ${label}${changes.length === 1 ? "" : "s"}`
        );
        setRestockDialogOpen(false);
        setRestockingProduct(null);
      }
      fetchProducts();
    } catch (error) {
      console.error("Error restocking variants:", error);
      toast.error(error instanceof Error ? error.message : "Failed to restock");
    } finally {
      setIsSaving(false);
    }
  };

  // Handle delete/deactivate
  const handleDeactivate = async (product: Product) => {
    try {
      const response = await fetch(`/api/products/${product.id}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to deactivate product");

      toast.success("Product deactivated");
      fetchProducts();
    } catch (error) {
      console.error("Error deactivating product:", error);
      toast.error("Failed to deactivate product");
    }
  };

  // Open edit dialog
  const openEditDialog = (product: Product) => {
    setEditingProduct(product);
    const hasType = !!product.typeName && product.variants.length > 0;
    setFormData({
      name: product.name,
      description: product.description || "",
      sku: product.sku || "",
      category: product.category,
      price: Number(product.price),
      imageUrl: product.imageUrl || "",
      maxInventory: product.maxInventory,
      currentInventory: product.currentInventory,
      isUnlimited: !hasType && product.maxInventory === null && product.currentInventory === null,
      isActive: product.isActive,
      glCodeId: (product as any).glCodeId || null,
      hasType,
      typeName: product.typeName || "",
      variants: hasType
        ? product.variants.map((v) => ({
            id: v.id,
            label: v.label,
            price: v.price !== null ? String(v.price) : "",
            imageUrl: v.imageUrl || "",
            maxInventory: v.maxInventory !== null ? String(v.maxInventory) : "",
            currentInventory: v.currentInventory !== null ? String(v.currentInventory) : "",
          }))
        : [],
      fulfillmentType: product.fulfillmentType,
      pickupFacilityId: product.pickupFacilityId,
    });
    setDialogOpen(true);
  };

  // Open restock dialog
  const openRestockDialog = (product: Product) => {
    setRestockingProduct(product);
    setRestockQuantity(0);
    setRestockType("add");
    const stocks: Record<string, string> = {};
    if (product.typeName && product.variants.length > 0) {
      for (const v of product.variants) {
        if (!v.id) continue;
        if (v.maxInventory === null && v.currentInventory === null) continue;
        stocks[v.id] = String(v.currentInventory ?? 0);
      }
    }
    setRestockVariantStocks(stocks);
    setRestockDialogOpen(true);
  };

  // Get inventory status for non-variant products (variant products use getVariantStockLine)
  const getInventoryStatus = (product: Product) => {
    if (product.maxInventory === null && product.currentInventory === null) {
      return { label: "Unlimited", variant: "secondary" as const, icon: Infinity };
    }
    const current = product.currentInventory ?? 0;
    const max = product.maxInventory ?? current;
    const percentage = max > 0 ? (current / max) * 100 : 0;

    if (current === 0) {
      return { label: "Sold out", variant: "destructive" as const, icon: AlertCircle };
    }
    if (percentage <= 20) {
      return { label: `Low Stock (${current})`, variant: "warning" as const, icon: AlertCircle };
    }
    return { label: `${current}/${max}`, variant: "default" as const, icon: Package };
  };

  // Per-variant stock line for the admin table cell
  const getVariantStockLine = (
    variant: ProductVariant
  ): { label: string; tone: "default" | "muted" | "destructive" } => {
    if (variant.maxInventory === null && variant.currentInventory === null) {
      return { label: "Unlimited", tone: "muted" };
    }
    const current = variant.currentInventory ?? 0;
    if (current <= 0) {
      return { label: "Sold out", tone: "destructive" };
    }
    const max = variant.maxInventory ?? current;
    return { label: `${current}/${max}`, tone: "default" };
  };

  const hasTrackedInventory = (product: Product) => {
    if (product.typeName && product.variants.length > 0) {
      return product.variants.some((v) => v.maxInventory !== null);
    }
    return product.maxInventory !== null;
  };

  // Variant helpers
  const addVariant = () => {
    setFormData((prev) => ({
      ...prev,
      variants: [...prev.variants, { ...defaultVariant }],
    }));
  };

  const removeVariant = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      variants: prev.variants.filter((_, i) => i !== index),
    }));
  };

  const updateVariant = (index: number, updates: Partial<VariantFormData>) => {
    setFormData((prev) => ({
      ...prev,
      variants: prev.variants.map((v, i) => (i === index ? { ...v, ...updates } : v)),
    }));
  };

  const columns: ColumnDef<Product>[] = [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && "indeterminate")
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: "name",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Product" />,
      cell: ({ row }) => {
        const product = row.original;
        return (
          <div className="flex items-center gap-3">
            {product.imageUrl ? (
              <Image
                src={product.imageUrl}
                alt={product.name}
                width={40}
                height={40}
                className="rounded-md object-cover"
              />
            ) : (
              <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center">
                <Package className="h-5 w-5 text-muted-foreground" />
              </div>
            )}
            <div className="flex flex-col">
              <button
                className="font-medium text-left hover:underline"
                onClick={() => openEditDialog(product)}
              >
                {product.name}
              </button>
              <div className="flex items-center gap-2">
                {product.sku && (
                  <span className="text-xs text-muted-foreground">SKU: {product.sku}</span>
                )}
                {product.typeName && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                    {product.typeName}: {product.variants.length} options
                  </Badge>
                )}
              </div>
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "category",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Category" />,
      cell: ({ row }) => <Badge variant="outline">{row.getValue("category")}</Badge>,
      filterFn: (row, id, value) => {
        return value.includes(row.getValue(id));
      },
    },
    {
      accessorKey: "price",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Price" />,
      cell: ({ row }) => {
        const price = Number(row.getValue("price"));
        return <span className="font-medium">${price.toFixed(2)}</span>;
      },
    },
    {
      accessorKey: "fulfillmentType",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Fulfillment" />,
      cell: ({ row }) => {
        const type = row.getValue("fulfillmentType") as FulfillmentType | undefined;
        const label =
          type === "DELIVERY_ONLY"
            ? "Delivery"
            : type === "PICKUP_OR_DELIVERY"
              ? "Either"
              : "Pickup";
        return <Badge variant="secondary">{label}</Badge>;
      },
      filterFn: (row, id, value) => value.includes(row.getValue(id)),
    },
    {
      accessorKey: "inventory",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Inventory" />,
      cell: ({ row }) => {
        const product = row.original;
        const hasVariants = !!product.typeName && product.variants.length > 0;
        const restockButton = hasTrackedInventory(product) && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0"
            onClick={() => openRestockDialog(product)}
            title="Restock"
          >
            <RefreshCw className="h-3 w-3" />
          </Button>
        );

        if (hasVariants) {
          const sortedVariants = [...product.variants].sort((a, b) => a.sortOrder - b.sortOrder);
          return (
            <div className="flex items-center gap-2">
              <div className="flex flex-col gap-0.5 text-xs">
                {sortedVariants.map((variant) => {
                  const { label, tone } = getVariantStockLine(variant);
                  const toneClass =
                    tone === "destructive"
                      ? "text-destructive"
                      : tone === "muted"
                        ? "text-muted-foreground"
                        : "text-foreground";
                  return (
                    <div key={variant.id ?? variant.label} className="leading-tight">
                      <span className="font-medium">{variant.label}</span>
                      <span className="text-muted-foreground"> - </span>
                      <span className={toneClass}>{label}</span>
                    </div>
                  );
                })}
              </div>
              {restockButton}
            </div>
          );
        }

        const status = getInventoryStatus(product);
        return (
          <div className="flex items-center gap-2">
            <Badge variant={status.variant === "warning" ? "secondary" : status.variant}>
              {status.variant === "warning" && <AlertCircle className="h-3 w-3 mr-1" />}
              {status.label}
            </Badge>
            {restockButton}
          </div>
        );
      },
    },
    {
      accessorKey: "isActive",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
      cell: ({ row }) => (
        <Badge variant={row.getValue("isActive") ? "default" : "secondary"}>
          {row.getValue("isActive") ? "Active" : "Inactive"}
        </Badge>
      ),
      filterFn: (row, id, value) => {
        return value.includes(row.getValue(id));
      },
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const product = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => openEditDialog(product)}>
                Edit Product
              </DropdownMenuItem>
              {hasTrackedInventory(product) && (
                <DropdownMenuItem onClick={() => openRestockDialog(product)}>
                  Restock
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => handleDeactivate(product)}
              >
                Deactivate
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  const table = useReactTable({
    data: products,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
    },
    initialState: {
      pagination: { pageSize: 20 },
    },
  });

  const handleFilterChange = (columnId: string, value: string | boolean, checked: boolean) => {
    const column = table.getColumn(columnId);
    const filterValue = (column?.getFilterValue() as (string | boolean)[]) || [];

    if (checked) {
      column?.setFilterValue([...filterValue, value]);
    } else {
      column?.setFilterValue(filterValue.filter((v) => v !== value));
    }
  };

  const isFiltered = table.getState().columnFilters.length > 0;
  const isRestockingVariantProduct =
    !!restockingProduct?.typeName && restockingProduct.variants.length > 0;

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-6">
      <DashboardPageHeader
        variant="small"
        title="Products"
        description="Manage products available for sale in your store and point of sale."
        actions={
          <Button
            onClick={() => {
              setEditingProduct(null);
              setFormData(defaultFormData);
              setDialogOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" /> Add Product
          </Button>
        }
      />
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setEditingProduct(null);
            setFormData(defaultFormData);
          }
        }}
      >
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>{editingProduct ? "Edit Product" : "Add New Product"}</DialogTitle>
            <DialogDescription>
              {editingProduct
                ? "Update product details."
                : "Add a new product to your store inventory."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4 px-1 max-h-[60vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Product Name *</Label>
                <Input
                  id="name"
                  placeholder="e.g. Water Bottle"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sku">SKU</Label>
                <Input
                  id="sku"
                  placeholder="e.g. WB-001"
                  value={formData.sku}
                  onChange={(e) => setFormData({ ...formData, sku: e.target.value.toUpperCase() })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Product description..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) => setFormData({ ...formData, category: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="price">Base Price ($) *</Label>
                <Input
                  id="price"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={formData.price || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })
                  }
                />
              </div>
            </div>

            <ImageUpload
              label="Product Image"
              value={formData.imageUrl || null}
              onChange={(url) => setFormData({ ...formData, imageUrl: url || "" })}
              type="product"
            />

            {/* Type / Variants Section */}
            <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Product Type</Label>
                  <p className="text-xs text-muted-foreground">
                    Enable to add options like sizes, colors, or fits
                  </p>
                </div>
                <Switch
                  checked={formData.hasType}
                  onCheckedChange={(checked) => {
                    setFormData({
                      ...formData,
                      hasType: checked,
                      variants:
                        checked && formData.variants.length === 0
                          ? [{ ...defaultVariant }]
                          : formData.variants,
                    });
                  }}
                />
              </div>

              {formData.hasType && (
                <div className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <Label htmlFor="typeName">Type Name *</Label>
                    <Input
                      id="typeName"
                      placeholder='e.g. "Size", "Color", "Fit"'
                      value={formData.typeName}
                      onChange={(e) => setFormData({ ...formData, typeName: e.target.value })}
                    />
                  </div>

                  <div className="space-y-3">
                    <Label>Options</Label>
                    {formData.variants.map((variant, index) => (
                      <div key={index} className="space-y-2 p-3 border rounded-md bg-background">
                        <div className="flex items-center gap-2">
                          <Input
                            placeholder="Label (e.g. Red, Large)"
                            value={variant.label}
                            onChange={(e) => updateVariant(index, { label: e.target.value })}
                            className="flex-[3]"
                          />
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="Price override"
                            value={variant.price}
                            onChange={(e) => updateVariant(index, { price: e.target.value })}
                            className="flex-[2]"
                          />
                          {formData.variants.length > 1 && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive shrink-0"
                              onClick={() => removeVariant(index)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            min="1"
                            placeholder="Max (unlimited)"
                            value={variant.maxInventory}
                            onChange={(e) => updateVariant(index, { maxInventory: e.target.value })}
                            className="h-7 flex-1 text-xs"
                          />
                          <Input
                            type="number"
                            min="0"
                            placeholder="Current (unlimited)"
                            value={variant.currentInventory}
                            onChange={(e) =>
                              updateVariant(index, { currentInventory: e.target.value })
                            }
                            className="h-7 flex-1 text-xs"
                          />
                        </div>
                        <p className="text-[10px] text-muted-foreground">
                          Leave both blank for unlimited inventory.
                        </p>
                        <ImageUpload
                          label="Variant Image"
                          value={variant.imageUrl || null}
                          onChange={(url) => updateVariant(index, { imageUrl: url || "" })}
                          type="product"
                        />
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addVariant}
                      className="w-full"
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" /> Add Option
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Standard Inventory (only when no type) */}
            {!formData.hasType && (
              <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Unlimited Inventory</Label>
                    <p className="text-xs text-muted-foreground">
                      Don&apos;t track inventory for this product
                    </p>
                  </div>
                  <Switch
                    checked={formData.isUnlimited}
                    onCheckedChange={(checked) =>
                      setFormData({
                        ...formData,
                        isUnlimited: checked,
                        maxInventory: checked ? null : (formData.maxInventory ?? 10),
                        currentInventory: checked ? null : (formData.currentInventory ?? 10),
                      })
                    }
                  />
                </div>

                {!formData.isUnlimited && (
                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <div className="space-y-2">
                      <Label htmlFor="maxInventory">Max Inventory</Label>
                      <Input
                        id="maxInventory"
                        type="number"
                        min="1"
                        placeholder="e.g. 100"
                        value={formData.maxInventory ?? ""}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            maxInventory:
                              e.target.value.trim() !== "" ? parseInt(e.target.value) : null,
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="currentInventory">Current Stock</Label>
                      <Input
                        id="currentInventory"
                        type="number"
                        min="0"
                        placeholder="e.g. 50"
                        value={formData.currentInventory ?? ""}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            currentInventory:
                              e.target.value.trim() !== "" ? parseInt(e.target.value) : null,
                          })
                        }
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            <GLCodeSelector
              value={formData.glCodeId}
              onChange={(v) => setFormData({ ...formData, glCodeId: v })}
              entityType="PRODUCT"
            />

            <FulfillmentTypePicker
              value={formData.fulfillmentType}
              onChange={(v) => setFormData({ ...formData, fulfillmentType: v })}
              pickupFacilityId={formData.pickupFacilityId}
              onPickupFacilityChange={(id) => setFormData({ ...formData, pickupFacilityId: id })}
              facilities={facilityOptions}
              isLoadingFacilities={isLoadingFacilities}
            />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Active</Label>
                <p className="text-xs text-muted-foreground">Product is available for sale</p>
              </div>
              <Switch
                checked={formData.isActive}
                onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingProduct ? "Save Changes" : "Add Product"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Restock Dialog */}
      <Dialog open={restockDialogOpen} onOpenChange={setRestockDialogOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Restock {restockingProduct?.name}</DialogTitle>
            <DialogDescription>
              {isRestockingVariantProduct
                ? `Set current stock for each ${restockingProduct?.typeName?.toLowerCase()}.`
                : `Current stock: ${restockingProduct?.currentInventory ?? 0} / ${restockingProduct?.maxInventory ?? "∞"}`}
            </DialogDescription>
          </DialogHeader>
          {isRestockingVariantProduct ? (
            <div className="grid gap-3 py-4">
              {[...restockingProduct.variants]
                .sort((a, b) => a.sortOrder - b.sortOrder)
                .map((v) => {
                  const isTracked = !(v.maxInventory === null && v.currentInventory === null);
                  return (
                    <div key={v.id ?? v.label} className="flex items-center gap-3">
                      <Label className="flex-1 text-sm font-medium leading-none">{v.label}</Label>
                      {isTracked && v.id ? (
                        <>
                          <Input
                            type="number"
                            min="0"
                            max={v.maxInventory ?? undefined}
                            value={restockVariantStocks[v.id] ?? ""}
                            onChange={(e) =>
                              setRestockVariantStocks((prev) => ({
                                ...prev,
                                [v.id!]: e.target.value,
                              }))
                            }
                            className="h-8 w-20 text-right text-sm"
                          />
                          <span className="w-14 text-xs text-muted-foreground">
                            / {v.maxInventory ?? "∞"}
                          </span>
                        </>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">Unlimited</span>
                      )}
                    </div>
                  );
                })}
            </div>
          ) : (
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label>Restock Type</Label>
                <Select
                  value={restockType}
                  onValueChange={(value) => setRestockType(value as "add" | "set" | "max")}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="add">Add to current stock</SelectItem>
                    <SelectItem value="set">Set exact quantity</SelectItem>
                    {restockingProduct?.maxInventory && (
                      <SelectItem value="max">
                        Restore to max ({restockingProduct.maxInventory})
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {restockType !== "max" && (
                <div className="space-y-2">
                  <Label htmlFor="restockQty">
                    {restockType === "add" ? "Quantity to Add" : "New Quantity"}
                  </Label>
                  <Input
                    id="restockQty"
                    type="number"
                    min="0"
                    value={restockQuantity}
                    onChange={(e) => setRestockQuantity(parseInt(e.target.value) || 0)}
                  />
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRestockDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={isRestockingVariantProduct ? handleBulkVariantRestock : handleRestock}
              disabled={isSaving}
            >
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Update Stock
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search products..."
            value={(table.getColumn("name")?.getFilterValue() as string) ?? ""}
            onChange={(event) => table.getColumn("name")?.setFilterValue(event.target.value)}
            className="pl-8"
          />
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="border-dashed">
              <Filter className="mr-2 h-4 w-4" />
              Filter
              {isFiltered && (
                <Badge variant="secondary" className="ml-2 rounded-sm px-1 font-normal">
                  {table.getState().columnFilters.length}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[200px] p-0" align="end">
            <div className="p-4 pb-0">
              <h4 className="font-medium leading-none">Filters</h4>
            </div>
            <div className="p-4 pt-2 space-y-4">
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-muted-foreground">Category</h4>
                <div className="grid gap-2">
                  {categories.map((cat) => (
                    <div key={cat} className="flex items-center space-x-2">
                      <Checkbox
                        id={`cat-${cat}`}
                        checked={(
                          table.getColumn("category")?.getFilterValue() as string[]
                        )?.includes(cat)}
                        onCheckedChange={(checked) =>
                          handleFilterChange("category", cat, !!checked)
                        }
                      />
                      <label
                        htmlFor={`cat-${cat}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        {cat}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-muted-foreground">Status</h4>
                <div className="grid gap-2">
                  {[
                    { value: true, label: "Active" },
                    { value: false, label: "Inactive" },
                  ].map((status) => (
                    <div key={String(status.value)} className="flex items-center space-x-2">
                      <Checkbox
                        id={`status-${status.label}`}
                        checked={(
                          table.getColumn("isActive")?.getFilterValue() as boolean[]
                        )?.includes(status.value)}
                        onCheckedChange={(checked) =>
                          handleFilterChange("isActive", status.value, !!checked)
                        }
                      />
                      <label
                        htmlFor={`status-${status.label}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        {status.label}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
              {isFiltered && (
                <Button
                  variant="ghost"
                  className="w-full justify-center text-center"
                  onClick={() => table.resetColumnFilters()}
                >
                  Clear filters
                </Button>
              )}
            </div>
          </PopoverContent>
        </Popover>
        <DataTableViewOptions table={table} />
      </div>

      <div className="overflow-hidden rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} data-state={row.getIsSelected() && "selected"}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <Package className="h-8 w-8 text-muted-foreground" />
                    <p className="text-muted-foreground">No products yet.</p>
                    <Button variant="outline" size="sm" onClick={() => setDialogOpen(true)}>
                      <Plus className="mr-2 h-4 w-4" /> Add your first product
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <DataTablePagination table={table} pageSizeOptions={[10, 20, 30, 50]} />
    </div>
  );
}
