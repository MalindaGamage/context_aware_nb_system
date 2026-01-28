import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext";
import RequireAuth from "./auth/RequireAuth";
import AppShell from "./layout/AppShell";
import LoginPage from "./pages/LoginPage";
import MrDashboard from "./pages/MrDashboard";
import ManagerDashboard from "./pages/ManagerDashboard";
import AdminDashboard from "./pages/AdminDashboard";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/mr"
            element={
              <RequireAuth roles={["MR", "MANAGER", "ADMIN"]}>
                <AppShell>
                  <MrDashboard />
                </AppShell>
              </RequireAuth>
            }
          />
          <Route
            path="/manager"
            element={
              <RequireAuth roles={["MANAGER", "ADMIN"]}>
                <AppShell>
                  <ManagerDashboard />
                </AppShell>
              </RequireAuth>
            }
          />
          <Route
            path="/admin"
            element={
              <RequireAuth roles={["ADMIN"]}>
                <AppShell>
                  <AdminDashboard />
                </AppShell>
              </RequireAuth>
            }
          />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
