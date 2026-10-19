import type { EmailTriageOperations } from "document-models/email/v1";
import {
  AlreadyArchivedError,
  InvalidLabelError,
  LabelNotFoundError,
  NotArchivedError,
} from "../../gen/triage/error.js";

export const emailTriageOperations: EmailTriageOperations = {
  markReadOperation(state, action) {
    state.read = true;
  },
  markUnreadOperation(state, action) {
    state.read = false;
  },
  setFlaggedOperation(state, action) {
    state.flagged = action.input.flagged;
  },
  archiveOperation(state, action) {
    if (state.status === "ARCHIVED")
      throw new AlreadyArchivedError("The message is archived already");
    state.status = "ARCHIVED";
  },
  unarchiveOperation(state, action) {
    if (state.status !== "ARCHIVED")
      throw new NotArchivedError("The message is not archived");
    state.status = "INBOX";
  },
  addLabelsOperation(state, action) {
    // Checked before anything is written: a batch with one bad label must
    // leave the message exactly as it was.
    const labels = action.input.labels.map((raw) => raw.trim());
    if (labels.some((label) => label === ""))
      throw new InvalidLabelError("A label cannot be empty");
    for (const label of labels) {
      if (!state.labels.includes(label)) state.labels.push(label);
    }
  },
  removeLabelsOperation(state, action) {
    const labels = action.input.labels.map((raw) => raw.trim());
    const missing = labels.find((label) => !state.labels.includes(label));
    if (missing !== undefined)
      throw new LabelNotFoundError(`No label "${missing}" on the message`);
    state.labels = state.labels.filter((label) => !labels.includes(label));
  },
};
