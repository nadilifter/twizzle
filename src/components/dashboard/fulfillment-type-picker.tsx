"use client";

import Link from "next/link";
import { AlertCircle, MapPin, Truck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { COMING_SOON_BADGE_CLASS } from "@/app/dashboard/reports/report-definitions";
import { cn } from "@/lib/utils";

export type FulfillmentType = "PICKUP_ONLY" | "DELIVERY_ONLY" | "PICKUP_OR_DELIVERY";

interface FacilityOption {
  id: string;
  name: string;
  city: string | null;
  stateProvince: string | null;
  isDefault: boolean;
}

interface FulfillmentTypePickerProps {
  value: FulfillmentType;
  onChange: (value: FulfillmentType) => void;
  pickupFacilityId: string | null;
  onPickupFacilityChange: (id: string | null) => void;
  facilities: FacilityOption[];
  isLoadingFacilities?: boolean;
}

const DEFAULT_SENTINEL = "__default__";

export function FulfillmentTypePicker({
  value,
  onChange,
  pickupFacilityId,
  onPickupFacilityChange,
  facilities,
  isLoadingFacilities = false,
}: FulfillmentTypePickerProps) {
  const hasMultipleFacilities = facilities.length > 1;
  const hasNoFacilities = !isLoadingFacilities && facilities.length === 0;
  const showsFacilityPicker = value === "PICKUP_ONLY" && hasMultipleFacilities;
  const showsFacilityWarning = value === "PICKUP_ONLY" && hasNoFacilities;

  return (
    <div className="space-y-3">
      <Label className="text-base font-medium flex items-center gap-2">
        <Truck className="h-4 w-4 text-muted-foreground" />
        Fulfilment Type
      </Label>
      <RadioGroup
        value={value}
        onValueChange={(v) => onChange(v as FulfillmentType)}
        className="grid gap-2"
      >
        <label
          className={cn(
            "flex items-center gap-3 rounded-lg border p-3 cursor-pointer hover:bg-accent/50 transition-colors",
            value === "PICKUP_ONLY" && "border-primary bg-primary/5"
          )}
        >
          <RadioGroupItem value="PICKUP_ONLY" />
          <div className="flex-1">
            <p className="font-medium text-sm">Pickup Only</p>
            <p className="text-xs text-muted-foreground">
              Customer collects the order from your facility
            </p>
          </div>
        </label>

        <label
          className="flex items-center gap-3 rounded-lg border p-3 opacity-60 cursor-not-allowed"
          aria-disabled
        >
          <RadioGroupItem value="DELIVERY_ONLY" disabled />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <p className="font-medium text-sm">Delivery Only</p>
              <Badge variant="outline" className={COMING_SOON_BADGE_CLASS}>
                Coming Soon
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Ship the order to the customer&apos;s address
            </p>
          </div>
        </label>

        <label
          className="flex items-center gap-3 rounded-lg border p-3 opacity-60 cursor-not-allowed"
          aria-disabled
        >
          <RadioGroupItem value="PICKUP_OR_DELIVERY" disabled />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <p className="font-medium text-sm">Pickup or Delivery</p>
              <Badge variant="outline" className={COMING_SOON_BADGE_CLASS}>
                Coming Soon
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Customer chooses pickup or delivery at checkout
            </p>
          </div>
        </label>
      </RadioGroup>

      {showsFacilityPicker && (
        <div className="space-y-2">
          <Label className="text-sm font-medium flex items-center gap-2">
            <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
            Pickup Facility
          </Label>
          <Select
            value={pickupFacilityId ?? DEFAULT_SENTINEL}
            onValueChange={(v) => onPickupFacilityChange(v === DEFAULT_SENTINEL ? null : v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Use default facility" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={DEFAULT_SENTINEL}>
                <span className="text-muted-foreground">Use organization default</span>
              </SelectItem>
              {facilities.map((facility) => (
                <SelectItem key={facility.id} value={facility.id}>
                  <span className="flex items-center gap-2">
                    <span>{facility.name}</span>
                    {facility.city && (
                      <span className="text-muted-foreground text-xs">
                        — {facility.city}
                        {facility.stateProvince ? `, ${facility.stateProvince}` : ""}
                      </span>
                    )}
                    {facility.isDefault && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        Default
                      </Badge>
                    )}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {showsFacilityWarning && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/50 bg-destructive/5 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" aria-hidden="true" />
          <p>
            No facilities are configured for this organization.{" "}
            <Link
              href="/dashboard/organization/facilities"
              className="underline font-medium hover:text-destructive/80"
            >
              Add a facility
            </Link>{" "}
            before creating pickup products.
          </p>
        </div>
      )}
    </div>
  );
}
