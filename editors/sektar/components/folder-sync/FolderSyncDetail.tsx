// A folder sync as a document: which drive folder goes where on disk, how,
// and how the Switchboard's runs went. The mapping and the options are edited
// here; the runs and the issues are what the Switchboard reported.
import { useSelectedDrive } from "@powerhousedao/reactor-browser";
import type { Node } from "@powerhousedao/shared/document-drive";
import {
  actions,
  type FolderSyncAction,
  type FolderSyncConflictPolicy,
  type FolderSyncDocument,
  type FolderSyncFromDisk,
  type FolderSyncIssue,
  type FolderSyncIssueKind,
  type FolderSyncRun,
} from "document-models/folder-sync";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { bytes } from "../../kit/files.js";
import { ago, folderPath, hiddenSyncIds, isRunnable, requestPull, requestSync, statusInfo } from "../../kit/folder-sync.js";
import { Menu } from "../../kit/menu.js";
import { SyncGlyph } from "../../kit/sync-glyphs.js";
import { Badge, Button, Card, cx, EmptyState, Field, Icon, Input, MetaStrip, Select, Table, type IconName } from "../../kit/ui.js";

type Dispatch = (action: FolderSyncAction) => void;

const ABSOLUTE = /^([A-Za-z]:[\\/]|\\\\|\/)/;

/** What each "changes on disk" setting does, under the select. */
const FROM_DISK_HINT: Record<FolderSyncFromDisk, string> = {
  OFF: "Only the drive writes to disk. A file changed there counts as changed in both places.",
  PLACEHOLDERS: "New, changed and deleted files on disk show as placeholders in the drive, to pull by hand.",
  AUTO_PULL: "New and changed files are pulled into the drive; deletions wait as placeholders.",
  AUTO_PULL_WITH_DELETES: "New and changed files are pulled, and a file deleted on disk is deleted in the drive.",
};

const RUN_TONE ={ RUNNING: "info", OK: "success", PARTIAL: "warning", ERROR: "danger", CANCELLED: "outline" } as const;
const RUN_LABEL = { RUNNING: "Running", OK: "Synced", PARTIAL: "With issues", ERROR: "Failed", CANCELLED: "Cancelled" } as const;
const ISSUE: Record<FolderSyncIssueKind, { label: string; icon: IconName }> = {
  CONFLICT: { label: "Changed on disk", icon: "info" },
  ERROR: { label: "Could not write", icon: "close" },
  NAME_CLASH: { label: "Name clash", icon: "copy" },
  PATH_TOO_LONG: { label: "Path too long", icon: "folder" },
  NO_SOURCE: { label: "Nothing to write", icon: "reports" },
};

export function FolderSyncDetail({ doc, dispatch }: { doc: FolderSyncDocument; dispatch: Dispatch }) {
  const s = doc.state.global;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  const info = statusInfo(s, now);
  const runnable = isRunnable(s);
  const running = s.status === "RUNNING";
  const last = s.runs.at(0);

  return (
    <div className="sk-stack sk-stack--6 sk-sync-detail">
      <header className="sk-detail-header">
        <span className="sk-icon-tile sk-icon-tile--lg">
          <SyncGlyph size={32} className={cx(running && "sk-sync-spin")} />
        </span>
        <div style={{ minWidth: 0 }}>
          <h2 className="sk-detail-header__name">{s.folderPath || "Drive root"}</h2>
          <div className="sk-detail-header__sub sk-sync-detail__to">
            <Icon name="arrow-right" size={16} mono />
            <span title={s.localPath ?? undefined}>{s.localPath ?? "No folder on disk yet"}</span>
          </div>
          <div className="sk-detail-header__tags">
            <Badge tone={info.tone} pill dot={info.tone === "success" || info.tone === "info"}>
              {info.label}
            </Badge>
            {info.detail && <span className="sk-caption">{info.detail}</span>}
          </div>
        </div>
        <div className="sk-detail-header__actions">
          <Button variant="primary" disabled={!runnable || running} onClick={() => void requestSync(doc)}>
            {running ? "Syncing…" : "Synchronize now"}
          </Button>
          <Menu
            label="More"
            items={[
              { label: "Full resync", icon: "copy", disabled: !runnable || running, onSelect: () => void requestSync(doc, true) },
              {
                label: "Pull all placeholders",
                icon: "download",
                disabled: !runnable || (s.options.fromDisk ?? "OFF") === "OFF",
                onSelect: () => void requestPull(doc.header.id),
              },
              s.enabled
                ? { label: "Pause this mapping", icon: "close", onSelect: () => dispatch(actions.setEnabled({ enabled: false })) }
                : { label: "Resume this mapping", icon: "check", onSelect: () => dispatch(actions.setEnabled({ enabled: true })) },
            ]}
            trigger={(open, toggle) => (
              <button type="button" className="sk-more" aria-haspopup="menu" aria-expanded={open} aria-label="More" onClick={toggle}>
                <span />
              </button>
            )}
          />
        </div>
      </header>

      <StatusAlert doc={doc} now={now} />

      <Card title="Mapping">
        <MappingForm doc={doc} dispatch={dispatch} />
      </Card>

      <Card title="Writing to disk">
        <WritingForm doc={doc} dispatch={dispatch} />
      </Card>

      <Card title="Reading changes from disk">
        <ReadingForm doc={doc} dispatch={dispatch} />
      </Card>

      <Card title="Last run" actions={s.host?.name && <span className="sk-caption">on {s.host.name}</span>}>
        {last ? (
          <MetaStrip
            items={[
              { label: "Status", value: <Badge tone={RUN_TONE[last.status]}>{RUN_LABEL[last.status]}</Badge> },
              { label: "Started", value: when(last.startedAt) },
              { label: "Took", value: duration(last) },
              { label: "Written", value: `${last.written} · ${bytes(last.bytesWritten) || "0 B"}` },
              { label: "Unchanged", value: last.unchanged },
              { label: "Removed", value: last.deleted },
              ...((s.options.fromDisk ?? "OFF") !== "OFF" || (last.placeholders ?? 0) + (last.pulled ?? 0) > 0
                ? [
                    { label: "To pull", value: last.placeholders ?? 0 },
                    { label: "Pulled", value: last.pulled ?? 0 },
                  ]
                : []),
            ]}
          />
        ) : (
          <EmptyState icon="folder" title="Not run yet">
            The Switchboard writes the files when a sync is asked for: here, from the Folders pane, or from a workflow.
          </EmptyState>
        )}
      </Card>

      {s.issues.length > 0 && (
        <Card title={`Issues · ${s.issues.length}`}>
          <IssueList issues={s.issues} onResolve={(id) => dispatch(actions.resolveIssue({ id }))} now={now} />
        </Card>
      )}

      {s.runs.length > 1 && (
        <Card title="History">
          <RunTable runs={s.runs} />
        </Card>
      )}
    </div>
  );
}

/* ------------------------------------------------------------ the alert */

function StatusAlert({ doc, now }: { doc: FolderSyncDocument; now: number }) {
  const s = doc.state.global;
  const alert = (tone: "info" | "warning" | "danger", icon: IconName, title: string, body: ReactNode) => (
    <div className={cx("sk-alert", `sk-alert--${tone}`)} role={tone === "danger" ? "alert" : "status"}>
      <Icon name={icon} />
      <div>
        <div className="sk-alert__title">{title}</div>
        {body}
      </div>
    </div>
  );
  if (!s.driveId || !s.localPath)
    return alert("warning", "folder", "Choose where the files go", "Set the folder on disk below. It is a path on the machine the Switchboard runs on, not on this device.");
  if (s.status === "ERROR")
    return alert("danger", "close", "The last sync failed", s.runs[0]?.error ?? "The Switchboard reported an error without a message.");
  if (s.status === "REQUESTED")
    return alert(
      "info",
      "info",
      "Waiting for the Switchboard",
      `Asked ${ago(s.request?.requestedAt, now)}${s.request?.requestedBy ? ` by ${s.request.requestedBy}` : ""}${s.request?.full ? ", for a full resync" : ""}. A local Switchboard picks it up and writes the files.`,
    );
  return null;
}

/* -------------------------------------------------------------- mapping */

function MappingForm({ doc, dispatch }: { doc: FolderSyncDocument; dispatch: Dispatch }) {
  const s = doc.state.global;
  const [drive] = useSelectedDrive();
  const folders = useMemo(() => folderOptions(drive.state.global.nodes), [drive.state.global.nodes]);
  const [path, setPath] = useState(s.localPath ?? "");
  useEffect(() => setPath(s.localPath ?? ""), [s.localPath]);
  const trimmed = path.trim();
  const invalid = trimmed !== "" && !ABSOLUTE.test(trimmed);
  const save = () => {
    if (trimmed && !invalid && trimmed !== s.localPath) dispatch(actions.setLocalPath({ localPath: trimmed }));
  };
  const sameDrive = !s.driveId || s.driveId === drive.header.id;
  const mode = syncMode(s);

  return (
    <div className="sk-stack sk-stack--4">
      <div className="sk-sync-form">
        <div className="sk-stack sk-stack--3">
        <Field label="Drive folder" hint={sameDrive ? undefined : "This mapping is for another drive"}>
          <Select
            value={s.folderId ?? ""}
            disabled={!sameDrive}
            onChange={(e) => {
              const id = e.target.value || null;
              dispatch(actions.setTarget({ driveId: drive.header.id, folderId: id, folderPath: folderPath(drive.state.global.nodes, id) || null }));
            }}
          >
            <option value="">{drive.header.name || "Drive root"} (the whole drive)</option>
            {folders.map((f) => (
              <option key={f.id} value={f.id}>
                {f.path}
              </option>
            ))}
          </Select>
        </Field>
        <Check
          checked={s.options.includeSubfolders}
          label="Include subfolders"
          hint="Subfolders become folders on disk, and folders on disk subfolders."
          onChange={(includeSubfolders) => dispatch(actions.setOptions({ includeSubfolders }))}
        />
        </div>
        <Field
          label="Folder on disk"
          required
          error={invalid ? "Use an absolute path, e.g. D:\\Dropbox\\KSDC\\2026-Q3 or /home/me/ksdc" : undefined}
          hint="On the machine the Switchboard runs on. Created when missing."
        >
          <Input
            value={path}
            placeholder={String.raw`D:\Dropbox\KSDC\kwartaalaangiftes\2026-Q3`}
            spellCheck={false}
            onChange={(e) => setPath(e.target.value)}
            onBlur={save}
            onKeyDown={(e) => {
              if (e.key === "Enter") save();
              if (e.key === "Escape") setPath(s.localPath ?? "");
            }}
          />
        </Field>
      </div>
      <div className="sk-sync-form">
        <Field label="Sync" hint={SYNC_MODE_HINT[mode]}>
          <Select
            value={mode}
            onChange={(e) => {
              const next = e.target.value as SyncMode;
              if (next === "DISABLED") {
                dispatch(actions.setEnabled({ enabled: false }));
                return;
              }
              if (!s.enabled) dispatch(actions.setEnabled({ enabled: true }));
              dispatch(actions.setOptions({ trigger: next === "AUTOMATIC" ? "ON_CHANGE" : "MANUAL" }));
            }}
          >
            <option value="DISABLED">Disabled</option>
            <option value="MANUAL">Manually</option>
            <option value="AUTOMATIC">Automatic</option>
          </Select>
        </Field>
      </div>
    </div>
  );
}

type SyncMode = "DISABLED" | "MANUAL" | "AUTOMATIC";

/** The one Sync setting, out of the mapping's enabled flag and trigger. */
function syncMode(s: FolderSyncDocument["state"]["global"]): SyncMode {
  if (!s.enabled) return "DISABLED";
  return s.options.trigger === "ON_CHANGE" ? "AUTOMATIC" : "MANUAL";
}

const SYNC_MODE_HINT: Record<SyncMode, string> = {
  DISABLED: "Kept, but never synchronized.",
  MANUAL: "When asked: from the Folders pane, this page, or a workflow.",
  AUTOMATIC: "A few seconds after changes stop, in the drive or on disk, and at most a minute after the first.",
};

/** A design-system checkbox with its label and, below it, what it does. */
function Check({ checked, label, hint, disabled, onChange }: { checked: boolean; label: string; hint?: string; disabled?: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className={cx("sk-check sk-sync-check", disabled && "is-disabled")}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span>
        <span className="sk-sync-check__label">{label}</span>
        {hint && <span className="sk-caption">{hint}</span>}
      </span>
    </label>
  );
}

/** The drive's folders (not the `.sync` folder), each with its full path, in path order. */
function folderOptions(nodes: readonly Node[]) {
  const hidden = hiddenSyncIds(nodes);
  return nodes
    .filter((n) => n.kind === "folder" && !hidden.has(n.id))
    .map((n) => ({ id: n.id, path: folderPath(nodes, n.id) }))
    .sort((a, b) => a.path.localeCompare(b.path, undefined, { numeric: true, sensitivity: "base" }));
}

/* ----------------------------------------------------- writing, reading */

/** What a sync writes to disk: the Files (and their renditions), the documents. Greyed out where it does not apply. */
function WritingForm({ doc, dispatch }: { doc: FolderSyncDocument; dispatch: Dispatch }) {
  const o = doc.state.global.options;
  const set = (input: Parameters<typeof actions.setOptions>[0]) => dispatch(actions.setOptions(input));
  const writes = o.writeFiles !== false;
  return (
    <div className="sk-sync-form">
      <div className="sk-stack sk-stack--3">
        <span className="sk-label">Files</span>
        <Check checked={writes} label="Write to disk" hint="The drive's Files become files in the folder on disk." onChange={(writeFiles) => set({ writeFiles })} />
        <Check
          checked={o.content === "SOURCE_AND_RENDITIONS"}
          disabled={!writes}
          label="Include renditions"
          hint="The PDFs and extracts made from a source, beside it."
          onChange={(on) => set({ content: on ? "SOURCE_AND_RENDITIONS" : "SOURCE" })}
        />
        <Check
          checked={o.onRemoved === "DELETE"}
          disabled={!writes}
          label="Delete on disk"
          hint="When a File leaves the drive folder, its file on disk goes too."
          onChange={(on) => set({ onRemoved: on ? "DELETE" : "KEEP" })}
        />
      </div>
      <div className="sk-stack sk-stack--3">
        <span className="sk-label">Documents</span>
        <Check
          checked={o.otherDocuments === "EXPORT_PHD"}
          disabled
          label="Write to disk as .phd"
          hint="Invoices, trips and other documents that are not Files. Not available yet."
          onChange={(on) => set({ otherDocuments: on ? "EXPORT_PHD" : "SKIP" })}
        />
      </div>
    </div>
  );
}

/** What a sync does with changes it finds on disk. */
function ReadingForm({ doc, dispatch }: { doc: FolderSyncDocument; dispatch: Dispatch }) {
  const o = doc.state.global.options;
  const set = (input: Parameters<typeof actions.setOptions>[0]) => dispatch(actions.setOptions(input));
  return (
    <div className="sk-sync-form">
      <Field label="Changes on disk" hint={FROM_DISK_HINT[o.fromDisk ?? "OFF"]}>
        <Select value={o.fromDisk ?? "OFF"} onChange={(e) => set({ fromDisk: e.target.value as FolderSyncFromDisk })}>
          <option value="OFF">Not synced back</option>
          <option value="PLACEHOLDERS">Placeholders, pulled by hand</option>
          <option value="AUTO_PULL">Pulled automatically</option>
          <option value="AUTO_PULL_WITH_DELETES">Pulled automatically, deletions too</option>
        </Select>
      </Field>
      <Field label="Changed in both places" hint="The drive's copy and the file on disk both changed since the last sync.">
        <Select value={o.onConflict} onChange={(e) => set({ onConflict: e.target.value as FolderSyncConflictPolicy })}>
          <option value="SKIP">Leave it and report it</option>
          <option value="OVERWRITE">Overwrite it</option>
          <option value="KEEP_BOTH">Keep both (write a copy beside it)</option>
        </Select>
      </Field>
    </div>
  );
}

/* --------------------------------------------------------- runs, issues */

function IssueList({ issues, onResolve, now }: { issues: readonly FolderSyncIssue[]; onResolve: (id: string) => void; now: number }) {
  return (
    <ul className="sk-feed">
      {issues.map((x) => (
        <li key={x.id} className="sk-feed__item">
          <span className="sk-feed__icon">
            <Icon name={ISSUE[x.kind].icon} />
          </span>
          <div style={{ minWidth: 0 }}>
            <div className="sk-feed__text">
              <strong>{ISSUE[x.kind].label}</strong>
              {x.relativePath && <span className="sk-sync-detail__path"> · {x.relativePath}</span>}
            </div>
            <div className="sk-feed__sub">{x.message}</div>
          </div>
          <span className="sk-feed__time sk-sync-detail__issue-aside">
            {ago(x.at, now)}
            <Button size="sm" variant="ghost" onClick={() => onResolve(x.id)}>
              Dismiss
            </Button>
          </span>
        </li>
      ))}
    </ul>
  );
}

function RunTable({ runs }: { runs: readonly FolderSyncRun[] }) {
  return (
    <Table compact stack>
      <thead>
        <tr>
          <th>Started</th>
          <th>Status</th>
          <th className="sk-num">Written</th>
          <th className="sk-num">Unchanged</th>
          <th className="sk-num">Removed</th>
          <th className="sk-num">Issues</th>
          <th className="sk-num">Took</th>
        </tr>
      </thead>
      <tbody>
        {runs.map((r) => (
          <tr key={r.id}>
            <td data-label="Started">
              {when(r.startedAt)}
              {r.full && <span className="sk-caption"> · full</span>}
            </td>
            <td data-label="Status">
              <Badge tone={RUN_TONE[r.status]}>{RUN_LABEL[r.status]}</Badge>
            </td>
            <td data-label="Written" className="sk-num">
              {r.written}
              {r.bytesWritten > 0 && <span className="sk-caption"> · {bytes(r.bytesWritten)}</span>}
            </td>
            <td data-label="Unchanged" className="sk-num">{r.unchanged}</td>
            <td data-label="Removed" className="sk-num">{r.deleted}</td>
            <td data-label="Issues" className="sk-num">{r.conflicts + r.errors + r.skipped}</td>
            <td data-label="Took" className="sk-num">{duration(r)}</td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

function when(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function duration(r: FolderSyncRun): string {
  if (!r.finishedAt) return "…";
  const s = Math.max(0, Math.round((Date.parse(r.finishedAt) - Date.parse(r.startedAt)) / 1000));
  return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${s % 60} s`;
}

