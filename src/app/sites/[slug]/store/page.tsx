import { unstable_cache } from "next/cache"
import { db } from "@/lib/db"
import { notFound } from "next/navigation"
import { StoreProductList } from "@/components/sites/store-product-list"

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

export default async function StorePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const config = await getCachedSiteConfig(slug)

  if (!config || !config.showStore) return notFound()

  return (
    <div className="mx-auto w-full max-w-6xl px-4 md:px-8 py-12">
      <h1 className="text-3xl font-bold mb-8 text-center">Store</h1>
      <p className="text-center text-muted-foreground max-w-2xl mx-auto mb-12">
        Browse our products and add them to your cart to purchase online.
      </p>

      <StoreProductList
        organizationId={config.organizationId}
        primaryColor={config.primaryColor || undefined}
      />
    </div>
  )
}
