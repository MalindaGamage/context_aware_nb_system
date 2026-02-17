import { useEffect, useState } from "react";
import { fetchTerritoryOverview, type TerritoryOverview } from "../api";
import { useAuth } from "../auth/AuthContext";
import { Button, Card, Field, Pill, SectionTitle } from "../ui/components";

export default function ManagerTerritoryOverview() {
  const { token } = useAuth();
  const [rows, setRows] = useState<TerritoryOverview[]>([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [status, setStatus] = useState("");

  const load = async () => {
    if (!token) return;
    try {
      setRows(await fetchTerritoryOverview(token, { from: from || undefined, to: to || undefined }));
      setStatus("");
    } catch {
      setRows([]);
      setStatus("Failed to load territory overview");
    }
  };

  useEffect(() => {
    void load();
  }, [token, from, to]);

  if (!token) return null;

  return (
    <div className="page">
      <Card>
        <SectionTitle title="Territory Overview" subtitle="Coverage and activity by territory." />
        <div className="filters">
          <Field label="From">
            <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
          </Field>
          <Field label="To">
            <input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
          </Field>
          <Button className="ghost" onClick={() => {
            setFrom("");
            setTo("");
          }}>
            Reset
          </Button>
        </div>

        <div className="table-list">
          {rows.map((row) => (
            <div key={row.territoryId} className="table-row">
              <div>
                <strong>{row.territoryName}</strong>
                <p className="muted">{row.territoryCode}</p>
                <p className="muted">
                  Last visit: {row.lastVisitTime ? new Date(row.lastVisitTime).toLocaleString() : "No visits"}
                </p>
              </div>
              <div className="chips">
                <Pill>MRs {row.assignedMrCount}</Pill>
                <Pill>Doctors {row.doctorCount}</Pill>
                <Pill>Visits {row.visitCount}</Pill>
              </div>
            </div>
          ))}
          {rows.length === 0 && <p className="muted">No territories found for current filters.</p>}
        </div>
      </Card>
      {status && <div className="toast">{status}</div>}
    </div>
  );
}
