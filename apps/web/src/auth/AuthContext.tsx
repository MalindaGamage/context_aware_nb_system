import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { isAccessTokenExpired, login as loginRequest } from "../api";

type AuthState = {
  token: string | null;
  role: string | null;
  username: string;
};

type AuthContextValue = AuthState & {
  login: (username: string, password: string) => Promise<string | null>;
  logout: () => void;
  setRole: (role: string | null) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const TOKEN_KEY = "nba_token";
const ROLE_KEY = "nba_role";
const USER_KEY = "nba_user";

function readStoredToken() {
  const storedToken = localStorage.getItem(TOKEN_KEY);
  if (!storedToken || !isAccessTokenExpired(storedToken)) {
    return storedToken;
  }

  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(ROLE_KEY);
  return null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(readStoredToken);
  const [role, setRole] = useState<string | null>(() => (token ? localStorage.getItem(ROLE_KEY) : null));
  const [username, setUsername] = useState<string>(localStorage.getItem(USER_KEY) ?? "mr1");

  useEffect(() => {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  }, [token]);

  useEffect(() => {
    if (role) localStorage.setItem(ROLE_KEY, role);
    else localStorage.removeItem(ROLE_KEY);
  }, [role]);

  useEffect(() => {
    if (username) localStorage.setItem(USER_KEY, username);
  }, [username]);

  const login = async (user: string, password: string) => {
    const response = await loginRequest(user, password);
    const resolvedRole = response.realm_role || null;
    setToken(response.access_token);
    setRole(resolvedRole);
    setUsername(user);
    return resolvedRole;
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(ROLE_KEY);
    localStorage.removeItem(USER_KEY);
    setToken(null);
    setRole(null);
    setUsername("mr1");
  };

  const value = useMemo(
    () => ({ token, role, username, login, logout, setRole }),
    [token, role, username]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
