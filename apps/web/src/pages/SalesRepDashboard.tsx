import { useEffect, useMemo, useState } from "react";
import {
  createPharmacyOrder,
  fetchMyAssignedProducts,
  fetchMyTerritories,
  fetchPharmacies,
  type Pharmacy,
  type UserProductAssignment,
} from "../api";
import { useAuth } from "../auth/AuthContext";
import { Button, Card, Field, Pill } from "../ui/components";

type OrderItemDraft = {
  productId: string;
  quantity: string;
  amount: string;
};

export default function SalesRepDashboard() {
  const { token } = useAuth();
  const [pharmacies, setPharmacies] = useState<Pharmacy[]>([]);
  const [products, setProducts] = useState<UserProductAssignment[]>([]);
  const [territoryName, setTerritoryName] = useState("Assigned territory");
  const [pharmacyId, setPharmacyId] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<OrderItemDraft[]>([{ productId: "", quantity: "1", amount: "" }]);
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (!token) return;
    const load = async () => {
      try {
        const territories = await fetchMyTerritories(token);
        const territoryId = territories[0]?.id;
        setTerritoryName(territories[0]?.name ?? "Assigned territory");
        const [productRows, pharmacyPage] = await Promise.all([
          fetchMyAssignedProducts(token),
          fetchPharmacies(token, { territoryId, size: 100 }),
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
        <Card><div className="pn-kpi"><span>Target Territory</span><strong>{territoryName}</strong><em>active region</em></div></Card>
        <Card><div className="pn-kpi"><span>Available Pharmacies</span><strong>{pharmacies.length}</strong><em>in territory</em></div></Card>
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
              {pharmacies.map((pharmacy) => (
                <option key={pharmacy.id} value={pharmacy.id}>{pharmacy.name}</option>
              ))}
            </select>
          </Field>

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
            <Button onClick={() => void submitOrder()}>Submit Order</Button>
          </div>
        </Card>
      </div>

      {status && <div className="toast">{status}</div>}
    </div>
  );
}
