"use client"

import React, { createContext, useContext, useEffect, useState } from "react"
import { toast } from "sonner"

export type CartItem = {
  id: string // Unique ID for the cart item instance
  referenceId: string // ID of the actual product (programId, eventId, membershipInstanceId, etc.)
  type: "program" | "event" | "item" | "membership" | "competition"
  name: string
  description?: string
  price: number
  quantity: number
  athleteId: string // ID of the athlete this item is for
  athleteName: string // Display name of the athlete
  details?: Record<string, any> // Additional details like size, color, requiredMemberships, etc.
}

export type CartItemsByAthlete = Map<string, { athleteName: string; items: CartItem[] }>

const REGISTRATION_TYPES: CartItem["type"][] = ["program", "event", "membership", "competition"]

export function isRegistrationType(type: CartItem["type"]): boolean {
  return REGISTRATION_TYPES.includes(type)
}

interface CartContextType {
  items: CartItem[]
  isOpen: boolean
  setIsOpen: (open: boolean) => void
  addItem: (item: Omit<CartItem, "id">) => void
  removeItem: (id: string) => void
  updateQuantity: (id: string, quantity: number) => void
  clearCart: () => void
  subtotal: number
  totalItems: number
  getDependentItems: (id: string) => CartItem[]
  removeItemWithDependents: (id: string) => void
  getItemsByAthlete: () => CartItemsByAthlete
}

const CartContext = createContext<CartContextType | undefined>(undefined)

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [isInitialized, setIsInitialized] = useState(false)

  // Load from local storage on mount
  useEffect(() => {
    const savedCart = localStorage.getItem("uplifter-cart")
    if (savedCart) {
      try {
        setItems(JSON.parse(savedCart))
      } catch (e) {
        console.error("Failed to parse cart from local storage", e)
      }
    }
    setIsInitialized(true)
  }, [])

  // Save to local storage on change
  useEffect(() => {
    if (isInitialized) {
      localStorage.setItem("uplifter-cart", JSON.stringify(items))
    }
  }, [items, isInitialized])

  const addItem = (item: Omit<CartItem, "id">) => {
    const registration = isRegistrationType(item.type)
    const normalizedItem = registration ? { ...item, quantity: 1 } : item

    setItems((prev) => {
      // Check if item already exists with same referenceId, athleteId, and details
      const existingItemIndex = prev.findIndex(
        (i) => i.referenceId === normalizedItem.referenceId && i.athleteId === normalizedItem.athleteId && JSON.stringify(i.details) === JSON.stringify(normalizedItem.details)
      )

      if (existingItemIndex > -1) {
        if (registration) {
          toast.info("This is already in your cart")
          return prev
        }
        // Only increment quantity for products
        const newItems = [...prev]
        newItems[existingItemIndex].quantity += normalizedItem.quantity
        toast.success("Item quantity updated in cart")
        return newItems
      }

      toast.success("Item added to cart")
      return [...prev, { ...normalizedItem, id: Math.random().toString(36).substring(2, 9) }]
    })
    setIsOpen(true)
  }

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id))
    toast.success("Item removed from cart")
  }

  const updateQuantity = (id: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(id)
      return
    }
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, quantity } : item))
    )
  }

  const clearCart = () => {
    setItems([])
    localStorage.removeItem("uplifter-cart")
  }

  // Find items that depend on the given item (e.g., programs that require a membership)
  const getDependentItems = (id: string): CartItem[] => {
    const itemToCheck = items.find((item) => item.id === id)
    if (!itemToCheck) return []

    // If removing a membership, find programs that require it
    if (itemToCheck.type === "membership") {
      const membershipReferenceId = itemToCheck.referenceId
      return items.filter(
        (item) =>
          item.type === "program" &&
          item.details?.requiredMemberships?.includes(membershipReferenceId)
      )
    }

    return []
  }

  // Remove an item and all items that depend on it
  const removeItemWithDependents = (id: string) => {
    const dependents = getDependentItems(id)
    const idsToRemove = new Set([id, ...dependents.map((d) => d.id)])
    
    setItems((prev) => prev.filter((item) => !idsToRemove.has(item.id)))
    
    const count = idsToRemove.size
    if (count > 1) {
      toast.success(`${count} items removed from cart`)
    } else {
      toast.success("Item removed from cart")
    }
  }

  const getItemsByAthlete = (): CartItemsByAthlete => {
    const grouped = new Map<string, { athleteName: string; items: CartItem[] }>()
    for (const item of items) {
      const key = item.athleteId
      if (!grouped.has(key)) {
        grouped.set(key, { athleteName: item.athleteName, items: [] })
      }
      grouped.get(key)!.items.push(item)
    }
    return grouped
  }

  const subtotal = items.reduce((total, item) => total + item.price * item.quantity, 0)
  const totalItems = items.reduce((total, item) => total + item.quantity, 0)

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
  )
}

export function useCart() {
  const context = useContext(CartContext)
  if (context === undefined) {
    throw new Error("useCart must be used within a CartProvider")
  }
  return context
}
