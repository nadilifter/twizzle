export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  ach: "Bank Account (ACH)",
  scheme: "Card",
  card: "Card",
  visa: "Visa",
  mc: "Mastercard",
  amex: "Amex",
  discover: "Discover",
  diners: "Diners",
  jcb: "JCB",
  googlepay: "Google Pay",
  paywithgoogle: "Google Pay",
  applepay: "Apple Pay",
  paypal: "PayPal",
  sepadirectdebit: "Bank Account (SEPA)",
  directdebit_GB: "Bank Account (Direct Debit)",
};

export interface PaymentMethodDisplay {
  type: string;
  brand: string | null;
}

// Converts Prisma enum types (CARD, BANK) to Adyen-style types (scheme, ach),
// and maps wallet brand strings. Pass-through for already-normalized types.
export function normalizePaymentMethodType(pm: PaymentMethodDisplay): string {
  const brand = pm.brand?.toLowerCase() ?? "";
  if (brand.endsWith("_googlepay") || brand === "googlepay" || brand === "paywithgoogle")
    return "googlepay";
  if (brand.endsWith("_applepay") || brand === "applepay") return "applepay";
  if (pm.type === "BANK") return "ach";
  if (pm.type === "CARD") return "scheme";
  return pm.type;
}

// Returns a human-readable label for a payment method.
// getMethodLabel({ type: "scheme", brand: "amex" }) → "Amex"
// getMethodLabel({ type: "ach", brand: null })      → "Bank Account (ACH)"
// getMethodLabel({ type: "googlepay", brand: null }) → "Google Pay"
export function getMethodLabel(method: PaymentMethodDisplay): string {
  // For generic card types, prefer the specific brand label (e.g. "amex" → "Amex")
  if ((method.type === "scheme" || method.type === "card") && method.brand) {
    return formatCardBrand(method.brand);
  }
  // Use shared map for simple type lookups
  if (PAYMENT_METHOD_LABELS[method.type]) return PAYMENT_METHOD_LABELS[method.type];
  // Brand fallback for card networks (e.g. "mc_googlepay" → "Mastercard")
  if (method.brand) return formatCardBrand(method.brand);
  return method.type;
}

// Strips wallet suffixes from Adyen card brand strings.
// formatCardBrand("mc_googlepay") → "mc"
// formatCardBrand("visa")         → "visa"
export function formatCardBrand(brand: string): string {
  const stripped = brand.replace(/_(googlepay|applepay)$/i, "");
  return PAYMENT_METHOD_LABELS[stripped] ?? stripped;
}

// True for credit/debit card types.
// isCardType({ type: "scheme" }) → true
// isCardType({ type: "ach" })    → false
export function isCardType(method: { type: string }): boolean {
  return method.type === "scheme" || method.type === "card";
}

// True for digital wallet types.
// isWalletType({ type: "applepay" })  → true
// isWalletType({ type: "scheme" })    → false
export function isWalletType(method: { type: string }): boolean {
  return ["googlepay", "applepay", "paywithgoogle"].includes(method.type);
}

// True for bank transfer types.
// isBankType({ type: "ach" })    → true
// isBankType({ type: "scheme" }) → false
export function isBankType(method: { type: string }): boolean {
  return ["ach", "sepadirectdebit", "directdebit_GB", "bankTransfer"].includes(method.type);
}

// Formats expiry as MM/YY. Returns null if either field is missing.
// formatExpiryDate({ expiryMonth: "03", expiryYear: "2030" }) → "03/30"
// formatExpiryDate({ expiryMonth: null, expiryYear: "2030" }) → null
export function formatExpiryDate(pm: {
  expiryMonth?: string | null;
  expiryYear?: string | null;
}): string | null {
  if (!pm.expiryMonth || !pm.expiryYear) return null;
  return `${pm.expiryMonth}/${pm.expiryYear.slice(-2)}`;
}

// True if the card's expiry month/year is in the past. Handles 2-digit years ("30" → 2030).
// isPaymentMethodExpired({ expiryMonth: "03", expiryYear: "2020" }) → true
// isPaymentMethodExpired({ expiryMonth: "03", expiryYear: "2030" }) → false
export function isPaymentMethodExpired(pm: {
  expiryMonth?: string | null;
  expiryYear?: string | null;
}): boolean {
  if (!pm.expiryMonth || !pm.expiryYear) return false;
  const month = parseInt(pm.expiryMonth, 10);
  const rawYear = parseInt(pm.expiryYear, 10);
  if (isNaN(month) || isNaN(rawYear)) return false;
  const year = rawYear < 100 ? 2000 + rawYear : rawYear;
  const now = new Date();
  return (
    year < now.getUTCFullYear() || (year === now.getUTCFullYear() && month < now.getUTCMonth() + 1)
  );
}

// True if the card expires within 1 month (but is not yet expired).
// isPaymentMethodExpiringSoon({ expiryMonth: "05", expiryYear: "2026" }) → true  (if today is April 2026)
// isPaymentMethodExpiringSoon({ expiryMonth: "12", expiryYear: "2026" }) → false
export function isPaymentMethodExpiringSoon(pm: {
  expiryMonth?: string | null;
  expiryYear?: string | null;
}): boolean {
  if (!pm.expiryMonth || !pm.expiryYear) return false;
  if (isPaymentMethodExpired(pm)) return false;
  const month = parseInt(pm.expiryMonth, 10);
  const rawYear = parseInt(pm.expiryYear, 10);
  if (isNaN(month) || isNaN(rawYear)) return false;
  const year = rawYear < 100 ? 2000 + rawYear : rawYear;
  const now = new Date();
  const monthsUntilExpiry = (year - now.getUTCFullYear()) * 12 + (month - (now.getUTCMonth() + 1));
  return monthsUntilExpiry <= 1;
}

// Returns the masked card number or holder name for display. Falls back to "".
// getMethodIdentifier({ lastFour: "1234" })              → "•••• 1234"
// getMethodIdentifier({ lastFour: "****", holderName: "Jane" }) → "Jane"
export function getMethodIdentifier(method: {
  lastFour?: string | null;
  holderName?: string | null;
}): string {
  if (method.lastFour && method.lastFour !== "****") return `•••• ${method.lastFour}`;
  if (method.holderName) return method.holderName;
  return "";
}

// Returns a short human-readable label for use in dialogs, emails, etc.
// getMethodShortLabel({ type: "scheme", brand: "visa", lastFour: "4242" }) → "Visa ending in 4242"
// getMethodShortLabel({ type: "ach", brand: null, lastFour: null })        → "Bank Account (ACH)"
export function getMethodShortLabel(method: {
  type: string;
  brand: string | null;
  lastFour?: string | null;
}): string {
  const label = getMethodLabel(method);
  if (method.lastFour && method.lastFour !== "****") return `${label} ending in ${method.lastFour}`;
  return label;
}
