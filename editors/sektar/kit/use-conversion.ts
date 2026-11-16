// Conversion in a component: the client of the switchboard behind a drive, a
// source's jobs (the workflow runs that convert it) while they run, the
// app-wide settings, and the requests a person makes. The host is the
// authority throughout: this reads what it answers and passes its refusals on
// in its own words.
import {
  ambientRenownTokenProvider,
  recordBackendAuthError,
  useSelectedDriveSafe,
} from "@powerhousedao/reactor-browser";
import type { DocumentDriveDocument } from "@powerhousedao/shared/document-drive";
import type { PHDocument } from "document-model";
import type { EmailDocument } from "document-models/email";
import type { FileDocument } from "document-models/file";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  ConversionBatch,
  ConversionCapabilities,
  ConversionJobView,
  ConversionSettings,
  ConversionProfile,
  SourceSelection,
} from "../../../conversions/contracts.js";
import { attachmentRefSchema } from "../../../conversions/contracts.js";
import {
  listConversionRenditions,
  type ConversionRenditionView,
} from "../../../conversions/model-adapter.js";
import {
  forgetBatch,
  rememberBatch,
  rememberedBatches,
} from "./conversion-batches.js";
import { activeJobOf, jobsOf, type Activation } from "./conversion-model.js";
import {
  ConversionApiError,
  createConversionClient,
  isConversionMissing,
  UserFacingError,
  type ConversionClient,
} from "./conversion.js";
import { hasStoredPdf } from "./files.js";
import { attachmentKind } from "./mail.js";
import { parsePublicationRowId } from "../../../conversions/publication-id.js";
import { useConversionPublications } from "./use-conversion-publications.js";
import { useMailIndexMode } from "./mail-index.js";

/* ------------------------------------------------------------------- host */

/** Where conversion is asked for: the host behind a drive, or why there is none. */
export type ConversionHost =
  | { kind: "ready"; client: ConversionClient }
  /** The drive lives in this tab only: there is no host to convert on */
  | { kind: "browser-only" }
  | { kind: "unknown" };

const clients = new Map<string, ConversionClient>();

/** One client per switchboard, as the signed-in user. */
function clientFor(base: string): ConversionClient {
  const known = clients.get(base);
  if (known) return known;
  const client = createConversionClient({
    base,
    fetch: (input, init) => fetch(input, init),
    token: ambientRenownTokenProvider,
    // Connect turns a recorded refusal into its sign-in gate.
    onUnauthenticated: (error) =>
      recordBackendAuthError(
        Object.assign(new Error(error.message), { response: { status: 401 } }),
        "switchboard",
      ),
  });
  clients.set(base, client);
  return client;
}

/** The conversion service of the switchboard that serves `drive`. */
export function useConversionHost(
  drive: DocumentDriveDocument | undefined,
): ConversionHost {
  const mode = useMailIndexMode(drive);
  const base = mode.kind === "remote" ? mode.base : null;
  return useMemo<ConversionHost>(() => {
    if (base) return { kind: "ready", client: clientFor(base) };
    return mode.kind === "local"
      ? { kind: "browser-only" }
      : { kind: "unknown" };
  }, [base, mode.kind]);
}

/* ---------------------------------------------------------------- loading */

/** Something read from the host: on its way, here, or refused. */
export type Loaded<T> =
  | { status: "loading" }
  | { status: "ready"; value: T }
  | { status: "failed"; error: unknown };

/**
 * Whether the host refused on purpose, with a reason of its own to pass on:
 * no conversion service at all, or a refusal it gave a code. A host that
 * cannot set conversion up for a source answers so, and its words are the
 * ones to show.
 */
export function isHostRefusal(error: unknown): error is ConversionApiError {
  return (
    error instanceof ConversionApiError &&
    error.status !== 0 &&
    error.status !== 401 &&
    (error.status === 404 || error.code !== null)
  );
}

export const SOMETHING_WENT_WRONG = "Something went wrong. Try again.";

/**
 * What an error says, for a person: the message of an error Sektar wrote for
 * people (a UserFacingError, such as a host refusal), and otherwise a plain
 * sentence. A foreign error's own text is logged, never shown.
 */
export function messageOf(
  error: unknown,
  fallback: string = SOMETHING_WENT_WRONG,
): string {
  if (error instanceof UserFacingError) return error.message;
  console.warn("[conversion]", error);
  return fallback;
}

/**
 * Reads once per `read` (memoize it), and again on `reload`. Null reads
 * nothing and stays loading: there is no host to ask yet.
 */
function useLoad<T>(
  read: ((signal: AbortSignal) => Promise<T>) | null,
): [Loaded<T>, () => void] {
  type Read = typeof read;
  // Held with the read it answers: another host's answer is never shown as this one's.
  const [held, setHeld] = useState<{ read: Read; state: Loaded<T> }>({
    read: null,
    state: { status: "loading" },
  });
  const [turn, setTurn] = useState(0);
  useEffect(() => {
    if (!read) return;
    const abort = new AbortController();
    const settle = (state: Loaded<T>) => {
      if (!abort.signal.aborted) setHeld({ read, state });
    };
    read(abort.signal).then(
      (value) => settle({ status: "ready", value }),
      (error: unknown) => settle({ status: "failed", error }),
    );
    return () => abort.abort();
  }, [read, turn]);
  const reload = useCallback(() => setTurn((n) => n + 1), []);
  return [held.read === read ? held.state : { status: "loading" }, reload];
}

/** What the host can run. Read when `wanted` (a dialog that is open, a settings page). */
export function useCapabilities(
  client: ConversionClient | null,
  wanted = true,
): Loaded<ConversionCapabilities> {
  const read = useMemo(
    () =>
      client && wanted
        ? (signal: AbortSignal) => client.capabilities(signal)
        : null,
    [client, wanted],
  );
  return useLoad(read)[0];
}

/** The app-wide settings, refreshed for mounted consumers after a save. */
export function useConversionSettings(
  client: ConversionClient | null,
): [Loaded<ConversionSettings>, () => void] {
  const read = useMemo(
    () => (client ? (signal: AbortSignal) => client.settings(signal) : null),
    [client],
  );
  const [loaded, reload] = useLoad(read);
  useEffect(() => client?.subscribeSettings(reload), [client, reload]);
  useEffect(() => {
    window.addEventListener("focus", reload);
    return () => window.removeEventListener("focus", reload);
  }, [reload]);
  return [loaded, reload];
}

/* ------------------------------------------------------------------- jobs */

/** How often a source is asked about while one of its jobs is not finished. */
const POLL_MS = 2_000;
const canRetryRead = (error: unknown) =>
  !(error instanceof ConversionApiError) ||
  error.status === 0 ||
  error.status >= 500 ||
  error.status === 429;

export interface SourceJobs {
  /** The source's jobs, newest first */
  jobs: ConversionJobView[];
  historyJobs: ConversionJobView[];
  /** Why the last read failed; the jobs shown are the last ones read */
  error: string | null;
  /** Shows a job the host just answered with, and reads again soon */
  put: (job: ConversionJobView) => void;
}

/** One name per source at one version of its PDF. */
const selectionKey = (source: SourceSelection, host: string | null) =>
  JSON.stringify([
    host,
    source.kind,
    source.documentId,
    source.kind === "mail" ? source.attachmentId : null,
    source.expectedRef ?? null,
  ]);

export function conversionContextKey(
  conversion: Pick<SourceConversion, "host" | "source">,
): string {
  return selectionKey(
    conversion.source,
    conversion.host.kind === "ready" ? conversion.host.client.host : null,
  );
}

/**
 * A source's jobs as the host has them: read when the source or its document
 * changes (`revision`), and every two seconds while one is not finished or
 * while `watching` (a request the host has not answered yet may have started
 * one). `source` must be stable (memoize it).
 */
export function useSourceJobs(
  client: ConversionClient | null,
  source: SourceSelection | null,
  revision: string | undefined,
  watching = false,
): SourceJobs {
  const [held, setHeld] = useState<{
    key: string;
    jobs: ConversionJobView[];
    error: string | null;
  }>({ key: "", jobs: [], error: null });
  const [turn, setTurn] = useState(0);
  const key = source ? selectionKey(source, client?.host ?? null) : "";
  const latestKey = useRef(key);
  latestKey.current = key;
  const current = held.key === key ? held : { jobs: [], error: null };
  const selected = source ? jobsOf(current.jobs, source) : [];
  useEffect(() => {
    if (!client || !source) return;
    const refresh = () => setTurn((n) => n + 1);
    window.addEventListener("focus", refresh);
    window.addEventListener("online", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("online", refresh);
    };
  }, [client, source]);

  useEffect(() => {
    if (!client || !source) return;
    const abort = new AbortController();
    let timer: number | undefined;
    const again = (after: number) => {
      timer = window.setTimeout(() => setTurn((n) => n + 1), after);
    };
    client.jobs(source.documentId, abort.signal).then(
      (all) => {
        if (abort.signal.aborted) return;
        const jobs = jobsOf(all, source);
        setHeld({
          key,
          jobs: jobsOf(all, { ...source, expectedRef: undefined }),
          error: null,
        });
        if (watching || activeJobOf(jobs)) again(POLL_MS);
      },
      (error: unknown) => {
        if (abort.signal.aborted) return;
        setHeld((prev) => ({
          key,
          jobs: prev.key === key ? prev.jobs : [],
          error: messageOf(
            error,
            "Sektar couldn't check this PDF's conversions. Try again in a moment.",
          ),
        }));
        if (canRetryRead(error)) again(POLL_MS * 3);
      },
    );
    return () => {
      abort.abort();
      window.clearTimeout(timer);
    };
  }, [client, source, key, revision, turn, watching]);

  const put = useCallback(
    (job: ConversionJobView) => {
      if (latestKey.current !== key) return;
      setHeld((prev) => ({
        key,
        error: null,
        jobs: [
          job,
          ...(prev.key === key ? prev.jobs : []).filter((j) => j.id !== job.id),
        ],
      }));
      setTurn((n) => n + 1);
    },
    [key],
  );

  return {
    jobs: selected,
    historyJobs: current.jobs,
    error: current.error,
    put,
  };
}

/* ----------------------------------------------------------------- source */

/** The global conversion setting read by this surface. */
export type SourceActivation =
  /** Stored app settings, including the initial default (revision 0) */
  | { kind: "known"; activation: Activation; settings: ConversionSettings }
  /** The settings are not read yet, or could not be */
  | { kind: "unknown" };

/** Whether a conversion can be asked for now, and if not, why, in words. */
export type ConversionAvailability =
  | { kind: "ready" }
  | { kind: "blocked"; reason: string };

/** Everything a surface needs to show and drive one source's conversion. */
export interface SourceConversion {
  host: ConversionHost;
  /** Off, a host without the service, or a drive without a host block a request before it is made */
  availability: ConversionAvailability;
  source: SourceSelection;
  /** The source's finished conversions, oldest first. Pending output is never listed. */
  renditions: ConversionRenditionView[];
  renditionsPending: boolean;
  /** The one to read: the newest complete one of the current source, else its newest partial */
  current: ConversionRenditionView | undefined;
  /** The source's jobs, newest first */
  jobs: ConversionJobView[];
  historyJobs: ConversionJobView[];
  /** The job that is not finished yet */
  active: ConversionJobView | undefined;
  jobsError: string | null;
  /**
   * A request made here that the host has not answered yet. The host may
   * answer only when the run it starts ends; the source's jobs are read
   * meanwhile, so that run shows as `active` once the host lists it.
   */
  starting: boolean;
  /**
   * Why the last request made here was refused or failed, until the source
   * gets a newer job. It says nothing about `active`: a request can fail
   * after its run was started.
   */
  startError: string | null;
  activation: SourceActivation;
  /**
   * Asks the host to convert the source: with its settings, or with `profile`
   * for this request. `again` asks for a new result where one exists;
   * `requestId` names that request, the same on a retry of it. Settles when
   * the host answers, which is not when the work begins.
   */
  request: (input: {
    profile: ConversionProfile | undefined;
    again: boolean;
    requestId: string;
  }) => Promise<ConversionJobView>;
  /** Cancels a job the host says can be cancelled; the host refuses any other */
  cancel: (jobId: string) => Promise<void>;
}

/**
 * One source's conversion: its finished results from its own document
 * (through the model adapter, which hides pending output and picks the
 * current one), its jobs and the global settings from the host behind its drive.
 * `source` must be stable (memoize it).
 */
export function useSourceConversion(input: {
  /** The drive the document is in: its switchboard is the host asked */
  drive: DocumentDriveDocument | undefined;
  document: PHDocument;
  source: SourceSelection;
  /**
   * Whether the source has anything to do with conversion: a stored PDF, or
   * Markdown made from one. The host is not asked about any other source.
   */
  relevant: boolean;
}): SourceConversion {
  const { drive, document, source, relevant } = input;
  const host = useConversionHost(drive);
  const client = relevant && host.kind === "ready" ? host.client : null;
  const publications = useConversionPublications(
    document,
    host.kind === "ready" ? host.client.host : host.kind,
  );

  const renditions = useMemo(
    () => listConversionRenditions(document, source, publications.inspections),
    [document, source, publications.inspections],
  );
  const key = selectionKey(source, client?.host ?? null);
  const [asked, setAsked] = useState<{
    key: string;
    requestId: string;
    pending: boolean;
    error: string | null;
    /** The source's newest job when the request failed */
    newest: string | undefined;
  } | null>(null);
  const ask = asked?.key === key ? asked : null;
  const starting = ask?.pending ?? false;
  const {
    jobs,
    historyJobs,
    error: jobsError,
    put,
  } = useSourceJobs(
    client,
    source,
    document.header.lastModifiedAtUtcIso,
    starting,
  );
  const newest = useRef<string | undefined>(undefined);
  newest.current = jobs.at(0)?.id;
  const [settings] = useConversionSettings(client);
  const activation = useMemo<SourceActivation>(
    () =>
      settings.status === "ready"
        ? {
            kind: "known",
            activation: settings.value.activation,
            settings: settings.value,
          }
        : { kind: "unknown" },
    [settings],
  );

  const availability = useMemo<ConversionAvailability>(() => {
    if (!source.expectedRef)
      return {
        kind: "blocked",
        reason:
          "This PDF does not have a supported stored attachment reference.",
      };
    if (host.kind === "browser-only") {
      return {
        kind: "blocked",
        reason:
          "Conversion runs on a Sektar host. This drive lives in this browser only.",
      };
    }
    if (host.kind === "unknown") {
      return {
        kind: "blocked",
        reason: "No Sektar host is connected for this drive.",
      };
    }
    if (settings.status === "failed" && isHostRefusal(settings.error)) {
      return { kind: "blocked", reason: messageOf(settings.error) };
    }
    if (activation.kind === "known" && activation.activation === "off") {
      return { kind: "blocked", reason: "Conversion is off in Settings." };
    }
    return { kind: "ready" };
  }, [host.kind, settings, activation, source.expectedRef]);

  const request = useCallback<SourceConversion["request"]>(
    async ({ profile, again, requestId }) => {
      if (!client) {
        throw new UserFacingError(
          "No Sektar host is connected for this drive, so it can't convert.",
        );
      }
      const settle = (error: string | null) =>
        setAsked((held) =>
          held?.key === key && held.requestId === requestId
            ? { key, requestId, pending: false, error, newest: newest.current }
            : held,
        );
      setAsked({
        key,
        requestId,
        pending: true,
        error: null,
        newest: undefined,
      });
      try {
        const job = await client.request({
          source,
          ...(profile ? { profile } : {}),
          intent: again
            ? { kind: "regenerate", requestId }
            : { kind: "ensure" },
        });
        settle(null);
        put(job);
        return job;
      } catch (error) {
        settle(messageOf(error, "The conversion didn't start. Try again."));
        throw error;
      }
    },
    [client, source, key, put],
  );

  const cancel = useCallback(
    async (jobId: string) => {
      if (client) put(await client.cancel(jobId));
    },
    [client, put],
  );

  return {
    host,
    availability,
    source,
    renditions,
    renditionsPending: publications.pending,
    current: renditions.find((rendition) => rendition.current),
    jobs,
    historyJobs,
    active: activeJobOf(jobs),
    jobsError,
    starting,
    startError:
      ask && !ask.pending && ask.newest === jobs.at(0)?.id ? ask.error : null,
    activation,
    request,
    cancel,
  };
}

/**
 * Shows a result when a conversion seen running here saves it: `show` gets
 * the new current rendition's id, once. A result that was there when the
 * view opened, or an attempt that left the current one in place, shows
 * nothing.
 */
export function useShowFinished(
  conversion: SourceConversion,
  show: (renditionId: string) => void,
): void {
  const latestShow = useRef(show);
  latestShow.current = show;
  const key = conversionContextKey(conversion);
  const currentId = conversion.current?.id;
  const observed = useRef<{
    key: string;
    runs: Map<string, string | undefined>;
    request: { before: Set<string>; currentId: string | undefined } | null;
  }>({ key, runs: new Map(), request: null });
  if (observed.current.key !== key)
    observed.current = {
      key,
      runs: new Map(),
      request: null,
    };
  const watching = observed.current;
  if (conversion.active && !watching.runs.has(conversion.active.id))
    watching.runs.set(conversion.active.id, currentId);
  if (conversion.starting && !watching.request)
    watching.request = {
      before: new Set(conversion.jobs.map((job) => job.id)),
      currentId,
    };
  if (watching.request) {
    for (const job of conversion.jobs) {
      if (!watching.request.before.has(job.id) && !watching.runs.has(job.id))
        watching.runs.set(job.id, watching.request.currentId);
    }
    if (!conversion.starting) watching.request = null;
  }
  const finished = conversion.jobs.find(
    (job) =>
      (job.status === "complete" || job.status === "partial") &&
      watching.runs.has(job.id) &&
      job.result.renditionId === currentId &&
      watching.runs.get(job.id) !== currentId,
  );
  useEffect(() => {
    if (currentId && finished) {
      watching.runs.set(finished.id, currentId);
      latestShow.current(currentId);
    }
  }, [currentId, finished, watching]);
}

/** The conversion of a File's source, in the drive that is open. */
export function useFileConversion(doc: FileDocument): SourceConversion {
  const [drive] = useSelectedDriveSafe();
  const documentId = doc.header.id;
  const expectedRef = attachmentRefSchema.safeParse(
    doc.state.global.source?.kind === "ATTACHMENT"
      ? doc.state.global.source.ref
      : null,
  ).data;
  const source = useMemo<SourceSelection>(
    () => ({ kind: "file", documentId, expectedRef }),
    [documentId, expectedRef],
  );
  const relevant =
    hasStoredPdf(doc) ||
    doc.state.global.renditions.some((rendition) =>
      Boolean(parsePublicationRowId(rendition.id)),
    );
  return useSourceConversion({ drive, document: doc, source, relevant });
}

/** The conversion of one attachment of an email, in the drive that is open. */
export function useMailConversion(
  doc: EmailDocument,
  attachmentId: string,
): SourceConversion {
  const [drive] = useSelectedDriveSafe();
  const documentId = doc.header.id;
  const attachment = doc.state.global.attachments.find(
    (candidate) => candidate.id === attachmentId,
  );
  const expectedRef = attachmentRefSchema.safeParse(attachment?.ref).data;
  const source = useMemo<SourceSelection>(
    () => ({ kind: "mail", documentId, attachmentId, expectedRef }),
    [documentId, attachmentId, expectedRef],
  );
  const relevant =
    attachment !== undefined && attachmentKind(attachment) === "pdf";
  return useSourceConversion({ drive, document: doc, source, relevant });
}

/* ---------------------------------------------------------------- batches */

/** How often a running batch is asked about. */
const BATCH_POLL_MS = 3_000;

export interface StartedBatches {
  /**
   * The batches started from this browser that are running, and those that
   * ended while this was open; newest first.
   */
  batches: ConversionBatch[];
  /** Follows a batch the host just started. */
  follow: (batch: ConversionBatch) => void;
  /** Asks the host to cancel a batch; rejects with the host's reason. */
  cancel: (id: string) => Promise<void>;
}

/**
 * The batches a person started on this host, so one can be followed and
 * cancelled after its dialog or the page was closed. A running batch is
 * asked about every three seconds until its last conversion ends.
 */
export function useStartedBatches(client: ConversionClient): StartedBatches {
  const [held, setHeld] = useState<{
    host: string;
    batches: ConversionBatch[];
  } | null>(null);
  const latestHost = useRef(client.host);
  latestHost.current = client.host;
  const batches = held?.host === client.host ? held.batches : [];
  const put = useCallback(
    (batch: ConversionBatch) => {
      if (latestHost.current !== client.host) return;
      if (batch.status !== "running") forgetBatch(client.host, batch.id);
      setHeld((previous) => {
        const current = previous?.host === client.host ? previous.batches : [];
        return {
          host: client.host,
          batches: current.some((each) => each.id === batch.id)
            ? current.map((each) => (each.id === batch.id ? batch : each))
            : [batch, ...current],
        };
      });
    },
    [client],
  );

  // Those started here before that are still running.
  useEffect(() => {
    const abort = new AbortController();
    const pending = new Set(rememberedBatches(client.host));
    const active = () => !abort.signal.aborted;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let reading = false;
    const read = async () => {
      if (reading || !active()) return;
      clearTimeout(timer);
      reading = true;
      const retries = await Promise.all(
        [...pending].map(async (id) => {
          try {
            const batch = await client.batch(id, abort.signal);
            if (!active()) return false;
            pending.delete(id);
            if (batch.status === "running") put(batch);
            else forgetBatch(client.host, id);
            return false;
          } catch (error) {
            if (active() && isConversionMissing(error)) {
              pending.delete(id);
              forgetBatch(client.host, id);
            }
            return canRetryRead(error);
          }
        }),
      );
      reading = false;
      if (active() && retries.some(Boolean) && pending.size > 0)
        timer = setTimeout(() => void read(), BATCH_POLL_MS);
    };
    const refresh = () => void read();
    refresh();
    window.addEventListener("focus", refresh);
    window.addEventListener("online", refresh);
    return () => {
      abort.abort();
      clearTimeout(timer);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("online", refresh);
    };
  }, [client, put]);

  const running = batches
    .filter((batch) => batch.status === "running")
    .map((batch) => batch.id)
    .join("\n");
  useEffect(() => {
    if (!running) return;
    const abort = new AbortController();
    const timer = setInterval(() => {
      for (const id of running.split("\n")) {
        client.batch(id, abort.signal).then(
          (batch) => {
            if (!abort.signal.aborted) put(batch);
          },
          // Asked again at the next turn.
          () => undefined,
        );
      }
    }, BATCH_POLL_MS);
    return () => {
      abort.abort();
      clearInterval(timer);
    };
  }, [client, running, put]);

  const follow = useCallback(
    (batch: ConversionBatch) => {
      if (batch.status === "running") rememberBatch(client.host, batch.id);
      put(batch);
    },
    [client, put],
  );
  const cancel = useCallback(
    async (id: string) => put(await client.cancelBatch(id)),
    [client, put],
  );
  return { batches, follow, cancel };
}
