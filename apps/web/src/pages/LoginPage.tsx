import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { Button, Card, Field } from "../ui/components";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("mr1");
  const [password, setPassword] = useState("password");
  const [status, setStatus] = useState("");

  const onLogin = async () => {
    setStatus("Signing in...");
    try {
      await login(username, password);
      console.log("nba_token:", localStorage.getItem("nba_token"));
      console.log("nba_role:", localStorage.getItem("nba_role"));
      setStatus("Signed in");
      if (username.startsWith("admin")) navigate("/admin");
      else if (username.startsWith("manager")) navigate("/manager");
      else navigate("/mr");
    } catch {
      setStatus("Login failed");
    }
  };

  return (
    <div className="login-page">
      <Card className="login-card">
        <h1>NBA Field Assistant</h1>
        <p className="muted">Sign in with the demo Keycloak users.</p>
        <Field label="Username">
          <input value={username} onChange={(e) => setUsername(e.target.value)} />
        </Field>
        <Field label="Password">
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <Button onClick={onLogin}>Sign in</Button>
        {status && <p className="status">{status}</p>}
        <div className="hint">
          <span>Demo users:</span>
          <code>mr1 / password</code>
          <code>manager1 / password</code>
          <code>admin1 / password</code>
        </div>
      </Card>
    </div>
  );
}
