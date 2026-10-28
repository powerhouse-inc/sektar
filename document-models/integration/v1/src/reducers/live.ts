import type { IntegrationLiveOperations } from "document-models/integration/v1";
import {
  InvalidIntervalError,
  NotInitializedError,
} from "../../gen/live/error.js";

export const integrationLiveOperations: IntegrationLiveOperations = {
  setLiveEnabledOperation(state, action) {
    if (!state.kind)
      throw new NotInitializedError("Set up the integration first");
    state.intent.live.enabled = action.input.enabled;
    state.intent.generation += 1;
  },
  setLiveIntervalOperation(state, action) {
    if (!state.kind)
      throw new NotInitializedError("Set up the integration first");
    if (!Number.isInteger(action.input.value) || action.input.value < 1)
      throw new InvalidIntervalError(
        `${action.input.value} is not a whole number of at least 1`,
      );
    state.intent.live.every = {
      value: action.input.value,
      unit: action.input.unit,
    };
    state.intent.generation += 1;
  },
};
