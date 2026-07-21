import { BarChart3, LogOut, PlusCircle, Settings } from "lucide-react";
import { NavLink } from "react-router-dom";
import domcuraLogo from "../assets/domcura-logo-colored.svg";
import { DemoDataWarning } from "./demo-data-warning";
import { AiOperationQueue } from "./ai-operation-queue";
const nav = [
  ["/", "Rangliste", BarChart3],
  ["/assessments/new", "Prozess einreichen", PlusCircle],
  ["/settings", "Einstellungen", Settings],
] as const;
export function AppShell({
  children,
  onLogout,
}: {
  children: React.ReactNode;
  onLogout: () => void;
}) {
  return (
    <div className="app">
      <header>
        <NavLink className="brand" to="/">
          <img src={domcuraLogo} alt="DOMCURA" />
          <small>KI-Potenziale</small>
        </NavLink>
        <nav aria-label="Hauptnavigation">
          {nav.map(([to, label, Icon]) => (
            <NavLink key={to} to={to} end={to === "/"}>
              <Icon />
              {label}
            </NavLink>
          ))}
          <button className="logout-button" onClick={onLogout}>
            <LogOut />
            Abmelden
          </button>
        </nav>
      </header>
      <DemoDataWarning />
      <AiOperationQueue />
      <main>{children}</main>
      <footer>
        Workshop-Prototyp · KI-Vorschläge sind unverbindlich · Fachliche
        Bestätigung erforderlich
      </footer>
    </div>
  );
}
