import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

type AccountRole = "MR" | "SALES_REP" | "MANAGER" | "ADMIN";

const ROLE_PRESETS: Record<AccountRole, { username: string; label: string }> = {
  MR: { username: "mr1", label: "Med Rep" },
  SALES_REP: { username: "sales1", label: "Sales Rep" },
  MANAGER: { username: "manager1", label: "Manager" },
  ADMIN: { username: "admin1", label: "Admin" },
};

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [selectedRole, setSelectedRole] = useState<AccountRole>("MR");
  const [username, setUsername] = useState(ROLE_PRESETS.MR.username);
  const [password, setPassword] = useState("password");
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentYear = useMemo(() => new Date().getFullYear(), []);

  const applyPreset = (role: AccountRole) => {
    setSelectedRole(role);
    setUsername(ROLE_PRESETS[role].username);
    setPassword("password");
    setStatus("");
  };

  const onLogin = async () => {
    if (!username.trim() || !password.trim()) {
      setStatus("Enter username and password");
      return;
    }

    setIsSubmitting(true);
    setStatus("Signing in...");
    try {
      const role = await login(username, password);
      setStatus("Signed in");
      if (role === "ADMIN") navigate("/admin-settings");
      else if (role === "MANAGER") navigate("/manager");
      else if (role === "SALES_REP") navigate("/sales");
      else navigate("/mr");
    } catch {
      setStatus("Login failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <section className="auth-brand-panel">
        <div className="auth-brand-mark">
          <div className="auth-brand-icon" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M13.5 2L5 13h5l-1.5 9L17 11h-5L13.5 2z" stroke="currentColor" strokeWidth="1.6" />
            </svg>
          </div>
          <div>
            <strong>PharmaNext</strong>
            <p>NBA Platform</p>
          </div>
        </div>

        <div className="auth-brand-copy">
          <h1>Context-Aware Next Best Action for Field Sales</h1>
          <p>
            Intelligent recommendations to optimize physician visits, prioritize actions, and maximize territory
            coverage.
          </p>
        </div>

        <div className="auth-metrics">
          <div>
            <strong>2s</strong>
            <span>NBA response time</span>
          </div>
          <div>
            <strong>85%</strong>
            <span>Coverage improvement</span>
          </div>
          <div>
            <strong>3x</strong>
            <span>Visit efficiency</span>
          </div>
        </div>
      </section>

      <section className="auth-form-panel">
        <div className="auth-form-wrap">
          <h2>Welcome back</h2>
          <p className="muted">Sign in to your account to continue</p>

          <div className="auth-role-tabs" role="tablist" aria-label="Account roles">
            {(["MR", "SALES_REP", "MANAGER", "ADMIN"] as AccountRole[]).map((role) => (
              <button
                key={role}
                type="button"
                className={`auth-role-tab ${selectedRole === role ? "active" : ""}`}
                onClick={() => applyPreset(role)}
              >
                {ROLE_PRESETS[role].label}
              </button>
            ))}
          </div>

          <label className="auth-field">
            <span>Username</span>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="name@pharma.com"
              autoComplete="username"
            />
          </label>

          <label className="auth-field">
            <span>Password</span>
            <div className="auth-password-wrap">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="password"
                autoComplete="current-password"
              />
              <button
                type="button"
                className="auth-password-toggle"
                onClick={() => setShowPassword((value) => !value)}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </label>

          <button type="button" className="auth-submit" onClick={onLogin} disabled={isSubmitting}>
            {isSubmitting ? "Signing in..." : "Sign In"}
          </button>

          {status && <p className="auth-status">{status}</p>}

          <p className="auth-footnote">Demo accounts: mr1, sales1, manager1, admin1 (password: password)</p>
          <p className="auth-copyright">© {currentYear} PharmaNext NBA Platform</p>
        </div>
      </section>
    </div>
  );
}
