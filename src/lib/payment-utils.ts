export interface PaymentMethodDisplay {
  type: string;
  brand: string | null;
}

export function getMethodLabel(method: PaymentMethodDisplay): string {
  if (method.type === "googlepay" || method.type === "paywithgoogle") return "Google Pay";
  if (method.type === "applepay") return "Apple Pay";
  if (method.type === "ach") return "Bank Account (ACH)";
  if (method.type === "sepadirectdebit") return "Bank Account (SEPA)";
  if (method.type === "directdebit_GB") return "Bank Account (Direct Debit)";
  if (method.brand) return formatCardBrand(method.brand);
  if (method.type === "scheme") return "Card";
  return method.type;
}

export function formatCardBrand(brand: string): string {
  return brand.replace(/_(googlepay|applepay)$/i, "");
}
