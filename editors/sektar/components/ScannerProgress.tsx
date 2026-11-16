import { useEffect, useRef } from "react";
import type {
  ModelPreparation,
  ModelReadiness,
} from "../../../conversions/models/contracts.js";
import { preparationActive } from "../../../conversions/models/contracts.js";
import { readingSummary } from "../kit/conversion-model.js";
import { bytes } from "../kit/files.js";
import { Button } from "../kit/ui.js";

export function ScannerProgress({
  readiness,
  preparation,
  error,
  onRetry,
}: {
  readiness?: ModelReadiness | null;
  preparation?: ModelPreparation | null;
  error?: string | null;
  onRetry?: () => void;
}) {
  const panel = useRef<HTMLElement>(null);
  const active = Boolean(preparation && preparationActive(preparation));
  useEffect(() => {
    if (active) panel.current?.scrollIntoView({ block: "center" });
  }, [active]);
  if (
    (preparation?.progress.totalFiles ?? readiness?.files.length ?? 0) === 0 &&
    !error &&
    !preparation?.error
  )
    return null;
  const progress = preparation?.progress;
  const phase = progress?.phase;
  const title =
    phase === "complete"
      ? "Scanner ready · settings saved"
      : phase === "failed"
        ? "Scanner setup needs attention"
        : phase === "verifying"
          ? "Verifying scanner files"
          : phase === "applying"
            ? "Applying your settings"
            : active
              ? "Downloading your scanner"
              : readiness?.ready
                ? "Scanner ready on this host"
                : "Download your scanner";
  const profile = preparation?.intent.settings.profile;
  return (
    <section
      ref={panel}
      className="sk-scanner-progress"
      aria-label="Scanner setup"
    >
      <div
        className="sk-scanner-progress__heading"
        role="status"
        aria-live="polite"
      >
        <strong>{title}</strong>
        {active && <span className="sk-spinner" aria-hidden="true" />}
      </div>
      {profile && <p className="sk-caption">{readingSummary(profile)}</p>}
      {active && progress && preparation && (
        <>
          <div
            className="sk-scanner-progress__track"
            role="progressbar"
            aria-label="Scanner download"
            aria-valuemin={0}
            aria-valuemax={progress.totalBytes || 1}
            aria-valuenow={progress.transferredBytes}
            aria-valuetext={`${bytes(progress.transferredBytes)} of ${bytes(progress.totalBytes)}`}
          >
            <span
              style={{
                width: `${progress.totalBytes ? Math.min(100, (progress.transferredBytes / progress.totalBytes) * 100) : 100}%`,
              }}
            />
          </div>
          <p className="sk-scanner-progress__numbers">
            <span>
              {bytes(progress.transferredBytes)} / {bytes(progress.totalBytes)}
            </span>
            <span>
              {progress.readyFiles} of {progress.totalFiles} files ready
            </span>
          </p>
          {progress.file && (
            <p className="sk-caption sk-scanner-progress__file">
              {progress.file}
            </p>
          )}
          <p className="sk-caption">
            You can leave this page. The host will finish setup. Your active
            settings stay in place until everything is ready.
          </p>
        </>
      )}
      {!preparation && readiness && (
        <p className="sk-caption">
          {readiness.ready
            ? "Verified files are cached for offline scanning."
            : `${bytes(readiness.missingBytes)} to download · ${readiness.files.filter((file) => file.ready).length} of ${readiness.files.length} files ready. Downloads start only when you save.`}
        </p>
      )}
      {preparation?.error && (
        <p className="sk-small sk-text-danger" role="alert">
          {preparation.error.message}
        </p>
      )}
      {phase === "failed" && onRetry && preparation?.error?.retryable && (
        <Button variant="secondary" onClick={onRetry}>
          Retry download
        </Button>
      )}
      {error && (
        <p className="sk-caption" role="status">
          {error}
        </p>
      )}
    </section>
  );
}
