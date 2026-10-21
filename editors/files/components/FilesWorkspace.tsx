// The Files drive app: the design system's panes workspace over a drive.
// Folders on the left, the folder's contents (a list or a grid of cards with
// thumbnails) in the middle, the picked item previewed on the right; stacked
// under 800px of width as a push navigation. Files dropped anywhere on the
// contents become File documents; a document that is opened fills the app.
//
// The contents come from the Files index (kit/files-index.ts), sized to the
// whole folder and paged where the reader is, with only a screenful in the
// DOM; a File document is loaded for the preview alone. That is what lets a
// drive hold tens of thousands of files.
import {
  addFolder,
  isFileNodeKind,
  renameDriveNode,
  setSelectedNode,
  showCreateDocumentModal,
  showDeleteNodeModal,
  useAllowedDocumentModelModules,
  useAttachmentPreview,
  useAttachments,
  useDocumentSafe,
  useEditorFileDrop,
  useSelectedDrive,
  useSelectedFolder,
} from "@powerhousedao/reactor-browser";
import type { FolderNode, Node } from "@powerhousedao/shared/document-drive";
import { isFileDocument } from "document-models/file";
import { memo, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useFillHeight, useNarrow } from "../../backfills/components/measure.js";
import { rememberTags, TagBadges } from "../../sektar/components/FileDetail.js";
import {
  FileItemPreview,
  FileTypeTile,
  iconForType,
  itemFromKey,
  itemKey,
  LinkedDocumentPreview,
  renditionName,
  SOURCE_ITEM,
  useTypeName,
  type PreviewItem,
} from "../../sektar/components/FilePreview.js";
import { useFilesList, type FileListRow } from "../../sektar/kit/files-index.js";
import { hiddenSyncIds, SYNC_TYPE } from "../../sektar/kit/folder-sync.js";
import { bytes, createEmptyFile, createFileFromUpload, FILE_TYPE, fileKind } from "../../sektar/kit/files.js";
import { Menu } from "../../sektar/kit/menu.js";
import { useSearch } from "../../sektar/kit/search-context.js";
import { Button, cx, EmptyState, Icon, Modal, Selector, Skeleton } from "../../sektar/kit/ui.js";
import { useRowWindow } from "../../sektar/kit/virtual.js";
import { Pane, Workspace } from "../../sektar/kit/workspace.js";
import { SyncGlyph } from "../../sektar/kit/sync-glyphs.js";
import { MappedFolders, SyncMenu } from "./SyncMenu.js";

type ViewMode = "list" | "grid";
const VIEW_KEY = "sk:files-view";
const DEEP_KEY = "sk:files-deep";

/** How long a scroll is left to settle before the pages under it are fetched. */
const ENSURE_DEBOUNCE_MS = 60;
/** A grid card's minimum width and the gap between cards (as the stylesheet sets them). */
const CARD_MIN = 168;
const CARD_GAP = 16;

function stored(key: string, fallback: string): string {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

const byName = (a: Node, b: Node) =>
  a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });

export function FilesWorkspace({ children }: { children?: ReactNode }) {
  const [drive] = useSelectedDrive();
  const folder = useSelectedFolder();
  const client = useAttachments();
  const { query } = useSearch();
  const allNodes = drive.state.global.nodes;
  // The folder syncs' own `.sync` folder stays out of sight (as it does in the index).
  const nodes = useMemo(() => {
    const hidden = hiddenSyncIds(allNodes);
    return hidden.size ? allNodes.filter((n) => !hidden.has(n.id)) : allNodes;
  }, [allNodes]);
  const currentId = folder?.id ?? null;

  const [picked, setPicked] = useState<FileListRow | null>(null);
  const [view, setView] = useState<ViewMode>(() => (stored(VIEW_KEY, "list") === "grid" ? "grid" : "list"));
  const [deep, setDeep] = useState<boolean>(() => stored(DEEP_KEY, "0") === "1");
  // Stacked, one screen at a time; the design system counts screens from 1:
  // 1 folders · 2 the folder's contents · 3 the preview.
  const [level, setLevel] = useState(2);
  const [treeCollapsed, setTreeCollapsed] = useState(false);
  const [previewPref, setPreviewPref] = useState<boolean | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  /** The folders a folder sync maps to disk ("" is the drive's root), with where they go. */
  const [mapped, setMapped] = useState<Map<string, string>>(() => new Map());
  const [naming, setNaming] = useState<{ kind: "folder" } | { kind: "rename"; row: FileListRow } | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const height = useFillHeight(root, !children);
  const narrow = useNarrow(root, 1100, !children);
  // Stacked (under 800px of workspace) every pane is a full screen: none collapses.
  const stacked = useNarrow(root, 800, !children);
  const previewCollapsed = !stacked && (previewPref ?? narrow);

  useEffect(() => {
    try {
      localStorage.setItem(VIEW_KEY, view);
      localStorage.setItem(DEEP_KEY, deep ? "1" : "0");
    } catch {
      // no storage, no memory
    }
  }, [view, deep]);
  // A new folder starts with nothing picked; a new folder, scope, search or
  // layout starts at the top (a scroll position from a long list would land
  // past the end of a shorter one).
  useEffect(() => {
    setPicked(null);
  }, [currentId, deep]);
  useEffect(() => {
    if (body.current) body.current.scrollTop = 0;
  }, [currentId, deep, query, view]);

  /* -- the listing, from the index -- */
  const list = useFilesList(drive, { folderId: currentId, deep, query });
  // The drive changed (a node added, moved, renamed, deleted): the index
  // follows within a beat, and any page in view may have moved.
  const { invalidate } = list;
  const driveRevision = drive.header.lastModifiedAtUtcIso;
  useEffect(() => {
    invalidate();
  }, [driveRevision, invalidate]);

  /* -- the drive's folders: the tree, counts, paths (small next to the files) -- */
  const folderInfo = useMemo(() => {
    const byId = new Map<string, FolderNode>();
    const counts = new Map<string | null, number>();
    for (const n of nodes) {
      if (n.kind === "folder") byId.set(n.id, n as FolderNode);
      const p = n.parentFolder ?? null;
      counts.set(p, (counts.get(p) ?? 0) + 1);
    }
    return { byId, counts };
  }, [nodes]);
  const pathTo = (id: string | null): FolderNode[] => {
    const out: FolderNode[] = [];
    const seen = new Set<string>();
    for (let cur = id; cur && !seen.has(cur); ) {
      seen.add(cur);
      const f = folderInfo.byId.get(cur);
      if (!f) break;
      out.unshift(f);
      cur = f.parentFolder ?? null;
    }
    return out;
  };
  /** Where a document lives below the open folder, in a view that includes subfolders. */
  const whereOf = (row: FileListRow): string | null => {
    if (!deep || row.parentId === currentId) return null;
    const path = pathTo(row.parentId);
    const at = path.findIndex((f) => f.id === currentId);
    return path.slice(at + 1).map((f) => f.name).join(" / ") || null;
  };

  /* -- the window -- */
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = body.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, [children]);
  const cols = view === "grid" ? Math.max(1, Math.floor((Math.max(width, CARD_MIN) - CARD_GAP * 2 + CARD_GAP) / (CARD_MIN + CARD_GAP))) : 1;
  const lineCount = view === "grid" ? Math.ceil(list.total / cols) : list.total;
  const win = useRowWindow(body, lineCount, { estimate: view === "grid" ? 268 : 76, mounted: `${view}|${cols}` });
  const { ensure, rowAt } = list;
  useEffect(() => {
    const timer = setTimeout(() => ensure(win.start * cols, win.end * cols), ENSURE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [ensure, win.start, win.end, cols, list.version]);
  const lines = useMemo(() => {
    const out: { line: number; items: { index: number; row: FileListRow | undefined }[] }[] = [];
    // While rows are added, pages read at different moments overlap: the
    // same row can sit at the end of one and the start of the next. It is
    // shown once (a second copy would also be a duplicate React key) and
    // its second slot shows a placeholder until that page is re-read.
    const seen = new Set<string>();
    for (let l = win.start; l < win.end; l++) {
      const items = [];
      for (let c = 0; c < cols; c++) {
        const index = l * cols + c;
        if (index >= list.total) break;
        const row = rowAt(index);
        if (row && seen.has(row.id)) {
          items.push({ index, row: undefined });
          continue;
        }
        if (row) seen.add(row.id);
        items.push({ index, row });
      }
      out.push({ line: l, items });
    }
    return out;
  }, [win.start, win.end, cols, list.total, rowAt]);
  const firstReal = lines.find((l) => l.items.some((i) => i.row))?.line;
  useEffect(() => {
    rememberTags(lines.flatMap((l) => l.items.flatMap((i) => i.row?.tags ?? [])));
  }, [lines]);

  /* -- actions -- */
  const openRow = (row: FileListRow) => setSelectedNode(row.id);
  const goFolder = (id: string | null) => {
    setSelectedNode(id ?? undefined);
    setLevel(2);
  };
  const pick = (row: FileListRow) => {
    setPicked(row);
    setLevel(3);
  };
  const activate = (row: FileListRow) => (row.kind === "folder" ? goFolder(row.id) : openRow(row));

  const upload = (files: File[]) => {
    if (files.length === 0) return;
    setStatus(files.length === 1 ? `Adding ${files[0].name}…` : `Adding ${files.length} files…`);
    files
      .reduce<Promise<string | void>>(
        (p, f) => p.then(() => createFileFromUpload(client, drive.header.id, currentId ?? undefined, f)),
        Promise.resolve(),
      )
      .then(() => setStatus(files.length === 1 ? `Added ${files[0].name}` : `Added ${files.length} files`))
      .catch((e: unknown) => setStatus(`Could not add: ${e instanceof Error ? e.message : String(e)}`))
      .finally(() => setTimeout(() => setStatus(null), 3000));
  };
  const { dragProps, isDragOver } = useEditorFileDrop({ onFiles: upload });

  const modules = useAllowedDocumentModelModules();
  const newItems = [
    { label: "Folder", icon: "folder" as const, onSelect: () => setNaming({ kind: "folder" }) },
    {
      label: "File",
      icon: "reports" as const,
      onSelect: () => void createEmptyFile(drive.header.id, currentId ?? undefined).then((id) => setSelectedNode(id)),
    },
    { label: "Upload files…", icon: "upload" as const, onSelect: () => input.current?.click() },
    ...(modules ?? [])
      .filter((m) => {
        const id = m.documentModel.global.id;
        // Folder syncs are made from the Folders pane's sync menu, into `.sync`.
        return id !== FILE_TYPE && id !== SYNC_TYPE && !id.startsWith("powerhouse/");
      })
      .map((m) => ({
        label: m.documentModel.global.name || m.documentModel.global.id,
        icon: iconForType(m.documentModel.global.id),
        onSelect: () => showCreateDocumentModal(m.documentModel.global.id),
      })),
  ];

  // An opened document fills the app; Connect's toolbar closes it again.
  if (children) {
    return <div className="sk-files-doc">{children}</div>;
  }

  const path = pathTo(currentId);
  const driveName = drive.header.name || drive.state.global.name || "Files";
  const words = query.trim();
  const pickedNode = picked ? nodes.find((n) => n.id === picked.id) : undefined;

  return (
    <div ref={root} className="sk-files" style={{ height: height ? `${height}px` : undefined }}>
      <input
        ref={input}
        type="file"
        multiple
        hidden
        onChange={(e) => {
          upload([...(e.target.files ?? [])]);
          e.target.value = "";
        }}
      />
      <Workspace level={level}>
        <Pane
          side="start"
          grow={0.55}
          flush
          collapsed={!stacked && treeCollapsed}
          onToggle={() => setTreeCollapsed((v) => !v)}
          title="Folders"
          trailing={
            <SyncMenu
              driveId={drive.header.id}
              driveName={drive.header.name || drive.state.global.name || "Files"}
              nodes={allNodes}
              currentId={currentId}
              onStatus={(message) => {
                setStatus(message);
                setTimeout(() => setStatus(null), 4000);
              }}
            />
          }
        >
          <MappedFolders driveId={drive.header.id} nodes={allNodes} onChange={setMapped} />
          <FolderTree nodes={nodes} counts={folderInfo.counts} driveName={driveName} currentId={currentId} mapped={mapped} onGo={goFolder} />
        </Pane>

        <Pane
          grow={1.5}
          flush
          bodyRef={body}
          onBack={() => setLevel(1)}
          backLabel="Back to folders"
          header={
            <>
              <span className="sk-files-crumbs">
                {path.length > 0 && (
                  <button type="button" onClick={() => goFolder(null)}>
                    {driveName}
                  </button>
                )}
                {path.slice(0, -1).map((f) => (
                  <span key={f.id} className="sk-files-crumbs">
                    <Icon name="chevron-right" mono />
                    <button type="button" onClick={() => goFolder(f.id)}>
                      {f.name}
                    </button>
                  </span>
                ))}
                {path.length > 0 && <Icon name="chevron-right" mono />}
                <h2 className="sk-pane__title">{path.at(-1)?.name ?? driveName}</h2>
              </span>
              <span className="sk-pane__count">{list.total.toLocaleString()}</span>
              {deep && <span className="sk-caption sk-files-scope">incl. subfolders</span>}
            </>
          }
          trailing={
            <span className="sk-row" style={{ gap: "var(--sk-space-2)", flexWrap: "nowrap" }}>
              {status && <span className="sk-caption sk-files-status">{status}</span>}
              <Menu
                label="View settings"
                items={[
                  { section: "Layout", label: "List", icon: "menu", active: view === "list", onSelect: () => setView("list") },
                  { label: "Grid", icon: "dashboard", active: view === "grid", onSelect: () => setView("grid") },
                  { section: "Show", label: "This folder only", icon: "folder", active: !deep, onSelect: () => setDeep(false) },
                  { label: "Include subfolders", icon: "copy", active: deep, onSelect: () => setDeep(true) },
                ]}
                trigger={(open, toggle) => (
                  <Button
                    size="sm"
                    variant="ghost"
                    iconOnly
                    icon="settings"
                    className={cx(deep && "sk-files-settings--on")}
                    aria-haspopup="menu"
                    aria-expanded={open}
                    aria-label="View settings"
                    title="View settings"
                    onClick={toggle}
                  />
                )}
              />
              <Menu
                label="New"
                items={newItems}
                trigger={(open, toggle) => (
                  <Button size="sm" variant="primary" icon="plus" aria-haspopup="menu" aria-expanded={open} onClick={toggle}>
                    New
                  </Button>
                )}
              />
            </span>
          }
        >
          <div {...dragProps} className={cx("sk-files-contents", isDragOver && "is-over")}>
            {list.total === 0 ? (
              <div style={{ padding: "var(--sk-space-10) var(--sk-space-6)" }}>
                {list.loaded ? (
                  <EmptyState
                    icon={words ? "search" : "upload"}
                    title={words ? "Nothing matches" : deep ? "No documents here or below" : "This folder is empty"}
                    action={
                      !words && (
                        <Button variant="secondary" icon="upload" onClick={() => input.current?.click()} disabled={!client}>
                          Upload files
                        </Button>
                      )
                    }
                  >
                    {list.error
                      ? `The files index did not answer: ${list.error}`
                      : words
                        ? "No file or folder here matches that search."
                        : "Drop files here, or upload them: each becomes a File you can describe, tag and extract content into."}
                  </EmptyState>
                ) : (
                  <div className="sk-stack sk-stack--4">
                    {[0, 1, 2, 3, 4].map((i) => (
                      <Skeleton key={i} height={60} />
                    ))}
                  </div>
                )}
              </div>
            ) : view === "grid" ? (
              <div
                className="sk-files-grid sk-files-grid--windowed"
                aria-busy={list.stale || undefined}
                style={{ paddingTop: win.padTop + CARD_GAP, paddingBottom: win.padBottom }}
              >
                {lines.map(({ line, items }) => (
                  <div
                    key={line}
                    className="sk-files-grid__line"
                    style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
                    ref={line === firstReal ? win.measure : undefined}
                  >
                    {items.map(({ index, row }) =>
                      row ? (
                        <Card key={row.id} row={row} where={whereOf(row)} childCount={folderInfo.counts.get(row.id) ?? 0} picked={picked?.id === row.id} onPick={() => pick(row)} onOpen={() => activate(row)} />
                      ) : (
                        <div key={`at-${index}`} className="sk-files-card sk-files-card--placeholder" aria-hidden="true">
                          <span className="sk-files-card__thumb" />
                          <span className="sk-files-card__body">
                            <Skeleton width="70%" height={12} />
                            <Skeleton width="45%" height={10} />
                          </span>
                        </div>
                      ),
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <ul
                className="sk-list sk-list--rich"
                data-sk-more={win.end < list.total ? "" : undefined}
                aria-busy={list.stale || undefined}
                style={{ paddingTop: win.padTop, paddingBottom: win.padBottom }}
              >
                {lines.map(({ line, items }) => {
                  const { row } = items[0] ?? { row: undefined };
                  return row ? (
                    <li key={row.id} ref={line === firstReal ? win.measure : undefined}>
                      <Row row={row} where={whereOf(row)} childCount={folderInfo.counts.get(row.id) ?? 0} picked={picked?.id === row.id} onPick={() => pick(row)} onOpen={() => activate(row)} />
                    </li>
                  ) : (
                    <li key={`at-${line}`} className="sk-mail__placeholder" style={{ height: win.rowHeight }} aria-hidden="true">
                      <Skeleton width={34} height={40} />
                      <span className="sk-mail__placeholder-lines">
                        <Skeleton width="45%" height={12} />
                        <Skeleton width="70%" height={12} />
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </Pane>

        <Pane
          side="end"
          grow={1.1}
          collapsed={previewCollapsed}
          onToggle={() => setPreviewPref(!previewCollapsed)}
          onBack={() => setLevel(2)}
          backLabel="Back to the folder"
          collapsedTitle="Preview"
          title={picked ? undefined : "Preview"}
          header={
            picked && (
              <>
                <h2 className="sk-pane__title">{picked.title ?? picked.name}</h2>
                <span className="sk-pane__spacer" />
                <Menu
                  label="Item actions"
                  items={[
                    { label: "Open", onSelect: () => activate(picked) },
                    { label: "Rename…", onSelect: () => setNaming({ kind: "rename", row: picked }) },
                    {
                      label: "Delete…",
                      danger: true,
                      disabled: !pickedNode,
                      onSelect: () => {
                        if (pickedNode) showDeleteNodeModal(pickedNode);
                      },
                    },
                  ]}
                  trigger={(open, toggle) => (
                    <button type="button" className="sk-more" aria-haspopup="menu" aria-expanded={open} aria-label="Item actions" onClick={toggle}>
                      <span />
                    </button>
                  )}
                />
              </>
            )
          }
        >
          {picked ? (
            <ItemPreview key={picked.id} row={picked} childCount={folderInfo.counts.get(picked.id) ?? 0} nodes={nodes} onOpen={() => activate(picked)} />
          ) : (
            <EmptyState icon="reports" title="Pick something">
              A file's source and its extracted content preview here. Double-click to open it.
            </EmptyState>
          )}
        </Pane>
      </Workspace>

      {naming && (
        <NameModal
          title={naming.kind === "folder" ? "New folder" : "Rename"}
          initial={naming.kind === "rename" ? naming.row.name : ""}
          action={naming.kind === "folder" ? "Create" : "Rename"}
          onClose={() => setNaming(null)}
          onSave={(name) => {
            if (naming.kind === "folder") void addFolder(drive.header.id, name, currentId ?? undefined);
            else void renameDriveNode(drive.header.id, naming.row.id, name);
            setNaming(null);
          }}
        />
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- tree */

function FolderTree({
  nodes,
  counts,
  driveName,
  currentId,
  mapped,
  onGo,
}: {
  nodes: readonly Node[];
  counts: Map<string | null, number>;
  driveName: string;
  currentId: string | null;
  /** Folders a folder sync maps to disk ("" is the root): they get the synced-folder glyph */
  mapped: Map<string, string>;
  onGo: (id: string | null) => void;
}) {
  const folderIcon = (key: string) =>
    mapped.has(key) ? <SyncGlyph name="folder-sync" size={16} /> : <Icon name="folder" size={16} />;
  const syncedTo = (key: string) => (mapped.has(key) ? `Synced to ${mapped.get(key)}` : undefined);
  const children = useMemo(() => {
    const map = new Map<string | null, FolderNode[]>();
    for (const n of nodes) {
      if (n.kind !== "folder") continue;
      const k = n.parentFolder ?? null;
      const list = map.get(k);
      if (list) list.push(n as FolderNode);
      else map.set(k, [n as FolderNode]);
    }
    for (const list of map.values()) list.sort(byName);
    return map;
  }, [nodes]);
  const parentOf = useMemo(() => {
    const m = new Map<string, string | null>();
    for (const n of nodes) if (n.kind === "folder") m.set(n.id, n.parentFolder ?? null);
    return m;
  }, [nodes]);
  // Opening a folder opens the path to it, once; after that the tree is as
  // the reader leaves it. Re-opening the path whenever the drive changed
  // (any node added anywhere hands out a new node list) undid a collapse a
  // moment after it was made.
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const expandedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!currentId || expandedFor.current === currentId) return;
    // The folder may not be in the list yet (a URL opened before the drive
    // arrived); expand once it is.
    if (!parentOf.has(currentId)) return;
    expandedFor.current = currentId;
    setOpen((prev) => {
      const next = new Set(prev);
      for (let cur: string | null | undefined = currentId; cur; cur = parentOf.get(cur)) next.add(cur);
      return next;
    });
  }, [currentId, parentOf]);

  const render = (parent: string | null, depth: number): ReactNode =>
    (children.get(parent) ?? []).map((f) => {
      const kids = children.get(f.id)?.length ?? 0;
      const isOpen = open.has(f.id);
      return (
        <li key={f.id}>
          <button
            type="button"
            className={cx("sk-files-tree__item", currentId === f.id && "is-active")}
            style={{ "--depth": depth } as React.CSSProperties}
            onClick={() => onGo(f.id)}
            aria-current={currentId === f.id ? "true" : undefined}
            title={syncedTo(f.id)}
          >
            <span
              className={cx("sk-files-tree__twist", isOpen && "is-open")}
              role={kids ? "button" : undefined}
              aria-label={kids ? (isOpen ? "Collapse" : "Expand") : undefined}
              onClick={(e) => {
                if (!kids) return;
                e.stopPropagation();
                setOpen((prev) => {
                  const next = new Set(prev);
                  if (next.has(f.id)) next.delete(f.id);
                  else next.add(f.id);
                  return next;
                });
              }}
            >
              {kids > 0 && <Icon name="chevron-right" mono />}
            </span>
            {folderIcon(f.id)}
            <span className="sk-files-tree__name">{f.name}</span>
            <span className="sk-files-tree__count">{counts.get(f.id) || ""}</span>
          </button>
          {kids > 0 && isOpen && <ul className="sk-files-tree">{render(f.id, depth + 1)}</ul>}
        </li>
      );
    });

  return (
    <ul className="sk-files-tree">
      <li>
        <button
          type="button"
          className={cx("sk-files-tree__item", currentId === null && "is-active")}
          onClick={() => onGo(null)}
          aria-current={currentId === null ? "true" : undefined}
          title={syncedTo("")}
        >
          <span className="sk-files-tree__twist" />
          {folderIcon("")}
          <span className="sk-files-tree__name">{driveName}</span>
          <span className="sk-files-tree__count">{counts.get(null) || ""}</span>
        </button>
      </li>
      {render(null, 1)}
    </ul>
  );
}

/* ----------------------------------------------------------- the rows */

/** What a File is, in one line: its description, else its source. */
function subline(row: FileListRow): string {
  if (row.description) return row.description;
  if (row.sourceKind === "DOCUMENT") return `Linked: ${row.sourceDocumentName ?? row.sourceDocumentType ?? "document"}`;
  if (row.sourceKind === "ATTACHMENT") {
    // The name is the title already when the file was dropped as is: say what it is instead.
    const shown = row.title ?? row.name;
    const name = row.sourceName && row.sourceName !== shown ? row.sourceName : row.sourceMime;
    return [name, bytes(row.sourceSize)].filter(Boolean).join(" · ");
  }
  return "No source yet";
}

function Tile({ row }: { row: FileListRow }) {
  if (row.kind === "folder") {
    return (
      <span className="sk-icon-tile">
        <Icon name="folder" />
      </span>
    );
  }
  if (row.documentType !== FILE_TYPE) {
    return (
      <span className="sk-icon-tile">
        <Icon name={iconForType(row.documentType)} />
      </span>
    );
  }
  if (row.sourceKind === "DOCUMENT") {
    return (
      <span className="sk-icon-tile">
        <Icon name={iconForType(row.sourceDocumentType)} />
      </span>
    );
  }
  return <FileTypeTile kind={fileKind(row.sourceMime, row.sourceName ?? row.name)} />;
}

function Where({ path }: { path: string }) {
  return (
    <span className="sk-files-where" title={path}>
      <Icon name="folder" size={16} />
      {path}
    </span>
  );
}

interface ItemProps {
  row: FileListRow;
  where: string | null;
  childCount: number;
  picked: boolean;
  onPick: () => void;
  onOpen: () => void;
}

const keyOpens = (onOpen: () => void) => (e: React.KeyboardEvent) => {
  if (e.key === "Enter") {
    e.preventDefault();
    onOpen();
  }
};

/** A rich row that picks on click and opens on double-click or Enter. Re-renders only for its own row. */
const Row = memo(function Row({ row, where, childCount, picked, onPick, onOpen }: ItemProps) {
  const typeName = useTypeName(row.documentType);
  const isFile = row.documentType === FILE_TYPE;
  return (
    <button
      type="button"
      className={cx("sk-list-item sk-list-item--rich", picked && "is-picked")}
      aria-pressed={picked}
      data-sk-drill={3}
      onClick={onPick}
      onDoubleClick={onOpen}
      onKeyDown={keyOpens(onOpen)}
    >
      <Tile row={row} />
      <div className="sk-list-item__body">
        <div className="sk-list-item__title">{row.title ?? row.name}</div>
        <div className="sk-list-item__sub">
          {row.kind === "folder" ? (childCount === 1 ? "1 item" : `${childCount.toLocaleString()} items`) : isFile ? subline(row) : typeName}
        </div>
        {row.tags.length > 0 && (
          <div className="sk-list-item__tags">
            <TagBadges tags={row.tags} />
          </div>
        )}
      </div>
      <div className="sk-list-item__aside">
        {where && <Where path={where} />}
        {isFile && row.renditionCount > 0 && (
          <span>
            {row.renditionCount} {row.renditionCount === 1 ? "version" : "versions"}
          </span>
        )}
        {row.kind === "file" && !isFile && <span>{typeName}</span>}
      </div>
      <Icon name="chevron-right" className="sk-drill-chevron" />
    </button>
  );
}, sameItem);

function Thumb({ documentId, refId, fallback }: { documentId: string; refId: string; fallback: ReactNode }) {
  const preview = useAttachmentPreview({ documentId, ref: refId as `attachment://v${number}:${string}` });
  const url = preview.stage === "done" && !preview.loading ? preview.url : undefined;
  return url ? <img src={url} alt="" loading="lazy" /> : <>{fallback}</>;
}

const Card = memo(function Card({ row, where, childCount, picked, onPick, onOpen }: ItemProps) {
  const typeName = useTypeName(row.documentType);
  const tile = <Tile row={row} />;
  return (
    <button
      type="button"
      className={cx("sk-files-card", picked && "is-picked")}
      aria-pressed={picked}
      onClick={onPick}
      onDoubleClick={onOpen}
      onKeyDown={keyOpens(onOpen)}
    >
      <span className="sk-files-card__thumb">
        {row.thumbRef ? <Thumb documentId={row.id} refId={row.thumbRef} fallback={tile} /> : tile}
      </span>
      <span className="sk-files-card__body">
        <span className="sk-files-card__name">{row.title ?? row.name}</span>
        <span className="sk-files-card__meta">
          {row.kind === "folder"
            ? childCount === 1
              ? "1 item"
              : `${childCount.toLocaleString()} items`
            : row.documentType === FILE_TYPE
              ? subline(row)
              : typeName}
        </span>
        {(where || row.tags.length > 0) && (
          <>
            {where && <Where path={where} />}
            {row.tags.length > 0 && <TagBadges tags={row.tags} max={2} />}
          </>
        )}
      </span>
    </button>
  );
}, sameItem);

function sameItem(a: ItemProps, b: ItemProps): boolean {
  return a.row === b.row && a.picked === b.picked && a.where === b.where && a.childCount === b.childCount;
}

/* ------------------------------------------------------------- preview */

function ItemPreview({
  row,
  childCount,
  nodes,
  onOpen,
}: {
  row: FileListRow;
  childCount: number;
  nodes: readonly Node[];
  onOpen: () => void;
}) {
  if (row.kind === "folder") {
    const sub = nodes.filter((n) => n.kind === "folder" && n.parentFolder === row.id).length;
    return (
      <div className="sk-files-preview">
        <div className="sk-file-linked">
          <span className="sk-icon-tile sk-icon-tile--lg">
            <Icon name="folder" />
          </span>
          <div className="sk-file-linked__body">
            <div className="sk-eyebrow">Folder</div>
            <div className="sk-file-linked__name">{row.name}</div>
            <div className="sk-caption">
              {(childCount - sub).toLocaleString()} {childCount - sub === 1 ? "document" : "documents"} · {sub}{" "}
              {sub === 1 ? "folder" : "folders"}
            </div>
          </div>
          <Button size="sm" variant="secondary" onClick={onOpen}>
            Open
          </Button>
        </div>
      </div>
    );
  }
  if (row.documentType !== FILE_TYPE) {
    return <LinkedDocumentPreview documentId={row.id} documentType={row.documentType} documentName={row.name} />;
  }
  return <FilePreviewPanel row={row} nodes={nodes} onOpen={onOpen} />;
}

/** A File in the preview pane: the one document this view loads. */
function FilePreviewPanel({ row, nodes, onOpen }: { row: FileListRow; nodes: readonly Node[]; onOpen: () => void }) {
  const q = useDocumentSafe(row.id);
  const doc = q.data && isFileDocument(q.data) ? q.data : undefined;
  const [item, setItem] = useState<PreviewItem>(SOURCE_ITEM);
  const known = nodes.some((n) => n.id === row.id && isFileNodeKind(n));
  if (!doc) {
    return (
      <div className="sk-files-preview">
        <h3 className="sk-files-preview__title">{row.title ?? row.name}</h3>
        {q.error && known ? (
          <p className="sk-small sk-text-danger">The file could not be read.</p>
        ) : (
          <div className="sk-stack sk-stack--3">
            <Skeleton height={14} width="60%" />
            <Skeleton height={240} />
          </div>
        )}
      </div>
    );
  }
  const s = doc.state.global;
  const options = [
    {
      value: "source",
      name: "Source",
      meta: s.source ? (s.source.kind === "DOCUMENT" ? "Document" : (s.source.mimeType ?? "File")) : "Not set",
      icon: "upload" as const,
    },
    ...s.renditions.map((r) => ({
      value: itemKey({ kind: "rendition", id: r.id }),
      name: renditionName(r),
      meta: r.mimeType,
      icon: "copy" as const,
    })),
  ];
  return (
    <div className="sk-files-preview">
      <div className="sk-stack sk-stack--2">
        <h3 className="sk-files-preview__title">{s.title ?? doc.header.name}</h3>
        {s.description && <p className="sk-files-preview__desc">{s.description}</p>}
        <TagBadges tags={s.tags} max={8} />
      </div>
      <div className="sk-row" style={{ gap: "var(--sk-space-2)", alignItems: "center" }}>
        <div className="sk-grow" style={{ minWidth: 0 }}>
          {options.length > 1 && (
            <Selector value={itemKey(item)} options={options} onChange={(k) => setItem(itemFromKey(k))} label="Show" />
          )}
        </div>
        <Button size="sm" variant="secondary" icon="arrow-up-right" onClick={onOpen}>
          Open
        </Button>
      </div>
      <FileItemPreview doc={doc} item={item} />
    </div>
  );
}

/* ---------------------------------------------------------------- name */

function NameModal({
  title,
  initial,
  action,
  onClose,
  onSave,
}: {
  title: string;
  initial: string;
  action: string;
  onClose: () => void;
  onSave: (name: string) => void;
}) {
  const [name, setName] = useState(initial);
  const valid = name.trim() !== "";
  return (
    <Modal
      title={title}
      onClose={onClose}
      footer={
        <>
          <span className="sk-grow" />
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={!valid} onClick={() => onSave(name.trim())}>
            {action}
          </Button>
        </>
      }
    >
      <label className="sk-field">
        <span className="sk-label">Name</span>
        <input
          className="sk-input"
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && valid) onSave(name.trim());
          }}
        />
      </label>
    </Modal>
  );
}
