import { useEffect, useMemo, useState } from "react";
import { fetchMrSummaries, type UserSummary } from "../api";
import { useAuth } from "../auth/AuthContext";
import { Card, Pill, SectionTitle } from "../ui/components";

export default function ManagerDashboard() {
  const { token } = useAuth();
  const [mrs, setMrs] = useState<UserSummary[]>([]);
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (!token) return;
    fetchMrSummaries(token)
      .then((data) => {
        setMrs(data);
        setStatus("");
      })
      .catch(() => {
        setMrs([]);
        setStatus("Failed to load MR summaries");
      });
  }, [token]);

  const summary = useMemo(() => {
    const totalAssignments = mrs.reduce((count, mr) => count + mr.territories.length, 0);
    const unassigned = mrs.filter((mr) => mr.territories.length === 0).length;
    return { totalAssignments, unassigned };
  }, [mrs]);

  if (!token) return null;

  return (
    <div className="page">
      <SectionTitle
        title="Manager Portal"
        subtitle="MR list with territory assignment coverage."
      />
      <div className="manager-grid">
        <Card>
          <SectionTitle title="MR Count" />
          <h2>{mrs.length}</h2>
        </Card>
        <Card>
          <SectionTitle title="Assignments" />
          <h2>{summary.totalAssignments}</h2>
        </Card>
        <Card>
          <SectionTitle title="Unassigned MRs" />
          <h2>{summary.unassigned}</h2>
        </Card>
      </div>

      <Card>
        <SectionTitle title="MR Territory Summary" />
        <div className="table-list">
          {mrs.map((mr) => (
            <div key={mr.id} className="profile-card">
              <div>
                <strong>{mr.fullName}</strong>
                <p className="muted">{mr.email}</p>
              </div>
              <div className="chips">
                {mr.territories.length === 0 && <Pill>No territories</Pill>}
                {mr.territories.map((territory) => (
                  <Pill key={territory.id}>{territory.name}</Pill>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>
      {status && <div className="toast">{status}</div>}
    </div>
  );
}
