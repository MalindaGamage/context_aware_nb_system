import { useEffect, useMemo, useState } from "react";
import {
  fetchDoctors,
  fetchMyTerritories,
  fetchMyVisits,
  fetchNbaNext,
  submitRecommendationFeedback,
  syncBatch,
  type NbaRecommendation,
  type SyncConflict,
  type SyncConflictStrategy,
  type SyncFeedbackRequest,
  type Territory,
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
  removeQueuedItems,
  saveConflicts,
} from "../offline/queue";
import { Button, Card, Pill } from "../ui/components";

export default function NbaDashboardPage() {
  const { token, username } = useAuth();
  const [territories, setTerritories] = useState<Territory[]>([]);
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

  const greetingName = useMemo(() => {
    const normalized = username.replace(/[0-9]/g, "").trim();
    if (!normalized) return "User";
    return normalized.charAt(0).toUpperCase() + normalized.slice(1);
  }, [username]);

  const load = async (authToken: string) => {
    try {
      const [myTerritories, doctorPage, visitsPage] = await Promise.all([
        fetchMyTerritories(authToken),
        fetchDoctors(authToken, { size: 100 }),
        fetchMyVisits(authToken, 0, 100),
      ]);
      setTerritories(myTerritories);
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

  useEffect(() => {
    if (!token) return;
    void load(token);
    void loadRecommendations(token);
    void refreshOffline();
  }, [token]);

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

  if (!token) return null;

  return (
    <div className="pn-page">
      <div className="pn-header">
        <div>
          <h1>Good Morning, {greetingName}</h1>
          <p>
            Here are your next best actions for today
            {territories[0] ? ` — ${territories[0].name} Territory` : ""}
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
