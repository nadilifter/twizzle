import { getAuthSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { isFeatureEnabled } from "@/lib/feature-resolver";
import { CartProvider } from "@/components/sites/cart-context";
import { FeatureUnavailablePage } from "@/components/feature-unavailable-page";

// Root POS layout - handles authentication and provides cart context
// Organization-specific logic is in the (terminal) route group layout
export default async function POSLayout({ children }: { children: React.ReactNode }) {
  const session = await getAuthSession();

  if (!session) {
    // Middleware should handle this, but as a fallback
    redirect("/login?callbackUrl=/pos");
  }

  const storeEnabled = await isFeatureEnabled(session.user.organizationId, "store");
  if (!storeEnabled) {
    return <FeatureUnavailablePage feature="store" />;
  }

  return <CartProvider organizationId={session.user.organizationId}>{children}</CartProvider>;
}
