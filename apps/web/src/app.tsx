import { Routes, Route } from "react-router-dom";
import { AppShell } from "./components/app-shell";
import { PortfolioPage } from "./pages/portfolio-page";
import { IntakePage } from "./pages/intake-page";
import { IdeaDetailPage } from "./pages/idea-detail-page";
import { MatrixPage } from "./pages/matrix-page";
import { HandoverPage } from "./pages/handover-page";
import { SettingsPage } from "./pages/settings-page";
import { ShowcasePage } from "./pages/showcase-page";
export function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<PortfolioPage />} />
        <Route path="/neu" element={<IntakePage />} />
        <Route path="/ideas/:id" element={<IdeaDetailPage />} />
        <Route path="/matrix" element={<MatrixPage />} />
        <Route path="/handover" element={<HandoverPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/settings/entstehung" element={<ShowcasePage />} />
      </Routes>
    </AppShell>
  );
}
