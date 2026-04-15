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

export function formatCardBrand(brand: string): string {
  const stripped = brand.replace(/_(googlepay|applepay)$/i, "");
  return PAYMENT_METHOD_LABELS[stripped] ?? stripped;
}
