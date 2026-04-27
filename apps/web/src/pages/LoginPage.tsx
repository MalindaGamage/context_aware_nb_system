import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { registerUser, type RegisterUserRequest } from "../api";
import { useAuth } from "../auth/AuthContext";

type AccountRole = "MR" | "SALES_REP" | "MANAGER" | "ADMIN";
type AuthMode = "signin" | "register";

const ROLE_PRESETS: Record<AccountRole, { username: string; label: string }> = {
  MR:       { username: "mr1",      label: "Med Rep"   },
  SALES_REP:{ username: "sales1",   label: "Sales Rep" },
  MANAGER:  { username: "manager1", label: "Manager"   },
  ADMIN:    { username: "admin1",   label: "Admin"     },
};

const FEATURES = [
  "AI-powered next best action recommendations",
  "Real-time territory coverage & analytics",
  "Offline-first for uninterrupted field work",
  "Route optimization with live GPS tracking",
];

function IconBolt() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M13.5 2L5 13h5l-1.5 9L17 11h-5L13.5 2z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconUser() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20a8 8 0 0 1 16 0" strokeLinecap="round" />
    </svg>
  );
}

function IconMail() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m2 7 10 8 10-8" />
    </svg>
  );
}

function IconLock() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <rect x="5" y="11" width="14" height="11" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" strokeLinecap="round" />
    </svg>
  );
}

function IconEye() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M2 12c2-5 5.5-8 10-8s8 3 10 8c-2 5-5.5 8-10 8S4 17 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function IconEyeOff() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" strokeLinecap="round" />
      <line x1="1" y1="1" x2="23" y2="23" strokeLinecap="round" />
    </svg>
  );
}

function RoleIcon({ role }: { role: AccountRole }) {
  if (role === "MR") return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  );
  if (role === "SALES_REP") return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M3 20h18M7 20V10M12 20V4M17 20v-7" />
    </svg>
  );
  if (role === "MANAGER") return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <circle cx="9" cy="7" r="3" /><path d="M3 21v-1a6 6 0 0 1 6-6" /><circle cx="17" cy="10" r="3" /><path d="M21 21v-1a6 6 0 0 0-6-6" />
    </svg>
  );
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M2 12h3M19 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12" />
    </svg>
  );
}

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<AuthMode>("signin");
  const [selectedRole, setSelectedRole] = useState<AccountRole>("MR");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState(ROLE_PRESETS.MR.username);
  const [password, setPassword] = useState("password");
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentYear = useMemo(() => new Date().getFullYear(), []);

  const applyPreset = (role: AccountRole) => {
    setSelectedRole(role);
    if (mode === "signin") {
      setUsername(ROLE_PRESETS[role].username);
      setPassword("password");
    }
    setStatus("");
  };

  const routeForRole = (role: string | null) => {
    if (role === "ADMIN") return "/admin-settings";
    if (role === "MANAGER") return "/manager";
    if (role === "SALES_REP") return "/sales";
    return "/mr";
  };

  const onLogin = async () => {
    if (!username.trim() || !password.trim()) {
      setStatus("Enter username and password");
      return;
    }
    setIsSubmitting(true);
    setStatus("Signing in…");
    try {
      const role = await login(username, password);
      setStatus("Signed in successfully");
      navigate(routeForRole(role));
    } catch {
      setStatus("Login failed. Check your credentials and try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const onRegister = async () => {
    const normalizedRole = selectedRole === "ADMIN" ? "MR" : selectedRole;
    if (!fullName.trim() || !email.trim() || !username.trim() || !password.trim()) {
      setStatus("Complete all registration fields");
      return;
    }
    if (password.length < 8) {
      setStatus("Password must be at least 8 characters");
      return;
    }
    setIsSubmitting(true);
    setStatus("Creating account…");
    try {
      await registerUser({
        fullName,
        email,
        username,
        password,
        role: normalizedRole as RegisterUserRequest["role"],
      });
      const role = await login(username, password);
      setStatus("Account created successfully");
      navigate(routeForRole(role));
    } catch {
      setStatus("Registration failed. Try a different username or email.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const switchMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setStatus("");
    if (nextMode === "register") {
      setSelectedRole((role) => (role === "ADMIN" ? "MR" : role));
      setPassword("");
      if (["mr1", "sales1", "manager1", "admin1"].includes(username)) setUsername("");
      return;
    }
    setSelectedRole("MR");
    setUsername(ROLE_PRESETS.MR.username);
    setPassword("password");
  };

  const statusKind = /failed|enter|must|complete|required|denied/i.test(status)
    ? "error"
    : status.endsWith("…")
    ? "info"
    : status
    ? "success"
    : null;

  const roles = mode === "signin"
    ? (["MR", "SALES_REP", "MANAGER", "ADMIN"] as AccountRole[])
    : (["MR", "SALES_REP", "MANAGER"] as AccountRole[]);

  return (
    <div className="auth-page">

      {/* ── LEFT: Brand Panel ── */}
      <section className="auth-brand-panel">
        <div className="auth-brand-glow" aria-hidden="true" />

        {/* Logo */}
        <div className="auth-logo">
          <div className="auth-logo-icon"><IconBolt /></div>
          <div>
            <strong>PharmaNext</strong>
            <span>NBA Platform</span>
          </div>
        </div>

        {/* Hero copy */}
        <div className="auth-hero">
          <div className="auth-hero-badge">
            <svg width="7" height="7" viewBox="0 0 8 8" fill="currentColor" aria-hidden="true"><circle cx="4" cy="4" r="4" /></svg>
            Field Intelligence Platform
          </div>
          <h1 className="auth-hero-title">
            Context-Aware<br />Next Best Action<br />for Field Sales
          </h1>
          <p className="auth-hero-sub">
            Intelligent recommendations to optimize physician visits, prioritize actions, and maximize territory coverage — all from the field.
          </p>
          <ul className="auth-features">
            {FEATURES.map((feat) => (
              <li key={feat}>
                <span className="auth-feature-check"><IconCheck /></span>
                {feat}
              </li>
            ))}
          </ul>
        </div>

        {/* Glass preview card */}
        <div className="auth-preview-card" aria-hidden="true">
          <div className="auth-preview-label">TOP RECOMMENDATION</div>
          <div className="auth-preview-doctor">
            <div className="auth-preview-avatar">MF</div>
            <div className="auth-preview-doctor-info">
              <strong>Dr. M. Fernando</strong>
              <span>Cardiology · Tier A</span>
            </div>
            <div className="auth-preview-score">94</div>
          </div>
          <div className="auth-preview-action">Follow-up Visit Recommended</div>
          <div className="auth-preview-drivers">
            <span>↑ 18 days since last visit</span>
            <span>↑ High prescribing rate</span>
          </div>
        </div>

        {/* Metrics */}
        <div className="auth-metrics">
          <div><strong>2s</strong><span>NBA response</span></div>
          <div><strong>85%</strong><span>Coverage lift</span></div>
          <div><strong>3×</strong><span>Visit efficiency</span></div>
        </div>
      </section>

      {/* ── RIGHT: Form Panel ── */}
      <section className="auth-form-panel">
        <div className="auth-form-wrap">

          {/* Mobile-only logo (hidden on desktop) */}
          <div className="auth-mobile-logo">
            <div className="auth-logo-icon"><IconBolt /></div>
            <strong>PharmaNext</strong>
          </div>

          {/* Heading */}
          <div>
            <h2 className="auth-form-title">
              {mode === "signin" ? "Welcome back" : "Create account"}
            </h2>
            <p className="auth-form-sub">
              {mode === "signin"
                ? "Sign in to your workspace to continue"
                : "Register a new field account to get started"}
            </p>
          </div>

          {/* Sign In / Register tabs */}
          <div className="auth-mode-switch" role="tablist" aria-label="Authentication mode">
            <button role="tab" type="button" className={`auth-mode-btn${mode === "signin" ? " active" : ""}`} onClick={() => switchMode("signin")}>Sign In</button>
            <button role="tab" type="button" className={`auth-mode-btn${mode === "register" ? " active" : ""}`} onClick={() => switchMode("register")}>Register</button>
          </div>

          {/* Role selector */}
          <div>
            <p className="auth-section-label">Account role</p>
            <div className={`auth-role-grid${mode === "register" ? " three-col" : ""}`}>
              {roles.map((role) => (
                <button
                  key={role}
                  type="button"
                  className={`auth-role-card${selectedRole === role ? " active" : ""}`}
                  onClick={() => applyPreset(role)}
                >
                  <div className="auth-role-card-icon"><RoleIcon role={role} /></div>
                  {ROLE_PRESETS[role].label}
                </button>
              ))}
            </div>
          </div>

          {/* Fields */}
          <div className="auth-fields">
            {mode === "register" && (
              <>
                <div className="auth-field-group">
                  <label htmlFor="auth-fullname">Full Name</label>
                  <div className="auth-input-wrap">
                    <span className="auth-input-icon"><IconUser /></span>
                    <input id="auth-fullname" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your full name" autoComplete="name" />
                  </div>
                </div>
                <div className="auth-field-group">
                  <label htmlFor="auth-email">Email address</label>
                  <div className="auth-input-wrap">
                    <span className="auth-input-icon"><IconMail /></span>
                    <input id="auth-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@pharma.com" autoComplete="email" />
                  </div>
                </div>
              </>
            )}

            <div className="auth-field-group">
              <label htmlFor="auth-username">Username</label>
              <div className="auth-input-wrap">
                <span className="auth-input-icon"><IconUser /></span>
                <input id="auth-username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Enter your username" autoComplete="username" />
              </div>
            </div>

            <div className="auth-field-group">
              <label htmlFor="auth-password">Password</label>
              <div className="auth-input-wrap">
                <span className="auth-input-icon"><IconLock /></span>
                <input
                  id="auth-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === "signin" ? "Enter your password" : "At least 8 characters"}
                  autoComplete={mode === "signin" ? "current-password" : "new-password"}
                />
                <button type="button" className="auth-eye-btn" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? "Hide password" : "Show password"}>
                  {showPassword ? <IconEyeOff /> : <IconEye />}
                </button>
              </div>
            </div>
          </div>

          {/* CTA */}
          <button type="button" className="auth-submit" onClick={mode === "signin" ? onLogin : onRegister} disabled={isSubmitting}>
            {isSubmitting && <span className="auth-spinner" aria-hidden="true" />}
            {isSubmitting
              ? (mode === "signin" ? "Signing in…" : "Creating account…")
              : (mode === "signin" ? "Sign In" : "Create Account")}
          </button>

          {/* Status alert */}
          {statusKind && (
            <div className={`auth-alert ${statusKind}`} role="alert">{status}</div>
          )}

          {/* Footer */}
          <div className="auth-form-footer">
            {mode === "signin" ? (
              <p className="auth-hint">
                Demo accounts: <code>mr1</code> · <code>sales1</code> · <code>manager1</code> · <code>admin1</code>
                <br />Default password: <code>password</code>
              </p>
            ) : (
              <p className="auth-hint">Admin accounts are provisioned by an existing administrator.</p>
            )}
            <p className="auth-copyright">© {currentYear} PharmaNext NBA Platform · All rights reserved</p>
          </div>

        </div>
      </section>
    </div>
  );
}
