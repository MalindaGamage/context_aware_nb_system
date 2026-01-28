import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { login as loginRequest } from "../api";

type AuthState = {
  token: string | null;
  role: string | null;
  username: string;
};

type AuthContextValue = AuthState & {
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  setRole: (role: string | null) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const TOKEN_KEY = "nba_token";
const ROLE_KEY = "nba_role";
const USER_KEY = "nba_user";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(localStorage.getItem(TOKEN_KEY));
  const [role, setRole] = useState<string | null>(localStorage.getItem(ROLE_KEY));
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
    setToken(response.access_token);
    setRole(response.realm_role || null);
    setUsername(user);
  };

  const logout = () => {
    setToken(null);
    setRole(null);
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
