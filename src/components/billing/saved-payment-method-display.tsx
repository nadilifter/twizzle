/**
 * Compact single payment method display: icon + brand + last4 + expiry.
 * Accepts both user-side API shape (last4, expiry) and org-side shape
 * (lastFour, expiryMonth/Year), and both Prisma enum types (CARD/BANK)
 * and Adyen-style types (scheme/ach/googlepay).
 */
"use client";

import { CreditCard, Landmark, Smartphone } from "lucide-react";
import {
  getMethodLabel,
  isWalletType,
  isBankType,
  normalizePaymentMethodType,
} from "@/lib/payment-utils";

export interface SavedPaymentMethod {
  id: string;
  type: string;
  brand: string | null;
  last4?: string;
  lastFour?: string;
  expiry?: string | null;
  expiryMonth?: string | null;
  expiryYear?: string | null;
  isDefault: boolean;
  createdAt?: string;
}

function formatExpiry(pm: SavedPaymentMethod): string | null {
  if (pm.expiry) return pm.expiry;
  if (pm.expiryMonth && pm.expiryYear) {
    return `${pm.expiryMonth}/${pm.expiryYear.slice(-2)}`;
  }
  return null;
}

function MethodIcon({
  type,
  className = "h-5 w-5 shrink-0",
}: {
  type: string;
  className?: string;
}) {
  if (isWalletType({ type })) return <Smartphone className={className} />;
  if (isBankType({ type })) return <Landmark className={className} />;
  return <CreditCard className={className} />;
}

interface SavedPaymentMethodDisplayProps {
  paymentMethod: SavedPaymentMethod | null | undefined;
}

export function SavedPaymentMethodDisplay({ paymentMethod }: SavedPaymentMethodDisplayProps) {
  if (!paymentMethod) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <CreditCard className="h-5 w-5 shrink-0" />
        <span>No payment method on file</span>
      </div>
    );
  }

  const normalizedType = normalizePaymentMethodType(paymentMethod);
  const label = getMethodLabel({ type: normalizedType, brand: paymentMethod.brand });
  const digits = paymentMethod.last4 ?? paymentMethod.lastFour;
  const expiry = formatExpiry(paymentMethod);

  return (
    <div className="flex items-center gap-3">
      <MethodIcon type={normalizedType} className="h-5 w-5 shrink-0" />
      <div>
        <div className="flex items-center gap-2">
          <span className="font-medium capitalize">{label}</span>
          {digits && digits !== "****" && (
            <span className="text-muted-foreground font-mono text-sm">
              &bull;&bull;&bull;&bull; {digits}
            </span>
          )}
        </div>
        {expiry && <div className="text-sm text-muted-foreground">Exp. {expiry}</div>}
      </div>
    </div>
  );
}
