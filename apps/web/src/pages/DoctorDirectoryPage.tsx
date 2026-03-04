import { type ReactNode, useEffect, useMemo, useState } from "react";
import {
  createDoctor,
  fetchDoctors,
  fetchMyTerritories,
  fetchNearbyDoctors,
  fetchTerritories,
  updateDoctor,
  type Doctor,
  type Territory,
} from "../api";
import { useAuth } from "../auth/AuthContext";
import { Card, Pill } from "../ui/components";

const tierOrder = ["A", "B", "C"];
const priorityBands = ["ALL", "HIGH", "MEDIUM", "LOW"] as const;
type PriorityBand = (typeof priorityBands)[number];
type LocationMode = "TERRITORY" | "NEARBY";

function getWhatsappNumber(doctor: Doctor) {
  const value =
    doctor.whatsappNumber ??
    doctor.whatsapp_number ??
    doctor.phoneNumber ??
    doctor.phone ??
    doctor.mobile ??
    null;
  return value?.trim() || null;
}

function getEmailAddress(doctor: Doctor) {
  const value = doctor.email ?? doctor.emailAddress ?? doctor.email_address ?? null;
  return value?.trim() || null;
}

function toWhatsappUrl(number: string) {
  const digits = number.replace(/[^\d]/g, "");
  return digits ? `https://wa.me/${digits}` : null;
}

function toGmailComposeUrl(email: string) {
  return `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(email)}`;
}

function toMailtoUrl(email: string) {
  return `mailto:${encodeURIComponent(email)}`;
}

function formatGeoPoint(doctor: Doctor) {
  if (doctor.lat == null || doctor.lon == null) return "Not set";
  return `${doctor.lat.toFixed(5)}, ${doctor.lon.toFixed(5)}`;
}

function ContactLink({
  href,
  label,
  value,
  title,
  icon,
}: {
  href: string | null;
  label: string;
  value?: string | null;
  title: string;
  icon: ReactNode;
}) {
  if (!href) {
    return (
      <span className="pn-contact-link disabled" title={`${label} not available`}>
        {icon}
        <span>{value || label}</span>
      </span>
    );
  }

  return (
    <a className="pn-contact-link" href={href} target="_blank" rel="noreferrer" title={title}>
      {icon}
      <span>{value || label}</span>
    </a>
  );
}

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M19.05 4.94A9.9 9.9 0 0 0 12 2a10 10 0 0 0-8.68 14.97L2 22l5.16-1.35A10 10 0 1 0 19.05 4.94ZM12 20.13a8.07 8.07 0 0 1-4.12-1.13l-.29-.18-3.06.8.82-2.98-.19-.31A8.13 8.13 0 1 1 12 20.13Zm4.46-6.05c-.24-.12-1.41-.7-1.63-.78-.22-.08-.38-.12-.55.12-.16.24-.63.78-.77.94-.14.16-.28.18-.52.06-.24-.12-1-.37-1.9-1.17-.7-.63-1.18-1.41-1.32-1.65-.14-.24-.01-.37.1-.49.11-.11.24-.28.37-.42.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.42-.06-.12-.55-1.32-.76-1.81-.2-.47-.4-.4-.55-.41h-.47c-.16 0-.42.06-.64.3-.22.24-.85.83-.85 2.03s.87 2.36.99 2.52c.12.16 1.71 2.61 4.14 3.66.58.25 1.03.39 1.38.5.58.18 1.11.15 1.53.09.47-.07 1.41-.58 1.61-1.15.2-.57.2-1.05.14-1.15-.06-.1-.22-.16-.46-.28Z"
      />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M4 5h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Zm16 2H4v.2l8 5.33 8-5.33V7Zm0 10V9.6l-7.45 4.96a1 1 0 0 1-1.1 0L4 9.6V17h16Z"
      />
    </svg>
  );
}

export default function DoctorDirectoryPage() {
  const { token, role } = useAuth();
  const [allDoctors, setAllDoctors] = useState<Doctor[]>([]);
  const [search, setSearch] = useState("");
  const [specialtyFilter, setSpecialtyFilter] = useState("");
  const [tierFilter, setTierFilter] = useState("");
  const [priorityBand, setPriorityBand] = useState<PriorityBand>("ALL");
  const [myTerritories, setMyTerritories] = useState<Territory[]>([]);
  const [territoryId, setTerritoryId] = useState("");
  const [nearbyRadiusKm, setNearbyRadiusKm] = useState("5");
  const [locationMode, setLocationMode] = useState<LocationMode>("TERRITORY");
  const [status, setStatus] = useState("");
  const [editingDoctorId, setEditingDoctorId] = useState<string | null>(null);
  const [doctorForm, setDoctorForm] = useState({
    fullName: "",
    specialty: "",
    tier: "B",
    priorityScore: "70",
    territoryId: "",
    notes: "",
    whatsappNumber: "",
    email: "",
    targetProductFocus: "",
    availabilityPattern: "",
    availabilityWindow: "",
    schedulingNotes: "",
    lat: "",
    lon: "",
  });

  const isMr = role === "MR";
  const canManageDoctors = role === "MANAGER" || role === "ADMIN";

  const activeTerritoryId = useMemo(() => territoryId, [territoryId]);

  const priorityRange = useMemo(() => {
    if (priorityBand === "HIGH") return { min: 85, max: undefined };
    if (priorityBand === "MEDIUM") return { min: 70, max: 84 };
    if (priorityBand === "LOW") return { min: undefined, max: 69 };
    return { min: undefined, max: undefined };
  }, [priorityBand]);

  useEffect(() => {
    if (!token) return;
    const loadTerritories = isMr ? fetchMyTerritories(token) : fetchTerritories(token);
    loadTerritories.then(setMyTerritories).catch(() => setMyTerritories([]));
  }, [token, isMr]);

  useEffect(() => {
    if (!token) return;
    if (locationMode !== "TERRITORY") return;
    if (isMr && myTerritories.length === 0) {
      setAllDoctors([]);
      setStatus("No territories assigned to your MR profile.");
      return;
    }

    fetchDoctors(token, {
      tier: tierFilter || undefined,
      specialty: specialtyFilter.trim() || undefined,
      minPriorityScore: priorityRange.min,
      maxPriorityScore: priorityRange.max,
      territoryId: activeTerritoryId || undefined,
      size: 200,
    })
      .then((result) => {
        setAllDoctors(result.content);
        setStatus("");
      })
      .catch(() => {
        setAllDoctors([]);
        setStatus("Failed to load doctors.");
      });
  }, [token, locationMode, tierFilter, specialtyFilter, priorityRange, activeTerritoryId, isMr, myTerritories.length]);

  const loadNearby = async () => {
    if (!token) return;
    setLocationMode("NEARBY");
    setStatus("Fetching nearby doctors...");
    try {
      const location = await new Promise<GeolocationPosition>((resolve, reject) => {
        if (!navigator.geolocation) {
          reject(new Error("No geolocation"));
          return;
        }
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 7000 });
      });
      const radiusValue = Number(nearbyRadiusKm);
      const radius = Number.isFinite(radiusValue) && radiusValue > 0 ? radiusValue : 5;
      const nearby = await fetchNearbyDoctors(token, location.coords.latitude, location.coords.longitude, radius);
      setAllDoctors(nearby);
      setStatus("Nearby doctors loaded.");
    } catch {
      setAllDoctors([]);
      setStatus("Failed to fetch nearby doctors. Check GPS permission.");
    }
  };

  const switchToTerritoryMode = () => {
    setLocationMode("TERRITORY");
    setStatus("");
  };

  const resetDoctorForm = () => {
    setEditingDoctorId(null);
    setDoctorForm({
      fullName: "",
      specialty: "",
      tier: "B",
      priorityScore: "70",
      territoryId: "",
      notes: "",
      whatsappNumber: "",
      email: "",
      targetProductFocus: "",
      availabilityPattern: "",
      availabilityWindow: "",
      schedulingNotes: "",
      lat: "",
      lon: "",
    });
  };

  const openEditDoctor = (doctor: Doctor) => {
    setEditingDoctorId(doctor.id);
    setDoctorForm({
      fullName: doctor.fullName,
      specialty: doctor.specialty || "",
      tier: doctor.tier || "B",
      priorityScore: String(doctor.priorityScore ?? 0),
      territoryId: doctor.territoryId || "",
      notes: doctor.notes || "",
      whatsappNumber: getWhatsappNumber(doctor) || "",
      email: getEmailAddress(doctor) || "",
      targetProductFocus: doctor.targetProductFocus || "",
      availabilityPattern: doctor.availabilityPattern || "",
      availabilityWindow: doctor.availabilityWindow || "",
      schedulingNotes: doctor.schedulingNotes || "",
      lat: doctor.lat == null ? "" : String(doctor.lat),
      lon: doctor.lon == null ? "" : String(doctor.lon),
    });
  };

  const saveDoctor = async () => {
    if (!token || !canManageDoctors) return;
    if (!doctorForm.fullName.trim()) {
      setStatus("Doctor name is required.");
      return;
    }

    const priorityValue = Number(doctorForm.priorityScore);
    if (!Number.isFinite(priorityValue) || priorityValue < 0 || priorityValue > 100) {
      setStatus("Priority score must be between 0 and 100.");
      return;
    }

    const hasLat = doctorForm.lat.trim() !== "";
    const hasLon = doctorForm.lon.trim() !== "";
    if (hasLat !== hasLon) {
      setStatus("Both latitude and longitude are required when setting location.");
      return;
    }
    const latValue = hasLat ? Number(doctorForm.lat) : undefined;
    const lonValue = hasLon ? Number(doctorForm.lon) : undefined;
    if (hasLat && (!Number.isFinite(latValue) || !Number.isFinite(lonValue))) {
      setStatus("Latitude and longitude must be numeric values.");
      return;
    }

    const payload = {
      fullName: doctorForm.fullName.trim(),
      specialty: doctorForm.specialty.trim() || undefined,
      tier: doctorForm.tier.trim().toUpperCase(),
      priorityScore: Math.round(priorityValue),
      territoryId: doctorForm.territoryId || null,
      notes: doctorForm.notes.trim() || undefined,
      whatsappNumber: doctorForm.whatsappNumber.trim() || undefined,
      email: doctorForm.email.trim() || undefined,
      targetProductFocus: doctorForm.targetProductFocus.trim() || undefined,
      availabilityPattern: doctorForm.availabilityPattern.trim() || undefined,
      availabilityWindow: doctorForm.availabilityWindow.trim() || undefined,
      schedulingNotes: doctorForm.schedulingNotes.trim() || undefined,
      lat: latValue,
      lon: lonValue,
    };

    try {
      if (editingDoctorId) {
        await updateDoctor(token, editingDoctorId, payload);
        setStatus("Doctor updated successfully.");
      } else {
        await createDoctor(token, payload);
        setStatus("Doctor created and assigned.");
      }
      resetDoctorForm();
      if (locationMode === "TERRITORY") {
        const result = await fetchDoctors(token, {
          tier: tierFilter || undefined,
          specialty: specialtyFilter.trim() || undefined,
          minPriorityScore: priorityRange.min,
          maxPriorityScore: priorityRange.max,
          territoryId: activeTerritoryId || undefined,
          size: 200,
        });
        setAllDoctors(result.content);
      }
    } catch {
      setStatus("Failed to save doctor.");
    }
  };

  const doctors = useMemo(() => {
    let filtered = allDoctors;
    if (tierFilter) filtered = filtered.filter((doctor) => doctor.tier === tierFilter);
    if (specialtyFilter.trim()) {
      const specialtyQuery = specialtyFilter.trim().toLowerCase();
      filtered = filtered.filter((doctor) => (doctor.specialty || "").toLowerCase().includes(specialtyQuery));
    }
    if (priorityBand === "HIGH") filtered = filtered.filter((doctor) => doctor.priorityScore >= 85);
    if (priorityBand === "MEDIUM") filtered = filtered.filter((doctor) => doctor.priorityScore >= 70 && doctor.priorityScore < 85);
    if (priorityBand === "LOW") filtered = filtered.filter((doctor) => doctor.priorityScore < 70);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      filtered = filtered.filter((doctor) =>
        doctor.fullName.toLowerCase().includes(q) || (doctor.specialty || "").toLowerCase().includes(q)
      );
    }
    return [...filtered].sort((a, b) => b.priorityScore - a.priorityScore);
  }, [allDoctors, search, tierFilter, specialtyFilter, priorityBand]);

  if (!token) return null;

  return (
    <div className="pn-page">
      <div className="pn-header">
        <div>
          <h1>Doctor Directory</h1>
          <p>{doctors.length} physicians in {locationMode === "NEARBY" ? "nearby segment" : "assigned territory segment"}</p>
        </div>
      </div>

      {canManageDoctors && (
        <Card>
          <h3>{editingDoctorId ? "Edit Doctor" : "Add Doctor"}</h3>
          <div className="inline-form">
            <input
              placeholder="Full name"
              value={doctorForm.fullName}
              onChange={(event) => setDoctorForm((state) => ({ ...state, fullName: event.target.value }))}
            />
            <input
              placeholder="Specialty"
              value={doctorForm.specialty}
              onChange={(event) => setDoctorForm((state) => ({ ...state, specialty: event.target.value }))}
            />
            <input
              placeholder="Tier (A/B/C)"
              value={doctorForm.tier}
              onChange={(event) => setDoctorForm((state) => ({ ...state, tier: event.target.value }))}
            />
            <input
              placeholder="Priority 0-100"
              type="number"
              min={0}
              max={100}
              value={doctorForm.priorityScore}
              onChange={(event) => setDoctorForm((state) => ({ ...state, priorityScore: event.target.value }))}
            />
            <select
              value={doctorForm.territoryId}
              onChange={(event) => setDoctorForm((state) => ({ ...state, territoryId: event.target.value }))}
            >
              <option value="">Unassigned</option>
              {myTerritories.map((territory) => (
                <option key={territory.id} value={territory.id}>
                  {territory.name}
                </option>
              ))}
            </select>
            <input
              placeholder="WhatsApp number"
              value={doctorForm.whatsappNumber}
              onChange={(event) => setDoctorForm((state) => ({ ...state, whatsappNumber: event.target.value }))}
            />
            <input
              placeholder="Email"
              value={doctorForm.email}
              onChange={(event) => setDoctorForm((state) => ({ ...state, email: event.target.value }))}
            />
            <input
              placeholder="Target product focus"
              value={doctorForm.targetProductFocus}
              onChange={(event) => setDoctorForm((state) => ({ ...state, targetProductFocus: event.target.value }))}
            />
            <input
              placeholder="Availability pattern"
              value={doctorForm.availabilityPattern}
              onChange={(event) => setDoctorForm((state) => ({ ...state, availabilityPattern: event.target.value }))}
            />
            <input
              placeholder="Availability window"
              value={doctorForm.availabilityWindow}
              onChange={(event) => setDoctorForm((state) => ({ ...state, availabilityWindow: event.target.value }))}
            />
            <input
              placeholder="Scheduling notes"
              value={doctorForm.schedulingNotes}
              onChange={(event) => setDoctorForm((state) => ({ ...state, schedulingNotes: event.target.value }))}
            />
            <input
              placeholder="Latitude"
              value={doctorForm.lat}
              onChange={(event) => setDoctorForm((state) => ({ ...state, lat: event.target.value }))}
            />
            <input
              placeholder="Longitude"
              value={doctorForm.lon}
              onChange={(event) => setDoctorForm((state) => ({ ...state, lon: event.target.value }))}
            />
            <input
              placeholder="Notes"
              value={doctorForm.notes}
              onChange={(event) => setDoctorForm((state) => ({ ...state, notes: event.target.value }))}
            />
          </div>
          <div className="row-actions">
            <button className="pn-chip-btn active" onClick={() => void saveDoctor()}>
              {editingDoctorId ? "Update Doctor" : "Create Doctor"}
            </button>
            {editingDoctorId && (
              <button className="pn-chip-btn" onClick={resetDoctorForm}>
                Cancel Edit
              </button>
            )}
          </div>
        </Card>
      )}

      <div className="pn-directory-filters">
        <div className="pn-directory-search-block">
          <input
            placeholder="Search doctors by name or specialty..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <input
            placeholder="Specialty segment (e.g. Cardiology)"
            value={specialtyFilter}
            onChange={(event) => setSpecialtyFilter(event.target.value)}
          />
        </div>
        <div className="pn-directory-chips">
          <div className="chips">
            <button className={`pn-chip-btn ${tierFilter === "" ? "active" : ""}`} onClick={() => setTierFilter("")}>All tiers</button>
            {tierOrder.map((tier) => (
              <button key={tier} className={`pn-chip-btn ${tierFilter === tier ? "active" : ""}`} onClick={() => setTierFilter(tier)}>
                Tier {tier}
              </button>
            ))}
          </div>
          <div className="chips">
            {priorityBands.map((band) => (
              <button
                key={band}
                className={`pn-chip-btn ${priorityBand === band ? "active" : ""}`}
                onClick={() => setPriorityBand(band)}
              >
                {band === "ALL" ? "All priorities" : band}
              </button>
            ))}
          </div>
          <div className="pn-directory-location-controls">
            <select value={activeTerritoryId} onChange={(event) => setTerritoryId(event.target.value)} disabled={locationMode === "NEARBY"}>
              <option value="">All my territories</option>
              {myTerritories.map((territory) => (
                <option key={territory.id} value={territory.id}>
                  {territory.name}
                </option>
              ))}
            </select>
            <select value={nearbyRadiusKm} onChange={(event) => setNearbyRadiusKm(event.target.value)}>
              <option value="2">2 km</option>
              <option value="5">5 km</option>
              <option value="10">10 km</option>
              <option value="20">20 km</option>
            </select>
            <button className={`pn-chip-btn ${locationMode === "TERRITORY" ? "active" : ""}`} onClick={switchToTerritoryMode}>
              Territory
            </button>
            <button className={`pn-chip-btn ${locationMode === "NEARBY" ? "active" : ""}`} onClick={() => void loadNearby()}>
              Nearby
            </button>
          </div>
        </div>
      </div>
      {status && <p className="muted">{status}</p>}

      <Card className="pn-table-card">
        <table className="pn-table">
          <thead>
            <tr>
              <th>Doctor</th>
              <th>Specialty</th>
              <th>Tier</th>
              <th>Territory</th>
              <th>Priority</th>
              <th>Product Focus</th>
              <th>Availability</th>
              <th>Location</th>
              <th>Contact</th>
              {canManageDoctors && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {doctors.length === 0 ? (
              <tr>
                <td colSpan={canManageDoctors ? 10 : 9} className="muted">No doctors found for current segmentation.</td>
              </tr>
            ) : null}
            {doctors.map((doctor) => {
              const whatsappNumber = getWhatsappNumber(doctor);
              const emailAddress = getEmailAddress(doctor);

              return (
                <tr key={doctor.id}>
                  <td>
                    <strong>{doctor.fullName}</strong>
                    <div className="muted">{doctor.notes || "No additional address data"}</div>
                  </td>
                  <td>{doctor.specialty || "General Practitioner"}</td>
                  <td><Pill>{doctor.tier}</Pill></td>
                  <td>{doctor.territoryId ? "Assigned" : "Unassigned"}</td>
                  <td>{doctor.priorityScore}</td>
                  <td>{doctor.targetProductFocus || "Not set"}</td>
                  <td>
                    <div>{doctor.availabilityWindow || "No window"}</div>
                    <div className="muted">{doctor.availabilityPattern || doctor.schedulingNotes || "No schedule details"}</div>
                  </td>
                  <td>{formatGeoPoint(doctor)}</td>
                  <td>
                    <div className="pn-contact-links">
                      <ContactLink
                        href={whatsappNumber ? toWhatsappUrl(whatsappNumber) : null}
                        label="WhatsApp"
                        value={whatsappNumber}
                        title="Open WhatsApp chat"
                        icon={<WhatsAppIcon />}
                      />
                      <div className="pn-contact-email-group">
                        <ContactLink
                          href={emailAddress ? toGmailComposeUrl(emailAddress) : null}
                          label="Email"
                          value={emailAddress}
                          title="Open Gmail compose"
                          icon={<MailIcon />}
                        />
                        {emailAddress ? (
                          <a className="pn-contact-secondary" href={toMailtoUrl(emailAddress)} title="Open default mail app">
                            Open mail app
                          </a>
                        ) : null}
                      </div>
                    </div>
                  </td>
                  {canManageDoctors && (
                    <td>
                      <button className="pn-chip-btn" onClick={() => openEditDoctor(doctor)}>
                        Edit
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
