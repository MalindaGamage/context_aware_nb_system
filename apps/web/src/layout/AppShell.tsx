import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import OfflineBanner from "../ui/OfflineBanner";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { role, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-icon">⚡</span>
          <div>
            <span>PharmaNext</span>
            <small>NBA Platform</small>
          </div>
        </div>
        <nav>
          <Link className={location.pathname === "/mr" ? "active" : ""} to="/mr">
            NBA Dashboard
          </Link>
          <Link className={location.pathname === "/doctors" ? "active" : ""} to="/doctors">
            Doctor Directory
          </Link>
          <Link className={location.pathname === "/visits" ? "active" : ""} to="/visits">
            Visit Log
          </Link>
          {(role === "MANAGER" || role === "ADMIN") && (
            <Link className={location.pathname === "/manager" ? "active" : ""} to="/manager">
              Manager Dashboard
            </Link>
          )}
          {(role === "MANAGER" || role === "ADMIN") && (
            <Link className={location.pathname === "/territories" ? "active" : ""} to="/territories">
              Territories
            </Link>
          )}
          {role === "ADMIN" && (
            <Link className={location.pathname === "/admin-settings" ? "active" : ""} to="/admin-settings">
              Admin Settings
            </Link>
          )}
        </nav>
        <div className="sidebar-bottom">
          <button className="ghost" type="button">Collapse</button>
          <button className="ghost" onClick={handleLogout}>
            Sign Out
          </button>
        </div>
      </aside>
      <main className="content">
        <OfflineBanner />
        {children}
      </main>
    </div>
  );
}
