import {
  ArrowLeft,
  ArrowRight,
  EllipsisVertical,
  LoaderCircle,
  Sparkles,
  Trash2,
  Workflow,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ProcessDeleteDialog } from "../components/process-delete-dialog";
import { Badge } from "../components/ui/badge";
import { api } from "../lib/api-client";
import type { OpportunityDiscoverySummary } from "../lib/opportunity-types";
import {
  opportunityEntryPhase,
  processNavigationModel,
  type ModuleNavigationState,
} from "../lib/process-navigation-model";
import type { ProcessCaptureRecord } from "../lib/process-types";
import { Button, IconButton, buttonClassName } from "../components/ui/button";
import { Kicker } from "../components/ui/kicker";
import { Card } from "../components/ui/card";

export function ProcessDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [process, setProcess] = useState<ProcessCaptureRecord | null>(null);
  const [opportunity, setOpportunity] = useState<OpportunityDiscoverySummary>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const menu = useRef<HTMLDivElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const menuItem = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let active = true;
    Promise.all([api.process(id), api.opportunitySummaries()])
      .then(([nextProcess, summaries]) => {
        if (!active) return;
        setProcess(nextProcess);
        setOpportunity(summaries.find((item) => item.processId === id));
      })
      .catch((reason: Error) => active && setError(reason.message));
    return () => {
      active = false;
    };
  }, [id]);

  useEffect(() => {
    if (!menuOpen) return;
    menuItem.current?.focus();
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!menu.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setMenuOpen(false);
      menuButton.current?.focus();
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [menuOpen]);

  if (error && !process)
    return (
      <p className="notice error" role="alert">
        {error}
      </p>
    );
  if (!process)
    return <main className="app-loading">Prozess wird geladen …</main>;

  const navigation = processNavigationModel(process, opportunity);
  return (
    <section className="process-detail-page">
      <Link className="back-link" to="/">
        <ArrowLeft /> Zur Prozessübersicht
      </Link>
      <div className="page-title process-detail-heading">
        <div>
          <Kicker>Prozess</Kicker>
          <h1>{process.cover.processName}</h1>
          <p>
            {process.cover.department} · {process.id} · aktualisiert{" "}
            {new Date(process.updatedAt).toLocaleString("de-DE", {
              dateStyle: "short",
              timeStyle: "short",
            })}
          </p>
        </div>
        <div className="title-actions process-detail-actions">
          <div className="process-context-menu" ref={menu}>
            <IconButton
              ref={menuButton}
              label="Weitere Aktionen"
              className="process-context-trigger"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((value) => !value)}
            >
              <EllipsisVertical />
            </IconButton>
            {menuOpen && (
              <div className="process-context-popover" role="menu">
                <button
                  ref={menuItem}
                  type="button"
                  role="menuitem"
                  className="process-context-danger"
                  onClick={() => {
                    setMenuOpen(false);
                    setDeleteError("");
                    setDeleteOpen(true);
                  }}
                >
                  <Trash2 /> Prozess löschen
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      <div className="process-module-grid">
        <ProcessModuleCard
          title="Prozessaufnahme"
          description="Erfasste Angaben, Rückfragen und das bestätigte Prozessbild."
          icon={<Workflow />}
          state={navigation.capture}
          action={
            <Link
              className={buttonClassName("secondary")}
              to={`/processes/${id}/capture`}
            >
              {navigation.capture.actionLabel} <ArrowRight />
            </Link>
          }
        />
        <ProcessModuleCard
          title="KI-Potenziale"
          description="Potenzialhypothesen und drei Szenarien für den Einsatz von KI."
          icon={<Sparkles />}
          state={navigation.opportunity}
          action={opportunityAction(navigation.opportunity)}
        />
      </div>
      <ProcessDeleteDialog
        open={deleteOpen}
        processName={process.cover.processName}
        busy={deleting}
        error={deleteError}
        onClose={() => {
          if (!deleting) setDeleteOpen(false);
        }}
        onConfirm={() => void deleteProcess()}
      />
    </section>
  );

  async function deleteProcess() {
    setDeleting(true);
    setDeleteError("");
    try {
      await api.deleteProcess(id);
      navigate("/");
    } catch (reason) {
      const message = (reason as Error).message;
      setDeleteError(
        message === "Failed to fetch"
          ? "Die Prozessaufnahme konnte nicht gelöscht werden. Bitte versuchen Sie es erneut."
          : message,
      );
      setDeleting(false);
    }
  }

  function opportunityAction(state: ModuleNavigationState) {
    if (state.action === "start_opportunity")
      return (
        <Button
          variant="primary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              await api.startOpportunity(id);
              navigate(`/processes/${id}/opportunities/hypotheses`);
            } catch (reason) {
              setError((reason as Error).message);
              setBusy(false);
            }
          }}
        >
          {busy ? (
            <>
              <LoaderCircle className="spin" /> Startet …
            </>
          ) : (
            <>
              {state.actionLabel} <ArrowRight />
            </>
          )}
        </Button>
      );
    if (state.action === "view_opportunity")
      return (
        <Link
          className={buttonClassName("secondary")}
          to={`/processes/${id}/opportunities/${opportunityEntryPhase(opportunity)}`}
        >
          {state.actionLabel} <ArrowRight />
        </Link>
      );
    return null;
  }
}

function ProcessModuleCard({
  title,
  description,
  icon,
  state,
  action,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  state: ModuleNavigationState;
  action: React.ReactNode;
}) {
  return (
    <Card as="article" className="process-module-card">
      <div className="process-module-icon">{icon}</div>
      <div className="process-module-content">
        <div className="process-module-title">
          <h2>{title}</h2>
          <Badge tone={state.tone}>{state.status}</Badge>
        </div>
        <p>{description}</p>
        <div className="process-module-action">
          {action ?? <span>Aktuell keine Aktion erforderlich</span>}
        </div>
      </div>
    </Card>
  );
}
