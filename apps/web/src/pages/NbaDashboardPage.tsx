import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  resetSessionExpiredState,
  capturePharmacyFeedback,
  captureVisitGps,
  createPharmacyVisit,
  createVisit,
  isUnauthorizedError,
  fetchDoctors,
  onSessionExpired,
  fetchMyAssignedProducts,
  fetchMySchedulePreference,
  fetchMyTerritories,
  fetchMyVisits,
  fetchNbaNext,
  fetchPharmacies,
  submitRecommendationFeedback,
  syncBatch,
  updateMySchedulePreference,
  type Doctor,
  type NbaRecommendation,
  type Pharmacy,
  type SyncConflict,
  type SyncConflictStrategy,
  type SyncFeedbackRequest,
  type Territory,
  type UpdateUserSchedulePreferenceRequest,
  type UserProductAssignment,
  type UserSchedulePreference,
} from "../api";
import { useAuth } from "../auth/AuthContext";
import { greetingLine, territoryZoneLabel } from "../lib/greeting";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { fetchOsrmRoute, travelModeToOsrmProfile } from "../lib/osrmRouting";
import { geocodeAddress } from "../lib/nominatim";
import { searchNearbyPharmacies } from "../lib/overpassPharmacy";
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
  pharmacyId?: string;
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

type FeedbackComposer = {
  recommendationId: string;
  status: "DONE" | "SKIPPED" | "RESCHEDULED";
  reason: string;
  rescheduledTo: string;
};

type ScheduleDraft = {
  workdayStart: string;
  workdayEnd: string;
  breakStart: string;
  breakEnd: string;
  maxVisitsPerDay: string;
  baseLocationText: string;
  planningNotes: string;
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

function normalizeTimeInput(value: string | null | undefined) {
  if (!value) return "";
  return value.slice(0, 5);
}

function scheduleToDraft(schedule: UserSchedulePreference): ScheduleDraft {
  return {
    workdayStart: normalizeTimeInput(schedule.workdayStart),
    workdayEnd: normalizeTimeInput(schedule.workdayEnd),
    breakStart: normalizeTimeInput(schedule.breakStart),
    breakEnd: normalizeTimeInput(schedule.breakEnd),
    maxVisitsPerDay: String(schedule.maxVisitsPerDay ?? 8),
    baseLocationText: schedule.baseLocationText ?? "",
    planningNotes: schedule.planningNotes ?? "",
  };
}

function buildScheduleRequest(draft: ScheduleDraft): UpdateUserSchedulePreferenceRequest {
  return {
    workdayStart: draft.workdayStart,
    workdayEnd: draft.workdayEnd,
    breakStart: draft.breakStart || null,
    breakEnd: draft.breakEnd || null,
    maxVisitsPerDay: Number(draft.maxVisitsPerDay || 8),
    baseLocationText: draft.baseLocationText,
    planningNotes: draft.planningNotes,
  };
}

export default function NbaDashboardPage() {
  const { token, username, logout } = useAuth();
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [selectedTerritoryId, setSelectedTerritoryId] = useState("");
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [pharmacies, setPharmacies] = useState<MapDestination[]>([]);
  const [recommendations, setRecommendations] = useState<NbaRecommendation[]>([]);
  const [doctorCount, setDoctorCount] = useState(0);
  const [visitCount, setVisitCount] = useState(0);
  const [coverageScore, setCoverageScore] = useState(0);
  const [acceptanceRate, setAcceptanceRate] = useState(0);
  const [assignedProducts, setAssignedProducts] = useState<UserProductAssignment[]>([]);
  const [pharmacyAccounts, setPharmacyAccounts] = useState<Pharmacy[]>([]);
  const [pharmacyFeedback, setPharmacyFeedback] = useState({
    pharmacyId: "",
    productId: "",
    doctorId: "",
    prescribed: "UNKNOWN",
    stockAvailable: "UNKNOWN",
    notes: "",
  });
  const [schedulePreference, setSchedulePreference] = useState<UserSchedulePreference | null>(null);
  const [scheduleDraft, setScheduleDraft] = useState<ScheduleDraft>({
    workdayStart: "08:30",
    workdayEnd: "17:30",
    breakStart: "",
    breakEnd: "",
    maxVisitsPerDay: "8",
    baseLocationText: "",
    planningNotes: "",
  });
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [syncStrategy, setSyncStrategy] = useState<SyncConflictStrategy>("SERVER_WINS");
  const [conflicts, setConflicts] = useState<SyncConflict[]>([]);
  const [status, setStatus] = useState("");
  const [sessionExpired, setSessionExpired] = useState(false);
  const [queuedVisits, setQueuedVisits] = useState(0);
  const [queuedFeedback, setQueuedFeedback] = useState(0);
  const [feedbackComposer, setFeedbackComposer] = useState<FeedbackComposer | null>(null);
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
  const [visitOutcome, setVisitOutcome] = useState("Met");
  const [visitNotes, setVisitNotes] = useState("");
  const [routeSummary, setRouteSummary] = useState<RouteSummary | null>(null);
  const [selectedPlaceDetails, setSelectedPlaceDetails] = useState<PlaceDetailsSummary | null>(null);
  const [commuteSummaries, setCommuteSummaries] = useState<CommuteSummary[]>([]);
  const [mapError, setMapError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchAnchor, setSearchAnchor] = useState<LatLngLiteral | null>(null);
  const [doctorSearchQuery, setDoctorSearchQuery] = useState("");
  const [now, setNow] = useState(() => new Date());
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const routeLayerRef = useRef<L.Polyline | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const userAccuracyCircleRef = useRef<L.Circle | null>(null);
  const markerRegistryRef = useRef<Map<string, L.Marker>>(new Map());
  const watchIdRef = useRef<number | null>(null);

  const greetingName = useMemo(() => {
    const normalized = username.replace(/[0-9]/g, "").trim();
    if (!normalized) return "User";
    return normalized.charAt(0).toUpperCase() + normalized.slice(1);
  }, [username]);

  const locationZone = useMemo(
    () => territoryZoneLabel(territories.map((territory) => territory.name)),
    [territories]
  );

  const load = async (authToken: string) => {
    try {
      const myTerritories = await fetchMyTerritories(authToken);
      const [doctorPage, visitsPage, schedule, products, pharmacyPage] = await Promise.all([
        fetchDoctors(authToken, { size: 200 }),
        fetchMyVisits(authToken, 0, 100),
        fetchMySchedulePreference(authToken),
        fetchMyAssignedProducts(authToken),
        fetchPharmacies(authToken, { size: 100 }),
      ]);
      setTerritories(myTerritories);
      setSelectedTerritoryId((current) =>
        current && myTerritories.some((territory) => territory.id === current)
          ? current
          : myTerritories[0]?.id ?? ""
      );
      setDoctors(doctorPage.content);
      setDoctorCount(doctorPage.meta.totalElements);
      setVisitCount(visitsPage.meta.totalElements);
      setAssignedProducts(products);
      setPharmacyAccounts(pharmacyPage.content);
      setSchedulePreference(schedule);
      setScheduleDraft(scheduleToDraft(schedule));
      setCoverageScore(Math.min(100, Math.round((visitsPage.meta.totalElements / Math.max(1, doctorPage.meta.totalElements)) * 100)));
    } catch (error) {
      if (isUnauthorizedError(error)) return;
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
    } catch (error) {
      if (isUnauthorizedError(error)) return;
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

  useEffect(() => {
    const listener = () => {
      setSessionExpired(true);
      setStatus("Session expired. Please re-login to continue.");
      logout();
    };
    onSessionExpired(listener);
    return () => onSessionExpired(null);
  }, [logout]);

  useEffect(() => {
    const intervalId = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(intervalId);
  }, []);

  const activeTerritory = useMemo(
    () => territories.find((territory) => territory.id === selectedTerritoryId) ?? territories[0] ?? null,
    [selectedTerritoryId, territories]
  );

  const mapDoctors = useMemo(
    () => activeTerritory ? doctors.filter((doctor) => doctor.territoryId === activeTerritory.id) : doctors,
    [activeTerritory, doctors]
  );

  const mapPharmacyAccounts = useMemo(
    () => activeTerritory ? pharmacyAccounts.filter((pharmacy) => pharmacy.territoryId === activeTerritory.id) : pharmacyAccounts,
    [activeTerritory, pharmacyAccounts]
  );

  const destinations = useMemo(() => {
    const doctorDestinations = mapDoctors
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

    const discoveredPharmacyDestinations = pharmacies.map((pharmacy) => ({
      ...pharmacy,
      distanceKm: currentPosition ? haversineKm(currentPosition, pharmacy.location) : null,
    }));

    const assignedPharmacyDestinations = mapPharmacyAccounts
      .map((pharmacy) => {
        if (typeof pharmacy.lat !== "number" || typeof pharmacy.lon !== "number") {
          return null;
        }
        const location = { lat: pharmacy.lat, lng: pharmacy.lon };
        return {
          id: `pharmacy-account:${pharmacy.id}`,
          kind: "pharmacy" as const,
          name: pharmacy.name,
          address: pharmacy.address || pharmacy.notes || "Assigned pharmacy",
          location,
          pharmacyId: pharmacy.id,
          placeId: pharmacy.googlePlaceId ?? undefined,
          distanceKm: currentPosition ? haversineKm(currentPosition, location) : null,
        };
      })
      .filter((item): item is MapDestination => Boolean(item));

    const merged = [...doctorDestinations, ...assignedPharmacyDestinations, ...discoveredPharmacyDestinations];
    const uniqueById = new Map<string, MapDestination>();
    merged.forEach((destination) => {
      if (!uniqueById.has(destination.id)) {
        uniqueById.set(destination.id, destination);
      }
    });

    return [...uniqueById.values()].sort((left, right) => {
      const leftDistance = left.distanceKm ?? Number.POSITIVE_INFINITY;
      const rightDistance = right.distanceKm ?? Number.POSITIVE_INFINITY;
      return leftDistance - rightDistance;
    });
  }, [currentPosition, mapDoctors, mapPharmacyAccounts, pharmacies]);

  const filteredDestinations = useMemo(() => {
    if (!doctorSearchQuery.trim()) return destinations;
    const q = doctorSearchQuery.toLowerCase();
    return destinations.filter((d) => d.name.toLowerCase().includes(q));
  }, [destinations, doctorSearchQuery]);

  const selectedDestination = useMemo(
    () => destinations.find((destination) => destination.id === selectedDestinationId) ?? null,
    [destinations, selectedDestinationId]
  );

  const dayPlanStatus = useMemo(() => {
    const start = scheduleDraft.workdayStart || "08:30";
    const end = scheduleDraft.workdayEnd || "17:30";
    const breakStart = scheduleDraft.breakStart;
    const breakEnd = scheduleDraft.breakEnd;
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const toMinutes = (value: string) => {
      const [hours, minutes] = value.split(":").map(Number);
      return hours * 60 + minutes;
    };

    if (!scheduleDraft.workdayStart || !scheduleDraft.workdayEnd) {
      return "Set your workday window to help schedule-aware recommendations";
    }

    if (currentMinutes < toMinutes(start) || currentMinutes > toMinutes(end)) {
      return `Current time is outside your workday window (${start}-${end})`;
    }
    if (breakStart && breakEnd && currentMinutes >= toMinutes(breakStart) && currentMinutes <= toMinutes(breakEnd)) {
      return `Current time overlaps your break window (${breakStart}-${breakEnd})`;
    }

    const maxVisits = Number(scheduleDraft.maxVisitsPerDay || 0);
    if (maxVisits > 0 && visitCount >= maxVisits) {
      return `You have reached your day-plan capacity (${visitCount}/${maxVisits})`;
    }
    if (maxVisits > 0) {
      return `${Math.max(0, maxVisits - visitCount)} visit slots remain in your day plan`;
    }
    return "Your day plan is active";
  }, [scheduleDraft, visitCount]);

  const topRecommendationScheduleDrivers = useMemo(() => {
    const first = recommendations[0];
    if (!first) return [];
    return first.drivers.filter((driver) =>
      ["time_of_day_fit", "mr_capacity_today", "days_since_last_visit"].includes(driver.key)
    );
  }, [recommendations]);

  const recommendedDestinationIdByRecommendation = useMemo(() => {
    const pharmacyById = new Set(mapPharmacyAccounts.map((pharmacy) => pharmacy.id));
    const destinationByPlaceId = new Map<string, string>();
    destinations.forEach((destination) => {
      if (destination.kind === "pharmacy" && destination.placeId) {
        destinationByPlaceId.set(destination.placeId, destination.id);
      }
    });

    const mapping = new Map<string, string | null>();
    recommendations.forEach((recommendation) => {
      const recommendedPharmacyId = recommendation.recommendedPharmacyId;
      if (recommendedPharmacyId) {
        if (pharmacyById.has(recommendedPharmacyId)) {
          const destinationId = `pharmacy-account:${recommendedPharmacyId}`;
          if (destinations.some((destination) => destination.id === destinationId)) {
            mapping.set(recommendation.recommendationId, destinationId);
            return;
          }
        }
        const byPlace = destinationByPlaceId.get(recommendedPharmacyId);
        if (byPlace) {
          mapping.set(recommendation.recommendationId, byPlace);
          return;
        }
      }

      const doctorDestinationId = `doctor:${recommendation.doctorId}`;
      mapping.set(
        recommendation.recommendationId,
        destinations.some((destination) => destination.id === doctorDestinationId) ? doctorDestinationId : null
      );
    });
    return mapping;
  }, [destinations, mapPharmacyAccounts, recommendations]);

  const regionCenter = useMemo(() => {
    const positionedDoctors = mapDoctors.map(doctorLocation).filter((location): location is LatLngLiteral => Boolean(location));
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
  }, [currentPosition, mapDoctors, searchAnchor]);

  useEffect(() => {
    if (!token) return;
    resetSessionExpiredState();
    setSessionExpired(false);
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
    if (!mapContainerRef.current || mapRef.current) return;

    const initialCenter = currentPosition ?? destinations[0]?.location ?? DEFAULT_CENTER;
    const map = L.map(mapContainerRef.current, {
      center: [initialCenter.lat, initialCenter.lng],
      zoom: 12,
      zoomControl: true,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    mapRef.current = map;
    setMapError("");

    return () => {
      map.remove();
      mapRef.current = null;
      markerRegistryRef.current.forEach((marker) => marker.remove());
      markerRegistryRef.current.clear();
      routeLayerRef.current = null;
      userMarkerRef.current = null;
      userAccuracyCircleRef.current = null;
    };
  }, []); // initialize once on mount

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
    const map = mapRef.current;
    if (!map) return;

    if (!currentPosition) {
      userMarkerRef.current?.remove();
      userMarkerRef.current = null;
      userAccuracyCircleRef.current?.remove();
      userAccuracyCircleRef.current = null;
      return;
    }

    const mrIcon = L.divIcon({
      html: `<div style="width:18px;height:18px;background:#2563eb;border:3px solid #fff;border-radius:50%;box-shadow:0 0 0 2px #2563eb;"></div>`,
      className: "",
      iconSize: [18, 18],
      iconAnchor: [9, 9],
    });

    if (!userMarkerRef.current) {
      userMarkerRef.current = L.marker([currentPosition.lat, currentPosition.lng], {
        icon: mrIcon,
        zIndexOffset: 1000,
        title: "Medical Rep live location",
      }).addTo(map);
    } else {
      userMarkerRef.current.setLatLng([currentPosition.lat, currentPosition.lng]);
      userMarkerRef.current.setIcon(mrIcon);
    }

    if (!userAccuracyCircleRef.current) {
      userAccuracyCircleRef.current = L.circle([currentPosition.lat, currentPosition.lng], {
        radius: locationAccuracy ?? 0,
        color: "#2563eb",
        weight: 1,
        opacity: 0.5,
        fillColor: "#93c5fd",
        fillOpacity: 0.18,
      }).addTo(map);
    } else {
      userAccuracyCircleRef.current.setLatLng([currentPosition.lat, currentPosition.lng]);
      userAccuracyCircleRef.current.setRadius(locationAccuracy ?? 0);
    }
  }, [currentPosition, locationAccuracy]);

  // Traffic overlay is not available with free OSM tiles (no-op kept for state compat)

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !regionCenter) return;
    if (selectedDestination || currentPosition || searchAnchor) return;
    map.setView([regionCenter.lat, regionCenter.lng], map.getZoom() ?? 12);
  }, [currentPosition, regionCenter, searchAnchor, selectedDestination]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const nextIds = new Set(destinations.map((destination) => destination.id));
    markerRegistryRef.current.forEach((marker, id) => {
      if (!nextIds.has(id)) {
        marker.remove();
        markerRegistryRef.current.delete(id);
      }
    });

    destinations.forEach((destination) => {
      const existing = markerRegistryRef.current.get(destination.id);
      if (existing) {
        existing.setLatLng([destination.location.lat, destination.location.lng]);
        return;
      }

      const icon =
        destination.kind === "doctor"
          ? L.divIcon({
              html: `<div style="width:0;height:0;border-left:8px solid transparent;border-right:8px solid transparent;border-bottom:16px solid #0f8b80;filter:drop-shadow(0 1px 1px #083344);"></div>`,
              className: "",
              iconSize: [16, 16],
              iconAnchor: [8, 16],
            })
          : L.divIcon({
              html: `<div style="width:14px;height:14px;background:#f59e0b;border:2px solid #7c2d12;border-radius:50%;"></div>`,
              className: "",
              iconSize: [14, 14],
              iconAnchor: [7, 7],
            });

      const marker = L.marker([destination.location.lat, destination.location.lng], {
        icon,
        title: destination.name,
      })
        .addTo(map)
        .bindPopup(
          `<div style="min-width:200px"><strong>${destination.name}</strong>` +
            `<div style="margin-top:4px;font-size:0.85em">${destination.address}</div>` +
            `<div style="margin-top:4px;color:#6b7280">${destination.kind === "doctor" ? "Assigned doctor" : "Nearby pharmacy"}</div></div>`
        )
        .on("click", () => {
          setSelectedDestinationId(destination.id);
        });

      markerRegistryRef.current.set(destination.id, marker);
    });
  }, [destinations]);

  useEffect(() => {
    const origin = searchAnchor ?? currentPosition ?? destinations[0]?.location;
    if (!origin) return;
    const radiusMeters = Math.max(1000, Math.min(50000, Number(pharmacyRadiusKm || "10") * 1000));

    void searchNearbyPharmacies(origin, radiusMeters).then((results) => {
      const next = results.map((pharmacy) => ({
        id: pharmacy.id,
        kind: "pharmacy" as const,
        name: pharmacy.name,
        address: pharmacy.address,
        location: { lat: pharmacy.lat, lng: pharmacy.lng },
        distanceKm: currentPosition ? haversineKm(currentPosition, { lat: pharmacy.lat, lng: pharmacy.lng }) : null,
        placeId: pharmacy.id,
      }));
      setPharmacies(next);
    });
  }, [currentPosition, destinations, pharmacyRadiusKm, searchAnchor]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (routeLayerRef.current) {
      routeLayerRef.current.remove();
      routeLayerRef.current = null;
    }

    if (!currentPosition || !selectedDestination) {
      setRouteSummary(null);
      return;
    }

    let cancelled = false;
    const profile = travelModeToOsrmProfile(travelMode);
    const speedKmH: Record<string, number> = { DRIVING: 40, WALKING: 5, BICYCLING: 15, TRANSIT: 25 };

    void fetchOsrmRoute(currentPosition, selectedDestination.location, profile).then((route) => {
      if (cancelled || !mapRef.current) return;

      if (routeLayerRef.current) {
        routeLayerRef.current.remove();
        routeLayerRef.current = null;
      }

      if (!route) {
        const distKm = haversineKm(currentPosition, selectedDestination.location);
        const durationSec = (distKm / (speedKmH[travelMode] ?? 40)) * 3600;
        const trafficMultiplier = travelMode === "DRIVING" ? estimateTrafficMultiplier() : 1;
        const line = L.polyline(
          [
            [currentPosition.lat, currentPosition.lng],
            [selectedDestination.location.lat, selectedDestination.location.lng],
          ],
          { color: "#0f8b80", weight: 4, opacity: 0.7, dashArray: "8 8" }
        ).addTo(mapRef.current);
        routeLayerRef.current = line;
        mapRef.current.fitBounds(line.getBounds(), { padding: [40, 40] });
        setRouteSummary({
          distanceText: `${distKm.toFixed(1)} km`,
          durationText: secondsToReadable(durationSec),
          trafficText: travelMode === "DRIVING" ? secondsToReadable(durationSec * trafficMultiplier) : secondsToReadable(durationSec),
          modeLabel: travelModeLabel(travelMode),
          sourceLabel: "Straight-line estimate (routing unavailable)",
        });
        return;
      }

      const coords = route.geometry.coordinates.map(([lng, lat]) => [lat, lng] as [number, number]);
      const line = L.polyline(coords, { color: "#0f8b80", weight: 6, opacity: 0.95 }).addTo(mapRef.current);
      routeLayerRef.current = line;
      mapRef.current.fitBounds(line.getBounds(), { padding: [40, 40] });

      const distKm = route.distanceMeters / 1000;
      const durationSec = route.durationSeconds;
      const trafficMultiplier = travelMode === "DRIVING" ? estimateTrafficMultiplier() : 1;
      setRouteSummary({
        distanceText: `${distKm.toFixed(1)} km`,
        durationText: secondsToReadable(durationSec),
        trafficText: travelMode === "DRIVING" ? secondsToReadable(durationSec * trafficMultiplier) : secondsToReadable(durationSec),
        modeLabel: travelModeLabel(travelMode),
        sourceLabel: travelMode === "DRIVING" ? "OSRM route + rush-hour heuristic" : "OSRM route",
      });
    });

    return () => {
      cancelled = true;
    };
  }, [currentPosition, selectedDestination, travelMode]);

  useEffect(() => {
    if (!selectedDestination) {
      setSelectedPlaceDetails(null);
      return;
    }
    const osmUrl =
      `https://www.openstreetmap.org/?mlat=${selectedDestination.location.lat}` +
      `&mlon=${selectedDestination.location.lng}&zoom=17`;
    setSelectedPlaceDetails({
      address: selectedDestination.address,
      mapsUrl: osmUrl,
    });
  }, [selectedDestination]);

  useEffect(() => {
    if (!currentPosition || destinations.length === 0) {
      setCommuteSummaries([]);
      return;
    }

    const speedKmH: Record<string, number> = { DRIVING: 40, WALKING: 5, BICYCLING: 15, TRANSIT: 25 };
    const speed = speedKmH[travelMode] ?? 40;
    const trafficMultiplier = travelMode === "DRIVING" ? estimateTrafficMultiplier() : 1;

    const summaries = destinations
      .slice(0, 8)
      .filter((destination) => destination.distanceKm !== null)
      .map((destination) => {
        const distKm = destination.distanceKm!;
        const durationSec = (distKm / speed) * 3600;
        const trafficSec = durationSec * trafficMultiplier;
        return {
          id: destination.id,
          name: destination.name,
          kind: destination.kind,
          distanceText: `${distKm.toFixed(1)} km`,
          durationText: secondsToReadable(durationSec),
          trafficText: travelMode === "DRIVING" ? secondsToReadable(trafficSec) : secondsToReadable(durationSec),
        };
      });

    setCommuteSummaries(summaries);
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
      setFeedbackComposer(null);
      await loadRecommendations(token);
      await refreshOffline();
    } catch {
      await queueFeedback(payload);
      await refreshOffline();
      setStatus("Network issue: feedback queued");
      setFeedbackComposer(null);
    }
  };

  const openFeedbackComposer = (recommendation: NbaRecommendation, status: FeedbackComposer["status"]) => {
    setFeedbackComposer({
      recommendationId: recommendation.recommendationId,
      status,
      reason: "",
      rescheduledTo: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
    });
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
      const appliedFeedbackRefs = result.feedbackResults
        .filter((item) => item.status === "APPLIED" || item.status === "REJECTED")
        .map((item) => item.clientReferenceId);
      await removeQueuedItems(appliedVisitRefs, appliedFeedbackRefs);
      await saveConflicts(result.conflicts);
      await refreshOffline();
      setStatus(result.conflicts.length > 0 ? `Synced with ${result.conflicts.length} conflict(s)` : "Sync completed");
    } catch {
      setStatus("Sync failed");
    }
  };

  const saveSchedulePreference = async () => {
    if (!token) return;
    if (!scheduleDraft.workdayStart || !scheduleDraft.workdayEnd) {
      setStatus("Workday start and end are required");
      return;
    }

    setSavingSchedule(true);
    try {
      const updated = await updateMySchedulePreference(token, buildScheduleRequest(scheduleDraft));
      setSchedulePreference(updated);
      setScheduleDraft(scheduleToDraft(updated));
      setStatus("Day plan saved");
    } catch {
      setStatus("Failed to save day plan");
    } finally {
      setSavingSchedule(false);
    }
  };

  const submitPharmacyFeedbackLoop = async () => {
    if (!token) return;
    if (!pharmacyFeedback.pharmacyId || !pharmacyFeedback.productId) {
      setStatus("Select a pharmacy and product for pharmacy feedback");
      return;
    }
    try {
      await capturePharmacyFeedback(token, {
        pharmacyId: pharmacyFeedback.pharmacyId,
        productId: pharmacyFeedback.productId,
        doctorId: pharmacyFeedback.doctorId || undefined,
        capturedAt: new Date().toISOString(),
        prescribed:
          pharmacyFeedback.prescribed === "UNKNOWN" ? undefined : pharmacyFeedback.prescribed === "YES",
        stockAvailable:
          pharmacyFeedback.stockAvailable === "UNKNOWN" ? undefined : pharmacyFeedback.stockAvailable === "YES",
        notes: pharmacyFeedback.notes,
      });
      setPharmacyFeedback({
        pharmacyId: "",
        productId: "",
        doctorId: "",
        prescribed: "UNKNOWN",
        stockAvailable: "UNKNOWN",
        notes: "",
      });
      setStatus("Pharmacy feedback captured for MR follow-up");
    } catch {
      setStatus("Failed to capture pharmacy feedback");
    }
  };

  const handleLocationSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const map = mapRef.current;
    if (!map || !searchQuery.trim()) return;

    void geocodeAddress(searchQuery.trim()).then((result) => {
      if (!result) {
        setStatus("Location not found — try a more specific address or city name");
        return;
      }
      map.setView([result.lat, result.lng], 13);
      setSearchAnchor({ lat: result.lat, lng: result.lng });
      setStatus(`Showing results for: ${result.displayName}`);
    });
  };

  const handleSubmitFeedbackComposer = async (recommendation: NbaRecommendation) => {
    if (!feedbackComposer || feedbackComposer.recommendationId !== recommendation.recommendationId) {
      return;
    }

    const trimmedReason = feedbackComposer.reason.trim();
    if ((feedbackComposer.status === "SKIPPED" || feedbackComposer.status === "RESCHEDULED") && !trimmedReason) {
      setStatus("Reason is required for skipped or rescheduled feedback");
      return;
    }

    await submitFeedback(recommendation, {
      status: feedbackComposer.status,
      reason: trimmedReason || undefined,
      rescheduledTo:
        feedbackComposer.status === "RESCHEDULED" && feedbackComposer.rescheduledTo
          ? new Date(feedbackComposer.rescheduledTo).toISOString()
          : undefined,
    });
  };

  const markSelectedVisit = async () => {
    if (!token || !selectedDestination) return;
    const outcome = visitOutcome.trim() || (selectedDestination.kind === "doctor" ? "Met" : "Visited");
    const timestamp = new Date().toISOString();
    try {
      if (selectedDestination.kind === "doctor" && selectedDestination.doctor) {
        const visit = await createVisit(token, {
          doctorId: selectedDestination.doctor.id,
          visitTime: timestamp,
          outcome,
          notes: visitNotes || `Marked from Field Map at ${selectedDestination.name}`,
          followUpRequired: false,
          clientReferenceId: `map-doctor-${selectedDestination.doctor.id}-${Date.now()}`,
        });
        if (currentPosition && locationConsent) {
          await captureVisitGps(token, visit.id, {
            lat: currentPosition.lat,
            lon: currentPosition.lng,
            optIn: true,
          });
        }
        setStatus(`Doctor visit marked for ${selectedDestination.name}`);
        setVisitNotes("");
        await load(token);
        return;
      }

      if (selectedDestination.kind === "pharmacy" && selectedDestination.pharmacyId) {
        await createPharmacyVisit(token, {
          pharmacyId: selectedDestination.pharmacyId,
          visitedAt: timestamp,
          outcome,
          notes: visitNotes || `Marked from Field Map at ${selectedDestination.name}`,
          clientReferenceId: `map-pharmacy-${selectedDestination.pharmacyId}-${Date.now()}`,
          lat: currentPosition && locationConsent ? currentPosition.lat : undefined,
          lon: currentPosition && locationConsent ? currentPosition.lng : undefined,
        });
        setStatus(`Pharmacy visit marked for ${selectedDestination.name}`);
        setVisitNotes("");
        return;
      }

      setStatus("Select an assigned doctor or assigned pharmacy to mark a visit");
    } catch {
      setStatus("Failed to mark visit");
    }
  };

  if (!token) return null;

  return (
    <div className="pn-page">
      <div className="pn-header">
        <div>
          <h1>{greetingLine(greetingName, now)}</h1>
          <p>
            Here are your next best actions for today
            {` - ${locationZone}`}
          </p>
        </div>
        <div className="pn-header-meta">
          <span>{locationZone}</span>
          <span>{now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
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
              <p className="muted">Live MR GPS on OpenStreetMap, doctor markers, nearby pharmacies via Overpass, and OSRM route guidance.</p>
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
              <select value={selectedTerritoryId} onChange={(event) => setSelectedTerritoryId(event.target.value)}>
                {territories.length === 0 && <option value="">No assigned regions</option>}
                {territories.map((territory) => (
                  <option key={territory.id} value={territory.id}>
                    {territory.name}
                  </option>
                ))}
              </select>
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
            <label className="pn-check pn-inline-check" title="Traffic overlay not available with free OSM tiles">
              <input type="checkbox" checked={false} disabled />
              Traffic (N/A)
            </label>
            <Button
              type="button"
              className="ghost"
              onClick={() => {
                const map = mapRef.current;
                if (!map) return;
                map.setView([regionCenter.lat, regionCenter.lng], 12);
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
                  <div className="pn-visit-quick-form">
                    <Field label="Visit Outcome">
                      <select value={visitOutcome} onChange={(event) => setVisitOutcome(event.target.value)}>
                        <option value="Met">Met</option>
                        <option value="Visited">Visited</option>
                        <option value="Not Available">Not Available</option>
                        <option value="Follow-up Required">Follow-up Required</option>
                      </select>
                    </Field>
                    <Field label="Visit Notes">
                      <textarea
                        rows={2}
                        value={visitNotes}
                        onChange={(event) => setVisitNotes(event.target.value)}
                        placeholder="What happened during the visit or meeting"
                      />
                    </Field>
                    <Button type="button" onClick={() => void markSelectedVisit()}>
                      {selectedDestination.kind === "doctor" ? "Mark Doctor Visit" : "Mark Pharmacy Visit"}
                    </Button>
                  </div>
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
                            Open in OpenStreetMap
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
          <div className="pn-destination-search">
            <input
              value={doctorSearchQuery}
              onChange={(e) => setDoctorSearchQuery(e.target.value)}
              placeholder="Search doctor or pharmacy name..."
            />
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
            {filteredDestinations.slice(0, 12).map((destination) => (
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
                No mapped doctors or pharmacies yet. Ensure doctor latitude and longitude coordinates exist in the system.
              </p>
            )}
            {destinations.length > 0 && filteredDestinations.length === 0 && (
              <p className="muted">No doctors or pharmacies match "{doctorSearchQuery}".</p>
            )}
          </div>
        </Card>
      </div>

      <div className="pn-plan-layout">
        <Card>
          <div className="pn-section-head">
            <h2>Day Plan</h2>
            <Pill>{schedulePreference?.updatedAt ? `Updated ${new Date(schedulePreference.updatedAt).toLocaleTimeString()}` : "Default plan"}</Pill>
          </div>
          <div className="pn-plan-grid">
            <Field label="Workday Start">
              <input
                type="time"
                value={scheduleDraft.workdayStart}
                onChange={(event) => setScheduleDraft((current) => ({ ...current, workdayStart: event.target.value }))}
              />
            </Field>
            <Field label="Workday End">
              <input
                type="time"
                value={scheduleDraft.workdayEnd}
                onChange={(event) => setScheduleDraft((current) => ({ ...current, workdayEnd: event.target.value }))}
              />
            </Field>
            <Field label="Break Start">
              <input
                type="time"
                value={scheduleDraft.breakStart}
                onChange={(event) => setScheduleDraft((current) => ({ ...current, breakStart: event.target.value }))}
              />
            </Field>
            <Field label="Break End">
              <input
                type="time"
                value={scheduleDraft.breakEnd}
                onChange={(event) => setScheduleDraft((current) => ({ ...current, breakEnd: event.target.value }))}
              />
            </Field>
            <Field label="Max Visits / Day">
              <input
                type="number"
                min={1}
                max={20}
                value={scheduleDraft.maxVisitsPerDay}
                onChange={(event) => setScheduleDraft((current) => ({ ...current, maxVisitsPerDay: event.target.value }))}
              />
            </Field>
            <Field label="Base Location">
              <input
                value={scheduleDraft.baseLocationText}
                onChange={(event) => setScheduleDraft((current) => ({ ...current, baseLocationText: event.target.value }))}
                placeholder="Home base, branch, or city"
              />
            </Field>
            <Field label="Planning Notes">
              <textarea
                value={scheduleDraft.planningNotes}
                onChange={(event) => setScheduleDraft((current) => ({ ...current, planningNotes: event.target.value }))}
                rows={3}
                placeholder="Constraints, meetings, product push, hospital timing"
              />
            </Field>
          </div>
          <div className="pn-plan-summary">
            <div>
              <strong>Current Fit</strong>
              <p className="muted">{dayPlanStatus}</p>
            </div>
            <div className="chips">
              <Pill>{visitCount} visits logged</Pill>
              <Pill>{scheduleDraft.maxVisitsPerDay || "8"} planned max</Pill>
              {scheduleDraft.baseLocationText && <Pill>{scheduleDraft.baseLocationText}</Pill>}
            </div>
          </div>
          <div className="row-actions">
            <Button onClick={() => void saveSchedulePreference()} disabled={savingSchedule}>
              {savingSchedule ? "Saving..." : "Save Day Plan"}
            </Button>
          </div>
        </Card>

        <Card>
          <div className="pn-section-head">
            <h2>Schedule-Aware NBA Hints</h2>
            <Pill>{recommendations[0] ? recommendations[0].doctorName : "No active recommendation"}</Pill>
          </div>
          <div className="pn-driver-list">
            {topRecommendationScheduleDrivers.map((driver) => (
              <div key={driver.key} className="pn-driver-row">
                <strong>{driver.key}</strong>
                <span>{driver.value}</span>
                <Pill>{driver.contribution.toFixed(1)}</Pill>
              </div>
            ))}
            {topRecommendationScheduleDrivers.length === 0 && (
              <p className="muted">Load recommendations to see time-of-day and capacity reasoning for the top-ranked doctor.</p>
            )}
          </div>
        </Card>
      </div>

      <div className="pn-plan-layout">
        <Card>
          <div className="pn-section-head">
            <h2>Pharmacy Feedback Loop</h2>
            <Pill>MR to pharmacy to doctor loop</Pill>
          </div>
          <p className="muted">
            When a product is not moving in pharmacies, record whether the linked doctor is prescribing it and whether stock is available before your next doctor visit.
          </p>
          <div className="pn-plan-grid">
            <Field label="Pharmacy">
              <select
                value={pharmacyFeedback.pharmacyId}
                onChange={(event) => setPharmacyFeedback((current) => ({ ...current, pharmacyId: event.target.value }))}
              >
                <option value="">Select pharmacy</option>
                {pharmacyAccounts.map((pharmacy) => (
                  <option key={pharmacy.id} value={pharmacy.id}>{pharmacy.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Assigned Product">
              <select
                value={pharmacyFeedback.productId}
                onChange={(event) => setPharmacyFeedback((current) => ({ ...current, productId: event.target.value }))}
              >
                <option value="">Select product</option>
                {assignedProducts.map((product) => (
                  <option key={product.productId} value={product.productId}>
                    {product.brandName || product.productName}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Doctor">
              <select
                value={pharmacyFeedback.doctorId}
                onChange={(event) => setPharmacyFeedback((current) => ({ ...current, doctorId: event.target.value }))}
              >
                <option value="">No linked doctor</option>
                {doctors.map((doctor) => (
                  <option key={doctor.id} value={doctor.id}>{doctor.fullName}</option>
                ))}
              </select>
            </Field>
            <Field label="Doctor Prescribing?">
              <select
                value={pharmacyFeedback.prescribed}
                onChange={(event) => setPharmacyFeedback((current) => ({ ...current, prescribed: event.target.value }))}
              >
                <option value="UNKNOWN">Unknown</option>
                <option value="YES">Yes</option>
                <option value="NO">No</option>
              </select>
            </Field>
            <Field label="Stock Available?">
              <select
                value={pharmacyFeedback.stockAvailable}
                onChange={(event) => setPharmacyFeedback((current) => ({ ...current, stockAvailable: event.target.value }))}
              >
                <option value="UNKNOWN">Unknown</option>
                <option value="YES">Yes</option>
                <option value="NO">No</option>
              </select>
            </Field>
            <Field label="Field Notes">
              <textarea
                rows={3}
                value={pharmacyFeedback.notes}
                onChange={(event) => setPharmacyFeedback((current) => ({ ...current, notes: event.target.value }))}
                placeholder="Prescribing blockers, competitor movement, stock issues, pharmacist remarks"
              />
            </Field>
          </div>
          <div className="row-actions">
            <Button onClick={() => void submitPharmacyFeedbackLoop()}>Capture Pharmacy Insight</Button>
          </div>
        </Card>

        <Card>
          <div className="pn-section-head">
            <h2>Assigned Portfolio</h2>
            <Pill>{assignedProducts.length} products</Pill>
          </div>
          <div className="table-list">
            {assignedProducts.map((product) => (
              <div key={product.productId} className="table-row">
                <div>
                  <strong>{product.brandName || product.productName}</strong>
                  <p className="muted">{product.productName} | {product.productCode}</p>
                </div>
                <div className="chips">
                  <Pill>{product.manufacturerType || "General"}</Pill>
                  <Pill>{product.active ? "Active" : "Inactive"}</Pill>
                </div>
              </div>
            ))}
            {assignedProducts.length === 0 && <p className="muted">No product assignments found for this MR.</p>}
          </div>
        </Card>
      </div>

      <div className="pn-nba-section">
        <div className="pn-section-head">
          <h2>Next Best Actions</h2>
          <Pill>Ranked by AI scoring · {recommendations.length} actions</Pill>
        </div>

      <div className="pn-list">
        {recommendations.map((item, index) => (
          <Card key={item.recommendationId} className={`pn-reco ${index === 0 ? "featured" : ""}`}>
            <div className="pn-reco-main">
              <div className="pn-rank">#{index + 1}</div>
              <div>
                <h3>{item.doctorName}</h3>
                <p className="pn-sub">{item.specialty || "General"} <Pill>{item.tier || "Standard"}</Pill></p>
                {item.recommendedAction && (
                  <p className="pn-sub">
                    <Pill>{item.recommendedAction}</Pill>
                  </p>
                )}
                {item.recommendedPharmacyName && (
                  <p className="muted">Pharmacy target: {item.recommendedPharmacyName}</p>
                )}
                <p className="pn-reason">{item.explanation}</p>
                {item.recommendedMessage && <p className="muted">{item.recommendedMessage}</p>}
                <div className="chips">
                  {item.drivers.slice(0, 3).map((driver) => (
                    <Pill key={`${item.recommendationId}-${driver.key}`}>{driver.key}</Pill>
                  ))}
                </div>
                <div className="pn-driver-list">
                  {item.drivers.slice(0, 4).map((driver) => (
                    <div key={`${item.recommendationId}-${driver.key}-detail`} className="pn-driver-row">
                      <strong>{driver.key}</strong>
                      <span>{driver.value}</span>
                      <Pill>{driver.contribution.toFixed(1)}</Pill>
                    </div>
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
                <Button onClick={() => openFeedbackComposer(item, "DONE")}>Done</Button>
                <Button className="ghost" onClick={() => openFeedbackComposer(item, "RESCHEDULED")}>Reschedule</Button>
                <Button className="ghost" onClick={() => openFeedbackComposer(item, "SKIPPED")}>Skip</Button>
                <Button
                  className="ghost"
                  onClick={() => {
                    const targetId = recommendedDestinationIdByRecommendation.get(item.recommendationId);
                    if (targetId) {
                      setSelectedDestinationId(targetId);
                    }
                  }}
                  disabled={!recommendedDestinationIdByRecommendation.get(item.recommendationId)}
                >
                  Route
                </Button>
              </div>
              {feedbackComposer?.recommendationId === item.recommendationId && (
                <div className="pn-feedback-composer">
                  <Field label="Status">
                    <select
                      value={feedbackComposer.status}
                      onChange={(event) =>
                        setFeedbackComposer((current) =>
                          current
                            ? {
                                ...current,
                                status: event.target.value as FeedbackComposer["status"],
                              }
                            : current
                        )
                      }
                    >
                      <option value="DONE">Done</option>
                      <option value="SKIPPED">Skipped</option>
                      <option value="RESCHEDULED">Rescheduled</option>
                    </select>
                  </Field>
                  <Field label="Reason">
                    <textarea
                      value={feedbackComposer.reason}
                      onChange={(event) =>
                        setFeedbackComposer((current) => (current ? { ...current, reason: event.target.value } : current))
                      }
                      placeholder="Why was this action done, skipped, or rescheduled?"
                      rows={3}
                    />
                  </Field>
                  {feedbackComposer.status === "RESCHEDULED" && (
                    <Field label="Reschedule To">
                      <input
                        type="datetime-local"
                        value={feedbackComposer.rescheduledTo}
                        onChange={(event) =>
                          setFeedbackComposer((current) =>
                            current ? { ...current, rescheduledTo: event.target.value } : current
                          )
                        }
                      />
                    </Field>
                  )}
                  <div className="row-actions">
                    <Button onClick={() => void handleSubmitFeedbackComposer(item)}>Submit Feedback</Button>
                    <Button className="ghost" onClick={() => setFeedbackComposer(null)}>Cancel</Button>
                  </div>
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>

      </div>

      <div className="pn-offline-status">
        <Pill>Queued visits: {queuedVisits}</Pill>
        <Pill>Queued feedback: {queuedFeedback}</Pill>
        <Pill>Conflicts: {conflicts.length}</Pill>
        <Field label="Sync Strategy">
          <select value={syncStrategy} onChange={(event) => setSyncStrategy(event.target.value as SyncConflictStrategy)}>
            <option value="SERVER_WINS">Server wins</option>
            <option value="CLIENT_WINS">Client wins</option>
          </select>
        </Field>
        <Button className="ghost" onClick={syncNow}>Sync Now</Button>
      </div>

      {conflicts.length > 0 && (
        <Card>
          <div className="pn-section-head">
            <h2>Sync Conflicts</h2>
            <Pill>{conflicts.length}</Pill>
          </div>
          <div className="pn-commute-list">
            {conflicts.map((conflict) => (
              <div key={`${conflict.type}-${conflict.clientReferenceId}`} className="pn-commute-row">
                <div>
                  <strong>{conflict.type}</strong>
                  <p>{conflict.reason}</p>
                </div>
                <div className="pn-destination-meta">
                  <span>{conflict.clientReferenceId}</span>
                  <span>{conflict.serverId}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {status && <div className="toast">{status}</div>}
      {sessionExpired && (
        <div className="toast">
          Session expired. Click below to re-login and continue.
          <div className="row-actions" style={{ marginTop: 8 }}>
            <Button
              onClick={() => {
                window.location.href = "/login";
              }}
            >
              Re-login
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
