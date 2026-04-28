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

