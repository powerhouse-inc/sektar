import type { FolderSyncRunnerOperations } from "document-models/folder-sync/v1";
import {
  DuplicateIssueIdError,
  DuplicateRunIdError,
  InvalidRunStatusError,
  IssueNotFoundError,
  PullNotFoundError,
  RunFinishedError,
  RunNotFoundError,
} from "../../gen/runner/error.js";
import { normalize } from "../utils.js";

export const folderSyncRunnerOperations: FolderSyncRunnerOperations = {
  startRunOperation(state, action) {
    normalize(state);
    const i = action.input;
    if (state.runs.some((r) => r.id === i.id))
      throw new DuplicateRunIdError(`Run ${i.id} exists`);
    state.runs.unshift({
      id: i.id,
      requestId: i.requestId ?? null,
      startedAt: i.startedAt,
      finishedAt: null,
      status: "RUNNING",
      full: i.full ?? false,
      driveRevision: i.driveRevision ?? null,
      written: 0,
      unchanged: 0,
      deleted: 0,
      skipped: 0,
      conflicts: 0,
      errors: 0,
      bytesWritten: 0,
      placeholders: 0,
      pulled: 0,
      error: null,
    });
    state.runs.splice(20);
    state.host = {
      name: i.hostName ?? null,
      platform: i.hostPlatform ?? null,
      reactorId: i.reactorId ?? null,
    };
    state.status = "RUNNING";
  },
  finishRunOperation(state, action) {
    const { pulls } = normalize(state);
    const i = action.input;
    const run = state.runs.find((r) => r.id === i.id);
    if (!run) throw new RunNotFoundError(`No run ${i.id}`);
    if (run.finishedAt)
      throw new RunFinishedError(`Run ${i.id} finished at ${run.finishedAt}`);
    if (i.status === "RUNNING")
      throw new InvalidRunStatusError("A finished run cannot be RUNNING");
    run.finishedAt = i.finishedAt;
    run.status = i.status;
    run.written = i.written ?? 0;
    run.unchanged = i.unchanged ?? 0;
    run.deleted = i.deleted ?? 0;
    run.skipped = i.skipped ?? 0;
    run.conflicts = i.conflicts ?? 0;
    run.errors = i.errors ?? 0;
    run.bytesWritten = i.bytesWritten ?? 0;
    run.placeholders = i.placeholders ?? 0;
    run.pulled = i.pulled ?? 0;
    run.error = i.error ?? null;
    // A request that arrived while the run was going is still owed a run.
    const owed =
      (Boolean(state.request) && state.request?.id !== run.requestId) ||
      pulls.length > 0;
    state.status = owed
      ? "REQUESTED"
      : i.status === "OK"
        ? "OK"
        : i.status === "PARTIAL"
          ? "PARTIAL"
          : "ERROR";
  },
  setIssuesOperation(state, action) {
    normalize(state);
    const issues = action.input.issues;
    const ids = new Set(issues.map((x) => x.id));
    if (ids.size !== issues.length)
      throw new DuplicateIssueIdError("Two issues share an id");
    state.issues = issues.map((x) => ({
      id: x.id,
      kind: x.kind,
      nodeId: x.nodeId ?? null,
      documentId: x.documentId ?? null,
      relativePath: x.relativePath ?? null,
      message: x.message,
      at: x.at,
    }));
  },
  resolveIssueOperation(state, action) {
    normalize(state);
    const at = state.issues.findIndex((x) => x.id === action.input.id);
    if (at < 0) throw new IssueNotFoundError(`No issue ${action.input.id}`);
    state.issues.splice(at, 1);
  },
  completePullOperation(state, action) {
    const { pulls } = normalize(state);
    const at = pulls.findIndex((p) => p.id === action.input.id);
    if (at < 0) throw new PullNotFoundError(`No pull ${action.input.id}`);
    pulls.splice(at, 1);
  },
};
