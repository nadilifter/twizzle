"use client";

import dynamic from "next/dynamic";
import type { LatLngExpression } from "leaflet";

const Map = dynamic(() => import("@/components/ui/map").then((m) => m.Map), {
  ssr: false,
});
const MapTileLayer = dynamic(() => import("@/components/ui/map").then((m) => m.MapTileLayer), {
  ssr: false,
});
const MapMarker = dynamic(() => import("@/components/ui/map").then((m) => m.MapMarker), {
  ssr: false,
});
const MapPopup = dynamic(() => import("@/components/ui/map").then((m) => m.MapPopup), {
  ssr: false,
});
const MapZoomControl = dynamic(() => import("@/components/ui/map").then((m) => m.MapZoomControl), {
  ssr: false,
});

interface LocationMapProps {
  latitude: number;
  longitude: number;
  zoom?: number;
  label?: string;
  sublabel?: string;
  className?: string;
}

export function LocationMap({
  latitude,
  longitude,
  zoom = 15,
  label,
  sublabel,
  className,
}: LocationMapProps) {
  const center: LatLngExpression = [latitude, longitude];

  return (
    <Map center={center} zoom={zoom} className={className}>
      <MapTileLayer />
      <MapZoomControl />
      <MapMarker position={center}>
        {(label || sublabel) && (
          <MapPopup>
            {label && <p className="font-medium text-sm">{label}</p>}
            {sublabel && <p className="text-xs text-muted-foreground mt-1">{sublabel}</p>}
          </MapPopup>
        )}
      </MapMarker>
    </Map>
  );
}

interface MultiLocationMapProps {
  locations: Array<{
    latitude: number;
    longitude: number;
    label?: string;
    sublabel?: string;
  }>;
  zoom?: number;
  className?: string;
}

export function MultiLocationMap({ locations, zoom = 12, className }: MultiLocationMapProps) {
  if (locations.length === 0) return null;

  const avgLat = locations.reduce((sum, l) => sum + l.latitude, 0) / locations.length;
  const avgLng = locations.reduce((sum, l) => sum + l.longitude, 0) / locations.length;
  const center: LatLngExpression = [avgLat, avgLng];

  return (
    <Map center={center} zoom={zoom} className={className}>
      <MapTileLayer />
      <MapZoomControl />
      {locations.map((loc, i) => (
        <MapMarker key={i} position={[loc.latitude, loc.longitude]}>
          {(loc.label || loc.sublabel) && (
            <MapPopup>
              {loc.label && <p className="font-medium text-sm">{loc.label}</p>}
              {loc.sublabel && <p className="text-xs text-muted-foreground mt-1">{loc.sublabel}</p>}
            </MapPopup>
          )}
        </MapMarker>
      ))}
    </Map>
  );
}
