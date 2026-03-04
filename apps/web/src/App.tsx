import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext";
import RequireAuth from "./auth/RequireAuth";
import AppShell from "./layout/AppShell";
import LoginPage from "./pages/LoginPage";
import NbaDashboardPage from "./pages/NbaDashboardPage";
import SalesRepDashboard from "./pages/SalesRepDashboard";
import DoctorDirectoryPage from "./pages/DoctorDirectoryPage";
import VisitLogPage from "./pages/VisitLogPage";
import ManagerDashboard from "./pages/ManagerDashboard";
import TerritoriesPage from "./pages/TerritoriesPage";
import AdminSettingsPage from "./pages/AdminSettingsPage";

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
                  <NbaDashboardPage />
                </AppShell>
              </RequireAuth>
            }
          />
          <Route
            path="/sales"
            element={
              <RequireAuth roles={["SALES_REP", "MANAGER", "ADMIN"]}>
                <AppShell>
                  <SalesRepDashboard />
                </AppShell>
              </RequireAuth>
            }
          />
          <Route
            path="/doctors"
            element={
              <RequireAuth roles={["MR", "MANAGER", "ADMIN"]}>
                <AppShell>
                  <DoctorDirectoryPage />
                </AppShell>
              </RequireAuth>
            }
          />
          <Route
            path="/visits"
            element={
              <RequireAuth roles={["MR", "MANAGER", "ADMIN"]}>
                <AppShell>
                  <VisitLogPage />
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
            path="/territories"
            element={
              <RequireAuth roles={["MANAGER", "ADMIN"]}>
                <AppShell>
                  <TerritoriesPage />
                </AppShell>
              </RequireAuth>
            }
          />
          <Route
            path="/admin-settings"
            element={
              <RequireAuth roles={["ADMIN"]}>
                <AppShell>
                  <AdminSettingsPage />
                </AppShell>
              </RequireAuth>
            }
          />
          <Route path="/manager/territories" element={<Navigate to="/territories" replace />} />
          <Route path="/sr" element={<Navigate to="/sales" replace />} />
          <Route path="/admin" element={<Navigate to="/admin-settings" replace />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
