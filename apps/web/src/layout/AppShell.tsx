import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import OfflineBanner from "../ui/OfflineBanner";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { role, logout } = useAuth();
  const location = useLocation();

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span>NBA</span>
          <small>Field Assistant</small>
        </div>
        <nav>
          <Link className={location.pathname === "/mr" ? "active" : ""} to="/mr">
            MR Workspace
          </Link>
          {(role === "MANAGER" || role === "ADMIN") && (
            <Link className={location.pathname === "/manager" ? "active" : ""} to="/manager">
              Manager Portal
            </Link>
          )}
          {role === "ADMIN" && (
            <Link className={location.pathname === "/admin" ? "active" : ""} to="/admin">
              Admin Console
            </Link>
          )}
        </nav>
        <button className="ghost" onClick={logout}>
          Log out
        </button>
      </aside>
      <main className="content">
        <OfflineBanner />
        {children}
      </main>
    </div>
  );
}
