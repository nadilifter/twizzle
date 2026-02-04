"use client"

import * as React from "react"
import Image from "next/image"
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { 
  MoreHorizontal, 
  Plus, 
  Search, 
  Package,
  AlertCircle,
  Infinity,
  RefreshCw,
  ImagePlus,
  Loader2,
} from "lucide-react"
import { toast } from "sonner"

type Product = {
  id: string
  name: string
  description: string | null
  sku: string | null
  category: string
  price: number
  imageUrl: string | null
  maxInventory: number | null
  currentInventory: number | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

type ProductFormData = {
  name: string
  description: string
  sku: string
  category: string
  price: number
  imageUrl: string
  maxInventory: number | null
  currentInventory: number | null
  isUnlimited: boolean
  isActive: boolean
}

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
}

const defaultCategories = ["General", "Merchandise", "Drinks/Snacks", "Equipment", "Services"]

export default function StorePage() {
  const [products, setProducts] = React.useState<Product[]>([])
  const [categories, setCategories] = React.useState<string[]>(defaultCategories)
  const [isLoading, setIsLoading] = React.useState(true)
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [rowSelection, setRowSelection] = React.useState({})
  const [pagination, setPagination] = React.useState({ pageIndex: 0, pageSize: 20 })
  
  // Dialog state
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [restockDialogOpen, setRestockDialogOpen] = React.useState(false)
  const [editingProduct, setEditingProduct] = React.useState<Product | null>(null)
  const [restockingProduct, setRestockingProduct] = React.useState<Product | null>(null)
  const [formData, setFormData] = React.useState<ProductFormData>(defaultFormData)
  const [isSaving, setIsSaving] = React.useState(false)
  const [restockQuantity, setRestockQuantity] = React.useState<number>(0)
  const [restockType, setRestockType] = React.useState<"add" | "set" | "max">("add")

  // Fetch products
  const fetchProducts = React.useCallback(async () => {
    try {
      setIsLoading(true)
      const response = await fetch("/api/products")
      if (!response.ok) throw new Error("Failed to fetch products")
      const data = await response.json()
      setProducts(data.data || [])
      if (data.categories?.length > 0) {
        setCategories(Array.from(new Set([...defaultCategories, ...data.categories])))
      }
    } catch (error) {
      console.error("Error fetching products:", error)
      toast.error("Failed to load products")
    } finally {
      setIsLoading(false)
    }
  }, [])

  React.useEffect(() => {
    fetchProducts()
  }, [fetchProducts])

  // Handle form submission
  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast.error("Product name is required")
      return
    }

    if (formData.price < 0) {
      toast.error("Price cannot be negative")
      return
    }

    setIsSaving(true)
    try {
      const payload = {
        name: formData.name,
        description: formData.description || null,
        sku: formData.sku || null,
        category: formData.category,
        price: formData.price,
        imageUrl: formData.imageUrl || null,
        maxInventory: formData.isUnlimited ? null : formData.maxInventory,
        currentInventory: formData.isUnlimited ? null : formData.currentInventory,
        isActive: formData.isActive,
      }

      let response: Response
      if (editingProduct) {
        response = await fetch(`/api/products/${editingProduct.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      } else {
        response = await fetch("/api/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      }

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to save product")
      }

      toast.success(editingProduct ? "Product updated" : "Product created")
      setDialogOpen(false)
      setEditingProduct(null)
      setFormData(defaultFormData)
      fetchProducts()
    } catch (error) {
      console.error("Error saving product:", error)
      toast.error(error instanceof Error ? error.message : "Failed to save product")
    } finally {
      setIsSaving(false)
    }
  }

  // Handle restock
  const handleRestock = async () => {
    if (!restockingProduct) return

    setIsSaving(true)
    try {
      const response = await fetch(`/api/products/${restockingProduct.id}/inventory`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: restockType,
          quantity: restockType !== "max" ? restockQuantity : undefined,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to restock")
      }

      toast.success("Inventory updated")
      setRestockDialogOpen(false)
      setRestockingProduct(null)
      setRestockQuantity(0)
      fetchProducts()
    } catch (error) {
      console.error("Error restocking:", error)
      toast.error(error instanceof Error ? error.message : "Failed to restock")
    } finally {
      setIsSaving(false)
    }
  }

  // Handle delete/deactivate
  const handleDeactivate = async (product: Product) => {
    try {
      const response = await fetch(`/api/products/${product.id}`, {
        method: "DELETE",
      })

      if (!response.ok) throw new Error("Failed to deactivate product")

      toast.success("Product deactivated")
      fetchProducts()
    } catch (error) {
      console.error("Error deactivating product:", error)
      toast.error("Failed to deactivate product")
    }
  }

  // Open edit dialog
  const openEditDialog = (product: Product) => {
    setEditingProduct(product)
    setFormData({
      name: product.name,
      description: product.description || "",
      sku: product.sku || "",
      category: product.category,
      price: Number(product.price),
      imageUrl: product.imageUrl || "",
      maxInventory: product.maxInventory,
      currentInventory: product.currentInventory,
      isUnlimited: product.maxInventory === null && product.currentInventory === null,
      isActive: product.isActive,
    })
    setDialogOpen(true)
  }

  // Open restock dialog
  const openRestockDialog = (product: Product) => {
    setRestockingProduct(product)
    setRestockQuantity(0)
    setRestockType("add")
    setRestockDialogOpen(true)
  }

  // Get inventory status
  const getInventoryStatus = (product: Product) => {
    if (product.maxInventory === null && product.currentInventory === null) {
      return { label: "Unlimited", variant: "secondary" as const, icon: Infinity }
    }
    const current = product.currentInventory ?? 0
    const max = product.maxInventory ?? current
    const percentage = max > 0 ? (current / max) * 100 : 0
    
    if (current === 0) {
      return { label: "Out of Stock", variant: "destructive" as const, icon: AlertCircle }
    }
    if (percentage <= 20) {
      return { label: `Low Stock (${current})`, variant: "warning" as const, icon: AlertCircle }
    }
    return { label: `${current}/${max}`, variant: "default" as const, icon: Package }
  }

  const columns: ColumnDef<Product>[] = [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && "indeterminate")}
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
      header: "Product",
      cell: ({ row }) => {
        const product = row.original
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
              <span className="font-medium">{product.name}</span>
              {product.sku && (
                <span className="text-xs text-muted-foreground">SKU: {product.sku}</span>
              )}
            </div>
          </div>
        )
      },
    },
    {
      accessorKey: "category",
      header: "Category",
      cell: ({ row }) => (
        <Badge variant="outline">{row.getValue("category")}</Badge>
      ),
    },
    {
      accessorKey: "price",
      header: "Price",
      cell: ({ row }) => {
        const price = Number(row.getValue("price"))
        return <span className="font-medium">${price.toFixed(2)}</span>
      },
    },
    {
      accessorKey: "inventory",
      header: "Inventory",
      cell: ({ row }) => {
        const product = row.original
        const status = getInventoryStatus(product)
        return (
          <div className="flex items-center gap-2">
            <Badge variant={status.variant === "warning" ? "secondary" : status.variant}>
              {status.variant === "warning" && <AlertCircle className="h-3 w-3 mr-1" />}
              {status.label}
            </Badge>
            {product.maxInventory !== null && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => openRestockDialog(product)}
                title="Restock"
              >
                <RefreshCw className="h-3 w-3" />
              </Button>
            )}
          </div>
        )
      },
    },
    {
      accessorKey: "isActive",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant={row.getValue("isActive") ? "default" : "secondary"}>
          {row.getValue("isActive") ? "Active" : "Inactive"}
        </Badge>
      ),
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const product = row.original
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
              {product.maxInventory !== null && (
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
        )
      },
    },
  ]

  const table = useReactTable({
    data: products,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onRowSelectionChange: setRowSelection,
    onPaginationChange: setPagination,
    state: {
      sorting,
      columnFilters,
      rowSelection,
      pagination,
    },
  })

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold tracking-tight">Store Products</h2>
          <p className="text-sm text-muted-foreground">
            Manage products available for sale at your point of sale.
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) {
            setEditingProduct(null)
            setFormData(defaultFormData)
          }
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" /> Add Product
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>{editingProduct ? "Edit Product" : "Add New Product"}</DialogTitle>
              <DialogDescription>
                {editingProduct ? "Update product details." : "Add a new product to your store inventory."}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
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
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="price">Price ($) *</Label>
                  <Input
                    id="price"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={formData.price || ""}
                    onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="imageUrl">Image URL</Label>
                <div className="flex gap-2">
                  <Input
                    id="imageUrl"
                    placeholder="https://..."
                    value={formData.imageUrl}
                    onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                  />
                  <Button variant="outline" size="icon" disabled title="Upload (coming soon)">
                    <ImagePlus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

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
                    onCheckedChange={(checked) => setFormData({
                      ...formData,
                      isUnlimited: checked,
                      maxInventory: checked ? null : formData.maxInventory ?? 10,
                      currentInventory: checked ? null : formData.currentInventory ?? 10,
                    })}
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
                        onChange={(e) => setFormData({
                          ...formData,
                          maxInventory: parseInt(e.target.value) || null,
                        })}
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
                        onChange={(e) => setFormData({
                          ...formData,
                          currentInventory: parseInt(e.target.value) || null,
                        })}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Active</Label>
                  <p className="text-xs text-muted-foreground">
                    Product is available for sale
                  </p>
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
      </div>

      {/* Restock Dialog */}
      <Dialog open={restockDialogOpen} onOpenChange={setRestockDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Restock {restockingProduct?.name}</DialogTitle>
            <DialogDescription>
              Current stock: {restockingProduct?.currentInventory ?? 0} / {restockingProduct?.maxInventory ?? "∞"}
            </DialogDescription>
          </DialogHeader>
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
                    <SelectItem value="max">Restore to max ({restockingProduct.maxInventory})</SelectItem>
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
          <DialogFooter>
            <Button variant="outline" onClick={() => setRestockDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleRestock} disabled={isSaving}>
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
            onChange={(event) =>
              table.getColumn("name")?.setFilterValue(event.target.value)
            }
            className="pl-8"
          />
        </div>
        <Select
          value={(table.getColumn("category")?.getFilterValue() as string) ?? "all"}
          onValueChange={(value) =>
            table.getColumn("category")?.setFilterValue(value === "all" ? "" : value)
          }
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
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
                    <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
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
      
      <div className="flex items-center justify-end space-x-2">
        <div className="flex-1 text-sm text-muted-foreground">
          {table.getFilteredSelectedRowModel().rows.length} of {table.getFilteredRowModel().rows.length} row(s) selected.
        </div>
        <Button variant="outline" size="sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
          Previous
        </Button>
        <Button variant="outline" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
          Next
        </Button>
      </div>
    </div>
  )
}
