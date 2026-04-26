import { useEffect, useMemo, useState } from "react";
import {
  assignTerritoryToMr,
  createTerritory,
  fetchMrSummaries,
  fetchTerritoryOverview,
  type CreateTerritoryRequest,
  type TerritoryOverview,
  type UserSummary,
} from "../api";
import { useAuth } from "../auth/AuthContext";
import { Button, Card, Field, Pill } from "../ui/components";

const emptyTerritoryForm: CreateTerritoryRequest = { name: "", code: "" };

export default function TerritoriesPage() {
  const { token } = useAuth();
  const [rows, setRows] = useState<TerritoryOverview[]>([]);
  const [mrs, setMrs] = useState<UserSummary[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [territoryForm, setTerritoryForm] = useState<CreateTerritoryRequest>(emptyTerritoryForm);
  const [assignSelection, setAssignSelection] = useState<Record<string, string>>({});
  const [status, setStatus] = useState("");

  const loadData = async () => {
    if (!token) return;
    try {
      const [overview, users] = await Promise.all([fetchTerritoryOverview(token, {}), fetchMrSummaries(token)]);
      setRows(overview);
      setMrs(users);
    } catch {
      setRows([]);
      setMrs([]);
      setStatus("Failed to load territory data");
    }
  };

  useEffect(() => {
    void loadData();
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

  const saveTerritory = async () => {
    const request = {
      name: territoryForm.name.trim(),
      code: territoryForm.code.trim().toUpperCase(),
    };
    if (!request.name || !request.code) {
      setStatus("Enter territory name and code");
      return;
    }

    try {
      await createTerritory(token, request);
      setTerritoryForm(emptyTerritoryForm);
      setShowCreateForm(false);
      setStatus("Territory created");
      await loadData();
    } catch {
      setStatus("Failed to create territory");
    }
  };

  const assignMr = async (territoryId: string) => {
    const mrId = assignSelection[territoryId];
    if (!mrId) {
      setStatus("Select an MR to assign");
      return;
    }

    try {
      await assignTerritoryToMr(token, mrId, { territoryId });
      setAssignSelection((current) => ({ ...current, [territoryId]: "" }));
      setStatus("MR assigned to territory");
      await loadData();
    } catch {
      setStatus("Failed to assign MR");
    }
  };

  return (
    <div className="pn-page">
      <div className="pn-header">
        <div>
          <h1>Territory Management</h1>
          <p>Manage MR assignments and territory boundaries</p>
        </div>
        <Button onClick={() => setShowCreateForm((visible) => !visible)}>
          {showCreateForm ? "Cancel" : "+ Add Territory"}
        </Button>
      </div>

      {showCreateForm && (
        <Card>
          <div className="inline-form">
            <Field label="Name">
              <input
                value={territoryForm.name}
                onChange={(event) => setTerritoryForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="Walasmulla Area"
              />
            </Field>
            <Field label="Code">
              <input
                value={territoryForm.code}
                onChange={(event) =>
                  setTerritoryForm((current) => ({ ...current, code: event.target.value.toUpperCase() }))
                }
                placeholder="WAL-A"
              />
            </Field>
            <Button onClick={saveTerritory}>Create</Button>
          </div>
        </Card>
      )}

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
              <div className="pn-territory-assign">
                <select
                  value={assignSelection[row.territoryId] ?? ""}
                  onChange={(event) =>
                    setAssignSelection((current) => ({ ...current, [row.territoryId]: event.target.value }))
                  }
                >
                  <option value="">Select MR</option>
                  {mrs.map((mr) => (
                    <option key={mr.id} value={mr.id}>
                      {mr.fullName}
                    </option>
                  ))}
                </select>
                <Button onClick={() => assignMr(row.territoryId)}>Assign MR</Button>
              </div>
            </Card>
          );
        })}
      </div>

      {status && <div className="toast">{status}</div>}
    </div>
  );
}
