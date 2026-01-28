import { Navigate } from "react-router-dom";
import { useAuth } from "./AuthContext";

type Props = {
  roles: string[];
  children: React.ReactNode;
};

export default function RequireAuth({ roles, children }: Props) {
  const { token, role } = useAuth();

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (role && roles.length > 0 && !roles.includes(role)) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
