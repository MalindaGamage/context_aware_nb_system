import { useEffect, useMemo, useState } from "react";
import {
  fetchManagerAnalytics,
  fetchMrSummaries,
  fetchTerritoryOverview,
  type ManagerAnalyticsResponse,
  type TerritoryOverview,
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
  const [analytics, setAnalytics] = useState<ManagerAnalyticsResponse>(defaultAnalytics);
  const [overview, setOverview] = useState<TerritoryOverview[]>([]);
  const [mrs, setMrs] = useState<UserSummary[]>([]);
  const [mrId, setMrId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  useEffect(() => {
    if (!token) return;
    fetchMrSummaries(token).then(setMrs).catch(() => setMrs([]));
  }, [token]);

  useEffect(() => {
    if (!token) return;
    fetchManagerAnalytics(token, {
      mrId: mrId || undefined,
      from: from || undefined,
      to: to || undefined,
    })
      .then(setAnalytics)
      .catch(() => setAnalytics(defaultAnalytics));

    fetchTerritoryOverview(token, { from: from || undefined, to: to || undefined })
      .then(setOverview)
      .catch(() => setOverview([]));
  }, [token, mrId, from, to]);

  const totalVisitsMtd = useMemo(
    () => analytics.coverageByTier.reduce((sum, row) => sum + row.totalVisits, 0),
    [analytics]
  );

  const avgCoverage = useMemo(() => {
    if (overview.length === 0) return 0;
    const sum = overview.reduce((acc, row) => {
      const coverage = row.doctorCount === 0 ? 0 : (row.visitCount / row.doctorCount) * 100;
      return acc + coverage;
    }, 0);
    return sum / overview.length;
  }, [overview]);

  const donutStyle = {
    background: `conic-gradient(#0f8b80 0 ${analytics.compliance.doneRate}%, #2563eb ${analytics.compliance.doneRate}% ${analytics.compliance.doneRate + 15}%, #dc2626 ${analytics.compliance.doneRate + 15}% ${analytics.compliance.doneRate + 27}%, #f59e0b ${analytics.compliance.doneRate + 27}% 100%)`,
  };

  const weeklySeries = [
    Math.round(totalVisitsMtd * 0.22),
    Math.round(totalVisitsMtd * 0.27),
    Math.round(totalVisitsMtd * 0.2),
    Math.round(totalVisitsMtd * 0.31),
  ];

  if (!token) return null;

  return (
    <div className="pn-page">
      <div className="pn-header">
        <div>
          <h1>Manager Dashboard</h1>
          <p>Territory coverage analytics and coaching insights</p>
        </div>
      </div>

      <div className="filters">
        <Field label="MR">
          <select value={mrId} onChange={(event) => setMrId(event.target.value)}>
            <option value="">All MRs</option>
            {mrs.map((mr) => (
              <option key={mr.id} value={mr.id}>{mr.fullName}</option>
            ))}
          </select>
        </Field>
        <Field label="From">
          <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
        </Field>
        <Field label="To">
          <input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
        </Field>
        <Button className="ghost" onClick={() => { setMrId(""); setFrom(""); setTo(""); }}>
          Reset
        </Button>
      </div>

      <div className="pn-kpi-grid">
        <Card><div className="pn-kpi"><span>Total Visits (MTD)</span><strong>{totalVisitsMtd}</strong><em>+12%</em></div></Card>
        <Card><div className="pn-kpi"><span>NBA Acceptance Rate</span><strong>{analytics.compliance.doneRate.toFixed(0)}%</strong><em>+3%</em></div></Card>
        <Card><div className="pn-kpi"><span>Avg Coverage Score</span><strong>{avgCoverage.toFixed(0)}%</strong><em>-2%</em></div></Card>
        <Card><div className="pn-kpi"><span>Active MRs</span><strong>{analytics.complianceByMr.length}</strong><em>live</em></div></Card>
      </div>

      <div className="pn-manager-grid">
        <Card>
          <SectionTitle title="Territory Coverage" />
          {overview.map((row) => {
            const pct = row.doctorCount === 0 ? 0 : Math.round((row.visitCount / row.doctorCount) * 100);
            return (
              <div key={row.territoryId} className="pn-territory-line">
                <div className="row-actions" style={{ justifyContent: "space-between" }}>
                  <strong>{row.territoryName}</strong>
                  <span className="muted">{pct}%</span>
                </div>
                <div className="bar-track"><div className="bar-fill" style={{ width: `${pct}%` }} /></div>
              </div>
            );
          })}
        </Card>

        <Card>
          <SectionTitle title="NBA Compliance Breakdown" />
          <div className="pn-donut-wrap">
            <div className="pn-donut" style={donutStyle} />
            <div className="pn-legend">
              <div><span className="dot accepted" /> Accepted {analytics.compliance.doneRate.toFixed(0)}%</div>
              <div><span className="dot modified" /> Modified 15%</div>
              <div><span className="dot skipped" /> Skipped {Math.max(0, 100 - analytics.compliance.doneRate - 20).toFixed(0)}%</div>
              <div><span className="dot rescheduled" /> Rescheduled 5%</div>
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <SectionTitle title="Weekly Visit Trends" />
        <div className="pn-weekly-bars">
          {weeklySeries.map((value, idx) => (
            <div key={idx} className="pn-week-col">
              <div className="pn-week-bar" style={{ height: `${Math.max(20, value)}px` }} />
              <span>W{idx + 1}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <SectionTitle title="Missed High-Priority Doctors" />
        <div className="table-list">
          {analytics.missedHighPriority.map((item) => (
            <div key={item.doctorId} className="table-row">
              <div>
                <strong>{item.doctorName}</strong>
                <p className="muted">{item.territoryName || "N/A"}</p>
              </div>
              <div className="chips">
                <Pill>Priority {item.priorityScore}</Pill>
                <Pill>{item.lastVisitTime ? `${Math.max(0, Math.round((Date.now() - new Date(item.lastVisitTime).getTime()) / 86400000))} days since last visit` : "Never visited"}</Pill>
              </div>
            </div>
          ))}
          {analytics.missedHighPriority.length === 0 && <p className="muted">No missed high-priority doctors.</p>}
        </div>
      </Card>
    </div>
  );
}
