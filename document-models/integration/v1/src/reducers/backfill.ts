import type { IntegrationBackfillOperations } from "document-models/integration/v1";
import {
  DuplicateBackfillIdError,
  InvalidRangeError,
  NotInitializedError,
  UnknownBackfillError,
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
      request: {
        from: i.from,
        to: i.to,
        stepSeconds: i.stepSeconds,
        direction: i.direction ?? null,
      },
    });
    state.intent.generation += 1;
  },
  removeBackfillOperation(state, action) {
    const items = state.intent.backfill.items;
    const index = items.findIndex((b) => b.id === action.input.id);
    if (index < 0)
      throw new UnknownBackfillError(`No backfill ${action.input.id}`);
    items.splice(index, 1);
    if (state.intent.backfill.pinnedId === action.input.id)
      state.intent.backfill.pinnedId = null;
    state.intent.generation += 1;
  },
};
