"use client";

import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";

export type CartItem = {
  id: string; // Unique ID for the cart item instance
  referenceId: string; // ID of the actual product (programId, eventId, membershipInstanceId, etc.)
  type: "program" | "event" | "item" | "membership" | "competition" | "pass";
  name: string;
  description?: string;
  price: number;
  quantity: number;
  athleteId: string; // ID of the athlete this item is for
  athleteName: string; // Display name of the athlete
  details?: Record<string, any>; // Additional details like size, color, requiredMemberships, etc.
};

export type CartItemsByAthlete = Map<string, { athleteName: string; items: CartItem[] }>;

const REGISTRATION_TYPES: CartItem["type"][] = [
  "program",
  "event",
  "membership",
  "competition",
  "pass",
];

// Shared id so rapid cart actions replace the previous toast instead of stacking
// — see USC-235 (snacks piling up over the marketing site toolbar).
const CART_TOAST_ID = "cart-toast";

export function isRegistrationType(type: CartItem["type"]): boolean {
  return REGISTRATION_TYPES.includes(type);
}

function getCartKey(userId: string | undefined, organizationId?: string): string {
  const orgSuffix = organizationId ? `-${organizationId}` : "";
  if (userId) return `uplifter-cart-${userId}${orgSuffix}`;
  return `uplifter-cart-guest${orgSuffix}`;
}

interface AddItemOptions {
  silent?: boolean;
}

interface CartContextType {
  items: CartItem[];
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  addItem: (item: Omit<CartItem, "id">, options?: AddItemOptions) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  subtotal: number;
  totalItems: number;
  getDependentItems: (id: string) => CartItem[];
  removeItemWithDependents: (id: string) => void;
  getItemsByAthlete: () => CartItemsByAthlete;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

type ProductFulfillmentMap = Record<
  string,
  {
    fulfillmentType: "PICKUP_ONLY" | "DELIVERY_ONLY" | "PICKUP_OR_DELIVERY";
    pickupFacility: {
      id: string;
      name: string;
      street: string | null;
      city: string | null;
      stateProvince: string | null;
      postalCode: string | null;
      operatingHours: { dayOfWeek: number; openTime: string; closeTime: string }[];
    } | null;
  }
>;

function normalizeFulfillment(items: CartItem[], fulfillment: ProductFulfillmentMap): CartItem[] {
  return items.map((item) => {
    if (item.type !== "item") return item;
    if (item.details?.fulfillmentType) return item;
    const entry = fulfillment[item.referenceId];
    if (!entry) return item;
    // Pre-feature cart: stamp from server-authoritative product data.
    // DELIVERY_ONLY resolves to DELIVERY with no facility; everything else resolves to PICKUP
    // (PICKUP_OR_DELIVERY defaults here because the customer never made a choice in the old UI).
    const resolved: "PICKUP" | "DELIVERY" =
      entry.fulfillmentType === "DELIVERY_ONLY" ? "DELIVERY" : "PICKUP";
    const pickupFacility = resolved === "PICKUP" ? entry.pickupFacility : null;
    return {
      ...item,
      details: {
        ...(item.details ?? {}),
        fulfillmentType: resolved,
        pickupFacilityId: pickupFacility?.id ?? null,
        pickupFacility: pickupFacility ?? null,
      },
    };
  });
}

async function validateCartItems(items: CartItem[], organizationId?: string): Promise<CartItem[]> {
  try {
    const payload = items.map((i) => ({ referenceId: i.referenceId, type: i.type }));
    const res = await fetch("/api/cart/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: payload, organizationId }),
    });
    if (!res.ok) return items;
    const { valid, productFulfillment } = (await res.json()) as {
      valid: string[];
      productFulfillment?: ProductFulfillmentMap;
    };
    const validSet = new Set(valid);
    const validItems = items.filter((i) => validSet.has(i.referenceId));
    return productFulfillment ? normalizeFulfillment(validItems, productFulfillment) : validItems;
  } catch {
    return items;
  }
}

interface CartProviderProps {
  children: React.ReactNode;
  organizationId?: string;
}

export function CartProvider({ children, organizationId }: CartProviderProps) {
  const { data: session, status } = useSession();
  const [items, setItems] = useState<CartItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const currentUserIdRef = useRef<string | undefined>(undefined);

  // Load cart from localStorage, scoped to the current user and organization.
  // When a guest logs in, their guest cart migrates to the user-specific key.
  useEffect(() => {
    if (status === "loading") return;

    const userId = session?.user?.id;
    const cartKey = getCartKey(userId, organizationId);

    // Avoid re-loading when the user hasn't actually changed
    if (isInitialized && currentUserIdRef.current === userId) return;
    currentUserIdRef.current = userId;

    let parsed: CartItem[] = [];

    const saved = localStorage.getItem(cartKey);
    if (saved) {
      try {
        parsed = JSON.parse(saved);
      } catch {
        // corrupt data — start fresh
      }
    }

    // One-time migration from the legacy global "uplifter-cart" key
    const legacyCart = localStorage.getItem("uplifter-cart");
    if (legacyCart) {
      try {
        const legacyItems: CartItem[] = JSON.parse(legacyCart);
        if (legacyItems.length > 0 && parsed.length === 0) {
          parsed = legacyItems;
        }
      } catch {
        // ignore
      }
      localStorage.removeItem("uplifter-cart");
    }

    // Migrate guest cart when a user logs in
    if (userId) {
      const guestKey = getCartKey(undefined, organizationId);
      const guestCart = localStorage.getItem(guestKey);
      if (guestCart) {
        try {
          const guestItems: CartItem[] = JSON.parse(guestCart);
          if (guestItems.length > 0) {
            // Merge: add guest items that aren't already in the user's cart
            const existingKeys = new Set(
              parsed.map((i) => `${i.referenceId}|${i.athleteId}|${JSON.stringify(i.details)}`)
            );
            for (const gi of guestItems) {
              const key = `${gi.referenceId}|${gi.athleteId}|${JSON.stringify(gi.details)}`;
              if (!existingKeys.has(key)) {
                parsed.push(gi);
              }
            }
          }
        } catch {
          // ignore corrupt guest data
        }
        localStorage.removeItem(guestKey);
      }
    }

    setItems(parsed);
    setIsInitialized(true);

    // Validate cart items against the server and remove any that reference deleted entities.
    // Also normalizes legacy item-type entries (pre-fulfillment-feature) with server-authoritative
    // fulfillmentType + pickupFacility so downstream consumers don't need to branch on absence.
    if (parsed.length > 0) {
      const snapshot = parsed;
      validateCartItems(snapshot, organizationId).then((validItems) => {
        const changed =
          validItems.length !== snapshot.length || validItems.some((v, i) => v !== snapshot[i]);
        if (changed) {
          setItems(validItems);
        }
      });
    }
  }, [session?.user?.id, status, isInitialized, organizationId]);

  // Save to localStorage on change, using the user+org-scoped key
  useEffect(() => {
    if (!isInitialized) return;
    const cartKey = getCartKey(currentUserIdRef.current, organizationId);
    localStorage.setItem(cartKey, JSON.stringify(items));
  }, [items, isInitialized, organizationId]);

  const addItem = (item: Omit<CartItem, "id">, options?: AddItemOptions) => {
    const registration = isRegistrationType(item.type);
    const normalizedItem = registration ? { ...item, quantity: 1 } : item;
    const silent = options?.silent ?? false;

    setItems((prev) => {
      const existingItemIndex = prev.findIndex(
        (i) =>
          i.referenceId === normalizedItem.referenceId &&
          i.athleteId === normalizedItem.athleteId &&
          JSON.stringify(i.details) === JSON.stringify(normalizedItem.details)
      );

      if (existingItemIndex > -1) {
        if (registration) {
          if (!silent) toast.info("This is already in your cart", { id: CART_TOAST_ID });
          return prev;
        }
        const newItems = [...prev];
        const existing = newItems[existingItemIndex];
        const cap: number | null = existing.details?.currentInventory ?? null;
        const newQty = existing.quantity + normalizedItem.quantity;
        if (cap !== null && newQty > cap) {
          if (!silent) toast.error(`Only ${cap} available in stock`, { id: CART_TOAST_ID });
          return prev;
        }
        newItems[existingItemIndex].quantity = newQty;
        if (!silent) toast.success("Item quantity updated in cart", { id: CART_TOAST_ID });
        return newItems;
      }

      if (!silent) toast.success("Item added to cart", { id: CART_TOAST_ID });
      return [...prev, { ...normalizedItem, id: Math.random().toString(36).substring(2, 9) }];
    });
    if (!silent) setIsOpen(true);
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
    toast.success("Item removed from cart", { id: CART_TOAST_ID });
  };

  const updateQuantity = (id: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(id);
      return;
    }
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const cap: number | null = item.details?.currentInventory ?? null;
        const capped = cap !== null ? Math.min(quantity, cap) : quantity;
        return { ...item, quantity: capped };
      })
    );
  };

  const clearCart = useCallback(() => {
    setItems([]);
    const cartKey = getCartKey(currentUserIdRef.current, organizationId);
    localStorage.removeItem(cartKey);
  }, [organizationId]);

  // Find items that depend on the given item (e.g., programs that require a membership)
  const getDependentItems = (id: string): CartItem[] => {
    const itemToCheck = items.find((item) => item.id === id);
    if (!itemToCheck) return [];

    // If removing a membership, find programs that require it
    if (itemToCheck.type === "membership") {
      const membershipReferenceId = itemToCheck.referenceId;
      return items.filter(
        (item) =>
          item.type === "program" &&
          item.details?.requiredMemberships?.includes(membershipReferenceId)
      );
    }

    return [];
  };

  // Remove an item and all items that depend on it
  const removeItemWithDependents = (id: string) => {
    const dependents = getDependentItems(id);
    const idsToRemove = new Set([id, ...dependents.map((d) => d.id)]);

    setItems((prev) => prev.filter((item) => !idsToRemove.has(item.id)));

    const count = idsToRemove.size;
    if (count > 1) {
      toast.success(`${count} items removed from cart`, { id: CART_TOAST_ID });
    } else {
      toast.success("Item removed from cart", { id: CART_TOAST_ID });
    }
  };

  const getItemsByAthlete = (): CartItemsByAthlete => {
    const grouped = new Map<string, { athleteName: string; items: CartItem[] }>();
    for (const item of items) {
      const key = item.athleteId;
      if (!grouped.has(key)) {
        grouped.set(key, { athleteName: item.athleteName, items: [] });
      }
      grouped.get(key)!.items.push(item);
    }
    return grouped;
  };

  const subtotal = items.reduce((total, item) => total + item.price * item.quantity, 0);
  const totalItems = items.reduce((total, item) => total + item.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        items,
        isOpen,
        setIsOpen,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        subtotal,
        totalItems,
        getDependentItems,
        removeItemWithDependents,
        getItemsByAthlete,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}
