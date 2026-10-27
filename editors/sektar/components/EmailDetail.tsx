// One message, read, in the design system's message-pane order: who and
// when, the body, then (stacked) the files as a list to tap, then the people
// and the headers under tabs. The Mail workspace shows it in the middle
// pane with the labels and the more-menu in the pane header; the email
// editor shows it on its own and adds those itself.
import {
  useAttachmentPreview,
  useAttachments,
} from "@powerhousedao/reactor-browser";
import type {
  EmailAttachment,
  EmailDocument,
  Mailbox,
} from "document-models/email";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { fmtDate } from "../kit/format.js";
import {
  attachmentKind,
  bytes,
  isPlainText,
  fmtWhenTime,
  mail,
  mailboxLabel,
  messagePeople,
  uniqueAttachments,
  type MessagePerson,
  type AttachmentKind,
} from "../kit/mail.js";
import { traceRender } from "../kit/diagnostics.js";
import { printEmail } from "../kit/print-email.js";
import { Menu, type MenuItem } from "../kit/menu.js";
import {
  Avatar,
  Badge,
  Button,
  Chip,
  cx,
  Icon,
  More,
  Selector,
  Table,
  Tabs,
} from "../kit/ui.js";
import { PaneSection, useWorkspaceStacked } from "../kit/workspace.js";

function fileKindClass(
  kind: AttachmentKind,
): "pdf" | "img" | "xls" | "doc" | undefined {
  switch (kind) {
    case "pdf":
      return "pdf";
    case "image":
      return "img";
    case "sheet":
      return "xls";
    case "document":
      return "doc";
    default:
      return undefined;
  }
}

type BodyMode = "text" | "html";
const BODY_MODE_KEY = "sk:mail-body";

/** How to read mail bodies that come in both forms: a preference, remembered per browser. */
function useBodyMode(): [BodyMode, (m: BodyMode) => void] {
  const [mode, setMode] = useState<BodyMode>(() => {
    try {
      return localStorage.getItem(BODY_MODE_KEY) === "html" ? "html" : "text";
    } catch {
      return "text";
    }
  });
  const set = (m: BodyMode) => {
    setMode(m);
    try {
      localStorage.setItem(BODY_MODE_KEY, m);
    } catch {
      // remembered only when storage is available
    }
  };
  return [mode, set];
}

/** The message body in the form the tabs picked: the text as sent, or the
 * HTML in a sandboxed frame. */
function Body({
  text,
  html,
  mode,
}: {
  text: string | null | undefined;
  html: string | null | undefined;
  mode: BodyMode;
}) {
  if (!text && !html) {
    return <p className="sk-small sk-text-muted">This message has no body.</p>;
  }
  return mode === "text" && text ? (
    <pre className="sk-mail-body">{text}</pre>
  ) : (
    <MessageFrame html={html ?? ""} />
  );
}

/**
 * The sender's HTML in a sandboxed frame as tall as its document, so the
 * message scrolls with the pane instead of inside a box. Scripts stay off;
 * same-origin only lets this page read the document's height.
 */
function MessageFrame({ html }: { html: string }) {
  const frame = useRef<HTMLIFrameElement>(null);
  useEffect(() => {
    const el = frame.current;
    if (!el) return;
    const measure = () => {
      const doc = el.contentDocument;
      if (!doc?.documentElement) return;
      // A document's scrollHeight never drops below the frame's own height,
      // so the frame is collapsed for the reading; the border is added back
      // (border-box), or the last pixels scroll inside the frame.
      const border = el.offsetHeight - el.clientHeight;
      el.style.height = "0px";
      const content = doc.documentElement.scrollHeight;
      el.style.height = `${content + border}px`;
      // It is as tall as its content: never a scrollbar of its own.
      doc.documentElement.style.overflowY = "hidden";
    };
    // Images and fonts arrive after load: measure again for a while.
    const timers = [0, 150, 500, 1500, 4000].map((ms) =>
      window.setTimeout(measure, ms),
    );
    el.addEventListener("load", measure);
    // Only a new width reflows the message; a height change is our own.
    let width = el.clientWidth;
    const widths = new ResizeObserver(() => {
      if (el.clientWidth === width) return;
      width = el.clientWidth;
      measure();
    });
    widths.observe(el);
    return () => {
      timers.forEach((t) => window.clearTimeout(t));
      el.removeEventListener("load", measure);
      widths.disconnect();
    };
  }, [html]);
  return (
    <iframe
      ref={frame}
      className="sk-mail-frame"
      title="Message"
      // No scripts, no forms, no navigation: the HTML is the sender's.
      sandbox="allow-same-origin"
      referrerPolicy="no-referrer"
      srcDoc={html}
    />
  );
}

/** A person on a message, opened from the preview pane's list. The picker
 * above already names them and their role; for now the page is a placeholder. */
export function PersonPreview(_props: { person: MessagePerson }) {
  return (
    <p className="sk-small sk-text-muted">
      More about this person (their messages, files and contact details) will
      appear here.
    </p>
  );
}

/** A person as the picker names them: the name, their role on the message beside it. */
export function personName(p: MessagePerson): ReactNode {
  return (
    <span className="sk-mail__person">
      <span className="sk-mail__person-name">{mailboxLabel(p.m)}</span>
      <span className="sk-mail__person-role">{p.role}</span>
    </span>
  );
}

type MessageView = BodyMode | "headers";

const plural = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`;

/**
 * The message's date and time, and under it the attachment and people
 * counts. Stacked, the block leads to the attachments and people screen, with
 * a caret saying so.
 */
function When({
  iso,
  files,
  people,
  onOpen,
}: {
  iso: string | null | undefined;
  files: number;
  people: number;
  onOpen?: () => void;
}) {
  const stacked = useWorkspaceStacked();
  const content = (
    <>
      <span className="sk-mail__when-text">
        <span className="sk-small sk-text-muted" title={fmtDate(iso)}>
          {fmtWhenTime(iso)}
        </span>
        <span className="sk-mail__when-counts sk-small sk-text-muted">
          {files > 0 && (
            <span
              className="sk-mail__when-count"
              title={plural(files, "attachment", "attachments")}
              aria-label={plural(files, "attachment", "attachments")}
            >
              <Icon name="upload" size={16} mono />
              {files}
            </span>
          )}
          {people > 0 && (
            <span
              className="sk-mail__when-count"
              title={plural(people, "person", "people")}
              aria-label={plural(people, "person", "people")}
            >
              <Icon name="customers" size={16} mono />
              {people}
            </span>
          )}
        </span>
      </span>
    </>
  );
  if (stacked && onOpen && files + people > 0) {
    return (
      <button
        type="button"
        className="sk-mail__when sk-mail__when--drill"
        onClick={onOpen}
        aria-label={`Attachments and people: ${plural(files, "attachment", "attachments")}, ${plural(people, "person", "people")}`}
      >
        {content}
        <Icon name="chevron-right" className="sk-mail__when-caret" />
      </button>
    );
  }
  return <span className="sk-mail__when">{content}</span>;
}

/** The labels on a message, as badges (the pane header wide, the body alone). */
export function EmailBadges({ doc }: { doc: EmailDocument }) {
  const s = doc.state.global;
  return (
    <>
      {s.status === "ARCHIVED" && <Badge tone="neutral">Archived</Badge>}
      {s.flagged && (
        <Badge tone="warning" dot>
          Flagged
        </Badge>
      )}
      {s.labels.map((l) => (
        <Badge key={l} tone="mint">
          {l}
        </Badge>
      ))}
    </>
  );
}

/** The triage actions, as menu items; with `onPrint`, printing too. */
export function emailMenuItems(
  doc: EmailDocument,
  onPrint?: () => void,
): MenuItem[] {
  const s = doc.state.global;
  const id = doc.header.id;
  return [
    {
      label: s.read ? "Mark as unread" : "Mark as read",
      icon: "mail",
      onSelect: () => void (s.read ? mail.markUnread(id) : mail.markRead(id)),
    },
    {
      label: s.flagged ? "Remove flag" : "Flag",
      icon: "bell",
      active: s.flagged,
      onSelect: () => void mail.setFlagged(id, !s.flagged),
    },
    {
      label: s.status === "ARCHIVED" ? "Move to inbox" : "Archive",
      icon: s.status === "ARCHIVED" ? "folder" : "download",
      onSelect: () =>
        void (s.status === "ARCHIVED" ? mail.unarchive(id) : mail.archive(id)),
    },
    ...(onPrint
      ? [
          {
            label: "Print or save as PDF",
            icon: "invoice" as const,
            section: "This message",
            onSelect: onPrint,
          },
        ]
      : []),
  ];
}

/** The more button with the triage menu, for a pane header. */
export function EmailMenu({ doc }: { doc: EmailDocument }) {
  const client = useAttachments();
  return (
    <Menu
      label="Message actions"
      items={emailMenuItems(doc, () => void printEmail(doc, client))}
      trigger={(open, toggle) => <More aria-expanded={open} onClick={toggle} />}
    />
  );
}

/** The triage buttons, for the standalone editor. */
export function EmailActions({ doc }: { doc: EmailDocument }) {
  const client = useAttachments();
  return (
    <div className="sk-btn-group">
      {emailMenuItems(doc, () => void printEmail(doc, client)).map((it, i) => (
        <Button
          key={i}
          size="sm"
          variant={it.active ? "soft" : "ghost"}
          icon={it.icon}
          onClick={it.onSelect}
        >
          {it.label}
        </Button>
      ))}
    </div>
  );
}

export function EmailDetail({
  doc,
  selectedRef,
  onPickAttachment,
  onPickPerson,
  onOpenDetails,
  compact,
  actions,
}: {
  doc: EmailDocument;
  /** The attachment open in the preview, if any */
  selectedRef?: string | null;
  onPickAttachment?: (a: EmailAttachment) => void;
  /** Stacked: a person picked from the list under the message (by key) */
  onPickPerson?: (key: string) => void;
  /** Stacked: the date block drills to the attachments and people */
  onOpenDetails?: () => void;
  /** Inside a workspace pane: the header carries the badges and the menu */
  compact?: boolean;
  /** Standalone: the triage buttons beside the date */
  actions?: ReactNode;
}) {
  traceRender("EmailDetail");
  const s = doc.state.global;
  const sender = s.from[0];
  const [bodyMode, setBodyMode] = useBodyMode();
  // Headers is picked per message: the next message opens on its body.
  const [headersOf, setHeadersOf] = useState<string | null>(null);
  const showHeaders = headersOf === doc.header.id;
  // The forms this message has; the remembered one when it has both.
  const hasHtml = Boolean(s.html);
  const hasText = Boolean(s.text);
  const body: BodyMode =
    hasHtml && hasText ? bodyMode : hasHtml ? "html" : "text";
  // A message without a body has only its headers to show.
  const view: MessageView =
    showHeaders || (!hasHtml && !hasText) ? "headers" : body;
  const pickView = (v: MessageView) => {
    if (v === "headers") {
      setHeadersOf(doc.header.id);
      return;
    }
    setHeadersOf(null);
    setBodyMode(v);
  };
  const people = messagePeople(s);
  const recipients = [
    { label: "To", boxes: s.to },
    { label: "Cc", boxes: s.cc },
  ].filter((r) => r.boxes.length > 0);
  const files = uniqueAttachments(s.attachments);
  const headerRows: [string, string | null | undefined][] = [
    ["Message-ID", s.messageId],
    ["Thread", s.threadId],
    ["In reply to", s.inReplyTo],
    ["References", s.references.join(" ") || null],
    ["External id", s.externalId],
    ["Source", s.source],
    ["Captured", s.capturedAt ? fmtDate(s.capturedAt) : null],
    ...s.headers.map((h): [string, string] => [h.key, h.value]),
  ];
  const shownHeaders = headerRows.filter(([, v]) => v);

  return (
    <div className="sk-stack sk-stack--4">
      {/* who and when */}
      <div
        className="sk-row sk-row--between sk-mail__who"
        style={{ alignItems: "flex-start" }}
      >
        <span className="sk-user">
          <Avatar name={sender ? mailboxLabel(sender) : "?"} />
          <span>
            <div className="sk-user__name">
              {sender ? mailboxLabel(sender) : "Unknown sender"}
            </div>
            <div className="sk-user__meta">{sender?.address}</div>
          </span>
        </span>
        <div
          className="sk-row sk-row--2 sk-row--wrap"
          style={{ alignItems: "flex-start" }}
        >
          <When
            iso={s.sentAt ?? s.receivedAt}
            files={files.length}
            people={people.length}
            onOpen={onOpenDetails}
          />
          {actions}
        </div>
      </div>

      {!compact && (
        <>
          <h2 style={{ fontSize: "var(--sk-text-2xl)" }}>
            {s.subject ?? "(no subject)"}
          </h2>
          <div className="sk-row sk-row--2 sk-row--wrap">
            <EmailBadges doc={doc} />
          </div>
        </>
      )}

      {recipients.length > 0 && (
        <table className="sk-mail__recipients">
          <tbody>
            {recipients.map(({ label, boxes }) => (
              <tr key={label}>
                <th scope="row">{label}</th>
                <td>
                  {boxes.map((m, i) => (
                    <span
                      key={`${m.address}-${i}`}
                      className="sk-mail__recipient"
                    >
                      {m.name?.trim() ? (
                        <>
                          {m.name.trim()}{" "}
                          <span className="sk-text-muted">{m.address}</span>
                        </>
                      ) : (
                        m.address
                      )}
                      {i < boxes.length - 1 && ", "}
                    </span>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="sk-stack sk-stack--3">
        <Tabs
          value={view}
          onChange={pickView}
          options={[
            ...(hasHtml
              ? [{ value: "html" as const, label: "Formatted" }]
              : []),
            ...(hasText
              ? [{ value: "text" as const, label: "Plain text" }]
              : []),
            {
              value: "headers" as const,
              label: "Headers",
              count: shownHeaders.length,
            },
          ]}
        />
        {view === "headers" ? (
          // The design system's data table: eyebrow headers, hairline rows.
          // Raw header values are set in mono and wrap anywhere, so a long
          // Message-ID or DKIM line never widens the pane.
          <div className="sk-card sk-card--subtle sk-card--compact sk-table-wrap sk-mail-headers__card">
            <Table compact className="sk-mail-headers">
              <thead>
                <tr>
                  <th>Header</th>
                  <th>Value</th>
                </tr>
              </thead>
              <tbody>
                {shownHeaders.map(([k, v], i) => (
                  <tr key={`${k}-${i}`}>
                    <td className="sk-mail-headers__key">{k}</td>
                    <td className="sk-mail-headers__value sk-font-mono">{v}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        ) : (
          <Body text={s.text} html={s.html} mode={body} />
        )}
      </div>

      {s.notes && (
        <div className="sk-alert">
          <strong>Note</strong> {s.notes}
        </div>
      )}

      {/* Standalone: the files as chips. In the workspace the preview pane's
          picker has them wide; stacked, the list below does. */}
      {!compact && files.length > 0 && (
        <div className="sk-files">
          {files.map((a) => (
            <Chip
              key={a.id}
              name={
                <span className={cx(selectedRef === a.ref && "sk-text-brand")}>
                  {a.fileName}
                </span>
              }
              meta={[a.mimeType, bytes(a.sizeBytes)]
                .filter(Boolean)
                .join(" · ")}
              kind={fileKindClass(attachmentKind(a))}
              onClick={onPickAttachment ? () => onPickAttachment(a) : undefined}
            />
          ))}
        </div>
      )}
      {compact && onPickAttachment && files.length > 0 && (
        <div className="sk-stack-only">
          <PaneSection title="Attachments" count={files.length}>
            <Selector
              list
              label="Attachments"
              value={selectedRef ?? ""}
              options={files.map((a) => ({
                value: a.ref,
                name: a.fileName,
                meta: bytes(a.sizeBytes) || a.mimeType || undefined,
              }))}
              onChange={(ref) => {
                const a = files.find((x) => x.ref === ref);
                if (a) onPickAttachment(a);
              }}
            />
          </PaneSection>
        </div>
      )}
      {compact && onPickPerson && people.length > 0 && (
        <div className="sk-stack-only">
          <PaneSection title="People" count={people.length}>
            <Selector
              list
              label="People"
              value={selectedRef ?? ""}
              options={people.map((p) => ({
                value: p.key,
                name: personName(p),
                meta: p.m.address,
                icon: "customers" as const,
              }))}
              onChange={onPickPerson}
            />
          </PaneSection>
        </div>
      )}
    </div>
  );
}

/** The file itself, beside the message it came with. */
/** The most of a text file shown inline; the rest is a download away. */
const TEXT_PREVIEW_LIMIT = 512 * 1024;

/**
 * A text file's bytes as text: the charset it is served with when it names
 * one, else UTF-8, else Windows-1252 (old mail attachments: “quotes” that are
 * not UTF-8 would otherwise show as replacement characters).
 */
function decodeText(bytes: ArrayBuffer, contentType: string | null): string {
  const declared = /charset=([^;]+)/i.exec(contentType ?? "")?.[1]?.trim();
  if (declared) {
    try {
      return new TextDecoder(declared).decode(bytes);
    } catch {
      // an unknown charset name: guess as below
    }
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
}

/** A plain-text attachment, read from its preview URL and shown as text. */
function TextPreview({ url }: { url: string }) {
  const [text, setText] = useState<{ body: string; cut: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    setText(null);
    setError(null);
    fetch(url)
      .then(async (r) =>
        decodeText(await r.arrayBuffer(), r.headers.get("content-type")),
      )
      .then((body) => {
        if (!live) return;
        const cut = body.length > TEXT_PREVIEW_LIMIT;
        setText({ body: cut ? body.slice(0, TEXT_PREVIEW_LIMIT) : body, cut });
      })
      .catch((e: unknown) => {
        if (live) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      live = false;
    };
  }, [url]);
  if (error) {
    return (
      <p className="sk-small sk-text-danger">
        Could not read this file: {error}
      </p>
    );
  }
  if (!text) return <p className="sk-small sk-text-muted">Reading…</p>;
  return (
    <>
      <pre className="sk-mail-body sk-mail-preview-text">{text.body}</pre>
      {text.cut && (
        <p className="sk-small sk-text-muted">
          Showing the first 512 KB. Download the file for the rest.
        </p>
      )}
    </>
  );
}

export function AttachmentPreview({
  documentId,
  file,
}: {
  documentId: string;
  file: EmailAttachment | null;
}) {
  traceRender("AttachmentPreview");
  const client = useAttachments();
  const preview = useAttachmentPreview({ documentId, ref: file?.ref });
  // The hook's state lags one render behind a ref change, so the URL is only
  // trusted once this file's own load has finished. Pairing a new PDF with
  // the previous file's bytes handed Chrome a calendar blob in a PDF frame,
  // which it downloads. Callers also key this component by ref.
  const ready = preview.stage === "done" && !preview.loading;
  const url = ready ? preview.url : undefined;
  const kind = file
    ? attachmentKind(file, ready ? preview.header?.mimeType : undefined)
    : "other";
  const plain = file
    ? isPlainText(file, ready ? preview.header?.mimeType : undefined)
    : false;
  if (!file) {
    return (
      <p className="sk-small sk-text-muted">
        Pick an attachment on the message and it opens here.
      </p>
    );
  }
  return (
    <div className="sk-preview">
      <div className="sk-preview__toolbar">
        {url && (
          <a
            className="sk-btn sk-btn--ghost sk-btn--sm sk-btn--icon"
            href={url}
            target="_blank"
            rel="noreferrer"
            aria-label="Open in a new tab"
            title="Open in a new tab"
          >
            <Icon name="arrow-up-right" />
          </a>
        )}
        <span className="sk-grow" />
        {client && (
          <Button
            size="sm"
            variant="ghost"
            iconOnly
            icon="download"
            aria-label="Download"
            title="Download"
            onClick={() =>
              void client.saveAttachment(
                { documentId, ref: file.ref },
                { fileName: file.fileName },
              )
            }
          />
        )}
      </div>
      <div className="sk-preview__page">
        {!client && (
          <p className="sk-small sk-text-muted">
            This drive lives in the browser only, so there is no attachment
            store to fetch the file from.
          </p>
        )}
        {client && preview.loading && (
          <p className="sk-small sk-text-muted">
            Fetching… attempt {preview.attempt} of {preview.maxAttempts}
          </p>
        )}
        {client && preview.error && !preview.loading && (
          <p className="sk-small sk-text-danger">
            Could not load this file: {preview.error.message}
          </p>
        )}
        {url && kind === "image" && (
          <img
            src={url}
            alt={file.fileName}
            className="sk-mail-preview-image"
          />
        )}
        {url && kind === "pdf" && (
          <iframe
            src={url}
            title={file.fileName}
            className="sk-mail-preview-frame"
          />
        )}
        {url && plain && <TextPreview url={url} />}
        {url && !plain && kind !== "image" && kind !== "pdf" && (
          <p className="sk-small sk-text-muted">
            No inline preview for {file.mimeType ?? "this file type"}. Open it
            in a new tab or download it.
          </p>
        )}
      </div>
    </div>
  );
}
