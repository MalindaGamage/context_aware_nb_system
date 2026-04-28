export type OverpassPharmacy = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  address: string;
};

// Sri Lanka bounding box: south, west, north, east
const SL_BBOX = "5.5,79.5,10.0,82.0";

function escapeOverpassRegex(raw: string): string {
  return raw.replace(/[.+*?^${}()|[\]\\]/g, "\\$&");
}

function parsePharmacy(element: any): OverpassPharmacy | null {
  const lat = element.lat ?? element.center?.lat;
  const lng = element.lon ?? element.center?.lon;
  if (typeof lat !== "number" || typeof lng !== "number") return null;
  const tags = element.tags ?? {};
  const name = tags.name || "Pharmacy";
  const street = tags["addr:street"]
    ? `${tags["addr:street"]}${tags["addr:housenumber"] ? " " + tags["addr:housenumber"] : ""}`
    : "";
  const city = tags["addr:city"] || tags["addr:town"] || tags["addr:village"] || "";
  const address = [street, city].filter(Boolean).join(", ") || tags["addr:full"] || "Sri Lanka";
  return { id: `osm:${element.type}:${element.id}`, name, lat, lng, address };
}

async function runOverpassQuery(query: string): Promise<OverpassPharmacy[]> {
  const response = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: "data=" + encodeURIComponent(query),
  });
  const data = await response.json();
  return (data?.elements ?? []).flatMap((el: any) => {
    const p = parsePharmacy(el);
    return p ? [p] : [];
  });
}

export async function searchNearbyPharmacies(
  center: { lat: number; lng: number },
  radiusMeters: number
): Promise<OverpassPharmacy[]> {
  const query =
    `[out:json][timeout:15];` +
    `(node["amenity"="pharmacy"](around:${radiusMeters},${center.lat},${center.lng});` +
    `way["amenity"="pharmacy"](around:${radiusMeters},${center.lat},${center.lng}););` +
    `out body center;`;
  try {
    const results = await runOverpassQuery(query);
    return results.slice(0, 20);
  } catch {
    return [];
  }
}

/**
 * Search pharmacies by name within Sri Lanka using Overpass name~ regex.
 * Much more effective than Nominatim for local POI name lookups.
 */
export async function searchPharmaciesByName(query: string): Promise<OverpassPharmacy[]> {
  const safeQuery = escapeOverpassRegex(query.trim());
  if (!safeQuery) return [];

  const overpassQuery =
    `[out:json][timeout:25];` +
    `(node["amenity"="pharmacy"]["name"~"${safeQuery}",i](${SL_BBOX});` +
    `way["amenity"="pharmacy"]["name"~"${safeQuery}",i](${SL_BBOX}););` +
    `out body center;`;
  try {
    const results = await runOverpassQuery(overpassQuery);
    return results.slice(0, 12);
  } catch {
    return [];
  }
}
