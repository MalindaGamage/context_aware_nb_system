import { useEffect, useMemo, useState } from "react";
import {
  activateScoringConfig,
  createScoringConfig,
  fetchActiveScoringConfig,
  fetchAdminProducts,
  fetchAuditLogs,
  fetchScoringConfigs,
  type AuditLog,
  type ProductSummary,
  type ScoringConfig,
} from "../api";
import { useAuth } from "../auth/AuthContext";
import { Button, Card, Field, Pill } from "../ui/components";

type Tab = "rules" | "products" | "security" | "audit";

const defaultSecurity = {
  enforce2fa: true,
  sessionTimeout: true,
  gpsConsent: true,
  exportRestriction: true,
  retention90d: true,
};

export default function AdminSettingsPage() {
  const { token } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("rules");
  const [configs, setConfigs] = useState<ScoringConfig[]>([]);
  const [activeConfig, setActiveConfig] = useState<ScoringConfig | null>(null);
  const [products, setProducts] = useState<ProductSummary[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [security, setSecurity] = useState(defaultSecurity);
  const [weightsText, setWeightsText] = useState("");
  const [status, setStatus] = useState("");

  const load = async () => {
    if (!token) return;
    try {
      const [loadedConfigs, loadedActive, loadedProducts, loadedAudit] = await Promise.all([
        fetchScoringConfigs(token),
        fetchActiveScoringConfig(token),
        fetchAdminProducts(token),
        fetchAuditLogs(token, { size: 20 }),
      ]);
      setConfigs(loadedConfigs);
      setActiveConfig(loadedActive);
      setProducts(loadedProducts);
      setAuditLogs(loadedAudit.content);
      setWeightsText(JSON.stringify(loadedActive.weights, null, 2));
      setStatus("");
    } catch {
      setStatus("Failed to load admin settings");
    }
  };

  useEffect(() => {
    void load();
  }, [token]);

  const sortedConfigs = useMemo(() => [...configs].sort((a, b) => b.version - a.version), [configs]);

  const saveWeights = async () => {
    if (!token || !activeConfig) return;
    try {
      const newWeights = JSON.parse(weightsText);
      await createScoringConfig(token, {
        name: `${activeConfig.name} (tuned)`,
        weights: newWeights,
        messages: activeConfig.messages,
        segments: activeConfig.segments,
        activate: true,
      });
      setStatus("Scoring rules saved and activated");
      await load();
    } catch {
      setStatus("Invalid JSON payload for scoring weights");
    }
  };

  const activateVersion = async (configId: string) => {
    if (!token) return;
    try {
      await activateScoringConfig(token, configId);
      setStatus("Config version activated");
      await load();
    } catch {
      setStatus("Failed to activate config");
    }
  };

  if (!token) return null;

  return (
    <div className="pn-page">
      <div className="pn-header">
        <div>
          <h1>Admin Settings</h1>
          <p>Manage products, scoring rules, and system configuration</p>
        </div>
      </div>

      <div className="pn-tabs">
        <button className={activeTab === "rules" ? "active" : ""} onClick={() => setActiveTab("rules")}>Scoring Rules</button>
        <button className={activeTab === "products" ? "active" : ""} onClick={() => setActiveTab("products")}>Products</button>
        <button className={activeTab === "security" ? "active" : ""} onClick={() => setActiveTab("security")}>Security</button>
        <button className={activeTab === "audit" ? "active" : ""} onClick={() => setActiveTab("audit")}>Audit Log</button>
      </div>

      {activeTab === "rules" && (
        <Card>
          <div className="row-actions" style={{ justifyContent: "space-between" }}>
            <h2>NBA Scoring Weights</h2>
            <Button onClick={saveWeights}>Save Changes</Button>
          </div>
          <Field label="Weights JSON">
            <textarea rows={10} value={weightsText} onChange={(event) => setWeightsText(event.target.value)} />
          </Field>
          <div className="chips">
            {sortedConfigs.map((config) => (
              <button key={config.id} className={`pn-chip-btn ${config.active ? "active" : ""}`} onClick={() => void activateVersion(config.id)}>
                v{config.version} {config.active ? "(active)" : ""}
              </button>
            ))}
          </div>
        </Card>
      )}

      {activeTab === "products" && (
        <Card className="pn-table-card">
          <table className="pn-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Category</th>
                <th>Status</th>
                <th>Assigned Doctors</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.id}>
                  <td>{product.name}</td>
                  <td>{product.category}</td>
                  <td><Pill>{product.active ? "Active" : "Inactive"}</Pill></td>
                  <td>{product.assignedDoctors}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {activeTab === "security" && (
        <Card>
          <h2>Access & Security Settings</h2>
          <div className="pn-security-list">
            {Object.entries(security).map(([key, value]) => (
              <div key={key} className="pn-security-row">
                <div>
                  <strong>{key}</strong>
                </div>
                <label className="pn-toggle">
                  <input
                    type="checkbox"
                    checked={value}
                    onChange={(event) => setSecurity((state) => ({ ...state, [key]: event.target.checked }))}
                  />
                  <span />
                </label>
              </div>
            ))}
          </div>
        </Card>
      )}

      {activeTab === "audit" && (
        <Card className="pn-table-card">
          <table className="pn-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>User</th>
                <th>Action</th>
                <th>Type</th>
              </tr>
            </thead>
            <tbody>
              {auditLogs.map((log) => (
                <tr key={log.id}>
                  <td>{new Date(log.createdAt).toLocaleString()}</td>
                  <td>{log.actorUserId || "system"}</td>
                  <td>{log.action}</td>
                  <td><Pill>{log.entityType}</Pill></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {status && <div className="toast">{status}</div>}
    </div>
  );
}
