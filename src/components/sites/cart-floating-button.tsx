"use client"

import { ShoppingCart } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useCart } from "@/components/sites/cart-context"
import { Badge } from "@/components/ui/badge"

export function CartFloatingButton() {
  const { setIsOpen, totalItems } = useCart()

  if (totalItems === 0) return null

  return (
    <Button
      onClick={() => setIsOpen(true)}
      className="fixed bottom-8 right-8 h-14 w-14 rounded-full shadow-lg z-50"
      size="icon"
    >
      <ShoppingCart className="h-6 w-6" />
      <Badge 
        className="absolute -top-2 -right-2 h-6 w-6 flex items-center justify-center p-0 rounded-full" 
        variant="destructive"
      >
        {totalItems}
      </Badge>
    </Button>
  )
}
