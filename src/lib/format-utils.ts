const priceFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export function formatPrice(price: number | string | null | undefined): string {
  if (price === null || price === undefined) return "Free";
  const numPrice = typeof price === "string" ? parseFloat(price) : price;
  if (!Number.isFinite(numPrice) || numPrice === 0) return "Free";
  return priceFormatter.format(numPrice);
}
