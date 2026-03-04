import { useEffect, useMemo, useState } from "react";
import {
  fetchAdminProducts,
  fetchManagerAnalytics,
  fetchPharmacies,
  fetchSalesReps,
  fetchSalesTargets,
  fetchSalesTrend,
  fetchMrSummaries,
  fetchTerritories,
  fetchTerritoryOverview,
  importGooglePharmacy,
  upsertSalesTarget,
  type ProductSummary,
  type ManagerAnalyticsResponse,
  type Pharmacy,
  type SalesRepWeeklyTarget,
  type SalesTrendResponse,
  type TerritoryOverview,
  type Territory,
  type UserProfile,
  type UserSummary,
} from "../api";
import { useAuth } from "../auth/AuthContext";
import { loadGoogleMaps } from "../lib/googleMaps";
import { Button, Card, Field, Pill, SectionTitle } from "../ui/components";

const defaultAnalytics: ManagerAnalyticsResponse = {
  coverageByTier: [],
  missedHighPriority: [],
  compliance: {
    totalFeedback: 0,
    doneCount: 0,
    skippedCount: 0,
    rescheduledCount: 0,
    overrideCount: 0,
    doneRate: 0,
    overrideRate: 0,
  },
  complianceByMr: [],
  coachingSummary: {
    configuredScheduleCount: 0,
    totalMrCount: 0,
    scheduleCoverageRate: 0,
    workdayVisitRate: 0,
    planAdherenceRate: 0,
    overdueReschedules: 0,
    atRiskMrCount: 0,
  },
  coachingByMr: [],
  salesTargetSummary: {
    activeTargetCount: 0,
    targetQuantity: 0,
    actualQuantity: 0,
    targetAmount: 0,
    actualAmount: 0,
    quantityAchievementRate: 0,
    amountAchievementRate: 0,
  },
  salesTargetProgress: [],
};

export default function ManagerDashboard() {
  type GooglePlaceCandidate = {
    placeId: string;
    name: string;
    address: string;
    lat: number;
    lon: number;
    phoneNumber?: string;
  };

  const { token } = useAuth();
  const [analytics, setAnalytics] = useState<ManagerAnalyticsResponse>(defaultAnalytics);
  const [overview, setOverview] = useState<TerritoryOverview[]>([]);
  const [mrs, setMrs] = useState<UserSummary[]>([]);
  const [salesReps, setSalesReps] = useState<UserProfile[]>([]);
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [products, setProducts] = useState<ProductSummary[]>([]);
  const [assignedPharmacies, setAssignedPharmacies] = useState<Pharmacy[]>([]);
  const [salesTargets, setSalesTargets] = useState<SalesRepWeeklyTarget[]>([]);
  const [salesTrend, setSalesTrend] = useState<SalesTrendResponse>({ series: [] });
  const [mrId, setMrId] = useState("");
  const [productId, setProductId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [targetSalesRepId, setTargetSalesRepId] = useState("");
  const [targetProductId, setTargetProductId] = useState("");
  const [targetWeekStart, setTargetWeekStart] = useState(() => {
    const today = new Date();
    const day = today.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    today.setDate(today.getDate() + diff);
    return today.toISOString().slice(0, 10);
  });
  const [targetQuantity, setTargetQuantity] = useState("0");
  const [targetAmount, setTargetAmount] = useState("0");
  const [pharmacySearch, setPharmacySearch] = useState("");
  const [googlePharmacyResults, setGooglePharmacyResults] = useState<GooglePlaceCandidate[]>([]);
  const [selectedGooglePlaceId, setSelectedGooglePlaceId] = useState("");
  const [selectedPharmacyTerritoryId, setSelectedPharmacyTerritoryId] = useState("");
  const [pharmacySearchStatus, setPharmacySearchStatus] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (!token) return;
    fetchMrSummaries(token).then(setMrs).catch(() => setMrs([]));
    fetchTerritories(token).then((rows) => {
      setTerritories(rows);
      if (rows[0]) setSelectedPharmacyTerritoryId((current) => current || rows[0].id);
    }).catch(() => setTerritories([]));
    fetchAdminProducts(token).then((rows) => {
      setProducts(rows);
      if (rows[0]) setTargetProductId((current) => current || rows[0].id);
    }).catch(() => setProducts([]));
    fetchSalesReps(token).then((rows) => {
      setSalesReps(rows);
      if (rows[0]) setTargetSalesRepId((current) => current || rows[0].id);
    }).catch(() => setSalesReps([]));
  }, [token]);

  useEffect(() => {
    if (!token) return;
    fetchManagerAnalytics(token, {
      mrId: mrId || undefined,
      from: from || undefined,
      to: to || undefined,
      weekStart: targetWeekStart || undefined,
    })
      .then(setAnalytics)
      .catch(() => setAnalytics(defaultAnalytics));

    fetchTerritoryOverview(token, { from: from || undefined, to: to || undefined })
      .then(setOverview)
      .catch(() => setOverview([]));

    fetchSalesTrend(token, { productId: productId || undefined, from: from || undefined, to: to || undefined })
      .then(setSalesTrend)
      .catch(() => setSalesTrend({ series: [] }));

    fetchSalesTargets(token, targetWeekStart)
      .then(setSalesTargets)
      .catch(() => setSalesTargets([]));

    fetchPharmacies(token, { territoryId: selectedPharmacyTerritoryId || undefined, size: 20 })
      .then((page) => setAssignedPharmacies(page.content))
      .catch(() => setAssignedPharmacies([]));
  }, [token, mrId, productId, from, to, targetWeekStart, selectedPharmacyTerritoryId]);

  const saveTarget = async () => {
    if (!token || !targetSalesRepId || !targetProductId || !targetWeekStart) return;
    try {
      await upsertSalesTarget(token, {
        salesRepUserId: targetSalesRepId,
        productId: targetProductId,
        weekStart: targetWeekStart,
        targetQuantity: Number(targetQuantity || 0),
        targetAmount: Number(targetAmount || 0),
      });
      setStatus("Weekly sales target saved");
      const refreshed = await fetchSalesTargets(token, targetWeekStart);
      setSalesTargets(refreshed);
      const refreshedAnalytics = await fetchManagerAnalytics(token, {
        mrId: mrId || undefined,
        from: from || undefined,
        to: to || undefined,
        weekStart: targetWeekStart || undefined,
      });
      setAnalytics(refreshedAnalytics);
    } catch {
      setStatus("Failed to save weekly sales target");
    }
  };

  const searchGooglePlaces = async () => {
    if (!pharmacySearch.trim()) {
      setPharmacySearchStatus("Enter a pharmacy name or area to search Google Maps");
      return;
    }
    try {
      setPharmacySearchStatus("Searching Google Maps...");
      const maps = await loadGoogleMaps();
      const service = new maps.places.PlacesService(document.createElement("div"));
      const results = await new Promise<GooglePlaceCandidate[]>((resolve, reject) => {
        service.textSearch(
          { query: `${pharmacySearch.trim()} pharmacy Sri Lanka` },
          (places: any[] | null, responseStatus: string) => {
            if (responseStatus !== maps.places.PlacesServiceStatus.OK || !places) {
              reject(new Error("No places found"));
              return;
            }
            resolve(
              places
                .filter((place) => place.place_id && place.geometry?.location)
                .slice(0, 8)
                .map((place) => ({
                  placeId: place.place_id,
                  name: place.name ?? "Google Maps pharmacy",
                  address: place.formatted_address ?? place.vicinity ?? "",
                  lat: place.geometry.location.lat(),
                  lon: place.geometry.location.lng(),
                }))
            );
          }
        );
      });
      setGooglePharmacyResults(results);
      setSelectedGooglePlaceId((current) => current || results[0]?.placeId || "");
      setPharmacySearchStatus(results.length === 0 ? "No Google Maps pharmacies found" : `${results.length} Google Maps pharmacies found`);
    } catch {
      setGooglePharmacyResults([]);
      setSelectedGooglePlaceId("");
      setPharmacySearchStatus("Failed to search Google Maps pharmacies");
    }
  };

  const importSelectedPharmacy = async () => {
    if (!token || !selectedGooglePlaceId || !selectedPharmacyTerritoryId) {
      setPharmacySearchStatus("Select a Google Maps pharmacy and a territory");
      return;
    }
    const selected = googlePharmacyResults.find((item) => item.placeId === selectedGooglePlaceId);
    if (!selected) {
      setPharmacySearchStatus("Select a Google Maps pharmacy to assign");
      return;
    }
    try {
      const maps = await loadGoogleMaps();
      const service = new maps.places.PlacesService(document.createElement("div"));
      const details = await new Promise<any>((resolve, reject) => {
        service.getDetails(
          {
            placeId: selected.placeId,
            fields: ["name", "formatted_address", "formatted_phone_number", "geometry", "place_id"],
          },
          (place: any, responseStatus: string) => {
            if (responseStatus !== maps.places.PlacesServiceStatus.OK || !place?.place_id || !place?.geometry?.location) {
              reject(new Error("Failed to load place details"));
              return;
            }
            resolve(place);
          }
        );
      });
      const saved = await importGooglePharmacy(token, {
        googlePlaceId: details.place_id,
        name: details.name ?? selected.name,
        territoryId: selectedPharmacyTerritoryId,
        address: details.formatted_address ?? selected.address,
        contactNumber: details.formatted_phone_number ?? undefined,
        lat: details.geometry.location.lat(),
        lon: details.geometry.location.lng(),
      });
      setPharmacySearchStatus(`Assigned ${saved.name} to the selected territory`);
      const refreshed = await fetchPharmacies(token, { territoryId: selectedPharmacyTerritoryId, size: 20 });
      setAssignedPharmacies(refreshed.content);
    } catch {
      setPharmacySearchStatus("Failed to assign pharmacy from Google Maps");
    }
  };

  const totalVisitsMtd = useMemo(
    () => analytics.coverageByTier.reduce((sum, row) => sum + row.totalVisits, 0),
    [analytics]
  );

  const avgCoverage = useMemo(() => {
    if (overview.length === 0) return 0;
    const sum = overview.reduce((acc, row) => {
      const coverage = row.doctorCount === 0 ? 0 : (row.visitCount / row.doctorCount) * 100;
      return acc + coverage;
    }, 0);
    return sum / overview.length;
  }, [overview]);

  const coachingCoverage = analytics.coachingSummary.totalMrCount === 0
    ? 0
    : analytics.coachingSummary.scheduleCoverageRate;

  const donutStyle = {
    background: `conic-gradient(#0f8b80 0 ${analytics.compliance.doneRate}%, #2563eb ${analytics.compliance.doneRate}% ${analytics.compliance.doneRate + 15}%, #dc2626 ${analytics.compliance.doneRate + 15}% ${analytics.compliance.doneRate + 27}%, #f59e0b ${analytics.compliance.doneRate + 27}% 100%)`,
  };

  const weeklySeries = [
    Math.round(totalVisitsMtd * 0.22),
    Math.round(totalVisitsMtd * 0.27),
    Math.round(totalVisitsMtd * 0.2),
    Math.round(totalVisitsMtd * 0.31),
  ];

  if (!token) return null;

  return (
    <div className="pn-page">
      <div className="pn-header">
        <div>
          <h1>Manager Dashboard</h1>
          <p>Territory coverage analytics and coaching insights</p>
        </div>
      </div>

      <div className="filters">
        <Field label="MR">
          <select value={mrId} onChange={(event) => setMrId(event.target.value)}>
            <option value="">All MRs</option>
            {mrs.map((mr) => (
              <option key={mr.id} value={mr.id}>{mr.fullName}</option>
            ))}
          </select>
        </Field>
        <Field label="From">
          <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
        </Field>
        <Field label="To">
          <input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
        </Field>
        <Field label="Product">
          <select value={productId} onChange={(event) => setProductId(event.target.value)}>
            <option value="">All products</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>{product.name}</option>
            ))}
          </select>
        </Field>
        <Button className="ghost" onClick={() => { setMrId(""); setProductId(""); setFrom(""); setTo(""); }}>
          Reset
        </Button>
      </div>

      <div className="pn-kpi-grid">
        <Card><div className="pn-kpi"><span>Total Visits (MTD)</span><strong>{totalVisitsMtd}</strong><em>+12%</em></div></Card>
        <Card><div className="pn-kpi"><span>NBA Acceptance Rate</span><strong>{analytics.compliance.doneRate.toFixed(0)}%</strong><em>+3%</em></div></Card>
        <Card><div className="pn-kpi"><span>Avg Coverage Score</span><strong>{avgCoverage.toFixed(0)}%</strong><em>-2%</em></div></Card>
        <Card><div className="pn-kpi"><span>Day Plans Configured</span><strong>{coachingCoverage.toFixed(0)}%</strong><em>{analytics.coachingSummary.configuredScheduleCount}/{analytics.coachingSummary.totalMrCount} MRs</em></div></Card>
      </div>

      <div className="pn-manager-grid">
        <Card>
          <SectionTitle title="SR Weekly Targets" subtitle="Manager-set sales rep targets versus actual pharmacy sell-in." />
          <div className="pn-driver-list">
            <div className="pn-driver-row">
              <strong>Active targets</strong>
              <span>{analytics.salesTargetSummary.activeTargetCount} target lines this week</span>
              <Pill>{analytics.salesTargetSummary.quantityAchievementRate.toFixed(0)}% qty</Pill>
            </div>
            <div className="pn-driver-row">
              <strong>Quantity</strong>
              <span>{analytics.salesTargetSummary.actualQuantity} actual of {analytics.salesTargetSummary.targetQuantity} target</span>
              <Pill>{analytics.salesTargetSummary.quantityAchievementRate.toFixed(0)}%</Pill>
            </div>
            <div className="pn-driver-row">
              <strong>Amount</strong>
              <span>{analytics.salesTargetSummary.actualAmount.toFixed(2)} actual of {analytics.salesTargetSummary.targetAmount.toFixed(2)} target</span>
              <Pill>{analytics.salesTargetSummary.amountAchievementRate.toFixed(0)}%</Pill>
            </div>
          </div>
        </Card>

        <Card>
          <SectionTitle title="Assign Weekly Target" subtitle="Set the weekly sales target for a Sales Rep and product." />
          <div className="inline-form">
            <Field label="Sales Rep">
              <select value={targetSalesRepId} onChange={(event) => setTargetSalesRepId(event.target.value)}>
                <option value="">Select sales rep</option>
                {salesReps.map((rep) => (
                  <option key={rep.id} value={rep.id}>{rep.fullName}</option>
                ))}
              </select>
            </Field>
            <Field label="Product">
              <select value={targetProductId} onChange={(event) => setTargetProductId(event.target.value)}>
                <option value="">Select product</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>{product.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Week Start">
              <input type="date" value={targetWeekStart} onChange={(event) => setTargetWeekStart(event.target.value)} />
            </Field>
            <Field label="Target Qty">
              <input type="number" min={0} value={targetQuantity} onChange={(event) => setTargetQuantity(event.target.value)} />
            </Field>
            <Field label="Target Amount">
              <input type="number" min={0} step="0.01" value={targetAmount} onChange={(event) => setTargetAmount(event.target.value)} />
            </Field>
            <Button onClick={() => void saveTarget()}>Save Target</Button>
          </div>
          <div className="table-list">
            {salesTargets.map((target) => (
              <div key={target.id} className="table-row">
                <div>
                  <strong>{target.salesRepName}</strong>
                  <p className="muted">{target.productName} | week of {target.weekStart}</p>
                </div>
                <div className="chips">
                  <Pill>{target.targetQuantity} units</Pill>
                  <Pill>{target.targetAmount.toFixed(2)}</Pill>
                </div>
              </div>
            ))}
            {salesTargets.length === 0 && <p className="muted">No weekly sales targets set for this week.</p>}
          </div>
          {status && <p className="muted">{status}</p>}
        </Card>
      </div>

      <div className="pn-manager-grid">
        <Card>
          <SectionTitle title="Territory Coverage" />
          {overview.map((row) => {
            const pct = row.doctorCount === 0 ? 0 : Math.round((row.visitCount / row.doctorCount) * 100);
            return (
              <div key={row.territoryId} className="pn-territory-line">
                <div className="row-actions" style={{ justifyContent: "space-between" }}>
                  <strong>{row.territoryName}</strong>
                  <span className="muted">{pct}%</span>
                </div>
                <div className="bar-track"><div className="bar-fill" style={{ width: `${pct}%` }} /></div>
              </div>
            );
          })}
        </Card>

        <Card>
          <SectionTitle title="NBA Compliance Breakdown" />
          <div className="pn-donut-wrap">
            <div className="pn-donut" style={donutStyle} />
            <div className="pn-legend">
              <div><span className="dot accepted" /> Accepted {analytics.compliance.doneRate.toFixed(0)}%</div>
              <div><span className="dot modified" /> Modified 15%</div>
              <div><span className="dot skipped" /> Skipped {Math.max(0, 100 - analytics.compliance.doneRate - 20).toFixed(0)}%</div>
              <div><span className="dot rescheduled" /> Rescheduled 5%</div>
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <SectionTitle title="Weekly Visit Trends" />
        <div className="pn-weekly-bars">
          {weeklySeries.map((value, idx) => (
            <div key={idx} className="pn-week-col">
              <div className="pn-week-bar" style={{ height: `${Math.max(20, value)}px` }} />
              <span>W{idx + 1}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <SectionTitle title="Pharmacy Sales Trends" subtitle="Manager view of pharmacy order volume by product and time." />
        <div className="table-list">
          {salesTrend.series.map((point) => (
            <div key={point.bucket} className="table-row">
              <div>
                <strong>{point.bucket}</strong>
                <p className="muted">{point.orderCount} orders</p>
              </div>
              <div className="chips">
                <Pill>{point.totalQuantity} units</Pill>
                <Pill>{point.totalAmount.toFixed(2)}</Pill>
              </div>
            </div>
          ))}
          {salesTrend.series.length === 0 && <p className="muted">No pharmacy sales records for the selected filters.</p>}
        </div>
      </Card>

      <Card>
        <SectionTitle title="Assign Google Maps Pharmacies" subtitle="Managers search real pharmacies from Google Maps and assign them to territories." />
        <div className="inline-form">
          <Field label="Search Google Maps">
            <input value={pharmacySearch} onChange={(event) => setPharmacySearch(event.target.value)} placeholder="Pharmacy name, town, or hospital area" />
          </Field>
          <Field label="Territory">
            <select value={selectedPharmacyTerritoryId} onChange={(event) => setSelectedPharmacyTerritoryId(event.target.value)}>
              <option value="">Select territory</option>
              {territories.map((territory) => (
                <option key={territory.id} value={territory.id}>{territory.name}</option>
              ))}
            </select>
          </Field>
          <Button className="ghost" onClick={() => void searchGooglePlaces()}>Search</Button>
          <Button onClick={() => void importSelectedPharmacy()}>Assign Pharmacy</Button>
        </div>
        <div className="table-list">
          {googlePharmacyResults.map((place) => (
            <label key={place.placeId} className="table-row" style={{ cursor: "pointer" }}>
              <div>
                <strong>{place.name}</strong>
                <p className="muted">{place.address || "Google Maps result"}</p>
              </div>
              <div className="chips">
                <input
                  type="radio"
                  name="selectedGooglePharmacy"
                  checked={selectedGooglePlaceId === place.placeId}
                  onChange={() => setSelectedGooglePlaceId(place.placeId)}
                />
              </div>
            </label>
          ))}
          {googlePharmacyResults.length === 0 && <p className="muted">Search Google Maps to find pharmacies to assign.</p>}
        </div>
        <p className="muted">{pharmacySearchStatus}</p>
        <div className="table-list">
          {assignedPharmacies.map((pharmacy) => (
            <div key={pharmacy.id} className="table-row">
              <div>
                <strong>{pharmacy.name}</strong>
                <p className="muted">{pharmacy.address || pharmacy.notes || "Assigned pharmacy"}</p>
              </div>
              <div className="chips">
                <Pill>{pharmacy.code}</Pill>
                {pharmacy.googlePlaceId && <Pill>Google Maps</Pill>}
              </div>
            </div>
          ))}
          {assignedPharmacies.length === 0 && <p className="muted">No pharmacies assigned for the selected territory.</p>}
        </div>
      </Card>

      <Card>
        <SectionTitle title="Target vs Actual by Sales Rep" subtitle="Execution gap by product and rep for the current target week." />
        <div className="table-list">
          {analytics.salesTargetProgress.map((row) => (
            <div key={`${row.salesRepUserId}-${row.productId}-${row.territoryId ?? "all"}`} className="table-row">
              <div>
                <strong>{row.salesRepName}</strong>
                <p className="muted">{row.productName}{row.territoryName ? ` | ${row.territoryName}` : ""}</p>
              </div>
              <div className="chips">
                <Pill>{row.actualQuantity}/{row.targetQuantity} units</Pill>
                <Pill>{row.quantityAchievementRate.toFixed(0)}%</Pill>
                <Pill>{row.actualAmount.toFixed(2)}/{row.targetAmount.toFixed(2)}</Pill>
              </div>
            </div>
          ))}
          {analytics.salesTargetProgress.length === 0 && <p className="muted">No sales target progress available.</p>}
        </div>
      </Card>

      <Card>
        <SectionTitle title="Missed High-Priority Doctors" />
        <div className="table-list">
          {analytics.missedHighPriority.map((item) => (
            <div key={item.doctorId} className="table-row">
              <div>
                <strong>{item.doctorName}</strong>
                <p className="muted">{item.territoryName || "N/A"}</p>
              </div>
              <div className="chips">
                <Pill>Priority {item.priorityScore}</Pill>
                <Pill>{item.lastVisitTime ? `${Math.max(0, Math.round((Date.now() - new Date(item.lastVisitTime).getTime()) / 86400000))} days since last visit` : "Never visited"}</Pill>
              </div>
            </div>
          ))}
          {analytics.missedHighPriority.length === 0 && <p className="muted">No missed high-priority doctors.</p>}
        </div>
      </Card>

      <div className="pn-manager-grid">
        <Card>
          <SectionTitle title="Coaching Summary" subtitle="Day-plan usage, work-window adherence, and overdue reschedules." />
          <div className="pn-driver-list">
            <div className="pn-driver-row">
              <strong>Configured day plans</strong>
              <span>{analytics.coachingSummary.configuredScheduleCount} of {analytics.coachingSummary.totalMrCount} MRs</span>
              <Pill>{analytics.coachingSummary.scheduleCoverageRate.toFixed(0)}%</Pill>
            </div>
            <div className="pn-driver-row">
              <strong>Visits inside work windows</strong>
              <span>Share of visits logged within MR workday minus break windows</span>
              <Pill>{analytics.coachingSummary.workdayVisitRate.toFixed(0)}%</Pill>
            </div>
            <div className="pn-driver-row">
              <strong>Average day-plan adherence</strong>
              <span>Average visit volume against each MR's planned daily capacity</span>
              <Pill>{analytics.coachingSummary.planAdherenceRate.toFixed(0)}%</Pill>
            </div>
            <div className="pn-driver-row">
              <strong>Overdue reschedules</strong>
              <span>Recommendations that were rescheduled but are now past due</span>
              <Pill>{analytics.coachingSummary.overdueReschedules}</Pill>
            </div>
            <div className="pn-driver-row">
              <strong>At-risk MRs</strong>
              <span>Missing plans, low work-window adherence, or overdue follow-up load</span>
              <Pill>{analytics.coachingSummary.atRiskMrCount}</Pill>
            </div>
          </div>
        </Card>

        <Card>
          <SectionTitle title="MR Coaching Queue" subtitle="Practical coaching focus for the next conversation." />
          <div className="table-list">
            {analytics.coachingByMr.map((row) => (
              <div key={row.mrId} className="table-row">
                <div>
                  <strong>{row.mrName}</strong>
                  <p className="muted">{row.coachingFocus}</p>
                </div>
                <div className="chips">
                  <Pill>{row.scheduleConfigured ? "Plan set" : "No plan"}</Pill>
                  <Pill>{row.workdayVisitRate.toFixed(0)}% in work window</Pill>
                  <Pill>{row.avgVisitsPerActiveDay.toFixed(1)}/{row.maxVisitsPerDay || 0} visits/day</Pill>
                  <Pill>{row.overdueReschedules} overdue</Pill>
                </div>
              </div>
            ))}
            {analytics.coachingByMr.length === 0 && <p className="muted">No coaching rows available for the selected filters.</p>}
          </div>
        </Card>
      </div>
    </div>
  );
}
