import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { registerUser, type RegisterUserRequest } from "../api";
import { useAuth } from "../auth/AuthContext";

type AccountRole = "MR" | "SALES_REP" | "MANAGER" | "ADMIN";
type AuthMode = "signin" | "register";

const ROLE_PRESETS: Record<AccountRole, { username: string; label: string }> = {
  MR: { username: "mr1", label: "Med Rep" },
  SALES_REP: { username: "sales1", label: "Sales Rep" },
  MANAGER: { username: "manager1", label: "Manager" },
  ADMIN: { username: "admin1", label: "Admin" },
};

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
    setStatus("Signing in...");
    try {
      const role = await login(username, password);
      setStatus("Signed in");
      navigate(routeForRole(role));
    } catch {
      setStatus("Login failed");
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
    setStatus("Creating account...");
    try {
      await registerUser({
        fullName,
        email,
        username,
        password,
        role: normalizedRole as RegisterUserRequest["role"],
      });
      const role = await login(username, password);
      setStatus("Account created");
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
      if (username === "mr1" || username === "sales1" || username === "manager1" || username === "admin1") {
        setUsername("");
      }
      return;
    }
    setSelectedRole("MR");
    setUsername(ROLE_PRESETS.MR.username);
    setPassword("password");
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
          <h2>{mode === "signin" ? "Welcome back" : "Create account"}</h2>
          <p className="muted">
            {mode === "signin" ? "Sign in to your account to continue" : "Register a field account to continue"}
          </p>

          <div className="auth-role-tabs" role="tablist" aria-label="Authentication mode">
            <button
              type="button"
              className={`auth-role-tab ${mode === "signin" ? "active" : ""}`}
              onClick={() => switchMode("signin")}
            >
              Sign In
            </button>
            <button
              type="button"
              className={`auth-role-tab ${mode === "register" ? "active" : ""}`}
              onClick={() => switchMode("register")}
            >
              Register
            </button>
          </div>

          <div className="auth-role-tabs" role="tablist" aria-label="Account roles">
            {(mode === "signin"
              ? (["MR", "SALES_REP", "MANAGER", "ADMIN"] as AccountRole[])
              : (["MR", "SALES_REP", "MANAGER"] as AccountRole[])
            ).map((role) => (
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

          {mode === "register" && (
            <>
              <label className="auth-field">
                <span>Full Name</span>
                <input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Your full name"
                  autoComplete="name"
                />
              </label>

              <label className="auth-field">
                <span>Email</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@pharma.com"
                  autoComplete="email"
                />
              </label>
            </>
          )}

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
                placeholder={mode === "signin" ? "password" : "At least 8 characters"}
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
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

          <button
            type="button"
            className="auth-submit"
            onClick={mode === "signin" ? onLogin : onRegister}
            disabled={isSubmitting}
          >
            {isSubmitting
              ? mode === "signin" ? "Signing in..." : "Creating account..."
              : mode === "signin" ? "Sign In" : "Create Account"}
          </button>

          {status && <p className="auth-status">{status}</p>}

          <p className="auth-footnote">
            {mode === "signin"
              ? "Demo accounts: mr1, sales1, manager1, admin1 (password: password)"
              : "Admin accounts are created by an existing administrator."}
          </p>
          <p className="auth-copyright">© {currentYear} PharmaNext NBA Platform</p>
        </div>
      </section>
    </div>
  );
}
