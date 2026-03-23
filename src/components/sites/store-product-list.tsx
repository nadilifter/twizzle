"use client"

import * as React from "react"
import Image from "next/image"
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
import { useCart } from "@/components/sites/cart-context"
import { toast } from "sonner"

type Product = {
  id: string
  name: string
  description: string | null
  category: string
  price: number
  imageUrl: string | null
  currentInventory: number | null
  maxInventory: number | null
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

  const handleAddToCart = (product: Product) => {
    if (product.currentInventory !== null && product.currentInventory <= 0) {
      toast.error("This product is out of stock")
      return
    }

    const existingItem = items.find((item) => item.referenceId === product.id)
    if (product.currentInventory !== null && existingItem) {
      if (existingItem.quantity >= product.currentInventory) {
        toast.error(`Only ${product.currentInventory} available in stock`)
        return
      }
    }

    addItem({
      referenceId: product.id,
      type: "item",
      name: product.name,
      price: Number(product.price),
      quantity: 1,
      athleteId: "",
      athleteName: "Customer",
      details: {
        category: product.category,
      },
    })

    toast.success(`${product.name} added to cart`)
  }

  const getStockStatus = (product: Product) => {
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
            const isOutOfStock = product.currentInventory !== null && product.currentInventory <= 0
            const price = Number(product.price)

            return (
              <Card
                key={product.id}
                className={`group relative flex flex-col overflow-hidden transition-all duration-300 hover:shadow-lg hover:shadow-primary/10 ${
                  isOutOfStock ? "opacity-60" : ""
                }`}
              >
                {product.imageUrl && (
                  <div className="relative aspect-video w-full overflow-hidden">
                    <Image
                      src={product.imageUrl}
                      alt={product.name}
                      fill
                      className="object-cover"
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      loading="lazy"
                    />
                  </div>
                )}

                <CardHeader className="pb-3">
                  {product.category && (
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">
                      {product.category}
                    </p>
                  )}
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold leading-tight text-foreground group-hover:text-primary transition-colors">
                      {product.name}
                    </h3>
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

                  {!product.imageUrl && (
                    <div className="flex items-center justify-center h-24 rounded-md bg-muted/50 mt-2">
                      <Package className="h-10 w-10 text-muted-foreground/30" />
                    </div>
                  )}
                </CardContent>

                <CardFooter className="flex flex-col gap-3 border-t bg-muted/30 pt-4">
                  <div className="flex items-center justify-between w-full">
                    <span className="text-sm font-medium">Price</span>
                    <span className="font-bold">{formatPrice(price)}</span>
                  </div>
                  <Button
                    onClick={() => handleAddToCart(product)}
                    disabled={isOutOfStock}
                    className="w-full gap-2 bg-primary text-primary-foreground hover:bg-primary/90 transition-transform active:scale-95"
                  >
                    <ShoppingCart className="h-4 w-4" />
                    {isOutOfStock ? "Sold Out" : "Add to Cart"}
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
