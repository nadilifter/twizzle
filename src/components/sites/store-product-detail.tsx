"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  ArrowLeft,
  ShoppingCart,
  Package,
  Minus,
  Plus,
  Check,
  AlertTriangle,
} from "lucide-react"
import { useCart } from "@/components/sites/cart-context"
import { toast } from "sonner"
import { Separator } from "@/components/ui/separator"

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

interface StoreProductDetailProps {
  product: Product
  primaryColor: string
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

export function StoreProductDetail({ product, primaryColor }: StoreProductDetailProps) {
  const [selectedVariantId, setSelectedVariantId] = React.useState<string>("")
  const [quantity, setQuantity] = React.useState(1)
  const [activeImageUrl, setActiveImageUrl] = React.useState<string | null>(product.imageUrl)
  const { items, addItem } = useCart()

  const hasVariants = !!(product.typeName && product.variants.length > 0)
  const selectedVariant = hasVariants
    ? product.variants.find((v) => v.id === selectedVariantId)
    : undefined

  const allImages = React.useMemo(() => {
    const images: { url: string; label: string }[] = []
    if (product.imageUrl) {
      images.push({ url: product.imageUrl, label: product.name })
    }
    for (const variant of product.variants) {
      if (variant.imageUrl) {
        images.push({ url: variant.imageUrl, label: variant.label })
      }
    }
    return images
  }, [product.imageUrl, product.variants, product.name])

  const showThumbnails = allImages.length > 1

  React.useEffect(() => {
    if (selectedVariant?.imageUrl) {
      setActiveImageUrl(selectedVariant.imageUrl)
    } else if (selectedVariantId === "") {
      setActiveImageUrl(product.imageUrl)
    }
  }, [selectedVariantId, selectedVariant, product.imageUrl])

  const effectivePrice = React.useMemo(() => {
    if (selectedVariant?.price !== null && selectedVariant?.price !== undefined) {
      return Number(selectedVariant.price)
    }
    return Number(product.price)
  }, [selectedVariant, product.price])

  const effectiveInventory = React.useMemo(() => {
    if (selectedVariant) return selectedVariant.currentInventory
    return product.currentInventory
  }, [selectedVariant, product.currentInventory])

  const isOutOfStock = effectiveInventory !== null && effectiveInventory <= 0
  const isLowStock = effectiveInventory !== null && effectiveInventory > 0 && effectiveInventory <= 5
  const allVariantsOutOfStock = hasVariants && product.variants.every(
    v => v.currentInventory !== null && v.currentInventory <= 0
  )
  const productUnavailable = isOutOfStock || allVariantsOutOfStock

  const maxQuantity = React.useMemo(() => {
    if (effectiveInventory === null) return 99
    const existingItem = items.find(
      (item) =>
        item.referenceId === product.id &&
        (selectedVariantId ? item.details?.variantId === selectedVariantId : !item.details?.variantId)
    )
    const alreadyInCart = existingItem?.quantity ?? 0
    return Math.max(0, effectiveInventory - alreadyInCart)
  }, [effectiveInventory, items, product.id, selectedVariantId])

  React.useEffect(() => {
    setQuantity(1)
  }, [selectedVariantId])

  const handleAddToCart = () => {
    if (hasVariants && !selectedVariantId) {
      toast.error(`Please select a ${product.typeName?.toLowerCase() || "type"}`)
      return
    }

    if (isOutOfStock) {
      toast.error("This product is out of stock")
      return
    }

    if (quantity > maxQuantity) {
      toast.error(`Only ${maxQuantity} more available`)
      return
    }

    addItem({
      referenceId: product.id,
      type: "item",
      name: product.name,
      price: effectivePrice,
      quantity,
      athleteId: "",
      athleteName: "Customer",
      details: {
        category: product.category,
        ...(selectedVariantId && selectedVariant
          ? { variantId: selectedVariantId, variantLabel: selectedVariant.label, typeName: product.typeName }
          : {}),
      },
    })

    toast.success(
      `${quantity}x ${product.name}${selectedVariant ? ` (${selectedVariant.label})` : ""} added to cart`
    )
    setQuantity(1)
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 md:px-8 py-8">
      <Link
        href="/store"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Store
      </Link>

      <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
        {/* Left: Product Image + Thumbnails */}
        <div className="relative space-y-3">
          {activeImageUrl ? (
            <div className="relative aspect-square w-full overflow-hidden rounded-2xl border bg-muted/20">
              <Image
                key={activeImageUrl}
                src={activeImageUrl}
                alt={product.name}
                fill
                className="object-cover animate-in fade-in duration-300"
                sizes="(max-width: 1024px) 100vw, 50vw"
                priority
              />
              {productUnavailable && (
                <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
                  <Badge variant="destructive" className="text-lg px-4 py-1.5 font-semibold">
                    Sold Out
                  </Badge>
                </div>
              )}
            </div>
          ) : (
            <div className="relative flex aspect-square w-full items-center justify-center rounded-2xl border bg-muted/30">
              <Package className="h-24 w-24 text-muted-foreground/20" />
              {productUnavailable && (
                <div className="absolute inset-0 bg-background/60 flex items-center justify-center rounded-2xl">
                  <Badge variant="destructive" className="text-lg px-4 py-1.5 font-semibold">
                    Sold Out
                  </Badge>
                </div>
              )}
            </div>
          )}

          {showThumbnails && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {allImages.map((img) => {
                const isActive = activeImageUrl === img.url
                return (
                  <button
                    key={img.url}
                    onClick={() => setActiveImageUrl(img.url)}
                    className={`
                      relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 transition-all
                      ${isActive
                        ? "ring-2 ring-offset-2"
                        : "border-border hover:border-foreground/30 opacity-70 hover:opacity-100"
                      }
                    `}
                    style={isActive ? { borderColor: primaryColor, "--tw-ring-color": primaryColor } as React.CSSProperties : undefined}
                    title={img.label}
                  >
                    <Image
                      src={img.url}
                      alt={img.label}
                      fill
                      className="object-cover"
                      sizes="64px"
                    />
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Right: Product Info */}
        <div className="flex flex-col">
          {product.category && (
            <p className="text-sm font-medium uppercase tracking-wider text-muted-foreground mb-2">
              {product.category}
            </p>
          )}

          <h1 className="text-3xl font-bold tracking-tight mb-4">{product.name}</h1>

          {product.description && (
            <p className="text-muted-foreground leading-relaxed mb-6">
              {product.description}
            </p>
          )}

          <Separator className="mb-6" />

          {/* Price display */}
          <div className="mb-6">
            <p className="text-sm font-medium text-muted-foreground mb-1">Price</p>
            <p className="text-3xl font-bold" style={{ color: effectivePrice > 0 ? primaryColor : undefined }}>
              {formatPrice(effectivePrice)}
            </p>
          </div>

          {/* Variant selector with price/availability breakdown */}
          {hasVariants && (
            <div className="mb-6">
              <p className="text-sm font-medium mb-3">
                {product.typeName} <span className="text-destructive">*</span>
              </p>
              <div className="space-y-2">
                {product.variants.map((variant) => {
                  const variantOutOfStock =
                    variant.currentInventory !== null && variant.currentInventory <= 0
                  const variantLowStock =
                    variant.currentInventory !== null &&
                    variant.currentInventory > 0 &&
                    variant.currentInventory <= 5
                  const isSelected = selectedVariantId === variant.id
                  const variantPrice =
                    variant.price !== null && variant.price !== undefined
                      ? Number(variant.price)
                      : Number(product.price)

                  return (
                    <button
                      key={variant.id}
                      disabled={variantOutOfStock}
                      onClick={() => setSelectedVariantId(isSelected ? "" : variant.id)}
                      className={`
                        w-full flex items-center justify-between rounded-lg border-2 px-4 py-3 text-left transition-all
                        ${isSelected
                          ? "border-primary bg-primary/5 shadow-sm"
                          : variantOutOfStock
                            ? "border-muted bg-muted/30 opacity-50 cursor-not-allowed"
                            : "border-border hover:border-primary/40 hover:bg-muted/30 cursor-pointer"
                        }
                      `}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`
                            flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors
                            ${isSelected ? "border-primary bg-primary" : "border-muted-foreground/30"}
                          `}
                        >
                          {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
                        </div>
                        <div>
                          <span className={`font-medium ${variantOutOfStock ? "line-through" : ""}`}>
                            {variant.label}
                          </span>
                          {variantOutOfStock && (
                            <span className="ml-2 text-xs text-destructive">Out of stock</span>
                          )}
                          {variantLowStock && (
                            <span className="ml-2 text-xs text-amber-600">
                              Only {variant.currentInventory} left
                            </span>
                          )}
                        </div>
                      </div>
                      <span className={`font-semibold ${variantOutOfStock ? "text-muted-foreground" : ""}`}>
                        {formatPrice(variantPrice)}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {allVariantsOutOfStock && (
            <div className="mb-6 flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
              <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />
              <p className="text-sm text-destructive">
                This product is currently sold out in all {product.typeName?.toLowerCase() || "type"}s. Check back later for availability.
              </p>
            </div>
          )}

          {/* Stock status for non-variant products */}
          {!hasVariants && effectiveInventory !== null && (
            <div className="mb-6">
              {isOutOfStock ? (
                <Badge variant="destructive" className="gap-1.5">
                  <AlertTriangle className="h-3 w-3" />
                  Out of Stock
                </Badge>
              ) : isLowStock ? (
                <Badge variant="outline" className="gap-1.5 border-amber-500 text-amber-600 bg-amber-50">
                  <AlertTriangle className="h-3 w-3" />
                  Only {effectiveInventory} left in stock
                </Badge>
              ) : (
                <Badge variant="outline" className="gap-1.5 border-emerald-500 text-emerald-600 bg-emerald-50">
                  <Check className="h-3 w-3" />
                  In Stock
                </Badge>
              )}
            </div>
          )}

          <Separator className="mb-6" />

          {/* Quantity selector + Add to cart */}
          {productUnavailable ? (
            <Button disabled size="lg" className="w-full gap-2">
              <ShoppingCart className="h-4 w-4" />
              Sold Out
            </Button>
          ) : (
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="flex items-center rounded-lg border">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 rounded-r-none"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  disabled={quantity <= 1}
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <span className="flex h-10 w-12 items-center justify-center text-sm font-medium tabular-nums">
                  {quantity}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 rounded-l-none"
                  onClick={() => setQuantity(Math.min(quantity + 1, maxQuantity))}
                  disabled={quantity >= maxQuantity}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              <Button
                onClick={handleAddToCart}
                disabled={hasVariants && !selectedVariantId}
                size="lg"
                className="flex-1 gap-2 transition-transform active:scale-[0.98]"
                style={{
                  backgroundColor: (!hasVariants || selectedVariantId) ? primaryColor : undefined,
                }}
              >
                <ShoppingCart className="h-4 w-4" />
                {hasVariants && !selectedVariantId
                  ? `Select ${product.typeName || "Type"}`
                  : `Add to Cart — ${formatPrice(effectivePrice * quantity)}`}
              </Button>
            </div>
          )}

          {/* All variants price range summary */}
          {hasVariants && product.variants.length > 1 && (
            <div className="mt-6 rounded-lg bg-muted/30 p-4">
              <p className="text-sm font-medium mb-2">Price Range by {product.typeName}</p>
              <div className="grid gap-1.5">
                {product.variants.map((variant) => {
                  const vPrice = variant.price !== null && variant.price !== undefined
                    ? Number(variant.price)
                    : Number(product.price)
                  const vOutOfStock = variant.currentInventory !== null && variant.currentInventory <= 0
                  const vLowStock = variant.currentInventory !== null && variant.currentInventory > 0 && variant.currentInventory <= 5
                  return (
                    <div
                      key={variant.id}
                      className={`flex items-center justify-between text-sm ${vOutOfStock ? "text-muted-foreground line-through" : ""}`}
                    >
                      <span>{variant.label}</span>
                      <div className="flex items-center gap-2">
                        {vOutOfStock && (
                          <span className="text-xs text-destructive">Out of stock</span>
                        )}
                        {vLowStock && (
                          <span className="text-xs text-amber-600">Only {variant.currentInventory} left</span>
                        )}
                        <span className="font-medium">{formatPrice(vPrice)}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
