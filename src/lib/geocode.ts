interface GeocodingResult {
  latitude: number;
  longitude: number;
}

interface NominatimResponse {
  lat: string;
  lon: string;
  display_name: string;
}

interface GeocodableAddress {
  street?: string | null;
  city?: string | null;
  stateProvince?: string | null;
  postalCode?: string | null;
  country?: string | null;
}

const NOMINATIM_TIMEOUT_MS = 8_000;

/**
 * Geocode a structured address to lat/lng coordinates using the Nominatim API.
 * Nominatim is free, OpenStreetMap-based, and requires no API key.
 *
 * Tries a structured query first (separate street/city/state/postalcode/country
 * params) for better accuracy, then falls back to a free-text query if the
 * structured attempt returns no results.
 *
 * Usage policy: max 1 request/sec, proper User-Agent required.
 * This should only be called on save (not per page view).
 */
export async function geocodeAddress(address: GeocodableAddress): Promise<GeocodingResult | null> {
  const hasStructuredFields =
    address.street || address.city || address.stateProvince || address.postalCode;

  if (hasStructuredFields) {
    const structured = await nominatimStructuredSearch(address);
    if (structured) return structured;
  }

  return nominatimFreeTextSearch(address);
}

async function nominatimStructuredSearch(
  address: GeocodableAddress
): Promise<GeocodingResult | null> {
  const url = new URL("https://nominatim.openstreetmap.org/search");

  if (address.street) url.searchParams.set("street", address.street);
  if (address.city) url.searchParams.set("city", address.city);
  if (address.stateProvince) url.searchParams.set("state", address.stateProvince);
  if (address.postalCode) url.searchParams.set("postalcode", address.postalCode);
  if (address.country) url.searchParams.set("country", address.country);

  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");
  url.searchParams.set("addressdetails", "0");

  return fetchNominatim(url);
}

async function nominatimFreeTextSearch(
  address: GeocodableAddress
): Promise<GeocodingResult | null> {
  const parts = [
    address.street,
    address.city,
    address.stateProvince,
    address.postalCode,
    address.country,
  ].filter(Boolean);

  if (parts.length === 0) return null;

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", parts.join(", "));
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");
  url.searchParams.set("addressdetails", "0");

  return fetchNominatim(url);
}

async function fetchNominatim(url: URL): Promise<GeocodingResult | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), NOMINATIM_TIMEOUT_MS);

  try {
    const response = await fetch(url.toString(), {
      headers: {
        "User-Agent": "Uplifter/1.0 (https://uplifter.app)",
        Accept: "application/json",
      },
      signal: controller.signal,
    });

    if (!response.ok) return null;

    const results: NominatimResponse[] = await response.json();
    if (results.length === 0) return null;

    return {
      latitude: parseFloat(results[0].lat),
      longitude: parseFloat(results[0].lon),
    };
  } catch (error) {
    console.error("Geocoding failed:", error);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Check whether address fields have meaningfully changed and re-geocoding is needed.
 */
export function hasAddressChanged(
  current: {
    street?: string | null;
    city?: string | null;
    stateProvince?: string | null;
    postalCode?: string | null;
    country?: string | null;
  },
  previous: {
    street?: string | null;
    city?: string | null;
    stateProvince?: string | null;
    postalCode?: string | null;
    country?: string | null;
  }
): boolean {
  const normalize = (v: string | null | undefined) => (v ?? "").trim().toLowerCase();
  return (
    normalize(current.street) !== normalize(previous.street) ||
    normalize(current.city) !== normalize(previous.city) ||
    normalize(current.stateProvince) !== normalize(previous.stateProvince) ||
    normalize(current.postalCode) !== normalize(previous.postalCode) ||
    normalize(current.country) !== normalize(previous.country)
  );
}
