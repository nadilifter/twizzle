"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

interface OrganizationAddressFormProps {
  organization: {
    street: string | null
    city: string | null
    stateProvince: string | null
    postalCode: string | null
    country: string | null
  }
  onSuccess: (updatedOrg: any) => void
  onCancel?: () => void
}

export function OrganizationAddressForm({
  organization,
  onSuccess,
  onCancel,
}: OrganizationAddressFormProps) {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    street: organization.street || "",
    city: organization.city || "",
    stateProvince: organization.stateProvince || "",
    postalCode: organization.postalCode || "",
    country: organization.country || "US",
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const res = await fetch("/api/organization/details", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      })

      if (!res.ok) {
        throw new Error("Failed to update organization address")
      }

      const updated = await res.json()
      toast.success("Address updated successfully")
      onSuccess(updated)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update address")
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="street">Street Address</Label>
        <Input
          id="street"
          name="street"
          value={formData.street}
          onChange={handleChange}
          required
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="city">City</Label>
          <Input
            id="city"
            name="city"
            value={formData.city}
            onChange={handleChange}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="stateProvince">State/Province</Label>
          <Input
            id="stateProvince"
            name="stateProvince"
            value={formData.stateProvince}
            onChange={handleChange}
            required
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="postalCode">Postal/ZIP Code</Label>
          <Input
            id="postalCode"
            name="postalCode"
            value={formData.postalCode}
            onChange={handleChange}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="country">Country</Label>
          <Input
            id="country"
            name="country"
            value={formData.country}
            onChange={handleChange}
            required
            maxLength={2}
            placeholder="US"
          />
          <p className="text-xs text-muted-foreground">Two-letter country code (e.g., US)</p>
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={loading}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save Address
        </Button>
      </div>
    </form>
  )
}
