interface GeocodingResult {
  latitude: number
  longitude: number
}

interface NominatimResponse {
  lat: string
  lon: string
  display_name: string
}

/**
 * Geocode a structured address to lat/lng coordinates using the Nominatim API.
 * Nominatim is free, OpenStreetMap-based, and requires no API key.
 *
 * Usage policy: max 1 request/sec, proper User-Agent required.
 * This should only be called on save (not per page view).
 */
export async function geocodeAddress(address: {
  street?: string | null
  city?: string | null
  stateProvince?: string | null
  postalCode?: string | null
  country?: string | null
}): Promise<GeocodingResult | null> {
  const parts = [
    address.street,
    address.city,
    address.stateProvince,
    address.postalCode,
    address.country,
  ].filter(Boolean)

  if (parts.length === 0) return null

  const query = parts.join(", ")
  const url = new URL("https://nominatim.openstreetmap.org/search")
  url.searchParams.set("q", query)
  url.searchParams.set("format", "json")
  url.searchParams.set("limit", "1")
  url.searchParams.set("addressdetails", "0")

  try {
    const response = await fetch(url.toString(), {
      headers: {
        "User-Agent": "Uplifter/1.0 (https://uplifterinc.com)",
        Accept: "application/json",
      },
    })

    if (!response.ok) return null

    const results: NominatimResponse[] = await response.json()
    if (results.length === 0) return null

    return {
      latitude: parseFloat(results[0].lat),
      longitude: parseFloat(results[0].lon),
    }
  } catch (error) {
    console.error("Geocoding failed:", error)
    return null
  }
}

/**
 * Check whether address fields have meaningfully changed and re-geocoding is needed.
 */
export function hasAddressChanged(
  current: {
    street?: string | null
    city?: string | null
    stateProvince?: string | null
    postalCode?: string | null
    country?: string | null
  },
  previous: {
    street?: string | null
    city?: string | null
    stateProvince?: string | null
    postalCode?: string | null
    country?: string | null
  }
): boolean {
  const normalize = (v: string | null | undefined) => (v ?? "").trim().toLowerCase()
  return (
    normalize(current.street) !== normalize(previous.street) ||
    normalize(current.city) !== normalize(previous.city) ||
    normalize(current.stateProvince) !== normalize(previous.stateProvince) ||
    normalize(current.postalCode) !== normalize(previous.postalCode) ||
    normalize(current.country) !== normalize(previous.country)
  )
}
