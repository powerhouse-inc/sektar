// The File document, edited: its title and description, tags, the source of
// truth (a stored file or another document), and the content extracted from
// or rendered for it, beside a preview of whichever of those is picked.
import { findDrive } from "../../../processors/drives/index.js";
import {
  renameDriveNode,
  useAttachments,
  useDocumentModelModules,
  useDrives,
  useEditorFileDrop,
  useReactorClient,
} from "@powerhousedao/reactor-browser";
import { generateId } from "document-model";
import {
  actions,
  type FileAction,
  type FileDocument,
  type FileRendition,
  type FileTag,
} from "document-models/file";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { ConversionRenditionView } from "../../../conversions/model-adapter.js";
import { useFillHeight, useNarrow } from "../../backfills/components/measure.js";
import { coverageOf, coverageText, shortWhen, versionsOf } from "../kit/conversion-model.js";
import {
  addFileRendition,
  addTextRendition,
  bytes,
  COMMON_MIME_TYPES,
  FILE_TYPE,
  fileKind,
  hasStoredPdf,
  MIME_PATTERN,
  nextTagColor,
  RENDITION_TYPES,
  setSourceFile,
  TAG_COLORS,
  tagTone,
} from "../kit/files.js";
import { useNow } from "../kit/format.js";
import { Menu, type MenuItem } from "../kit/menu.js";
import {
  Badge,
  Button,
  cx,
  EmptyState,
  Icon,
  Modal,
  Selector,
} from "../kit/ui.js";
import {
  useFileConversion,
  useShowFinished,
  type SourceConversion,
} from "../kit/use-conversion.js";
import { Pane, Workspace } from "../kit/workspace.js";
import {
  ConversionPendingRow,
  ConversionStatus,
  convertAction,
  ConvertButton,
  ConvertDialog,
  useStartedToast,
} from "./Conversion.js";
import {
  FileItemPreview,
  FileTypeTile,
  iconForType,
  itemFromKey,
  itemKey,
  listedRenditions,
  MarkdownTile,
  openDocument,
  renditionKind,
  renditionMeta,
  renditionName,
  renditionOptions,
  SOURCE_ITEM,
  useDocumentLocation,
  useTypeName,
  type PreviewItem,
} from "./FilePreview.js";

type Dispatch = (action: FileAction | FileAction[]) => void;

const now = () => new Date().toISOString();

/* ------------------------------------------------------------ workspace */

/**
 * The File editor's workspace: the details on the left, the preview on the
 * right; stacked under 640px of width, the preview is a level deeper.
 */
export function FileWorkspace({ doc, dispatch }: { doc: FileDocument; dispatch: Dispatch }) {
  const [item, setItem] = useState<PreviewItem>(SOURCE_ITEM);
  // Stacked: 1 the details · 2 the preview (the design system counts from 1).
  const [level, setLevel] = useState(1);
  const [previewPref, setPreviewPref] = useState<boolean | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const height = useFillHeight(root, true);
  const narrow = useNarrow(root, 900, true);
  // Stacked (under 800px) the preview is a screen of its own, never a strip.
  const stacked = useNarrow(root, 800, true);
  const previewCollapsed = !stacked && (previewPref ?? false);
  const s = doc.state.global;
  const conversion = useFileConversion(doc);
  // What a conversion is still writing is not listed until it is finalized.
  const listed = useMemo(
    () => listedRenditions(doc, conversion.renditions),
    [doc, conversion.renditions],
  );
  /** Bumped to open the shown Markdown's conversion details. */
  const [reveal, setReveal] = useState(0);
  const now = useNow();

  // A rendition that is removed takes the preview back to the source.
  useEffect(() => {
    if (item.kind === "rendition" && !listed.some((r) => r.id === item.id)) {
      setItem(SOURCE_ITEM);
    }
  }, [item, listed]);

  const show = (next: PreviewItem) => {
    setItem(next);
    setPreviewPref(false);
    setLevel(2);
  };

  const options = [
    {
      value: "source",
      name: "Source",
      meta: sourceSummary(doc),
      icon: s.source?.kind === "DOCUMENT" ? iconForType(s.source.documentType) : ("upload" as const),
    },
    ...renditionOptions(listed, conversion, now),
  ];

  return (
    <div
      ref={root}
      className={cx("sk-file-view", narrow && "is-narrow")}
      style={{ height: height ? `${height}px` : undefined }}
    >
      <Workspace level={level}>
        <Pane grow={1.15} title={<FileHeading doc={doc} />} header={<FileMenu doc={doc} dispatch={dispatch} />}>
          <FileDetails
            doc={doc}
            dispatch={dispatch}
            active={item}
            onShow={show}
            conversion={conversion}
            renditions={listed}
            onDetails={(id) => {
              show({ kind: "rendition", id });
              setReveal((n) => n + 1);
            }}
          />
        </Pane>
        <Pane
          side="end"
          grow={1}
          collapsed={previewCollapsed}
          onToggle={() => setPreviewPref(!previewCollapsed)}
          onBack={() => setLevel(1)}
          backLabel="Back to the file"
          collapsedTitle="Preview"
          header={
            <Selector
              value={itemKey(item)}
              options={options}
              onChange={(key) => setItem(itemFromKey(key))}
              label="Preview"
            />
          }
        >
          <FileItemPreview doc={doc} item={item} conversion={conversion} revealDetails={reveal} onShow={setItem} />
        </Pane>
      </Workspace>
    </div>
  );
}

function sourceSummary(doc: FileDocument): string {
  const src = doc.state.global.source;
  if (!src) return "Not set";
  if (src.kind === "DOCUMENT") return src.documentName ?? src.documentType ?? "Document";
  return [src.fileName, bytes(src.sizeBytes)].filter(Boolean).join(" · ");
}

function FileHeading({ doc }: { doc: FileDocument }) {
  const src = doc.state.global.source;
  return (
    <span className="sk-file-heading">
      <span className="sk-eyebrow">File</span>
      {src?.kind === "ATTACHMENT" && (
        <span className="sk-caption">{src.mimeType ?? "Stored file"}</span>
      )}
      {src?.kind === "DOCUMENT" && <span className="sk-caption">Linked document</span>}
    </span>
  );
}

function FileMenu({ doc, dispatch }: { doc: FileDocument; dispatch: Dispatch }) {
  const s = doc.state.global;
  return (
    <>
      <span className="sk-pane__spacer" />
      <Menu
        label="File actions"
        align="end"
        items={[
          {
            label: "Remove the source",
            disabled: !s.source,
            onSelect: () => dispatch(actions.clearSource({})),
          },
          {
            label: "Remove every tag",
            disabled: s.tags.length === 0,
            onSelect: () => dispatch(s.tags.map((t) => actions.removeTag({ id: t.id }))),
          },
        ]}
        trigger={(open, toggle) => (
          <button
            type="button"
            className="sk-more"
            aria-haspopup="menu"
            aria-expanded={open}
            aria-label="File actions"
            onClick={toggle}
          >
            <span />
          </button>
        )}
      />
    </>
  );
}

/* -------------------------------------------------------------- details */

function FileDetails({
  doc,
  dispatch,
  active,
  onShow,
  conversion,
  renditions,
  onDetails,
}: {
  doc: FileDocument;
  dispatch: Dispatch;
  active: PreviewItem;
  onShow: (item: PreviewItem) => void;
  /** The conversion of the File's source to Markdown */
  conversion: SourceConversion;
  /** The renditions to list: generated ones only once finalized */
  renditions: readonly FileRendition[];
  /** Shows a generated rendition with its conversion details open */
  onDetails: (id: string) => void;
}) {
  const s = doc.state.global;
  const location = useDocumentLocation(doc.header.id, "files");
  return (
    <div className="sk-file-details">
      <TitleField
        value={s.title ?? null}
        placeholder={doc.header.name || "Untitled file"}
        onCommit={(title) => {
          dispatch(actions.setTitle({ title }));
          // The drive lists the file by its node name: keep the two in step.
          if (title && location && location.node.name !== title) {
            void renameDriveNode(location.drive.header.id, location.node.id, title);
          }
        }}
      />
      <DescriptionField
        value={s.description ?? null}
        onCommit={(description) => dispatch(actions.setDescription({ description }))}
      />
      <TagEditor tags={s.tags} dispatch={dispatch} />

      <section className="sk-file-section">
        <header className="sk-file-section__header">
          <h3 className="sk-file-section__title">Source of truth</h3>
          <span className="sk-caption">What this file is: a stored file, or a document</span>
        </header>
        <SourceEditor doc={doc} dispatch={dispatch} active={active.kind === "source"} onShow={() => onShow(SOURCE_ITEM)} />
      </section>

      <section className="sk-file-section">
        <header className="sk-file-section__header">
          <h3 className="sk-file-section__title">
            Extracted content <span className="sk-pane__count">{renditions.length}</span>
          </h3>
          <span className="sk-caption">Versions of the source in other formats: text, html, pdf, images…</span>
        </header>
        <RenditionList
          doc={doc}
          dispatch={dispatch}
          active={active.kind === "rendition" ? active.id : null}
          onShow={(id) => onShow({ kind: "rendition", id })}
          conversion={conversion}
          renditions={renditions}
          onDetails={onDetails}
        />
      </section>

      <dl className="sk-file-meta">
        <div>
          <dt>Created</dt>
          <dd>{new Date(doc.header.createdAtUtcIso).toLocaleString()}</dd>
        </div>
        <div>
          <dt>Modified</dt>
          <dd>{new Date(doc.header.lastModifiedAtUtcIso).toLocaleString()}</dd>
        </div>
        <div>
          <dt>Document</dt>
          <dd className="sk-font-mono">{doc.header.id}</dd>
        </div>
      </dl>
    </div>
  );
}

/** Commits on blur or Enter; Escape restores. Follows the document when not being edited. */
function useCommitField(value: string | null, onCommit: (next: string | null) => void) {
  const [draft, setDraft] = useState(value ?? "");
  const editing = useRef(false);
  useEffect(() => {
    if (!editing.current) setDraft(value ?? "");
  }, [value]);
  return {
    value: draft,
    onFocus: () => {
      editing.current = true;
    },
    onChange: (e: { target: { value: string } }) => setDraft(e.target.value),
    onBlur: () => {
      editing.current = false;
      const next = draft.trim() ? draft.trim() : null;
      if (next !== (value ?? null)) onCommit(next);
    },
    reset: () => {
      editing.current = false;
      setDraft(value ?? "");
    },
  };
}

function TitleField({
  value,
  placeholder,
  onCommit,
}: {
  value: string | null;
  placeholder: string;
  onCommit: (title: string | null) => void;
}) {
  const f = useCommitField(value, onCommit);
  const ref = useRef<HTMLTextAreaElement>(null);
  // Wraps and grows: a long title is read whole, not clipped.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [f.value]);
  return (
    <textarea
      ref={ref}
      rows={1}
      className="sk-file-title"
      aria-label="Title"
      placeholder={placeholder}
      value={f.value}
      onFocus={f.onFocus}
      onChange={(e) => f.onChange({ target: { value: e.target.value.replace(/\n/g, " ") } })}
      onBlur={f.onBlur}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          e.currentTarget.blur();
        }
        if (e.key === "Escape") {
          f.reset();
          e.currentTarget.blur();
        }
      }}
    />
  );
}

function DescriptionField({
  value,
  onCommit,
}: {
  value: string | null;
  onCommit: (description: string | null) => void;
}) {
  const f = useCommitField(value, onCommit);
  const ref = useRef<HTMLTextAreaElement>(null);
  // Grows with its text: a description is read in place, not scrolled.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [f.value]);
  return (
    <textarea
      ref={ref}
      rows={1}
      className="sk-file-description"
      aria-label="Description"
      placeholder="Add a description…"
      value={f.value}
      onFocus={f.onFocus}
      onChange={f.onChange}
      onBlur={f.onBlur}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          f.reset();
          e.currentTarget.blur();
        }
      }}
    />
  );
}

/* ----------------------------------------------------------------- tags */

/** The palette as swatches; one is picked. */
function Swatches({ value, onPick }: { value: string; onPick: (color: string) => void }) {
  return (
    <div className="sk-file-swatches" role="radiogroup" aria-label="Colour">
      {TAG_COLORS.map((c) => (
        <button
          key={c.value}
          type="button"
          role="radio"
          aria-checked={c.value === value}
          aria-label={c.label}
          title={c.label}
          className={cx("sk-file-swatch", `sk-file-swatch--${c.value}`, c.value === value && "is-active")}
          onClick={() => onPick(c.value)}
        />
      ))}
    </div>
  );
}

/** Tags used on other files in the open drives, to pick again with their colour. */
function useKnownTags(own: readonly FileTag[]): { label: string; color: string }[] {
  // Tags live on the documents; the drive nodes do not carry them. The
  // suggestions are the ones this session has seen (see rememberTags).
  const [, bump] = useState(0);
  useEffect(() => {
    const on = () => bump((n) => n + 1);
    window.addEventListener("sk:file-tags", on);
    return () => window.removeEventListener("sk:file-tags", on);
  }, []);
  const owned = new Set(own.map((t) => t.label.toLowerCase()));
  return [...knownTags.values()].filter((t) => !owned.has(t.label.toLowerCase()));
}

const knownTags = new Map<string, { label: string; color: string }>();

/** Remember tags seen on any file, so another file can pick them again. */
export function rememberTags(tags: readonly FileTag[]) {
  let changed = false;
  for (const t of tags) {
    const key = t.label.toLowerCase();
    const cur = knownTags.get(key);
    if (!cur || cur.color !== t.color) {
      knownTags.set(key, { label: t.label, color: t.color });
      changed = true;
    }
  }
  if (changed) window.dispatchEvent(new Event("sk:file-tags"));
}

function TagEditor({ tags, dispatch }: { tags: readonly FileTag[]; dispatch: Dispatch }) {
  const [editing, setEditing] = useState<FileTag | "new" | null>(null);
  useEffect(() => rememberTags(tags), [tags]);
  return (
    <div className="sk-file-tags">
      {tags.map((t) => (
        <button
          key={t.id}
          type="button"
          className={cx("sk-badge", tagTone(t.color) !== "outline" && `sk-badge--${tagTone(t.color)}`, tagTone(t.color) === "outline" && "sk-badge--outline", "sk-badge--pill", "sk-file-tag")}
          onClick={() => setEditing(t)}
          title="Edit tag"
        >
          {t.label}
        </button>
      ))}
      <button type="button" className="sk-file-tag-add" onClick={() => setEditing("new")}>
        <Icon name="plus" size={16} mono />
        {tags.length === 0 ? "Add a tag" : "Tag"}
      </button>
      {editing && (
        <TagModal
          tag={editing === "new" ? null : editing}
          tags={tags}
          onClose={() => setEditing(null)}
          dispatch={dispatch}
        />
      )}
    </div>
  );
}

function TagModal({
  tag,
  tags,
  onClose,
  dispatch,
}: {
  tag: FileTag | null;
  tags: readonly FileTag[];
  onClose: () => void;
  dispatch: Dispatch;
}) {
  const [label, setLabel] = useState(tag?.label ?? "");
  const [color, setColor] = useState(tag?.color ?? nextTagColor(tags.map((t) => t.color)));
  const known = useKnownTags(tags);
  const trimmed = label.trim();
  const taken = tags.some((t) => t.id !== tag?.id && t.label.toLowerCase() === trimmed.toLowerCase());
  const valid = trimmed !== "" && !taken;
  const save = (l = trimmed, c = color) => {
    if (!l) return;
    if (tag) dispatch(actions.updateTag({ id: tag.id, label: l, color: c }));
    else dispatch(actions.addTag({ id: generateId(), label: l, color: c }));
    onClose();
  };
  return (
    <Modal
      title={tag ? "Edit tag" : "Add a tag"}
      onClose={onClose}
      footer={
        <>
          {tag && (
            <Button
              variant="ghost"
              className="sk-text-danger"
              onClick={() => {
                dispatch(actions.removeTag({ id: tag.id }));
                onClose();
              }}
            >
              Remove
            </Button>
          )}
          <span className="sk-grow" />
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={!valid} onClick={() => save()}>
            {tag ? "Save" : "Add tag"}
          </Button>
        </>
      }
    >
      <div className="sk-stack sk-stack--4">
        <label className="sk-field">
          <span className="sk-label">Label</span>
          <input
            className="sk-input"
            autoFocus
            value={label}
            placeholder="e.g. Finance, Q2, Contract"
            onChange={(e) => setLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && valid) save();
            }}
          />
          {taken && <span className="sk-hint sk-text-danger">This file has that tag already.</span>}
        </label>
        <div className="sk-field">
          <span className="sk-label">Colour</span>
          <Swatches value={color} onPick={setColor} />
        </div>
        {trimmed && (
          <div className="sk-row" style={{ gap: "var(--sk-space-2)" }}>
            <span className="sk-caption">Preview</span>
            <Badge tone={tagTone(color)} pill>
              {trimmed}
            </Badge>
          </div>
        )}
        {!tag && known.length > 0 && (
          <div className="sk-field">
            <span className="sk-label">Used on other files</span>
            <div className="sk-file-tags">
              {known.slice(0, 16).map((k) => (
                <button
                  key={k.label}
                  type="button"
                  className={cx("sk-badge sk-badge--pill sk-file-tag", `sk-badge--${tagTone(k.color)}`)}
                  onClick={() => save(k.label, k.color)}
                >
                  {k.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

/* --------------------------------------------------------------- source */

function SourceEditor({
  doc,
  dispatch,
  active,
  onShow,
}: {
  doc: FileDocument;
  dispatch: Dispatch;
  active: boolean;
  onShow: () => void;
}) {
  const client = useAttachments();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const src = doc.state.global.source;
  const typeName = useTypeName(src?.documentType);
  const location = useDocumentLocation(src?.documentId);

  const upload = (file: File) => {
    if (!client) return;
    setError(null);
    setBusy(`Storing ${file.name}…`);
    setSourceFile(client, doc.header.id, file, file.name)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setBusy(null));
  };
  const { dragProps, isDragOver } = useEditorFileDrop({
    onFiles: (files) => {
      if (files[0]) upload(files[0]);
    },
  });

  const picker = (
    <input
      ref={input}
      type="file"
      hidden
      onChange={(e) => {
        const f = e.target.files?.[0];
        if (f) upload(f);
        e.target.value = "";
      }}
    />
  );

  if (!src) {
    return (
      <div {...dragProps} className={cx("sk-file-drop", isDragOver && "is-over")}>
        {picker}
        <div className="sk-file-drop__choices">
          <button
            type="button"
            className="sk-file-choice"
            disabled={!client || busy !== null}
            onClick={() => input.current?.click()}
          >
            <span className="sk-icon-tile">
              <Icon name="upload" />
            </span>
            <span className="sk-file-choice__body">
              <span className="sk-file-choice__title">Upload a file</span>
              <span className="sk-caption">
                {client ? "Or drop it here: PDF, Word, images, anything" : "Needs a switchboard behind the drive"}
              </span>
            </span>
          </button>
          <button type="button" className="sk-file-choice" onClick={() => setPicking(true)}>
            <span className="sk-icon-tile">
              <Icon name="invoice" />
            </span>
            <span className="sk-file-choice__body">
              <span className="sk-file-choice__title">Link a document</span>
              <span className="sk-caption">An invoice, a contact, an email…</span>
            </span>
          </button>
        </div>
        {busy && <p className="sk-caption">{busy}</p>}
        {error && <p className="sk-small sk-text-danger">{error}</p>}
        {picking && (
          <DocumentPicker
            onClose={() => setPicking(false)}
            onPick={(node) => {
              dispatch(
                actions.setDocumentSource({
                  documentId: node.id,
                  documentType: node.documentType,
                  documentName: node.name,
                  setAt: now(),
                }),
              );
              setPicking(false);
            }}
          />
        )}
      </div>
    );
  }

  const isDoc = src.kind === "DOCUMENT";
  return (
    <div {...dragProps} className={cx("sk-file-drop sk-file-drop--filled", isDragOver && "is-over")}>
      {picker}
      <div className={cx("sk-file-row", active && "is-active")}>
        <button type="button" className="sk-file-row__main" onClick={onShow}>
          {isDoc ? (
            <span className="sk-icon-tile">
              <Icon name={iconForType(src.documentType)} />
            </span>
          ) : (
            <FileTypeTile kind={fileKind(src.mimeType, src.fileName)} />
          )}
          <span className="sk-file-row__body">
            <span className="sk-file-row__name">
              {isDoc ? src.documentName ?? "Untitled document" : src.fileName}
            </span>
            <span className="sk-file-row__meta">
              {isDoc
                ? typeName
                : [src.mimeType, bytes(src.sizeBytes)].filter(Boolean).join(" · ")}
              {" · set "}
              {new Date(src.setAt).toLocaleDateString()}
            </span>
          </span>
        </button>
        <span className="sk-file-row__actions">
          {isDoc && location && (
            <Button size="sm" variant="ghost" icon="arrow-up-right" onClick={() => openDocument(location)}>
              Open
            </Button>
          )}
          <Menu
            label="Source"
            align="end"
            items={[
              { label: "Show in preview", onSelect: onShow },
              { label: "Replace with a file…", disabled: !client, onSelect: () => input.current?.click() },
              { label: "Replace with a document…", onSelect: () => setPicking(true) },
              { label: "Remove the source", onSelect: () => dispatch(actions.clearSource({})) },
            ]}
            trigger={(open, toggle) => (
              <button
                type="button"
                className="sk-more"
                aria-haspopup="menu"
                aria-expanded={open}
                aria-label="Source actions"
                onClick={toggle}
              >
                <span />
              </button>
            )}
          />
        </span>
      </div>
      {busy && <p className="sk-caption">{busy}</p>}
      {error && <p className="sk-small sk-text-danger">{error}</p>}
      {picking && (
        <DocumentPicker
          onClose={() => setPicking(false)}
          onPick={(node) => {
            dispatch(
              actions.setDocumentSource({
                documentId: node.id,
                documentType: node.documentType,
                documentName: node.name,
                setAt: now(),
              }),
            );
            setPicking(false);
          }}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------ document picker */

interface PickableNode {
  id: string;
  name: string;
  documentType: string;
  driveName: string;
}

/** Where a type sorts in the picker: the business records a file usually stands for first. */
function typeRank(documentType: string): number {
  const order = ["sektar/invoice", "sektar/contact", "sektar/expense-report", "sektar/bank-account"];
  const at = order.indexOf(documentType);
  if (at >= 0) return at;
  return documentType === "sektar/email" ? 100 : 50;
}

/** Nodes per read, and how many a drive shows before "Show more". */
const PICKER_PAGE = 500;
const PICKER_BATCH = 2_000;

/** A drive's documents for the picker: read page by page through the drive read API, a batch at a time. */
function usePickerNodes(driveId: string | null, driveName: string) {
  const client = useReactorClient();
  const [state, setState] = useState<{
    driveId: string | null;
    nodes: PickableNode[];
    cursor: string | null;
    loading: boolean;
    error: string | null;
  }>({ driveId: null, nodes: [], cursor: null, loading: false, error: null });
  const nameRef = useRef(driveName);
  nameRef.current = driveName;

  const load = useCallback(
    async (id: string, from: string, before: PickableNode[]) => {
      const read = client?.read;
      if (!read) return;
      setState({ driveId: id, nodes: before, cursor: null, loading: true, error: null });
      const out = [...before];
      let cursor: string | null = from;
      try {
        for (let asked = 0; cursor !== null && asked < PICKER_BATCH; asked += PICKER_PAGE) {
          const page = await read.drives.listNodes(id, undefined, { cursor, limit: PICKER_PAGE });
          for (const n of page.results) {
            if (n.kind !== "file" || !("documentType" in n)) continue;
            // File documents are what is being linked from; drive types are no business records.
            if (n.documentType === FILE_TYPE || n.documentType.startsWith("powerhouse/")) continue;
            out.push({ id: n.id, name: n.name, documentType: n.documentType, driveName: nameRef.current });
          }
          cursor = page.nextCursor && page.results.length > 0 ? page.nextCursor : null;
        }
        setState((prev) => (prev.driveId === id ? { driveId: id, nodes: out, cursor, loading: false, error: null } : prev));
      } catch (e) {
        setState((prev) =>
          prev.driveId === id ? { ...prev, loading: false, error: e instanceof Error ? e.message : String(e) } : prev,
        );
      }
    },
    [client],
  );

  useEffect(() => {
    if (driveId) void load(driveId, "", []);
  }, [driveId, load]);

  const current = state.driveId === driveId ? state : { driveId, nodes: [], cursor: null, loading: Boolean(driveId), error: null };
  return {
    ...current,
    more: current.cursor !== null && !current.loading ? () => void load(current.driveId ?? "", current.cursor ?? "", current.nodes) : null,
  };
}

/**
 * A document from one drive at a time, File documents aside, to link as a
 * source. The drive's nodes are read through the drive read API in
 * batches, never every drive's node list at once (Mail alone is a hundred
 * thousand); the search and the type pills work on what is loaded.
 */
function DocumentPicker({
  onClose,
  onPick,
}: {
  onClose: () => void;
  onPick: (node: PickableNode) => void;
}) {
  const allDrives = useDrives();
  const modules = useDocumentModelModules();
  const [query, setQuery] = useState("");
  const [type, setType] = useState<string>("all");
  const typeName = (t: string) =>
    modules?.find((m) => m.documentModel.global.id === t)?.documentModel.global.name ?? t;

  // The studio's own drives hold models and editors, not business documents.
  const drives = useMemo(
    () =>
      (allDrives ?? [])
        .filter((d) => !/^(vetra|preview)/.test(d.header.slug))
        .map((d) => ({ id: d.header.id, slug: d.header.slug, name: d.header.name || d.state.global.name || d.header.slug })),
    [allDrives],
  );
  const [chosen, setChosen] = useState<string | null>(null);
  // The business records first: the sektar drive, when there is one.
  const driveId = chosen ?? findDrive(allDrives, "sektar")?.header.id ?? drives.at(0)?.id ?? null;
  const drive = drives.find((d) => d.id === driveId);
  const { nodes, loading, error, more } = usePickerNodes(driveId, drive?.name ?? "");

  const types = useMemo(() => {
    const counts = new Map<string, number>();
    for (const n of nodes) counts.set(n.documentType, (counts.get(n.documentType) ?? 0) + 1);
    // Business documents first; mail last, however much of it there is.
    return [...counts.entries()].sort(
      (a, b) => typeRank(a[0]) - typeRank(b[0]) || b[1] - a[1],
    );
  }, [nodes]);

  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const shown = nodes
    .filter((n) => type === "all" || n.documentType === type)
    .sort((a, b) => typeRank(a.documentType) - typeRank(b.documentType))
    .filter((n) => words.every((w) => n.name.toLowerCase().includes(w)))
    .slice(0, 200);

  return (
    <Modal title="Link a document" onClose={onClose}>
      <div className="sk-stack sk-stack--4 sk-file-picker">
        <div className="sk-pills" role="tablist" aria-label="Drive">
          {drives.map((d) => (
            <button
              key={d.id}
              type="button"
              className={cx("sk-pill", d.id === driveId && "is-active")}
              onClick={() => {
                setChosen(d.id);
                setType("all");
              }}
            >
              {d.name}
            </button>
          ))}
        </div>
        <label className="sk-input-group sk-search">
          <Icon name="search" />
          <input
            className="sk-input"
            autoFocus
            placeholder={drive ? `Search ${drive.name}` : "Search documents"}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search documents"
          />
        </label>
        <div className="sk-pills" role="tablist">
          <button type="button" className={cx("sk-pill", type === "all" && "is-active")} onClick={() => setType("all")}>
            All <span className="sk-pill__count">{nodes.length}</span>
          </button>
          {types.slice(0, 6).map(([t, n]) => (
            <button
              key={t}
              type="button"
              className={cx("sk-pill", type === t && "is-active")}
              onClick={() => setType(t)}
            >
              {typeName(t)} <span className="sk-pill__count">{n}</span>
            </button>
          ))}
        </div>
        <ul className="sk-list sk-list--rich sk-file-picker__list">
          {shown.map((n) => (
            <li key={n.id}>
              <button type="button" className="sk-list-item sk-list-item--rich" onClick={() => onPick(n)}>
                <span className="sk-icon-tile">
                  <Icon name={iconForType(n.documentType)} />
                </span>
                <span className="sk-list-item__body">
                  <span className="sk-list-item__title">{n.name}</span>
                  <span className="sk-list-item__sub">
                    {typeName(n.documentType)} · {n.driveName}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
        {loading && <p className="sk-caption">Reading {drive?.name ?? "the drive"}…</p>}
        {error && <p className="sk-small sk-text-danger">{error}</p>}
        {more && (
          <p className="sk-caption">
            The first {nodes.length.toLocaleString()} documents of {drive?.name ?? "this drive"}.{" "}
            <Button size="sm" variant="ghost" onClick={more}>
              Show more
            </Button>
          </p>
        )}
        {!loading && shown.length === 0 && (
          <EmptyState icon="search" title="No documents">
            {nodes.length === 0 ? "This drive has no documents to link." : "Nothing matches that search."}
          </EmptyState>
        )}
      </div>
    </Modal>
  );
}

/* ----------------------------------------------------------- renditions */

/** A converted Markdown's meta: how much of the PDF it read, and when it was made where that tells versions apart. */
function convertedMeta(view: ConversionRenditionView, dated: boolean): string {
  const coverage = coverageText(view, coverageOf(view.publication.output.pages).unread);
  return dated ? `${coverage}, ${shortWhen(view.createdAt)}` : coverage;
}

/** A row of Markdown a conversion made: its state on the row, its actions in its menu. */
function ConvertedRow({
  view,
  active,
  earlier,
  onShow,
  menu,
}: {
  view: ConversionRenditionView;
  active: boolean;
  /** A version under Earlier versions */
  earlier: boolean;
  onShow: () => void;
  menu: MenuItem[];
}) {
  const partial = view.completeness === "partial";
  return (
    <li className={cx("sk-file-row", active && "is-active")}>
      <button type="button" className="sk-file-row__main" onClick={onShow}>
        <MarkdownTile earlier={earlier} />
        <span className="sk-file-row__body">
          <span className="sk-file-row__name">
            Markdown
            {partial && (
              <Badge tone="warning" pill>
                Partial
              </Badge>
            )}
            {view.stale && (
              <Badge tone="outline" pill>
                Previous PDF
              </Badge>
            )}
          </span>
          <span className="sk-file-row__meta">{convertedMeta(view, earlier || !partial)}</span>
        </span>
      </button>
      <span className="sk-file-row__actions">
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
              aria-label={earlier ? `Actions for the Markdown of ${shortWhen(view.createdAt)}` : "Actions for Markdown"}
              onClick={toggle}
            >
              <span />
            </button>
          )}
        />
      </span>
    </li>
  );
}

/**
 * Extracted content: what was added by hand, then the Markdown a conversion
 * made (one in progress as a pending row, the latest, and earlier versions
 * folded), and the actions that add more.
 */
export function RenditionList({
  doc,
  dispatch,
  active,
  onShow,
  conversion,
  renditions,
  onDetails,
}: {
  doc: FileDocument;
  dispatch: Dispatch;
  active: string | null;
  onShow: (id: string) => void;
  conversion: SourceConversion;
  renditions: readonly FileRendition[];
  onDetails: (id: string) => void;
}) {
  const client = useAttachments();
  const [editing, setEditing] = useState<FileRendition | null>(null);
  const [addingText, setAddingText] = useState(false);
  const [converting, setConverting] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, flash] = useStartedToast();
  const input = useRef<HTMLInputElement>(null);
  const source = doc.state.global.source;
  const convertible = hasStoredPdf(doc);
  const convert = convertAction(conversion);

  // Markdown a conversion made is listed as versions: the latest, then the earlier ones folded.
  const listedIds = new Set(renditions.map((r) => r.id));
  const views = conversion.renditions.filter((view) => listedIds.has(view.id));
  const generated = new Set(views.map((view) => view.id));
  const plain = renditions.filter((r) => !generated.has(r.id));
  const { latest, earlier } = versionsOf(views, conversion.renditionsPending);
  const [showEarlier, setShowEarlier] = useState(false);
  const activeEarlier = earlier.some((view) => view.id === active);
  useEffect(() => {
    if (activeEarlier) setShowEarlier(true);
  }, [activeEarlier]);
  const pending = conversion.active !== undefined || conversion.starting;

  // A conversion that ran while this was open shows its Markdown when it is saved.
  useShowFinished(conversion, onShow);

  const upload = (files: File[]) => {
    if (!client || files.length === 0) return;
    setError(null);
    setBusy(files.length === 1 ? `Storing ${files[0].name}…` : `Storing ${files.length} files…`);
    files
      .reduce<Promise<void>>(
        (p, f) =>
          p.then(() =>
            addFileRendition(client, doc.header.id, f, {
              type: guessRenditionType(f.type),
              label: null,
            }),
          ),
        Promise.resolve(),
      )
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setBusy(null));
  };
  const { dragProps, isDragOver } = useEditorFileDrop({ onFiles: upload });

  const versionMenu = (view: ConversionRenditionView): MenuItem[] => [
    { label: "Show in preview", onSelect: () => onShow(view.id) },
    {
      label: "Convert again…",
      disabled: !convertible || convert.disabled,
      onSelect: () => setConverting(true),
    },
    { label: "Conversion details", onSelect: () => onDetails(view.id) },
  ];
  const rows = plain.length > 0 || pending || latest !== undefined;

  return (
    <div {...dragProps} className={cx("sk-file-renditions", isDragOver && "is-over")}>
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
      {rows && (
        <ul className="sk-file-rows sk-file-rows--menus">
          {plain.map((r) => (
            <li key={r.id} className={cx("sk-file-row", active === r.id && "is-active")}>
              <button type="button" className="sk-file-row__main" onClick={() => onShow(r.id)}>
                <FileTypeTile kind={renditionKind(r)} />
                <span className="sk-file-row__body">
                  <span className="sk-file-row__name">
                    {renditionName(r)}
                    {r.text !== null && <span className="sk-file-row__flag">inline</span>}
                  </span>
                  <span className="sk-file-row__meta">{renditionMeta(r)}</span>
                </span>
              </button>
              <span className="sk-file-row__actions">
                <Menu
                  label="Rendition"
                  align="end"
                  items={[
                    { label: "Show in preview", onSelect: () => onShow(r.id) },
                    { label: "Edit details…", onSelect: () => setEditing(r) },
                    { label: "Remove", onSelect: () => dispatch(actions.removeRendition({ id: r.id })) },
                  ]}
                  trigger={(open, toggle) => (
                    <button
                      type="button"
                      className="sk-more"
                      aria-haspopup="menu"
                      aria-expanded={open}
                      aria-label={`Actions for ${renditionName(r)}`}
                      onClick={toggle}
                    >
                      <span />
                    </button>
                  )}
                />
              </span>
            </li>
          ))}
          <ConversionPendingRow conversion={conversion} />
          {latest && (
            <ConvertedRow
              key={latest.id}
              view={latest}
              active={active === latest.id}
              earlier={false}
              onShow={() => onShow(latest.id)}
              menu={versionMenu(latest)}
            />
          )}
        </ul>
      )}
      {earlier.length > 0 && (
        <details
          className="sk-convert-earlier"
          open={showEarlier}
          onToggle={(e) => setShowEarlier(e.currentTarget.open)}
        >
          <summary>
            <Icon name="chevron-right" size={16} mono />
            Earlier versions ({earlier.length})
          </summary>
          <ul className="sk-file-rows sk-file-rows--menus">
            {earlier.map((view) => (
              <ConvertedRow
                key={view.id}
                view={view}
                active={active === view.id}
                earlier
                onShow={() => onShow(view.id)}
                menu={versionMenu(view)}
              />
            ))}
          </ul>
        </details>
      )}
      {renditions.length === 0 && !pending && (
        <p className="sk-file-renditions__empty sk-small sk-text-muted">
          Nothing extracted yet. Add a PDF export, preview images, the text of a scan — or drop files here.
        </p>
      )}
      <div className="sk-file-renditions__actions">
        <Button size="sm" variant="secondary" icon="upload" disabled={!client || busy !== null} onClick={() => input.current?.click()}>
          Add files
        </Button>
        <Button size="sm" variant="ghost" icon="plus" onClick={() => setAddingText(true)}>
          Add text
        </Button>
        {convertible && !convert.again && (
          <ConvertButton conversion={conversion} onChoose={() => setConverting(true)} onStarted={flash} />
        )}
        {convertible && convert.again && views.length === 0 && (
          <Button
            size="sm"
            variant="secondary"
            icon="sync"
            disabled={convert.disabled}
            title={convert.title}
            onClick={() => setConverting(true)}
          >
            {convert.label}
          </Button>
        )}
        {busy && <span className="sk-caption">{busy}</span>}
      </div>
      {(convertible || conversion.renditions.length > 0) && (
        <ConversionStatus conversion={conversion} onRetry={convertible ? () => setConverting(true) : undefined} />
      )}
      {error && <p className="sk-small sk-text-danger">{error}</p>}
      {converting && (
        <ConvertDialog
          conversion={conversion}
          fileName={source?.fileName ?? doc.header.name}
          onClose={() => setConverting(false)}
          onStarted={flash}
        />
      )}
      {toast}
      {editing && (
        <RenditionModal rendition={editing} onClose={() => setEditing(null)} dispatch={dispatch} />
      )}
      {addingText && (
        <TextRenditionModal documentId={doc.header.id} onClose={() => setAddingText(false)} onAdded={onShow} />
      )}
    </div>
  );
}

function guessRenditionType(mimeType: string): string | null {
  const kind = fileKind(mimeType);
  if (kind === "img") return "preview";
  if (kind === "pdf") return "pdf-export";
  if (kind === "text" || kind === "data") return "text";
  if (kind === "html") return "html";
  return null;
}

function MimeField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const valid = MIME_PATTERN.test(value.trim());
  return (
    <label className={cx("sk-field", value.trim() !== "" && !valid && "sk-field--error")}>
      <span className="sk-label">MIME type</span>
      <input className="sk-input sk-font-mono" list="sk-file-mime-types" value={value} onChange={(e) => onChange(e.target.value)} />
      <datalist id="sk-file-mime-types">
        {COMMON_MIME_TYPES.map((m) => (
          <option key={m} value={m} />
        ))}
      </datalist>
      <span className="sk-hint">{valid || !value.trim() ? "Any type/subtype, e.g. text/plain or image/png" : "Not a MIME type: type/subtype"}</span>
    </label>
  );
}

function TypeField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <label className="sk-field">
      <span className="sk-label">Type <span className="sk-text-muted">(optional)</span></span>
      <input className="sk-input" list="sk-file-rendition-types" value={value} placeholder="e.g. preview, ocr, pdf-export" onChange={(e) => onChange(e.target.value)} />
      <datalist id="sk-file-rendition-types">
        {RENDITION_TYPES.map((t) => (
          <option key={t} value={t} />
        ))}
      </datalist>
    </label>
  );
}

function RenditionModal({
  rendition,
  onClose,
  dispatch,
}: {
  rendition: FileRendition;
  onClose: () => void;
  dispatch: Dispatch;
}) {
  const [label, setLabel] = useState(rendition.label ?? "");
  const [type, setType] = useState(rendition.type ?? "");
  const [mimeType, setMimeType] = useState(rendition.mimeType);
  const valid = MIME_PATTERN.test(mimeType.trim());
  return (
    <Modal
      title="Rendition details"
      onClose={onClose}
      footer={
        <>
          <span className="sk-grow" />
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            disabled={!valid}
            onClick={() => {
              dispatch(actions.updateRendition({ id: rendition.id, label, type, mimeType }));
              onClose();
            }}
          >
            Save
          </Button>
        </>
      }
    >
      <div className="sk-stack sk-stack--4">
        <label className="sk-field">
          <span className="sk-label">Label</span>
          <input className="sk-input" autoFocus value={label} placeholder={rendition.fileName ?? "e.g. First page"} onChange={(e) => setLabel(e.target.value)} />
        </label>
        <TypeField value={type} onChange={setType} />
        <MimeField value={mimeType} onChange={setMimeType} />
      </div>
    </Modal>
  );
}

function TextRenditionModal({
  documentId,
  onClose,
  onAdded,
}: {
  documentId: string;
  onClose: () => void;
  onAdded: (id: string) => void;
}) {
  const [label, setLabel] = useState("");
  const [type, setType] = useState("text");
  const [mimeType, setMimeType] = useState("text/plain");
  const [text, setText] = useState("");
  const valid = MIME_PATTERN.test(mimeType.trim());
  return (
    <Modal
      title="Add text content"
      onClose={onClose}
      footer={
        <>
          <span className="sk-grow" />
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            disabled={!valid}
            onClick={() => {
              void addTextRendition(documentId, {
                text,
                mimeType: mimeType.trim(),
                type: type.trim() || null,
                label: label.trim() || null,
              }).then(() => onAdded(""));
              onClose();
            }}
          >
            Add
          </Button>
        </>
      }
    >
      <div className="sk-stack sk-stack--4 sk-file-text-modal">
        <div className="sk-grid sk-grid--2">
          <label className="sk-field">
            <span className="sk-label">Label</span>
            <input className="sk-input" autoFocus value={label} placeholder="e.g. Extracted text" onChange={(e) => setLabel(e.target.value)} />
          </label>
          <TypeField value={type} onChange={setType} />
        </div>
        <MimeField value={mimeType} onChange={setMimeType} />
        <label className="sk-field">
          <span className="sk-label">Content</span>
          <textarea className="sk-textarea sk-font-mono" rows={10} value={text} placeholder={mimeType.includes("html") ? "<p>…</p>" : "Paste or type the content"} onChange={(e) => setText(e.target.value)} />
        </label>
      </div>
    </Modal>
  );
}

/** A file's tags as badges, for rows and previews. */
export function TagBadges({ tags, max = 4 }: { tags: readonly FileTag[]; max?: number }): ReactNode {
  if (tags.length === 0) return null;
  return (
    <span className="sk-file-tags sk-file-tags--inline">
      {tags.slice(0, max).map((t) => (
        <Badge key={t.id} tone={tagTone(t.color)} pill>
          {t.label}
        </Badge>
      ))}
      {tags.length > max && <span className="sk-caption">+{tags.length - max}</span>}
    </span>
  );
}
