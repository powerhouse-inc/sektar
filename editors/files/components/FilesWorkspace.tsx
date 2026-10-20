// The Files drive app: the design system's panes workspace over a drive.
// Folders on the left, the folder's contents (a list or a grid of cards with
// thumbnails) in the middle, the picked item previewed on the right; stacked
// under 640px of width as a push navigation. Files dropped anywhere on the
// contents become File documents; a document that is opened fills the app.
import {
  addFolder,
  isFileNodeKind,
  isFolderNodeKind,
  renameDriveNode,
  setSelectedNode,
  showCreateDocumentModal,
  showDeleteNodeModal,
  useAllowedDocumentModelModules,
  useAttachmentPreview,
  useAttachments,
  useDocumentsByIds,
  useEditorFileDrop,
  useSelectedDrive,
  useSelectedFolder,
} from "@powerhousedao/reactor-browser";
import type { FileNode, FolderNode, Node } from "@powerhousedao/shared/document-drive";
import { isFileDocument, type FileDocument } from "document-models/file";
import { useDeferredValue, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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
import {
  bytes,
  createEmptyFile,
  createFileFromUpload,
  FILE_TYPE,
  fileKind,
} from "../../sektar/kit/files.js";
import { Menu } from "../../sektar/kit/menu.js";
import { useSearch } from "../../sektar/kit/search-context.js";
import {
  Button,
  cx,
  EmptyState,
  Icon,
  Modal,
  Selector,
} from "../../sektar/kit/ui.js";
import { Pane, Workspace } from "../../sektar/kit/workspace.js";

type ViewMode = "list" | "grid";
const VIEW_KEY = "sk:files-view";

function storedView(): ViewMode {
  try {
    return localStorage.getItem(VIEW_KEY) === "grid" ? "grid" : "list";
  } catch {
    return "list";
  }
}

const DEEP_KEY = "sk:files-deep";

/** Whether the contents include every folder below the open one. */
function storedDeep(): boolean {
  try {
    return localStorage.getItem(DEEP_KEY) === "1";
  } catch {
    return false;
  }
}

const byName = (a: Node, b: Node) =>
  a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });

export function FilesWorkspace({ children }: { children?: ReactNode }) {
  const [drive] = useSelectedDrive();
  const folder = useSelectedFolder();
  const client = useAttachments();
  const { query } = useSearch();
  const nodes = drive.state.global.nodes;
  const currentId = folder?.id ?? null;

  const [picked, setPicked] = useState<string | null>(null);
  const [view, setView] = useState<ViewMode>(storedView);
  const [deep, setDeep] = useState<boolean>(storedDeep);
  // Stacked, one screen at a time; the design system counts screens from 1:
  // 1 folders · 2 the folder's contents · 3 the preview.
  const [level, setLevel] = useState(2);
  const [treeCollapsed, setTreeCollapsed] = useState(false);
  const [previewPref, setPreviewPref] = useState<boolean | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [naming, setNaming] = useState<{ kind: "folder" } | { kind: "rename"; node: Node } | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const root = useRef<HTMLDivElement>(null);
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
  // A new folder starts with nothing picked.
  useEffect(() => setPicked(null), [currentId]);

  /* -- the folder's contents, and the File documents among them -- */
  // One folder, or (deep) the folder and every folder below it. Deep, the
  // documents are the list: folders are only where they live, not items.
  const below = useMemo(
    () => (deep ? descendantFolders(nodes, currentId) : null),
    [deep, nodes, currentId],
  );
  const here = useMemo(
    () =>
      nodes.filter((n) => {
        const parent = n.parentFolder ?? null;
        if (parent === currentId) return true;
        return below !== null && parent !== null && below.has(parent);
      }),
    [nodes, currentId, below],
  );
  const folders = useMemo(
    () => (deep ? [] : here.filter(isFolderNodeKind).sort(byName)),
    [here, deep],
  );
  const docs = useMemo(() => here.filter(isFileNodeKind).sort(byName), [here]);
  /** Where a document lives below the open folder; null when it is right here. */
  const whereOf = (n: Node): string | null => {
    const parent = n.parentFolder ?? null;
    if (!deep || parent === currentId) return null;
    const path = folderPath(nodes, parent);
    const at = path.findIndex((f) => f.id === currentId);
    return (
      path
        .slice(at + 1)
        .map((f) => f.name)
        .join(" / ") || null
    );
  };
  const fileKey = docs.filter((n) => n.documentType === FILE_TYPE).map((n) => n.id).join(",");
  const fileIds = useMemo(() => (fileKey ? fileKey.split(",") : []), [fileKey]);
  // Deferred: a new id makes the batch suspend, and suspending on the live
  // value would blank the workspace for every file that arrives.
  const settled = useDeferredValue(fileIds);
  const fileDocs = useDocumentsByIds(settled);
  const files = useMemo(() => {
    const map = new Map<string, FileDocument>();
    for (const d of fileDocs) if (isFileDocument(d)) map.set(d.header.id, d);
    return map;
  }, [fileDocs]);
  useEffect(() => {
    for (const f of files.values()) rememberTags(f.state.global.tags);
  }, [files]);

  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const matches = (n: Node) => {
    if (words.length === 0) return true;
    const f = files.get(n.id);
    const hay = [
      n.name,
      f?.state.global.title,
      f?.state.global.description,
      ...(f?.state.global.tags.map((t) => t.label) ?? []),
      f?.state.global.source?.fileName,
      f?.state.global.source?.documentName,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return words.every((w) => hay.includes(w));
  };
  const shownFolders = folders.filter(matches);
  const shownDocs = docs.filter(matches);
  const total = shownFolders.length + shownDocs.length;

  const pickedNode = nodes.find((n) => n.id === picked) ?? null;

  /* -- actions -- */
  const openNode = (n: Node) => setSelectedNode(n.id);
  const goFolder = (id: string | null) => {
    setSelectedNode(id ?? undefined);
    setLevel(2);
  };
  const pick = (n: Node) => {
    setPicked(n.id);
    setLevel(3);
  };

  const upload = (list: File[]) => {
    if (list.length === 0) return;
    setStatus(list.length === 1 ? `Adding ${list[0].name}…` : `Adding ${list.length} files…`);
    list
      .reduce<Promise<string | void>>(
        (p, f) => p.then(() => createFileFromUpload(client, drive.header.id, currentId ?? undefined, f)),
        Promise.resolve(),
      )
      .then(() => setStatus(list.length === 1 ? `Added ${list[0].name}` : `Added ${list.length} files`))
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
      onSelect: () =>
        void createEmptyFile(drive.header.id, currentId ?? undefined).then((id) => setSelectedNode(id)),
    },
    { label: "Upload files…", icon: "upload" as const, onSelect: () => input.current?.click() },
    ...(modules ?? [])
      .filter((m) => {
        const id = m.documentModel.global.id;
        return id !== FILE_TYPE && !id.startsWith("powerhouse/");
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

  const path = folderPath(nodes, currentId);
  const driveName = drive.header.name || drive.state.global.name || "Files";

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
        >
          <FolderTree
            nodes={nodes}
            driveName={driveName}
            currentId={currentId}
            onGo={goFolder}
          />
        </Pane>

        <Pane
          grow={1.5}
          flush
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
              <span className="sk-pane__count">{total}</span>
              {deep && <span className="sk-caption sk-files-scope">incl. subfolders</span>}
            </>
          }
          trailing={
            <span className="sk-row" style={{ gap: "var(--sk-space-2)", flexWrap: "nowrap" }}>
              {status && <span className="sk-caption sk-files-status">{status}</span>}
              <Menu
                label="View settings"
                items={[
                  {
                    section: "Layout",
                    label: "List",
                    icon: "menu",
                    active: view === "list",
                    onSelect: () => setView("list"),
                  },
                  {
                    label: "Grid",
                    icon: "dashboard",
                    active: view === "grid",
                    onSelect: () => setView("grid"),
                  },
                  {
                    section: "Show",
                    label: "This folder only",
                    icon: "folder",
                    active: !deep,
                    onSelect: () => setDeep(false),
                  },
                  {
                    label: "Include subfolders",
                    icon: "copy",
                    active: deep,
                    onSelect: () => setDeep(true),
                  },
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
                  <Button
                    size="sm"
                    variant="primary"
                    icon="plus"
                    aria-haspopup="menu"
                    aria-expanded={open}
                    onClick={toggle}
                  >
                    New
                  </Button>
                )}
              />
            </span>
          }
        >
          <div {...dragProps} className={cx("sk-files-contents", isDragOver && "is-over")}>
            {total === 0 ? (
              <div style={{ padding: "var(--sk-space-10) var(--sk-space-6)" }}>
                <EmptyState
                  icon={words.length ? "search" : "upload"}
                  title={
                    words.length
                      ? "Nothing matches"
                      : deep
                        ? "No documents here or below"
                        : "This folder is empty"
                  }
                  action={
                    !words.length && (
                      <Button variant="secondary" icon="upload" onClick={() => input.current?.click()} disabled={!client}>
                        Upload files
                      </Button>
                    )
                  }
                >
                  {words.length
                    ? "No file or folder here matches that search."
                    : "Drop files here, or upload them: each becomes a File you can describe, tag and extract content into."}
                </EmptyState>
              </div>
            ) : view === "grid" ? (
              <div className="sk-files-grid">
                {shownFolders.map((f) => (
                  <FolderCard key={f.id} folder={f} nodes={nodes} picked={picked === f.id} onPick={() => pick(f)} onOpen={() => goFolder(f.id)} />
                ))}
                {shownDocs.map((n) => (
                  <DocCard key={n.id} node={n} file={files.get(n.id)} where={whereOf(n)} picked={picked === n.id} onPick={() => pick(n)} onOpen={() => openNode(n)} />
                ))}
              </div>
            ) : (
              <ul className="sk-list sk-list--rich">
                {shownFolders.map((f) => (
                  <li key={f.id}>
                    <FolderRow folder={f} nodes={nodes} picked={picked === f.id} onPick={() => pick(f)} onOpen={() => goFolder(f.id)} />
                  </li>
                ))}
                {shownDocs.map((n) => (
                  <li key={n.id}>
                    <DocRow node={n} file={files.get(n.id)} where={whereOf(n)} picked={picked === n.id} onPick={() => pick(n)} onOpen={() => openNode(n)} />
                  </li>
                ))}
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
          title={pickedNode ? undefined : "Preview"}
          header={
            pickedNode && (
              <>
                <h2 className="sk-pane__title">{pickedNode.name}</h2>
                <span className="sk-pane__spacer" />
                <Menu
                  label="Item actions"
                  items={[
                    {
                      label: "Open",
                      onSelect: () => (isFolderNodeKind(pickedNode) ? goFolder(pickedNode.id) : openNode(pickedNode)),
                    },
                    { label: "Rename…", onSelect: () => setNaming({ kind: "rename", node: pickedNode }) },
                    { label: "Delete…", danger: true, onSelect: () => showDeleteNodeModal(pickedNode) },
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
          {pickedNode ? (
            <ItemPreview
              node={pickedNode}
              file={files.get(pickedNode.id)}
              nodes={nodes}
              onOpen={() => (isFolderNodeKind(pickedNode) ? goFolder(pickedNode.id) : openNode(pickedNode))}
            />
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
          initial={naming.kind === "rename" ? naming.node.name : ""}
          action={naming.kind === "folder" ? "Create" : "Rename"}
          onClose={() => setNaming(null)}
          onSave={(name) => {
            if (naming.kind === "folder") void addFolder(drive.header.id, name, currentId ?? undefined);
            else void renameDriveNode(drive.header.id, naming.node.id, name);
            setNaming(null);
          }}
        />
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- tree */

function folderPath(nodes: readonly Node[], id: string | null): FolderNode[] {
  const out: FolderNode[] = [];
  let cur = id;
  const seen = new Set<string>();
  while (cur && !seen.has(cur)) {
    seen.add(cur);
    const n = nodes.find((x) => x.id === cur);
    if (!n || !isFolderNodeKind(n)) break;
    out.unshift(n);
    cur = n.parentFolder ?? null;
  }
  return out;
}

/** Every folder below `id` (below the drive's root when null). */
function descendantFolders(nodes: readonly Node[], id: string | null): Set<string> {
  const kids = new Map<string | null, string[]>();
  for (const n of nodes) {
    if (!isFolderNodeKind(n)) continue;
    const k = n.parentFolder ?? null;
    kids.set(k, [...(kids.get(k) ?? []), n.id]);
  }
  const out = new Set<string>();
  const queue = [...(kids.get(id) ?? [])];
  for (let next = queue.shift(); next !== undefined; next = queue.shift()) {
    if (out.has(next)) continue;
    out.add(next);
    queue.push(...(kids.get(next) ?? []));
  }
  return out;
}

function FolderTree({
  nodes,
  driveName,
  currentId,
  onGo,
}: {
  nodes: readonly Node[];
  driveName: string;
  currentId: string | null;
  onGo: (id: string | null) => void;
}) {
  const children = useMemo(() => {
    const map = new Map<string | null, FolderNode[]>();
    for (const n of nodes) {
      if (!isFolderNodeKind(n)) continue;
      const k = n.parentFolder ?? null;
      map.set(k, [...(map.get(k) ?? []), n]);
    }
    for (const list of map.values()) list.sort(byName);
    return map;
  }, [nodes]);
  const countIn = (id: string | null) => nodes.filter((n) => (n.parentFolder ?? null) === id).length;
  // The path to the open folder is open; the rest as the reader leaves it.
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  useEffect(() => {
    const path = folderPath(nodes, currentId);
    if (path.length === 0) return;
    setOpen((prev) => {
      const next = new Set(prev);
      for (const f of path) next.add(f.id);
      return next;
    });
  }, [nodes, currentId]);

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
            <Icon name="folder" size={16} />
            <span className="sk-files-tree__name">{f.name}</span>
            <span className="sk-files-tree__count">{countIn(f.id) || ""}</span>
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
        >
          <span className="sk-files-tree__twist" />
          <Icon name="folder" size={16} />
          <span className="sk-files-tree__name">{driveName}</span>
          <span className="sk-files-tree__count">{countIn(null) || ""}</span>
        </button>
      </li>
      {render(null, 1)}
    </ul>
  );
}

/* ---------------------------------------------------------------- rows */

/** A rich row that picks on click and opens on double-click or Enter. */
function RowButton({
  picked,
  onPick,
  onOpen,
  children,
}: {
  picked: boolean;
  onPick: () => void;
  onOpen: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={cx("sk-list-item sk-list-item--rich", picked && "is-picked")}
      aria-pressed={picked}
      data-sk-drill={3}
      onClick={onPick}
      onDoubleClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          onOpen();
        }
      }}
    >
      {children}
      <Icon name="chevron-right" className="sk-drill-chevron" />
    </button>
  );
}

function FolderRow({
  folder,
  nodes,
  picked,
  onPick,
  onOpen,
}: {
  folder: FolderNode;
  nodes: readonly Node[];
  picked: boolean;
  onPick: () => void;
  onOpen: () => void;
}) {
  const count = nodes.filter((n) => n.parentFolder === folder.id).length;
  return (
    <RowButton picked={picked} onPick={onPick} onOpen={onOpen}>
      <span className="sk-icon-tile">
        <Icon name="folder" />
      </span>
      <div className="sk-list-item__body">
        <div className="sk-list-item__title">{folder.name}</div>
        <div className="sk-list-item__sub">{count === 1 ? "1 item" : `${count} items`}</div>
      </div>
    </RowButton>
  );
}

/** What a File is, in one line: its description, else its source. */
function fileSubline(f: FileDocument | undefined, fallback: string): string {
  if (!f) return fallback;
  const s = f.state.global;
  if (s.description) return s.description;
  if (s.source?.kind === "DOCUMENT") return `Linked: ${s.source.documentName ?? s.source.documentType ?? "document"}`;
  if (s.source?.kind === "ATTACHMENT") {
    // The name is the title already when the file was dropped as is: say what it is instead.
    const name = s.source.fileName && s.source.fileName !== (s.title ?? fallback) ? s.source.fileName : s.source.mimeType;
    return [name, bytes(s.source.sizeBytes)].filter(Boolean).join(" · ");
  }
  return "No source yet";
}

function DocTile({ node, file }: { node: FileNode; file: FileDocument | undefined }) {
  if (node.documentType !== FILE_TYPE) {
    return (
      <span className="sk-icon-tile">
        <Icon name={iconForType(node.documentType)} />
      </span>
    );
  }
  const src = file?.state.global.source;
  if (src?.kind === "DOCUMENT") {
    return (
      <span className="sk-icon-tile">
        <Icon name={iconForType(src.documentType)} />
      </span>
    );
  }
  return <FileTypeTile kind={fileKind(src?.mimeType, src?.fileName ?? node.name)} />;
}

function DocRow({
  node,
  file,
  where,
  picked,
  onPick,
  onOpen,
}: {
  node: FileNode;
  file: FileDocument | undefined;
  /** The subfolder it lives in, when the view includes subfolders */
  where?: string | null;
  picked: boolean;
  onPick: () => void;
  onOpen: () => void;
}) {
  const typeName = useTypeName(node.documentType);
  const s = file?.state.global;
  const isFile = node.documentType === FILE_TYPE;
  return (
    <RowButton picked={picked} onPick={onPick} onOpen={onOpen}>
      <DocTile node={node} file={file} />
      <div className="sk-list-item__body">
        <div className="sk-list-item__title">{s?.title ?? node.name}</div>
        <div className="sk-list-item__sub">{isFile ? fileSubline(file, node.name) : typeName}</div>
        {s && s.tags.length > 0 && (
          <div className="sk-list-item__tags">
            <TagBadges tags={s.tags} />
          </div>
        )}
      </div>
      <div className="sk-list-item__aside">
        {where && <Where path={where} />}
        {isFile ? (
          s && s.renditions.length > 0 && (
            <span title={s.renditions.map(renditionName).join(", ")}>
              {s.renditions.length} {s.renditions.length === 1 ? "version" : "versions"}
            </span>
          )
        ) : (
          <span>{typeName}</span>
        )}
      </div>
    </RowButton>
  );
}

/* ---------------------------------------------------------------- grid */

/** The image a card shows: a preview or thumbnail rendition, else an image source. */
function thumbRef(f: FileDocument | undefined): string | null {
  if (!f) return null;
  const s = f.state.global;
  const img = (m: string | null | undefined) => (m ?? "").startsWith("image/");
  const preferred =
    s.renditions.find((r) => r.ref && img(r.mimeType) && /preview|thumb/i.test(r.type ?? "")) ??
    s.renditions.find((r) => r.ref && img(r.mimeType));
  if (preferred?.ref) return preferred.ref;
  if (s.source?.kind === "ATTACHMENT" && s.source.ref && img(s.source.mimeType)) return s.source.ref;
  return null;
}

function Thumb({ documentId, refId, fallback }: { documentId: string; refId: string; fallback: ReactNode }) {
  const preview = useAttachmentPreview({ documentId, ref: refId as `attachment://v${number}:${string}` });
  const url = preview.stage === "done" && !preview.loading ? preview.url : undefined;
  return url ? <img src={url} alt="" loading="lazy" /> : <>{fallback}</>;
}

function CardButton({
  picked,
  onPick,
  onOpen,
  thumb,
  name,
  meta,
  extra,
}: {
  picked: boolean;
  onPick: () => void;
  onOpen: () => void;
  thumb: ReactNode;
  name: ReactNode;
  meta: ReactNode;
  extra?: ReactNode;
}) {
  return (
    <button
      type="button"
      className={cx("sk-files-card", picked && "is-picked")}
      aria-pressed={picked}
      onClick={onPick}
      onDoubleClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          onOpen();
        }
      }}
    >
      <span className="sk-files-card__thumb">{thumb}</span>
      <span className="sk-files-card__body">
        <span className="sk-files-card__name">{name}</span>
        <span className="sk-files-card__meta">{meta}</span>
        {extra}
      </span>
    </button>
  );
}

function FolderCard({
  folder,
  nodes,
  picked,
  onPick,
  onOpen,
}: {
  folder: FolderNode;
  nodes: readonly Node[];
  picked: boolean;
  onPick: () => void;
  onOpen: () => void;
}) {
  const count = nodes.filter((n) => n.parentFolder === folder.id).length;
  return (
    <CardButton
      picked={picked}
      onPick={onPick}
      onOpen={onOpen}
      thumb={
        <span className="sk-icon-tile">
          <Icon name="folder" />
        </span>
      }
      name={folder.name}
      meta={count === 1 ? "1 item" : `${count} items`}
    />
  );
}

/** The subfolder a document lives in, in a view that includes subfolders. */
function Where({ path }: { path: string }) {
  return (
    <span className="sk-files-where" title={path}>
      <Icon name="folder" size={16} />
      {path}
    </span>
  );
}

function DocCard({
  node,
  file,
  where,
  picked,
  onPick,
  onOpen,
}: {
  node: FileNode;
  file: FileDocument | undefined;
  where?: string | null;
  picked: boolean;
  onPick: () => void;
  onOpen: () => void;
}) {
  const typeName = useTypeName(node.documentType);
  const tile = <DocTile node={node} file={file} />;
  const ref = thumbRef(file);
  const s = file?.state.global;
  return (
    <CardButton
      picked={picked}
      onPick={onPick}
      onOpen={onOpen}
      thumb={ref ? <Thumb documentId={node.id} refId={ref} fallback={tile} /> : tile}
      name={s?.title ?? node.name}
      meta={node.documentType === FILE_TYPE ? fileSubline(file, node.name) : typeName}
      extra={
        where || (s && s.tags.length > 0) ? (
          <>
            {where && <Where path={where} />}
            {s && s.tags.length > 0 && <TagBadges tags={s.tags} max={2} />}
          </>
        ) : undefined
      }
    />
  );
}

/* ------------------------------------------------------------- preview */

function ItemPreview({
  node,
  file,
  nodes,
  onOpen,
}: {
  node: Node;
  file: FileDocument | undefined;
  nodes: readonly Node[];
  onOpen: () => void;
}) {
  const [item, setItem] = useState<PreviewItem>(SOURCE_ITEM);
  useEffect(() => setItem(SOURCE_ITEM), [node.id]);

  if (isFolderNodeKind(node)) {
    const inside = nodes.filter((n) => n.parentFolder === node.id);
    const sub = inside.filter(isFolderNodeKind).length;
    return (
      <div className="sk-files-preview">
        <div className="sk-file-linked">
          <span className="sk-icon-tile sk-icon-tile--lg">
            <Icon name="folder" />
          </span>
          <div className="sk-file-linked__body">
            <div className="sk-eyebrow">Folder</div>
            <div className="sk-file-linked__name">{node.name}</div>
            <div className="sk-caption">
              {inside.length - sub} {inside.length - sub === 1 ? "document" : "documents"} · {sub}{" "}
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

  // Not a folder, so a document; the guard above narrows a FolderNode-only
  // union here, hence the explicit view.
  const doc = node as unknown as FileNode;
  if (doc.documentType !== FILE_TYPE) {
    return (
      <LinkedDocumentPreview documentId={doc.id} documentType={doc.documentType} documentName={doc.name} />
    );
  }

  if (!file) {
    return <p className="sk-small sk-text-muted">Loading the file…</p>;
  }

  const s = file.state.global;
  const options = [
    { value: "source", name: "Source", meta: s.source ? (s.source.kind === "DOCUMENT" ? "Document" : (s.source.mimeType ?? "File")) : "Not set", icon: "upload" as const },
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
        <h3 className="sk-files-preview__title">{s.title ?? doc.name}</h3>
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
      <FileItemPreview doc={file} item={item} />
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
