import type { ContactLifecycleOperations } from "document-models/contact/v1";
import { StatusUnchangedError } from "../../gen/lifecycle/error.js";

export const contactLifecycleOperations: ContactLifecycleOperations = {
  archiveContactOperation(state, action) {
    const next = action.input.archived ? "ARCHIVED" : "ACTIVE";
    if (state.status === next)
      throw new StatusUnchangedError(
        `The contact is already ${next.toLowerCase()}`,
      );
    state.status = next;
  },
};
