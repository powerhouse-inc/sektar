// Settings → Document conversion → Convert existing PDFs: PDFs that were
// there before conversion was on are converted only by a batch a person
// starts after seeing which PDFs it holds. Batches started from this browser
// are listed while they run, where they can be cancelled.
import { generateId } from "document-model";
import { useEffect, useState } from "react";
import type {
  ConversionBatch,
  ConversionBatchPreview,
  ConversionSettings,
} from "../../../../conversions/contracts.js";
import {
  readingSummary,
  scopeKey,
} from "../../../../editors/sektar/kit/conversion-model.js";
import type { ConversionClient } from "../../../../editors/sektar/kit/conversion.js";
import { bytes } from "../../../../editors/sektar/kit/files.js";
import { plural } from "../../../../editors/sektar/kit/format.js";
import {
  Alert,
  Button,
  Field,
  Modal,
  Select,
} from "../../../../editors/sektar/kit/ui.js";
import {
  messageOf,
  useStartedBatches,
  type StartedBatches,
} from "../../../../editors/sektar/kit/use-conversion.js";
import { scopeLabel, type ConversionSource } from "./conversion-sources.js";

/** The most PDFs one batch holds: the contract's cap on a preview. */
export const BATCH_SIZE = 90;
/** How long before the host's expiry a preview is listed again. */
const EXPIRY_MARGIN_MS = 30_000;

/** What a batch started in this visit was started from. */
interface StartedFrom {
  /** How many PDFs its preview listed */
  previewed: number;
  /** Whether the source had more PDFs than the batch holds */
  truncated: boolean;
}

/**
 * PDFs that were there before conversion was on: converted only by a batch a
 * person starts after seeing which PDFs it holds. Batches started from this
 * browser are listed while they run, where they can be cancelled.
 */
export function ExistingPdfs({
  client,
  sources,
  settings,
}: {
  client: ConversionClient;
  sources: readonly ConversionSource[];
  settings: ConversionSettings;
}) {
  const started = useStartedBatches(client);
  /** The open dialog, and the source it opens on */
  const [dialog, setDialog] = useState<{ sourceKey?: string } | null>(null);
  const [startedFrom, setStartedFrom] = useState<
    Readonly<Partial<Record<string, StartedFrom>>>
  >({});
  const running = started.batches.some((batch) => batch.status === "running");
  const labelOf = (batch: ConversionBatch) =>
    sources.find((source) => source.key === scopeKey(batch.scope))?.label ??
    scopeLabel(batch.scope);

  return (
    <section
      className="sk-convert-settings__section sk-convert-settings__existing"
      id="existing-pdfs"
    >
      <div className="sk-convert-settings__existing-heading">
        <div>
          <h3>Convert existing PDFs</h3>
          <p className="sk-caption">
            Automatic conversion handles new or replaced PDFs. Review older PDFs
            and convert them in a separate batch using your saved settings.
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          disabled={sources.length === 0}
          onClick={() => setDialog({})}
        >
          Review PDFs…
        </Button>
      </div>
      {started.batches.map((batch) => {
        const from = startedFrom[batch.id];
        return (
          <BatchLine
            key={batch.id}
            batch={batch}
            label={labelOf(batch)}
            previewed={from?.previewed}
            cancel={started.cancel}
            onNext={
              from?.truncated && batch.status === "complete"
                ? () => setDialog({ sourceKey: scopeKey(batch.scope) })
                : undefined
            }
          />
        );
      })}
      {dialog && (
        <BatchDialog
          client={client}
          sources={sources}
          settings={settings}
          initialSource={dialog.sourceKey}
          running={running}
          onStarted={(batch, from) => {
            setStartedFrom((held) => ({ ...held, [batch.id]: from }));
            started.follow(batch);
            setDialog(null);
          }}
          onClose={() => setDialog(null)}
        />
      )}
    </section>
  );
}

/** How a batch stands, in plain sentences. */
export function batchText(batch: ConversionBatch, label: string): string {
  const count = batch.jobIds.length;
  switch (batch.status) {
    case "running":
      return `${label}: converting ${plural(count, "PDF")}. It keeps going if you close this page.`;
    case "cancelled":
      return `${label}: batch cancelled. PDFs that were waiting won't be converted. One that was already running may still finish.`;
    case "complete":
      return count === 0
        ? `${label}: no conversion runs were recorded. Check the workflow host, then try again.`
        : `${label}: batch of ${plural(count, "PDF")} finished. Each PDF shows how its conversion went.`;
    default: {
      const _exhaustive: never = batch.status;
      return _exhaustive;
    }
  }
}

function BatchLine({
  batch,
  label,
  previewed,
  cancel,
  onNext,
}: {
  batch: ConversionBatch;
  label: string;
  /** How many PDFs its preview listed, for a batch started in this visit */
  previewed: number | undefined;
  cancel: StartedBatches["cancel"];
  /** Opens the dialog for the PDFs this batch did not hold */
  onNext: (() => void) | undefined;
}) {
  const [stopping, setStopping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cancelNote, setCancelNote] = useState(false);
  const skipped =
    previewed === undefined ? 0 : Math.max(0, previewed - batch.jobIds.length);
  return (
    <div className="sk-convert-status">
      <p className="sk-convert-line" role="status">
        {batch.status === "running" && (
          <span className="sk-spinner" aria-hidden="true" />
        )}
        <span>{batchText(batch, label)}</span>
        {batch.status === "running" && (
          <Button
            variant="link"
            disabled={stopping}
            onClick={() => {
              setStopping(true);
              setError(null);
              cancel(batch.id)
                .then(() => setCancelNote(true))
                .catch((refusal: unknown) =>
                  setError(
                    messageOf(
                      refusal,
                      "Sektar couldn't cancel the waiting conversions. Try again.",
                    ),
                  ),
                )
                .finally(() => setStopping(false));
            }}
          >
            {stopping ? "Cancelling…" : "Cancel waiting runs"}
          </Button>
        )}
        {onNext && (
          <Button variant="link" onClick={onNext}>
            Convert the next PDFs
          </Button>
        )}
      </p>
      {cancelNote && (
        <p className="sk-caption">
          Only waiting runs are cancelled. Running conversions continue.
          Requests that were still starting may appear afterwards.
        </p>
      )}
      {skipped > 0 && batch.status !== "running" && (
        <p className="sk-caption">
          {skipped} of the {plural(previewed ?? 0, "listed PDF")} didn't start.
          A PDF may have changed, or Sektar refused it. Check those PDFs before
          you try again.
        </p>
      )}
      {error && (
        <p className="sk-small sk-text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * Why a batch for a source cannot convert anything as the source is set up,
 * said before the host is asked. Null when nothing is known to stand in its
 * way; the host stays the one that decides.
 */
export function batchObstacle(
  settings: ConversionSettings | undefined,
): string | null {
  if (!settings) return null;
  if (settings.activation === "off") {
    return "Conversion is off for the app. Turn it on and save settings before converting existing PDFs.";
  }
  return null;
}

/**
 * What a preview found, in a few sentences: how many PDFs a batch would
 * convert, what was skipped and why, and whether the source holds more.
 */
export function previewText(preview: ConversionBatchPreview): string {
  const count = preview.candidates.length;
  const sentences = [
    count === 0 ? "No PDFs to convert." : `${plural(count, "PDF")} to convert.`,
  ];
  for (const warning of preview.warnings) {
    if (warning.code !== "truncated") sentences.push(warning.message);
  }
  if (preview.truncated) {
    sentences.push(
      `This batch holds the first ${count} PDFs. Convert the rest after it ends.`,
    );
  }
  return sentences.join(" ");
}

/** A source's preview as the host answered it, or why it did not. */
type Listing = {
  /** The request it answers: a source and an attempt */
  request: string;
  sourceKey: string;
} & (
  | {
      kind: "ready";
      value: ConversionBatchPreview;
      /** Names the batch this preview may start, however often Convert is pressed */
      requestId: string;
    }
  | { kind: "failed"; message: string }
);

/**
 * Convert existing PDFs: pick one source to list the PDFs a batch would
 * convert (nothing starts), then start it. Only one batch runs at a time
 * across the app: the host's queue holds 100 waiting runs and cancels
 * the overflow.
 */
function BatchDialog({
  client,
  sources,
  settings,
  initialSource,
  running,
  onStarted,
  onClose,
}: {
  client: ConversionClient;
  sources: readonly ConversionSource[];
  settings: ConversionSettings;
  initialSource: string | undefined;
  /** A batch from this browser is still running */
  running: boolean;
  onStarted: (batch: ConversionBatch, from: StartedFrom) => void;
  onClose: () => void;
}) {
  const [sourceKey, setSourceKey] = useState(
    () =>
      sources.find((source) => source.key === initialSource)?.key ??
      sources.at(0)?.key ??
      "",
  );
  const [attempt, setAttempt] = useState(0);
  const [listing, setListing] = useState<Listing | null>(null);
  const [starting, setStarting] = useState(false);
  const source = sources.find((candidate) => candidate.key === sourceKey);
  const obstacle = batchObstacle(settings);
  const request =
    source && obstacle === null
      ? `${source.key}#${settings.revision}#${attempt}`
      : null;

  // Listed on opening and on every change of source. An answer to an
  // earlier request is dropped.
  useEffect(() => {
    if (!source || request === null) return;
    let current = true;
    const answers = { request, sourceKey: source.key };
    client.previewBatch({ scope: source.scope, limit: BATCH_SIZE }).then(
      (value) => {
        if (current) {
          setListing({
            ...answers,
            kind: "ready",
            value,
            requestId: generateId(),
          });
        }
      },
      (error: unknown) => {
        if (current) {
          setListing({
            ...answers,
            kind: "failed",
            message: messageOf(
              error,
              "Sektar couldn't list the PDFs to convert. Try again.",
            ),
          });
        }
      },
    );
    return () => {
      current = false;
    };
  }, [client, source, request]);

  const fresh = listing?.request === request ? listing : null;
  // While an expired preview is listed again, its PDFs stay on screen.
  const shown =
    fresh ??
    (listing?.kind === "ready" && listing.sourceKey === sourceKey
      ? listing
      : null);

  // The host keeps a preview for a while only; an expired one starts nothing.
  const expiresAt = fresh?.kind === "ready" ? fresh.value.expiresAt : undefined;
  useEffect(() => {
    if (!expiresAt) return;
    const timer = setTimeout(
      () => setAttempt((n) => n + 1),
      Math.max(0, Date.parse(expiresAt) - Date.now() - EXPIRY_MARGIN_MS),
    );
    return () => clearTimeout(timer);
  }, [expiresAt]);

  const ready = fresh?.kind === "ready" ? fresh : null;
  const count = ready?.value.candidates.length ?? 0;
  const start = (preview: Extract<Listing, { kind: "ready" }>) => {
    setStarting(true);
    void (async () => {
      try {
        const batch = await client.startBatch({
          previewId: preview.value.id,
          requestId: preview.requestId,
        });
        onStarted(batch, {
          previewed: preview.value.candidates.length,
          truncated: preview.value.truncated,
        });
      } catch (refusal) {
        // A new attempt lists the PDFs again, under a new request ID.
        setListing({
          request: preview.request,
          sourceKey: preview.sourceKey,
          kind: "failed",
          message: `${messageOf(refusal, "The batch didn't start.")} Some PDFs may have started converting anyway, so check them before you try again.`,
        });
        setStarting(false);
      }
    })();
  };

  return (
    <Modal
      title="Convert existing PDFs"
      onClose={onClose}
      footer={
        <>
          <span className="sk-grow" />
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={!ready || count === 0 || running || starting}
            onClick={() => {
              if (ready) start(ready);
            }}
          >
            {starting
              ? "Starting…"
              : count > 0
                ? `Convert ${plural(count, "PDF")}`
                : "Convert"}
          </Button>
        </>
      }
    >
      <div className="sk-stack sk-stack--3 sk-convert-batch">
        <Field label="From">
          <Select
            value={sourceKey}
            disabled={starting}
            onChange={(event) => setSourceKey(event.target.value)}
          >
            {sources.map((each) => (
              <option key={each.key} value={each.key}>
                {each.label}
              </option>
            ))}
          </Select>
        </Field>
        {obstacle ? (
          <Alert tone="warning">{obstacle}</Alert>
        ) : fresh?.kind === "failed" ? (
          <p className="sk-small sk-text-danger" role="alert">
            {fresh.message}{" "}
            <Button variant="link" onClick={() => setAttempt((n) => n + 1)}>
              Try again
            </Button>
          </p>
        ) : shown?.kind === "ready" ? (
          <>
            <p className="sk-small" role="status">
              {previewText(shown.value)}
            </p>
            {shown.value.candidates.length > 0 && (
              <ul className="sk-convert-batch__list">
                {shown.value.candidates.map((candidate) => (
                  <li
                    key={
                      candidate.kind === "mail"
                        ? `${candidate.documentId}:${candidate.attachmentId}`
                        : candidate.documentId
                    }
                  >
                    <span className="sk-file-type sk-file-type--sm sk-file-type--pdf">
                      PDF
                    </span>
                    <span className="sk-convert-batch__name">
                      {candidate.fileName}
                    </span>
                    <span className="sk-convert-batch__size">
                      {bytes(candidate.sizeBytes)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <p className="sk-convert-batch__loading" role="status">
            <span className="sk-spinner" aria-hidden="true" />
            Listing PDFs in this source…
          </p>
        )}
        {!obstacle && (
          <p className="sk-hint">
            Uses your saved app settings: {readingSummary(settings.profile)}.
          </p>
        )}
        {running && (
          <p className="sk-small" role="status">
            A batch is still running. Start the next one when it ends.
          </p>
        )}
      </div>
    </Modal>
  );
}
