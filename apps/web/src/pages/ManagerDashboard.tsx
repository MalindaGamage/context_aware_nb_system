import { useEffect, useState } from "react";
import { fetchMrSummaries, type UserSummary } from "../api";
import { useAuth } from "../auth/AuthContext";
import { Card, Pill, SectionTitle } from "../ui/components";

export default function ManagerDashboard() {
  const { token } = useAuth();
  const [mrSummaries, setMrSummaries] = useState<UserSummary[]>([]);

  useEffect(() => {
    if (!token) return;
    fetchMrSummaries(token).then(setMrSummaries).catch(() => setMrSummaries([]));
  }, [token]);

  return (
    <div className="page">
      <SectionTitle title="Manager Portal" subtitle="Territory coverage snapshot by MR." />
      <div className="manager-grid">
        {mrSummaries.map((mr) => (
          <Card key={mr.id} className="manager-card">
            <h3>{mr.fullName}</h3>
            <p className="muted">{mr.email}</p>
            <div className="chips">
              {mr.territories.length === 0 && <Pill>No territories</Pill>}
              {mr.territories.map((t) => (
                <Pill key={t.id}>{t.name}</Pill>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
