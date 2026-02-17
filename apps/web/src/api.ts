export type Doctor = {
  id: string;
  fullName: string;
  specialty: string | null;
  tier: string;
  priorityScore: number;
  territoryId: string | null;
  notes: string | null;
};

export type Territory = {
  id: string;
  name: string;
  code: string;
};

export type PageResponse<T> = {
  content: T[];
  meta: {
    page: number;
    size: number;
    totalElements: number;
    totalPages: number;
  };
};

export type UserSummary = {
  id: string;
  fullName: string;
  email: string;
  territories: Territory[];
};

export type CoverageTierAnalytics = {
  tier: string;
  doctorCount: number;
  visitedDoctors: number;
  totalVisits: number;
  avgVisitsPerDoctor: number;
  avgDaysSinceLastVisit: number | null;
};

export type MissedHighPriority = {
  doctorId: string;
  doctorName: string;
  tier: string;
  priorityScore: number;
  territoryName: string | null;
  lastVisitTime: string | null;
};

export type ComplianceAnalytics = {
  totalFeedback: number;
  doneCount: number;
  skippedCount: number;
  rescheduledCount: number;
  overrideCount: number;
  doneRate: number;
  overrideRate: number;
};

export type MrComplianceRow = {
  mrId: string;
  mrName: string;
  feedbackCount: number;
  doneRate: number;
  overrideRate: number;
  skippedRate: number;
};

export type ManagerAnalyticsResponse = {
  coverageByTier: CoverageTierAnalytics[];
  missedHighPriority: MissedHighPriority[];
  compliance: ComplianceAnalytics;
  complianceByMr: MrComplianceRow[];
};

export type TerritoryOverview = {
  territoryId: string;
  territoryName: string;
  territoryCode: string;
  assignedMrCount: number;
  doctorCount: number;
  visitCount: number;
  lastVisitTime: string | null;
};

export type UserProfile = {
  id: string;
  fullName: string;
  email: string;
  active: boolean;
  role: "MR" | "MANAGER" | "ADMIN";
  territories: Territory[];
};

export type CreateUserRequest = {
  fullName: string;
  email: string;
};

export type UpdateUserRequest = {
  fullName: string;
  email: string;
  active: boolean;
};

export type CreateTerritoryRequest = {
  name: string;
  code: string;
};

export type AssignTerritoryRequest = {
  territoryId: string;
  startsOn?: string;
};

export type AssignDoctorTerritoryRequest = {
  territoryId: string | null;
};

export type ScoringConfig = {
  id: string;
  version: number;
  name: string;
  weights: Record<string, number>;
  messages: Record<string, string>;
  segments: Array<Record<string, unknown>>;
  active: boolean;
  createdByUserId: string | null;
  createdAt: string;
};

export type ProductSummary = {
  id: string;
  name: string;
  category: string;
  active: boolean;
  assignedDoctors: number;
};

export type CreateScoringConfigRequest = {
  name: string;
  weights: Record<string, number>;
  messages: Record<string, string>;
  segments: Array<Record<string, unknown>>;
  activate: boolean;
};

export type AuditLog = {
  id: string;
  actorUserId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type RecommendationLog = {
  recommendationId: string;
  userId: string;
  doctorId: string;
  doctorName: string;
  score: number;
  explanation: string;
  createdAt: string;
  drivers: RecommendationDriver[];
  latestFeedbackStatus: string | null;
  latestFeedbackReason: string | null;
  latestOverrideDoctorId: string | null;
};

export type Visit = {
  id: string;
  doctorId: string;
  userId: string;
  visitTime: string;
  outcome: string;
  notes: string | null;
  followUpRequired: boolean;
  clientReferenceId?: string | null;
  gpsCaptured: boolean;
  createdAt: string;
  updatedAt?: string;
};

export type CreateVisitRequest = {
  doctorId: string;
  visitTime: string;
  outcome: string;
  notes?: string;
  followUpRequired: boolean;
  clientReferenceId?: string;
};

export type CaptureVisitGpsRequest = {
  lat: number;
  lon: number;
  optIn: boolean;
};

export type RecommendationDriver = {
  key: string;
  value: string;
  contribution: number;
};

export type NbaRecommendation = {
  recommendationId: string;
  doctorId: string;
  doctorName: string;
  specialty: string | null;
  tier: string | null;
  priorityScore: number;
  score: number;
  explanation: string;
  drivers: RecommendationDriver[];
};

export type NbaNextResponse = {
  recommendations: NbaRecommendation[];
};

export type FeedbackStatus = "DONE" | "SKIPPED" | "RESCHEDULED";

export type RecommendationFeedbackRequest = {
  status: FeedbackStatus;
  reason?: string;
  overrideDoctorId?: string;
  rescheduledTo?: string;
  overrideNotes?: string;
  clientReferenceId: string;
};

export type RecommendationFeedbackResponse = {
  id: string;
  recommendationId: string;
  status: FeedbackStatus;
  reason: string | null;
  overrideDoctorId: string | null;
  rescheduledTo: string | null;
  overrideNotes: string | null;
  clientReferenceId: string;
  createdAt: string;
  updatedAt: string;
};

export type SyncConflictStrategy = "SERVER_WINS" | "CLIENT_WINS";

export type SyncVisitRequest = {
  clientReferenceId: string;
  doctorId: string;
  visitTime: string;
  outcome: string;
  notes?: string;
  followUpRequired: boolean;
};

export type SyncFeedbackRequest = {
  clientReferenceId: string;
  recommendationId: string;
  status: FeedbackStatus;
  reason?: string;
  overrideDoctorId?: string;
  rescheduledTo?: string;
  overrideNotes?: string;
};

export type SyncBatchRequest = {
  strategy: SyncConflictStrategy;
  visits: SyncVisitRequest[];
  feedback: SyncFeedbackRequest[];
};

export type SyncItemResult = {
  clientReferenceId: string;
  status: "APPLIED" | "CONFLICT";
  serverId: string;
  message: string;
};

export type SyncConflict = {
  type: "visit" | "feedback";
  clientReferenceId: string;
  serverId: string;
  reason: string;
};

export type SyncBatchResponse = {
  visitResults: SyncItemResult[];
  feedbackResults: SyncItemResult[];
  conflicts: SyncConflict[];
};

const apiBase = import.meta.env.VITE_API_BASE_URL ?? "/api/v1";
const keycloakUrl = import.meta.env.VITE_KEYCLOAK_URL ?? "/kc";
const realm = import.meta.env.VITE_KEYCLOAK_REALM ?? "nba";
const clientId = import.meta.env.VITE_KEYCLOAK_CLIENT_ID ?? "nba-api";

function authHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

function decodePrimaryRole(accessToken: string): string {
  try {
    const encodedPayload = accessToken.split(".")[1] ?? "";
    const base64 = encodedPayload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    const payload = JSON.parse(atob(padded));
    const roles: string[] = payload?.realm_access?.roles ?? [];
    return roles.find((role) => ["ADMIN", "MANAGER", "MR"].includes(role)) ?? roles[0] ?? "";
  } catch {
    return "";
  }
}

export async function login(username: string, password: string) {
  const body = new URLSearchParams({
    client_id: clientId,
    grant_type: "password",
    username,
    password,
  });

  const res = await fetch(`${keycloakUrl}/realms/${realm}/protocol/openid-connect/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    throw new Error("Login failed");
  }

  const data = await res.json();
  return { ...data, realm_role: decodePrimaryRole(data.access_token) };
}

export async function fetchDoctors(
  token: string,
  params: { tier?: string; specialty?: string; territoryId?: string; page?: number; size?: number }
) {
  const search = new URLSearchParams();
  if (params.tier) search.set("tier", params.tier);
  if (params.specialty) search.set("specialty", params.specialty);
  if (params.territoryId) search.set("territoryId", params.territoryId);
  search.set("page", String(params.page ?? 0));
  search.set("size", String(params.size ?? 100));
  const res = await fetch(`${apiBase}/doctors?${search.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to load doctors");
  return (await res.json()) as PageResponse<Doctor>;
}

export async function fetchNearbyDoctors(token: string, lat: number, lon: number, radiusKm: number) {
  const res = await fetch(`${apiBase}/doctors/nearby?lat=${lat}&lon=${lon}&radiusKm=${radiusKm}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to load doctors");
  return (await res.json()) as Doctor[];
}

export async function fetchTerritories(token: string) {
  const res = await fetch(`${apiBase}/territories`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to load territories");
  return (await res.json()) as Territory[];
}

export async function createTerritory(token: string, request: CreateTerritoryRequest) {
  const res = await fetch(`${apiBase}/territories`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(request),
  });
  if (!res.ok) throw new Error("Failed to create territory");
  return (await res.json()) as Territory;
}

export async function updateTerritory(token: string, territoryId: string, request: CreateTerritoryRequest) {
  const res = await fetch(`${apiBase}/territories/${territoryId}`, {
    method: "PUT",
    headers: authHeaders(token),
    body: JSON.stringify(request),
  });
  if (!res.ok) throw new Error("Failed to update territory");
  return (await res.json()) as Territory;
}

export async function deleteTerritory(token: string, territoryId: string) {
  const res = await fetch(`${apiBase}/territories/${territoryId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to delete territory");
}

export async function fetchMyTerritories(token: string) {
  const res = await fetch(`${apiBase}/users/me/territories`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to load territories");
  return (await res.json()) as Territory[];
}

export async function fetchMrSummaries(token: string) {
  const res = await fetch(`${apiBase}/users/mrs`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to load summaries");
  return (await res.json()) as UserSummary[];
}

export async function fetchMrProfiles(token: string) {
  const res = await fetch(`${apiBase}/users/mrs/profiles`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to load MRs");
  return (await res.json()) as UserProfile[];
}

export async function createMr(token: string, request: CreateUserRequest) {
  const res = await fetch(`${apiBase}/users/mrs`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(request),
  });
  if (!res.ok) throw new Error("Failed to create MR");
  return (await res.json()) as UserProfile;
}

export async function updateMr(token: string, userId: string, request: UpdateUserRequest) {
  const res = await fetch(`${apiBase}/users/mrs/${userId}`, {
    method: "PUT",
    headers: authHeaders(token),
    body: JSON.stringify(request),
  });
  if (!res.ok) throw new Error("Failed to update MR");
  return (await res.json()) as UserProfile;
}

export async function deleteMr(token: string, userId: string) {
  const res = await fetch(`${apiBase}/users/mrs/${userId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to delete MR");
}

export async function fetchManagers(token: string) {
  const res = await fetch(`${apiBase}/users/managers`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to load managers");
  return (await res.json()) as UserProfile[];
}

export async function createManager(token: string, request: CreateUserRequest) {
  const res = await fetch(`${apiBase}/users/managers`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(request),
  });
  if (!res.ok) throw new Error("Failed to create manager");
  return (await res.json()) as UserProfile;
}

export async function updateManager(token: string, userId: string, request: UpdateUserRequest) {
  const res = await fetch(`${apiBase}/users/managers/${userId}`, {
    method: "PUT",
    headers: authHeaders(token),
    body: JSON.stringify(request),
  });
  if (!res.ok) throw new Error("Failed to update manager");
  return (await res.json()) as UserProfile;
}

export async function deleteManager(token: string, userId: string) {
  const res = await fetch(`${apiBase}/users/managers/${userId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to delete manager");
}

export async function assignTerritoryToMr(token: string, userId: string, request: AssignTerritoryRequest) {
  const res = await fetch(`${apiBase}/users/${userId}/territories`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(request),
  });
  if (!res.ok) throw new Error("Failed to assign territory");
  return (await res.json()) as Territory[];
}

export async function unassignTerritoryFromMr(token: string, userId: string, territoryId: string) {
  const res = await fetch(`${apiBase}/users/${userId}/territories/${territoryId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to remove territory assignment");
  return (await res.json()) as Territory[];
}

export async function assignDoctorTerritory(token: string, doctorId: string, request: AssignDoctorTerritoryRequest) {
  const res = await fetch(`${apiBase}/doctors/${doctorId}/territory`, {
    method: "PUT",
    headers: authHeaders(token),
    body: JSON.stringify(request),
  });
  if (!res.ok) throw new Error("Failed to assign doctor territory");
  return (await res.json()) as Doctor;
}

export async function fetchSecurePing(token: string) {
  const res = await fetch(`${apiBase}/secure/ping`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Ping failed");
  return await res.text();
}

export async function createVisit(token: string, request: CreateVisitRequest) {
  const res = await fetch(`${apiBase}/visits`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(request),
  });
  if (!res.ok) throw new Error("Failed to create visit");
  return (await res.json()) as Visit;
}

export async function updateVisit(token: string, visitId: string, request: Omit<CreateVisitRequest, "doctorId">) {
  const res = await fetch(`${apiBase}/visits/${visitId}`, {
    method: "PUT",
    headers: authHeaders(token),
    body: JSON.stringify(request),
  });
  if (!res.ok) throw new Error("Failed to update visit");
  return (await res.json()) as Visit;
}

export async function fetchDoctorVisits(token: string, doctorId: string, page = 0, size = 20) {
  const res = await fetch(`${apiBase}/doctors/${doctorId}/visits?page=${page}&size=${size}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to load visit history");
  return (await res.json()) as PageResponse<Visit>;
}

export async function fetchMyVisits(token: string, page = 0, size = 20) {
  const res = await fetch(`${apiBase}/visits?page=${page}&size=${size}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to load visits");
  return (await res.json()) as PageResponse<Visit>;
}

export async function captureVisitGps(token: string, visitId: string, request: CaptureVisitGpsRequest) {
  const res = await fetch(`${apiBase}/visits/${visitId}/gps`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(request),
  });
  if (!res.ok) throw new Error("Failed to capture GPS");
  return (await res.json()) as Visit;
}

export async function fetchNbaNext(token: string, limit = 5) {
  const res = await fetch(`${apiBase}/nba/next?limit=${limit}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to load recommendations");
  return (await res.json()) as NbaNextResponse;
}

export async function fetchManagerAnalytics(
  token: string,
  params: { mrId?: string; territoryId?: string; from?: string; to?: string }
) {
  const search = new URLSearchParams();
  if (params.mrId) search.set("mrId", params.mrId);
  if (params.territoryId) search.set("territoryId", params.territoryId);
  if (params.from) search.set("from", params.from);
  if (params.to) search.set("to", params.to);
  const res = await fetch(`${apiBase}/analytics/manager?${search.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to load manager analytics");
  return (await res.json()) as ManagerAnalyticsResponse;
}

export async function fetchTerritoryOverview(token: string, params: { from?: string; to?: string }) {
  const search = new URLSearchParams();
  if (params.from) search.set("from", params.from);
  if (params.to) search.set("to", params.to);
  const res = await fetch(`${apiBase}/analytics/territories?${search.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to load territory overview");
  return (await res.json()) as TerritoryOverview[];
}

export async function submitRecommendationFeedback(
  token: string,
  recommendationId: string,
  request: RecommendationFeedbackRequest
) {
  const res = await fetch(`${apiBase}/recommendations/${recommendationId}/feedback`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(request),
  });
  if (!res.ok) throw new Error("Failed to submit feedback");
  return (await res.json()) as RecommendationFeedbackResponse;
}

export async function syncBatch(token: string, request: SyncBatchRequest) {
  const res = await fetch(`${apiBase}/sync/batch`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(request),
  });
  if (!res.ok) throw new Error("Sync failed");
  return (await res.json()) as SyncBatchResponse;
}

export async function fetchScoringConfigs(token: string) {
  const res = await fetch(`${apiBase}/admin/scoring-configs`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to load scoring configs");
  return (await res.json()) as ScoringConfig[];
}

export async function fetchActiveScoringConfig(token: string) {
  const res = await fetch(`${apiBase}/admin/scoring-configs/active`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to load active scoring config");
  return (await res.json()) as ScoringConfig;
}

export async function createScoringConfig(token: string, request: CreateScoringConfigRequest) {
  const res = await fetch(`${apiBase}/admin/scoring-configs`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(request),
  });
  if (!res.ok) throw new Error("Failed to create scoring config");
  return (await res.json()) as ScoringConfig;
}

export async function activateScoringConfig(token: string, configId: string) {
  const res = await fetch(`${apiBase}/admin/scoring-configs/${configId}/activate`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to activate scoring config");
  return (await res.json()) as ScoringConfig;
}

export async function fetchAuditLogs(
  token: string,
  params: { actorUserId?: string; action?: string; entityType?: string; from?: string; to?: string; page?: number; size?: number }
) {
  const search = new URLSearchParams();
  if (params.actorUserId) search.set("actorUserId", params.actorUserId);
  if (params.action) search.set("action", params.action);
  if (params.entityType) search.set("entityType", params.entityType);
  if (params.from) search.set("from", params.from);
  if (params.to) search.set("to", params.to);
  search.set("page", String(params.page ?? 0));
  search.set("size", String(params.size ?? 20));
  const res = await fetch(`${apiBase}/admin/audit-logs?${search.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to load audit logs");
  return (await res.json()) as PageResponse<AuditLog>;
}

export async function fetchRecommendationLogs(
  token: string,
  params: { userId?: string; doctorId?: string; page?: number; size?: number }
) {
  const search = new URLSearchParams();
  if (params.userId) search.set("userId", params.userId);
  if (params.doctorId) search.set("doctorId", params.doctorId);
  search.set("page", String(params.page ?? 0));
  search.set("size", String(params.size ?? 20));
  const res = await fetch(`${apiBase}/admin/recommendation-logs?${search.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to load recommendation logs");
  return (await res.json()) as PageResponse<RecommendationLog>;
}

export async function fetchAdminProducts(token: string) {
  const res = await fetch(`${apiBase}/admin/products`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to load products");
  return (await res.json()) as ProductSummary[];
}
