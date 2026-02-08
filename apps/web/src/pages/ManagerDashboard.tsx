import { useEffect, useMemo, useState } from "react";
import {
  fetchManagerAnalytics,
  fetchMrSummaries,
  fetchTerritories,
  type ManagerAnalyticsResponse,
  type Territory,
  type UserSummary,
} from "../api";
import { useAuth } from "../auth/AuthContext";
import { Button, Card, Field, Pill, SectionTitle } from "../ui/components";

const defaultAnalytics: ManagerAnalyticsResponse = {
  coverageByTier: [],
  missedHighPriority: [],
  compliance: {
    totalFeedback: 0,
    doneCount: 0,
    skippedCount: 0,
    rescheduledCount: 0,
    overrideCount: 0,
    doneRate: 0,
    overrideRate: 0,
  },
  complianceByMr: [],
};

export default function ManagerDashboard() {
  const { token } = useAuth();
  const [mrs, setMrs] = useState<UserSummary[]>([]);
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [analytics, setAnalytics] = useState<ManagerAnalyticsResponse>(defaultAnalytics);
  const [mrId, setMrId] = useState("");
  const [territoryId, setTerritoryId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (!token) return;
    fetchMrSummaries(token).then(setMrs).catch(() => setMrs([]));
    fetchTerritories(token).then(setTerritories).catch(() => setTerritories([]));
  }, [token]);

  useEffect(() => {
    if (!token) return;
    fetchManagerAnalytics(token, {
      mrId: mrId || undefined,
      territoryId: territoryId || undefined,
      from: from || undefined,
      to: to || undefined,
    })
      .then((data) => {
        setAnalytics(data);
        setStatus("");
      })
      .catch(() => {
        setAnalytics(defaultAnalytics);
        setStatus("Failed to load manager analytics");
      });
  }, [token, mrId, territoryId, from, to]);

  const coachingCount = useMemo(
    () => analytics.complianceByMr.filter((row) => row.overrideRate >= 30 || row.skippedRate >= 30).length,
    [analytics]
  );

  if (!token) return null;

  return (
    <div className="page">
      <SectionTitle title="Manager Dashboard" subtitle="Coverage, compliance, and coaching opportunities from live field data." />

      <Card>
        <SectionTitle title="Filters" subtitle="Scope by MR, territory, and reporting range." />
        <div className="filters">
          <Field label="MR">
            <select value={mrId} onChange={(e) => setMrId(e.target.value)}>
              <option value="">All MRs</option>
              {mrs.map((mr) => (
                <option key={mr.id} value={mr.id}>
                  {mr.fullName}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Territory">
            <select value={territoryId} onChange={(e) => setTerritoryId(e.target.value)}>
              <option value="">All territories</option>
              {territories.map((territory) => (
                <option key={territory.id} value={territory.id}>
                  {territory.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="From">
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label="To">
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </Field>
          <Button
            className="ghost"
            onClick={() => {
              setMrId("");
              setTerritoryId("");
              setFrom("");
              setTo("");
            }}
          >
            Reset
          </Button>
        </div>
      </Card>

      <div className="manager-grid">
        <Card>
          <SectionTitle title="Done Rate" />
          <h2>{analytics.compliance.doneRate.toFixed(1)}%</h2>
          <p className="muted">{analytics.compliance.doneCount} completed actions</p>
        </Card>
        <Card>
          <SectionTitle title="Override Rate" />
          <h2>{analytics.compliance.overrideRate.toFixed(1)}%</h2>
          <p className="muted">{analytics.compliance.overrideCount} overrides captured</p>
        </Card>
        <Card>
          <SectionTitle title="Missed High Priority" />
          <h2>{analytics.missedHighPriority.length}</h2>
          <p className="muted">High-priority doctors without visits in range</p>
        </Card>
        <Card>
          <SectionTitle title="Coaching Signals" />
          <h2>{coachingCount}</h2>
          <p className="muted">MRs with high override/skipped behavior</p>
        </Card>
      </div>

      <Card>
        <SectionTitle title="Coverage by Tier" subtitle="Frequency and recency across doctor tiers." />
        <div className="table-list">
          {analytics.coverageByTier.map((row) => {
            const coveragePct = row.doctorCount === 0 ? 0 : Math.round((row.visitedDoctors / row.doctorCount) * 100);
            return (
              <div key={row.tier} className="table-row">
                <div>
                  <strong>Tier {row.tier}</strong>
                  <p className="muted">
                    {row.visitedDoctors}/{row.doctorCount} doctors visited | {row.totalVisits} visits | Avg/doctor {row.avgVisitsPerDoctor}
                  </p>
                  <div className="bar-track">
                    <div className="bar-fill" style={{ width: `${coveragePct}%` }} />
                  </div>
                </div>
                <div className="chips">
                  <Pill>{coveragePct}% coverage</Pill>
                  <Pill>
                    Recency {row.avgDaysSinceLastVisit == null ? "N/A" : `${row.avgDaysSinceLastVisit.toFixed(1)}d`}
                  </Pill>
                </div>
              </div>
            );
          })}
          {analytics.coverageByTier.length === 0 && <p className="muted">No coverage rows for current filters.</p>}
        </div>
      </Card>

      <Card>
        <SectionTitle title="Missed High-Priority Doctors" subtitle="Doctors with priority >= 80 and no visits in selected range." />
        <div className="table-list">
          {analytics.missedHighPriority.map((row) => (
            <div key={row.doctorId} className="table-row">
              <div>
                <strong>{row.doctorName}</strong>
                <p className="muted">
                  Tier {row.tier} | Territory {row.territoryName ?? "N/A"}
                </p>
                <p className="muted">
                  Last visit: {row.lastVisitTime ? new Date(row.lastVisitTime).toLocaleString() : "Never"}
                </p>
              </div>
              <Pill>Priority {row.priorityScore}</Pill>
            </div>
          ))}
          {analytics.missedHighPriority.length === 0 && <p className="muted">No missed high-priority doctors in this scope.</p>}
        </div>
      </Card>

      <Card>
        <SectionTitle title="Compliance by MR" subtitle="Identify coaching opportunities from behavior patterns." />
        <div className="table-list">
          {analytics.complianceByMr.map((row) => (
            <div key={row.mrId} className="table-row">
              <div>
                <strong>{row.mrName}</strong>
                <p className="muted">Feedback events: {row.feedbackCount}</p>
              </div>
              <div className="chips">
                <Pill>Done {row.doneRate.toFixed(1)}%</Pill>
                <Pill>Override {row.overrideRate.toFixed(1)}%</Pill>
                <Pill>Skipped {row.skippedRate.toFixed(1)}%</Pill>
              </div>
            </div>
          ))}
          {analytics.complianceByMr.length === 0 && <p className="muted">No MR compliance rows for current filters.</p>}
        </div>
      </Card>

      {status && <div className="toast">{status}</div>}
    </div>
  );
}