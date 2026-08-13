import { Fragment, useMemo, useState } from "react";
import type { KeyboardEvent, ReactNode } from "react";
import type {
  AgenticPotentialAssessmentDetail,
  CriterionAssessment,
} from "../lib/agentic-potential-assessment-types";
import { Badge } from "./ui/badge";
import { Card } from "./ui/card";

const filters = [
  { key: "all", label: "Alle" },
  { key: "scored", label: "Bewertet" },
  { key: "insufficient_evidence", label: "Nicht ausreichend belegt" },
  { key: "policy_excluded", label: "Ausgeschlossen" },
] as const;
type FilterKey = (typeof filters)[number]["key"];

const confidenceLabels = { high: "hoch", medium: "mittel", low: "niedrig" };

export function AgenticPotentialAssessmentTable({
  detail,
}: {
  detail: AgenticPotentialAssessmentDetail;
}) {
  const [filter, setFilter] = useState<FilterKey>("all");
  const [openCriterionIds, setOpenCriterionIds] = useState<Set<string>>(
    () => new Set(),
  );
  const criteria = useMemo(
    () => detail.record.result?.criteria ?? [],
    [detail.record.result?.criteria],
  );
  const definitions = useMemo(
    () =>
      new Map(
        detail.record.sourceSnapshot.criteria.map((item) => [item.id, item]),
      ),
    [detail.record.sourceSnapshot.criteria],
  );
  const counts = useMemo(
    () => ({
      all: criteria.length,
      scored: criteria.filter((item) => item.status === "scored").length,
      insufficient_evidence: criteria.filter(
        (item) => item.status === "insufficient_evidence",
      ).length,
      policy_excluded: criteria.filter(
        (item) => item.status === "policy_excluded",
      ).length,
    }),
    [criteria],
  );
  const rows = useMemo(() => {
    if (filter === "all") return criteria;
    return criteria.filter((item) => item.status === filter);
  }, [criteria, filter]);
  const groups = useMemo(() => {
    const grouped = new Map<string, typeof rows>();
    for (const item of rows) {
      // Fehlt eine Kriteriendefinition im eingefrorenen Stand, darf die Seite
      // nicht abstürzen — die Zeile wird dann ohne Kategorie einsortiert.
      const category =
        definitions.get(item.criterionId)?.category ?? "Weitere Kriterien";
      grouped.set(category, [...(grouped.get(category) ?? []), item]);
    }
    return [...grouped.entries()];
  }, [definitions, rows]);

  const toggleCriterion = (criterionId: string) => {
    setOpenCriterionIds((current) => {
      const next = new Set(current);
      if (next.has(criterionId)) next.delete(criterionId);
      else next.add(criterionId);
      return next;
    });
  };

  const onCriterionKeyDown = (
    event: KeyboardEvent<HTMLTableRowElement>,
    criterionId: string,
  ) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    toggleCriterion(criterionId);
  };

  return (
    <section aria-labelledby="assessment-criteria" className="space-y-4">
      <h2 id="assessment-criteria" className="text-title">
        Kriterien im Detail
      </h2>
      <div
        className="flex flex-wrap gap-2"
        role="group"
        aria-label="Kriterien nach Ergebnis filtern"
      >
        {filters.map((item) => (
          <button
            key={item.key}
            type="button"
            aria-pressed={filter === item.key}
            onClick={() => setFilter(item.key)}
            className={`rounded-md border px-3 py-2 text-label transition-colors outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 ${
              filter === item.key
                ? "border-primary bg-primary text-primary-foreground"
                : "bg-card hover:bg-accent hover:text-accent-foreground"
            }`}
          >
            {item.label} ({counts[item.key]})
          </button>
        ))}
      </div>
      {groups.length === 0 ? (
        <Card className="items-start gap-2 p-6">
          <h3 className="text-heading">Keine Kriterien in dieser Auswahl</h3>
          <p className="text-muted-foreground">
            Für diesen Filter liegt kein Ergebnis vor. Wählen Sie „Alle“, um den
            vollständigen Kriterienkatalog zu sehen.
          </p>
        </Card>
      ) : (
        <div className="overflow-hidden rounded-lg border bg-card">
          <table className="w-full table-fixed border-collapse text-left text-ui">
            <colgroup>
              <col className="w-11" />
              <col />
              <col className="w-40 sm:w-48" />
              <col className="w-9" />
            </colgroup>
            <thead className="border-b bg-muted/70 text-label text-muted-foreground">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium">
                  #
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  Kriterium
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  Wert
                </th>
                <th scope="col" className="px-2 py-2">
                  <span className="sr-only">Details</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {groups.map(([category, items]) => (
                <Fragment key={category}>
                  <tr className="border-y bg-muted/40 text-label text-muted-foreground">
                    <th
                      scope="rowgroup"
                      colSpan={4}
                      className="px-3 py-1.5 font-medium"
                    >
                      {category}
                    </th>
                  </tr>
                  {items.map((item) => {
                    const definition = definitions.get(item.criterionId);
                    const detailId = `criterion-detail-${item.criterionId}`;
                    const isOpen = openCriterionIds.has(item.criterionId);
                    return (
                      <Fragment key={item.criterionId}>
                        <tr
                          role="button"
                          tabIndex={0}
                          aria-expanded={isOpen}
                          aria-controls={detailId}
                          onClick={() => toggleCriterion(item.criterionId)}
                          onKeyDown={(event) =>
                            onCriterionKeyDown(event, item.criterionId)
                          }
                          className="cursor-pointer border-b transition-colors hover:bg-accent/60 focus-visible:relative focus-visible:z-10 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                        >
                          <td className="px-3 py-2 align-middle text-muted-foreground">
                            {definition?.order ?? "–"}
                          </td>
                          <th
                            scope="row"
                            className="min-w-0 truncate px-3 py-2 font-medium"
                            title={definition?.name ?? item.criterionId}
                          >
                            {definition?.name ?? item.criterionId}
                          </th>
                          <td className="px-3 py-2 align-middle">
                            <AssessmentValue
                              status={item.status}
                              score={item.score}
                            />
                          </td>
                          <td className="px-2 py-2 text-center text-muted-foreground">
                            <span aria-hidden="true">{isOpen ? "⌃" : "⌄"}</span>
                            <span className="sr-only">
                              {isOpen
                                ? "Details zuklappen"
                                : "Details aufklappen"}
                            </span>
                          </td>
                        </tr>
                        {isOpen && (
                          <tr id={detailId} className="border-b bg-muted/20">
                            <td colSpan={4} className="p-3 sm:p-4">
                              <CriterionDetail
                                definition={definition}
                                item={item}
                              />
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Card className="gap-1.5 border-amber-700/30 bg-amber-50 p-4 text-amber-950">
        <h3 className="text-heading">Was diese Bewertung nicht enthält</h3>
        <p className="text-ui">
          Gewichtungen, Finanzwerte und ein Gesamtscore werden bewusst nicht
          berechnet. Die Bewertungsgrundlage dafür ist unvollständig; ein
          errechneter Gesamtwert wäre nicht belastbar.
        </p>
      </Card>
    </section>
  );
}

function AssessmentValue({
  status,
  score,
}: {
  status: CriterionAssessment["status"];
  score: 0 | 1 | 2 | null;
}) {
  if (status === "scored") return <Badge tone="success">{score} von 2</Badge>;
  if (status === "policy_excluded")
    return <Badge tone="neutral">Ausgeschlossen</Badge>;
  return <Badge tone="warning">Nicht ausreichend belegt</Badge>;
}

function CriterionDetail({
  definition,
  item,
}: {
  definition:
    | AgenticPotentialAssessmentDetail["record"]["sourceSnapshot"]["criteria"][number]
    | undefined;
  item: CriterionAssessment;
}) {
  return (
    <dl className="grid gap-x-6 gap-y-3 text-ui sm:grid-cols-2">
      <DetailItem label="Skala" className="sm:col-span-2">
        {definition?.scale ?? "Keine Skala im eingefrorenen Kriterienkatalog."}
      </DetailItem>
      <DetailItem label="Konfidenz">
        {item.confidenceLevel
          ? confidenceLabels[item.confidenceLevel]
          : "Nicht bewertet"}
      </DetailItem>
      <DetailItem label="Begründung" className="sm:col-span-2">
        {item.rationale}
      </DetailItem>
      <DetailItem label="Belege aus dem Prozessbild">
        <IdentifierList
          ids={item.evidenceIds}
          emptyLabel="Keine Belege hinterlegt"
        />
      </DetailItem>
      <DetailItem label="Zugrunde liegende Potenziale">
        <IdentifierList
          ids={item.hypothesisIds}
          emptyLabel="Keine Potenziale hinterlegt"
        />
      </DetailItem>
      <DetailItem
        label="Offene Punkte für den Fachbereich"
        className="sm:col-span-2"
      >
        {item.assumptions.length > 0 || item.openQuestions.length > 0 ? (
          <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
            {[...item.assumptions, ...item.openQuestions].map((entry) => (
              <li key={entry} className="break-words">
                {entry}
              </li>
            ))}
          </ul>
        ) : (
          <span className="text-muted-foreground">Keine offenen Punkte</span>
        )}
      </DetailItem>
    </dl>
  );
}

function DetailItem({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={className}>
      <dt className="font-medium">{label}</dt>
      <dd className="mt-1 break-words text-muted-foreground">{children}</dd>
    </div>
  );
}

function IdentifierList({
  ids,
  emptyLabel,
}: {
  ids: string[];
  emptyLabel: string;
}) {
  if (ids.length === 0) return <span>{emptyLabel}</span>;
  return (
    <ul className="flex flex-wrap gap-1.5">
      {ids.map((entry) => (
        <li
          key={entry}
          className="rounded-md border bg-card px-2 py-0.5 break-all"
        >
          {entry}
        </li>
      ))}
    </ul>
  );
}
