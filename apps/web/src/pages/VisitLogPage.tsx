import { useEffect, useMemo, useState } from "react";
import { fetchMyVisits, type Visit } from "../api";
import { useAuth } from "../auth/AuthContext";
import { Button, Card, Pill } from "../ui/components";

function statusForVisit(visit: Visit): "Completed" | "Skipped" | "Rescheduled" {
  const value = visit.outcome.toLowerCase();
  if (value.includes("skip")) return "Skipped";
  if (value.includes("resched")) return "Rescheduled";
  return "Completed";
}

export default function VisitLogPage() {
  const { token } = useAuth();
  const [visits, setVisits] = useState<Visit[]>([]);
  const [statusFilter, setStatusFilter] = useState("All");

  useEffect(() => {
    if (!token) return;
    fetchMyVisits(token, 0, 100).then((result) => setVisits(result.content)).catch(() => setVisits([]));
  }, [token]);

  const filtered = useMemo(() => {
    if (statusFilter === "All") return visits;
    return visits.filter((visit) => statusForVisit(visit) === statusFilter);
  }, [visits, statusFilter]);

  if (!token) return null;

  return (
    <div className="pn-page">
      <div className="pn-header">
        <div>
          <h1>Visit Log</h1>
          <p>Recent physician interactions and outcomes</p>
        </div>
        <div className="chips">
          {["All", "Completed", "Skipped", "Rescheduled"].map((item) => (
            <button key={item} className={`pn-chip-btn ${statusFilter === item ? "active" : ""}`} onClick={() => setStatusFilter(item)}>
              {item}
            </button>
          ))}
          <Button className="ghost">Filter</Button>
        </div>
      </div>

      <div className="pn-list">
        {filtered.map((visit) => {
          const status = statusForVisit(visit);
          return (
            <Card key={visit.id} className="pn-visit-row">
              <div className="pn-visit-icon">{status === "Completed" ? "✓" : status === "Skipped" ? "x" : "↻"}</div>
              <div className="pn-visit-content">
                <div className="row-actions">
                  <strong>{visit.outcome}</strong>
                  <Pill>{status}</Pill>
                  {visit.followUpRequired && <Pill>Follow-up</Pill>}
                </div>
                <p className="muted">Doctor ID: {visit.doctorId}</p>
                <div className="pn-visit-meta">
                  <span>{new Date(visit.visitTime).toLocaleDateString()}</span>
                  <span>{new Date(visit.visitTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                  <span>{visit.notes || "No notes"}</span>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
