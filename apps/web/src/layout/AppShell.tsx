import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import OfflineBanner from "../ui/OfflineBanner";

type NavItem = {
  to: string;
  label: string;
  shortLabel: string;
};

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { role, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return window.localStorage.getItem("app-shell-collapsed") === "true";
    } catch {
      return false;
    }
  });

  const navItems: NavItem[] = [
    ...(role !== "SALES_REP" ? [{ to: "/mr", label: "NBA Dashboard", shortLabel: "NBA" }] : []),
    ...(role === "SALES_REP" || role === "MANAGER" || role === "ADMIN"
      ? [{ to: "/sales", label: "Sales Dashboard", shortLabel: "Sales" }]
      : []),
    ...(role !== "SALES_REP" ? [{ to: "/doctors", label: "Doctor Directory", shortLabel: "Docs" }] : []),
    ...(role !== "SALES_REP" ? [{ to: "/visits", label: "Visit Log", shortLabel: "Visits" }] : []),
    ...(role === "MANAGER" || role === "ADMIN"
      ? [{ to: "/manager", label: "Manager Dashboard", shortLabel: "Mgr" }]
      : []),
    ...(role === "MANAGER" || role === "ADMIN"
      ? [{ to: "/territories", label: "Territories", shortLabel: "Terr" }]
      : []),
    ...(role === "ADMIN"
      ? [{ to: "/admin-settings", label: "Admin Settings", shortLabel: "Admin" }]
      : []),
  ];

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  const handleToggleCollapse = () => {
    setCollapsed((current) => {
      const next = !current;
      try {
        window.localStorage.setItem("app-shell-collapsed", String(next));
      } catch {
        // no-op
      }
      return next;
    });
  };

  return (
    <div className={`shell${collapsed ? " shell-collapsed" : ""}`}>
      <aside className={`sidebar${collapsed ? " is-collapsed" : ""}`}>
        <div className="brand">
          <span className="brand-icon">⚡</span>
          <div className="brand-copy">
            <span className="brand-title">PharmaNext</span>
            <small>NBA Platform</small>
          </div>
        </div>
        <nav>
          {navItems.map((item) => (
            <Link
              key={item.to}
              className={location.pathname === item.to ? "active" : ""}
              to={item.to}
              title={collapsed ? item.label : undefined}
            >
              <span className="nav-short" aria-hidden="true">{item.shortLabel}</span>
              <span className="nav-label">{item.label}</span>
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button
            className="sidebar-action sidebar-action-secondary"
            type="button"
            onClick={handleToggleCollapse}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <span className="sidebar-action-icon" aria-hidden="true">{collapsed ? "»" : "«"}</span>
            <span className="sidebar-action-label">{collapsed ? "Expand" : "Collapse"}</span>
          </button>
          <button
            className="sidebar-action sidebar-action-logout"
            type="button"
            onClick={handleLogout}
            title={collapsed ? "Sign Out" : undefined}
          >
            <span className="sidebar-action-icon" aria-hidden="true">↗</span>
            <span className="sidebar-action-label">Sign Out</span>
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
