import { useEffect, useMemo, useState } from "react";
import { fetchDoctors, type Doctor } from "../api";
import { useAuth } from "../auth/AuthContext";
import { Card, Pill } from "../ui/components";

const tierOrder = ["A", "B", "C"];

export default function DoctorDirectoryPage() {
  const { token } = useAuth();
  const [allDoctors, setAllDoctors] = useState<Doctor[]>([]);
  const [search, setSearch] = useState("");
  const [tierFilter, setTierFilter] = useState("");

  useEffect(() => {
    if (!token) return;
    fetchDoctors(token, { size: 200 })
      .then((result) => setAllDoctors(result.content))
      .catch(() => setAllDoctors([]));
  }, [token]);

  const doctors = useMemo(() => {
    let filtered = allDoctors;
    if (tierFilter) filtered = filtered.filter((doctor) => doctor.tier === tierFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      filtered = filtered.filter((doctor) =>
        doctor.fullName.toLowerCase().includes(q) || (doctor.specialty || "").toLowerCase().includes(q)
      );
    }
    return filtered;
  }, [allDoctors, search, tierFilter]);

  if (!token) return null;

  return (
    <div className="pn-page">
      <div className="pn-header">
        <div>
          <h1>Doctor Directory</h1>
          <p>{doctors.length} physicians across all territories</p>
        </div>
      </div>

      <div className="pn-directory-filters">
        <input
          placeholder="Search doctors by name or specialty..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <div className="chips">
          <button className={`pn-chip-btn ${tierFilter === "" ? "active" : ""}`} onClick={() => setTierFilter("")}>All</button>
          {tierOrder.map((tier) => (
            <button key={tier} className={`pn-chip-btn ${tierFilter === tier ? "active" : ""}`} onClick={() => setTierFilter(tier)}>
              Tier {tier}
            </button>
          ))}
        </div>
      </div>

      <Card className="pn-table-card">
        <table className="pn-table">
          <thead>
            <tr>
              <th>Doctor</th>
              <th>Specialty</th>
              <th>Tier</th>
              <th>Territory</th>
              <th>Priority</th>
              <th>Contact</th>
            </tr>
          </thead>
          <tbody>
            {doctors.map((doctor) => (
              <tr key={doctor.id}>
                <td>
                  <strong>{doctor.fullName}</strong>
                  <div className="muted">{doctor.notes || "No additional address data"}</div>
                </td>
                <td>{doctor.specialty || "General Practitioner"}</td>
                <td><Pill>{doctor.tier}</Pill></td>
                <td>{doctor.territoryId ? "Assigned" : "Unassigned"}</td>
                <td>{doctor.priorityScore}</td>
                <td>Call | Email</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
