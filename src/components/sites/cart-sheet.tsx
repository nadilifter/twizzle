"use client";

import { useState } from "react";
import Link from "next/link";
import { Minus, Plus, ShoppingCart, Trash2, User, Info } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useCart, CartItem, isRegistrationType } from "@/components/sites/cart-context";
import { RemoveItemDialog } from "@/components/sites/remove-item-dialog";

export function CartSheet() {
  const {
    items,
    isOpen,
    setIsOpen,
    updateQuantity,
    removeItem,
    subtotal,
    getDependentItems,
    removeItemWithDependents,
    getItemsByAthlete,
  } = useCart();

  // State for remove confirmation dialog
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
  const [itemToRemove, setItemToRemove] = useState<CartItem | null>(null);
  const [dependentItems, setDependentItems] = useState<CartItem[]>([]);

  const handleRemoveClick = (item: CartItem) => {
    const dependents = getDependentItems(item.id);

    if (dependents.length > 0) {
      // Item has dependents, show confirmation dialog
      setItemToRemove(item);
      setDependentItems(dependents);
      setRemoveDialogOpen(true);
    } else {
      // No dependents, remove directly
      removeItem(item.id);
    }
  };

  const handleConfirmRemove = () => {
    if (itemToRemove) {
      removeItemWithDependents(itemToRemove.id);
    }
    setRemoveDialogOpen(false);
    setItemToRemove(null);
    setDependentItems([]);
  };

  const handleCancelRemove = () => {
    setRemoveDialogOpen(false);
    setItemToRemove(null);
    setDependentItems([]);
  };
  return (
    <>
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
                  {Array.from(getItemsByAthlete().entries()).map(
                    ([athleteId, { athleteName, items: athleteItems }]) => (
                      <div key={athleteId}>
                        {/* Athlete section header */}
                        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border">
                          <div className="flex items-center justify-center h-6 w-6 rounded-full bg-primary/10 text-primary">
                            <User className="h-3.5 w-3.5" />
                          </div>
                          <span className="text-sm font-semibold text-foreground">
                            {athleteName}
                          </span>
                        </div>
                        <div className="space-y-4 pl-2">
                          {athleteItems.map((item) => (
                            <div key={item.id} className="flex gap-4">
                              <div className="flex-1 space-y-1">
                                <h4 className="font-medium text-sm">{item.name}</h4>
                                {item.details?.variantLabel && (
                                  <p className="text-xs text-primary">
                                    {item.details.typeName ? `${item.details.typeName}: ` : ""}
                                    {item.details.variantLabel}
                                  </p>
                                )}
                                {item.description && (
                                  <p className="text-xs text-muted-foreground line-clamp-1">
                                    {item.description}
                                  </p>
                                )}
                                <div className="flex items-center gap-2 mt-2">
                                  {!isRegistrationType(item.type) && (
                                    <>
                                      <Button
                                        variant="outline"
                                        size="icon"
                                        className="h-6 w-6"
                                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                                      >
                                        <Minus className="h-3 w-3" />
                                      </Button>
                                      <span className="text-sm w-4 text-center">
                                        {item.quantity}
                                      </span>
                                      <Button
                                        variant="outline"
                                        size="icon"
                                        className="h-6 w-6"
                                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                      >
                                        <Plus className="h-3 w-3" />
                                      </Button>
                                    </>
                                  )}
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className={`h-6 w-6 text-destructive hover:text-destructive${!isRegistrationType(item.type) ? " ml-2" : ""}`}
                                    onClick={() => handleRemoveClick(item)}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                              <div className="flex flex-col items-end gap-1">
                                <span className="font-medium text-sm">
                                  ${(item.price * item.quantity).toFixed(2)}
                                </span>
                                {!isRegistrationType(item.type) && item.quantity > 1 && (
                                  <span className="text-xs text-muted-foreground">
                                    ${item.price.toFixed(2)} each
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  )}
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
              {items.some((item) => item.type === "program") && (
                <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/50 rounded-md p-2">
                  <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  <span>
                    Some programs may require waivers or medical information during checkout.
                  </span>
                </div>
              )}
              <SheetFooter>
                <Button className="w-full" asChild onClick={() => setIsOpen(false)}>
                  <Link href="/checkout">Checkout</Link>
                </Button>
              </SheetFooter>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Remove item confirmation dialog */}
      <RemoveItemDialog
        open={removeDialogOpen}
        onOpenChange={setRemoveDialogOpen}
        itemToRemove={itemToRemove}
        dependentItems={dependentItems}
        onCancel={handleCancelRemove}
        onConfirmRemove={handleConfirmRemove}
      />
    </>
  );
}
