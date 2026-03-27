"use client"

import * as React from "react"
import { ProgressiveImage } from "@/components/ui/progressive-image"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import {
  Search,
  ShoppingBag,
  ShoppingCart,
  Package,
  Loader2,
  SearchX,
  X,
} from "lucide-react"
import Link from "next/link"
import { useCart } from "@/components/sites/cart-context"
import { toast } from "sonner"

type ProductVariant = {
  id: string
  label: string
  price: number | null
  imageUrl: string | null
  currentInventory: number | null
  maxInventory: number | null
}

type Product = {
  id: string
  name: string
  description: string | null
  category: string
  price: number
  imageUrl: string | null
  currentInventory: number | null
  maxInventory: number | null
  typeName: string | null
  variants: ProductVariant[]
}

interface StoreProductListProps {
  organizationId: string
  primaryColor?: string
}

function formatPrice(price: number): string {
  if (price === 0) return "FREE"
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(price)
}

export function StoreProductList({ organizationId }: StoreProductListProps) {
  const [products, setProducts] = React.useState<Product[]>([])
  const [categories, setCategories] = React.useState<string[]>([])
  const [selectedCategory, setSelectedCategory] = React.useState("All")
  const [searchQuery, setSearchQuery] = React.useState("")
  const [isLoading, setIsLoading] = React.useState(true)
  const [selectedVariants, setSelectedVariants] = React.useState<Record<string, string>>({})
  const { items, addItem } = useCart()

  React.useEffect(() => {
    async function fetchProducts() {
      try {
        setIsLoading(true)
        const res = await fetch(`/api/public/products?organizationId=${organizationId}`)
        if (!res.ok) throw new Error("Failed to fetch")
        const data = await res.json()
        setProducts(data.data || [])
        setCategories(data.categories || [])
      } catch (error) {
        console.error("Error fetching products:", error)
      } finally {
        setIsLoading(false)
      }
    }
    fetchProducts()
  }, [organizationId])

  const filteredProducts = products.filter((product) => {
    const matchesCategory = selectedCategory === "All" || product.category === selectedCategory
    const matchesSearch =
      searchQuery === "" ||
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.description?.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesCategory && matchesSearch
  })

  const getEffectivePrice = (product: Product, variantId?: string) => {
    if (variantId && product.variants.length > 0) {
      const variant = product.variants.find(v => v.id === variantId)
      if (variant?.price !== null && variant?.price !== undefined) {
        return Number(variant.price)
      }
    }
    return Number(product.price)
  }

  const getEffectiveInventory = (product: Product, variantId?: string) => {
    if (variantId && product.variants.length > 0) {
      const variant = product.variants.find(v => v.id === variantId)
      if (variant) return variant.currentInventory
    }
    return product.currentInventory
  }

  const handleAddToCart = (product: Product) => {
    const hasVariants = product.typeName && product.variants.length > 0
    const variantId = hasVariants ? selectedVariants[product.id] : undefined

    if (hasVariants && !variantId) {
      toast.error(`Please select a ${product.typeName?.toLowerCase() || "type"}`)
      return
    }

    const inventory = getEffectiveInventory(product, variantId)
    if (inventory !== null && inventory <= 0) {
      toast.error("This product is out of stock")
      return
    }

    const variant = variantId ? product.variants.find(v => v.id === variantId) : undefined
    const existingItem = items.find(
      (item) =>
        item.referenceId === product.id &&
        (variantId ? item.details?.variantId === variantId : !item.details?.variantId)
    )
    if (inventory !== null && existingItem) {
      if (existingItem.quantity >= inventory) {
        toast.error(`Only ${inventory} available in stock`)
        return
      }
    }

    const effectivePrice = getEffectivePrice(product, variantId)

    addItem({
      referenceId: product.id,
      type: "item",
      name: product.name,
      price: effectivePrice,
      quantity: 1,
      athleteId: "",
      athleteName: "Customer",
      details: {
        category: product.category,
        ...(variantId && variant
          ? { variantId, variantLabel: variant.label, typeName: product.typeName }
          : {}),
      },
    })

    toast.success(`${product.name}${variant ? ` (${variant.label})` : ""} added to cart`)
  }

  const getStockStatus = (product: Product) => {
    const hasVariants = product.typeName && product.variants.length > 0

    if (hasVariants) {
      const variantId = selectedVariants[product.id]
      if (!variantId) {
        const allOutOfStock = product.variants.every(v => v.currentInventory !== null && v.currentInventory <= 0)
        if (allOutOfStock) {
          return { label: "Out of Stock", variant: "destructive" as const }
        }
        return null
      }
      const variant = product.variants.find(v => v.id === variantId)
      if (!variant) return null
      if (variant.maxInventory === null && variant.currentInventory === null) return null
      if (variant.currentInventory === 0) {
        return { label: "Out of Stock", variant: "destructive" as const }
      }
      if (variant.currentInventory !== null && variant.currentInventory <= 5) {
        return { label: `Only ${variant.currentInventory} left!`, variant: "destructive" as const }
      }
      return null
    }

    if (product.maxInventory === null && product.currentInventory === null) {
      return null
    }
    if (product.currentInventory === 0) {
      return { label: "Out of Stock", variant: "destructive" as const }
    }
    if (product.currentInventory !== null && product.currentInventory <= 5) {
      return { label: `Only ${product.currentInventory} left!`, variant: "destructive" as const }
    }
    return null
  }

  const isOutOfStock = (product: Product) => {
    const hasVariants = product.typeName && product.variants.length > 0
    if (hasVariants) {
      const variantId = selectedVariants[product.id]
      if (!variantId) {
        return product.variants.every(v => v.currentInventory !== null && v.currentInventory <= 0)
      }
      const variant = product.variants.find(v => v.id === variantId)
      return variant?.currentInventory !== null && (variant?.currentInventory ?? 0) <= 0
    }
    return product.currentInventory !== null && product.currentInventory <= 0
  }

  const hasActiveFilters = selectedCategory !== "All" || searchQuery !== ""

  const clearFilters = () => {
    setSelectedCategory("All")
    setSearchQuery("")
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (products.length === 0) {
    return (
      <div className="text-center py-16 rounded-xl border bg-muted/30">
        <ShoppingBag className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
        <p className="text-muted-foreground text-lg mb-1">No Products Available</p>
        <p className="text-muted-foreground text-sm">
          There are no products available at this time. Please check back later.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Filter bar */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {filteredProducts.length} of {products.length} product{products.length !== 1 ? "s" : ""}
        </p>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search..."
              className="pl-8 h-9 w-[180px] sm:w-[220px]"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Category chips */}
      {categories.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          <Button
            variant={selectedCategory === "All" ? "default" : "outline"}
            size="sm"
            className="shrink-0"
            onClick={() => setSelectedCategory("All")}
          >
            All
          </Button>
          {categories.map((cat) => (
            <Button
              key={cat}
              variant={selectedCategory === cat ? "default" : "outline"}
              size="sm"
              className="shrink-0"
              onClick={() => setSelectedCategory(cat)}
            >
              {cat}
            </Button>
          ))}
        </div>
      )}

      {/* Product Grid */}
      {filteredProducts.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredProducts.map((product) => {
            const stockStatus = getStockStatus(product)
            const outOfStock = isOutOfStock(product)
            const hasVariants = product.typeName && product.variants.length > 0
            const currentVariantId = selectedVariants[product.id]
            const effectivePrice = getEffectivePrice(product, currentVariantId)
            const selectedVariantImage = currentVariantId
              ? product.variants.find((v) => v.id === currentVariantId)?.imageUrl
              : null
            const displayImageUrl = selectedVariantImage || product.imageUrl

            return (
              <Card
                key={product.id}
                className={`group relative flex flex-col overflow-hidden transition-all duration-300 hover:shadow-lg hover:shadow-primary/10 ${
                  outOfStock ? "opacity-60" : ""
                }`}
              >
                {displayImageUrl && (
                  <Link href={`/store/${product.id}`} className="block">
                    <div className="relative aspect-square w-full overflow-hidden">
                      <ProgressiveImage
                        src={displayImageUrl}
                        alt={product.name}
                        fill
                        className="object-cover transition-transform duration-300 group-hover:scale-105"
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        loading="lazy"
                      />
                      {outOfStock && (
                        <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
                          <Badge variant="destructive" className="text-sm px-3 py-1 font-semibold">
                            Sold Out
                          </Badge>
                        </div>
                      )}
                    </div>
                  </Link>
                )}

                <CardHeader className="pb-3">
                  {product.category && (
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">
                      {product.category}
                    </p>
                  )}
                  <div className="flex items-start justify-between gap-2">
                    <Link href={`/store/${product.id}`} className="hover:underline">
                      <h3 className="font-semibold leading-tight text-foreground group-hover:text-primary transition-colors">
                        {product.name}
                      </h3>
                    </Link>
                    <div className="flex items-center gap-1">
                      {stockStatus && (
                        <Badge
                          variant={stockStatus.variant}
                          className="shrink-0 text-[10px] px-1.5 py-0"
                        >
                          {stockStatus.label}
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="flex-1 pb-4">
                  {product.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {product.description}
                    </p>
                  )}

                  {!displayImageUrl && (
                    <div className="relative flex items-center justify-center h-24 rounded-md bg-muted/50 mt-2">
                      <Package className="h-10 w-10 text-muted-foreground/30" />
                      {outOfStock && (
                        <div className="absolute inset-0 bg-background/60 flex items-center justify-center rounded-md">
                          <Badge variant="destructive" className="text-xs px-2.5 py-0.5 font-semibold">
                            Sold Out
                          </Badge>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Variant selector */}
                  {hasVariants && (
                    <div className="mt-3 space-y-1.5">
                      <p className="text-xs font-medium text-muted-foreground">{product.typeName} <span className="text-destructive">*</span></p>
                      <div className="flex flex-wrap gap-1.5">
                        {product.variants.map((variant) => {
                          const variantOutOfStock = variant.currentInventory !== null && variant.currentInventory <= 0
                          const isSelected = currentVariantId === variant.id
                          return (
                            <Button
                              key={variant.id}
                              variant={isSelected ? "default" : "outline"}
                              size="sm"
                              className={`h-7 text-xs px-2.5 gap-1 ${variantOutOfStock ? "opacity-50 cursor-not-allowed" : ""}`}
                              disabled={variantOutOfStock}
                              title={variantOutOfStock ? `${variant.label} is sold out` : undefined}
                              onClick={() =>
                                setSelectedVariants((prev) => ({
                                  ...prev,
                                  [product.id]: isSelected ? "" : variant.id,
                                }))
                              }
                            >
                              <span className={variantOutOfStock ? "line-through" : ""}>{variant.label}</span>
                              {variantOutOfStock && (
                                <span className="text-[10px] text-destructive font-normal no-underline">(Sold out)</span>
                              )}
                            </Button>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </CardContent>

                <CardFooter className="flex flex-col gap-3 border-t bg-muted/30 pt-4">
                  <div className="flex items-center justify-between w-full">
                    <span className="text-sm font-medium">Price</span>
                    <span className="font-bold">{formatPrice(effectivePrice)}</span>
                  </div>
                  <Button
                    onClick={() => handleAddToCart(product)}
                    disabled={outOfStock}
                    className="w-full gap-2 bg-primary text-primary-foreground hover:bg-primary/90 transition-transform active:scale-95"
                  >
                    <ShoppingCart className="h-4 w-4" />
                    {outOfStock ? "Sold Out" : "Add to Cart"}
                  </Button>
                </CardFooter>
              </Card>
            )
          })}
        </div>
      ) : hasActiveFilters ? (
        <div className="text-center py-16 rounded-xl border bg-muted/30">
          <SearchX className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
          <p className="text-muted-foreground text-lg mb-1">No matching products</p>
          <p className="text-muted-foreground text-sm mb-4">
            Try adjusting your search or category to see more results.
          </p>
          <Button variant="outline" onClick={clearFilters} className="gap-2">
            <X className="h-4 w-4" />
            Clear Filters
          </Button>
        </div>
      ) : (
        <div className="text-center py-16 rounded-xl border bg-muted/30">
          <p className="text-muted-foreground text-lg">
            No products are currently available.
          </p>
        </div>
      )}
    </div>
  )
}
