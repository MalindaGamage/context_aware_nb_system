import { useEffect, useMemo, useState } from "react";
import {
  activateScoringConfig,
  createAdminProduct,
  createScoringConfig,
  fetchActiveScoringConfig,
  fetchAdminProducts,
  fetchAuditLogs,
  fetchScoringConfigs,
  updateAdminProduct,
  type AuditLog,
  type CreateProductRequest,
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

const emptyProductForm: CreateProductRequest = {
  name: "",
  code: "",
  description: "",
  brandName: "",
  manufacturerType: "MANUFACTURED",
  active: true,
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
  const [productForm, setProductForm] = useState<CreateProductRequest>(emptyProductForm);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
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

  const saveProduct = async () => {
    if (!token) return;
    const request = {
      ...productForm,
      name: productForm.name.trim(),
      code: productForm.code.trim().toUpperCase(),
      description: productForm.description?.trim() || undefined,
      brandName: productForm.brandName?.trim() || undefined,
      manufacturerType: productForm.manufacturerType?.trim().toUpperCase() || undefined,
    };
    if (!request.name || !request.code) {
      setStatus("Enter product name and code");
      return;
    }

    try {
      if (editingProductId) {
        await updateAdminProduct(token, editingProductId, request);
      } else {
        await createAdminProduct(token, request);
      }
      setProductForm(emptyProductForm);
      setEditingProductId(null);
      await load();
      setStatus(editingProductId ? "Product updated" : "Product created");
    } catch {
      setStatus("Failed to save product");
    }
  };

  const editProduct = (product: ProductSummary) => {
    setEditingProductId(product.id);
    setProductForm({
      name: product.name,
      code: product.code,
      description: product.category === "General" ? "" : product.category,
      brandName: product.brandName ?? "",
      manufacturerType: product.manufacturerType ?? "MANUFACTURED",
      active: product.active,
    });
  };

  const cancelProductEdit = () => {
    setEditingProductId(null);
    setProductForm(emptyProductForm);
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
        <>
          <Card>
            <div className="pn-section-head">
              <h2>{editingProductId ? "Edit Product" : "Add Product"}</h2>
              {editingProductId && <Pill>Editing</Pill>}
            </div>
            <form
              className="inline-form"
              onSubmit={(event) => {
                event.preventDefault();
                void saveProduct();
              }}
            >
              <Field label="Product Name">
                <input
                  value={productForm.name}
                  onChange={(event) => setProductForm((current) => ({ ...current, name: event.target.value }))}
                  placeholder="Amlodipine"
                />
              </Field>
              <Field label="Code">
                <input
                  value={productForm.code}
                  onChange={(event) => setProductForm((current) => ({ ...current, code: event.target.value.toUpperCase() }))}
                  placeholder="AML-5"
                />
              </Field>
              <Field label="Brand Name">
                <input
                  value={productForm.brandName ?? ""}
                  onChange={(event) => setProductForm((current) => ({ ...current, brandName: event.target.value }))}
                  placeholder="PressureLess"
                />
              </Field>
              <Field label="Manufacturer Type">
                <select
                  value={productForm.manufacturerType ?? ""}
                  onChange={(event) => setProductForm((current) => ({ ...current, manufacturerType: event.target.value }))}
                >
                  <option value="MANUFACTURED">Manufactured</option>
                  <option value="IMPORTED">Imported</option>
                  <option value="GENERAL">General</option>
                </select>
              </Field>
              <Field label="Category / Description">
                <input
                  value={productForm.description ?? ""}
                  onChange={(event) => setProductForm((current) => ({ ...current, description: event.target.value }))}
                  placeholder="Hypertension management"
                />
              </Field>
              <Field label="Status">
                <select
                  value={productForm.active ? "active" : "inactive"}
                  onChange={(event) => setProductForm((current) => ({ ...current, active: event.target.value === "active" }))}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </Field>
              <Button type="submit">{editingProductId ? "Update Product" : "Add Product"}</Button>
              {editingProductId && <Button type="button" className="ghost" onClick={cancelProductEdit}>Cancel</Button>}
            </form>
          </Card>

          <Card className="pn-table-card">
            <table className="pn-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Code</th>
                  <th>Brand</th>
                  <th>Category</th>
                  <th>Status</th>
                  <th>Assigned Doctors</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr key={product.id}>
                    <td>{product.name}</td>
                    <td>{product.code}</td>
                    <td>{product.brandName || "N/A"}</td>
                    <td>{product.category}</td>
                    <td><Pill>{product.active ? "Active" : "Inactive"}</Pill></td>
                    <td>{product.assignedDoctors}</td>
                    <td><Button className="ghost" onClick={() => editProduct(product)}>Edit</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
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
