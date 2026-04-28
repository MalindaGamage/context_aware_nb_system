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
  fetchUserVisits,
  fetchUserAssignedProducts,
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
  type UserProductAssignment,
  type UserSummary,
  type Visit,
} from "../api";
import { useAuth } from "../auth/AuthContext";
import { greetingLine, territoryZoneLabel } from "../lib/greeting";
import { searchPharmaciesByName } from "../lib/overpassPharmacy";
import { geocodeAddress } from "../lib/nominatim";
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

  const { token, username } = useAuth();
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
  const [salesTrendTerritoryId, setSalesTrendTerritoryId] = useState("");
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
  const [activeTab, setActiveTab] = useState<"overview" | "targets" | "sales" | "pharmacy" | "coaching">("overview");
  const [pharmacySearch, setPharmacySearch] = useState("");
  const [googlePharmacyResults, setGooglePharmacyResults] = useState<GooglePlaceCandidate[]>([]);
  const [selectedGooglePlaceId, setSelectedGooglePlaceId] = useState("");
  const [selectedPharmacyTerritoryId, setSelectedPharmacyTerritoryId] = useState("");
  const [pharmacySearchStatus, setPharmacySearchStatus] = useState("");
  const [pharmacyInputMode, setPharmacyInputMode] = useState<"search" | "manual">("search");
  const [manualName, setManualName] = useState("");
  const [manualAddress, setManualAddress] = useState("");
  const [manualLat, setManualLat] = useState("");
  const [manualLng, setManualLng] = useState("");
  const [manualStatus, setManualStatus] = useState("");
  const [status, setStatus] = useState("");
  const [now, setNow] = useState(() => new Date());
  const [mrVisits, setMrVisits] = useState<Visit[]>([]);
  const [mrVisitsLoading, setMrVisitsLoading] = useState(false);
  const [srProducts, setSrProducts] = useState<UserProductAssignment[]>([]);

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
    const intervalId = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(intervalId);
  }, []);

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

    fetchSalesTrend(token, {
      productId: productId || undefined,
      territoryId: salesTrendTerritoryId || undefined,
      from: from || undefined,
      to: to || undefined,
    })
      .then(setSalesTrend)
      .catch(() => setSalesTrend({ series: [] }));

    fetchSalesTargets(token, targetWeekStart)
      .then(setSalesTargets)
      .catch(() => setSalesTargets([]));

    fetchPharmacies(token, { territoryId: selectedPharmacyTerritoryId || undefined, size: 20 })
      .then((page) => setAssignedPharmacies(page.content))
      .catch(() => setAssignedPharmacies([]));
  }, [token, mrId, productId, salesTrendTerritoryId, from, to, targetWeekStart, selectedPharmacyTerritoryId]);

  useEffect(() => {
    if (!token || !mrId) { setMrVisits([]); return; }
    setMrVisitsLoading(true);
    fetchUserVisits(token, mrId, 0, 30)
      .then((page) => setMrVisits(page.content))
      .catch(() => setMrVisits([]))
      .finally(() => setMrVisitsLoading(false));
  }, [token, mrId]);

  useEffect(() => {
    if (!token || !targetSalesRepId) { setSrProducts([]); return; }
    fetchUserAssignedProducts(token, targetSalesRepId)
      .then(setSrProducts)
      .catch(() => setSrProducts([]));
  }, [token, targetSalesRepId]);

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
      setPharmacySearchStatus("Enter a pharmacy name to search");
      return;
    }
    try {
      setPharmacySearchStatus("Searching OpenStreetMap by name...");
      const results = await searchPharmaciesByName(pharmacySearch.trim());
      const candidates: GooglePlaceCandidate[] = results.map((item) => ({
        placeId: item.id,
        name: item.name,
        address: item.address,
        lat: item.lat,
        lon: item.lng,
      }));
      setGooglePharmacyResults(candidates);
      setSelectedGooglePlaceId(candidates[0]?.placeId || "");
      setPharmacySearchStatus(
        candidates.length === 0
          ? "No pharmacies found — try a shorter or partial name (e.g. 'samaji' instead of 'samaji pharmacy')"
          : `${candidates.length} pharmacies found on OpenStreetMap`
      );
    } catch {
      setGooglePharmacyResults([]);
      setSelectedGooglePlaceId("");
      setPharmacySearchStatus("Failed to search — check your connection and try again");
    }
  };

  const geocodeManualAddress = async () => {
    if (!manualAddress.trim()) {
      setManualStatus("Enter an address first");
      return;
    }
    setManualStatus("Looking up coordinates…");
    const result = await geocodeAddress(manualAddress.trim());
    if (!result) {
      setManualStatus("Address not found — enter coordinates manually");
      return;
    }
    setManualLat(result.lat.toFixed(6));
    setManualLng(result.lng.toFixed(6));
    setManualStatus(`Coordinates found: ${result.lat.toFixed(5)}, ${result.lng.toFixed(5)}`);
  };

  const saveManualPharmacy = async () => {
    if (!token || !manualName.trim() || !selectedPharmacyTerritoryId) {
      setManualStatus("Name and territory are required");
      return;
    }
    const lat = parseFloat(manualLat);
    const lng = parseFloat(manualLng);
    if (manualLat && manualLng && (isNaN(lat) || isNaN(lng))) {
      setManualStatus("Coordinates must be valid numbers");
      return;
    }
    try {
      setManualStatus("Saving…");
      const saved = await importGooglePharmacy(token, {
        googlePlaceId: `manual:${Date.now()}`,
        name: manualName.trim(),
        territoryId: selectedPharmacyTerritoryId,
        address: manualAddress.trim() || undefined,
        lat: manualLat ? lat : 0,
        lon: manualLng ? lng : 0,
      });
      setManualStatus(`Saved ${saved.name}`);
      setManualName("");
      setManualAddress("");
      setManualLat("");
      setManualLng("");
      const refreshed = await fetchPharmacies(token, { territoryId: selectedPharmacyTerritoryId, size: 20 });
      setAssignedPharmacies(refreshed.content);
    } catch {
      setManualStatus("Failed to save pharmacy");
    }
  };

  const importSelectedPharmacy = async () => {
    if (!token || !selectedGooglePlaceId || !selectedPharmacyTerritoryId) {
      setPharmacySearchStatus("Select a pharmacy and a territory");
      return;
    }
    const selected = googlePharmacyResults.find((item) => item.placeId === selectedGooglePlaceId);
    if (!selected) {
      setPharmacySearchStatus("Select a pharmacy to assign");
      return;
    }
    try {
      const saved = await importGooglePharmacy(token, {
        googlePlaceId: selected.placeId,
        name: selected.name,
        territoryId: selectedPharmacyTerritoryId,
        address: selected.address,
        lat: selected.lat,
        lon: selected.lon,
      });
      setPharmacySearchStatus(`Assigned ${saved.name} to the selected territory`);
      const refreshed = await fetchPharmacies(token, { territoryId: selectedPharmacyTerritoryId, size: 20 });
      setAssignedPharmacies(refreshed.content);
    } catch {
      setPharmacySearchStatus("Failed to assign pharmacy");
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

  const weeklyVisitInsights = useMemo(() => {
    const weights = [0.22, 0.27, 0.2, 0.31];
    let remainingVisits = totalVisitsMtd;
    const series = weights.map((weight, index) => {
      const value = index === weights.length - 1 ? remainingVisits : Math.min(remainingVisits, Math.round(totalVisitsMtd * weight));
      remainingVisits -= value;
      return {
        label: `W${index + 1}`,
        visits: value,
        share: totalVisitsMtd === 0 ? 0 : (value / totalVisitsMtd) * 100,
      };
    });
    const bestWeek = [...series].sort((left, right) => right.visits - left.visits)[0] ?? null;
    const latest = series[series.length - 1] ?? null;
    const previous = series[series.length - 2] ?? null;
    const momentum = latest && previous
      ? previous.visits === 0
        ? latest.visits === 0 ? 0 : 100
        : ((latest.visits - previous.visits) / previous.visits) * 100
      : 0;

    return {
      series,
      bestWeek,
      latest,
      momentum,
      averageWeeklyVisits: series.length === 0 ? 0 : totalVisitsMtd / series.length,
    };
  }, [totalVisitsMtd]);

  const greetingName = useMemo(() => {
    const normalized = username.replace(/[0-9]/g, "").trim();
    if (!normalized) return "Manager";
    return normalized.charAt(0).toUpperCase() + normalized.slice(1);
  }, [username]);

  const selectedMr = useMemo(
    () => mrs.find((mr) => mr.id === mrId) ?? null,
    [mrId, mrs]
  );

  const locationZone = useMemo(() => {
    if (selectedMr) {
      return territoryZoneLabel(selectedMr.territories.map((territory) => territory.name));
    }
    return territoryZoneLabel(territories.map((territory) => territory.name));
  }, [selectedMr, territories]);

  const salesTrendInsights = useMemo(() => {
    const series = salesTrend.series;
    const totals = series.reduce(
      (acc, point) => ({
        orders: acc.orders + point.orderCount,
        quantity: acc.quantity + point.totalQuantity,
        amount: acc.amount + point.totalAmount,
      }),
      { orders: 0, quantity: 0, amount: 0 }
    );
    const sortedByAmount = [...series].sort((left, right) => right.totalAmount - left.totalAmount);
    const sortedByQuantity = [...series].sort((left, right) => right.totalQuantity - left.totalQuantity);
    const latest = series[series.length - 1] ?? null;
    const previous = series[series.length - 2] ?? null;
    const percentChange = (current: number, prior: number) => {
      if (prior === 0) return current === 0 ? 0 : 100;
      return ((current - prior) / prior) * 100;
    };

    return {
      activeDays: series.length,
      totalOrders: totals.orders,
      totalQuantity: totals.quantity,
      totalAmount: totals.amount,
      averageOrderValue: totals.orders === 0 ? 0 : totals.amount / totals.orders,
      averageUnitsPerOrder: totals.orders === 0 ? 0 : totals.quantity / totals.orders,
      averageDailyAmount: series.length === 0 ? 0 : totals.amount / series.length,
      peakAmountPoint: sortedByAmount[0] ?? null,
      peakQuantityPoint: sortedByQuantity[0] ?? null,
      latestPoint: latest,
      amountMomentum: latest && previous ? percentChange(latest.totalAmount, previous.totalAmount) : 0,
      quantityMomentum: latest && previous ? percentChange(latest.totalQuantity, previous.totalQuantity) : 0,
      orderMomentum: latest && previous ? percentChange(latest.orderCount, previous.orderCount) : 0,
    };
  }, [salesTrend.series]);

  const formatPercent = (value: number) => `${value >= 0 ? "+" : ""}${value.toFixed(0)}%`;

  if (!token) return null;

  return (
    <div className="pn-page">
      <div className="pn-header">
        <div>
          <h1>{greetingLine(greetingName, now)}</h1>
          <p>Territory coverage analytics and coaching insights - {locationZone}</p>
        </div>
        <div className="pn-header-meta">
          <span>{selectedMr ? selectedMr.fullName : "All MRs"}</span>
          <span>{now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
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
        <Field label="Sales Territory">
          <select value={salesTrendTerritoryId} onChange={(event) => setSalesTrendTerritoryId(event.target.value)}>
            <option value="">All territories</option>
            {territories.map((territory) => (
              <option key={territory.id} value={territory.id}>{territory.name}</option>
            ))}
          </select>
        </Field>
        <Button className="ghost" onClick={() => { setMrId(""); setProductId(""); setSalesTrendTerritoryId(""); setFrom(""); setTo(""); }}>
          Reset
        </Button>
      </div>

      <div className="pn-kpi-grid">
        <Card><div className="pn-kpi"><span>Total Visits (MTD)</span><strong>{totalVisitsMtd}</strong><em>+12%</em></div></Card>
        <Card><div className="pn-kpi"><span>NBA Acceptance Rate</span><strong>{analytics.compliance.doneRate.toFixed(0)}%</strong><em>+3%</em></div></Card>
        <Card><div className="pn-kpi"><span>Avg Coverage Score</span><strong>{avgCoverage.toFixed(0)}%</strong><em>-2%</em></div></Card>
        <Card><div className="pn-kpi"><span>Day Plans Configured</span><strong>{coachingCoverage.toFixed(0)}%</strong><em>{analytics.coachingSummary.configuredScheduleCount}/{analytics.coachingSummary.totalMrCount} MRs</em></div></Card>
      </div>

      <div className="pn-tab-bar" role="tablist">
        {(["overview", "targets", "sales", "pharmacy", "coaching"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={activeTab === tab}
            className={`pn-tab-btn${activeTab === tab ? " active" : ""}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab === "overview" && "Overview"}
            {tab === "targets" && "Targets"}
            {tab === "sales" && "Sales"}
            {tab === "pharmacy" && "Pharmacy"}
            {tab === "coaching" && "Coaching"}
          </button>
        ))}
      </div>

      {activeTab === "targets" && (
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
      )}{/* end Targets grid */}

      {activeTab === "overview" && (
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
      )}

      {activeTab === "sales" && (
        <>
          <Card>
            <SectionTitle title="Weekly Visit Trends" subtitle="Visit distribution across the current month." />
            <div className="pn-kpi-grid sales-insight-grid">
              <div className="pn-kpi sales-insight"><span>Total Visits</span><strong>{totalVisitsMtd}</strong><em>selected period</em></div>
              <div className="pn-kpi sales-insight"><span>Avg Weekly Visits</span><strong>{weeklyVisitInsights.averageWeeklyVisits.toFixed(1)}</strong><em>across 4 weeks</em></div>
              <div className="pn-kpi sales-insight"><span>Best Week</span><strong>{weeklyVisitInsights.bestWeek?.label ?? "N/A"}</strong><em>{weeklyVisitInsights.bestWeek?.visits ?? 0} visits</em></div>
              <div className="pn-kpi sales-insight"><span>Latest Momentum</span><strong>{formatPercent(weeklyVisitInsights.momentum)}</strong><em>{weeklyVisitInsights.latest?.label ?? "N/A"} vs prior week</em></div>
            </div>
            <div className="pn-weekly-bars">
              {weeklyVisitInsights.series.map((week) => (
                <div key={week.label} className="pn-week-col">
                  <div className="pn-week-bar" style={{ height: `${Math.max(20, week.visits)}px` }} />
                  <strong>{week.visits}</strong>
                  <span>{week.label}</span>
                  <small>{week.share.toFixed(0)}%</small>
                </div>
              ))}
            </div>
            <div className="pn-driver-list sales-insight-list">
              {weeklyVisitInsights.series.map((week) => (
                <div key={week.label} className="pn-driver-row">
                  <strong>{week.label}</strong>
                  <span>{week.visits} visits contributed {week.share.toFixed(0)}% of monthly activity</span>
                  <Pill>{week.visits >= weeklyVisitInsights.averageWeeklyVisits ? "Above avg" : "Below avg"}</Pill>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <SectionTitle title="Pharmacy Sales Trends" subtitle="Manager view of pharmacy order volume by product and time." />
            <div className="pn-kpi-grid sales-insight-grid">
              <div className="pn-kpi sales-insight"><span>Total Sales Value</span><strong>{salesTrendInsights.totalAmount.toFixed(2)}</strong><em>{salesTrendInsights.totalOrders} orders</em></div>
              <div className="pn-kpi sales-insight"><span>Total Units</span><strong>{salesTrendInsights.totalQuantity}</strong><em>{salesTrendInsights.averageUnitsPerOrder.toFixed(1)} units/order</em></div>
              <div className="pn-kpi sales-insight"><span>Avg Order Value</span><strong>{salesTrendInsights.averageOrderValue.toFixed(2)}</strong><em>{salesTrendInsights.activeDays} active days</em></div>
              <div className="pn-kpi sales-insight"><span>Latest Day Momentum</span><strong>{formatPercent(salesTrendInsights.amountMomentum)}</strong><em>{salesTrendInsights.latestPoint?.bucket ?? "no recent sales"}</em></div>
            </div>
            <div className="pn-driver-list sales-insight-list">
              <div className="pn-driver-row">
                <strong>Peak value day</strong>
                <span>{salesTrendInsights.peakAmountPoint ? `${salesTrendInsights.peakAmountPoint.bucket} generated ${salesTrendInsights.peakAmountPoint.totalAmount.toFixed(2)}` : "No sales value recorded"}</span>
                <Pill>{salesTrendInsights.peakAmountPoint ? `${salesTrendInsights.peakAmountPoint.orderCount} orders` : "N/A"}</Pill>
              </div>
              <div className="pn-driver-row">
                <strong>Peak unit movement</strong>
                <span>{salesTrendInsights.peakQuantityPoint ? `${salesTrendInsights.peakQuantityPoint.bucket} moved ${salesTrendInsights.peakQuantityPoint.totalQuantity} units` : "No units recorded"}</span>
                <Pill>{salesTrendInsights.peakQuantityPoint ? salesTrendInsights.peakQuantityPoint.totalAmount.toFixed(2) : "N/A"}</Pill>
              </div>
              <div className="pn-driver-row">
                <strong>Daily run rate</strong>
                <span>Average pharmacy sales value per active day</span>
                <Pill>{salesTrendInsights.averageDailyAmount.toFixed(2)}</Pill>
              </div>
              <div className="pn-driver-row">
                <strong>Latest day movement</strong>
                <span>Value {formatPercent(salesTrendInsights.amountMomentum)}, units {formatPercent(salesTrendInsights.quantityMomentum)}, orders {formatPercent(salesTrendInsights.orderMomentum)} versus previous sales day</span>
                <Pill>{salesTrendInsights.latestPoint ? `${salesTrendInsights.latestPoint.totalQuantity} units` : "N/A"}</Pill>
              </div>
            </div>
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
        </>
      )}

      {activeTab === "pharmacy" && (
        <Card>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
            <SectionTitle
              title={pharmacyInputMode === "search" ? "Assign Pharmacies from OpenStreetMap" : "Add Pharmacy Manually"}
              subtitle={pharmacyInputMode === "search"
                ? "Search OSM for pharmacies already mapped in your region."
                : "Enter pharmacy details directly — useful when OSM data is sparse."}
            />
            <div className="pn-tab-bar" style={{ padding: 4, borderRadius: 10 }}>
              <button
                type="button"
                className={`pn-tab-btn${pharmacyInputMode === "search" ? " active" : ""}`}
                style={{ padding: "6px 14px", fontSize: 13 }}
                onClick={() => setPharmacyInputMode("search")}
              >
                OSM Search
              </button>
              <button
                type="button"
                className={`pn-tab-btn${pharmacyInputMode === "manual" ? " active" : ""}`}
                style={{ padding: "6px 14px", fontSize: 13 }}
                onClick={() => setPharmacyInputMode("manual")}
              >
                Manual Entry
              </button>
            </div>
          </div>

          {pharmacyInputMode === "search" && (
            <>
              <div className="inline-form">
                <Field label="Search OpenStreetMap">
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
                      <p className="muted">{place.address || "OpenStreetMap result"}</p>
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
                {googlePharmacyResults.length === 0 && (
                  <p className="muted">
                    {pharmacySearchStatus
                      ? pharmacySearchStatus
                      : "Search OpenStreetMap to find pharmacies to assign. If no results appear, use Manual Entry instead."}
                  </p>
                )}
              </div>
              {googlePharmacyResults.length > 0 && <p className="muted">{pharmacySearchStatus}</p>}
            </>
          )}

          {pharmacyInputMode === "manual" && (
            <>
              <div className="inline-form">
                <Field label="Pharmacy Name *">
                  <input value={manualName} onChange={(e) => setManualName(e.target.value)} placeholder="e.g. Samadhi Pharmacy" />
                </Field>
                <Field label="Address">
                  <input value={manualAddress} onChange={(e) => setManualAddress(e.target.value)} placeholder="Street, city or area" />
                </Field>
                <Button className="ghost" onClick={() => void geocodeManualAddress()}>Find Coordinates</Button>
              </div>
              <div className="inline-form">
                <Field label="Latitude">
                  <input type="number" step="any" value={manualLat} onChange={(e) => setManualLat(e.target.value)} placeholder="e.g. 6.9271" />
                </Field>
                <Field label="Longitude">
                  <input type="number" step="any" value={manualLng} onChange={(e) => setManualLng(e.target.value)} placeholder="e.g. 79.8612" />
                </Field>
                <Field label="Territory *">
                  <select value={selectedPharmacyTerritoryId} onChange={(event) => setSelectedPharmacyTerritoryId(event.target.value)}>
                    <option value="">Select territory</option>
                    {territories.map((territory) => (
                      <option key={territory.id} value={territory.id}>{territory.name}</option>
                    ))}
                  </select>
                </Field>
                <Button onClick={() => void saveManualPharmacy()}>Save Pharmacy</Button>
              </div>
              {manualStatus && <p className="muted">{manualStatus}</p>}
            </>
          )}

          <div style={{ marginTop: 16 }}>
            <p className="muted" style={{ marginBottom: 6, fontWeight: 600 }}>Assigned pharmacies</p>
            <div className="table-list">
              {assignedPharmacies.map((pharmacy) => (
                <div key={pharmacy.id} className="table-row">
                  <div>
                    <strong>{pharmacy.name}</strong>
                    <p className="muted">{pharmacy.address || pharmacy.notes || "Assigned pharmacy"}</p>
                  </div>
                  <div className="chips">
                    <Pill>{pharmacy.code}</Pill>
                    {pharmacy.googlePlaceId?.startsWith("manual:") ? <Pill>Manual</Pill> : pharmacy.googlePlaceId ? <Pill>OSM</Pill> : null}
                  </div>
                </div>
              ))}
              {assignedPharmacies.length === 0 && <p className="muted">No pharmacies assigned for the selected territory.</p>}
            </div>
          </div>
        </Card>
      )}

      {activeTab === "targets" && (
        <>
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
            <SectionTitle
              title="Assigned Brands"
              subtitle={targetSalesRepId
                ? `Active brand assignments for ${salesReps.find((r) => r.id === targetSalesRepId)?.fullName ?? "selected rep"}.`
                : "Select a Sales Rep above to view their brand assignments."}
            />
            {srProducts.length > 0 ? (
              <div className="table-list">
                {srProducts.map((p) => (
                  <div key={p.productId} className="table-row">
                    <div>
                      <strong>{p.brandName || p.productName}</strong>
                      <p className="muted">{p.productName}{p.productCode ? ` · ${p.productCode}` : ""}{p.manufacturerType ? ` · ${p.manufacturerType}` : ""}</p>
                    </div>
                    <div className="chips">
                      <Pill>{p.active ? "Active" : "Inactive"}</Pill>
                      <Pill>from {p.startsOn}</Pill>
                      {p.endsOn && <Pill>until {p.endsOn}</Pill>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted">
                {targetSalesRepId ? "No brands assigned to this rep." : "Select a Sales Rep to view assigned brands."}
              </p>
            )}
          </Card>
        </>
      )}

      {activeTab === "coaching" && (
        <>
          <Card>
            <SectionTitle
              title="Visit Logs"
              subtitle={mrId
                ? `Recent doctor visits by ${mrs.find((m) => m.id === mrId)?.fullName ?? "selected MR"}.`
                : "Select an MR in the filter above to view their visit history."}
            />
            {mrVisitsLoading && <p className="muted">Loading visits…</p>}
            {!mrVisitsLoading && mrVisits.length > 0 && (
              <div className="table-list">
                {mrVisits.map((v) => (
                  <div key={v.id} className="table-row">
                    <div>
                      <strong>{v.doctorName ?? "Doctor"}</strong>
                      <p className="muted">
                        {new Date(v.visitTime).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
                        {v.notes ? ` · ${v.notes.slice(0, 60)}${v.notes.length > 60 ? "…" : ""}` : ""}
                      </p>
                    </div>
                    <div className="chips">
                      <Pill>{v.outcome}</Pill>
                      {v.followUpRequired && <Pill>Follow-up</Pill>}
                      {v.gpsCaptured && <Pill>GPS</Pill>}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {!mrVisitsLoading && mrVisits.length === 0 && (
              <p className="muted">{mrId ? "No visits recorded for this MR." : "Select an MR to view visit logs."}</p>
            )}
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
              <div className="manager-coaching-list">
                <div className="manager-coaching-row">
                  <strong>Configured day plans</strong>
                  <span>{analytics.coachingSummary.configuredScheduleCount} of {analytics.coachingSummary.totalMrCount} MRs</span>
                  <Pill>{analytics.coachingSummary.scheduleCoverageRate.toFixed(0)}%</Pill>
                </div>
                <div className="manager-coaching-row">
                  <strong>Visits inside work windows</strong>
                  <span>Share of visits logged within MR workday minus break windows</span>
                  <Pill>{analytics.coachingSummary.workdayVisitRate.toFixed(0)}%</Pill>
                </div>
                <div className="manager-coaching-row">
                  <strong>Average day-plan adherence</strong>
                  <span>Average visit volume against each MR's planned daily capacity</span>
                  <Pill>{analytics.coachingSummary.planAdherenceRate.toFixed(0)}%</Pill>
                </div>
                <div className="manager-coaching-row">
                  <strong>Overdue reschedules</strong>
                  <span>Recommendations that were rescheduled but are now past due</span>
                  <Pill>{analytics.coachingSummary.overdueReschedules}</Pill>
                </div>
                <div className="manager-coaching-row">
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
        </>
      )}

      {status && <p className="muted" style={{ padding: "0 4px" }}>{status}</p>}
    </div>
  );
}
