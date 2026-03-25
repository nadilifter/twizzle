"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Trash2 } from "lucide-react"

interface DeletePaymentMethodButtonProps {
  organizationId: string
  paymentMethodId: string
  label: string
}

export function DeletePaymentMethodButton({
  organizationId,
  paymentMethodId,
  label,
}: DeletePaymentMethodButtonProps) {
  const router = useRouter()
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDelete = async () => {
    if (
      !confirm(
        `Remove payment method ${label}? This will disable it in Adyen and mark it inactive.`
      )
    ) {
      return
    }

    setIsDeleting(true)
    try {
      const res = await fetch(
        `/api/superadmin/organizations/${organizationId}/payment-methods/${paymentMethodId}`,
        { method: "DELETE" }
      )
      const data = await res.json()

      if (res.ok && data.success) {
        alert(data.message || "Payment method removed.")
        router.refresh()
      } else {
        alert(data.error || "Failed to remove payment method.")
      }
    } catch {
      alert("An error occurred while removing the payment method.")
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <Button
      size="sm"
      variant="ghost"
      className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
      onClick={handleDelete}
      disabled={isDeleting}
      title="Remove payment method"
    >
      <Trash2 className="h-3.5 w-3.5" />
      <span className="sr-only">Remove</span>
    </Button>
  )
}
