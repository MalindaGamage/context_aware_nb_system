type OsrmProfile = "driving" | "walking" | "cycling";

export type OsrmRoute = {
  distanceMeters: number;
  durationSeconds: number;
  geometry: { type: "LineString"; coordinates: [number, number][] };
};

export async function fetchOsrmRoute(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
  profile: OsrmProfile
): Promise<OsrmRoute | null> {
  const url =
    `https://router.project-osrm.org/route/v1/${profile}/` +
    `${origin.lng},${origin.lat};${destination.lng},${destination.lat}` +
    `?overview=full&geometries=geojson`;
  try {
    const response = await fetch(url);
    const data = await response.json();
    if (data.code !== "Ok" || !data.routes?.[0]) return null;
    const route = data.routes[0];
    return {
      distanceMeters: route.distance,
      durationSeconds: route.duration,
      geometry: route.geometry,
    };
  } catch {
    return null;
  }
}

export function travelModeToOsrmProfile(mode: string): OsrmProfile {
  switch (mode) {
    case "WALKING":
      return "walking";
    case "BICYCLING":
      return "cycling";
    default:
      return "driving";
  }
}
