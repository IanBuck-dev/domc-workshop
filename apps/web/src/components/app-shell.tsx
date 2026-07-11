import { NavLink } from "react-router-dom";
import {
  Lightbulb,
  LayoutList,
  ChartScatter,
  Send,
  Settings,
} from "lucide-react";
import { DemoDataWarning } from "./demo-data-warning";
import { FirstRun } from "./first-run";
import domcuraLogo from "../assets/domcura-logo-colored.svg";
const nav = [
  ["/neu", "Idee erfassen", Lightbulb],
  ["/", "Portfolio", LayoutList],
  ["/matrix", "Impact / Aufwand", ChartScatter],
  ["/handover", "IT-Übergabe", Send],
  ["/settings", "Einstellungen", Settings],
] as const;
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="app">
      <FirstRun />
      <header>
        <NavLink className="brand" to="/">
          <img src={domcuraLogo} alt="DOMCURA" />
          <small>Claims-Ideenportfolio</small>
        </NavLink>
        <nav aria-label="Hauptnavigation">
          {nav.map(([to, label, Icon]) => (
            <NavLink key={to} to={to} end={to === "/"}>
              <Icon />
              {label}
            </NavLink>
          ))}
        </nav>
      </header>
      <DemoDataWarning />
      <main>{children}</main>
      <footer>
        Lokaler Workshop-Prototyp · KI-Empfehlungen sind unverbindlich ·
        Menschliche Entscheidung erforderlich
      </footer>
    </div>
  );
}
