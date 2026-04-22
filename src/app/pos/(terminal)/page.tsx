"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Search,
  Trash2,
  Plus,
  Minus,
  ScanBarcode,
  Package,
  Loader2,
  ShoppingCart,
  X,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { useCart } from "@/components/sites/cart-context";
import { Badge } from "@/components/ui/badge";
import Image from "next/image";
import { toast } from "sonner";
import { verifyOrganizationMembership } from "@/app/actions/organization";
import { getClientSubdomainUrl } from "@/lib/client-domains";
import { getStockStatus } from "@/lib/stock-utils";

type ProductVariant = {
  id: string;
  label: string;
  price: number | null;
  maxInventory: number | null;
  currentInventory: number | null;
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
};

// Wrapper component to handle Suspense for useSearchParams
export default function POSPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-full items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <POSPageContent />
    </Suspense>
  );
}

function POSPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const orgIdParam = searchParams.get("orgId");

  // Handle org switching when orgId param differs from session org
  useEffect(() => {
    const handleOrgSwitch = async () => {
      if (
        orgIdParam &&
        session?.user?.organizationId &&
        orgIdParam !== session.user.organizationId
      ) {
        // User clicked a link for a different org - verify access and redirect to switch
        const hasAccess = await verifyOrganizationMembership(orgIdParam);
        if (hasAccess) {
          router.push(`/pos/select-organization?preselect=${encodeURIComponent(orgIdParam)}`);
        }
        // If no access, stay on current org (just clear the param)
        else {
          router.replace("/pos");
        }
      }
    };

    handleOrgSwitch();
  }, [orgIdParam, session?.user?.organizationId, router]);

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [taxRate, setTaxRate] = useState(0);

  const { items, addItem, removeItem, updateQuantity, clearCart, subtotal, totalItems } = useCart();
  const [variantPickerProduct, setVariantPickerProduct] = useState<Product | null>(null);

  const fetchProducts = useCallback(async () => {
    try {
      setIsLoading(true);
      const [prodRes, orgRes] = await Promise.all([
        fetch("/api/products?activeOnly=true"),
        fetch("/api/organization/details"),
      ]);
      if (!prodRes.ok) throw new Error("Failed to fetch products");
      const data = await prodRes.json();
      setProducts(data.data || []);
      if (data.categories?.length > 0) {
        setCategories(["All", ...data.categories]);
      }
      if (orgRes.ok) {
        const orgData = await orgRes.json();
        if (orgData.taxEnabled !== false && orgData.taxRate != null) {
          setTaxRate(Number(orgData.taxRate));
        }
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

  // Filter products
  const filteredProducts = products.filter((product) => {
    const matchesCategory = selectedCategory === "All" || product.category === selectedCategory;
    const matchesSearch =
      searchQuery === "" ||
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.sku?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // Add to cart (for non-variant products or after variant selection)
  const handleAddToCart = (product: Product, variant?: ProductVariant) => {
    const hasVariants = product.typeName && product.variants?.length > 0;
    if (hasVariants && !variant) {
      setVariantPickerProduct(product);
      return;
    }

    const inventory = variant ? variant.currentInventory : product.currentInventory;
    if (inventory !== null && inventory <= 0) {
      toast.error("This product is sold out");
      return;
    }

    const existingItem = items.find(
      (item) =>
        item.referenceId === product.id &&
        (variant ? item.details?.variantId === variant.id : !item.details?.variantId)
    );
    if (inventory !== null && existingItem) {
      if (existingItem.quantity >= inventory) {
        toast.error(`Only ${inventory} available in stock`);
        return;
      }
    }

    const unitPrice =
      variant?.price !== null && variant?.price !== undefined
        ? Number(variant.price)
        : Number(product.price);

    addItem({
      referenceId: product.id,
      type: "item",
      name: product.name,
      price: unitPrice,
      quantity: 1,
      athleteId: "",
      athleteName: "Walk-in",
      details: {
        sku: product.sku,
        category: product.category,
        ...(variant
          ? { variantId: variant.id, variantLabel: variant.label, typeName: product.typeName }
          : {}),
      },
    });

    setVariantPickerProduct(null);
  };

  const tax = Math.round(subtotal * taxRate * 100) / 100;
  const total = Math.round((subtotal + tax) * 100) / 100;

  return (
    <div className="flex flex-1 min-h-0 w-full bg-background">
      {/* Left: Product Grid */}
      <div className="flex-1 min-w-0 flex flex-col min-h-0">
        <div className="p-3 md:p-4 border-b flex gap-2 bg-background shrink-0">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search products..."
              className="pl-8 h-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Button
            variant="outline"
            size="icon"
            className="h-10 w-10"
            disabled
            title="Barcode scanner"
          >
            <ScanBarcode className="h-4 w-4" />
          </Button>
        </div>

        {/* Categories */}
        <div className="flex gap-2 p-2 overflow-x-auto border-b bg-muted/30 shrink-0">
          {categories.map((category) => (
            <Button
              key={category}
              variant={selectedCategory === category ? "secondary" : "ghost"}
              size="sm"
              className="shrink-0"
              onClick={() => setSelectedCategory(category)}
            >
              {category}
            </Button>
          ))}
        </div>

        <ScrollArea className="flex-1 min-h-0">
          <div className="p-3 md:p-4">
            {isLoading ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                <Package className="h-12 w-12 mb-4" />
                <p>No products found</p>
                {products.length === 0 && (
                  <p className="text-sm mt-2">
                    Add products in the{" "}
                    <a
                      href={`${getClientSubdomainUrl("admin")}/store/products`}
                      className="text-primary underline"
                    >
                      Store settings
                    </a>
                  </p>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 md:gap-3">
                {filteredProducts.map((product) => {
                  const { outOfStock, badge: stockBadge } = getStockStatus(product);
                  const hasVariants = product.typeName && product.variants?.length > 0;

                  return (
                    <div key={product.id} className="relative">
                      <Button
                        variant="outline"
                        className={`w-full aspect-square flex flex-col items-center justify-center gap-1.5 md:gap-2 whitespace-normal p-2 md:p-3 hover:border-primary hover:bg-accent/50 relative transition-colors touch-manipulation overflow-hidden ${
                          outOfStock ? "opacity-50 cursor-not-allowed" : ""
                        }`}
                        onClick={() => handleAddToCart(product)}
                        disabled={outOfStock}
                      >
                        {stockBadge && (
                          <Badge
                            variant={stockBadge.variant}
                            className="absolute top-1.5 right-1.5 text-[10px]"
                          >
                            {stockBadge.label}
                          </Badge>
                        )}
                        {hasVariants && (
                          <Badge
                            variant="outline"
                            className="absolute top-1.5 left-1.5 text-[10px]"
                          >
                            {product.typeName}
                          </Badge>
                        )}
                        {product.imageUrl ? (
                          <Image
                            src={product.imageUrl}
                            alt={product.name}
                            width={48}
                            height={48}
                            className="rounded-lg object-cover max-w-12 max-h-12 shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 md:w-12 md:h-12 rounded-lg bg-muted flex items-center justify-center shrink-0">
                            <Package className="h-5 w-5 md:h-6 md:w-6 text-muted-foreground" />
                          </div>
                        )}
                        <span className="font-medium text-center leading-tight text-xs md:text-sm line-clamp-2">
                          {product.name}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          ${Number(product.price).toFixed(2)}
                        </span>
                      </Button>

                      {/* Variant picker overlay */}
                      {variantPickerProduct?.id === product.id && (
                        <div className="absolute inset-0 z-10 bg-background border-2 border-primary rounded-md p-2 flex flex-col gap-1 shadow-lg">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-medium truncate">{product.typeName}</span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-5 w-5"
                              onClick={(e) => {
                                e.stopPropagation();
                                setVariantPickerProduct(null);
                              }}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                          <div className="flex-1 overflow-y-auto space-y-1">
                            {product.variants
                              .filter((v) => v.isActive)
                              .map((variant) => {
                                const variantOOS =
                                  variant.currentInventory !== null &&
                                  variant.currentInventory <= 0;
                                const variantPrice =
                                  variant.price !== null
                                    ? Number(variant.price)
                                    : Number(product.price);
                                return (
                                  <Button
                                    key={variant.id}
                                    variant="outline"
                                    size="sm"
                                    className={`w-full justify-between h-8 text-xs ${variantOOS ? "opacity-40" : ""}`}
                                    disabled={variantOOS}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleAddToCart(product, variant);
                                    }}
                                  >
                                    <span className="truncate">{variant.label}</span>
                                    <span className="shrink-0 ml-1">
                                      ${variantPrice.toFixed(2)}
                                    </span>
                                  </Button>
                                );
                              })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Right: Cart - Full height sidebar */}
      <div className="w-[280px] md:w-[320px] lg:w-[360px] flex flex-col bg-muted/30 border-l shrink-0">
        <div className="p-3 md:p-4 border-b bg-background flex justify-between items-center shrink-0">
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-primary" />
            <span className="font-semibold text-sm md:text-base">Current Order</span>
            {totalItems > 0 && (
              <Badge variant="secondary" className="text-xs">
                {totalItems}
              </Badge>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 px-2"
            onClick={clearCart}
            disabled={items.length === 0}
          >
            <Trash2 className="h-4 w-4 mr-1" />
            <span className="hidden md:inline">Clear</span>
          </Button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-3 md:p-4">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full min-h-[200px] text-muted-foreground">
              <ShoppingCart className="h-12 w-12 mb-4 opacity-30" />
              <p className="text-sm">No items in cart</p>
              <p className="text-xs mt-1">Tap a product to add it</p>
            </div>
          ) : (
            <div className="space-y-2 md:space-y-3">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex justify-between items-start p-2.5 md:p-3 bg-background rounded-lg border shadow-sm"
                >
                  <div className="flex-1 min-w-0 mr-2">
                    <div className="font-medium text-sm truncate">{item.name}</div>
                    {item.details?.variantLabel && (
                      <div className="text-xs text-primary truncate">
                        {item.details.typeName}: {item.details.variantLabel}
                      </div>
                    )}
                    <div className="text-xs text-muted-foreground">
                      ${item.price.toFixed(2)} each
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 md:gap-2 shrink-0">
                    <div className="font-semibold text-sm">
                      ${(item.price * item.quantity).toFixed(2)}
                    </div>
                    <div className="flex items-center gap-0.5 bg-muted rounded-md p-0.5">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 md:h-8 md:w-8 rounded-sm hover:bg-background touch-manipulation"
                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                      >
                        <Minus className="w-3 h-3" />
                      </Button>
                      <span className="text-xs font-mono w-6 text-center">{item.quantity}</span>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 md:h-8 md:w-8 rounded-sm hover:bg-background touch-manipulation"
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                      >
                        <Plus className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-3 md:p-4 bg-background border-t space-y-3 md:space-y-4 shrink-0">
          <div className="space-y-1 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal</span>
              <span>${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Tax ({(taxRate * 100).toFixed(2).replace(/\.?0+$/, "")}%)</span>
              <span>${tax.toFixed(2)}</span>
            </div>
          </div>
          <div className="flex justify-between text-lg md:text-xl font-bold pt-2 border-t">
            <span>Total</span>
            <span>${total.toFixed(2)}</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              className="h-12 md:h-14 text-base font-medium touch-manipulation"
              disabled={items.length === 0}
              onClick={() => router.push("/pos/payment?method=cash")}
            >
              Cash
            </Button>
            <Button
              className="h-12 md:h-14 text-base font-medium touch-manipulation"
              disabled={items.length === 0}
              onClick={() => router.push("/pos/payment?method=card")}
            >
              Card
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
