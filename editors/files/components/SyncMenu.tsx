// The folder syncs of a drive, behind the double-arrows button in the Folders
// pane: each mapping with how it stands (opens it), then a new mapping for the
// open folder, and a run of them all. The Switchboard does the writing; this
// only reads the mappings and asks for runs.
import { setSelectedNode, useDocuments } from "@powerhousedao/reactor-browser";
import type { Node } from "@powerhousedao/shared/document-drive";
import type { FolderSyncDocument } from "document-models/folder-sync";
import { Suspense, useEffect, useMemo, useState } from "react";
import { createMapping, isMapping, mappingIds, requestSyncAll, shortPath, statusInfo } from "../../sektar/kit/folder-sync.js";
import { Menu, type MenuItem } from "../../sektar/kit/menu.js";
import { SyncGlyph } from "../../sektar/kit/sync-glyphs.js";
import { Badge, cx } from "../../sektar/kit/ui.js";

interface Props {
  driveId: string;
  driveName: string;
  nodes: readonly Node[];
  /** The folder open in the Files app: a new mapping maps this one */
  currentId: string | null;
  /** Says what happened, in the contents pane's status line */
  onStatus: (message: string) => void;
}

export function SyncMenu(props: Props) {
  const ids = useMemo(() => mappingIds(props.nodes), [props.nodes]);
  return (
    <Suspense fallback={<SyncMenuView {...props} docs={[]} loading />}>
      <SyncMenuLoaded {...props} ids={ids} />
    </Suspense>
  );
}

function SyncMenuLoaded({ ids, ...props }: Props & { ids: string[] }) {
  // By type, not by schema: a mapping stored before a field existed must still show.
  const docs = useDocuments(ids).filter(isMapping);
  return <SyncMenuView {...props} docs={docs} loading={false} />;
}

/** The menu over the mappings it has; while they load, it still opens and can make a new one. */
function SyncMenuView({ docs, loading, driveId, driveName, nodes, currentId, onStatus }: Props & { docs: FolderSyncDocument[]; loading: boolean }) {
  const [creating, setCreating] = useState(false);
  const now = Date.now();
  const rows = docs
    .map((doc) => ({ doc, info: statusInfo(doc.state.global, now) }))
    .sort((a, b) => (a.doc.state.global.folderPath ?? "").localeCompare(b.doc.state.global.folderPath ?? ""));
  const attention = rows.some((r) => r.info.attention);
  const running = rows.some((r) => r.doc.state.global.status === "RUNNING");

  const items: MenuItem[] = [
    ...(loading ? [{ section: "Folder syncs", label: "Loading folder syncs…", disabled: true, onSelect: () => undefined }] : []),
    ...rows.map(({ doc, info }, i) => ({
      section: i === 0 ? "Folder syncs" : undefined,
      label: (
        <span className="sk-sync-row">
          <span className="sk-sync-row__name">{doc.state.global.folderPath || driveName}</span>
          <span className="sk-sync-row__path" title={doc.state.global.localPath ?? undefined}>
            {shortPath(doc.state.global.localPath)}
          </span>
          <span className="sk-sync-row__status">
            <Badge tone={info.tone} pill dot={info.tone === "success" || info.tone === "info"}>
              {info.label}
            </Badge>
            {info.detail && <span className="sk-sync-row__detail">{info.detail}</span>}
          </span>
        </span>
      ),
      onSelect: () => setSelectedNode(doc.header.id),
    })),
    {
      divider: true,
      label: "New mapping…",
      icon: "plus",
      disabled: creating,
      onSelect: () => {
        setCreating(true);
        createMapping(driveId, nodes, currentId, driveName)
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
        requestSyncAll(docs)
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
 * Reports the drive's mapped folders, each with where it goes on disk (the
 * drive's root under ""). Renders nothing; it loads the mappings out of the
 * tree's way, so the tree never waits for them.
 */
export function MappedFolders({ driveId, nodes, onChange }: { driveId: string; nodes: readonly Node[]; onChange: (mapped: Map<string, string>) => void }) {
  const ids = useMemo(() => mappingIds(nodes), [nodes]);
  return (
    <Suspense fallback={null}>
      <MappedFoldersLoaded driveId={driveId} ids={ids} onChange={onChange} />
    </Suspense>
  );
}

function MappedFoldersLoaded({ driveId, ids, onChange }: { driveId: string; ids: string[]; onChange: (mapped: Map<string, string>) => void }) {
  const docs = useDocuments(ids).filter(isMapping);
  const entries = docs
    .map((d) => d.state.global)
    .filter((s) => s.driveId === driveId && s.localPath)
    .map((s) => [s.folderId ?? "", `${s.localPath}${s.enabled ? "" : " (paused)"}`] as const);
  const key = entries.map(([k, v]) => `${k}=${v}`).sort().join("|");
  useEffect(() => {
    onChange(new Map(entries));
    // The key carries every entry; the entries array is new on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, onChange]);
  return null;
}
