import type { IntegrationLifecycleOperations } from "document-models/integration/v1";

export const integrationLifecycleOperations: IntegrationLifecycleOperations = {
  archiveOperation(state) {
    if (!state.intent.archived) {
      state.intent.archived = true;
      state.intent.generation += 1;
    }
  },
};
