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

export type AddAliasInput = {
  alias: Scalars["String"]["input"];
  source: Scalars["OID"]["input"];
};

export type AddSourceReferenceInput = {
  reference: Scalars["URL"]["input"];
  source: Scalars["OID"]["input"];
};

export type AssignTaskInput = {
  owner?: InputMaybe<Scalars["String"]["input"]>;
  task: Scalars["OID"]["input"];
};

export type AttachToSourceInput = {
  fileName: Scalars["String"]["input"];
  mimeType?: InputMaybe<Scalars["String"]["input"]>;
  ref: Scalars["AttachmentRef"]["input"];
  sizeBytes?: InputMaybe<Scalars["Int"]["input"]>;
  source: Scalars["OID"]["input"];
};

export type CaptureSourceInput = {
  aliases?: InputMaybe<Array<Scalars["String"]["input"]>>;
  attachments?: InputMaybe<Array<CapturedAttachmentInput>>;
  /**
   * When this sighting happened. Becomes capturedAt on a new source and
   * lastSeenAt on every sighting, including the first.
   */
  capturedAt: Scalars["DateTime"]["input"];
  content?: InputMaybe<Scalars["String"]["input"]>;
  externalId: Scalars["String"]["input"];
  /** Used only when this capture creates a source; reducers cannot generate ids. */
  id: Scalars["OID"]["input"];
  occurredAt?: InputMaybe<Scalars["DateTime"]["input"]>;
  origin?: InputMaybe<Scalars["URL"]["input"]>;
  payload?: InputMaybe<Scalars["Unknown"]["input"]>;
  references?: InputMaybe<Array<Scalars["URL"]["input"]>>;
  tags?: InputMaybe<Array<Scalars["String"]["input"]>>;
  title?: InputMaybe<Scalars["String"]["input"]>;
};

export type CapturedAttachmentInput = {
  fileName: Scalars["String"]["input"];
  mimeType?: InputMaybe<Scalars["String"]["input"]>;
  ref: Scalars["AttachmentRef"]["input"];
  sizeBytes?: InputMaybe<Scalars["Int"]["input"]>;
};

export type CreateTaskInput = {
  createdAt: Scalars["DateTime"]["input"];
  description?: InputMaybe<Scalars["String"]["input"]>;
  id: Scalars["OID"]["input"];
  owner?: InputMaybe<Scalars["String"]["input"]>;
  source?: InputMaybe<Scalars["OID"]["input"]>;
  status?: InputMaybe<ProcessingTaskStatus>;
};

export type DetachFromSourceInput = {
  ref: Scalars["AttachmentRef"]["input"];
  source: Scalars["OID"]["input"];
};

export type DiscardCollectionInput = {
  _?: InputMaybe<Scalars["Boolean"]["input"]>;
};

export type DiscardSourceInput = {
  source: Scalars["OID"]["input"];
};

export type MergeSourcesInput = {
  keep: Scalars["OID"]["input"];
  merge: Array<Scalars["OID"]["input"]>;
  mergedAt: Scalars["DateTime"]["input"];
};

/**
 * A file in the attachment store.
 *
 * Only the ref and a name are required. A piece that wrote the file through
 * context.files.write gets back a ref and usually a name, but not always a mime
 * type or a size; demanding fields the source does not supply would force a
 * flow to invent them, and an invented mime type is worse than an absent one.
 *
 * Recording the ref here is also what makes the file readable: the attachment
 * port refuses a download unless the document references it.
 */
export type OscAttachment = {
  fileName: Scalars["String"]["output"];
  mimeType: Maybe<Scalars["String"]["output"]>;
  ref: Scalars["AttachmentRef"]["output"];
  sizeBytes: Maybe<Scalars["Int"]["output"]>;
};

/** Calculated. What a person wants to know without counting a list. */
export type OscCounts = {
  completed: Scalars["Int"]["output"];
  discarded: Scalars["Int"]["output"];
  merged: Scalars["Int"]["output"];
  new: Scalars["Int"]["output"];
  openTasks: Scalars["Int"]["output"];
  processing: Scalars["Int"]["output"];
  total: Scalars["Int"]["output"];
};

/** Where this collection's contents came from, as a whole. */
export type OscProvenance = {
  /** Anything else worth recording about the run, verbatim. */
  detail: Maybe<Scalars["Unknown"]["output"]>;
  /**
   * The Original Source Queue that drove the capture, when one did. This is
   * what lets the two documents be read together: the queue names the slices
   * that failed, the collection holds what the rest produced. Neither answers
   * is this backfill complete on its own.
   */
  queue: Maybe<Scalars["PHID"]["output"]>;
  /** A short name for the source system: gmail, toggl, filesystem. */
  system: Maybe<Scalars["String"]["output"]>;
};

/** One thing that was captured. */
export type OriginalSource = {
  /**
   * Every other identifier this object is known by, same shape. Capture
   * matches on these too, which is how a second sighting under a different id
   * lands on the record that already exists. No identifier belongs to more
   * than one source.
   */
  aliases: Array<Scalars["String"]["output"]>;
  attachments: Array<OscAttachment>;
  /**
   * When this object first entered the collection. It never moves: a merge
   * keeps the earliest sighting, so letting a re-capture push this forward
   * would make a long-known source lose a merge it should win.
   *
   * A different question from occurredAt, and both are needed: a 2019 email
   * captured today is dated 2019 for analysis and today for what did this run
   * pick up.
   */
  capturedAt: Scalars["DateTime"]["output"];
  /** Human-readable text, when the source has any. */
  content: Maybe<Scalars["String"]["output"]>;
  /**
   * Canonical identifier, namespaced by its system: gmail:18f3a, sha256:9de1.
   * The namespace is required, because without it an id from one system and
   * an id from another are the same key.
   */
  externalId: Scalars["String"]["output"];
  id: Scalars["OID"]["output"];
  /** The most recent sighting. Equals capturedAt until it is seen again. */
  lastSeenAt: Scalars["DateTime"]["output"];
  mergedAt: Maybe<Scalars["DateTime"]["output"]>;
  /** Calculated: the sources folded into this one, so the trail is walkable both ways. */
  mergedFrom: Array<Scalars["OID"]["output"]>;
  /**
   * Set when this source was folded into another. Its payload and attachments
   * stay here; only the identity moved.
   */
  mergedInto: Maybe<Scalars["OID"]["output"]>;
  /** When the thing happened at the source. */
  occurredAt: Maybe<Scalars["DateTime"]["output"]>;
  origin: Maybe<Scalars["URL"]["output"]>;
  /** The record exactly as received, untouched. The reason this model exists. */
  payload: Maybe<Scalars["Unknown"]["output"]>;
  references: Array<Scalars["URL"]["output"]>;
  status: OriginalSourceStatus;
  tags: Array<Scalars["String"]["output"]>;
  title: Maybe<Scalars["String"]["output"]>;
};

export type OriginalSourceCollectionState = {
  counts: OscCounts;
  description: Maybe<Scalars["String"]["output"]>;
  provenance: Maybe<OscProvenance>;
  sources: Array<OriginalSource>;
  /**
   * Calculated from the sources, except DISCARDED which is set: abandoning a
   * whole collection is a decision, not a roll-up.
   */
  status: OriginalSourceStatus;
  tasks: Array<ProcessingTask>;
  title: Maybe<Scalars["String"]["output"]>;
};

/**
 * Where a source, or a whole collection, stands.
 * - NEW: captured, untouched.
 * - PROCESSING: someone or something is working on it.
 * - COMPLETED: done with.
 * - DISCARDED: deliberately ignored, or folded into another source. Never
 *   deleted: an original-source store that can forget is not one.
 */
export type OriginalSourceStatus =
  | "COMPLETED"
  | "DISCARDED"
  | "NEW"
  | "PROCESSING";

export type ProcessingTask = {
  createdAt: Scalars["DateTime"]["output"];
  description: Maybe<Scalars["String"]["output"]>;
  id: Scalars["OID"]["output"];
  owner: Maybe<Scalars["String"]["output"]>;
  /** The source this is about. Absent means it is about the batch. */
  source: Maybe<Scalars["OID"]["output"]>;
  status: ProcessingTaskStatus;
};

export type ProcessingTaskStatus =
  | "CANCELLED"
  | "DONE"
  | "DRAFT"
  | "IN_PROGRESS"
  | "TODO";

export type RemoveAliasInput = {
  alias: Scalars["String"]["input"];
  source: Scalars["OID"]["input"];
};

export type RestoreCollectionInput = {
  _?: InputMaybe<Scalars["Boolean"]["input"]>;
};

export type SetDescriptionInput = {
  description?: InputMaybe<Scalars["String"]["input"]>;
};

export type SetProvenanceInput = {
  detail?: InputMaybe<Scalars["Unknown"]["input"]>;
  queue?: InputMaybe<Scalars["PHID"]["input"]>;
  system?: InputMaybe<Scalars["String"]["input"]>;
};

export type SetSourceStatusInput = {
  source: Scalars["OID"]["input"];
  status: OriginalSourceStatus;
};

export type SetSourceTitleInput = {
  source: Scalars["OID"]["input"];
  title?: InputMaybe<Scalars["String"]["input"]>;
};

export type SetTaskDescriptionInput = {
  description?: InputMaybe<Scalars["String"]["input"]>;
  task: Scalars["OID"]["input"];
};

export type SetTaskStatusInput = {
  status: ProcessingTaskStatus;
  task: Scalars["OID"]["input"];
};

export type SetTitleInput = {
  title?: InputMaybe<Scalars["String"]["input"]>;
};

export type SplitSourceInput = {
  source: Scalars["OID"]["input"];
  status?: InputMaybe<OriginalSourceStatus>;
};

export type TagSourceInput = {
  source: Scalars["OID"]["input"];
  tags: Array<Scalars["String"]["input"]>;
};

export type UntagSourceInput = {
  source: Scalars["OID"]["input"];
  tags: Array<Scalars["String"]["input"]>;
};
