export type OverpassPharmacy = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  address: string;
};

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
    const response = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "data=" + encodeURIComponent(query),
    });
    const data = await response.json();
    const elements: any[] = data?.elements ?? [];
    return elements
      .slice(0, 20)
      .flatMap((element) => {
        const lat = element.lat ?? element.center?.lat;
        const lng = element.lon ?? element.center?.lon;
        if (typeof lat !== "number" || typeof lng !== "number") return [];
        const tags = element.tags ?? {};
        const name = tags.name || "Pharmacy";
        const street = tags["addr:street"]
          ? `${tags["addr:street"]}${tags["addr:housenumber"] ? " " + tags["addr:housenumber"] : ""}`
          : "";
        const city = tags["addr:city"] || tags["addr:town"] || "";
        const address = [street, city].filter(Boolean).join(", ") || "OpenStreetMap pharmacy";
        return [{ id: `osm:${element.type}:${element.id}`, name, lat, lng, address }];
      });
  } catch {
    return [];
  }
}
