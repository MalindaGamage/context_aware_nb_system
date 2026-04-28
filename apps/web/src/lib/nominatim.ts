export type NominatimResult = {
  lat: number;
  lng: number;
  displayName: string;
};

export async function geocodeAddress(query: string): Promise<NominatimResult | null> {
  const url =
    `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}` +
    `&format=json&limit=1&addressdetails=0`;
  try {
    const response = await fetch(url, { headers: { "Accept-Language": "en" } });
    const data = await response.json();
    if (!Array.isArray(data) || !data[0]) return null;
    return {
      lat: parseFloat(data[0].lat),
      lng: parseFloat(data[0].lon),
      displayName: data[0].display_name ?? query,
    };
  } catch {
    return null;
  }
}

export async function searchNominatimPharmacies(query: string): Promise<
  Array<{ osmId: string; name: string; address: string; lat: number; lon: number }>
> {
  const searchQuery = `${query.trim()} pharmacy Sri Lanka`;
  const url =
    `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchQuery)}` +
    `&format=json&limit=8&addressdetails=0`;
  try {
    const response = await fetch(url, { headers: { "Accept-Language": "en" } });
    const data: any[] = await response.json();
    return data
      .filter((item) => item.lat && item.lon)
      .map((item) => ({
        osmId: `${item.osm_type}:${item.osm_id}`,
        name: item.display_name.split(",")[0] || "Pharmacy",
        address: item.display_name,
        lat: parseFloat(item.lat),
        lon: parseFloat(item.lon),
      }));
  } catch {
    return [];
  }
}
