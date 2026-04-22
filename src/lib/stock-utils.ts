export type StockableVariant = {
  id: string;
  currentInventory: number | null;
  maxInventory: number | null;
};

export type StockableProduct = {
  currentInventory: number | null;
  maxInventory: number | null;
  typeName: string | null;
  variants: StockableVariant[];
};

type StockBadge = {
  label: string;
  variant: "destructive" | "secondary";
};

export type StockStatus = {
  outOfStock: boolean;
  badge: StockBadge | null;
};

export function formatPrice(price: number): string {
  if (price === 0) return "FREE";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(price);
}

/**
 * Computes stock status for a product: whether it's out of stock, and what badge to display.
 *
 * When `selectedVariantId` is provided, status reflects that specific variant.
 * When omitted for a variant product, it shows aggregate status across all variants.
 */
export function getStockStatus(product: StockableProduct, selectedVariantId?: string): StockStatus {
  const hasVariants = product.typeName && product.variants.length > 0;

  if (hasVariants) {
    if (selectedVariantId) {
      const variant = product.variants.find((v) => v.id === selectedVariantId);
      if (!variant) return { outOfStock: false, badge: null };
      if (variant.maxInventory === null && variant.currentInventory === null) {
        return { outOfStock: false, badge: null };
      }
      if (variant.currentInventory !== null && variant.currentInventory <= 0) {
        return { outOfStock: true, badge: { label: "Sold out", variant: "destructive" } };
      }
      if (variant.currentInventory !== null && variant.currentInventory <= 5) {
        return {
          outOfStock: false,
          badge: { label: `Only ${variant.currentInventory} left!`, variant: "destructive" },
        };
      }
      return { outOfStock: false, badge: null };
    }

    const allOutOfStock = product.variants.every(
      (v) => v.currentInventory !== null && v.currentInventory <= 0
    );
    if (allOutOfStock) {
      return { outOfStock: true, badge: { label: "Sold out", variant: "destructive" } };
    }

    const anyTracked = product.variants.some((v) => v.currentInventory !== null);
    if (anyTracked) {
      const totalLeft = product.variants.reduce(
        (sum, v) => sum + Math.max(v.currentInventory ?? 0, 0),
        0
      );
      if (totalLeft <= 5) {
        return { outOfStock: false, badge: { label: `${totalLeft} left`, variant: "secondary" } };
      }
    }

    return { outOfStock: false, badge: null };
  }

  if (product.maxInventory === null && product.currentInventory === null) {
    return { outOfStock: false, badge: null };
  }
  if (product.currentInventory !== null && product.currentInventory <= 0) {
    return { outOfStock: true, badge: { label: "Sold out", variant: "destructive" } };
  }
  if (product.currentInventory !== null && product.currentInventory <= 5) {
    return {
      outOfStock: false,
      badge: { label: `Only ${product.currentInventory} left!`, variant: "destructive" },
    };
  }
  return { outOfStock: false, badge: null };
}
