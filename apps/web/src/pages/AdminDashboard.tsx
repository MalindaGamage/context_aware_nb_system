import { useAuth } from "../auth/AuthContext";
import AdminGovernancePanel from "./AdminGovernancePanel";
import UserTerritoryAdmin from "./UserTerritoryAdmin";

export default function AdminDashboard() {
  const { token } = useAuth();
  if (!token) return null;

  return (
    <div className="page">
      <UserTerritoryAdmin
        token={token}
        canManageManagers
        title="Admin Console"
        subtitle="Manage managers, MRs, territories, and assignments."
      />
      <AdminGovernancePanel token={token} />
    </div>
  );
}
