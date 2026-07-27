import { useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/app-shell";
import { api } from "./lib/api-client";
import { LoginPage } from "./pages/login-page";
import { ProcessListPage } from "./pages/process-list-page";
import { ProcessDetailPage } from "./pages/process-detail-page";
import { ProcessStartPage } from "./pages/process-start-page";
import { ProcessCapturePage } from "./pages/process-capture-page";
import { SettingsPage } from "./pages/settings-page";
import { OpportunityDiscoveryPage } from "./pages/opportunity-discovery-page";

export function App() {
  const [auth, setAuth] = useState<"loading" | "yes" | "no">("loading");
  useEffect(() => {
    api
      .session()
      .then((session) => setAuth(session.authenticated ? "yes" : "no"))
      .catch(() => setAuth("no"));
  }, []);
  if (auth === "loading")
    return <main className="app-loading">Anwendung wird geladen …</main>;
  if (auth === "no") return <LoginPage onLogin={() => setAuth("yes")} />;
  return (
    <AppShell
      onLogout={async () => {
        await api.logout();
        setAuth("no");
      }}
    >
      <Routes>
        <Route path="/" element={<ProcessListPage />} />
        <Route path="/processes/new" element={<ProcessStartPage />} />
        <Route path="/processes/:id" element={<ProcessDetailPage />} />
        <Route path="/processes/:id/capture" element={<ProcessCapturePage />} />
        <Route path="/processes/:id/opportunities">
          <Route index element={<Navigate to="hypotheses" replace />} />
          <Route
            path="hypotheses"
            element={<OpportunityDiscoveryPage phase="hypotheses" />}
          />
          <Route
            path="scenarios"
            element={<OpportunityDiscoveryPage phase="scenarios" />}
          />
        </Route>
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  );
}
