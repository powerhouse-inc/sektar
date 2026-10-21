export type Maybe<T> = T | null | undefined;
export type InputMaybe<T> = T | null | undefined;
export type Exact<T extends { [key: string]: unknown }> = {
  [K in keyof T]: T[K];
};
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & {
  [SubKey in K]?: Maybe<T[SubKey]>;
};
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & {
  [SubKey in K]: Maybe<T[SubKey]>;
};
export type MakeEmpty<
  T extends { [key: string]: unknown },
  K extends keyof T,
> = { [_ in K]?: never };
export type Incremental<T> =
  | T
  | {
      [P in keyof T]?: P extends " $fragmentName" | "__typename" ? T[P] : never;
    };
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string };
  String: { input: string; output: string };
  Boolean: { input: boolean; output: boolean };
  Int: { input: number; output: number };
  Float: { input: number; output: number };
  Address: { input: `${string}:0x${string}`; output: `${string}:0x${string}` };
  Amount: {
    input: { unit?: string; value?: number };
    output: { unit?: string; value?: number };
  };
  Amount_Crypto: {
    input: { unit: string; value: string };
    output: { unit: string; value: string };
  };
  Amount_Currency: {
    input: { unit: string; value: string };
    output: { unit: string; value: string };
  };
  Amount_Fiat: {
    input: { unit: string; value: number };
    output: { unit: string; value: number };
  };
  Amount_Money: { input: number; output: number };
  Amount_Percentage: { input: number; output: number };
  Amount_Tokens: { input: number; output: number };
  AttachmentRef: {
    input: `attachment://v${number}:${string}`;
    output: `attachment://v${number}:${string}`;
  };
  Currency: { input: string; output: string };
  Date: { input: string; output: string };
  DateTime: { input: string; output: string };
  EmailAddress: { input: string; output: string };
  EthereumAddress: { input: string; output: string };
  OID: { input: string; output: string };
  OLabel: { input: string; output: string };
  PHID: { input: string; output: string };
  URL: { input: string; output: string };
  Unknown: { input: unknown; output: unknown };
  Upload: { input: File; output: File };
};

export type CompletePullInput = {
  id: Scalars["OID"]["input"];
};

export type FinishRunInput = {
  bytesWritten?: InputMaybe<Scalars["Float"]["input"]>;
  conflicts?: InputMaybe<Scalars["Int"]["input"]>;
  deleted?: InputMaybe<Scalars["Int"]["input"]>;
  error?: InputMaybe<Scalars["String"]["input"]>;
  errors?: InputMaybe<Scalars["Int"]["input"]>;
  finishedAt: Scalars["DateTime"]["input"];
  id: Scalars["OID"]["input"];
  placeholders?: InputMaybe<Scalars["Int"]["input"]>;
  pulled?: InputMaybe<Scalars["Int"]["input"]>;
  skipped?: InputMaybe<Scalars["Int"]["input"]>;
  status: FolderSyncRunStatus;
  unchanged?: InputMaybe<Scalars["Int"]["input"]>;
  written?: InputMaybe<Scalars["Int"]["input"]>;
};

export type FolderSyncConflictPolicy = "KEEP_BOTH" | "OVERWRITE" | "SKIP";

export type FolderSyncContent = "SOURCE" | "SOURCE_AND_RENDITIONS";

export type FolderSyncDirection = "TO_DISK";

export type FolderSyncFromDisk =
  /** New and changed files are pulled; deletions stay placeholders */
  | "AUTO_PULL"
  /** New and changed files are pulled, and deletions too */
  | "AUTO_PULL_WITH_DELETES"
  /** Changes on disk are left alone (and a changed file is a conflict) */
  | "OFF"
  /** Changes on disk become placeholders, pulled by hand */
  | "PLACEHOLDERS";

export type FolderSyncHost = {
  name: Maybe<Scalars["String"]["output"]>;
  platform: Maybe<Scalars["String"]["output"]>;
  reactorId: Maybe<Scalars["String"]["output"]>;
};

export type FolderSyncIssue = {
  at: Scalars["DateTime"]["output"];
  documentId: Maybe<Scalars["PHID"]["output"]>;
  id: Scalars["OID"]["output"];
  kind: FolderSyncIssueKind;
  message: Scalars["String"]["output"];
  nodeId: Maybe<Scalars["OID"]["output"]>;
  /** Where the file is, or would be, below the local folder */
  relativePath: Maybe<Scalars["String"]["output"]>;
};

export type FolderSyncIssueInput = {
  at: Scalars["DateTime"]["input"];
  documentId?: InputMaybe<Scalars["PHID"]["input"]>;
  id: Scalars["OID"]["input"];
  kind: FolderSyncIssueKind;
  message: Scalars["String"]["input"];
  nodeId?: InputMaybe<Scalars["OID"]["input"]>;
  relativePath?: InputMaybe<Scalars["String"]["input"]>;
};

export type FolderSyncIssueKind =
  | "CONFLICT"
  | "ERROR"
  | "NAME_CLASH"
  | "NO_SOURCE"
  | "PATH_TOO_LONG";

export type FolderSyncOptions = {
  /** What is written for a File: its source, or its source and its renditions */
  content: FolderSyncContent;
  /** What a change found on disk becomes: nothing, a placeholder to pull, or a pull */
  fromDisk: Maybe<FolderSyncFromDisk>;
  includeSubfolders: Scalars["Boolean"]["output"];
  /** What happens to a file on disk that was changed since it was written */
  onConflict: FolderSyncConflictPolicy;
  /** What happens to a file on disk whose document left the folder */
  onRemoved: FolderSyncRemovedPolicy;
  /** What happens to documents that are not Files (invoices, trips) */
  otherDocuments: FolderSyncOtherDocuments;
  /** Run when asked only, or also whenever the folder changes */
  trigger: FolderSyncTrigger;
};

export type FolderSyncOtherDocuments = "EXPORT_PHD" | "SKIP";

/** A request to pull placeholders into the drive */
export type FolderSyncPull = {
  id: Scalars["OID"]["output"];
  /** The placeholders' drive nodes; empty pulls every placeholder of the mapping */
  nodeIds: Array<Scalars["OID"]["output"]>;
  requestedAt: Scalars["DateTime"]["output"];
  requestedBy: Maybe<Scalars["String"]["output"]>;
};

export type FolderSyncRemovedPolicy = "DELETE" | "KEEP";

export type FolderSyncRequest = {
  /** Rewrite every file, not only the changed ones */
  full: Scalars["Boolean"]["output"];
  id: Scalars["OID"]["output"];
  requestedAt: Scalars["DateTime"]["output"];
  /** Who asked: app, workflow, or a name */
  requestedBy: Maybe<Scalars["String"]["output"]>;
};

export type FolderSyncRun = {
  bytesWritten: Scalars["Float"]["output"];
  conflicts: Scalars["Int"]["output"];
  deleted: Scalars["Int"]["output"];
  /** The drive's revision the run copied */
  driveRevision: Maybe<Scalars["Int"]["output"]>;
  error: Maybe<Scalars["String"]["output"]>;
  errors: Scalars["Int"]["output"];
  finishedAt: Maybe<Scalars["DateTime"]["output"]>;
  full: Scalars["Boolean"]["output"];
  id: Scalars["OID"]["output"];
  /** Changes found on disk recorded as placeholders */
  placeholders: Maybe<Scalars["Int"]["output"]>;
  /** Changes found on disk pulled into the drive */
  pulled: Maybe<Scalars["Int"]["output"]>;
  /** The request the run answered */
  requestId: Maybe<Scalars["OID"]["output"]>;
  skipped: Scalars["Int"]["output"];
  startedAt: Scalars["DateTime"]["output"];
  status: FolderSyncRunStatus;
  unchanged: Scalars["Int"]["output"];
  written: Scalars["Int"]["output"];
};

export type FolderSyncRunStatus =
  | "CANCELLED"
  | "ERROR"
  | "OK"
  | "PARTIAL"
  | "RUNNING";

export type FolderSyncState = {
  direction: FolderSyncDirection;
  /** The drive the mapped folder is in */
  driveId: Maybe<Scalars["PHID"]["output"]>;
  /** A disabled mapping is kept but never run */
  enabled: Scalars["Boolean"]["output"];
  /** The mapped drive folder; null maps the drive's root */
  folderId: Maybe<Scalars["OID"]["output"]>;
  /** The folder's path in the drive when it was mapped, for display, e.g. kwartaalaangiftes/2026-Q3 */
  folderPath: Maybe<Scalars["String"]["output"]>;
  /** The Switchboard that ran this mapping last */
  host: Maybe<FolderSyncHost>;
  /** What the last run could not write, or found changed on disk */
  issues: Array<FolderSyncIssue>;
  /** The folder on the Switchboard's machine the files are written to (an absolute path) */
  localPath: Maybe<Scalars["String"]["output"]>;
  options: FolderSyncOptions;
  /** Pulls asked for and not done yet */
  pulls: Maybe<Array<FolderSyncPull>>;
  /** The latest request for a run: when, by whom (the app, a workflow), and whether everything is rewritten */
  request: Maybe<FolderSyncRequest>;
  /** The runs, latest first, at most 20 */
  runs: Array<FolderSyncRun>;
  status: FolderSyncStatus;
};

export type FolderSyncStatus =
  | "ERROR"
  | "NEVER"
  | "OK"
  | "PARTIAL"
  | "REQUESTED"
  | "RUNNING";

export type FolderSyncTrigger = "MANUAL" | "ON_CHANGE";

export type RequestPullInput = {
  id: Scalars["OID"]["input"];
  /** The placeholders' drive nodes; empty or absent pulls every placeholder */
  nodeIds?: InputMaybe<Array<Scalars["OID"]["input"]>>;
  requestedAt: Scalars["DateTime"]["input"];
  requestedBy?: InputMaybe<Scalars["String"]["input"]>;
};

export type RequestSyncInput = {
  full?: InputMaybe<Scalars["Boolean"]["input"]>;
  id: Scalars["OID"]["input"];
  requestedAt: Scalars["DateTime"]["input"];
  requestedBy?: InputMaybe<Scalars["String"]["input"]>;
};

export type ResolveIssueInput = {
  id: Scalars["OID"]["input"];
};

export type SetEnabledInput = {
  enabled: Scalars["Boolean"]["input"];
};

export type SetIssuesInput = {
  issues: Array<FolderSyncIssueInput>;
};

export type SetLocalPathInput = {
  localPath: Scalars["String"]["input"];
};

export type SetOptionsInput = {
  content?: InputMaybe<FolderSyncContent>;
  fromDisk?: InputMaybe<FolderSyncFromDisk>;
  includeSubfolders?: InputMaybe<Scalars["Boolean"]["input"]>;
  onConflict?: InputMaybe<FolderSyncConflictPolicy>;
  onRemoved?: InputMaybe<FolderSyncRemovedPolicy>;
  otherDocuments?: InputMaybe<FolderSyncOtherDocuments>;
  trigger?: InputMaybe<FolderSyncTrigger>;
};

export type SetTargetInput = {
  driveId: Scalars["PHID"]["input"];
  /** Null maps the drive's root */
  folderId?: InputMaybe<Scalars["OID"]["input"]>;
  folderPath?: InputMaybe<Scalars["String"]["input"]>;
};

export type StartRunInput = {
  driveRevision?: InputMaybe<Scalars["Int"]["input"]>;
  full?: InputMaybe<Scalars["Boolean"]["input"]>;
  hostName?: InputMaybe<Scalars["String"]["input"]>;
  hostPlatform?: InputMaybe<Scalars["String"]["input"]>;
  id: Scalars["OID"]["input"];
  reactorId?: InputMaybe<Scalars["String"]["input"]>;
  requestId?: InputMaybe<Scalars["OID"]["input"]>;
  startedAt: Scalars["DateTime"]["input"];
};
