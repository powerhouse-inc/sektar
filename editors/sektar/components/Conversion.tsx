import { canonicalJson } from "../../../conversions/canonical-json.js";
import { useScannerReadiness } from "../kit/use-scanner.js";
// Converting a PDF to Markdown on the File and Mail surfaces: asking for it
// (at once with the app's settings, with another method, or through the
// options dialog), where a conversion stands, and the Markdown it produced
// with its details. The host decides everything; this shows what it answers.
// A conversion is a workflow run on the host: it goes on whatever is open
// here, and it can be cancelled only while the host says so.
import {
  useAttachmentPreview,
  useAttachments,
} from "@powerhousedao/reactor-browser";
import { generateId } from "document-model";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import {
  defaultConversionProfile,
  type ConversionCapabilities,
  type ConversionJobView,
  type ConversionProfile,
} from "../../../conversions/contracts.js";
import type { ConversionRenditionView } from "../../../conversions/model-adapter.js";
import {
  localOcrOf,
  methodOf,
  oneOffProfile,
  READING_METHODS,
  recognitionOf,
  usesAi,
  type ReadingMethod,
} from "../../../pieces/docture/lib/profile.js";
import {
  blockersOf,
  countsOf,
  coverageOf,
  coverageText,
  downloadName,
  fullWhen,
  isCancellable,
  METHOD_HELP,
  METHOD_LABEL,
  methodAvailable,
  methodOfPlan,
  missingPageReason,
  pagesReadText,
  progressText,
  provenanceDetail,
  readingSummary,
  profileOfPlan,
  scanningProfile,
  shortWhen,
  startedAgo,
  usageText,
  warningLines,
  warningNote,
} from "../kit/conversion-model.js";
import { useNow } from "../kit/format.js";
import { Menu, type MenuItem } from "../kit/menu.js";
import { decodeText } from "../kit/text-decode.js";
import {
  conversionContextKey,
  messageOf,
  useCapabilities,
  type SourceConversion,
} from "../kit/use-conversion.js";
import {
  Alert,
  Badge,
  Button,
  cx,
  Dl,
  Icon,
  Modal,
  Skeleton,
  Toast,
} from "../kit/ui.js";
import { AppScanner, BlockerList } from "./ConversionFields.js";
import { Markdown } from "./Markdown.js";

/* ------------------------------------------------------------- the ask */

/**
 * A saved result or an attempt needing attention requires an explicit new attempt.
 */
export function convertAction(conversion: SourceConversion): {
  label: string;
  again: boolean;
  /** Whether the PDF has current Markdown, which is what the words say */
  converted: boolean;
  disabled: boolean;
  title: string | undefined;
} {
  const converted = conversion.renditions.some((rendition) => !rendition.stale);
  const again =
    converted ||
    conversion.renditionsPending ||
    conversion.jobs[0]?.status === "needs-attention";
  const blocked =
    conversion.availability.kind === "blocked"
      ? conversion.availability.reason
      : conversion.active
        ? "A conversion of this PDF is running."
        : conversion.starting
          ? "A conversion of this PDF is being started."
          : undefined;
  return {
    again,
    converted,
    label: converted
      ? "Convert again…"
      : again
        ? "Convert to Markdown…"
        : "Convert to Markdown",
    disabled: blocked !== undefined,
    title: blocked,
  };
}

interface Start {
  /** With the app's settings when there is no profile */
  profile?: ConversionProfile;
  /** Defaults to whether the source already has a result */
  again?: boolean;
  /** The same on a retry of one request; a new one by default */
  requestId?: string;
}

/**
 * Asks for a conversion from here: `pending` from the ask until the host
 * accepts it, which is when it answers or when its run shows on the source,
 * whichever comes first (the host may answer only when the run ends).
 * `onAccepted` runs once per ask.
 */
function useStartConversion(
  conversion: SourceConversion,
  onAccepted?: () => void,
): {
  start: (input?: Start) => void;
  pending: boolean;
  error: string | null;
} {
  const key = conversionContextKey(conversion);
  const [held, setHeld] = useState<{
    key: string;
    pending: boolean;
    error: string | null;
  } | null>(null);
  const waiting = useRef<{ key: string; token: symbol } | null>(null);
  const latestKey = useRef(key);
  if (latestKey.current !== key) {
    latestKey.current = key;
    waiting.current = null;
  }
  const accepted = useRef(onAccepted);
  accepted.current = onAccepted;
  useEffect(
    () => () => {
      waiting.current = null;
    },
    [],
  );
  const accept = useCallback(
    (token: symbol) => {
      if (latestKey.current !== key || waiting.current?.token !== token) return;
      waiting.current = null;
      setHeld({ key, pending: false, error: null });
      accepted.current?.();
    },
    [key],
  );
  const running = conversion.active !== undefined;
  useEffect(() => {
    if (running && waiting.current?.key === key) accept(waiting.current.token);
  }, [running, accept, key]);

  const { request } = conversion;
  const { again } = convertAction(conversion);
  const start = useCallback(
    (input: Start = {}) => {
      const token = Symbol();
      waiting.current = { key, token };
      setHeld({ key, pending: true, error: null });
      request({
        profile: input.profile,
        again: input.again ?? again,
        requestId: input.requestId ?? generateId(),
      }).then(
        () => accept(token),
        (refusal: unknown) => {
          if (latestKey.current !== key || waiting.current?.token !== token)
            return;
          waiting.current = null;
          setHeld({
            key,
            pending: false,
            error: messageOf(
              refusal,
              "The conversion didn't start. Try again.",
            ),
          });
        },
      );
    },
    [request, again, accept, key],
  );
  const current = held?.key === key ? held : null;
  return {
    start,
    pending: current?.pending ?? false,
    error: current?.error ?? null,
  };
}

/** The toast a surface shows for a few seconds once a conversion it asked for is accepted. */
export function useStartedToast(): [ReactNode, () => void] {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (shown === 0) return;
    const timer = window.setTimeout(() => setShown(0), 4000);
    return () => window.clearTimeout(timer);
  }, [shown]);
  const flash = useCallback(() => setShown((n) => n + 1), []);
  const toast =
    shown > 0 ? <Toast>Converting. You can keep working.</Toast> : null;
  return [toast, flash];
}

/** The one-off methods the split button offers, by what they do. */
const QUICK_METHODS: readonly { method: ReadingMethod; help: string }[] = [
  { method: "digital", help: "Fastest. Skips scanned pages." },
  { method: "ocr", help: "Slower. For scans or garbled text." },
];

const NO_SCANNER =
  "No scanner is set in Settings. Choose one in Settings → Document conversion.";
const SCANNER_MISSING =
  "The scanner in Settings isn't downloaded yet. Download it in Settings → Document conversion.";

/**
 * Why `method` can't read this PDF with the app's profile `app`, in the
 * host's words; null when it can, or before the host said.
 */
function unavailableReason(
  method: ReadingMethod,
  app: ConversionProfile,
  capabilities: ConversionCapabilities | null,
  scannerReady: boolean | undefined,
): string | null {
  const profile = oneOffProfile(app, method);
  if (!profile) return NO_SCANNER;
  if (scannerReady === false && recognitionOf(profile)?.kind === "ocr")
    return SCANNER_MISSING;
  if (!capabilities || methodAvailable(method, capabilities)) return null;
  const blocker = blockersOf(profile, capabilities).at(0);
  return blocker
    ? `${blocker.reason} ${blocker.setup}`
    : "This host can't run it.";
}

/**
 * Convert to Markdown: the button converts at once with the app's settings;
 * its arrow offers Text only and Scan every page for this once, and the
 * dialog for other choices. Every choice uses the scanner from Settings;
 * while that scanner isn't downloaded, the button opens the dialog, which
 * says so.
 */
export function ConvertButton({
  conversion,
  onChoose,
  onStarted,
}: {
  conversion: SourceConversion;
  /** Opens the options dialog */
  onChoose: () => void;
  /** The host accepted a request made here */
  onStarted?: () => void;
}) {
  const convert = convertAction(conversion);
  const { start, pending } = useStartConversion(conversion, onStarted);
  const [asked, setAsked] = useState(false);
  const client =
    conversion.host.kind === "ready" ? conversion.host.client : null;
  const loaded = useCapabilities(client, asked);
  const capabilities = loaded.status === "ready" ? loaded.value : null;
  const app =
    conversion.activation.kind === "known"
      ? conversion.activation.settings.profile
      : null;
  const scanner = useScannerReadiness(client, app);
  const ready = scanner.value?.ready;
  // A failed check leaves the decision to the host.
  const checking =
    app !== null &&
    recognitionOf(app)?.kind === "ocr" &&
    scanner.value === null &&
    scanner.error === null;
  const busy = pending || conversion.starting;

  const items: MenuItem[] = [
    ...QUICK_METHODS.map(({ method, help }): MenuItem => {
      const reason = app
        ? unavailableReason(method, app, capabilities, ready)
        : "Waiting for the app's reading settings.";
      const profile = app && oneOffProfile(app, method);
      return {
        label: (
          <span className="sk-convert-option">
            <span>{METHOD_LABEL[method]}</span>
            <span className="sk-convert-option__help">{reason ?? help}</span>
          </span>
        ),
        disabled: reason !== null || !profile,
        onSelect: () => profile && start({ profile }),
      };
    }),
    { label: "Choose options…", divider: true, onSelect: onChoose },
  ];

  return (
    <span className="sk-split-button">
      <Button
        size="sm"
        variant="secondary"
        icon={busy ? undefined : "sync"}
        disabled={convert.disabled || busy || app === null || checking}
        title={convert.title}
        onClick={() => (ready === false ? onChoose() : start())}
      >
        {busy && <span className="sk-spinner" aria-hidden="true" />}
        {ready === false && !convert.again
          ? `${convert.label}…`
          : convert.label}
      </Button>
      <Menu
        label="More ways to convert"
        align="end"
        items={items}
        trigger={(open, toggle) => (
          <Button
            size="sm"
            variant="secondary"
            iconOnly
            icon="chevron-down"
            aria-label="More ways to convert"
            aria-haspopup="menu"
            aria-expanded={open}
            disabled={convert.disabled || busy}
            onClick={() => {
              setAsked(true);
              toggle();
            }}
          />
        )}
      />
    </span>
  );
}

/** Whether an attempt that needs attention may already have cost a model charge. */
function mayHaveCharged(job: ConversionJobView | undefined): boolean {
  return (
    job?.status === "needs-attention" &&
    (job.error.code.startsWith("ai-") ||
      (["publication-failed", "cleanup-failed"].includes(job.error.code) &&
        usesAi(job.profile)))
  );
}

/**
 * The request with another method: one card per method the host offers (the
 * app default marked), always with the scanner from Settings. With several
 * Tesseract languages in Settings, this PDF may read fewer of them. Nothing
 * here downloads or changes Settings; a scanner Settings hasn't prepared is
 * named, with where to fix it, and only Text only stays open.
 * The dialog closes once the host accepts the request.
 */
export function ConvertDialog({
  conversion,
  fileName,
  onClose,
  onStarted,
}: {
  conversion: SourceConversion;
  fileName: string;
  onClose: () => void;
  /** The host accepted the request; the dialog closes after this */
  onStarted?: () => void;
}) {
  const client =
    conversion.host.kind === "ready" ? conversion.host.client : null;
  const loaded = useCapabilities(client);
  const capabilities = loaded.status === "ready" ? loaded.value : null;
  const settings =
    conversion.activation.kind === "known"
      ? conversion.activation.settings
      : null;
  const app = settings?.profile ?? defaultConversionProfile;
  const latest = conversion.jobs.at(0);
  const retried = latest?.status === "needs-attention" ? latest.profile : null;
  /** Null is the app's method, and the app's languages. */
  const [method, setMethod] = useState<ReadingMethod | null>(
    () => retried && methodOf(retried),
  );
  const [languages, setLanguages] = useState<string[] | null>(
    () => (retried && localOcrOf(retried)?.languages) ?? null,
  );
  const chosen =
    oneOffProfile(app, method ?? methodOf(app), languages ?? undefined) ?? app;
  // A retry reads the pages its attempt asked for.
  const profile = retried ? { ...chosen, pages: retried.pages } : chosen;
  const selected = methodOf(profile);
  const custom = canonicalJson(profile) !== canonicalJson(app);
  // One name for this request, however often its button is pressed.
  const [requestId] = useState(generateId);
  const { start, pending, error } = useStartConversion(conversion, () => {
    onStarted?.();
    onClose();
  });
  const { again, converted } = convertAction(conversion);
  const name = useId();
  const scanner = useScannerReadiness(client, settings ? app : null);
  const scans = recognitionOf(profile)?.kind === "ocr";
  const scannerMissing = scans && scanner.value?.ready === false;
  const checking = scans && scanner.value === null && scanner.error === null;

  const blockers = capabilities ? blockersOf(profile, capabilities) : [];
  const blocked =
    conversion.availability.kind === "blocked"
      ? conversion.availability.reason
      : null;
  const under = conversion.active !== undefined;
  const aiOffered =
    capabilities?.ai.availability.status === "available" || selected === "ai";
  const methods = READING_METHODS.filter(
    (method) => method !== "ai" || aiOffered,
  );

  return createPortal(
    <div className="sk-app" style={{ display: "contents" }}>
      <Modal
        title={converted ? "Convert again" : "Convert to Markdown"}
        onClose={onClose}
        footer={
          <>
            <span className="sk-grow" />
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={
                pending ||
                checking ||
                scannerMissing ||
                under ||
                blocked !== null ||
                blockers.length > 0 ||
                settings === null
              }
              onClick={() =>
                start({
                  profile: custom ? profile : undefined,
                  again,
                  requestId,
                })
              }
            >
              {pending && <span className="sk-spinner" aria-hidden="true" />}
              Convert
            </Button>
          </>
        }
      >
        <div className="sk-stack sk-stack--4 sk-convert-dialog">
          <p className="sk-small sk-text-secondary">
            Makes a Markdown copy of {fileName}. The PDF isn't changed. The
            method you pick applies only to this conversion; your settings
            stay the same.
          </p>
          <div
            className="sk-convert-choices"
            role="radiogroup"
            aria-label="Method"
          >
            {methods.map((each) => {
              const reason =
                settings === null
                  ? "Waiting for the app's reading settings."
                  : each === selected
                    ? null
                    : unavailableReason(
                        each,
                        app,
                        capabilities,
                        scanner.value?.ready,
                      );
              return (
                <label
                  key={each}
                  className={cx(
                    "sk-convert-choice",
                    each === selected && "is-selected",
                    reason !== null && "is-disabled",
                  )}
                >
                  <input
                    type="radio"
                    name={name}
                    value={each}
                    checked={each === selected}
                    disabled={reason !== null}
                    onChange={() => setMethod(each)}
                  />
                  <span className="sk-convert-choice__body">
                    <span className="sk-convert-choice__title">
                      {METHOD_LABEL[each]}
                      {settings && each === methodOf(settings.profile) && (
                        <Badge tone="mint" pill>
                          App default
                        </Badge>
                      )}
                    </span>
                    <span className="sk-convert-choice__help">
                      {reason ?? METHOD_HELP[each]}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
          {settings && recognitionOf(profile) && (
            <AppScanner
              app={app}
              profile={profile}
              onLanguages={setLanguages}
              capabilities={capabilities}
            />
          )}
          {scannerMissing && (
            <p className="sk-small sk-text-danger" role="alert">
              {SCANNER_MISSING} Text only works without it.
            </p>
          )}
          {scanner.error && (
            <p className="sk-small sk-text-secondary" role="status">
              {scanner.error}
            </p>
          )}
          {mayHaveCharged(latest) && (
            <p className="sk-small sk-text-secondary">
              A model request may already have been charged. Converting again
              can add another charge.
            </p>
          )}
          {usesAi(profile) && (
            <p className="sk-small sk-text-secondary">
              Uses the integrated model
              {settings
                ? `, up to ${settings.limits.maxAiPages.toLocaleString("en")} AI pages for this PDF`
                : ""}
              . Cancelling can't undo a request already sent.
            </p>
          )}
          {conversion.renditionsPending && (
            <p className="sk-small sk-text-secondary">
              Earlier conversion files may still arrive.
            </p>
          )}
          <BlockerList blockers={blockers} />
          {loaded.status === "failed" && (
            <p className="sk-small sk-text-danger">
              {messageOf(
                loaded.error,
                "Sektar couldn't check which reading methods it can use. Try again in a moment.",
              )}
            </p>
          )}
          {blocked && <p className="sk-small sk-text-danger">{blocked}</p>}
          {error && (
            <p className="sk-small sk-text-danger" role="alert">
              {error}
            </p>
          )}
          {!pending && under && (
            <p className="sk-small" role="status">
              A conversion of this PDF is running anyway. It shows with the PDF.
            </p>
          )}
        </div>
      </Modal>
    </div>,
    document.body,
  );
}

/* ----------------------------------------------------------- the status */

/** What an attempt that produced no current result says for itself. */
function attemptText(job: ConversionJobView): string | null {
  switch (job.status) {
    case "failed":
      return job.error.message;
    case "needs-attention":
      return `${job.error.message} Nothing is tried again on its own.`;
    case "cancelled":
      return job.reason || "The conversion was cancelled.";
    case "partial": {
      const unread = coverageOf(job.result.pages).unread;
      return `The latest attempt was partial (${coverageText(countsOf(job.result.pages), unread)}).`;
    }
    case "complete":
    case "waiting-for-bytes":
    case "queued":
    case "running":
    case "publishing":
      return null;
    default: {
      const _exhaustive: never = job;
      return _exhaustive;
    }
  }
}

/**
 * What needs saying about a source's conversion beside its results: a
 * request that went wrong, an attempt that failed or needs attention, a
 * source that cannot be converted, or saved files still arriving. A
 * conversion that is starting or running shows as its pending row instead
 * (ConversionPending), and a result shows on its own row.
 */
export function ConversionStatus({
  conversion,
  onRetry,
}: {
  conversion: SourceConversion;
  /** Opens the dialog for an explicit retry. */
  onRetry?: () => void;
}) {
  const { current, jobs, availability, startError } = conversion;
  const [discarding, setDiscarding] = useState(false);
  const [discardError, setDiscardError] = useState<string | null>(null);
  if (conversion.active || conversion.starting) return null;

  const latest = jobs.at(0);
  const attempt =
    latest &&
    latest.id !== current?.jobId &&
    (latest.status === "failed" ||
      latest.status === "needs-attention" ||
      latest.status === "cancelled")
      ? attemptText(latest)
      : null;
  const blocked = availability.kind === "blocked" ? availability.reason : null;
  if (
    !attempt &&
    !blocked &&
    !conversion.jobsError &&
    !startError &&
    !conversion.renditionsPending
  ) {
    return null;
  }

  return (
    <div className="sk-convert-status">
      {attempt && latest?.status === "needs-attention" && (
        <Alert tone="warning" title="Needs attention">
          {attempt}
          {latest.error.code === "cleanup-failed" && isCancellable(latest) && (
            <Button
              variant="link"
              disabled={discarding}
              onClick={() => {
                setDiscarding(true);
                setDiscardError(null);
                conversion
                  .cancel(latest.id)
                  .catch((error: unknown) =>
                    setDiscardError(
                      messageOf(
                        error,
                        "Sektar couldn't discard this attempt. Try again.",
                      ),
                    ),
                  )
                  .finally(() => setDiscarding(false));
              }}
            >
              Discard attempt
            </Button>
          )}
          {discardError && (
            <p className="sk-small sk-text-danger">{discardError}</p>
          )}
          {onRetry && !blocked && (
            <Button variant="link" onClick={onRetry}>
              {convertAction(conversion).label}
            </Button>
          )}
        </Alert>
      )}
      {attempt && latest?.status === "failed" && (
        <p className="sk-small sk-text-danger" role="status">
          {attempt}{" "}
          {onRetry && !blocked && (
            <Button variant="link" onClick={onRetry}>
              Try again
            </Button>
          )}
        </p>
      )}
      {attempt && latest?.status === "cancelled" && (
        <p className="sk-caption" role="status">
          {attempt}
        </p>
      )}
      {startError && (
        <p className="sk-small sk-text-danger" role="alert">
          {startError}{" "}
          {onRetry && !blocked && (
            <Button variant="link" onClick={onRetry}>
              Try again
            </Button>
          )}
        </p>
      )}
      {blocked && <p className="sk-caption">{blocked}</p>}
      {conversion.renditionsPending && (
        <p className="sk-caption" role="status">
          Saved conversion files are still arriving.
        </p>
      )}
      {!blocked && conversion.jobsError && (
        <p className="sk-caption">{conversion.jobsError}</p>
      )}
    </div>
  );
}

/**
 * A conversion that is starting or running, as the row its result will
 * take: what the host reports of it, and Cancel only where the host says it
 * can be cancelled. Nothing while there is none.
 */
export function ConversionPendingRow({
  conversion,
}: {
  conversion: SourceConversion;
}) {
  const now = useNow(5_000);
  const [stopping, setStopping] = useState<string | null>(null);
  const [stopError, setStopError] = useState<string | null>(null);
  const { active, starting, startError } = conversion;
  if (!active && !starting) return null;

  const asked = active !== undefined && stopping === active.id;
  const meta = !active
    ? "Converting, started just now"
    : asked
      ? "Cancelling"
      : active.status === "queued"
        ? `Waiting to start, asked ${startedAgo(active.createdAt, now)}`
        : `${progressText(active) || "Converting"}, started ${startedAgo(active.createdAt, now)}`;

  return (
    <li className="sk-file-row sk-convert-pending" role="status">
      <div className="sk-file-row__main">
        <span className="sk-file-type sk-convert-pending__tile">
          <span className="sk-spinner" aria-hidden="true" />
        </span>
        <span className="sk-file-row__body">
          <span className="sk-file-row__name">Markdown</span>
          <span className="sk-file-row__meta">{meta}</span>
          {asked && usesAi(active.profile) && (
            <span className="sk-convert-pending__note">
              A model request already sent may still finish and be charged.
            </span>
          )}
          {stopError && (
            <span className="sk-convert-pending__note sk-text-danger">
              {stopError}
            </span>
          )}
          {active && startError && (
            <span className="sk-convert-pending__note sk-text-danger">
              The conversion is running, even though asking for it reported a
              problem.
            </span>
          )}
        </span>
      </div>
      {active && !asked && isCancellable(active) && (
        <span className="sk-file-row__actions">
          <Button
            variant="link"
            onClick={() => {
              setStopping(active.id);
              setStopError(null);
              conversion.cancel(active.id).catch((error: unknown) => {
                setStopping(null);
                setStopError(
                  messageOf(
                    error,
                    "Sektar couldn't cancel this conversion. Try again.",
                  ),
                );
              });
            }}
          >
            Cancel
          </Button>
        </span>
      )}
    </li>
  );
}

/** The pending row in a list of its own, for a surface without a list of results (Mail). */
export function ConversionPending({
  conversion,
}: {
  conversion: SourceConversion;
}) {
  if (!conversion.active && !conversion.starting) return null;
  return (
    <ul className="sk-file-rows">
      <ConversionPendingRow conversion={conversion} />
    </ul>
  );
}

/* --------------------------------------------------------- the Markdown */

/** The most Markdown rendered as a preview; raw, copy and download have all of it. */
const PREVIEW_CHARS = 300_000;

/** The preview's share of a long document, cut where a block ends. */
function previewOf(text: string): { shown: string; cut: boolean } {
  if (text.length <= PREVIEW_CHARS) return { shown: text, cut: false };
  const end = text.lastIndexOf("\n\n", PREVIEW_CHARS);
  return { shown: text.slice(0, end > 0 ? end : PREVIEW_CHARS), cut: true };
}

const MARKDOWN_UNREADABLE =
  "Sektar couldn't load this Markdown. Try again in a moment.";

/** A stored text file's whole content, read from its object URL. */
function useStoredText(url: string | undefined): {
  text: string | null;
  error: string | null;
} {
  const [held, setHeld] = useState<{
    url: string;
    text: string | null;
    error: string | null;
  } | null>(null);
  useEffect(() => {
    if (!url) return;
    let live = true;
    fetch(url)
      .then(async (response) =>
        decodeText(
          await response.arrayBuffer(),
          response.headers.get("content-type"),
        ),
      )
      .then(
        (text) => {
          if (live) setHeld({ url, text, error: null });
        },
        (error: unknown) => {
          if (live) {
            console.warn("[conversion] Reading the Markdown failed", error);
            setHeld({ url, text: null, error: MARKDOWN_UNREADABLE });
          }
        },
      );
    return () => {
      live = false;
    };
  }, [url]);
  return held && held.url === url ? held : { text: null, error: null };
}

/** Where a page of the PDF is missing from its Markdown: why, and what to do about it. */
function MissingPageNote({
  page,
  reason,
  onConvert,
  converting,
  disabled,
  onOpenPage,
}: {
  page: number;
  reason: string;
  onConvert: () => void;
  converting: boolean;
  disabled: boolean;
  onOpenPage?: (page: number) => void;
}) {
  return (
    <div className="sk-markdown__missing" role="note">
      <p>
        Page {page} wasn't read. {reason}
      </p>
      <div className="sk-markdown__missing-actions">
        <Button
          size="sm"
          variant="secondary"
          disabled={disabled || converting}
          onClick={onConvert}
        >
          {converting && <span className="sk-spinner" aria-hidden="true" />}
          Convert with scanning
        </Button>
        {onOpenPage && (
          <Button variant="link" onClick={() => onOpenPage(page)}>
            Open page {page}
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * A finished conversion, read: the Markdown as a document or as its raw
 * text, with copy and download in the toolbar and the rest in its menu, a
 * note where each page it is missing belongs, and its details. Rendering
 * never runs markup from the PDF (components/Markdown.tsx).
 */
export function ConvertedMarkdown({
  documentId,
  rendition,
  conversion,
  label,
  status,
  revealDetails,
  onOpenPage,
  replacedAt,
}: {
  documentId: string;
  rendition: ConversionRenditionView;
  conversion: SourceConversion;
  /** In the toolbar before the actions: what names the result, or the switch that picked it */
  label?: ReactNode;
  /**
   * Under the toolbar: where the source's conversion stands, on a surface
   * that shows it nowhere else. Without it, a running conversion is noted.
   */
  status?: ReactNode;
  /** Changes when the details should be opened from outside (a menu's "Conversion details") */
  revealDetails?: number;
  /** Shows the original PDF at a page; without it, no page is offered */
  onOpenPage?: (page: number) => void;
  /** When the PDF was replaced, for a result made from the one before */
  replacedAt?: string;
}) {
  const client = useAttachments();
  const preview = useAttachmentPreview({ documentId, ref: rendition.ref });
  // The URL is only this file's once its own load has finished (see StoredFilePreview).
  const url =
    preview.stage === "done" && !preview.loading ? preview.url : undefined;
  const { text, error } = useStoredText(url);
  const [raw, setRaw] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [converting, setConverting] = useState(false);
  const [reveal, setReveal] = useState(0);
  const [toast, flash] = useStartedToast();
  const convert = convertAction(conversion);
  const {
    start,
    pending,
    error: startError,
  } = useStartConversion(conversion, flash);
  useEffect(() => {
    if (!note) return;
    const timer = window.setTimeout(() => setNote(null), 4000);
    return () => window.clearTimeout(timer);
  }, [note]);

  const partial = rendition.completeness === "partial";
  const body = text === null ? null : previewOf(text);
  const output = rendition.publication.output;
  const app =
    conversion.activation.kind === "known"
      ? conversion.activation.settings.profile
      : null;
  const busy = pending || conversion.starting;

  const notes = useMemo(() => {
    const ran = methodOfPlan(output.plan);
    const scanning = app && scanningProfile(output.plan, app);
    const missing = new Map<number, ReactNode>();
    for (const page of output.pages) {
      if (page.status !== "unresolved" && page.status !== "failed") continue;
      missing.set(
        page.page,
        <MissingPageNote
          page={page.page}
          reason={missingPageReason(page, ran)}
          converting={busy}
          disabled={convert.disabled || !scanning}
          onConvert={() =>
            scanning && start({ profile: scanning, again: true })
          }
          onOpenPage={onOpenPage}
        />,
      );
    }
    return missing;
  }, [output, busy, convert.disabled, start, app, onOpenPage]);

  const copy = () => {
    if (text === null) return;
    // In a context without clipboard access the raw text is there to select.
    Promise.resolve()
      .then(() => navigator.clipboard.writeText(text))
      .then(
        () => setNote("Copied"),
        () => {
          setRaw(true);
          setNote("Copying isn't allowed here. Select the raw Markdown.");
        },
      );
  };

  const menu: MenuItem[] = [
    {
      label: raw ? "Show as document" : "Show raw Markdown",
      onSelect: () => setRaw((shown) => !shown),
    },
    {
      label: "Open in a new tab",
      disabled: !url,
      onSelect: () => {
        if (url) window.open(url, "_blank", "noopener,noreferrer");
      },
    },
    {
      label: "Convert again…",
      divider: true,
      disabled: convert.disabled,
      onSelect: () => setConverting(true),
    },
    {
      label: "Conversion details",
      onSelect: () => setReveal((n) => n + 1),
    },
  ];

  return (
    <div className="sk-preview sk-file-preview sk-convert-result">
      <div className="sk-preview__toolbar">
        {label}
        {partial && (
          <Badge tone="warning" pill className="sk-convert-result__read">
            {pagesReadText(rendition)}
          </Badge>
        )}
        <span className="sk-grow" />
        {note && (
          <span className="sk-caption sk-convert-result__note" role="status">
            {note}
          </span>
        )}
        <Button
          size="sm"
          variant="ghost"
          iconOnly
          icon="copy"
          aria-label="Copy Markdown"
          title="Copy Markdown"
          disabled={text === null}
          onClick={copy}
        />
        {client && (
          <Button
            size="sm"
            variant="ghost"
            iconOnly
            icon="download"
            aria-label={
              partial ? "Download the partial Markdown" : "Download Markdown"
            }
            title={
              partial ? "Download the partial Markdown" : "Download Markdown"
            }
            onClick={() =>
              void client.saveAttachment(
                { documentId, ref: rendition.ref },
                {
                  fileName: downloadName(
                    rendition.fileName,
                    rendition.completeness,
                  ),
                },
              )
            }
          />
        )}
        <Menu
          label="Markdown"
          align="end"
          items={menu}
          trigger={(open, toggle) => (
            <button
              type="button"
              className="sk-more"
              aria-haspopup="menu"
              aria-expanded={open}
              aria-label="More actions"
              title="More actions"
              onClick={toggle}
            />
          )}
        />
      </div>

      {partial && (
        <div className="sk-convert-result__read-line">
          <Badge tone="warning" pill>
            {pagesReadText(rendition)}
          </Badge>
        </div>
      )}
      {status}
      {rendition.stale && (
        <Alert tone="warning">
          This Markdown was made from the previous PDF, which was replaced
          {replacedAt ? ` on ${shortWhen(replacedAt)}` : ""}.
          {conversion.availability.kind === "ready" && (
            <div className="sk-mt-3">
              <Button
                size="sm"
                variant="primary"
                disabled={convert.disabled || busy}
                onClick={() => start()}
              >
                {busy && <span className="sk-spinner" aria-hidden="true" />}
                Convert the new PDF
              </Button>
            </div>
          )}
        </Alert>
      )}
      {startError && (
        <p className="sk-small sk-text-danger" role="alert">
          {startError}
        </p>
      )}
      {(conversion.active || conversion.starting) && status === undefined && (
        <p className="sk-caption" role="status">
          Converting. This is the Markdown saved before.
        </p>
      )}

      {!client && (
        <p className="sk-small sk-text-muted">
          This drive lives in the browser only, so there is no file store to
          read from.
        </p>
      )}
      {client && body === null && !error && !preview.error && (
        <div className="sk-file-preview__sheet sk-file-preview__sheet--loading">
          <Skeleton height={14} width="60%" />
          <Skeleton height={14} width="85%" />
          <Skeleton height={14} width="40%" />
        </div>
      )}
      {client &&
        (error ?? preview.error) &&
        body === null &&
        !preview.loading && (
          <p className="sk-small sk-text-danger">{MARKDOWN_UNREADABLE}</p>
        )}
      {body && (
        <div className="sk-file-preview__sheet">
          {raw ? (
            <pre className="sk-file-preview__text sk-font-mono">{text}</pre>
          ) : (
            <Markdown source={body.shown} notes={notes} />
          )}
        </div>
      )}
      {body?.cut && !raw && (
        <p className="sk-caption">
          This is the beginning of a long document. Raw, copy and download have
          all of it.
        </p>
      )}

      <ConversionDetails
        rendition={rendition}
        conversion={conversion}
        reveal={(revealDetails ?? 0) + reveal}
      />
      {converting && (
        <ConvertDialog
          conversion={conversion}
          fileName={rendition.publication.source.fileName}
          onClose={() => setConverting(false)}
          onStarted={flash}
        />
      )}
      {toast}
    </div>
  );
}

/**
 * What is known about how a result was made, collapsed until asked for:
 * first what a person asks (which PDF, how many pages, how, whether AI was
 * used, when), then the engines and the converter's own words.
 */
function ConversionDetails({
  rendition,
  conversion,
  reveal,
}: {
  rendition: ConversionRenditionView;
  conversion: SourceConversion;
  reveal: number;
}) {
  const details = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if (reveal && details.current) {
      details.current.open = true;
      details.current.scrollIntoView({ block: "nearest" });
    }
  }, [reveal]);

  const output = rendition.publication.output;
  const latest = conversion.jobs.at(0);
  const later =
    rendition.current && latest && latest.id !== rendition.jobId
      ? attemptText(latest)
      : null;
  const unused =
    output.usage.kind === "known" &&
    output.usage.requests === 0 &&
    output.usage.aiPages === 0;
  const note = warningNote(output.warnings);
  const rows: { label: string; value: ReactNode }[] = [
    {
      label: "Made from",
      value: (
        <>
          {rendition.publication.source.fileName}{" "}
          {rendition.stale ? (
            <Badge tone="outline" pill>
              Previous PDF
            </Badge>
          ) : (
            <Badge tone="success" pill>
              Current PDF
            </Badge>
          )}
        </>
      ),
    },
    {
      label: "Pages",
      value: coverageText(rendition, coverageOf(output.pages).unread),
    },
    { label: "Method", value: readingSummary(profileOfPlan(output.plan)) },
    { label: "AI", value: unused ? "Not used" : usageText(output.usage) },
    { label: "Made", value: fullWhen(rendition.createdAt) },
    ...(note ? [{ label: "Note", value: note }] : []),
    ...(later
      ? [{ label: "Latest attempt", value: `${later} This Markdown was kept.` }]
      : []),
  ];
  const lines = warningLines(output.warnings);
  const failedPages = output.pages.flatMap((page) =>
    page.status === "failed" ? [`Page ${page.page}: ${page.reason}`] : [],
  );
  const attemptDetail =
    later && latest && "error" in latest ? latest.error.detail : undefined;
  const technical: { label: string; value: ReactNode }[] = [
    {
      label: "Engines",
      value: rendition.methods
        .map((method) => provenanceDetail(method))
        .join(", "),
    },
    ...(rendition.model ? [{ label: "Model", value: rendition.model }] : []),
    ...(output.usage.kind === "unknown"
      ? [{ label: "AI usage", value: output.usage.reason }]
      : []),
    ...(failedPages.length > 0
      ? [
          {
            label: "Page errors",
            value: (
              <ul className="sk-convert-warnings">
                {failedPages.map((line, at) => (
                  <li key={at}>{line}</li>
                ))}
              </ul>
            ),
          },
        ]
      : []),
    ...(attemptDetail
      ? [{ label: "Latest attempt", value: attemptDetail }]
      : []),
    ...(lines.length > 0
      ? [
          {
            label: "Warnings",
            value: (
              <ul className="sk-convert-warnings">
                {lines.map((line, at) => (
                  <li key={at}>{line}</li>
                ))}
              </ul>
            ),
          },
        ]
      : []),
  ];

  return (
    <details ref={details} className="sk-convert-details">
      <summary>
        <Icon name="chevron-right" size={16} mono />
        Conversion details
      </summary>
      <Dl tight rows={rows} />
      <details className="sk-convert-details sk-convert-details--nested">
        <summary>
          <Icon name="chevron-right" size={16} mono />
          Technical details
        </summary>
        <Dl tight rows={technical} />
      </details>
    </details>
  );
}
