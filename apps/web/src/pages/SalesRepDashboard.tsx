import { useEffect, useMemo, useState } from "react";
import {
  createPharmacyOrder,
  createPharmacyVisit,
  fetchMyAssignedProducts,
  fetchMyTerritories,
  fetchPharmacies,
  type Pharmacy,
  type Territory,
  type UserProductAssignment,
} from "../api";
import { useAuth } from "../auth/AuthContext";
import { Button, Card, Field, Pill } from "../ui/components";

type OrderItemDraft = {
  productId: string;
  quantity: string;
  amount: string;
};

type PharmacyGroup = {
  territoryId: string;
  territoryName: string;
  pharmacies: Pharmacy[];
};

export default function SalesRepDashboard() {
  const { token } = useAuth();
  const [pharmacies, setPharmacies] = useState<Pharmacy[]>([]);
  const [products, setProducts] = useState<UserProductAssignment[]>([]);
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [pharmacyId, setPharmacyId] = useState("");
  const [pharmacyVisitOutcome, setPharmacyVisitOutcome] = useState("Visited");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<OrderItemDraft[]>([{ productId: "", quantity: "1", amount: "" }]);
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (!token) return;
    const load = async () => {
      try {
        const territoryRows = await fetchMyTerritories(token);
        setTerritories(territoryRows);
        const [productRows, pharmacyPage] = await Promise.all([
          fetchMyAssignedProducts(token),
          fetchPharmacies(token, { size: 100 }),
        ]);
        setProducts(productRows);
        setPharmacies(pharmacyPage.content);
        if (pharmacyPage.content[0]) {
          setPharmacyId(pharmacyPage.content[0].id);
        }
      } catch {
        setStatus("Failed to load sales rep workspace");
      }
    };
    void load();
  }, [token]);

  const totalAmount = useMemo(
    () => items.reduce((sum, item) => sum + Number(item.amount || 0), 0),
    [items]
  );

  const totalQuantity = useMemo(
    () => items.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
    [items]
  );

  const territoryLabel = useMemo(() => {
    const names = territories.map((territory) => territory.name).filter(Boolean);
    if (names.length === 0) return "Assigned territory";
    if (names.length <= 2) return names.join(", ");
    return `${names.slice(0, 2).join(", ")} +${names.length - 2}`;
  }, [territories]);

  const territoryScopeLabel = territories.length === 1 ? "active region" : `${territories.length} active regions`;
  const pharmacyScopeLabel = territories.length === 1 ? "in territory" : "across territories";

  const pharmacyGroups = useMemo<PharmacyGroup[]>(() => {
    const pharmaciesByTerritory = pharmacies.reduce((map, pharmacy) => {
      const key = pharmacy.territoryId ?? "unassigned";
      const current = map.get(key) ?? [];
      current.push(pharmacy);
      map.set(key, current);
      return map;
    }, new Map<string, Pharmacy[]>());

    const assignedGroups = territories.map((territory) => ({
      territoryId: territory.id,
      territoryName: territory.name,
      pharmacies: pharmaciesByTerritory.get(territory.id) ?? [],
    }));

    const knownTerritoryIds = new Set(territories.map((territory) => territory.id));
    const otherPharmacies = pharmacies.filter((pharmacy) => !pharmacy.territoryId || !knownTerritoryIds.has(pharmacy.territoryId));

    return otherPharmacies.length > 0
      ? [...assignedGroups, { territoryId: "unassigned", territoryName: "Other assigned pharmacies", pharmacies: otherPharmacies }]
      : assignedGroups;
  }, [pharmacies, territories]);

  const submitOrder = async () => {
    if (!token || !pharmacyId) return;
    const normalizedItems = items
      .filter((item) => item.productId && Number(item.quantity) > 0 && Number(item.amount) > 0)
      .map((item) => ({
        productId: item.productId,
        quantity: Number(item.quantity),
        amount: Number(item.amount),
      }));
    if (normalizedItems.length === 0) {
      setStatus("Add at least one product line with quantity and amount");
      return;
    }

    try {
      const order = await createPharmacyOrder(token, {
        pharmacyId,
        orderedAt: new Date().toISOString(),
        notes,
        clientReferenceId: `sr-${Date.now()}`,
        items: normalizedItems,
      });
      setStatus(`Order captured for ${order.pharmacyName}`);
      setNotes("");
      setItems([{ productId: "", quantity: "1", amount: "" }]);
    } catch {
      setStatus("Failed to capture pharmacy order");
    }
  };

  const markPharmacyVisit = async () => {
    if (!token || !pharmacyId) {
      setStatus("Select a pharmacy to mark a visit");
      return;
    }
    try {
      const visit = await createPharmacyVisit(token, {
        pharmacyId,
        visitedAt: new Date().toISOString(),
        outcome: pharmacyVisitOutcome,
        notes: notes || "Marked from Sales Dashboard",
        clientReferenceId: `sales-pharmacy-visit-${pharmacyId}-${Date.now()}`,
      });
      setStatus(`Pharmacy visit marked for ${visit.pharmacyName}`);
      setNotes("");
    } catch {
      setStatus("Failed to mark pharmacy visit");
    }
  };

  if (!token) return null;

  return (
    <div className="pn-page sales-page">
      <div className="pn-header">
        <div>
          <h1>Sales Rep Dashboard</h1>
          <p>Capture pharmacy orders in real time and track assigned product execution.</p>
        </div>
      </div>

      <div className="pn-kpi-grid sales-kpi-grid">
        <Card><div className="pn-kpi"><span>Assigned Products</span><strong>{products.length}</strong><em>current portfolio</em></div></Card>
        <Card><div className="pn-kpi"><span>Target Territories</span><strong className="sales-territory-label">{territoryLabel}</strong><em>{territoryScopeLabel}</em></div></Card>
        <Card><div className="pn-kpi"><span>Available Pharmacies</span><strong>{pharmacies.length}</strong><em>{pharmacyScopeLabel}</em></div></Card>
        <Card><div className="pn-kpi"><span>Draft Order Value</span><strong>{totalAmount.toFixed(2)}</strong><em>{totalQuantity} units</em></div></Card>
      </div>

      <div className="pn-manager-grid sales-workspace-grid">
        <Card className="sales-brands-card">
          <div className="pn-section-head">
            <h2>Assigned Brands</h2>
            <Pill>{products.length} products</Pill>
          </div>
          <div className="table-list">
            {products.map((product) => (
              <div key={product.productId} className="table-row">
                <div>
                  <strong>{product.brandName || product.productName}</strong>
                  <p className="muted">{product.productName} | {product.productCode}</p>
                </div>
                <div className="chips">
                  <Pill>{product.manufacturerType || "General"}</Pill>
                  <Pill>{product.active ? "Active" : "Inactive"}</Pill>
                </div>
              </div>
            ))}
            {products.length === 0 && <p className="muted">No products assigned yet.</p>}
          </div>
        </Card>

        <Card className="sales-order-card">
          <div className="pn-section-head">
            <h2>Capture Pharmacy Order</h2>
            <Pill>Real-time entry</Pill>
          </div>
          <Field label="Pharmacy">
            <select value={pharmacyId} onChange={(event) => setPharmacyId(event.target.value)}>
              <option value="">Select pharmacy</option>
              {pharmacyGroups.map((group) => (
                <optgroup key={group.territoryId} label={group.territoryName}>
                  {group.pharmacies.map((pharmacy) => (
                    <option key={pharmacy.id} value={pharmacy.id}>{pharmacy.name}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </Field>

          <div className="sales-pharmacy-groups">
            {pharmacyGroups.map((group) => (
              <div key={group.territoryId} className="sales-pharmacy-group">
                <div className="sales-pharmacy-group-head">
                  <strong>{group.territoryName}</strong>
                  <Pill>{group.pharmacies.length} pharmacies</Pill>
                </div>
                <div className="sales-pharmacy-options">
                  {group.pharmacies.map((pharmacy) => (
                    <button
                      key={pharmacy.id}
                      type="button"
                      className={pharmacy.id === pharmacyId ? "sales-pharmacy-option active" : "sales-pharmacy-option"}
                      onClick={() => setPharmacyId(pharmacy.id)}
                    >
                      {pharmacy.name}
                    </button>
                  ))}
                  {group.pharmacies.length === 0 && <p className="muted">No pharmacies assigned in this region.</p>}
                </div>
              </div>
            ))}
          </div>

          {items.map((item, index) => (
            <div key={index} className="inline-form">
              <Field label="Product">
                <select
                  value={item.productId}
                  onChange={(event) =>
                    setItems((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, productId: event.target.value } : row))
                  }
                >
                  <option value="">Select product</option>
                  {products.map((product) => (
                    <option key={product.productId} value={product.productId}>
                      {product.brandName || product.productName}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Qty">
                <input
                  type="number"
                  min={1}
                  value={item.quantity}
                  onChange={(event) =>
                    setItems((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, quantity: event.target.value } : row))
                  }
                />
              </Field>
              <Field label="Amount">
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={item.amount}
                  onChange={(event) =>
                    setItems((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, amount: event.target.value } : row))
                  }
                />
              </Field>
            </div>
          ))}

          <div className="row-actions">
            <Button
              className="ghost"
              onClick={() => setItems((current) => [...current, { productId: "", quantity: "1", amount: "" }])}
            >
              Add Product Line
            </Button>
          </div>

          <Field label="Visit Notes">
            <textarea rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Pharmacy remarks, availability, competitor activity" />
          </Field>

          <div className="row-actions">
            <Field label="Visit Outcome">
              <select value={pharmacyVisitOutcome} onChange={(event) => setPharmacyVisitOutcome(event.target.value)}>
                <option value="Visited">Visited</option>
                <option value="Met Pharmacist">Met Pharmacist</option>
                <option value="Stock Checked">Stock Checked</option>
                <option value="Follow-up Required">Follow-up Required</option>
              </select>
            </Field>
            <Button className="ghost" onClick={() => void markPharmacyVisit()}>Mark Pharmacy Visit</Button>
            <Button onClick={() => void submitOrder()}>Submit Order</Button>
          </div>
        </Card>
      </div>

      {status && <div className="toast">{status}</div>}
    </div>
  );
}
