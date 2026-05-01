import { MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatOperatingHours } from "@/lib/operating-hours";

export type PickupFacilitySummary = {
  id: string;
  name: string;
  street: string | null;
  city: string | null;
  stateProvince: string | null;
  postalCode: string | null;
  operatingHours: {
    dayOfWeek: number;
    openTime: string;
    closeTime: string;
  }[];
};

interface PickupLocationCardProps {
  facility: PickupFacilitySummary;
}

export function PickupLocationCard({ facility }: PickupLocationCardProps) {
  const addressLine = [facility.street, facility.city, facility.stateProvince, facility.postalCode]
    .filter(Boolean)
    .join(", ");

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <MapPin className="h-4 w-4" aria-hidden="true" />
          Pickup Location
        </CardTitle>
        <Badge variant="secondary">In-store pickup</Badge>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="space-y-1">
          <p className="font-medium">{facility.name}</p>
          {addressLine && <p className="text-muted-foreground">{addressLine}</p>}
          <p className="text-muted-foreground">{formatOperatingHours(facility.operatingHours)}</p>
        </div>
        <p className="text-xs text-muted-foreground">
          You&apos;ll receive an email when your order is ready to pick up at the front desk.
        </p>
      </CardContent>
    </Card>
  );
}
