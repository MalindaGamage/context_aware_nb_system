import { useAuth } from "../auth/AuthContext";
import UserTerritoryAdmin from "./UserTerritoryAdmin";

export default function ManagerDashboard() {
  const { token } = useAuth();
  if (!token) return null;

  return (
    <UserTerritoryAdmin
      token={token}
      canManageManagers={false}
      title="Manager Portal"
      subtitle="Manage MRs, territories, and assignment coverage."
    />
  );
}
