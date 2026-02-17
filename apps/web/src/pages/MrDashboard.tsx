import { useEffect, useMemo, useState } from "react";
import {
  captureVisitGps,
  createVisit,
  fetchDoctorVisits,
  fetchDoctors,
  fetchMyTerritories,
  fetchNearbyDoctors,
  fetchNbaNext,
  fetchSecurePing,
  submitRecommendationFeedback,
  syncBatch,
  type Doctor,
  type NbaRecommendation,
  type SyncConflict,
  type SyncConflictStrategy,
  type SyncFeedbackRequest,
  type SyncVisitRequest,
  type Territory,
  type Visit,
} from "../api";
import { useAuth } from "../auth/AuthContext";
import {
  cacheNbaSnapshot,
  getCachedNbaSnapshot,
  getConflicts,
  getQueuedFeedback,
  getQueuedVisits,
  queueBreakdown,
  queueFeedback,
  queueSize,
  queueVisit,
  removeQueuedItems,
  saveConflicts,
} from "../offline/queue";
import { Badge, Button, Card, Field, Pill, SectionTitle } from "../ui/components";

const VISIT_DRAFT_PREFIX = "nba_visit_draft";

function visitDraftKey(username: string, doctorId: string) {
  return `${VISIT_DRAFT_PREFIX}:${username}:${doctorId}`;
}

type VisitDraft = {
  visitTime: string;
  outcome: string;
  notes: string;
  followUpRequired: boolean;
};

export default function MrDashboard() {
  const { token, role, username } = useAuth();
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
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [queuedVisitCount, setQueuedVisitCount] = useState(0);
  const [queuedFeedbackCount, setQueuedFeedbackCount] = useState(0);
  const [nextActions, setNextActions] = useState<NbaRecommendation[]>([]);
  const [nbaLoading, setNbaLoading] = useState(false);
  const [syncStrategy, setSyncStrategy] = useState<SyncConflictStrategy>("SERVER_WINS");
  const [conflicts, setConflicts] = useState<SyncConflict[]>([]);
  const [status, setStatus] = useState("");
  const [draftLoadedForDoctorId, setDraftLoadedForDoctorId] = useState("");

  useEffect(() => {
    if (!token) return;
    fetchMyTerritories(token).then(setMyTerritories).catch(() => setMyTerritories([]));
    void refreshOfflineState();
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
    if (!selectedDoctor) {
      setDraftLoadedForDoctorId("");
      return;
    }

    const key = visitDraftKey(username, selectedDoctor.id);
    const raw = localStorage.getItem(key);
    if (!raw) {
      setVisitTime(new Date().toISOString().slice(0, 16));
      setOutcome("");
      setNotes("");
      setFollowUpRequired(false);
      setDraftLoadedForDoctorId(selectedDoctor.id);
      return;
    }

    try {
      const parsed = JSON.parse(raw) as Partial<VisitDraft>;
      setVisitTime(typeof parsed.visitTime === "string" && parsed.visitTime ? parsed.visitTime : new Date().toISOString().slice(0, 16));
      setOutcome(typeof parsed.outcome === "string" ? parsed.outcome : "");
      setNotes(typeof parsed.notes === "string" ? parsed.notes : "");
      setFollowUpRequired(Boolean(parsed.followUpRequired));
    } catch {
      setVisitTime(new Date().toISOString().slice(0, 16));
      setOutcome("");
      setNotes("");
      setFollowUpRequired(false);
    }
    setDraftLoadedForDoctorId(selectedDoctor.id);
  }, [selectedDoctor, username]);

  useEffect(() => {
    if (!selectedDoctor || draftLoadedForDoctorId !== selectedDoctor.id) {
      return;
    }
    const key = visitDraftKey(username, selectedDoctor.id);
    const draft: VisitDraft = {
      visitTime,
      outcome,
      notes,
      followUpRequired,
    };
    localStorage.setItem(key, JSON.stringify(draft));
  }, [selectedDoctor, draftLoadedForDoctorId, username, visitTime, outcome, notes, followUpRequired]);

  useEffect(() => {
    const onOnline = () => {
      if (!token) return;
      void syncQueued(token, syncStrategy);
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [token, syncStrategy]);

  useEffect(() => {
    if (!token) return;
    if (!("serviceWorker" in navigator)) return;
    void navigator.serviceWorker.ready.then(async (registration) => {
      if ("sync" in registration) {
        try {
          await (registration as ServiceWorkerRegistration & {
            sync: { register: (tag: string) => Promise<void> };
          }).sync.register("nba-sync");
        } catch {
          // no-op
        }
      }
    });
  }, [token]);

  const refreshOfflineState = async () => {
    const [size, pendingConflicts, breakdown] = await Promise.all([queueSize(), getConflicts(), queueBreakdown()]);
    setPendingSyncCount(size);
    setConflicts(pendingConflicts);
    setQueuedVisitCount(breakdown.visits);
    setQueuedFeedbackCount(breakdown.feedback);
  };

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

    const clientReferenceId = crypto.randomUUID();
    const payload: SyncVisitRequest = {
      clientReferenceId,
      doctorId: selectedDoctor.id,
      visitTime: new Date(visitTime).toISOString(),
      outcome: outcome.trim(),
      notes: notes.trim(),
      followUpRequired,
    };

    if (!navigator.onLine) {
      await queueVisit(payload);
      localStorage.removeItem(visitDraftKey(username, selectedDoctor.id));
      await refreshOfflineState();
      setOutcome("");
      setNotes("");
      setFollowUpRequired(false);
      setVisitTime(new Date().toISOString().slice(0, 16));
      setStatus("Offline: visit queued for sync");
      return;
    }

    try {
      await createVisit(token, payload);
      localStorage.removeItem(visitDraftKey(username, selectedDoctor.id));
      setOutcome("");
      setNotes("");
      setFollowUpRequired(false);
      setVisitTime(new Date().toISOString().slice(0, 16));
      setStatus("Visit logged");
      await refreshSelectedDoctorVisits();
    } catch {
      await queueVisit(payload);
      localStorage.removeItem(visitDraftKey(username, selectedDoctor.id));
      await refreshOfflineState();
      setOutcome("");
      setNotes("");
      setFollowUpRequired(false);
      setVisitTime(new Date().toISOString().slice(0, 16));
      setStatus("Network issue: visit queued for sync");
    }
  };

  const submitFeedback = async (
    recommendation: NbaRecommendation,
    feedback: Omit<SyncFeedbackRequest, "clientReferenceId" | "recommendationId">
  ) => {
    if (!token) return;
    const queued: SyncFeedbackRequest = {
      clientReferenceId: crypto.randomUUID(),
      recommendationId: recommendation.recommendationId,
      ...feedback,
    };

    if (!navigator.onLine) {
      await queueFeedback(queued);
      await refreshOfflineState();
      setStatus("Offline: feedback queued for sync");
      return;
    }

    try {
      await submitRecommendationFeedback(token, recommendation.recommendationId, queued);
      setStatus("Feedback submitted");
    } catch {
      await queueFeedback(queued);
      await refreshOfflineState();
      setStatus("Feedback queued due to network issue");
    }
  };

  const syncQueued = async (authToken: string, strategy: SyncConflictStrategy) => {
    const visits = await getQueuedVisits();
    const feedback = await getQueuedFeedback();
    if (visits.length === 0 && feedback.length === 0) {
      await refreshOfflineState();
      return;
    }

    try {
      const result = await syncBatch(authToken, { strategy, visits, feedback });
      const appliedVisitRefs = result.visitResults
        .filter((item) => item.status === "APPLIED")
        .map((item) => item.clientReferenceId);
      const appliedFeedbackRefs = result.feedbackResults
        .filter((item) => item.status === "APPLIED")
        .map((item) => item.clientReferenceId);

      await removeQueuedItems(appliedVisitRefs, appliedFeedbackRefs);
      await saveConflicts(result.conflicts);
      await refreshOfflineState();

      const appliedCount = appliedVisitRefs.length + appliedFeedbackRefs.length;
      if (result.conflicts.length > 0) {
        setStatus(`Sync completed with ${result.conflicts.length} conflict(s)`);
      } else {
        setStatus(`Synced ${appliedCount} queued item(s)`);
      }
      await refreshSelectedDoctorVisits();
      await loadNextActions(authToken);
    } catch {
      setStatus("Batch sync failed");
    }
  };

  const handleSync = async () => {
    if (!token) return;
    await syncQueued(token, syncStrategy);
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
      if (!navigator.onLine) {
        const cached = await getCachedNbaSnapshot();
        if (cached) {
          setNextActions(cached.recommendations);
          setStatus(`Offline snapshot loaded (${new Date(cached.savedAt).toLocaleTimeString()})`);
        } else {
          setNextActions([]);
          setStatus("Offline and no cached NBA snapshot");
        }
        return;
      }

      const result = await fetchNbaNext(authToken, 5);
      setNextActions(result.recommendations);
      await cacheNbaSnapshot(result.recommendations);
    } catch {
      const cached = await getCachedNbaSnapshot();
      if (cached) {
        setNextActions(cached.recommendations);
        setStatus("Using cached NBA snapshot");
      } else {
        setNextActions([]);
        setStatus("Failed to load next-best actions");
      }
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
      <div className="page-header">
        <div>
          <h1>MR Workspace</h1>
          <p className="muted">Role: {role ?? "MR"}</p>
        </div>
        <div className="header-actions">
          <Badge label="Territory" value={myTerritories[0]?.name ?? "Unassigned"} />
          <Badge label="Pending Sync" value={`${pendingSyncCount}`} />
          <Button className="ghost" onClick={handleSync}>
            Sync Queue
          </Button>
          <Button className="ghost" onClick={handlePing}>
            Test API
          </Button>
        </div>
      </div>

      <Card>
        <SectionTitle title="What next?" subtitle="Ranked recommendations with feedback actions." />
        <div className="chips">
          <Pill>Queued visits: {queuedVisitCount}</Pill>
          <Pill>Queued feedback: {queuedFeedbackCount}</Pill>
          <Pill>Conflicts: {conflicts.length}</Pill>
        </div>
        <div className="filters">
          <Field label="Conflict Strategy">
            <select value={syncStrategy} onChange={(e) => setSyncStrategy(e.target.value as SyncConflictStrategy)}>
              <option value="SERVER_WINS">Server wins</option>
              <option value="CLIENT_WINS">Client wins</option>
            </select>
          </Field>
          <Button className="ghost" onClick={handleRefreshNextActions}>
            Refresh Snapshot
          </Button>
          <Button className="ghost" onClick={handleSync}>
            Retry Sync
          </Button>
        </div>

        {conflicts.length > 0 && (
          <div className="table-list">
            <strong>Sync conflicts</strong>
            {conflicts.map((conflict) => (
              <div key={`${conflict.type}-${conflict.clientReferenceId}`} className="table-row">
                <div>
                  <strong>{conflict.type}</strong>
                  <p className="muted">{conflict.reason}</p>
                </div>
                <Pill>{conflict.clientReferenceId}</Pill>
              </div>
            ))}
          </div>
        )}

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
                <div className="row-actions wrap">
                  <Button
                    className="ghost"
                    onClick={() => void submitFeedback(item, { status: "DONE", reason: "Completed as recommended" })}
                  >
                    Done
                  </Button>
                  <Button
                    className="ghost"
                    onClick={() => void submitFeedback(item, { status: "SKIPPED", reason: "Skipped in field" })}
                  >
                    Skipped
                  </Button>
                  <Button
                    className="ghost"
                    onClick={() =>
                      void submitFeedback(item, {
                        status: "RESCHEDULED",
                        reason: "Rescheduled in field",
                        rescheduledTo: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                      })
                    }
                  >
                    Reschedule +1 day
                  </Button>
                  {selectedDoctor && selectedDoctor.id !== item.doctorId && (
                    <Button
                      className="ghost"
                      onClick={() =>
                        void submitFeedback(item, {
                          status: "SKIPPED",
                          reason: "Overridden to another doctor",
                          overrideDoctorId: selectedDoctor.id,
                          overrideNotes: `Override to ${selectedDoctor.fullName}`,
                        })
                      }
                    >
                      Override to selected doctor
                    </Button>
                  )}
                </div>
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

                <SectionTitle title="Log Visit" subtitle="Offline queue enabled." />
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
