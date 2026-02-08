import { useAuth } from "../auth/AuthContext";
import UserTerritoryAdmin from "./UserTerritoryAdmin";

export default function AdminDashboard() {
  const { token } = useAuth();
  if (!token) return null;

  return (
    <UserTerritoryAdmin
      token={token}
      canManageManagers
      title="Admin Console"
      subtitle="Manage managers, MRs, territories, and assignments."
    />
  );
}
