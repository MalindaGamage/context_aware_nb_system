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
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
};

export type UserSummary = {
  id: string;
  fullName: string;
  email: string;
  territories: Territory[];
};

const apiBase = import.meta.env.VITE_API_BASE_URL ?? "/api/v1";
const keycloakUrl = import.meta.env.VITE_KEYCLOAK_URL ?? "http://localhost:8081";
const realm = import.meta.env.VITE_KEYCLOAK_REALM ?? "nba";
const clientId = import.meta.env.VITE_KEYCLOAK_CLIENT_ID ?? "nba-api";

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
  let realmRole = "";
  try {
    const payload = JSON.parse(atob(data.access_token.split(".")[1]));
    realmRole = payload?.realm_access?.roles?.[0] ?? "";
  } catch {
    realmRole = "";
  }
  return { ...data, realm_role: realmRole };
}

export async function fetchDoctors(token: string, params: { tier?: string; specialty?: string; territoryId?: string }) {
  const search = new URLSearchParams();
  if (params.tier) search.set("tier", params.tier);
  if (params.specialty) search.set("specialty", params.specialty);
  if (params.territoryId) search.set("territoryId", params.territoryId);
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

export async function fetchSecurePing(token: string) {
  const res = await fetch(`${apiBase}/secure/ping`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Ping failed");
  return await res.text();
}
