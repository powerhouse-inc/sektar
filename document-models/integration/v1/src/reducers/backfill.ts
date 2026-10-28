import type { IntegrationBackfillOperations } from "document-models/integration/v1";
import {
  DuplicateBackfillIdError,
  InvalidRangeError,
  NotInitializedError,
} from "../../gen/backfill/error.js";

export const integrationBackfillOperations: IntegrationBackfillOperations = {
  setBackfillEnabledOperation(state, action) {
    if (!state.kind)
      throw new NotInitializedError("Set up the integration first");
    state.intent.backfill.enabled = action.input.enabled;
    state.intent.generation += 1;
  },
  addDateRangeBackfillOperation(state, action) {
    if (!state.kind)
      throw new NotInitializedError("Set up the integration first");
    const i = action.input;
    if (state.intent.backfill.items.some((b) => b.id === i.id))
      throw new DuplicateBackfillIdError(`A backfill ${i.id} exists`);
    if (
      !(Date.parse(i.from) < Date.parse(i.to)) ||
      !Number.isInteger(i.stepSeconds) ||
      i.stepSeconds < 60
    )
      throw new InvalidRangeError(
        `${i.from} to ${i.to} in ${i.stepSeconds} s slices`,
      );
    state.intent.backfill.items.push({
      id: i.id,
      label: i.label,
      documentType: i.documentType,
      documentId: null,
      request: { from: i.from, to: i.to, stepSeconds: i.stepSeconds },
    });
    state.intent.generation += 1;
  },
};
