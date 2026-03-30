"use client";

import * as React from "react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import { DataTablePagination } from "@/components/data-table/data-table-pagination";
import { DataTableViewOptions } from "@/components/data-table/data-table-view-options";
import {
  MoreHorizontal,
  Plus,
  Search,
  Calendar as CalendarIcon,
  Wand2,
  Loader2,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { useFeatures } from "@/components/feature-context";
import { toast } from "sonner";

function formatDateString(dateStr: string): string {
  const date = parseISO(dateStr);
  return format(date, "M/d/yyyy");
}

type DiscountType = "PERCENTAGE" | "FIXED_AMOUNT";

type Discount = {
  id: string;
  name: string;
  code: string;
  type: DiscountType;
  amount: number;
  validFrom: string;
  validTo?: string | null;
  userScope: "ALL" | "NEW_USERS" | "MEMBERS" | "VIP";
  productScope: "ALL" | "MERCHANDISE" | "EVENTS" | "MEMBERSHIP";
  status: "ACTIVE" | "EXPIRED" | "SCHEDULED" | "DRAFT";
  usageCount: number;
  usageLimit?: number | null;
};

export default function DiscountsPage() {
  const { isFeatureEnabled } = useFeatures();
  const eventsEnabled = isFeatureEnabled("events");
  const [discounts, setDiscounts] = React.useState<Discount[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = React.useState({});

  // Dialog state
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [dateFrom, setDateFrom] = React.useState<Date>();
  const [dateTo, setDateTo] = React.useState<Date>();
  const [formData, setFormData] = React.useState({
    name: "",
    code: "",
    type: "PERCENTAGE" as DiscountType,
    amount: "",
    userScope: "ALL",
    productScope: "ALL",
  });

  const fetchDiscounts = React.useCallback(async () => {
    try {
      const response = await fetch("/api/discounts");
      if (!response.ok) throw new Error("Failed to fetch discounts");

      const data = await response.json();
      setDiscounts(data.data || []);
    } catch (error) {
      console.error("Error fetching discounts:", error);
      toast.error("Failed to load discounts");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchDiscounts();
  }, [fetchDiscounts]);

  const generateCode = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let result = "";
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setFormData((prev) => ({ ...prev, code: result }));
  };

  const resetForm = () => {
    setFormData({
      name: "",
      code: "",
      type: "PERCENTAGE",
      amount: "",
      userScope: "ALL",
      productScope: "ALL",
    });
    setDateFrom(undefined);
    setDateTo(undefined);
  };

  const handleCreateDiscount = async () => {
    if (!formData.name || !formData.code || !formData.amount || !dateFrom) {
      toast.error("Please fill in all required fields");
      return;
    }

    setSaving(true);

    try {
      const response = await fetch("/api/discounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          code: formData.code.toUpperCase(),
          type: formData.type,
          amount: parseFloat(formData.amount),
          validFrom: dateFrom.toISOString(),
          validTo: dateTo?.toISOString(),
          userScope: formData.userScope,
          productScope: formData.productScope,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create discount");
      }

      toast.success("Discount created successfully");
      setOpen(false);
      resetForm();
      fetchDiscounts();
    } catch (error) {
      console.error("Error creating discount:", error);
      toast.error(error instanceof Error ? error.message : "Failed to create discount");
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (id: string) => {
    try {
      const response = await fetch(`/api/discounts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "EXPIRED" }),
      });

      if (!response.ok) throw new Error("Failed to deactivate discount");

      toast.success("Discount deactivated");
      fetchDiscounts();
    } catch (error) {
      console.error("Error deactivating discount:", error);
      toast.error("Failed to deactivate discount");
    }
  };

  const columns: ColumnDef<Discount>[] = [
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
      header: ({ column }) => <DataTableColumnHeader column={column} title="Name" />,
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="font-medium">{row.getValue("name")}</span>
          <span className="text-xs text-muted-foreground">{row.original.code}</span>
        </div>
      ),
    },
    {
      accessorKey: "type",
      header: "Discount",
      cell: ({ row }) => {
        const type = row.getValue("type") as DiscountType;
        const amount = row.original.amount;
        return (
          <div className="font-medium">
            {type === "PERCENTAGE" ? `${amount}%` : `$${Number(amount).toFixed(2)}`}
          </div>
        );
      },
    },
    {
      accessorKey: "scopes",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Scope" />,
      cell: ({ row }) => (
        <div className="flex flex-col gap-1 text-xs">
          <span className="text-muted-foreground">
            User: <span className="font-medium text-foreground">{row.original.userScope}</span>
          </span>
          <span className="text-muted-foreground">
            Product:{" "}
            <span className="font-medium text-foreground">{row.original.productScope}</span>
          </span>
        </div>
      ),
    },
    {
      accessorKey: "validity",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Validity" />,
      cell: ({ row }) => {
        const from = formatDateString(row.original.validFrom);
        const to = row.original.validTo ? formatDateString(row.original.validTo) : "Indefinite";
        return (
          <div className="text-xs text-muted-foreground">
            {from} - {to}
          </div>
        );
      },
    },
    {
      accessorKey: "usageCount",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Uses" />,
      cell: ({ row }) => (
        <div className="text-center">
          {row.getValue("usageCount")}
          {row.original.usageLimit && (
            <span className="text-muted-foreground">/{row.original.usageLimit}</span>
          )}
        </div>
      ),
    },
    {
      accessorKey: "status",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
      cell: ({ row }) => {
        const status = row.getValue("status") as string;
        return (
          <Badge
            variant={
              status === "ACTIVE" ? "default" : status === "SCHEDULED" ? "secondary" : "outline"
            }
          >
            {status}
          </Badge>
        );
      },
    },
    {
      id: "actions",
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Open menu</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => navigator.clipboard.writeText(row.original.code)}>
              Copy Code
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive"
              onClick={() => handleDeactivate(row.original.id)}
            >
              Deactivate
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  const table = useReactTable({
    data: discounts,
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold tracking-tight">Discounts & Coupons</h2>
          <p className="text-sm text-muted-foreground">
            Manage discount codes, coupons, and promotional campaigns.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" /> Create Discount
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Create New Discount</DialogTitle>
              <DialogDescription>
                Create a new discount code or coupon. Fill in the details below.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Campaign Name</Label>
                  <Input
                    id="name"
                    placeholder="e.g. Summer Sale"
                    value={formData.name}
                    onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="code">Code</Label>
                  <div className="flex gap-2">
                    <Input
                      id="code"
                      placeholder="SUMMER25"
                      value={formData.code}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, code: e.target.value.toUpperCase() }))
                      }
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={generateCode}
                      title="Generate Code"
                    >
                      <Wand2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="type">Discount Type</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(v) =>
                      setFormData((prev) => ({ ...prev, type: v as DiscountType }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PERCENTAGE">Percentage (%)</SelectItem>
                      <SelectItem value="FIXED_AMOUNT">Fixed Amount ($)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="amount">Amount</Label>
                  <Input
                    id="amount"
                    type="number"
                    placeholder="0"
                    value={formData.amount}
                    onChange={(e) => setFormData((prev) => ({ ...prev, amount: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Valid From</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant={"outline"}
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !dateFrom && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateFrom ? format(dateFrom, "PPP") : <span>Pick a date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={dateFrom}
                        onSelect={setDateFrom}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  <Label>Valid To (Optional)</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant={"outline"}
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !dateTo && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateTo ? format(dateTo, "PPP") : <span>Pick a date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={dateTo} onSelect={setDateTo} initialFocus />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="userScope">User Scope</Label>
                  <Select
                    value={formData.userScope}
                    onValueChange={(v) => setFormData((prev) => ({ ...prev, userScope: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select users" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All Users</SelectItem>
                      <SelectItem value="NEW_USERS">New Users Only</SelectItem>
                      <SelectItem value="MEMBERS">Members Only</SelectItem>
                      <SelectItem value="VIP">VIP Only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="productScope">Product Scope</Label>
                  <Select
                    value={formData.productScope}
                    onValueChange={(v) => setFormData((prev) => ({ ...prev, productScope: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select products" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All Products</SelectItem>
                      <SelectItem value="MEMBERSHIP">Membership</SelectItem>
                      {eventsEnabled && <SelectItem value="EVENTS">Events</SelectItem>}
                      <SelectItem value="MERCHANDISE">Merchandise</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button onClick={handleCreateDiscount} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Discount
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search discounts..."
            value={(table.getColumn("name")?.getFilterValue() as string) ?? ""}
            onChange={(event) => table.getColumn("name")?.setFilterValue(event.target.value)}
            className="pl-8"
          />
        </div>
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
            {table.getRowModel().rows?.length ? (
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
                  No discounts found. Create your first discount to get started.
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
