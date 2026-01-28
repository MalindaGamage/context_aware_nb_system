import { useEffect, useMemo, useState } from "react";
import {
  fetchDoctors,
  fetchNearbyDoctors,
  fetchMyTerritories,
  fetchSecurePing,
  fetchTerritories,
  type Doctor,
  type Territory,
} from "../api";
import { useAuth } from "../auth/AuthContext";
import { Badge, Button, Card, Field, Pill, SectionTitle } from "../ui/components";

export default function MrDashboard() {
  const { token, role } = useAuth();
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [myTerritories, setMyTerritories] = useState<Territory[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [tier, setTier] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [territoryId, setTerritoryId] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (!token) return;
    fetchTerritories(token).then(setTerritories).catch(() => setTerritories([]));
    fetchMyTerritories(token).then(setMyTerritories).catch(() => setMyTerritories([]));
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

  const handleNearby = async () => {
    if (!token) return;
    setStatus("Fetching nearby doctors...");
    try {
      const nearby = await fetchNearbyDoctors(token, 6.9271, 79.8612, 5);
      setDoctors(nearby);
      setStatus("Nearby doctors loaded");
    } catch {
      setStatus("Failed to fetch nearby doctors");
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

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>MR Workspace</h1>
          <p className="muted">Role: {role ?? "MR"}</p>
        </div>
        <div className="header-actions">
          <Badge label="Territory" value={myTerritories[0]?.name ?? "Unassigned"} />
          <Button className="ghost" onClick={handlePing}>
            Test API
          </Button>
        </div>
      </div>

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
              <option value="">All territories</option>
              {territories.map((t) => (
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
