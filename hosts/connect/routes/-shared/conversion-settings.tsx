import { generateId } from "document-model";
import { preparationActive } from "../../../../conversions/models/contracts.js";
import { ScannerProgress } from "../../../../editors/sektar/components/ScannerProgress.js";
import {
  useScannerPreparation,
  useScannerReadiness,
} from "../../../../editors/sektar/kit/use-scanner.js";
import { useDrives } from "@powerhousedao/reactor-browser";
import type { DocumentDriveDocument } from "@powerhousedao/shared/document-drive";
import { useEffect, useMemo, useRef, useState } from "react";
import type {
  ConversionCapabilities,
  ConversionLimits,
  ConversionProfile,
} from "../../../../conversions/contracts.js";
import {
  BlockerList,
  MethodSelect,
  ScannerFields,
} from "../../../../editors/sektar/components/ConversionFields.js";
import {
  ACTIVATION_HELP,
  ACTIVATION_LABEL,
  aiOffered,
  blockersOf,
  draftOf,
  limitProblems,
  sameDraft,
  type Activation,
  type LimitName,
  type SettingsDraft,
} from "../../../../editors/sektar/kit/conversion-model.js";
import {
  ChoiceCards,
  type CardChoice,
} from "../../../../editors/sektar/kit/choice-cards.js";
import { useConversionGrant } from "../../../../editors/sektar/kit/conversion-grant.js";
import {
  isConversionConflict,
  isConversionMissing,
  type ConversionClient,
} from "../../../../editors/sektar/kit/conversion.js";
import { bytes } from "../../../../editors/sektar/kit/files.js";
import {
  useMailAccounts,
  type MailAccount,
} from "../../../../editors/sektar/kit/mail-index.js";
import {
  Alert,
  Button,
  Field,
  Input,
  Skeleton,
} from "../../../../editors/sektar/kit/ui.js";
import {
  isHostRefusal,
  messageOf,
  useCapabilities,
  useConversionHost,
  useConversionSettings,
} from "../../../../editors/sektar/kit/use-conversion.js";
import {
  localOcrOf,
  methodOf,
  usesAi,
  withAiLayout,
  withMethod,
} from "../../../../pieces/docture/lib/profile.js";
import { findDrive } from "../../../../processors/drives/index.js";
import { ExistingPdfs } from "./conversion-batches.js";
import { sourcesOf } from "./conversion-sources.js";

export function draftProblems(
  draft: SettingsDraft,
  hostLimits: ConversionLimits,
): { limits: Partial<Record<LimitName, string>>; general: string[] } {
  const limits = limitProblems(draft.limits, hostLimits);
  const general: string[] = [];
  if (draft.activation !== "off" && usesAi(draft.profile)) {
    if (draft.limits.maxAiPages === 0 || draft.limits.maxAiRequests === 0) {
      general.push(
        "These choices use AI, and the AI limits allow none. Allow at least one AI page and one AI request per PDF, or choose a method without AI.",
      );
    } else if (
      draft.activation === "automatic" &&
      draft.limits.automaticAiPagesPerDay === 0
    ) {
      general.push(
        "Automatic conversion with AI needs an automatic AI allowance above 0 pages per day.",
      );
    }
  }
  return { limits, general };
}

const NO_ACCOUNTS: readonly MailAccount[] = [];

export function ConversionSettings() {
  const drives = useDrives();
  const files = findDrive(drives, "files");
  const mail = findDrive(drives, "mail");
  const accounts = useMailAccounts(mail, 0) ?? NO_ACCOUNTS;
  const host = useConversionHost(files ?? mail ?? drives?.[0]);

  if (host.kind !== "ready") {
    return (
      <div className="sk-convert-settings">
        <SettingsHeading />
        <p className="sk-text-muted">
          {host.kind === "browser-only"
            ? "Conversion runs on a Sektar host. These drives live in this browser only, so there is nothing to set up here."
            : drives?.length === 0
              ? "Connect to a Sektar host to set up document conversion."
              : "Looking for the Sektar host behind your app…"}
        </p>
      </div>
    );
  }
  return (
    <ConversionSettingsForm
      key={host.client.host}
      client={host.client}
      files={files}
      mail={mail}
      accounts={accounts}
    />
  );
}

function SettingsHeading() {
  return (
    <header className="sk-convert-settings__header">
      <h2>Document conversion</h2>
      <p className="sk-text-secondary">
        Keep a Markdown version beside your PDFs. Your originals stay unchanged.
      </p>
      <p className="sk-caption">
        These settings apply throughout Files and Mail, including drives and
        accounts you add later.
      </p>
    </header>
  );
}

const ACTIVATIONS: readonly CardChoice<Activation>[] = (
  ["off", "manual", "automatic"] as const
).map((value) => ({
  value,
  label: ACTIVATION_LABEL[value],
  description: ACTIVATION_HELP[value],
}));

type SaveOutcome =
  | { kind: "saved"; message: string }
  | { kind: "failed"; message: string; conflict: boolean };

export function ConversionSettingsForm({
  client,
  files,
  mail,
  accounts,
}: {
  client: ConversionClient;
  files: DocumentDriveDocument | undefined;
  mail: DocumentDriveDocument | undefined;
  accounts: readonly MailAccount[];
}) {
  const grant = useConversionGrant(client.host);
  const preparation = useScannerPreparation(client);
  const preparing =
    preparation.view !== null && preparationActive(preparation.view);
  const savedRequest = useRef<{ key: string; id: string } | null>(null);
  const acknowledgedRequest = useRef<string | null>(null);
  const loadedCapabilities = useCapabilities(client);
  const [loadedSettings, reloadSettings] = useConversionSettings(client);
  const [edited, setEdited] = useState<{
    host: string;
    revision: number;
    values: SettingsDraft;
  } | null>(null);
  const [saving, setSaving] = useState<"settings" | "access" | null>(null);
  const [outcome, setOutcome] = useState<SaveOutcome | null>(null);
  const [limitsOpen, setLimitsOpen] = useState(false);
  const submitted = preparation.view?.intent.settings ?? null;
  const scannerProfile =
    edited?.host === client.host
      ? edited.values.profile
      : (preparing || preparation.view?.progress.phase === "failed") &&
          submitted &&
          loadedSettings.status === "ready" &&
          submitted.expectedRevision === loadedSettings.value.revision
        ? submitted.profile
        : loadedSettings.status === "ready"
          ? loadedSettings.value.profile
          : null;
  const readiness = useScannerReadiness(
    client,
    scannerProfile,
    preparation.view?.progress.phase === "complete"
      ? preparation.view.updatedAt
      : "",
  );
  const latestPreparation = useRef(preparation.view);
  latestPreparation.current = preparation.view;
  useEffect(() => {
    const view = latestPreparation.current;
    if (!view) return;
    const proposal = view.intent.settings;
    if (view.id === savedRequest.current?.id) {
      acknowledgedRequest.current = view.id;
      setOutcome(
        view.progress.phase === "complete"
          ? { kind: "saved", message: "Settings saved for the whole app." }
          : null,
      );
    }
    if (view.progress.phase === "complete") {
      setEdited((draft) =>
        draft?.host === client.host &&
        draft.revision === proposal.expectedRevision &&
        sameDraft(draft.values, {
          activation: proposal.activation,
          profile: proposal.profile,
          limits: proposal.limits,
        })
          ? null
          : draft,
      );
      reloadSettings();
    } else if (view.error?.code === "revision-conflict") reloadSettings();
  }, [
    preparation.view?.id,
    preparation.view?.progress.phase,
    client.host,
    reloadSettings,
  ]);
  const sources = useMemo(
    () => sourcesOf({ files, mail, accounts }),
    [files, mail, accounts],
  );
  const failure =
    loadedCapabilities.status === "failed"
      ? loadedCapabilities.error
      : loadedSettings.status === "failed"
        ? loadedSettings.error
        : undefined;

  if (failure !== undefined) {
    return (
      <div className="sk-convert-settings">
        <SettingsHeading />
        <Alert
          tone={
            isConversionMissing(failure) || isHostRefusal(failure)
              ? undefined
              : "danger"
          }
        >
          {isConversionMissing(failure)
            ? "This Sektar host does not offer document conversion."
            : messageOf(
                failure,
                "Sektar couldn't load the conversion settings. Try again in a moment.",
              )}
        </Alert>
      </div>
    );
  }
  if (
    loadedCapabilities.status !== "ready" ||
    loadedSettings.status !== "ready"
  ) {
    return (
      <div className="sk-convert-settings">
        <SettingsHeading />
        <div className="sk-stack sk-stack--3" aria-busy="true">
          <Skeleton height={20} width="40%" />
          <Skeleton height={100} />
          <Skeleton height={200} />
        </div>
      </div>
    );
  }

  const capabilities = loadedCapabilities.value;
  const settings = loadedSettings.value;
  const hostLimits = capabilities.limits;
  const baseline = draftOf(settings, hostLimits);
  const edit = edited?.host === client.host ? edited : null;
  const draft =
    edit?.values ??
    ((preparing || preparation.view?.progress.phase === "failed") &&
    submitted &&
    submitted.expectedRevision === settings.revision
      ? draftOf({ ...settings, ...submitted }, hostLimits)
      : baseline);
  const stale = edit !== null && edit.revision !== settings.revision;
  const changed = !sameDraft(draft, baseline);
  const needsSave =
    changed ||
    settings.revision === 0 ||
    settings.needsReview ||
    readiness.value?.ready === false;
  const off = draft.activation === "off";
  const busy = saving !== null || preparing;
  const blockers = off ? [] : blockersOf(draft.profile, capabilities);
  const problems = draftProblems(draft, hostLimits);
  const invalid =
    blockers.length > 0 ||
    problems.general.length > 0 ||
    Object.keys(problems.limits).length > 0;
  const ai = !off && usesAi(draft.profile);
  const aiShown = aiOffered(capabilities) || usesAi(draft.profile);
  const fileBytes = Math.min(
    draft.limits.maxBytes,
    capabilities.execution?.maxFileBytes ?? hostLimits.maxBytes,
  );
  const change = (next: Partial<SettingsDraft>) => {
    setEdited({
      host: client.host,
      revision: edit?.revision ?? settings.revision,
      values: { ...draft, ...next },
    });
    setOutcome(null);
  };
  const changeLimit = (name: LimitName, value: number) =>
    change({ limits: { ...draft.limits, [name]: value } });

  const save = async (accessOnly = false) => {
    setSaving(accessOnly ? "access" : "settings");
    setOutcome(null);
    try {
      if (accessOnly) {
        await client.renewAccess({
          expectedRevision: settings.revision,
          workflowGrant: await grant(),
        });
      } else {
        const workflowGrant = off ? undefined : await grant();
        const proposal = {
          ...draft,
          expectedRevision: edit?.revision ?? settings.revision,
        };
        const key = JSON.stringify([client.host, proposal]);
        if (savedRequest.current?.key !== key)
          savedRequest.current = { key, id: generateId() };
        const result = await client.putSettings({
          ...draft,
          requestId: savedRequest.current.id,
          expectedRevision: edit?.revision ?? settings.revision,
          ...(workflowGrant ? { workflowGrant } : {}),
        });
        setEdited(null);
        if ("kind" in result) {
          preparation.follow(result);
          return;
        }
      }
      reloadSettings();
      setOutcome({
        kind: "saved",
        message: accessOnly
          ? "Conversion access updated. Your saved settings have not changed."
          : "Settings saved for the whole app.",
      });
    } catch (error) {
      if (
        !accessOnly &&
        acknowledgedRequest.current &&
        acknowledgedRequest.current === savedRequest.current?.id
      )
        return;
      const conflict = isConversionConflict(error);
      if (conflict) reloadSettings();
      setOutcome({
        kind: "failed",
        conflict,
        message: messageOf(
          error,
          "Sektar couldn't save your changes. Try again.",
        ),
      });
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="sk-convert-settings">
      <SettingsHeading />
      {settings.needsReview && (
        <Alert title="Choose your app-wide settings">
          Per-source settings have been replaced. Conversion is off until you
          choose and save settings for the whole app. Your saved Markdown is
          unchanged.
        </Alert>
      )}
      <fieldset
        className="sk-convert-settings__section"
        disabled={saving !== null}
      >
        <ChoiceCards
          legend="When to convert"
          value={draft.activation}
          choices={ACTIVATIONS}
          onChange={(activation) => change({ activation })}
        />
        {off && (
          <p className="sk-hint">
            A conversion already running may still finish. Turning Off prevents
            later extraction and saving when those steps check the setting.
          </p>
        )}
        {draft.activation === "automatic" && (
          <p className="sk-hint">
            Existing PDFs stay unchanged.{" "}
            <a className="sk-convert-settings__link" href="#existing-pdfs">
              Review them separately ↓
            </a>
          </p>
        )}
      </fieldset>
      <fieldset
        className="sk-convert-settings__section sk-convert-settings__reading"
        disabled={off || busy}
      >
        <legend>How to read a PDF</legend>
        <ReadingFields
          profile={draft.profile}
          onChange={(profile) => change({ profile })}
          capabilities={capabilities}
        />
        {ai && (
          <p className="sk-small sk-text-secondary">
            Uses the integrated model
            {capabilities.ai.model ? ` (${capabilities.ai.model.modelId})` : ""}
            . Choosing it permits model calls within the limits below. Automatic
            mode alone never turns AI on.
          </p>
        )}
        <BlockerList blockers={blockers} />
      </fieldset>
      <details
        className="sk-convert-settings__limits"
        open={limitsOpen}
        onToggle={(event) => setLimitsOpen(event.currentTarget.open)}
      >
        <summary>
          <span className="sk-convert-settings__limits-title">
            Conversion limits
          </span>
          <span
            className={`sk-small ${Object.keys(problems.limits).length ? "sk-text-danger" : "sk-text-secondary"}`}
          >
            {Object.keys(problems.limits).length
              ? "A limit needs fixing."
              : limitsSummary(draft.limits, fileBytes)}
          </span>
        </summary>
        <fieldset
          className="sk-convert-settings__section"
          disabled={off || busy}
        >
          <div className="sk-convert-settings__grid">
            {LIMIT_FIELDS.filter(({ ai: isAi }) => aiShown || !isAi).map(
              ({ name, label }) => (
                <LimitField
                  key={name}
                  label={label}
                  name={name}
                  limits={draft.limits}
                  hostLimits={hostLimits}
                  problem={problems.limits[name]}
                  onChange={changeLimit}
                />
              ),
            )}
            <div className="sk-convert-settings__host-limits">
              <strong>Set by your host</strong>
              <p>File size: {bytes(fileBytes)} maximum</p>
              <p>
                Conversion time:{" "}
                {Math.round(draft.limits.maxDurationMs / 60_000)} minutes
              </p>
            </div>
          </div>
          {aiShown && (
            <p className="sk-caption">
              Batches share the automatic AI allowance, and 0 allows none.
            </p>
          )}
        </fieldset>
      </details>
      {problems.general.map((problem) => (
        <p key={problem} className="sk-small sk-text-danger" role="alert">
          {problem}
        </p>
      ))}
      <details className="sk-convert-settings__limits sk-convert-settings__access">
        <summary>
          <span className="sk-convert-settings__limits-title">
            Conversion access
          </span>
          <span className="sk-small sk-text-secondary">
            Use your access throughout the app
          </span>
        </summary>
        <p className="sk-hint">
          Saving settings also authorizes conversions with your access. To
          update access without changing your saved settings, use the button
          below.
        </p>
        <div>
          <Button
            variant="secondary"
            disabled={
              busy || settings.activation === "off" || settings.needsReview
            }
            onClick={() => void save(true)}
          >
            {saving === "access" ? "Updating access…" : "Use my access only"}
          </Button>
        </div>
        {settings.activation === "off" && (
          <p className="sk-caption">
            Save a conversion mode other than Off to enable conversion access.
          </p>
        )}
      </details>
      {(!off || preparation.view?.progress.phase === "failed") && (
        <ScannerProgress
          readiness={readiness.value}
          preparation={
            preparation.view &&
            (preparation.view.progress.phase !== "complete" ||
              (!changed && readiness.value?.ready === true)) &&
            (preparation.view.progress.phase === "failed" ||
              sameDraft(
                draft,
                draftOf(
                  { ...settings, ...preparation.view.intent.settings },
                  hostLimits,
                ),
              ))
              ? preparation.view
              : null
          }
          error={preparation.error ?? readiness.error}
          onRetry={() => {
            if (submitted && preparation.view) {
              const preparationId = preparation.view.id;
              setEdited(null);
              const retry = async () => {
                setSaving("settings");
                try {
                  const result = await client.putSettings({
                    ...submitted,
                    requestId: preparationId,
                    workflowGrant: await grant(),
                  });
                  if ("kind" in result) preparation.follow(result);
                } catch (error) {
                  setOutcome({
                    kind: "failed",
                    conflict: isConversionConflict(error),
                    message: messageOf(error),
                  });
                  reloadSettings();
                } finally {
                  setSaving(null);
                }
              };
              void retry();
            }
          }}
        />
      )}
      {stale && (
        <Alert tone="warning">
          Settings changed elsewhere. Discard your draft to review the latest
          settings before making new changes.
        </Alert>
      )}
      {outcome?.kind === "failed" && (
        <Alert tone="danger" title="Changes were not saved">
          {outcome.message}
          {outcome.conflict &&
            " The latest settings have been loaded. Discard your draft and review them before editing again."}
        </Alert>
      )}
      <div className={`sk-convert-settings__save${changed ? " is-dirty" : ""}`}>
        <div className="sk-convert-settings__save-copy" role="status">
          <strong>
            {changed
              ? "You have unsaved changes"
              : outcome?.kind === "saved"
                ? outcome.message
                : needsSave
                  ? "Save once to set up app-wide conversion"
                  : "All changes saved"}
          </strong>
          <span className="sk-caption">
            {changed
              ? outcome?.kind === "saved"
                ? outcome.message
                : "Applies to future conversions throughout Files and Mail."
              : "Existing PDFs and saved Markdown stay unchanged."}
          </span>
        </div>
        <div className="sk-convert-settings__buttons">
          {(changed || stale) && (
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => {
                setEdited(null);
                setOutcome(null);
              }}
            >
              Discard changes
            </Button>
          )}
          <Button
            variant="primary"
            disabled={
              saving !== null ||
              (preparing && !off) ||
              stale ||
              invalid ||
              !needsSave ||
              (!off && readiness.value === null)
            }
            onClick={() => void save()}
          >
            {saving === "settings"
              ? "Saving…"
              : preparing && !off
                ? "Preparing scanner…"
                : !off && readiness.value?.ready === false
                  ? "Download and save"
                  : "Save changes"}
          </Button>
        </div>
      </div>
      <ExistingPdfs client={client} sources={sources} settings={settings} />
    </div>
  );
}

/** A number of things, with thousands separated: "2,000 pages". */
const counted = (n: number, one: string) =>
  `${n.toLocaleString("en")} ${n === 1 ? one : `${one}s`}`;

/** The limits in a line: "500 pages and 8.0 MB per PDF, 30 minutes per conversion". */
export function limitsSummary(
  limits: ConversionLimits,
  fileBytes: number,
): string {
  return `${counted(limits.maxPages, "page")} and ${bytes(fileBytes)} per PDF, ${counted(Math.round(limits.maxDurationMs / 60_000), "minute")} per conversion`;
}

/* ---------------------------------------------------------------- reading */

/**
 * The method, then the scanner with its own options under it, then AI
 * layout where the host can run it. AI the host cannot run is not offered, so nothing points at a
 * setup the person has no way to do; once chosen, it stays to be undone.
 */
function ReadingFields({
  profile,
  onChange,
  capabilities,
}: {
  profile: ConversionProfile;
  onChange: (profile: ConversionProfile) => void;
  capabilities: ConversionCapabilities;
}) {
  // The local engine last chosen, to come back to from a method without one.
  const ocr = localOcrOf(profile);
  const [remembered, setRemembered] = useState(ocr);
  if (ocr && ocr !== remembered) setRemembered(ocr);
  const method = methodOf(profile);
  const layoutAvailable =
    capabilities.layout.availability.status === "available";
  const layoutOn = profile.layout.kind === "ai";

  return (
    <div className="sk-convert-reading">
      <MethodSelect
        value={method}
        capabilities={capabilities}
        onChange={(next) =>
          onChange(withMethod(profile, next, remembered ?? undefined))
        }
      />
      <ScannerFields
        profile={profile}
        onChange={onChange}
        capabilities={capabilities}
        ocr={remembered ?? undefined}
      />
      {method !== "ai" && (layoutAvailable || layoutOn) && (
        <label className="sk-check sk-sync-check">
          <input
            type="checkbox"
            checked={layoutOn}
            onChange={(event) =>
              onChange(withAiLayout(profile, event.target.checked))
            }
          />
          <span>
            <span className="sk-sync-check__label">
              Improve layout with AI{layoutAvailable ? "" : " (needs setup)"}
            </span>
            <span className="sk-caption">
              Adjusts headings and reading order with the integrated model and
              keeps the words that were read.
            </span>
          </span>
        </label>
      )}
    </div>
  );
}

const LIMIT_FIELDS: readonly { name: LimitName; label: string; ai: boolean }[] =
  [
    { name: "maxPages", label: "Pages per PDF", ai: false },
    { name: "maxAiPages", label: "AI pages per PDF", ai: true },
    { name: "maxAiRequests", label: "AI requests per PDF", ai: true },
    {
      name: "automaticAiPagesPerDay",
      label: "Automatic AI pages per day",
      ai: true,
    },
  ];

/** A limit, with the most this host allows inside the field. */
function LimitField({
  label,
  name,
  limits,
  hostLimits,
  problem,
  onChange,
}: {
  label: string;
  name: LimitName;
  limits: ConversionLimits;
  hostLimits: ConversionLimits;
  problem: string | undefined;
  onChange: (name: LimitName, value: number) => void;
}) {
  return (
    <Field
      label={label}
      error={problem}
      hint={`Maximum allowed: ${hostLimits[name].toLocaleString("en")}`}
    >
      <span className="sk-convert-settings__limit">
        <Input
          type="number"
          inputMode="numeric"
          min={name === "maxPages" ? 1 : 0}
          max={hostLimits[name]}
          step={1}
          value={Number.isFinite(limits[name]) ? limits[name] : ""}
          onChange={(event) => onChange(name, event.target.valueAsNumber)}
        />
        <span className="sk-convert-settings__unit">
          {name === "maxAiRequests" ? "requests" : "pages"}
        </span>
      </span>
    </Field>
  );
}
