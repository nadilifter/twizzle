"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { AlertTriangle, CreditCard, Check } from "lucide-react"

interface RequiredMembership {
  id: string
  name: string
  price: number
  billingInterval: string
  earlyAccessCode?: string | null
  group: {
    id: string
    name: string
  }
}

interface MembershipRequirementDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  programName: string
  requiredMemberships: RequiredMembership[]
  onCancel: () => void
  onAddMembership: (membership: RequiredMembership) => void
}

export function MembershipRequirementDialog({
  open,
  onOpenChange,
  programName,
  requiredMemberships,
  onCancel,
  onAddMembership,
}: MembershipRequirementDialogProps) {
  const [selectedMembershipId, setSelectedMembershipId] = useState<string>(
    requiredMemberships.length === 1 ? requiredMemberships[0].id : ""
  )

  const selectedMembership = requiredMemberships.find(m => m.id === selectedMembershipId)
  const isSingleOption = requiredMemberships.length === 1
  
  const formatPrice = (price: number, interval: string) => {
    const numPrice = price
    const formattedPrice = numPrice.toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
    })
    const intervalLabels: Record<string, string> = {
      MONTHLY: "/mo",
      YEARLY: "/yr",
      SESSION: "/session",
    }
    return `${formattedPrice}${intervalLabels[interval] || ""}`
  }

  const handleAddMembership = () => {
    const membership = isSingleOption ? requiredMemberships[0] : selectedMembership
    if (membership) {
      onAddMembership(membership)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Membership Required
          </DialogTitle>
          <DialogDescription>
            {isSingleOption ? (
              <>
                To register for <strong>{programName}</strong>, you need the following membership:
              </>
            ) : (
              <>
                To register for <strong>{programName}</strong>, you need one of the following memberships:
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4">
          {isSingleOption ? (
            // Single membership option - show details directly
            <div className="border rounded-lg p-4 bg-muted/50">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">{requiredMemberships[0].name}</h4>
                  {requiredMemberships[0].group && (
                    <p className="text-sm text-muted-foreground">
                      {requiredMemberships[0].group.name}
                    </p>
                  )}
                </div>
                <Badge variant="secondary" className="text-base">
                  <CreditCard className="h-4 w-4 mr-1" />
                  {formatPrice(requiredMemberships[0].price, requiredMemberships[0].billingInterval)}
                </Badge>
              </div>
            </div>
          ) : (
            // Multiple membership options - show dropdown
            <div className="space-y-4">
              <Select
                value={selectedMembershipId}
                onValueChange={setSelectedMembershipId}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a membership option" />
                </SelectTrigger>
                <SelectContent>
                  {requiredMemberships.map((membership) => (
                    <SelectItem key={membership.id} value={membership.id}>
                      <div className="flex items-center justify-between gap-4">
                        <span>{membership.name}</span>
                        <span className="text-muted-foreground">
                          {formatPrice(membership.price, membership.billingInterval)}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              {selectedMembership && (
                <div className="border rounded-lg p-4 bg-muted/50">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium flex items-center gap-2">
                        <Check className="h-4 w-4 text-green-500" />
                        {selectedMembership.name}
                      </h4>
                      {selectedMembership.group && (
                        <p className="text-sm text-muted-foreground">
                          {selectedMembership.group.name}
                        </p>
                      )}
                    </div>
                    <Badge variant="secondary" className="text-base">
                      <CreditCard className="h-4 w-4 mr-1" />
                      {formatPrice(selectedMembership.price, selectedMembership.billingInterval)}
                    </Badge>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={onCancel} className="w-full sm:w-auto">
            Cancel
          </Button>
          <Button 
            onClick={handleAddMembership} 
            disabled={!isSingleOption && !selectedMembershipId}
            className="w-full sm:w-auto"
          >
            Add Membership to Cart
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
