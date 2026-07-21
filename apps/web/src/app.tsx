import { useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/app-shell";
import { api } from "./lib/api-client";
import { AssessmentStartPage } from "./pages/assessment-start-page";
import { ChatAssessmentPage } from "./pages/chat-assessment-page";
import { ComparisonPage } from "./pages/comparison-page";
import { FormAssessmentPage } from "./pages/form-assessment-page";
import { GatewayPage } from "./pages/gateway-page";
import { LoginPage } from "./pages/login-page";
import { RankingPage } from "./pages/ranking-page";
import { SettingsPage } from "./pages/settings-page";

export function App() {
  const [auth, setAuth] = useState<"loading" | "yes" | "no">("loading");
  useEffect(() => {
    api
      .session()
      .then((s) => setAuth(s.authenticated ? "yes" : "no"))
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
        <Route path="/" element={<RankingPage />} />
        <Route path="/assessments/new" element={<AssessmentStartPage />} />
        <Route path="/assessments/:id/gateway" element={<GatewayPage />} />
        <Route path="/assessments/:id/form" element={<FormAssessmentPage />} />
        <Route path="/assessments/:id/chat" element={<ChatAssessmentPage />} />
        <Route
          path="/comparisons/:comparisonGroupId"
          element={<ComparisonPage />}
        />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/processes/*" element={<Navigate to="/" replace />} />
        <Route
          path="/neu"
          element={<Navigate to="/assessments/new" replace />}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  );
}
