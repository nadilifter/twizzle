"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Trash2 } from "lucide-react";
import { CartItem } from "@/components/sites/cart-context";

interface RemoveItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemToRemove: CartItem | null;
  dependentItems: CartItem[];
  onCancel: () => void;
  onConfirmRemove: () => void;
}

export function RemoveItemDialog({
  open,
  onOpenChange,
  itemToRemove,
  dependentItems,
  onCancel,
  onConfirmRemove,
}: RemoveItemDialogProps) {
  if (!itemToRemove) return null;

  const totalItemsToRemove = 1 + dependentItems.length;

  const formatPrice = (price: number) => {
    return price.toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Remove Required Item?
          </DialogTitle>
          <DialogDescription>
            Removing <strong>{itemToRemove.name}</strong> will also remove the following items that
            require it:
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-3">
          {/* Item being removed */}
          <div className="border rounded-lg p-3 bg-destructive/5 border-destructive/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Trash2 className="h-4 w-4 text-destructive" />
                <div>
                  <p className="font-medium text-sm">{itemToRemove.name}</p>
                  <p className="text-xs text-muted-foreground capitalize">{itemToRemove.type}</p>
                </div>
              </div>
              <span className="text-sm font-medium">
                {formatPrice(itemToRemove.price * itemToRemove.quantity)}
              </span>
            </div>
          </div>

          {/* Dependent items that will also be removed */}
          {dependentItems.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
                Will also be removed ({dependentItems.length}):
              </p>
              {dependentItems.map((item) => (
                <div key={item.id} className="border rounded-lg p-3 bg-muted/50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="font-medium text-sm">{item.name}</p>
                        <p className="text-xs text-muted-foreground capitalize">{item.type}</p>
                      </div>
                    </div>
                    <span className="text-sm font-medium">
                      {formatPrice(item.price * item.quantity)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={onCancel} className="w-full sm:w-auto">
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirmRemove} className="w-full sm:w-auto">
            Remove {totalItemsToRemove} {totalItemsToRemove === 1 ? "Item" : "Items"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
