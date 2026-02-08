import { useEffect, useMemo, useState } from "react";
import {
  captureVisitGps,
  createVisit,
  fetchNbaNext,
  fetchDoctorVisits,
  fetchDoctors,
  fetchNearbyDoctors,
  fetchMyTerritories,
  fetchSecurePing,
  type Doctor,
  type NbaRecommendation,
  type Territory,
  type Visit,
} from "../api";
import { useAuth } from "../auth/AuthContext";
import { Badge, Button, Card, Field, Pill, SectionTitle } from "../ui/components";
import OfflineBanner from "../ui/OfflineBanner";

const VISIT_DRAFTS_KEY = "nba_visit_drafts";

type VisitDraft = {
  id: string;
  doctorId: string;
  visitTime: string;
  outcome: string;
  notes: string;
  followUpRequired: boolean;
};

export default function MrDashboard() {
  const { token, role } = useAuth();
  const [myTerritories, setMyTerritories] = useState<Territory[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [visitHistory, setVisitHistory] = useState<Visit[]>([]);
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [tier, setTier] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [territoryId, setTerritoryId] = useState("");
  const [visitTime, setVisitTime] = useState(() => new Date().toISOString().slice(0, 16));
  const [outcome, setOutcome] = useState("");
  const [notes, setNotes] = useState("");
  const [followUpRequired, setFollowUpRequired] = useState(false);
  const [gpsOptIn, setGpsOptIn] = useState(false);
  const [draftCount, setDraftCount] = useState(0);
  const [nextActions, setNextActions] = useState<NbaRecommendation[]>([]);
  const [nbaLoading, setNbaLoading] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (!token) return;
    fetchMyTerritories(token).then(setMyTerritories).catch(() => setMyTerritories([]));
    setDraftCount(loadDrafts().length);
    void loadNextActions(token);
  }, [token]);

  const activeTerritoryId = useMemo(() => {
    if (territoryId) return territoryId;
    if (myTerritories.length > 0) return myTerritories[0].id;
    return "";
  }, [territoryId, myTerritories]);

  useEffect(() => {
    if (!token) return;
    fetchDoctors(token, { tier, specialty, territoryId: activeTerritoryId })
      .then((data) => setDoctors(data.content))
      .catch(() => setDoctors([]));
  }, [token, tier, specialty, activeTerritoryId]);

  useEffect(() => {
    if (!token || !selectedDoctor) {
      setVisitHistory([]);
      return;
    }
    fetchDoctorVisits(token, selectedDoctor.id, 0, 10)
      .then((result) => setVisitHistory(result.content))
      .catch(() => setVisitHistory([]));
  }, [token, selectedDoctor]);

  useEffect(() => {
    const onOnline = () => {
      if (!token) return;
      void syncDrafts(token);
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [token]);

  const refreshSelectedDoctorVisits = async () => {
    if (!token || !selectedDoctor) return;
    const result = await fetchDoctorVisits(token, selectedDoctor.id, 0, 10);
    setVisitHistory(result.content);
  };

  const logVisit = async () => {
    if (!token || !selectedDoctor) return;
    if (!outcome.trim()) {
      setStatus("Outcome is required");
      return;
    }
    const payload = {
      doctorId: selectedDoctor.id,
      visitTime: new Date(visitTime).toISOString(),
      outcome: outcome.trim(),
      notes: notes.trim(),
      followUpRequired,
    };

    if (!navigator.onLine) {
      saveDraft(payload);
      setDraftCount(loadDrafts().length);
      setStatus("Offline: visit saved to drafts");
      return;
    }

    try {
      await createVisit(token, payload);
      setOutcome("");
      setNotes("");
      setFollowUpRequired(false);
      setStatus("Visit logged");
      await refreshSelectedDoctorVisits();
    } catch {
      saveDraft(payload);
      setDraftCount(loadDrafts().length);
      setStatus("Network issue: visit saved to drafts");
    }
  };

  const syncDrafts = async (authToken: string) => {
    const drafts = loadDrafts();
    if (drafts.length === 0) return;
    let synced = 0;
    const pending: VisitDraft[] = [];

    for (const draft of drafts) {
      try {
        await createVisit(authToken, {
          doctorId: draft.doctorId,
          visitTime: draft.visitTime,
          outcome: draft.outcome,
          notes: draft.notes,
          followUpRequired: draft.followUpRequired,
        });
        synced += 1;
      } catch {
        pending.push(draft);
      }
    }

    localStorage.setItem(VISIT_DRAFTS_KEY, JSON.stringify(pending));
    setDraftCount(pending.length);
    if (synced > 0) {
      setStatus(`Synced ${synced} visit draft(s)`);
      await refreshSelectedDoctorVisits();
    }
  };

  const handleSyncDrafts = async () => {
    if (!token) return;
    await syncDrafts(token);
  };

  const handleCaptureGps = async (visitId: string) => {
    if (!token) return;
    if (!gpsOptIn) {
      setStatus("Enable GPS opt-in before capture");
      return;
    }
    if (!navigator.geolocation) {
      setStatus("GPS is not supported in this browser");
      return;
    }

    setStatus("Capturing GPS...");
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          await captureVisitGps(token, visitId, {
            lat: position.coords.latitude,
            lon: position.coords.longitude,
            optIn: true,
          });
          setStatus("GPS attached to visit");
          await refreshSelectedDoctorVisits();
        } catch {
          setStatus("Failed to attach GPS");
        }
      },
      () => setStatus("GPS permission denied"),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleNearby = async () => {
    if (!token) return;
    setStatus("Fetching nearby doctors...");
    try {
      const location = await new Promise<GeolocationPosition>((resolve, reject) => {
        if (!navigator.geolocation) {
          reject(new Error("No geolocation"));
          return;
        }
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 7000 });
      });
      const nearby = await fetchNearbyDoctors(token, location.coords.latitude, location.coords.longitude, 5);
      setDoctors(nearby);
      setStatus("Nearby doctors loaded");
    } catch {
      setStatus("Failed to fetch nearby doctors. Check GPS permission.");
    }
  };

  const handlePing = async () => {
    if (!token) return;
    setStatus("Pinging API...");
    try {
      const pong = await fetchSecurePing(token);
      setStatus(`Protected API: ${pong}`);
    } catch {
      setStatus("Protected API ping failed");
    }
  };

  const loadNextActions = async (authToken: string) => {
    setNbaLoading(true);
    try {
      const result = await fetchNbaNext(authToken, 5);
      setNextActions(result.recommendations);
    } catch {
      setNextActions([]);
      setStatus("Failed to load next-best actions");
    } finally {
      setNbaLoading(false);
    }
  };

  const handleRefreshNextActions = async () => {
    if (!token) return;
    await loadNextActions(token);
  };

  return (
    <div className="page">
      <OfflineBanner />
      <div className="page-header">
        <div>
          <h1>MR Workspace</h1>
          <p className="muted">Role: {role ?? "MR"}</p>
        </div>
        <div className="header-actions">
          <Badge label="Territory" value={myTerritories[0]?.name ?? "Unassigned"} />
          <Badge label="Draft Visits" value={`${draftCount}`} />
          <Button className="ghost" onClick={handleSyncDrafts}>
            Sync Drafts
          </Button>
          <Button className="ghost" onClick={handlePing}>
            Test API
          </Button>
        </div>
      </div>

      <Card>
        <SectionTitle title="What next?" subtitle="Ranked recommendations with explanation drivers." />
        <div className="row-actions wrap">
          <Button className="ghost" onClick={handleRefreshNextActions}>
            Refresh
          </Button>
        </div>
        <div className="table-list">
          {nbaLoading && <p className="muted">Loading recommendations...</p>}
          {!nbaLoading && nextActions.length === 0 && <p className="muted">No recommendations yet.</p>}
          {nextActions.map((item, index) => (
            <div key={item.recommendationId} className="nba-row">
              <div className="nba-main">
                <div className="row-actions">
                  <Pill>#{index + 1}</Pill>
                  <strong>{item.doctorName}</strong>
                  <span className="muted">{item.specialty || "General"}</span>
                </div>
                <p className="muted">
                  Tier {item.tier ?? "-"} | Priority {item.priorityScore} | Score {item.score.toFixed(2)}
                </p>
                <p>{item.explanation}</p>
              </div>
              <div className="nba-drivers">
                {item.drivers.slice(0, 3).map((driver) => (
                  <div key={`${item.recommendationId}-${driver.key}`} className="nba-driver">
                    <strong>{driver.key}</strong>
                    <span>{driver.value}</span>
                    <Pill>{driver.contribution.toFixed(2)}</Pill>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <SectionTitle title="Doctor Directory" subtitle="Filter by tier, specialty, and territory." />
        <div className="filters">
          <Field label="Tier">
            <input placeholder="A / B" value={tier} onChange={(e) => setTier(e.target.value)} />
          </Field>
          <Field label="Specialty">
            <input placeholder="Cardiology" value={specialty} onChange={(e) => setSpecialty(e.target.value)} />
          </Field>
          <Field label="Territory">
            <select value={activeTerritoryId} onChange={(e) => setTerritoryId(e.target.value)}>
              <option value="">All my territories</option>
              {myTerritories.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </Field>
          <Button className="accent" onClick={handleNearby}>
            Nearby
          </Button>
        </div>

        <div className="grid">
          <div className="list">
            {doctors.map((doc) => (
              <button key={doc.id} className="list-item" onClick={() => setSelectedDoctor(doc)}>
                <div>
                  <strong>{doc.fullName}</strong>
                  <span>{doc.specialty || "General"}</span>
                </div>
                <Pill>Tier {doc.tier}</Pill>
              </button>
            ))}
          </div>
          <div className="detail">
            {selectedDoctor ? (
              <div>
                <h2>{selectedDoctor.fullName}</h2>
                <p className="muted">{selectedDoctor.specialty || "General"}</p>
                <div className="detail-grid">
                  <div>
                    <span>Tier</span>
                    <strong>{selectedDoctor.tier}</strong>
                  </div>
                  <div>
                    <span>Priority</span>
                    <strong>{selectedDoctor.priorityScore}</strong>
                  </div>
                </div>
                <p className="notes">{selectedDoctor.notes || "No notes yet."}</p>

                <SectionTitle title="Log Visit" subtitle="Fast form with offline drafts." />
                <div className="inline-form">
                  <Field label="Visit Time">
                    <input type="datetime-local" value={visitTime} onChange={(e) => setVisitTime(e.target.value)} />
                  </Field>
                  <Field label="Outcome">
                    <input value={outcome} onChange={(e) => setOutcome(e.target.value)} placeholder="Discussed therapy" />
                  </Field>
                  <Field label="Notes">
                    <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes" />
                  </Field>
                </div>
                <div className="row-actions wrap">
                  <label className="muted">
                    <input
                      type="checkbox"
                      checked={followUpRequired}
                      onChange={(e) => setFollowUpRequired(e.target.checked)}
                    />{" "}
                    Follow-up required
                  </label>
                  <Button onClick={logVisit}>Log Visit</Button>
                </div>

                <SectionTitle title="Visit History" subtitle="Most recent visits for this doctor." />
                <div className="table-list">
                  {visitHistory.length === 0 && <p className="muted">No visits yet.</p>}
                  {visitHistory.map((visit) => (
                    <div key={visit.id} className="table-row">
                      <div>
                        <strong>{visit.outcome}</strong>
                        <p className="muted">{new Date(visit.visitTime).toLocaleString()}</p>
                        {visit.notes && <p>{visit.notes}</p>}
                        {visit.followUpRequired && <Pill>Follow-up</Pill>}
                      </div>
                      <div className="row-actions">
                        <Pill>{visit.gpsCaptured ? "GPS Captured" : "No GPS"}</Pill>
                        <Button className="ghost" onClick={() => handleCaptureGps(visit.id)}>
                          Capture GPS
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
                <label className="muted">
                  <input type="checkbox" checked={gpsOptIn} onChange={(e) => setGpsOptIn(e.target.checked)} /> I opt in
                  to attach GPS to visits
                </label>
              </div>
            ) : (
              <p className="muted">Select a doctor to see details.</p>
            )}
          </div>
        </div>
        {status && <div className="toast">{status}</div>}
      </Card>
    </div>
  );
}

function loadDrafts(): VisitDraft[] {
  const raw = localStorage.getItem(VISIT_DRAFTS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as VisitDraft[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveDraft(draft: Omit<VisitDraft, "id">) {
  const current = loadDrafts();
  const next = [...current, { ...draft, id: crypto.randomUUID() }];
  localStorage.setItem(VISIT_DRAFTS_KEY, JSON.stringify(next));
}
