import type { DocumentModelGlobalState } from "document-model";

export const documentModel: DocumentModelGlobalState = {
  id: "sektar/folder-sync",
  name: "Folder Sync",
  author: {
    name: "Sektar",
    website: "https://sektar.app",
  },
  extension: "sync",
  description:
    "A drive folder mapped onto a folder on the Switchboard's machine, and the state of keeping it written there: the options, the requests for a run, the runs, and the files that could not be written.",
  specifications: [
    {
      version: 1,
      changeLog: [],
      state: {
        global: {
          schema:
            'type FolderSyncState {\n  "The drive the mapped folder is in"\n  driveId: PHID\n  "The mapped drive folder; null maps the drive\'s root"\n  folderId: OID\n  "The folder\'s path in the drive when it was mapped, for display, e.g. kwartaalaangiftes/2026-Q3"\n  folderPath: String\n  "The folder on the Switchboard\'s machine the files are written to (an absolute path)"\n  localPath: String\n  direction: FolderSyncDirection!\n  "A disabled mapping is kept but never run"\n  enabled: Boolean!\n  options: FolderSyncOptions!\n  status: FolderSyncStatus!\n  "The latest request for a run: when, by whom (the app, a workflow), and whether everything is rewritten"\n  request: FolderSyncRequest\n  "The Switchboard that ran this mapping last"\n  host: FolderSyncHost\n  "The runs, latest first, at most 20"\n  runs: [FolderSyncRun!]!\n  "What the last run could not write, or found changed on disk"\n  issues: [FolderSyncIssue!]!\n  "Pulls asked for and not done yet"\n  pulls: [FolderSyncPull!]!\n}\n\ntype FolderSyncOptions {\n  "Run when asked only, or also whenever the folder changes"\n  trigger: FolderSyncTrigger!\n  includeSubfolders: Boolean!\n  "What is written for a File: its source, or its source and its renditions"\n  content: FolderSyncContent!\n  "What happens to documents that are not Files (invoices, trips)"\n  otherDocuments: FolderSyncOtherDocuments!\n  "What happens to a file on disk whose document left the folder"\n  onRemoved: FolderSyncRemovedPolicy!\n  "What happens to a file on disk that was changed since it was written"\n  onConflict: FolderSyncConflictPolicy!\n  "What a change found on disk becomes: nothing, a placeholder to pull, or a pull"\n  fromDisk: FolderSyncFromDisk!\n}\n\n"A request to pull placeholders into the drive"\ntype FolderSyncPull {\n  id: OID!\n  requestedAt: DateTime!\n  requestedBy: String\n  "The placeholders\' drive nodes; empty pulls every placeholder of the mapping"\n  nodeIds: [OID!]!\n}\n\ntype FolderSyncRequest {\n  id: OID!\n  requestedAt: DateTime!\n  "Who asked: app, workflow, or a name"\n  requestedBy: String\n  "Rewrite every file, not only the changed ones"\n  full: Boolean!\n}\n\ntype FolderSyncHost {\n  name: String\n  platform: String\n  reactorId: String\n}\n\ntype FolderSyncRun {\n  id: OID!\n  "The request the run answered"\n  requestId: OID\n  startedAt: DateTime!\n  finishedAt: DateTime\n  status: FolderSyncRunStatus!\n  full: Boolean!\n  "The drive\'s revision the run copied"\n  driveRevision: Int\n  written: Int!\n  unchanged: Int!\n  deleted: Int!\n  skipped: Int!\n  conflicts: Int!\n  errors: Int!\n  bytesWritten: Float!\n  "Changes found on disk recorded as placeholders"\n  placeholders: Int!\n  "Changes found on disk pulled into the drive"\n  pulled: Int!\n  error: String\n}\n\ntype FolderSyncIssue {\n  id: OID!\n  kind: FolderSyncIssueKind!\n  nodeId: OID\n  documentId: PHID\n  "Where the file is, or would be, below the local folder"\n  relativePath: String\n  message: String!\n  at: DateTime!\n}\n\nenum FolderSyncDirection {\n  TO_DISK\n}\n\nenum FolderSyncTrigger {\n  MANUAL\n  ON_CHANGE\n}\n\nenum FolderSyncContent {\n  SOURCE\n  SOURCE_AND_RENDITIONS\n}\n\nenum FolderSyncOtherDocuments {\n  SKIP\n  EXPORT_PHD\n}\n\nenum FolderSyncRemovedPolicy {\n  KEEP\n  DELETE\n}\n\nenum FolderSyncConflictPolicy {\n  SKIP\n  OVERWRITE\n  KEEP_BOTH\n}\n\nenum FolderSyncFromDisk {\n  "Changes on disk are left alone (and a changed file is a conflict)"\n  OFF\n  "Changes on disk become placeholders, pulled by hand"\n  PLACEHOLDERS\n  "New and changed files are pulled; deletions stay placeholders"\n  AUTO_PULL\n  "New and changed files are pulled, and deletions too"\n  AUTO_PULL_WITH_DELETES\n}\n\nenum FolderSyncStatus {\n  NEVER\n  REQUESTED\n  RUNNING\n  OK\n  PARTIAL\n  ERROR\n}\n\nenum FolderSyncRunStatus {\n  RUNNING\n  OK\n  PARTIAL\n  ERROR\n  CANCELLED\n}\n\nenum FolderSyncIssueKind {\n  CONFLICT\n  ERROR\n  NAME_CLASH\n  PATH_TOO_LONG\n  NO_SOURCE\n}',
          initialValue:
            '{\n  "driveId": null,\n  "folderId": null,\n  "folderPath": null,\n  "localPath": null,\n  "direction": "TO_DISK",\n  "enabled": true,\n  "options": {\n    "trigger": "MANUAL",\n    "includeSubfolders": true,\n    "content": "SOURCE",\n    "otherDocuments": "SKIP",\n    "onRemoved": "KEEP",\n    "onConflict": "SKIP",\n    "fromDisk": "OFF"\n  },\n  "status": "NEVER",\n  "request": null,\n  "host": null,\n  "runs": [],\n  "issues": [],\n  "pulls": []\n}',
          examples: [],
        },
        local: {
          schema: "",
          initialValue: "",
          examples: [],
        },
      },
      modules: [
        {
          id: "4dc247b9-95b6-4491-85c4-ceec11cc555a",
          name: "mapping",
          description: "Which drive folder goes where on disk, and how",
          operations: [
            {
              id: "9f7cd474-d572-48f0-a1cf-ed3ff87b57ff",
              name: "SET_TARGET",
              description: "",
              schema:
                'input SetTargetInput {\n  driveId: PHID!\n  "Null maps the drive\'s root"\n  folderId: OID\n  folderPath: String\n}',
              template: "",
              reducer:
                "normalize(state);\nconst i = action.input;\nstate.driveId = i.driveId;\nstate.folderId = i.folderId ?? null;\nstate.folderPath = i.folderPath ?? null;",
              errors: [],
              examples: [],
              scope: "global",
            },
            {
              id: "78306259-bcba-4bf1-8816-ac8e63bb71dc",
              name: "SET_LOCAL_PATH",
              description: "",
              schema: "input SetLocalPathInput {\n  localPath: String!\n}",
              template: "",
              reducer:
                'normalize(state);\nconst path = action.input.localPath.trim();\nif (!/^([A-Za-z]:[\\\\/]|\\\\\\\\|\\/)/.test(path)) throw new InvalidLocalPathError(`"${path}" is not an absolute path`);\nstate.localPath = path;',
              errors: [
                {
                  id: "fb1e0329-f9b0-4238-97c4-07dcc003492b",
                  code: "INVALID_LOCAL_PATH",
                  name: "InvalidLocalPathError",
                  description:
                    "The local path must be an absolute path on the Switchboard's machine",
                  template: "",
                },
              ],
              examples: [],
              scope: "global",
            },
            {
              id: "b3b4eab1-d595-4dd5-92be-a610c7dfbb3a",
              name: "SET_OPTIONS",
              description: "",
              schema:
                "input SetOptionsInput {\n  trigger: FolderSyncTrigger\n  includeSubfolders: Boolean\n  content: FolderSyncContent\n  otherDocuments: FolderSyncOtherDocuments\n  onRemoved: FolderSyncRemovedPolicy\n  onConflict: FolderSyncConflictPolicy\n  fromDisk: FolderSyncFromDisk\n}",
              template: "",
              reducer:
                "normalize(state);\nconst i = action.input;\nconst o = state.options;\nif (i.trigger) o.trigger = i.trigger;\nif (i.includeSubfolders !== undefined && i.includeSubfolders !== null) o.includeSubfolders = i.includeSubfolders;\nif (i.content) o.content = i.content;\nif (i.otherDocuments) o.otherDocuments = i.otherDocuments;\nif (i.onRemoved) o.onRemoved = i.onRemoved;\nif (i.onConflict) o.onConflict = i.onConflict;\nif (i.fromDisk) o.fromDisk = i.fromDisk;",
              errors: [],
              examples: [],
              scope: "global",
            },
            {
              id: "bcefa202-2395-4c7a-bce4-ab6fff91c61f",
              name: "SET_ENABLED",
              description: "",
              schema: "input SetEnabledInput {\n  enabled: Boolean!\n}",
              template: "",
              reducer:
                "normalize(state);\nstate.enabled = action.input.enabled;",
              errors: [],
              examples: [],
              scope: "global",
            },
          ],
        },
        {
          id: "a20b050e-acf8-4046-8e6e-716bc8d59d2f",
          name: "sync",
          description: "Asking for a run: from the app, or from a workflow",
          operations: [
            {
              id: "ad39ae0e-9c01-4827-a932-6e8b6c1e2fdf",
              name: "REQUEST_SYNC",
              description: "",
              schema:
                "input RequestSyncInput {\n  id: OID!\n  requestedAt: DateTime!\n  requestedBy: String\n  full: Boolean\n}",
              template: "",
              reducer:
                'normalize(state);\nconst i = action.input;\nif (!state.driveId || !state.localPath) throw new NotConfiguredError("Set the drive folder and the local path first");\nif (!state.enabled) throw new MappingDisabledError("Enable the mapping first");\nstate.request = { id: i.id, requestedAt: i.requestedAt, requestedBy: i.requestedBy ?? null, full: i.full ?? false };\nif (state.status !== "RUNNING") state.status = "REQUESTED";',
              errors: [
                {
                  id: "9eebd205-95ff-410d-a45f-4402a3492bd4",
                  code: "NOT_CONFIGURED",
                  name: "NotConfiguredError",
                  description:
                    "The mapping has no drive folder or no local path yet",
                  template: "",
                },
                {
                  id: "e9b9fa2a-dbfa-493c-a72d-f9dcf8a0ea7f",
                  code: "MAPPING_DISABLED",
                  name: "MappingDisabledError",
                  description: "The mapping is disabled",
                  template: "",
                },
              ],
              examples: [],
              scope: "global",
            },
            {
              id: "d3322928-e08c-40ee-b390-dea45a464860",
              name: "REQUEST_PULL",
              description: "",
              schema:
                'input RequestPullInput {\n  id: OID!\n  requestedAt: DateTime!\n  requestedBy: String\n  "The placeholders\' drive nodes; empty or absent pulls every placeholder"\n  nodeIds: [OID!]\n}',
              template: "",
              reducer:
                'normalize(state);\nconst i = action.input;\nif (!state.driveId || !state.localPath) throw new NotConfiguredError("Set the drive folder and the local path first");\nif (!state.enabled) throw new MappingDisabledError("Enable the mapping first");\nif (state.options.fromDisk === "OFF") throw new FromDiskOffError("Turn on changes from disk first");\nif (state.pulls.some((p) => p.id === i.id)) throw new DuplicatePullIdError(`Pull ${i.id} exists`);\nstate.pulls.push({ id: i.id, requestedAt: i.requestedAt, requestedBy: i.requestedBy ?? null, nodeIds: [...new Set(i.nodeIds ?? [])] });\nif (state.status !== "RUNNING") state.status = "REQUESTED";',
              errors: [
                {
                  id: "628bd5d6-93ad-4e76-9640-9e0bad3b9faf",
                  code: "NOT_CONFIGURED",
                  name: "NotConfiguredError",
                  description:
                    "The mapping has no drive folder or no local path yet",
                  template: "",
                },
                {
                  id: "5ddbcb4e-4522-40a0-8471-6dc9f0b5df32",
                  code: "MAPPING_DISABLED",
                  name: "MappingDisabledError",
                  description: "The mapping is disabled",
                  template: "",
                },
                {
                  id: "b2013890-efc6-495d-8d8e-cfc7228aebcb",
                  code: "FROM_DISK_OFF",
                  name: "FromDiskOffError",
                  description:
                    "Changes from disk are turned off for this mapping",
                  template: "",
                },
                {
                  id: "d61e78a4-5997-4056-94cc-946999d7e145",
                  code: "DUPLICATE_PULL_ID",
                  name: "DuplicatePullIdError",
                  description: "A pull with this id is already asked for",
                  template: "",
                },
              ],
              examples: [],
              scope: "global",
            },
          ],
        },
        {
          id: "33528568-a15d-4734-b09f-02189e514a87",
          name: "runner",
          description:
            "What the Switchboard reports: the runs and the files it could not write",
          operations: [
            {
              id: "e15966f2-6394-425b-8d74-2ebec3585035",
              name: "START_RUN",
              description: "",
              schema:
                "input StartRunInput {\n  id: OID!\n  requestId: OID\n  startedAt: DateTime!\n  full: Boolean\n  driveRevision: Int\n  hostName: String\n  hostPlatform: String\n  reactorId: String\n}",
              template: "",
              reducer:
                'normalize(state);\nconst i = action.input;\nif (state.runs.some((r) => r.id === i.id)) throw new DuplicateRunIdError(`Run ${i.id} exists`);\nstate.runs.unshift({\n  id: i.id,\n  requestId: i.requestId ?? null,\n  startedAt: i.startedAt,\n  finishedAt: null,\n  status: "RUNNING",\n  full: i.full ?? false,\n  driveRevision: i.driveRevision ?? null,\n  written: 0,\n  unchanged: 0,\n  deleted: 0,\n  skipped: 0,\n  conflicts: 0,\n  errors: 0,\n  bytesWritten: 0,\n  placeholders: 0,\n  pulled: 0,\n  error: null,\n});\nstate.runs.splice(20);\nstate.host = { name: i.hostName ?? null, platform: i.hostPlatform ?? null, reactorId: i.reactorId ?? null };\nstate.status = "RUNNING";',
              errors: [
                {
                  id: "4125a9e7-b684-4e63-b6bb-27776b9056ed",
                  code: "DUPLICATE_RUN_ID",
                  name: "DuplicateRunIdError",
                  description: "A run with this id is already recorded",
                  template: "",
                },
              ],
              examples: [],
              scope: "global",
            },
            {
              id: "44f9f775-7bae-4085-beb6-fa129900e3f2",
              name: "FINISH_RUN",
              description: "",
              schema:
                "input FinishRunInput {\n  id: OID!\n  finishedAt: DateTime!\n  status: FolderSyncRunStatus!\n  written: Int\n  unchanged: Int\n  deleted: Int\n  skipped: Int\n  conflicts: Int\n  errors: Int\n  bytesWritten: Float\n  placeholders: Int\n  pulled: Int\n  error: String\n}",
              template: "",
              reducer:
                'normalize(state);\nconst i = action.input;\nconst run = state.runs.find((r) => r.id === i.id);\nif (!run) throw new RunNotFoundError(`No run ${i.id}`);\nif (run.finishedAt) throw new RunFinishedError(`Run ${i.id} finished at ${run.finishedAt}`);\nif (i.status === "RUNNING") throw new InvalidRunStatusError("A finished run cannot be RUNNING");\nrun.finishedAt = i.finishedAt;\nrun.status = i.status;\nrun.written = i.written ?? 0;\nrun.unchanged = i.unchanged ?? 0;\nrun.deleted = i.deleted ?? 0;\nrun.skipped = i.skipped ?? 0;\nrun.conflicts = i.conflicts ?? 0;\nrun.errors = i.errors ?? 0;\nrun.bytesWritten = i.bytesWritten ?? 0;\nrun.placeholders = i.placeholders ?? 0;\nrun.pulled = i.pulled ?? 0;\nrun.error = i.error ?? null;\n// A request that arrived while the run was going is still owed a run.\nconst owed = (Boolean(state.request) && state.request?.id !== run.requestId) || state.pulls.length > 0;\nstate.status = owed ? "REQUESTED" : i.status === "OK" ? "OK" : i.status === "PARTIAL" ? "PARTIAL" : "ERROR";',
              errors: [
                {
                  id: "df4e3429-e2f2-4bac-b072-738625127feb",
                  code: "RUN_NOT_FOUND",
                  name: "RunNotFoundError",
                  description: "No run with this id",
                  template: "",
                },
                {
                  id: "55555270-10a9-427e-9ef5-af467d5e220b",
                  code: "RUN_FINISHED",
                  name: "RunFinishedError",
                  description: "The run has finished already",
                  template: "",
                },
                {
                  id: "0a43c8da-7d7e-4069-82d0-5ca04c5f2c4f",
                  code: "INVALID_RUN_STATUS",
                  name: "InvalidRunStatusError",
                  description:
                    "A run finishes as OK, PARTIAL, ERROR or CANCELLED",
                  template: "",
                },
              ],
              examples: [],
              scope: "global",
            },
            {
              id: "19bac7f2-58cc-4933-80e5-eef12321f9a8",
              name: "SET_ISSUES",
              description: "",
              schema:
                "input SetIssuesInput {\n  issues: [FolderSyncIssueInput!]!\n}\n\ninput FolderSyncIssueInput {\n  id: OID!\n  kind: FolderSyncIssueKind!\n  nodeId: OID\n  documentId: PHID\n  relativePath: String\n  message: String!\n  at: DateTime!\n}",
              template: "",
              reducer:
                'normalize(state);\nconst issues = action.input.issues;\nconst ids = new Set(issues.map((x) => x.id));\nif (ids.size !== issues.length) throw new DuplicateIssueIdError("Two issues share an id");\nstate.issues = issues.map((x) => ({\n  id: x.id,\n  kind: x.kind,\n  nodeId: x.nodeId ?? null,\n  documentId: x.documentId ?? null,\n  relativePath: x.relativePath ?? null,\n  message: x.message,\n  at: x.at,\n}));',
              errors: [
                {
                  id: "17613318-9eb8-4afa-87f9-34cc38582f79",
                  code: "DUPLICATE_ISSUE_ID",
                  name: "DuplicateIssueIdError",
                  description: "Two issues share an id",
                  template: "",
                },
              ],
              examples: [],
              scope: "global",
            },
            {
              id: "39a6c525-7976-427e-990e-9d9e6db2358a",
              name: "RESOLVE_ISSUE",
              description: "",
              schema: "input ResolveIssueInput {\n  id: OID!\n}",
              template: "",
              reducer:
                "normalize(state);\nconst at = state.issues.findIndex((x) => x.id === action.input.id);\nif (at < 0) throw new IssueNotFoundError(`No issue ${action.input.id}`);\nstate.issues.splice(at, 1);",
              errors: [
                {
                  id: "71752eb7-6eb7-4f97-8def-80eb8cfc5c33",
                  code: "ISSUE_NOT_FOUND",
                  name: "IssueNotFoundError",
                  description: "No issue with this id",
                  template: "",
                },
              ],
              examples: [],
              scope: "global",
            },
            {
              id: "342937a9-4499-40d5-95b8-81373337e320",
              name: "COMPLETE_PULL",
              description: "",
              schema: "input CompletePullInput {\n  id: OID!\n}",
              template: "",
              reducer:
                "normalize(state);\nconst at = state.pulls.findIndex((p) => p.id === action.input.id);\nif (at < 0) throw new PullNotFoundError(`No pull ${action.input.id}`);\nstate.pulls.splice(at, 1);",
              errors: [
                {
                  id: "03015449-87d8-461c-bb16-e76f1bc2e79d",
                  code: "PULL_NOT_FOUND",
                  name: "PullNotFoundError",
                  description: "No pull with this id",
                  template: "",
                },
              ],
              examples: [],
              scope: "global",
            },
          ],
        },
      ],
    },
  ],
};
