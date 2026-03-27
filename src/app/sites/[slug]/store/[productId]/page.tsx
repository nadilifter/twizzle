import { unstable_cache } from "next/cache"
import { db } from "@/lib/db"
import { notFound } from "next/navigation"
import { Metadata } from "next"
import { StoreProductDetail } from "@/components/sites/store-product-detail"
import { isFeatureEnabled } from "@/lib/feature-resolver"

const getCachedSiteConfig = unstable_cache(
  async (slug: string) => {
    return db.websiteConfig.findUnique({
      where: { subdomain: slug },
      select: { organizationId: true, primaryColor: true, showStore: true },
    })
  },
  ["site-config-store"],
  { revalidate: 30 }
)

const getCachedProduct = unstable_cache(
  async (productId: string, organizationId: string) => {
    return db.product.findFirst({
      where: { id: productId, organizationId, isActive: true },
      select: {
        id: true,
        name: true,
        description: true,
        category: true,
        price: true,
        imageUrl: true,
        currentInventory: true,
        maxInventory: true,
        typeName: true,
        variants: {
          where: { isActive: true },
          select: {
            id: true,
            label: true,
            price: true,
            imageUrl: true,
            currentInventory: true,
            maxInventory: true,
          },
          orderBy: { sortOrder: "asc" },
        },
      },
    })
  },
  ["site-product-detail"],
  { revalidate: 30 }
)

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; productId: string }>
}): Promise<Metadata> {
  const { slug, productId } = await params
  const config = await getCachedSiteConfig(slug)
  if (!config || !config.showStore) return {}

  const storeEnabled = await isFeatureEnabled(config.organizationId, "store")
  if (!storeEnabled) return {}

  const product = await getCachedProduct(productId, config.organizationId)
  if (!product) return {}

  return {
    title: product.name,
    description: product.description || `${product.name} — available in our store`,
    openGraph: {
      title: product.name,
      description: product.description || undefined,
      images: product.imageUrl ? [{ url: product.imageUrl }] : undefined,
    },
  }
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ slug: string; productId: string }>
}) {
  const { slug, productId } = await params
  const config = await getCachedSiteConfig(slug)

  if (!config || !config.showStore) return notFound()

  const storeEnabled = await isFeatureEnabled(config.organizationId, "store")
  if (!storeEnabled) return notFound()

  const product = await getCachedProduct(productId, config.organizationId)

  if (!product) return notFound()

  const serializedProduct = {
    ...product,
    price: Number(product.price),
    variants: product.variants.map((v) => ({
      ...v,
      price: v.price !== null ? Number(v.price) : null,
    })),
  }

  return (
    <StoreProductDetail
      product={serializedProduct}
      primaryColor={config.primaryColor || "#000000"}
    />
  )
}
