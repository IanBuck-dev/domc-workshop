import { useEffect, useState } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AppBootScreen } from "./components/app-boot-screen";
import { AppShell } from "./components/app-shell";
import { api } from "./lib/api-client";
import { LoginPage } from "./pages/login-page";
import { ProcessListPage } from "./pages/process-list-page";
import { ProcessDetailPage } from "./pages/process-detail-page";
import { ProcessStartPage } from "./pages/process-start-page";
import { ProcessCapturePage } from "./pages/process-capture-page";
import { ProcessChatPage } from "./pages/process-chat-page";
import { SettingsPage } from "./pages/settings-page";
import { DocumentationPage } from "./pages/documentation-page";
import { OpportunityDiscoveryPage } from "./pages/opportunity-discovery-page";
import { ProcessEventsProvider } from "./lib/process-events";
import { ImprintPage } from "./pages/imprint-page";
import { PrivacyPage } from "./pages/privacy-page";
import { UsageNoticePage } from "./pages/usage-notice-page";

const publicPaths = new Set([
  "/impressum",
  "/datenschutz",
  "/nutzungshinweise",
]);

function PublicRoutes() {
  return (
    <Routes>
      <Route path="/impressum" element={<ImprintPage />} />
      <Route path="/datenschutz" element={<PrivacyPage />} />
      <Route path="/nutzungshinweise" element={<UsageNoticePage />} />
    </Routes>
  );
}

export function App() {
  const location = useLocation();
  const [auth, setAuth] = useState<"loading" | "yes" | "no">("loading");
  useEffect(() => {
    api
      .session()
      .then((session) => setAuth(session.authenticated ? "yes" : "no"))
      .catch(() => setAuth("no"));
  }, []);
  if (publicPaths.has(location.pathname)) return <PublicRoutes />;
  if (auth === "loading") return <AppBootScreen />;
  if (auth === "no") return <LoginPage onLogin={() => setAuth("yes")} />;
  return (
    <ProcessEventsProvider>
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
          <Route
            path="/processes/:id/capture"
            element={<ProcessCapturePage />}
          />
          <Route path="/processes/:id/chat" element={<ProcessChatPage />} />
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
          <Route path="/dokumentation" element={<DocumentationPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppShell>
    </ProcessEventsProvider>
  );
}
