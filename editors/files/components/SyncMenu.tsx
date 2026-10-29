// The folder syncs of a drive, behind the double-arrows button in the Folders
// pane: each mapping with how it stands (opens it), then a new mapping for the
// open folder, and a run of them all. The Switchboard does the writing; this
// only reads the mappings (their rows in the Files index, not the documents)
// and asks for runs.
import { setSelectedNode } from "@powerhousedao/reactor-browser";
import { useState } from "react";
import type { SyncMappingSummary } from "../../sektar/kit/files-index.js";
import { createMapping, requestSyncAll, shortPath, statusInfo } from "../../sektar/kit/folder-sync.js";
import { Menu, type MenuItem } from "../../sektar/kit/menu.js";
import { SyncGlyph } from "../../sektar/kit/sync-glyphs.js";
import { Badge, cx } from "../../sektar/kit/ui.js";

interface Props {
  driveId: string;
  driveName: string;
  /** The drive's folder syncs, from the index; null while they load */
  mappings: readonly SyncMappingSummary[] | null;
  /** The folder open in the Files app: a new mapping maps this one */
  currentId: string | null;
  /** The open folder's path from the drive's root ("" at the root) */
  currentPath: string;
  /** The drive's `.sync` folder, when it has one */
  syncFolderId: string | null;
  /** Says what happened, in the contents pane's status line */
  onStatus: (message: string) => void;
}

/** The menu over the mappings it has; while they load, it still opens and can make a new one. */
export function SyncMenu({ driveId, driveName, mappings, currentId, currentPath, syncFolderId, onStatus }: Props) {
  const [creating, setCreating] = useState(false);
  const now = Date.now();
  const loading = mappings === null;
  const rows = (mappings ?? [])
    .map((m) => ({ m, info: statusInfo(m, now) }))
    .sort((a, b) => (a.m.folderPath ?? "").localeCompare(b.m.folderPath ?? ""));
  const attention = rows.some((r) => r.info.attention);
  const running = rows.some((r) => r.m.status === "RUNNING");

  const items: MenuItem[] = [
    ...(loading ? [{ section: "Folder syncs", label: "Loading folder syncs…", disabled: true, onSelect: () => undefined }] : []),
    ...rows.map(({ m, info }, i) => ({
      section: i === 0 ? "Folder syncs" : undefined,
      label: (
        <span className="sk-sync-row">
          <span className="sk-sync-row__name">{m.folderPath || driveName}</span>
          <span className="sk-sync-row__path" title={m.localPath ?? undefined}>
            {shortPath(m.localPath)}
          </span>
          <span className="sk-sync-row__status">
            <Badge tone={info.tone} pill dot={info.tone === "success" || info.tone === "info"}>
              {info.label}
            </Badge>
            {info.detail && <span className="sk-sync-row__detail">{info.detail}</span>}
          </span>
        </span>
      ),
      onSelect: () => setSelectedNode(m.id),
    })),
    {
      divider: true,
      label: "New mapping…",
      icon: "plus",
      disabled: creating,
      onSelect: () => {
        setCreating(true);
        createMapping(driveId, currentId, currentPath, driveName, syncFolderId)
          .then((id) => setSelectedNode(id))
          .catch((e: unknown) => onStatus(`Could not create the mapping: ${e instanceof Error ? e.message : String(e)}`))
          .finally(() => setCreating(false));
      },
    },
    {
      label: "Synchronize all",
      glyph: <SyncGlyph className="sk-icon--mono" />,
      disabled: rows.length === 0,
      onSelect: () => {
        requestSyncAll(mappings ?? [])
          .then((n) => onStatus(n === 0 ? "No mapping is set up to run" : n === 1 ? "Asked for 1 sync" : `Asked for ${n} syncs`))
          .catch((e: unknown) => onStatus(`Could not ask for a sync: ${e instanceof Error ? e.message : String(e)}`));
      },
    },
  ];

  return (
    <Menu
      label="Folder syncs"
      align="start"
      items={items}
      trigger={(open, toggle) => <SyncButton open={open} attention={attention} busy={running} onClick={toggle} />}
    />
  );
}

function SyncButton({ open, attention, busy, onClick }: { open: boolean; attention: boolean; busy: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      className={cx("sk-btn sk-btn--ghost sk-btn--sm sk-btn--icon sk-sync-button", busy && "is-busy")}
      aria-haspopup="menu"
      aria-expanded={open}
      aria-label={attention ? "Folder syncs (needs attention)" : "Folder syncs"}
      title="Folder syncs"
      onClick={onClick}
    >
      <SyncGlyph />
      {attention && <span className="sk-sync-button__dot" aria-hidden="true" />}
    </button>
  );
}

/**
 * The drive's mapped folders, each with where it goes on disk (the drive's
 * root under ""), out of the mapping rows.
 */
export function mappedFolders(driveId: string, mappings: readonly SyncMappingSummary[] | null): Map<string, string> {
  const out = new Map<string, string>();
  for (const m of mappings ?? []) {
    if (m.driveId !== driveId || !m.localPath) continue;
    out.set(m.folderId ?? "", `${m.localPath}${m.enabled ? "" : " (paused)"}`);
  }
  return out;
}
