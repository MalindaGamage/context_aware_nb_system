import { useEffect, useMemo, useState } from "react";
import { fetchMrSummaries, fetchTerritoryOverview, type TerritoryOverview, type UserSummary } from "../api";
import { useAuth } from "../auth/AuthContext";
import { Button, Card, Pill } from "../ui/components";

export default function TerritoriesPage() {
  const { token } = useAuth();
  const [rows, setRows] = useState<TerritoryOverview[]>([]);
  const [mrs, setMrs] = useState<UserSummary[]>([]);
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (!token) return;
    Promise.all([fetchTerritoryOverview(token, {}), fetchMrSummaries(token)])
      .then(([overview, users]) => {
        setRows(overview);
        setMrs(users);
      })
      .catch(() => {
        setRows([]);
        setMrs([]);
        setStatus("Failed to load territory data");
      });
  }, [token]);

  const mrByTerritory = useMemo(() => {
    const map = new Map<string, UserSummary[]>();
    for (const mr of mrs) {
      for (const territory of mr.territories) {
        const current = map.get(territory.id) ?? [];
        current.push(mr);
        map.set(territory.id, current);
      }
    }
    return map;
  }, [mrs]);

  if (!token) return null;

  return (
    <div className="pn-page">
      <div className="pn-header">
        <div>
          <h1>Territory Management</h1>
          <p>Manage MR assignments and territory boundaries</p>
        </div>
        <Button>+ Add Territory</Button>
      </div>

      <div className="pn-territory-grid">
        {rows.map((row) => {
          const reps = mrByTerritory.get(row.territoryId) ?? [];
          const coverage = row.doctorCount === 0 ? 0 : Math.round((row.visitCount / row.doctorCount) * 100);
          return (
            <Card key={row.territoryId} className="pn-territory-card">
              <div className="pn-territory-head">
                <h3>{row.territoryName}</h3>
                <span>{row.territoryCode}</span>
              </div>
              <div className="pn-territory-kpis">
                <div><strong>{row.doctorCount}</strong><span>Doctors</span></div>
                <div><strong>{row.assignedMrCount}</strong><span>MRs</span></div>
                <div><strong>{coverage}%</strong><span>Coverage</span></div>
              </div>
              <div className="bar-track">
                <div className="bar-fill" style={{ width: `${Math.min(100, coverage)}%` }} />
              </div>
              <div className="pn-rep-list">
                {reps.length === 0 && <p className="muted">No assigned representatives</p>}
                {reps.map((rep) => (
                  <div key={rep.id} className="pn-rep-row">
                    <span>{rep.fullName}</span>
                    <Pill>{rep.territories.length} territories</Pill>
                  </div>
                ))}
              </div>
            </Card>
          );
        })}
      </div>

      {status && <div className="toast">{status}</div>}
    </div>
  );
}
