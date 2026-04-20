"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { parsePhoneNumberFromString } from "libphonenumber-js";
import { COUNTRIES } from "@/lib/location-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhoneInput } from "@/components/ui/phone-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StateProvinceCombobox } from "@/components/ui/state-province-combobox";

interface OrganizationAddressFormProps {
  organization: {
    email?: string | null;
    street: string | null;
    city: string | null;
    stateProvince: string | null;
    postalCode: string | null;
    country: string | null;
    phone?: string | null;
  };
  onSuccess: (updatedOrg: any) => void;
  onCancel?: () => void;
}

export function OrganizationAddressForm({
  organization,
  onSuccess,
  onCancel,
}: OrganizationAddressFormProps) {
  const [loading, setLoading] = useState(false);

  const defaultCountry = (organization.country || "US") as "US" | "CA";

  // Normalize stored phone to E.164 so PhoneInput can parse it correctly
  const initialPhone = (() => {
    const raw = organization.phone || "";
    if (!raw) return "";
    if (raw.startsWith("+")) return raw;
    const parsed = parsePhoneNumberFromString(raw, defaultCountry);
    return parsed?.format("E.164") ?? raw;
  })();

  const [formData, setFormData] = useState({
    email: organization.email || "",
    street: organization.street || "",
    city: organization.city || "",
    stateProvince: organization.stateProvince || "",
    postalCode: organization.postalCode || "",
    country: organization.country || "US",
    phone: initialPhone,
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch("/api/organization/details", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || "Failed to update contact information");
      }

      const updated = await res.json();
      toast.success("Contact information updated successfully");
      onSuccess(updated);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update contact information");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          value={formData.email}
          onChange={handleChange}
          placeholder="contact@yourorg.com"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="phone">Phone Number</Label>
        <PhoneInput
          id="phone"
          defaultCountry={defaultCountry}
          value={formData.phone}
          onChange={(value) => setFormData((prev) => ({ ...prev, phone: value || "" }))}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="street">Street Address</Label>
        <Input id="street" name="street" value={formData.street} onChange={handleChange} required />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="city">City</Label>
          <Input id="city" name="city" value={formData.city} onChange={handleChange} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="stateProvince">
            {formData.country === "CA"
              ? "Province"
              : formData.country === "US"
                ? "State"
                : "State / Province"}
          </Label>
          <StateProvinceCombobox
            country={formData.country}
            value={formData.stateProvince}
            onChange={(val) => setFormData((prev) => ({ ...prev, stateProvince: val }))}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="postalCode">
            {formData.country === "CA"
              ? "Postal Code"
              : formData.country === "US"
                ? "ZIP Code"
                : "Postal/ZIP Code"}
          </Label>
          <Input
            id="postalCode"
            name="postalCode"
            value={formData.postalCode}
            onChange={handleChange}
            placeholder={
              formData.country === "CA" ? "A1A 1A1" : formData.country === "US" ? "12345" : ""
            }
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="country">Country</Label>
          <Select
            value={formData.country}
            onValueChange={(value) =>
              setFormData((prev) => ({
                ...prev,
                country: value,
                stateProvince: prev.country !== value ? "" : prev.stateProvince,
              }))
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Select country" />
            </SelectTrigger>
            <SelectContent>
              {COUNTRIES.map((c) => (
                <SelectItem key={c.code} value={c.code}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
          Save
        </Button>
      </div>
    </form>
  );
}
