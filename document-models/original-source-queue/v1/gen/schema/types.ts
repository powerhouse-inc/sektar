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

export type AddCollectionValueInput = {
  collection: Scalars["OID"]["input"];
  values: Array<Scalars["Unknown"]["input"]>;
};

export type ClearCollectionInput = {
  collection: Scalars["OID"]["input"];
};

export type CreateCollectionCursorInput = {
  collection: Scalars["OID"]["input"];
  description?: InputMaybe<Scalars["String"]["input"]>;
  id: Scalars["OID"]["input"];
  name?: InputMaybe<Scalars["String"]["input"]>;
};

export type CreateCollectionInput = {
  id: Scalars["OID"]["input"];
  name: Scalars["String"]["input"];
  values?: InputMaybe<Array<Scalars["Unknown"]["input"]>>;
};

export type CreateDateTimeCursorInput = {
  deltaSeconds: Scalars["Int"]["input"];
  description?: InputMaybe<Scalars["String"]["input"]>;
  first: Scalars["DateTime"]["input"];
  id: Scalars["OID"]["input"];
  last: Scalars["DateTime"]["input"];
  name?: InputMaybe<Scalars["String"]["input"]>;
};

export type CreateNumberCursorInput = {
  description?: InputMaybe<Scalars["String"]["input"]>;
  first: Scalars["Int"]["input"];
  id: Scalars["OID"]["input"];
  last: Scalars["Int"]["input"];
  name?: InputMaybe<Scalars["String"]["input"]>;
  step: Scalars["Int"]["input"];
};

/**
 * A queue of values a cursor can walk. Unlike a range, it is live: values may
 * be pushed while the walk is running, which is what makes discover-then-drain
 * backfills expressible.
 */
export type OsqCollection = {
  id: Scalars["OID"]["output"];
  name: Scalars["String"]["output"];
  values: Array<Scalars["Unknown"]["output"]>;
};

/**
 * A cursor over a collection. current and next are INDICES into it; the value
 * itself is read from the collection, because an index outlives a value and a
 * value does not outlive a clear.
 */
export type OsqCollectionCursor = {
  collection: Scalars["OID"]["output"];
  count: Scalars["Int"]["output"];
  current: Maybe<Scalars["Int"]["output"]>;
  description: Maybe<Scalars["String"]["output"]>;
  finished: Scalars["Boolean"]["output"];
  id: Scalars["OID"]["output"];
  name: Maybe<Scalars["String"]["output"]>;
  next: Maybe<Scalars["Int"]["output"]>;
  position: Scalars["Int"]["output"];
};

export type OsqCursor =
  | OsqCollectionCursor
  | OsqDateTimeCursor
  | OsqNumberCursor;

/** One cursor's reading at a moment, as recorded on an error. */
export type OsqCursorValue = {
  cursor: Scalars["OID"]["output"];
  value: Maybe<Scalars["Unknown"]["output"]>;
};

/**
 * A cursor over time, iterating INTERVALS rather than points.
 *
 * current and next are the half-open range [current, next) — exactly the
 * after/before pair an API query wants. The final interval is clipped to last,
 * so the intervals cover the span with no gap and no overhang.
 *
 * first and last set the direction of travel; counting down is the common case
 * for a backfill (newest first). Direction reverses the ORDER intervals are
 * visited in, never the orientation of one: current is always the earlier bound.
 */
export type OsqDateTimeCursor = {
  count: Scalars["Int"]["output"];
  current: Maybe<Scalars["DateTime"]["output"]>;
  deltaSeconds: Scalars["Int"]["output"];
  description: Maybe<Scalars["String"]["output"]>;
  finished: Scalars["Boolean"]["output"];
  first: Scalars["DateTime"]["output"];
  id: Scalars["OID"]["output"];
  last: Scalars["DateTime"]["output"];
  name: Maybe<Scalars["String"]["output"]>;
  next: Maybe<Scalars["DateTime"]["output"]>;
  position: Scalars["Int"]["output"];
};

/**
 * A failure, stamped with where it happened.
 *
 * cursors is the full tuple at the moment the error was reported, which is what
 * turns a bare failure into one located at 2024, week 31, Tuesday.
 */
export type OsqError = {
  cursors: Array<OsqCursorValue>;
  data: Maybe<Scalars["Unknown"]["output"]>;
  id: Scalars["OID"]["output"];
  message: Scalars["String"]["output"];
};

/** A named scratchpad slot that survives an iteration boundary. */
export type OsqMemoryEntry = {
  key: Scalars["String"]["output"];
  value: Maybe<Scalars["Unknown"]["output"]>;
};

/**
 * A cursor over whole numbers, iterating POINTS.
 *
 * first and last set the direction of travel, so 52 -> 1 counts down. step is
 * therefore a magnitude and must be positive.
 */
export type OsqNumberCursor = {
  count: Scalars["Int"]["output"];
  current: Maybe<Scalars["Int"]["output"]>;
  description: Maybe<Scalars["String"]["output"]>;
  finished: Scalars["Boolean"]["output"];
  first: Scalars["Int"]["output"];
  id: Scalars["OID"]["output"];
  last: Scalars["Int"]["output"];
  name: Maybe<Scalars["String"]["output"]>;
  next: Maybe<Scalars["Int"]["output"]>;
  position: Scalars["Int"]["output"];
  step: Scalars["Int"]["output"];
};

/**
 * Where the queue is in its life.
 * - DRAFT: still being defined; cursors and collections may be changed.
 * - IN_PROGRESS: walking. Only here may values be queued or errors reported.
 * - PAUSED: stopped by hand, resumable exactly where it left off.
 * - FINISHED: the space is walked, or it was terminated early.
 */
export type OsqStatus = "DRAFT" | "FINISHED" | "IN_PROGRESS" | "PAUSED";

export type OriginalSourceQueueState = {
  /**
   * True when the walk is held up by an empty queue rather than finished.
   * Distinguishes having nothing to do yet from having nothing left to do, and
   * tells the ForEvery trigger to stay quiet without ending the run.
   */
  awaitingValues: Scalars["Boolean"]["output"];
  collections: Array<OsqCollection>;
  cursors: Array<OsqCursor>;
  description: Maybe<Scalars["String"]["output"]>;
  /**
   * Every failure, in the order reported. The tuple on each one is what makes
   * a failed slice nameable rather than guessable.
   */
  errors: Array<OsqError>;
  memory: Array<OsqMemoryEntry>;
  /** Fraction of the space walked. A live estimate while a queue is growing. */
  progress: Scalars["Float"]["output"];
  status: OsqStatus;
};

export type PauseInput = {
  _?: InputMaybe<Scalars["Boolean"]["input"]>;
};

/** One cursor's value in the tuple a caller expects the queue to be on. */
export type ProceedExpectedCursorValueInput = {
  cursor: Scalars["OID"]["input"];
  value?: InputMaybe<Scalars["Unknown"]["input"]>;
};

export type ProceedInput = {
  /**
   * The tuple the caller worked on, as the For Every trigger handed it out
   * (its cursors' ids and values). When given, the queue only moves if it is
   * still on exactly this tuple, so two runs that worked on one tuple cannot
   * each move the queue and skip the next one between them.
   */
  expected?: InputMaybe<Array<ProceedExpectedCursorValueInput>>;
};

/** One cursor's value in the tuple a caller expects the queue to be on. */
export type ProceedWithErrorExpectedCursorValueInput = {
  cursor: Scalars["OID"]["input"];
  value?: InputMaybe<Scalars["Unknown"]["input"]>;
};

export type ProceedWithErrorInput = {
  data?: InputMaybe<Scalars["Unknown"]["input"]>;
  /**
   * The tuple the caller worked on, as the For Every trigger handed it out
   * (its cursors' ids and values). When given, the queue only moves if it is
   * still on exactly this tuple, so two runs that worked on one tuple cannot
   * each move the queue and skip the next one between them.
   */
  expected?: InputMaybe<Array<ProceedWithErrorExpectedCursorValueInput>>;
  id: Scalars["OID"]["input"];
  message: Scalars["String"]["input"];
};

export type ReorderCursorsInput = {
  order: Array<Scalars["OID"]["input"]>;
};

export type ReportErrorInput = {
  data?: InputMaybe<Scalars["Unknown"]["input"]>;
  id: Scalars["OID"]["input"];
  message: Scalars["String"]["input"];
};

export type ResetInput = {
  _?: InputMaybe<Scalars["Boolean"]["input"]>;
};

export type SetCursorDescriptionInput = {
  description?: InputMaybe<Scalars["String"]["input"]>;
  id: Scalars["OID"]["input"];
};

export type SetCursorNameInput = {
  id: Scalars["OID"]["input"];
  name?: InputMaybe<Scalars["String"]["input"]>;
};

export type SetDescriptionInput = {
  description?: InputMaybe<Scalars["String"]["input"]>;
};

export type StartInput = {
  _?: InputMaybe<Scalars["Boolean"]["input"]>;
};

export type TerminateInput = {
  _?: InputMaybe<Scalars["Boolean"]["input"]>;
};

export type UnpauseInput = {
  _?: InputMaybe<Scalars["Boolean"]["input"]>;
};

export type UpdateMemoryInput = {
  key: Scalars["String"]["input"];
  value?: InputMaybe<Scalars["Unknown"]["input"]>;
};
