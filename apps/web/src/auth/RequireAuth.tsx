import { Navigate } from "react-router-dom";
import { useAuth } from "./AuthContext";

type Props = {
  roles: string[];
  children: React.ReactNode;
};

export default function RequireAuth({ roles, children }: Props) {
  const { token, role } = useAuth();
  // Avoid redirecting during the login state update by falling back to persisted values.
  const effectiveToken = token ?? localStorage.getItem("nba_token");
  const effectiveRole = role ?? localStorage.getItem("nba_role");

  if (!effectiveToken) {
    return <Navigate to="/login" replace />;
  }

  if (effectiveRole && roles.length > 0 && !roles.includes(effectiveRole)) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
