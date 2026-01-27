"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Minus, Plus, ShoppingCart, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { useCart } from "@/components/sites/cart-context"

export function CartSheet() {
  const { items, isOpen, setIsOpen, updateQuantity, removeItem, subtotal } = useCart()
  const pathname = usePathname()
  
  // Extract slug from pathname (e.g., /sites/london-western/...)
  const slug = pathname?.split("/")[2]

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetContent className="w-full sm:max-w-md flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Your Cart
          </SheetTitle>
        </SheetHeader>
        
        <div className="flex-1 overflow-hidden py-6">
          {items.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground space-y-4">
              <ShoppingCart className="h-16 w-16 opacity-20" />
              <p>Your cart is empty</p>
              <Button variant="outline" onClick={() => setIsOpen(false)}>
                Continue Browsing
              </Button>
            </div>
          ) : (
            <ScrollArea className="h-full pr-4">
              <div className="space-y-6">
                {items.map((item) => (
                  <div key={item.id} className="flex gap-4">
                    <div className="flex-1 space-y-1">
                      <h4 className="font-medium text-sm">{item.name}</h4>
                      {item.description && (
                        <p className="text-xs text-muted-foreground line-clamp-1">
                          {item.description}
                        </p>
                      )}
                      {item.details && Object.keys(item.details).length > 0 && (
                        <div className="text-xs text-muted-foreground mt-1">
                            {Object.entries(item.details).map(([key, value]) => (
                                <span key={key} className="block">
                                    {key}: {value}
                                </span>
                            ))}
                        </div>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="text-sm w-4 text-center">{item.quantity}</span>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 ml-2 text-destructive hover:text-destructive"
                          onClick={() => removeItem(item.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="font-medium text-sm">
                        ${(item.price * item.quantity).toFixed(2)}
                      </span>
                      {item.quantity > 1 && (
                        <span className="text-xs text-muted-foreground">
                          ${item.price.toFixed(2)} each
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>

        {items.length > 0 && (
          <div className="pt-6 space-y-4">
            <Separator />
            <div className="flex items-center justify-between font-medium">
              <span>Subtotal</span>
              <span>${subtotal.toFixed(2)}</span>
            </div>
            <SheetFooter>
                <Button className="w-full" asChild onClick={() => setIsOpen(false)}>
                  <Link href={`/sites/${slug}/checkout`}>
                    Checkout
                  </Link>
                </Button>
            </SheetFooter>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
