import { getAuthSession } from "@/lib/auth"
import { redirect } from "next/navigation"
import { CartProvider } from "@/components/sites/cart-context"

// Root POS layout - handles authentication and provides cart context
// Organization-specific logic is in the (terminal) route group layout
export default async function POSLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getAuthSession()
  
  if (!session) {
    // Middleware should handle this, but as a fallback
    redirect("/login?callbackUrl=/pos")
  }

  return <CartProvider>{children}</CartProvider>
}
