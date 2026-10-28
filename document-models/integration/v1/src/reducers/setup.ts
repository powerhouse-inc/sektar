import type { IntegrationSetupOperations } from "document-models/integration/v1";
import {
  AlreadyInitializedError,
  NotInitializedError,
  WrongKindError,
} from "../../gen/setup/error.js";

export const integrationSetupOperations: IntegrationSetupOperations = {
  initializeOperation(state, action) {
    if (state.kind)
      throw new AlreadyInitializedError("The integration is set up already");
    state.kind = action.input.kind;
    state.provider = action.input.provider;
  },
  setCalendarSourceOperation(state, action) {
    if (state.kind !== "CALENDAR")
      throw new WrongKindError("Only a calendar integration has calendars");
    state.intent.source = {
      calendars: action.input.allOwned
        ? []
        : action.input.calendars.map((c) => ({
            id: c.id,
            name: c.name ?? null,
          })),
      allOwned: action.input.allOwned,
    };
    state.intent.generation += 1;
  },
  setAccessOperation(state, action) {
    if (!state.kind)
      throw new NotInitializedError("Set up the integration first");
    state.intent.access = action.input.access;
    state.intent.generation += 1;
  },
};
