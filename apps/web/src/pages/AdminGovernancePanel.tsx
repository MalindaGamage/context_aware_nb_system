import { useEffect, useMemo, useState } from "react";
import {
  activateScoringConfig,
  assignDoctorTerritory,
  createScoringConfig,
  fetchAdminProducts,
  fetchMrProfiles,
  fetchEvaluationSummary,
  fetchActiveScoringConfig,
  fetchAuditLogs,
  fetchDoctors,
  fetchRecommendationLogs,
  fetchScoringConfigs,
  fetchSalesReps,
  fetchTerritories,
  fetchUserAssignedProducts,
  replaceUserAssignedProducts,
  type AuditLog,
  type Doctor,
  type EvaluationSummary,
  type UserProfile,
  type UserProductAssignment,
  type ProductSummary,
  type RecommendationLog,
  type ScoringConfig,
  type Territory,
} from "../api";
import { Button, Card, Field, Pill, SectionTitle } from "../ui/components";

type Props = {
  token: string;
};

const defaultWeights = {
  tierA: 25,
  tierB: 15,
  tierC: 8,
  tierDefault: 4,
  priorityScale: 35,
  recencyScale: 15,
  followUpBonus: 20,
  recentVisitPenalty: -10,
  maxRecencyDays: 45,
};

const defaultMessages = {
  templateTopDrivers: "{driver1}, {driver2}, {driver3}",
  templateFallback: "Prioritized by active segment and recency",
};

const defaultSegments = [
  { name: "A-HCP", tier: "A", priorityMin: 80, scoreBonus: 4 },
  { name: "Follow-Up", followUpRequired: true, scoreBonus: 3 },
];

const defaultEvaluation: EvaluationSummary = {
  totalRecommendations: 0,
  recommendationsWithFeedback: 0,
  feedbackCoverageRate: 0,
  doneRate: 0,
  skippedRate: 0,
  rescheduledRate: 0,
  overrideRate: 0,
  avgFeedbackLatencyHours: 0,
  visitFollowThroughRate: 0,
  avgScoreAccepted: 0,
  avgScoreSkipped: 0,
  topDriverEffectiveness: [],
};

export default function AdminGovernancePanel({ token }: Props) {
  const [configs, setConfigs] = useState<ScoringConfig[]>([]);
  const [activeConfig, setActiveConfig] = useState<ScoringConfig | null>(null);
  const [name, setName] = useState("Ops Tuning");
  const [weightsText, setWeightsText] = useState(JSON.stringify(defaultWeights, null, 2));
  const [messagesText, setMessagesText] = useState(JSON.stringify(defaultMessages, null, 2));
  const [segmentsText, setSegmentsText] = useState(JSON.stringify(defaultSegments, null, 2));
  const [activateOnCreate, setActivateOnCreate] = useState(true);

  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [doctorId, setDoctorId] = useState("");
  const [territoryId, setTerritoryId] = useState("");
  const [fieldUsers, setFieldUsers] = useState<UserProfile[]>([]);
  const [products, setProducts] = useState<ProductSummary[]>([]);
  const [assignmentUserId, setAssignmentUserId] = useState("");
  const [assignedProducts, setAssignedProducts] = useState<UserProductAssignment[]>([]);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);

  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [recommendationLogs, setRecommendationLogs] = useState<RecommendationLog[]>([]);
  const [evaluation, setEvaluation] = useState<EvaluationSummary>(defaultEvaluation);
  const [status, setStatus] = useState("");

  const sortedConfigs = useMemo(() => [...configs].sort((a, b) => b.version - a.version), [configs]);

  const loadData = async () => {
    try {
      const [loadedConfigs, loadedActive, doctorPage, loadedTerritories, loadedAudits, loadedRecLogs, loadedEvaluation, loadedMrs, loadedSalesReps, loadedProducts] = await Promise.all([
        fetchScoringConfigs(token),
        fetchActiveScoringConfig(token),
        fetchDoctors(token, {}),
        fetchTerritories(token),
        fetchAuditLogs(token, { size: 20 }),
        fetchRecommendationLogs(token, { size: 20 }),
        fetchEvaluationSummary(token, {}),
        fetchMrProfiles(token),
        fetchSalesReps(token),
        fetchAdminProducts(token),
      ]);
      setConfigs(loadedConfigs);
      setActiveConfig(loadedActive);
      setDoctors(doctorPage.content);
      setTerritories(loadedTerritories);
      setAuditLogs(loadedAudits.content);
      setRecommendationLogs(loadedRecLogs.content);
      setEvaluation(loadedEvaluation);
      setProducts(loadedProducts);
      const mergedUsers = [...loadedMrs, ...loadedSalesReps];
      setFieldUsers(mergedUsers);
      if (mergedUsers[0]) {
        setAssignmentUserId((current) => current || mergedUsers[0].id);
      }
    } catch {
      setStatus("Failed to load governance data");
    }
  };

  useEffect(() => {
    void loadData();
  }, [token]);

  useEffect(() => {
    if (!assignmentUserId) return;
    void fetchUserAssignedProducts(token, assignmentUserId)
      .then((rows) => {
        setAssignedProducts(rows);
        setSelectedProductIds(rows.map((row) => row.productId));
      })
      .catch(() => {
        setAssignedProducts([]);
        setSelectedProductIds([]);
      });
  }, [assignmentUserId, token]);

  const createConfig = async () => {
    try {
      const weights = JSON.parse(weightsText);
      const messages = JSON.parse(messagesText);
      const segments = JSON.parse(segmentsText);
      await createScoringConfig(token, { name, weights, messages, segments, activate: activateOnCreate });
      setStatus("Scoring config saved");
      await loadData();
    } catch {
      setStatus("Invalid JSON or failed to save scoring config");
    }
  };

  const activateConfig = async (configId: string) => {
    try {
      await activateScoringConfig(token, configId);
      setStatus("Scoring config activated");
      await loadData();
    } catch {
      setStatus("Failed to activate scoring config");
    }
  };

  const assignDoctor = async () => {
    if (!doctorId) return;
    try {
      await assignDoctorTerritory(token, doctorId, { territoryId: territoryId || null });
      setStatus("Doctor territory updated");
      await loadData();
    } catch {
      setStatus("Failed to update doctor territory");
    }
  };

  const saveProductAssignments = async () => {
    if (!assignmentUserId) return;
    try {
      const result = await replaceUserAssignedProducts(token, assignmentUserId, { productIds: selectedProductIds });
      setAssignedProducts(result);
      setStatus("User product assignments updated");
    } catch {
      setStatus("Failed to update user product assignments");
    }
  };

  return (
    <div className="page">
      <Card>
        <SectionTitle title="Scoring Configuration" subtitle="Versioned weights/messages/segments. Activate instantly without redeploy." />
        {activeConfig && (
          <div className="chips">
            <Pill>Active v{activeConfig.version}</Pill>
            <Pill>{activeConfig.name}</Pill>
          </div>
        )}
        <div className="inline-form">
          <Field label="Version Name">
            <input value={name} onChange={(event) => setName(event.target.value)} />
          </Field>
          <label className="muted">
            <input type="checkbox" checked={activateOnCreate} onChange={(event) => setActivateOnCreate(event.target.checked)} /> Activate immediately
          </label>
          <Button onClick={createConfig}>Create Version</Button>
        </div>
        <div className="inline-form">
          <Field label="Weights JSON">
            <textarea rows={8} value={weightsText} onChange={(event) => setWeightsText(event.target.value)} />
          </Field>
          <Field label="Messages JSON">
            <textarea rows={8} value={messagesText} onChange={(event) => setMessagesText(event.target.value)} />
          </Field>
          <Field label="Segments JSON">
            <textarea rows={8} value={segmentsText} onChange={(event) => setSegmentsText(event.target.value)} />
          </Field>
        </div>
        <div className="table-list">
          {sortedConfigs.map((config) => (
            <div key={config.id} className="table-row">
              <div>
                <strong>v{config.version} - {config.name}</strong>
                <p className="muted">{new Date(config.createdAt).toLocaleString()}</p>
              </div>
              <div className="row-actions">
                {config.active ? <Pill>Active</Pill> : <Button className="ghost" onClick={() => activateConfig(config.id)}>Activate</Button>}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <SectionTitle title="Field Product Assignment" subtitle="Assign 5-6 company brands to MRs and Sales Reps." />
        <div className="inline-form">
          <Field label="Field User">
            <select value={assignmentUserId} onChange={(event) => setAssignmentUserId(event.target.value)}>
              <option value="">Select user</option>
              {fieldUsers.map((user) => (
                <option key={user.id} value={user.id}>{user.fullName} ({user.role})</option>
              ))}
            </select>
          </Field>
          <Field label="Products">
            <select
              multiple
              value={selectedProductIds}
              onChange={(event) =>
                setSelectedProductIds(Array.from(event.target.selectedOptions).map((option) => option.value))
              }
            >
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </select>
          </Field>
          <Button onClick={saveProductAssignments}>Save Assignments</Button>
        </div>
        <div className="chips">
          {assignedProducts.map((product) => (
            <Pill key={product.productId}>{product.brandName || product.productName}</Pill>
          ))}
        </div>
      </Card>

      <Card>
        <SectionTitle title="Doctor Territory Workflow" subtitle="Assign doctor to territory (or clear assignment)." />
        <div className="inline-form">
          <Field label="Doctor">
            <select value={doctorId} onChange={(event) => setDoctorId(event.target.value)}>
              <option value="">Select doctor</option>
              {doctors.map((doctor) => (
                <option key={doctor.id} value={doctor.id}>
                  {doctor.fullName}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Territory">
            <select value={territoryId} onChange={(event) => setTerritoryId(event.target.value)}>
              <option value="">Unassign</option>
              {territories.map((territory) => (
                <option key={territory.id} value={territory.id}>
                  {territory.name}
                </option>
              ))}
            </select>
          </Field>
          <Button onClick={assignDoctor}>Save Mapping</Button>
        </div>
      </Card>

      <Card>
        <SectionTitle title="Audit Logs" subtitle="Recent critical changes." />
        <div className="table-list">
          {auditLogs.map((log) => (
            <div key={log.id} className="table-row">
              <div>
                <strong>{log.action}</strong>
                <p className="muted">{log.entityType} | {new Date(log.createdAt).toLocaleString()}</p>
              </div>
              <Pill>{log.entityId ?? "n/a"}</Pill>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <SectionTitle title="Evaluation Summary" subtitle="Core KPIs for offline analysis, user assessment, and continuous improvement." />
        <div className="pn-kpi-grid">
          <div className="pn-kpi"><span>Feedback Coverage</span><strong>{evaluation.feedbackCoverageRate.toFixed(0)}%</strong><em>{evaluation.recommendationsWithFeedback}/{evaluation.totalRecommendations}</em></div>
          <div className="pn-kpi"><span>Done Rate</span><strong>{evaluation.doneRate.toFixed(0)}%</strong><em>accepted recommendations</em></div>
          <div className="pn-kpi"><span>Follow-Through</span><strong>{evaluation.visitFollowThroughRate.toFixed(0)}%</strong><em>visited within 7 days</em></div>
          <div className="pn-kpi"><span>Avg Feedback Latency</span><strong>{evaluation.avgFeedbackLatencyHours.toFixed(1)}h</strong><em>time to feedback</em></div>
        </div>
        <div className="table-list">
          {evaluation.topDriverEffectiveness.map((driver) => (
            <div key={driver.driverKey} className="table-row">
              <div>
                <strong>{driver.driverKey}</strong>
                <p className="muted">{driver.recommendationCount} recommendations observed</p>
              </div>
              <Pill>{driver.doneRate.toFixed(0)}% done</Pill>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <SectionTitle title="Recommendation Logs" subtitle="Trace recommendations, drivers, and latest feedback state." />
        <div className="table-list">
          {recommendationLogs.map((log) => (
            <div key={log.recommendationId} className="table-row">
              <div>
                <strong>{log.doctorName}</strong>
                <p className="muted">
                  Score {log.score.toFixed(2)} | {new Date(log.createdAt).toLocaleString()} | {log.latestFeedbackStatus ?? "No feedback"}
                </p>
                {log.recommendedAction && <p><strong>Action:</strong> {log.recommendedAction}</p>}
                {log.recommendedMessage && <p className="muted">{log.recommendedMessage}</p>}
                <p>{log.explanation}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {status && <div className="toast">{status}</div>}
    </div>
  );
}
