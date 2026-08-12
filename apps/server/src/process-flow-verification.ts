import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import {
  processFlowSchema,
  processDefinitionDraftSchema,
  processStepSchema,
  processUnderstandingSchema,
  validateProcessFlow,
  type FlowIssue,
} from "../../../packages/domain/src/process-understanding.ts";

const maxWorkingBytes = 2 * 1024 * 1024;

export type ProcessFlowVerification =
  { ok: true; revision: string } | { ok: false; errors: FlowIssue[] };

function pathOf(path: PropertyKey[]) {
  let value = "";
  for (const segment of path)
    value +=
      typeof segment === "number" ? `[${segment}]` : `.${String(segment)}`;
  return value.replace(/^\./, "");
}

function schemaIssues(input: unknown): FlowIssue[] {
  const parsed = processUnderstandingSchema.safeParse(input);
  if (parsed.success) return [];
  return parsed.error.issues.map((issue) => ({
    path: pathOf(issue.path),
    code: issue.code,
    message: issue.message,
  }));
}

/** Prüft die Arbeitsdatei für das interne Agent-Werkzeug ohne sie zu veröffentlichen. */
export async function verifyProcessFlowFile(
  file: string,
): Promise<ProcessFlowVerification> {
  let raw: string;
  try {
    raw = await readFile(file, "utf8");
  } catch {
    return {
      ok: false,
      errors: [
        {
          path: "",
          code: "missing_file",
          message: "The process understanding file is missing.",
        },
      ],
    };
  }
  if (Buffer.byteLength(raw) > maxWorkingBytes)
    return {
      ok: false,
      errors: [
        {
          path: "",
          code: "file_too_large",
          message: "The process understanding file exceeds the size limit.",
        },
      ],
    };
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return {
      ok: false,
      errors: [
        {
          path: "",
          code: "invalid_json",
          message: "The process understanding file is not valid JSON.",
        },
      ],
    };
  }

  let errors = schemaIssues(value);
  const candidate =
    value && typeof value === "object"
      ? (value as { flow?: unknown; steps?: unknown })
      : null;
  if (
    candidate &&
    processFlowSchema.safeParse(candidate.flow).success &&
    Array.isArray(candidate.steps) &&
    candidate.steps.every(
      (step: unknown) => processStepSchema.safeParse(step).success,
    )
  ) {
    const graphErrors = validateProcessFlow(
      processFlowSchema.parse(candidate.flow),
      candidate.steps.map((step) => processStepSchema.parse(step)),
    );
    // Die Domain-Schema-Refinement meldet dieselbe Regel als `custom`.
    // Für das Werkzeug bleibt der aussagekräftige Graph-Code erhalten.
    errors = errors.filter(
      (issue) =>
        !graphErrors.some(
          (graphIssue) =>
            graphIssue.path === issue.path &&
            graphIssue.message === issue.message,
        ),
    );
    errors.push(...graphErrors);
  }
  if (errors.length) return { ok: false, errors };

  // Der Hash bindet das grüne Ergebnis an genau den vom Agenten geprüften Stand.
  return { ok: true, revision: createHash("sha256").update(raw).digest("hex") };
}

/** Verifies the profile-3 aggregate before either of its projections is published. */
export async function verifyProcessDefinitionFile(
  file: string,
): Promise<ProcessFlowVerification> {
  let raw: string;
  try {
    raw = await readFile(file, "utf8");
  } catch {
    return {
      ok: false,
      errors: [
        {
          path: "",
          code: "missing_file",
          message: "The process definition file is missing.",
        },
      ],
    };
  }
  if (Buffer.byteLength(raw) > maxWorkingBytes)
    return {
      ok: false,
      errors: [
        {
          path: "",
          code: "file_too_large",
          message: "The process definition file exceeds the size limit.",
        },
      ],
    };
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return {
      ok: false,
      errors: [
        {
          path: "",
          code: "invalid_json",
          message: "The process definition file is not valid JSON.",
        },
      ],
    };
  }
  const parsed = processDefinitionDraftSchema.safeParse(value);
  if (!parsed.success)
    return {
      ok: false,
      errors: parsed.error.issues.map((issue) => ({
        path: pathOf(issue.path),
        code: issue.code,
        message: issue.message,
      })),
    };
  const graphErrors = validateProcessFlow(
    parsed.data.understanding.flow,
    parsed.data.understanding.steps,
  );
  if (graphErrors.length) return { ok: false, errors: graphErrors };
  return { ok: true, revision: createHash("sha256").update(raw).digest("hex") };
}
