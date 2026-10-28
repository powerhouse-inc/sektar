import type { IntegrationReconcilerOperations } from "document-models/integration/v1";
import { RunnerTakenError } from "../../gen/reconciler/error.js";

export const integrationReconcilerOperations: IntegrationReconcilerOperations =
  {
    requestCheckOperation(state, action) {
      state.checkRequest = {
        id: action.input.id,
        requestedAt: action.input.requestedAt,
        requestedBy: action.input.requestedBy ?? null,
      };
    },
    recordRunnerOperation(state, action) {
      if (state.runner && state.runner.reactorId !== action.input.reactorId)
        throw new RunnerTakenError(
          `${state.runner.reactorId} runs this integration`,
        );
      state.runner = {
        reactorId: action.input.reactorId,
        label: action.input.label ?? null,
      };
    },
    recordResourcesOperation(state, action) {
      const i = action.input;
      const r = state.resources;
      if (i.connectionId) r.connectionId = i.connectionId;
      if (i.liveWorkflowId) r.liveWorkflowId = i.liveWorkflowId;
      if (i.backfillWorkflowId) r.backfillWorkflowId = i.backfillWorkflowId;
      if (i.pluggedItemId) r.pluggedItemId = i.pluggedItemId;
    },
    recordCheckOperation(state, action) {
      const i = action.input;
      state.check = {
        at: i.at,
        host: i.host ?? null,
        generation: i.generation,
        request: i.request ?? null,
        issues: i.issues.map((x) => ({
          code: x.code,
          severity: x.severity,
          subject: x.subject ?? null,
          message: x.message,
          fixable: x.fixable,
          since: x.since,
        })),
      };
      if (i.request && state.checkRequest?.id === i.request)
        state.checkRequest = null;
      state.fixes = [
        ...i.fixes.map((f) => ({
          at: f.at,
          code: f.code,
          subject: f.subject ?? null,
          message: f.message,
        })),
        ...state.fixes,
      ].slice(0, 20);
      // A commit for an older generation is ignored: the user changed something meanwhile.
      if (i.committed && i.generation === state.intent.generation) {
        state.applied = {
          generation: i.generation,
          at: i.at,
          host: i.host ?? null,
        };
      }
    },
  };
