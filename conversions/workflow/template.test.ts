import {
  actions,
  reducer,
  utils,
  type WorkflowDocument,
} from "@powerhousedao/workflow/document-models/workflow";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { pieces } from "../../pieces/index.js";
import { doctureConversionOutputSchema } from "../../pieces/docture/lib/contracts.js";
import { convertManagedPdfAction } from "../../pieces/sektar-pdf/lib/convert-pdf.js";
import { publishRenditionAction } from "../../pieces/sektar-pdf/lib/publish-rendition.js";
import { readyPdfSchema } from "../../pieces/sektar-pdf/lib/contracts.js";
import { resolvePdfAction } from "../../pieces/sektar-pdf/lib/resolve-pdf.js";
import {
  buildConversionWorkflow,
  conversionWorkflowDrift,
  conversionWorkflowSpec,
  DOCTURE_PIECE,
  readConversionWorkflowFacts,
  RUNTIME_PIECE_VERSION,
  SEKTAR_PDF_ACTIONS,
  SEKTAR_PIECE_VERSION,
  STEP_KEYS,
  type WorkflowAction,
} from "./template.js";

const NOW = "2026-11-11T12:00:00.000Z";

function ids() {
  let n = 0;
  return () => `id-${++n}`;
}

function apply(
  document: WorkflowDocument,
  actions: readonly WorkflowAction[],
): WorkflowDocument {
  let next = document;
  for (const action of actions) {
    next = reducer(next, action);
    const last = next.operations.global.at(-1);
    if (last?.error) throw new Error(`${action.type}: ${last.error}`);
  }
  return next;
}

function published(
  activation: "off" | "manual" | "automatic" = "automatic",
  connection = "rc-1",
) {
  const spec = conversionWorkflowSpec({
    workflowsDriveId: "workflows",
    activation,
    reactorConnectionId: connection,
  });
  const document = apply(
    utils.createDocument(),
    buildConversionWorkflow(spec, ids(), NOW),
  );
  return { spec, document };
}

describe("the conversion workflow, as the real workflow model publishes it", () => {
  it("uses a native manual trigger in On demand mode", () => {
    expect(
      published("manual").document.state.global.published?.trigger,
    ).toMatchObject({
      pieceName: "@powerhousedao/piece-core",
      triggerName: "manual",
    });
  });

  it("fires on a stored Files PDF in Automatic mode and converts only a ready PDF without saved Markdown", () => {
    const state = published().document.state.global;
    expect(state.status).toBe("ENABLED");
    const snapshot = state.published;
    expect(snapshot?.trigger).toMatchObject({
      pieceName: "@powerhousedao/piece-reactor",
      triggerName: "document-event",
      config: {
        documentType: ["sektar/file", "sektar/email"],
        actionType: [
          "SET_ATTACHMENT_SOURCE",
          "APPLY_DISK_VERSION",
          "ADD_ATTACHMENT",
        ],
      },
    });
    const key = new Map(
      (snapshot?.steps ?? []).map((step) => [step.id, step.key]),
    );
    key.set(snapshot?.trigger?.id ?? "", "trigger");
    expect(
      (snapshot?.edges ?? []).map(
        (edge) => `${key.get(edge.from)} -${edge.port}-> ${key.get(edge.to)}`,
      ),
    ).toEqual([
      "trigger -next-> resolve",
      "resolve -next-> is_ready",
      "is_ready -true-> has_saved_markdown",
      "has_saved_markdown -false-> convert",
      "convert -next-> publish",
    ]);
  });

  it("configures each step with props its action accepts and fields earlier steps output", () => {
    const { spec } = published();
    const accepted = new Map<string, readonly string[]>([
      [STEP_KEYS.resolve, Object.keys(resolvePdfAction.props)],
      [STEP_KEYS.convert, Object.keys(convertManagedPdfAction.props)],
      [STEP_KEYS.publish, Object.keys(publishRenditionAction.props)],
    ]);
    const outputs = new Map<string, z.ZodType>([
      [STEP_KEYS.resolve, readyPdfSchema],
      [STEP_KEYS.convert, doctureConversionOutputSchema],
    ]);
    const outputHas = (schema: z.ZodType, path: readonly string[]) => {
      let at: z.ZodType = schema;
      for (const part of path) {
        if (at instanceof z.ZodArray && /^\d+$/.test(part)) {
          at = at.element as z.ZodType;
          continue;
        }
        if (!(at instanceof z.ZodObject) || !(part in at.shape)) return false;
        at = at.shape[part] as z.ZodType;
      }
      return true;
    };
    for (const step of spec.steps) {
      const props = accepted.get(step.key);
      if (props)
        for (const prop of Object.keys(step.config))
          expect(props).toContain(prop);
      for (const [reference, from, path] of JSON.stringify(
        step.config,
      ).matchAll(/\{\{steps\.(\w+)\.output\.?([\w.]*)\}\}/g)) {
        const schema = outputs.get(from);
        expect(schema, reference).toBeDefined();
        if (schema && path)
          expect(outputHas(schema, path.split(".")), reference).toBe(true);
      }
    }
  });

  it("checks current policy inside the extraction step, including on retries", () => {
    const convert = published().spec.steps.find(
      (step) => step.key === STEP_KEYS.convert,
    );
    expect(convert?.actionName).toBe(convertManagedPdfAction.name);
    expect(convert?.reactorConnectionId).toBeTruthy();
    expect(convert?.config["prepared"]).toBe("{{steps.resolve.output}}");
  });

  it("is a no-op to ensure again, and only switches status when conversion is turned off", () => {
    const { spec, document } = published();
    const facts = readConversionWorkflowFacts(document.state.global);
    expect(conversionWorkflowDrift(spec, facts, ids(), NOW).actions).toEqual(
      [],
    );

    const off = conversionWorkflowSpec({
      workflowsDriveId: "workflows",
      activation: "off",
      reactorConnectionId: "rc-1",
    });
    const drift = conversionWorkflowDrift(off, facts, ids(), NOW);
    expect(drift.republish).toBe(false);
    expect(drift.actions.map((action) => action.type)).toEqual([
      "SET_WORKFLOW_STATUS",
    ]);
    expect(apply(document, drift.actions).state.global.status).toBe("DISABLED");
  });

  it("replaces a changed definition in place and republishes; an unchanged one republishes only when asked", () => {
    const { document } = published("automatic", "rc-old");
    const spec = conversionWorkflowSpec({
      workflowsDriveId: "workflows",
      activation: "automatic",
      reactorConnectionId: "rc-new",
    });
    const drift = conversionWorkflowDrift(
      spec,
      readConversionWorkflowFacts(document.state.global),
      ids(),
      NOW,
    );
    expect(drift.republish).toBe(true);
    const rebuilt = apply(document, drift.actions);
    const facts = readConversionWorkflowFacts(rebuilt.state.global);
    expect(
      facts.published?.steps.map((step) => step.reactorConnectionId),
    ).toEqual(["rc-new", null, null, "rc-new", "rc-new"]);
    expect(rebuilt.state.global.steps).toHaveLength(5);
    expect(conversionWorkflowDrift(spec, facts, ids(), NOW).actions).toEqual(
      [],
    );
    expect(
      conversionWorkflowDrift(spec, facts, ids(), NOW, true).actions.map(
        (action) => action.type,
      ),
    ).toEqual(["PUBLISH_WORKFLOW"]);
  });

  it("pins the pieces to what this package and the installed runtime ship", () => {
    const root = join(import.meta.dirname, "../..");
    const packageVersion = (
      JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
        version: string;
      }
    ).version;
    expect(SEKTAR_PIECE_VERSION).toBe(packageVersion);
    expect(pieces.map((piece) => piece.name)).toContain(DOCTURE_PIECE);
    const descriptor = join(
      dirname(
        createRequire(import.meta.url).resolve(
          "@powerhousedao/workflow/package.json",
        ),
      ),
      "dist/node/pieces/reactor/descriptor.json",
    );
    expect(
      (JSON.parse(readFileSync(descriptor, "utf8")) as { version: string })
        .version,
    ).toBe(RUNTIME_PIECE_VERSION);
    expect(SEKTAR_PDF_ACTIONS).toEqual({
      resolve: resolvePdfAction.name,
      convert: convertManagedPdfAction.name,
      publish: publishRenditionAction.name,
    });
  });
});

it("rebuilds an altered unpublished draft before signing it", () => {
  const { spec, document } = published();
  const convert = document.state.global.steps.find(
    (step) => step.key === STEP_KEYS.convert,
  );
  if (!convert) throw new Error("Expected conversion step");
  const altered = apply(document, [actions.removeStep({ id: convert.id })]);
  const changes = conversionWorkflowDrift(
    spec,
    readConversionWorkflowFacts(altered.state.global),
    ids(),
    NOW,
  );
  const repaired = apply(altered, changes.actions);
  expect(
    repaired.state.global.published?.steps.map((step) => step.key),
  ).toEqual(spec.steps.map((step) => step.key));
  expect(
    conversionWorkflowDrift(
      spec,
      readConversionWorkflowFacts(repaired.state.global),
      ids(),
      NOW,
    ).actions,
  ).toEqual([]);
});
