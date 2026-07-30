import { ListTree, LogOut, PlusCircle, Settings } from "lucide-react";
import { NavLink } from "react-router-dom";
import { BrandLockup } from "./ui/brand-mark";
import { Button } from "./ui/button";
import { cn } from "../lib/utils";
import { DemoDataWarning } from "./demo-data-warning";
import { AiOperationQueue } from "./ai-operation-queue";
const nav = [
  ["/", "Prozesse", ListTree],
  ["/processes/new", "Prozess erfassen", PlusCircle],
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
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex min-h-16 w-full max-w-7xl items-center justify-between gap-6 px-4 sm:px-6 lg:px-8">
          <NavLink
            className="flex items-center gap-3 font-semibold text-foreground"
            to="/"
          >
            <BrandLockup />
          </NavLink>
          <nav aria-label="Hauptnavigation" className="flex items-center gap-1">
            {nav.map(([to, label, Icon]) => (
              <NavLink
                key={to}
                to={to}
                end={to === "/"}
                className={({ isActive }) =>
                  cn(
                    "inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm font-semibold text-muted-foreground transition-colors hover:bg-secondary hover:text-secondary-foreground",
                    isActive && "bg-secondary text-secondary-foreground",
                  )
                }
              >
                <Icon className="size-4" aria-hidden="true" />
                <span className="hidden md:inline">{label}</span>
              </NavLink>
            ))}
            <Button
              variant="ghost"
              size="sm"
              onClick={onLogout}
              className="gap-2 text-muted-foreground"
            >
              <LogOut className="size-4" aria-hidden="true" />
              <span className="hidden md:inline">Abmelden</span>
            </Button>
          </nav>
        </div>
      </header>
      <DemoDataWarning />
      <AiOperationQueue />
      <main>{children}</main>
    </div>
  );
}
