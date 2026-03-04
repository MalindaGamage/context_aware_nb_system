import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  fetchDoctors,
  fetchMyTerritories,
  fetchMyVisits,
  fetchNbaNext,
  submitRecommendationFeedback,
  syncBatch,
  type Doctor,
  type NbaRecommendation,
  type SyncConflict,
  type SyncConflictStrategy,
  type SyncFeedbackRequest,
  type Territory,
} from "../api";
import { useAuth } from "../auth/AuthContext";
import { getGoogleMapsApiKey, loadGoogleMaps } from "../lib/googleMaps";
import {
  cacheNbaSnapshot,
  getCachedNbaSnapshot,
  getConflicts,
  getQueuedFeedback,
  getQueuedVisits,
  queueBreakdown,
  queueFeedback,
  removeQueuedItems,
  saveConflicts,
} from "../offline/queue";
import { Button, Card, Field, Pill } from "../ui/components";

type LatLngLiteral = {
  lat: number;
  lng: number;
};

type TravelMode = "DRIVING" | "WALKING" | "BICYCLING" | "TRANSIT";
type StorageMode = "NONE" | "COARSE_LOCAL";

type RouteSummary = {
  distanceText: string;
  durationText: string;
  trafficText: string;
  modeLabel: string;
  sourceLabel: string;
};

type PlaceDetailsSummary = {
  address?: string;
  phone?: string;
  website?: string;
  rating?: number;
  userRatingsTotal?: number;
  openingHours?: string[];
  mapsUrl?: string;
};

type MapDestination = {
  id: string;
  kind: "doctor" | "pharmacy";
  name: string;
  address: string;
  location: LatLngLiteral;
  doctor?: Doctor;
  distanceKm: number | null;
  placeId?: string;
};

type CommuteSummary = {
  id: string;
  name: string;
  kind: "doctor" | "pharmacy";
  distanceText: string;
  durationText: string;
  trafficText: string;
};

const LOCATION_PRIVACY_KEY = "nba_mr_location_privacy";
const STORAGE_MODE_KEY = "nba_mr_location_storage";
const LAST_LOCATION_KEY = "nba_mr_location_snapshot";
const DEFAULT_CENTER: LatLngLiteral = { lat: 6.9271, lng: 79.8612 };

function readBooleanPreference(key: string, defaultValue = false) {
  const value = localStorage.getItem(key);
  if (value === "true") return true;
  if (value === "false") return false;
  return defaultValue;
}

function readStorageMode(): StorageMode {
  const value = localStorage.getItem(STORAGE_MODE_KEY);
  return value === "COARSE_LOCAL" ? "COARSE_LOCAL" : "NONE";
}

function doctorLocation(doctor: Doctor): LatLngLiteral | null {
  if (typeof doctor.lat !== "number" || typeof doctor.lon !== "number") {
    return null;
  }

  return { lat: doctor.lat, lng: doctor.lon };
}

function haversineKm(a: LatLngLiteral, b: LatLngLiteral) {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const first =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const second = 2 * Math.atan2(Math.sqrt(first), Math.sqrt(1 - first));
  return earthRadiusKm * second;
}

function estimateTrafficMultiplier(now = new Date()) {
  const hour = now.getHours();
  if ((hour >= 7 && hour < 10) || (hour >= 16 && hour < 20)) return 1.35;
  if (hour >= 10 && hour < 16) return 1.15;
  return 1.05;
}

function secondsToReadable(totalSeconds: number) {
  const minutes = Math.max(1, Math.round(totalSeconds / 60));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes === 0 ? `${hours} hr` : `${hours} hr ${remainingMinutes} min`;
}

function roundCoordinate(value: number) {
  return Math.round(value * 1000) / 1000;
}

function travelModeLabel(mode: TravelMode) {
  switch (mode) {
    case "BICYCLING":
      return "Bicycling";
    case "TRANSIT":
      return "Transit";
    case "WALKING":
      return "Walking";
    default:
      return "Driving";
  }
}

export default function NbaDashboardPage() {
  const { token, username } = useAuth();
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [pharmacies, setPharmacies] = useState<MapDestination[]>([]);
  const [recommendations, setRecommendations] = useState<NbaRecommendation[]>([]);
  const [doctorCount, setDoctorCount] = useState(0);
  const [visitCount, setVisitCount] = useState(0);
  const [coverageScore, setCoverageScore] = useState(0);
  const [acceptanceRate, setAcceptanceRate] = useState(0);
  const [syncStrategy] = useState<SyncConflictStrategy>("SERVER_WINS");
  const [conflicts, setConflicts] = useState<SyncConflict[]>([]);
  const [status, setStatus] = useState("");
  const [queuedVisits, setQueuedVisits] = useState(0);
  const [queuedFeedback, setQueuedFeedback] = useState(0);
  const [liveTrackingEnabled, setLiveTrackingEnabled] = useState(false);
  const [locationConsent, setLocationConsent] = useState(() => readBooleanPreference(LOCATION_PRIVACY_KEY));
  const [storageMode, setStorageMode] = useState<StorageMode>(() => readStorageMode());
  const [currentPosition, setCurrentPosition] = useState<LatLngLiteral | null>(null);
  const [locationUpdatedAt, setLocationUpdatedAt] = useState<string | null>(null);
  const [locationAccuracy, setLocationAccuracy] = useState<number | null>(null);
  const [travelMode, setTravelMode] = useState<TravelMode>("DRIVING");
  const [pharmacyRadiusKm, setPharmacyRadiusKm] = useState("10");
  const [showTrafficLayer, setShowTrafficLayer] = useState(true);
  const [selectedDestinationId, setSelectedDestinationId] = useState("");
  const [routeSummary, setRouteSummary] = useState<RouteSummary | null>(null);
  const [selectedPlaceDetails, setSelectedPlaceDetails] = useState<PlaceDetailsSummary | null>(null);
  const [commuteSummaries, setCommuteSummaries] = useState<CommuteSummary[]>([]);
  const [mapError, setMapError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchAnchor, setSearchAnchor] = useState<LatLngLiteral | null>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const mapsRef = useRef<any>(null);
  const infoWindowRef = useRef<any>(null);
  const directionsRendererRef = useRef<any>(null);
  const trafficLayerRef = useRef<any>(null);
  const userMarkerRef = useRef<any>(null);
  const userAccuracyCircleRef = useRef<any>(null);
  const markerRegistryRef = useRef<Map<string, any>>(new Map());
  const watchIdRef = useRef<number | null>(null);

  const greetingName = useMemo(() => {
    const normalized = username.replace(/[0-9]/g, "").trim();
    if (!normalized) return "User";
    return normalized.charAt(0).toUpperCase() + normalized.slice(1);
  }, [username]);

  const load = async (authToken: string) => {
    try {
      const myTerritories = await fetchMyTerritories(authToken);
      const territoryId = myTerritories[0]?.id;
      const [doctorPage, visitsPage] = await Promise.all([
        fetchDoctors(authToken, { territoryId, size: 200 }),
        fetchMyVisits(authToken, 0, 100),
      ]);
      setTerritories(myTerritories);
      setDoctors(doctorPage.content);
      setDoctorCount(doctorPage.meta.totalElements);
      setVisitCount(visitsPage.meta.totalElements);
      setCoverageScore(Math.min(100, Math.round((visitsPage.meta.totalElements / Math.max(1, doctorPage.meta.totalElements)) * 100)));
    } catch {
      setStatus("Failed to load dashboard summary");
    }
  };

  const loadRecommendations = async (authToken: string) => {
    try {
      if (!navigator.onLine) {
        const cached = await getCachedNbaSnapshot();
        if (cached) {
          setRecommendations(cached.recommendations);
          setStatus(`Offline snapshot loaded (${new Date(cached.savedAt).toLocaleTimeString()})`);
        }
        return;
      }
      const result = await fetchNbaNext(authToken, 8);
      setRecommendations(result.recommendations);
      await cacheNbaSnapshot(result.recommendations);
    } catch {
      const cached = await getCachedNbaSnapshot();
      if (cached) {
        setRecommendations(cached.recommendations);
        setStatus("Using cached recommendations");
      } else {
        setRecommendations([]);
      }
    }
  };

  const refreshOffline = async () => {
    const [breakdown, pendingConflicts] = await Promise.all([queueBreakdown(), getConflicts()]);
    setQueuedVisits(breakdown.visits);
    setQueuedFeedback(breakdown.feedback);
    setConflicts(pendingConflicts);
  };

  const destinations = useMemo(() => {
    const doctorDestinations = doctors
      .map((doctor) => {
        const location = doctorLocation(doctor);
        if (!location) return null;
        return {
          id: `doctor:${doctor.id}`,
          kind: "doctor" as const,
          name: doctor.fullName,
          address: doctor.notes || doctor.specialty || "Doctor location",
          location,
          doctor,
          distanceKm: currentPosition ? haversineKm(currentPosition, location) : null,
        };
      })
      .filter((item): item is MapDestination => Boolean(item));

    const pharmacyDestinations = pharmacies.map((pharmacy) => ({
      ...pharmacy,
      distanceKm: currentPosition ? haversineKm(currentPosition, pharmacy.location) : null,
    }));

    return [...doctorDestinations, ...pharmacyDestinations].sort((left, right) => {
      const leftDistance = left.distanceKm ?? Number.POSITIVE_INFINITY;
      const rightDistance = right.distanceKm ?? Number.POSITIVE_INFINITY;
      return leftDistance - rightDistance;
    });
  }, [currentPosition, doctors, pharmacies]);

  const selectedDestination = useMemo(
    () => destinations.find((destination) => destination.id === selectedDestinationId) ?? null,
    [destinations, selectedDestinationId]
  );

  const activeTerritory = territories[0] ?? null;

  const regionCenter = useMemo(() => {
    const territoryDoctors = activeTerritory
      ? doctors.filter((doctor) => doctor.territoryId === activeTerritory.id)
      : doctors;
    const positionedDoctors = territoryDoctors.map(doctorLocation).filter((location): location is LatLngLiteral => Boolean(location));
    if (positionedDoctors.length === 0) {
      return currentPosition ?? searchAnchor ?? DEFAULT_CENTER;
    }

    const sum = positionedDoctors.reduce(
      (accumulator, location) => ({
        lat: accumulator.lat + location.lat,
        lng: accumulator.lng + location.lng,
      }),
      { lat: 0, lng: 0 }
    );

    return {
      lat: sum.lat / positionedDoctors.length,
      lng: sum.lng / positionedDoctors.length,
    };
  }, [activeTerritory, currentPosition, doctors, searchAnchor]);

  useEffect(() => {
    if (!token) return;
    void load(token);
    void loadRecommendations(token);
    void refreshOffline();
  }, [token]);

  useEffect(() => {
    localStorage.setItem(LOCATION_PRIVACY_KEY, String(locationConsent));
  }, [locationConsent]);

  useEffect(() => {
    localStorage.setItem(STORAGE_MODE_KEY, storageMode);
    if (storageMode === "NONE") {
      localStorage.removeItem(LAST_LOCATION_KEY);
    }
  }, [storageMode]);

  useEffect(() => {
    const raw = localStorage.getItem(LAST_LOCATION_KEY);
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw) as Partial<{ lat: number; lng: number; updatedAt: string }>;
      if (typeof parsed.lat === "number" && typeof parsed.lng === "number") {
        setCurrentPosition({ lat: parsed.lat, lng: parsed.lng });
      }
      if (typeof parsed.updatedAt === "string") {
        setLocationUpdatedAt(parsed.updatedAt);
      }
    } catch {
      localStorage.removeItem(LAST_LOCATION_KEY);
    }
  }, []);

  useEffect(() => {
    if (selectedDestinationId) {
      const stillExists = destinations.some((destination) => destination.id === selectedDestinationId);
      if (stillExists) return;
    }

    const firstRecommendationWithLocation = recommendations.find((recommendation) =>
      doctors.some((doctor) => doctor.id === recommendation.doctorId && doctorLocation(doctor))
    );

    if (firstRecommendationWithLocation) {
      setSelectedDestinationId(`doctor:${firstRecommendationWithLocation.doctorId}`);
      return;
    }

    if (destinations[0]) {
      setSelectedDestinationId(destinations[0].id);
    }
  }, [destinations, doctors, recommendations, selectedDestinationId]);

  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (!getGoogleMapsApiKey()) {
      setMapError("Add VITE_GOOGLE_MAPS_API_KEY to enable live map, routing, and pharmacy search.");
      return;
    }

    let cancelled = false;

    void loadGoogleMaps()
      .then((maps) => {
        if (cancelled || !mapContainerRef.current) return;
        mapsRef.current = maps;

        if (!mapRef.current) {
          mapRef.current = new maps.Map(mapContainerRef.current, {
            center: currentPosition ?? destinations[0]?.location ?? DEFAULT_CENTER,
            zoom: 12,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: true,
            clickableIcons: true,
          });
          directionsRendererRef.current = new maps.DirectionsRenderer({
            map: mapRef.current,
            suppressMarkers: true,
            polylineOptions: {
              strokeColor: "#0f8b80",
              strokeOpacity: 0.95,
              strokeWeight: 6,
            },
          });
          infoWindowRef.current = new maps.InfoWindow();
          trafficLayerRef.current = new maps.TrafficLayer();
        }

        setMapError("");
      })
      .catch(() => {
        if (!cancelled) {
          setMapError("Google Maps failed to load. Check the key, billing, and domain restrictions.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [currentPosition, destinations]);

  useEffect(() => {
    if (!locationConsent || !liveTrackingEnabled) {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      return;
    }

    if (!navigator.geolocation) {
      setStatus("Geolocation is not available in this browser");
      return;
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const nextPosition = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        const updatedAt = new Date().toISOString();
        setCurrentPosition(nextPosition);
        setLocationAccuracy(position.coords.accuracy);
        setLocationUpdatedAt(updatedAt);
        setStatus("Live MR location updated");

        if (storageMode === "COARSE_LOCAL") {
          localStorage.setItem(
            LAST_LOCATION_KEY,
            JSON.stringify({
              lat: roundCoordinate(nextPosition.lat),
              lng: roundCoordinate(nextPosition.lng),
              updatedAt,
            })
          );
        }
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          setStatus("Location permission denied");
          setLocationConsent(false);
          setLiveTrackingEnabled(false);
          return;
        }
        setStatus("Unable to refresh MR location");
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 30000,
      }
    );

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [liveTrackingEnabled, locationConsent, storageMode]);

  useEffect(() => {
    const maps = mapsRef.current;
    const map = mapRef.current;
    if (!maps || !map) return;

    if (!currentPosition) {
      if (userMarkerRef.current) {
        userMarkerRef.current.setMap(null);
        userMarkerRef.current = null;
      }
      if (userAccuracyCircleRef.current) {
        userAccuracyCircleRef.current.setMap(null);
        userAccuracyCircleRef.current = null;
      }
      return;
    }

    if (!userMarkerRef.current) {
      userMarkerRef.current = new maps.Marker({
        map,
        title: "Medical Rep live location",
        icon: {
          path: maps.SymbolPath.CIRCLE,
          scale: 9,
          fillColor: "#2563eb",
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 3,
        },
        zIndex: 10,
      });
    }

    userMarkerRef.current.setPosition(currentPosition);

    if (!userAccuracyCircleRef.current) {
      userAccuracyCircleRef.current = new maps.Circle({
        map,
        strokeColor: "#2563eb",
        strokeOpacity: 0.5,
        strokeWeight: 1,
        fillColor: "#93c5fd",
        fillOpacity: 0.18,
      });
    }

    userAccuracyCircleRef.current.setCenter(currentPosition);
    userAccuracyCircleRef.current.setRadius(locationAccuracy ?? 0);
  }, [currentPosition, locationAccuracy]);

  useEffect(() => {
    const trafficLayer = trafficLayerRef.current;
    const map = mapRef.current;
    if (!trafficLayer || !map) return;
    trafficLayer.setMap(showTrafficLayer ? map : null);
  }, [showTrafficLayer]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !regionCenter) return;
    if (selectedDestination || currentPosition || searchAnchor) return;
    map.panTo(regionCenter);
  }, [currentPosition, regionCenter, searchAnchor, selectedDestination]);

  useEffect(() => {
    const maps = mapsRef.current;
    const map = mapRef.current;
    const infoWindow = infoWindowRef.current;
    if (!maps || !map || !infoWindow) return;

    const nextIds = new Set(destinations.map((destination) => destination.id));
    markerRegistryRef.current.forEach((marker, id) => {
      if (!nextIds.has(id)) {
        marker.setMap(null);
        markerRegistryRef.current.delete(id);
      }
    });

    destinations.forEach((destination) => {
      const existingMarker = markerRegistryRef.current.get(destination.id);
      if (existingMarker) {
        existingMarker.setPosition(destination.location);
        return;
      }

      const marker = new maps.Marker({
        map,
        position: destination.location,
        title: destination.name,
        icon:
          destination.kind === "doctor"
            ? {
                path: maps.SymbolPath.BACKWARD_CLOSED_ARROW,
                scale: 6,
                fillColor: "#0f8b80",
                fillOpacity: 1,
                strokeColor: "#083344",
                strokeWeight: 1,
              }
            : {
                path: maps.SymbolPath.CIRCLE,
                scale: 7,
                fillColor: "#f59e0b",
                fillOpacity: 1,
                strokeColor: "#7c2d12",
                strokeWeight: 2,
              },
      });

      marker.addListener("click", () => {
        setSelectedDestinationId(destination.id);
        infoWindow.setContent(
          `<div style="min-width:220px"><strong>${destination.name}</strong><div>${destination.address}</div><div style="margin-top:6px">${destination.kind === "doctor" ? "Assigned doctor" : "Nearby pharmacy"}</div></div>`
        );
        infoWindow.open({ anchor: marker, map });
      });

      markerRegistryRef.current.set(destination.id, marker);
    });
  }, [destinations]);

  useEffect(() => {
    const maps = mapsRef.current;
    const map = mapRef.current;
    if (!maps || !map) return;

    const origin = searchAnchor ?? currentPosition ?? destinations[0]?.location;
    if (!origin) return;
    const radiusMeters = Math.max(1000, Math.min(50000, Number(pharmacyRadiusKm || "10") * 1000));

    const service = new maps.places.PlacesService(map);
    service.nearbySearch(
      {
        location: origin,
        radius: radiusMeters,
        type: "pharmacy",
      },
      (results: any[], status: string) => {
        if (status !== maps.places.PlacesServiceStatus.OK || !Array.isArray(results)) {
          setPharmacies([]);
          return;
        }

        const next = results.slice(0, 10).flatMap((place) => {
          const lat = place.geometry?.location?.lat?.();
          const lng = place.geometry?.location?.lng?.();
          if (typeof lat !== "number" || typeof lng !== "number") {
            return [];
          }

          return [
            {
              id: `pharmacy:${place.place_id}`,
              kind: "pharmacy" as const,
              name: place.name || "Pharmacy",
              address: place.vicinity || place.formatted_address || "Google Maps pharmacy listing",
              location: { lat, lng },
              distanceKm: currentPosition ? haversineKm(currentPosition, { lat, lng }) : null,
              placeId: place.place_id,
            },
          ];
        });

        setPharmacies(next);
      }
    );
  }, [currentPosition, destinations, pharmacyRadiusKm, searchAnchor]);

  useEffect(() => {
    const maps = mapsRef.current;
    const map = mapRef.current;
    const renderer = directionsRendererRef.current;
    if (!maps || !map || !renderer) return;

    if (!currentPosition || !selectedDestination) {
      renderer.setDirections({ routes: [] });
      setRouteSummary(null);
      return;
    }

    const directions = new maps.DirectionsService();
    directions.route(
      {
        origin: currentPosition,
        destination: selectedDestination.location,
        travelMode: maps.TravelMode[travelMode],
        drivingOptions:
          travelMode === "DRIVING"
            ? {
                departureTime: new Date(),
                trafficModel: "bestguess",
              }
            : undefined,
      },
      (result: any, status: string) => {
        if (status !== "OK" || !result?.routes?.[0]?.legs?.[0]) {
          renderer.setDirections({ routes: [] });
          setRouteSummary(null);
          return;
        }

        renderer.setDirections(result);
        const leg = result.routes[0].legs[0];
        const baseSeconds = leg.duration?.value ?? Math.max(60, (selectedDestination.distanceKm ?? 1) * 180);
        const trafficSeconds =
          typeof leg.duration_in_traffic?.value === "number"
            ? leg.duration_in_traffic.value
            : travelMode === "DRIVING"
              ? Math.round(baseSeconds * estimateTrafficMultiplier())
              : baseSeconds;

        const bounds = new maps.LatLngBounds();
        bounds.extend(currentPosition);
        bounds.extend(selectedDestination.location);
        map.fitBounds(bounds, 64);

        setRouteSummary({
          distanceText: leg.distance?.text ?? `${(selectedDestination.distanceKm ?? 0).toFixed(1)} km`,
          durationText: leg.duration?.text ?? secondsToReadable(baseSeconds),
          trafficText:
            travelMode === "DRIVING"
              ? secondsToReadable(trafficSeconds)
              : leg.duration?.text ?? secondsToReadable(baseSeconds),
          modeLabel: travelModeLabel(travelMode),
          sourceLabel: leg.duration_in_traffic ? "Google traffic" : travelMode === "DRIVING" ? "Rush-hour heuristic" : "Route duration",
        });
      }
    );
  }, [currentPosition, selectedDestination, travelMode]);

  useEffect(() => {
    const maps = mapsRef.current;
    const map = mapRef.current;
    if (!maps || !map || !selectedDestination) {
      setSelectedPlaceDetails(null);
      return;
    }

    if (selectedDestination.kind === "doctor") {
      setSelectedPlaceDetails({
        address: selectedDestination.address,
        mapsUrl: `https://www.google.com/maps/search/?api=1&query=${selectedDestination.location.lat},${selectedDestination.location.lng}`,
      });
      return;
    }

    if (!selectedDestination.placeId) {
      setSelectedPlaceDetails({ address: selectedDestination.address });
      return;
    }

    const service = new maps.places.PlacesService(map);
    service.getDetails(
      {
        placeId: selectedDestination.placeId,
        fields: [
          "formatted_address",
          "formatted_phone_number",
          "website",
          "rating",
          "user_ratings_total",
          "opening_hours",
          "url",
        ],
      },
      (place: any, status: string) => {
        if (status !== maps.places.PlacesServiceStatus.OK || !place) {
          setSelectedPlaceDetails({ address: selectedDestination.address });
          return;
        }

        setSelectedPlaceDetails({
          address: place.formatted_address || selectedDestination.address,
          phone: place.formatted_phone_number || undefined,
          website: place.website || undefined,
          rating: typeof place.rating === "number" ? place.rating : undefined,
          userRatingsTotal: typeof place.user_ratings_total === "number" ? place.user_ratings_total : undefined,
          openingHours: place.opening_hours?.weekday_text ?? undefined,
          mapsUrl: place.url || undefined,
        });
      }
    );
  }, [selectedDestination]);

  useEffect(() => {
    const maps = mapsRef.current;
    const map = mapRef.current;
    if (!maps || !map || !currentPosition || destinations.length === 0) {
      setCommuteSummaries([]);
      return;
    }

    const service = new maps.DistanceMatrixService();
    const commuteTargets = destinations.slice(0, 8);
    service.getDistanceMatrix(
      {
        origins: [currentPosition],
        destinations: commuteTargets.map((destination) => destination.location),
        travelMode: maps.TravelMode[travelMode],
        unitSystem: maps.UnitSystem.METRIC,
        drivingOptions:
          travelMode === "DRIVING"
            ? {
                departureTime: new Date(),
                trafficModel: "bestguess",
              }
            : undefined,
      },
      (response: any, status: string) => {
        if (status !== "OK" || !response?.rows?.[0]?.elements) {
          setCommuteSummaries([]);
          return;
        }

        const elements = response.rows[0].elements as any[];
        const summaries = commuteTargets
          .map((destination, index) => {
            const element = elements[index];
            if (!element || element.status !== "OK") {
              return null;
            }

            return {
              id: destination.id,
              name: destination.name,
              kind: destination.kind,
              distanceText: element.distance?.text ?? "--",
              durationText: element.duration?.text ?? "--",
              trafficText:
                travelMode === "DRIVING"
                  ? element.duration_in_traffic?.text ?? element.duration?.text ?? "--"
                  : element.duration?.text ?? "--",
            };
          })
          .filter((item): item is CommuteSummary => Boolean(item));

        setCommuteSummaries(summaries);
      }
    );
  }, [currentPosition, destinations, travelMode]);

  const submitFeedback = async (
    recommendation: NbaRecommendation,
    feedback: Omit<SyncFeedbackRequest, "recommendationId" | "clientReferenceId">
  ) => {
    if (!token) return;
    const payload: SyncFeedbackRequest = {
      recommendationId: recommendation.recommendationId,
      clientReferenceId: crypto.randomUUID(),
      ...feedback,
    };
    if (!navigator.onLine) {
      await queueFeedback(payload);
      await refreshOffline();
      setStatus("Offline: feedback queued");
      return;
    }
    try {
      await submitRecommendationFeedback(token, recommendation.recommendationId, payload);
      setStatus("Feedback submitted");
      setAcceptanceRate((value) => Math.min(100, value + 2));
    } catch {
      await queueFeedback(payload);
      await refreshOffline();
      setStatus("Network issue: feedback queued");
    }
  };

  const syncNow = async () => {
    if (!token) return;
    const visits = await getQueuedVisits();
    const feedback = await getQueuedFeedback();
    if (visits.length === 0 && feedback.length === 0) {
      setStatus("No queued data");
      return;
    }
    try {
      const result = await syncBatch(token, { strategy: syncStrategy, visits, feedback });
      const appliedVisitRefs = result.visitResults.filter((item) => item.status === "APPLIED").map((item) => item.clientReferenceId);
      const appliedFeedbackRefs = result.feedbackResults.filter((item) => item.status === "APPLIED").map((item) => item.clientReferenceId);
      await removeQueuedItems(appliedVisitRefs, appliedFeedbackRefs);
      await saveConflicts(result.conflicts);
      await refreshOffline();
      setStatus(result.conflicts.length > 0 ? `Synced with ${result.conflicts.length} conflict(s)` : "Sync completed");
    } catch {
      setStatus("Sync failed");
    }
  };

  const handleLocationSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const maps = mapsRef.current;
    const map = mapRef.current;
    if (!maps || !map || !searchQuery.trim()) return;

    const geocoder = new maps.Geocoder();
    geocoder.geocode({ address: searchQuery.trim() }, (results: any[], status: string) => {
      if (status !== "OK" || !results?.[0]?.geometry?.location) {
        setStatus("Location search failed");
        return;
      }

      const location = {
        lat: results[0].geometry.location.lat(),
        lng: results[0].geometry.location.lng(),
      };
      map.panTo(location);
      map.setZoom(13);
      setSearchAnchor(location);
      setStatus(`Showing map results for ${results[0].formatted_address}`);
    });
  };

  if (!token) return null;

  return (
    <div className="pn-page">
      <div className="pn-header">
        <div>
          <h1>Good Morning, {greetingName}</h1>
          <p>
            Here are your next best actions for today
            {territories[0] ? ` - ${territories[0].name} Territory` : ""}
          </p>
        </div>
        <div className="pn-header-meta">
          <span>{territories[0]?.name ?? "Unassigned"}</span>
          <span>{new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
        </div>
      </div>

      <div className="pn-kpi-grid">
        <Card><div className="pn-kpi"><span>Today's Targets</span><strong>{doctorCount}</strong><em>doctors</em></div></Card>
        <Card><div className="pn-kpi"><span>Completed</span><strong>{visitCount}</strong><em>visits</em></div></Card>
        <Card><div className="pn-kpi"><span>Coverage Score</span><strong>{coverageScore}%</strong><em>this week</em></div></Card>
        <Card><div className="pn-kpi"><span>NBA Acceptance</span><strong>{acceptanceRate || 89}%</strong><em>rate</em></div></Card>
      </div>

      <div className="pn-map-layout">
        <Card className="pn-map-card">
          <div className="pn-map-head">
            <div>
              <h2>Field Map</h2>
              <p className="muted">Live MR GPS, doctor markers, nearby pharmacies, and route guidance.</p>
            </div>
            <div className="chips">
              <Pill>{currentPosition ? "MR location active" : "MR location inactive"}</Pill>
              <Pill>{destinations.length} mapped points</Pill>
              <Pill>{pharmacies.length} pharmacies</Pill>
            </div>
          </div>

          <form className="pn-map-toolbar" onSubmit={handleLocationSearch}>
            <Field label="Search Locations">
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search city, hospital, pharmacy, or address"
              />
            </Field>
            <Field label="Region">
              <input value={activeTerritory?.name ?? "All assigned regions"} readOnly />
            </Field>
            <Field label="Travel Mode">
              <select value={travelMode} onChange={(event) => setTravelMode(event.target.value as TravelMode)}>
                <option value="DRIVING">Driving</option>
                <option value="WALKING">Walking</option>
                <option value="BICYCLING">Bicycling</option>
                <option value="TRANSIT">Transit</option>
              </select>
            </Field>
            <Field label="Pharmacy Radius">
              <select value={pharmacyRadiusKm} onChange={(event) => setPharmacyRadiusKm(event.target.value)}>
                <option value="5">5 km</option>
                <option value="10">10 km</option>
                <option value="20">20 km</option>
                <option value="30">30 km</option>
              </select>
            </Field>
            <label className="pn-check pn-inline-check">
              <input type="checkbox" checked={showTrafficLayer} onChange={(event) => setShowTrafficLayer(event.target.checked)} />
              Traffic
            </label>
            <Button
              type="button"
              className="ghost"
              onClick={() => {
                const map = mapRef.current;
                if (!map) return;
                map.panTo(regionCenter);
                map.setZoom(12);
              }}
            >
              Focus Region
            </Button>
            <Button type="submit">Search</Button>
          </form>

          <div className="pn-map-frame">
            <div className="pn-map-canvas" ref={mapContainerRef} />
            {mapError && <div className="pn-map-overlay">{mapError}</div>}
          </div>

          <div className="pn-map-info-grid">
            <div className="pn-map-info">
              <strong>MR Privacy Controls</strong>
              <label className="pn-check">
                <input
                  type="checkbox"
                  checked={locationConsent}
                  onChange={(event) => {
                    setLocationConsent(event.target.checked);
                    if (!event.target.checked) {
                      setLiveTrackingEnabled(false);
                    }
                  }}
                />
                Allow browser GPS for live MR positioning
              </label>
              <label className="pn-check">
                <input
                  type="checkbox"
                  checked={liveTrackingEnabled}
                  disabled={!locationConsent}
                  onChange={(event) => setLiveTrackingEnabled(event.target.checked)}
                />
                Keep MR location updating while moving
              </label>
              <Field label="Location Storage">
                <select value={storageMode} onChange={(event) => setStorageMode(event.target.value as StorageMode)}>
                  <option value="NONE">Do not persist location</option>
                  <option value="COARSE_LOCAL">Store coarse location only</option>
                </select>
              </Field>
              <p className="muted">
                Precise MR coordinates stay in memory. The optional stored snapshot is rounded to about 100m before it is written locally.
              </p>
              <div className="chips">
                <Pill>{locationAccuracy ? `Accuracy ${Math.round(locationAccuracy)}m` : "Accuracy unavailable"}</Pill>
                <Pill>{locationUpdatedAt ? `Updated ${new Date(locationUpdatedAt).toLocaleTimeString()}` : "No recent fix"}</Pill>
                <Pill>{activeTerritory?.name ?? "All regions"}</Pill>
              </div>
            </div>

            <div className="pn-map-info">
              <strong>Route Summary</strong>
              {selectedDestination ? (
                <>
                  <h3>{selectedDestination.name}</h3>
                  <p className="muted">{selectedDestination.address}</p>
                  <div className="pn-route-metrics">
                    <div>
                      <span>Mode</span>
                      <strong>{routeSummary?.modeLabel ?? travelModeLabel(travelMode)}</strong>
                    </div>
                    <div>
                      <span>Distance</span>
                      <strong>{routeSummary?.distanceText ?? "--"}</strong>
                    </div>
                    <div>
                      <span>Base Time</span>
                      <strong>{routeSummary?.durationText ?? "--"}</strong>
                    </div>
                    <div>
                      <span>Traffic / ETA</span>
                      <strong>{routeSummary?.trafficText ?? "--"}</strong>
                    </div>
                  </div>
                  <p className="muted">{routeSummary?.sourceLabel ?? "Waiting for route calculation"}</p>
                  {selectedPlaceDetails && (
                    <div className="pn-detail-list">
                      <p className="muted">{selectedPlaceDetails.address}</p>
                      {selectedPlaceDetails.phone && <p>Phone: {selectedPlaceDetails.phone}</p>}
                      {selectedPlaceDetails.website && (
                        <p>
                          <a href={selectedPlaceDetails.website} target="_blank" rel="noreferrer">
                            {selectedPlaceDetails.website}
                          </a>
                        </p>
                      )}
                      {typeof selectedPlaceDetails.rating === "number" && (
                        <p>
                          Rating {selectedPlaceDetails.rating.toFixed(1)}
                          {selectedPlaceDetails.userRatingsTotal ? ` (${selectedPlaceDetails.userRatingsTotal} reviews)` : ""}
                        </p>
                      )}
                      {selectedPlaceDetails.mapsUrl && (
                        <p>
                          <a href={selectedPlaceDetails.mapsUrl} target="_blank" rel="noreferrer">
                            Open in Google Maps
                          </a>
                        </p>
                      )}
                      {selectedPlaceDetails.openingHours?.slice(0, 3).map((hours) => (
                        <p key={hours}>{hours}</p>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <p className="muted">Select a doctor or pharmacy with map coordinates to calculate the shortest route.</p>
              )}
            </div>
          </div>
        </Card>

        <Card className="pn-map-sidecard">
          <div className="pn-section-head">
            <h2>Nearby Destinations</h2>
            <Pill>Doctors + pharmacies</Pill>
          </div>
          <div className="pn-map-info">
            <strong>Fastest Commutes</strong>
            <div className="pn-commute-list">
              {commuteSummaries.map((summary) => (
                <div key={summary.id} className="pn-commute-row">
                  <div>
                    <strong>{summary.name}</strong>
                    <p>{summary.kind === "doctor" ? "Doctor" : "Pharmacy"}</p>
                  </div>
                  <div className="pn-destination-meta">
                    <span>{summary.distanceText}</span>
                    <span>{summary.trafficText}</span>
                  </div>
                </div>
              ))}
              {commuteSummaries.length === 0 && <p className="muted">Enable device location to compare travel time to destinations.</p>}
            </div>
          </div>
          <div className="pn-destination-list">
            {destinations.slice(0, 12).map((destination) => (
              <button
                key={destination.id}
                type="button"
                className={`pn-destination-item ${selectedDestinationId === destination.id ? "active" : ""}`}
                onClick={() => setSelectedDestinationId(destination.id)}
              >
                <div>
                  <strong>{destination.name}</strong>
                  <p>{destination.address}</p>
                </div>
                <div className="pn-destination-meta">
                  <Pill>{destination.kind === "doctor" ? "Doctor" : "Pharmacy"}</Pill>
                  <span>{destination.distanceKm !== null ? `${destination.distanceKm.toFixed(1)} km` : "--"}</span>
                </div>
              </button>
            ))}
            {destinations.length === 0 && (
              <p className="muted">
                No mapped doctors or pharmacies yet. Ensure doctor latitude and longitude exist, then add a Google Maps key.
              </p>
            )}
          </div>
        </Card>
      </div>

      <div className="pn-section-head">
        <h2>Next Best Actions</h2>
        <Pill>Ranked by AI scoring</Pill>
      </div>

      <div className="pn-list">
        {recommendations.map((item, index) => (
          <Card key={item.recommendationId} className={`pn-reco ${index === 0 ? "featured" : ""}`}>
            <div className="pn-reco-main">
              <div className="pn-rank">#{index + 1}</div>
              <div>
                <h3>{item.doctorName}</h3>
                <p className="pn-sub">{item.specialty || "General"} <Pill>{item.tier || "Standard"}</Pill></p>
                <p className="pn-reason">{item.explanation}</p>
                <div className="chips">
                  {item.drivers.slice(0, 3).map((driver) => (
                    <Pill key={`${item.recommendationId}-${driver.key}`}>{driver.key}</Pill>
                  ))}
                </div>
              </div>
            </div>
            <div className="pn-reco-actions">
              <div className="pn-score">
                <strong>{Math.round(item.score)}</strong>
                <span>NBA Score</span>
              </div>
              <div className="row-actions">
                <Button onClick={() => void submitFeedback(item, { status: "DONE", reason: "Accepted action" })}>Accept</Button>
                <Button
                  className="ghost"
                  onClick={() =>
                    void submitFeedback(item, {
                      status: "RESCHEDULED",
                      reason: "Deferred for later",
                      rescheduledTo: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                    })
                  }
                >
                  Later
                </Button>
                <Button className="ghost" onClick={() => void submitFeedback(item, { status: "SKIPPED", reason: "Skipped in field" })}>Skip</Button>
                <Button
                  className="ghost"
                  onClick={() => setSelectedDestinationId(`doctor:${item.doctorId}`)}
                  disabled={!doctors.some((doctor) => doctor.id === item.doctorId && doctorLocation(doctor))}
                >
                  Route
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="pn-offline-status">
        <Pill>Queued visits: {queuedVisits}</Pill>
        <Pill>Queued feedback: {queuedFeedback}</Pill>
        <Pill>Conflicts: {conflicts.length}</Pill>
        <Button className="ghost" onClick={syncNow}>Sync Now</Button>
      </div>

      {status && <div className="toast">{status}</div>}
    </div>
  );
}
