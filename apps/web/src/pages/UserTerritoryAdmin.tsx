import { useEffect, useMemo, useState } from "react";
import {
  assignTerritoryToMr,
  createManager,
  createMr,
  createTerritory,
  deleteManager,
  deleteMr,
  deleteTerritory,
  fetchManagers,
  fetchMrProfiles,
  fetchTerritories,
  type Territory,
  type UserProfile,
  unassignTerritoryFromMr,
  updateManager,
  updateMr,
  updateTerritory,
} from "../api";
import { Button, Card, Field, Pill, SectionTitle } from "../ui/components";

type Props = {
  token: string;
  canManageManagers: boolean;
  title: string;
  subtitle: string;
};

const emptyForm = { fullName: "", email: "" };
const emptyTerritory = { name: "", code: "" };

export default function UserTerritoryAdmin({ token, canManageManagers, title, subtitle }: Props) {
  const [mrs, setMrs] = useState<UserProfile[]>([]);
  const [managers, setManagers] = useState<UserProfile[]>([]);
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [mrForm, setMrForm] = useState(emptyForm);
  const [managerForm, setManagerForm] = useState(emptyForm);
  const [territoryForm, setTerritoryForm] = useState(emptyTerritory);
  const [editingMrId, setEditingMrId] = useState<string | null>(null);
  const [editingManagerId, setEditingManagerId] = useState<string | null>(null);
  const [editingTerritoryId, setEditingTerritoryId] = useState<string | null>(null);
  const [assignSelection, setAssignSelection] = useState<Record<string, string>>({});
  const [status, setStatus] = useState("");

  const sortedTerritories = useMemo(
    () => [...territories].sort((a, b) => a.name.localeCompare(b.name)),
    [territories]
  );

  const loadData = async () => {
    try {
      const [loadedMrs, loadedTerritories] = await Promise.all([
        fetchMrProfiles(token),
        fetchTerritories(token),
      ]);
      setMrs(loadedMrs);
      setTerritories(loadedTerritories);
      if (canManageManagers) {
        setManagers(await fetchManagers(token));
      }
    } catch {
      setStatus("Failed to load admin data");
    }
  };

  useEffect(() => {
    loadData();
  }, [token]);

  const saveMr = async () => {
    if (!mrForm.fullName || !mrForm.email) return;
    try {
      if (editingMrId) {
        const current = mrs.find((user) => user.id === editingMrId);
        if (!current) return;
        await updateMr(token, editingMrId, {
          fullName: mrForm.fullName,
          email: mrForm.email,
          active: current.active,
        });
        setStatus("MR updated");
      } else {
        await createMr(token, mrForm);
        setStatus("MR created");
      }
      setMrForm(emptyForm);
      setEditingMrId(null);
      await loadData();
    } catch {
      setStatus("Failed to save MR");
    }
  };

  const toggleMrActive = async (user: UserProfile) => {
    try {
      await updateMr(token, user.id, {
        fullName: user.fullName,
        email: user.email,
        active: !user.active,
      });
      setStatus("MR updated");
      await loadData();
    } catch {
      setStatus("Failed to update MR");
    }
  };

  const removeMr = async (userId: string) => {
    try {
      await deleteMr(token, userId);
      setStatus("MR deleted");
      await loadData();
    } catch {
      setStatus("Failed to delete MR");
    }
  };

  const saveManager = async () => {
    if (!managerForm.fullName || !managerForm.email) return;
    try {
      if (editingManagerId) {
        const current = managers.find((user) => user.id === editingManagerId);
        if (!current) return;
        await updateManager(token, editingManagerId, {
          fullName: managerForm.fullName,
          email: managerForm.email,
          active: current.active,
        });
        setStatus("Manager updated");
      } else {
        await createManager(token, managerForm);
        setStatus("Manager created");
      }
      setManagerForm(emptyForm);
      setEditingManagerId(null);
      await loadData();
    } catch {
      setStatus("Failed to save manager");
    }
  };

  const toggleManagerActive = async (user: UserProfile) => {
    try {
      await updateManager(token, user.id, {
        fullName: user.fullName,
        email: user.email,
        active: !user.active,
      });
      setStatus("Manager updated");
      await loadData();
    } catch {
      setStatus("Failed to update manager");
    }
  };

  const removeManager = async (userId: string) => {
    try {
      await deleteManager(token, userId);
      setStatus("Manager deleted");
      await loadData();
    } catch {
      setStatus("Failed to delete manager");
    }
  };

  const saveTerritory = async () => {
    if (!territoryForm.name || !territoryForm.code) return;
    try {
      if (editingTerritoryId) {
        await updateTerritory(token, editingTerritoryId, territoryForm);
        setStatus("Territory updated");
      } else {
        await createTerritory(token, territoryForm);
        setStatus("Territory created");
      }
      setTerritoryForm(emptyTerritory);
      setEditingTerritoryId(null);
      await loadData();
    } catch {
      setStatus("Failed to save territory");
    }
  };

  const removeTerritory = async (territoryId: string) => {
    try {
      await deleteTerritory(token, territoryId);
      setStatus("Territory deleted");
      await loadData();
    } catch {
      setStatus("Failed to delete territory");
    }
  };

  const assignTerritory = async (mrId: string) => {
    const territoryId = assignSelection[mrId];
    if (!territoryId) return;
    try {
      await assignTerritoryToMr(token, mrId, { territoryId });
      setStatus("Territory assigned");
      await loadData();
    } catch {
      setStatus("Failed to assign territory");
    }
  };

  const removeAssignment = async (mrId: string, territoryId: string) => {
    try {
      await unassignTerritoryFromMr(token, mrId, territoryId);
      setStatus("Assignment removed");
      await loadData();
    } catch {
      setStatus("Failed to remove assignment");
    }
  };

  return (
    <div className="page">
      <SectionTitle title={title} subtitle={subtitle} />

      <Card>
        <SectionTitle title="Territories" subtitle="Create, edit, and remove territories." />
        <div className="inline-form">
          <Field label="Name">
            <input
              value={territoryForm.name}
              onChange={(event) => setTerritoryForm((value) => ({ ...value, name: event.target.value }))}
            />
          </Field>
          <Field label="Code">
            <input
              value={territoryForm.code}
              onChange={(event) => setTerritoryForm((value) => ({ ...value, code: event.target.value.toUpperCase() }))}
            />
          </Field>
          <Button onClick={saveTerritory}>{editingTerritoryId ? "Update" : "Create"}</Button>
          {editingTerritoryId && (
            <Button className="ghost" onClick={() => {
              setTerritoryForm(emptyTerritory);
              setEditingTerritoryId(null);
            }}>
              Cancel
            </Button>
          )}
        </div>
        <div className="table-list">
          {sortedTerritories.map((territory) => (
            <div key={territory.id} className="table-row">
              <div>
                <strong>{territory.name}</strong>
                <span className="muted">{territory.code}</span>
              </div>
              <div className="row-actions">
                <Button className="ghost" onClick={() => {
                  setEditingTerritoryId(territory.id);
                  setTerritoryForm({ name: territory.name, code: territory.code });
                }}>
                  Edit
                </Button>
                <Button className="ghost" onClick={() => removeTerritory(territory.id)}>
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <SectionTitle title="Medical Representatives" subtitle="Managers and admins can maintain MR profiles and assignments." />
        <div className="inline-form">
          <Field label="Full Name">
            <input
              value={mrForm.fullName}
              onChange={(event) => setMrForm((value) => ({ ...value, fullName: event.target.value }))}
            />
          </Field>
          <Field label="Email">
            <input
              value={mrForm.email}
              onChange={(event) => setMrForm((value) => ({ ...value, email: event.target.value }))}
            />
          </Field>
          <Button onClick={saveMr}>{editingMrId ? "Update" : "Create"}</Button>
          {editingMrId && (
            <Button className="ghost" onClick={() => {
              setMrForm(emptyForm);
              setEditingMrId(null);
            }}>
              Cancel
            </Button>
          )}
        </div>

        <div className="table-list">
          {mrs.map((mr) => (
            <div key={mr.id} className="profile-card">
              <div>
                <strong>{mr.fullName}</strong>
                <p className="muted">{mr.email}</p>
                <div className="chips">
                  {mr.territories.length === 0 && <Pill>No territories</Pill>}
                  {mr.territories.map((territory) => (
                    <button
                      key={territory.id}
                      className="chip-button"
                      onClick={() => removeAssignment(mr.id, territory.id)}
                    >
                      {territory.name} x
                    </button>
                  ))}
                </div>
              </div>
              <div className="row-actions wrap">
                <Button className="ghost" onClick={() => {
                  setEditingMrId(mr.id);
                  setMrForm({ fullName: mr.fullName, email: mr.email });
                }}>
                  Edit
                </Button>
                <Button className="ghost" onClick={() => toggleMrActive(mr)}>
                  {mr.active ? "Disable" : "Enable"}
                </Button>
                <Button className="ghost" onClick={() => removeMr(mr.id)}>
                  Delete
                </Button>
                <select
                  value={assignSelection[mr.id] ?? ""}
                  onChange={(event) => setAssignSelection((value) => ({ ...value, [mr.id]: event.target.value }))}
                >
                  <option value="">Select territory</option>
                  {sortedTerritories.map((territory) => (
                    <option key={territory.id} value={territory.id}>
                      {territory.name}
                    </option>
                  ))}
                </select>
                <Button onClick={() => assignTerritory(mr.id)}>Assign</Button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {canManageManagers && (
        <Card>
          <SectionTitle title="Managers" subtitle="Admin can maintain manager profiles." />
          <div className="inline-form">
            <Field label="Full Name">
              <input
                value={managerForm.fullName}
                onChange={(event) => setManagerForm((value) => ({ ...value, fullName: event.target.value }))}
              />
            </Field>
            <Field label="Email">
              <input
                value={managerForm.email}
                onChange={(event) => setManagerForm((value) => ({ ...value, email: event.target.value }))}
              />
            </Field>
            <Button onClick={saveManager}>{editingManagerId ? "Update" : "Create"}</Button>
            {editingManagerId && (
              <Button className="ghost" onClick={() => {
                setManagerForm(emptyForm);
                setEditingManagerId(null);
              }}>
                Cancel
              </Button>
            )}
          </div>

          <div className="table-list">
            {managers.map((manager) => (
              <div key={manager.id} className="table-row">
                <div>
                  <strong>{manager.fullName}</strong>
                  <p className="muted">{manager.email}</p>
                </div>
                <div className="row-actions">
                  <Button className="ghost" onClick={() => {
                    setEditingManagerId(manager.id);
                    setManagerForm({ fullName: manager.fullName, email: manager.email });
                  }}>
                    Edit
                  </Button>
                  <Button className="ghost" onClick={() => toggleManagerActive(manager)}>
                    {manager.active ? "Disable" : "Enable"}
                  </Button>
                  <Button className="ghost" onClick={() => removeManager(manager.id)}>
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {status && <div className="toast">{status}</div>}
    </div>
  );
}
