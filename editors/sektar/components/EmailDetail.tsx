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
import { useState, type ReactNode } from "react";
import { fmtDate } from "../kit/format.js";
import {
  attachmentKind,
  bytes,
  fmtWhen,
  mail,
  mailboxLabel,
  type AttachmentKind,
} from "../kit/mail.js";
import { traceRender } from "../kit/diagnostics.js";
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
import { PaneSection } from "../kit/workspace.js";

function fileKindClass(kind: AttachmentKind): "pdf" | "img" | "xls" | "doc" | undefined {
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

/** The message body: the text as sent, or the HTML in a sandboxed frame. */
function Body({
  text,
  html,
  mode,
  onMode,
}: {
  text: string | null | undefined;
  html: string | null | undefined;
  mode: BodyMode;
  onMode: (m: BodyMode) => void;
}) {
  if (!text && !html) {
    return <p className="sk-small sk-text-muted">This message has no body.</p>;
  }
  // The preference only applies when the message has both; otherwise
  // whatever it has is shown.
  const showText = text ? mode === "text" || !html : false;
  return (
    <div className="sk-stack sk-stack--3">
      {showText ? (
        <pre className="sk-mail-body">{text}</pre>
      ) : (
        <iframe
          className="sk-mail-frame"
          title="Message"
          // No scripts, no forms, no navigation: the HTML is the sender's.
          sandbox=""
          referrerPolicy="no-referrer"
          srcDoc={html ?? ""}
        />
      )}
      {text && html && (
        <button
          type="button"
          className="sk-btn sk-btn--link sk-btn--sm"
          style={{ alignSelf: "flex-start" }}
          onClick={() => onMode(mode === "text" ? "html" : "text")}
        >
          {mode === "text" ? "Show formatted" : "Show plain text"}
        </button>
      )}
    </div>
  );
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

/** The triage actions, as menu items. */
export function emailMenuItems(doc: EmailDocument): MenuItem[] {
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
  ];
}

/** The more button with the triage menu, for a pane header. */
export function EmailMenu({ doc }: { doc: EmailDocument }) {
  return (
    <Menu
      label="Message actions"
      items={emailMenuItems(doc)}
      trigger={(open, toggle) => (
        <More aria-expanded={open} onClick={toggle} />
      )}
    />
  );
}

/** The triage buttons, for the standalone editor. */
export function EmailActions({ doc }: { doc: EmailDocument }) {
  return (
    <div className="sk-btn-group">
      {emailMenuItems(doc).map((it, i) => (
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
  compact,
  actions,
}: {
  doc: EmailDocument;
  /** The attachment open in the preview, if any */
  selectedRef?: string | null;
  onPickAttachment?: (a: EmailAttachment) => void;
  /** Inside a workspace pane: the header carries the badges and the menu */
  compact?: boolean;
  /** Standalone: the triage buttons beside the date */
  actions?: ReactNode;
}) {
  traceRender("EmailDetail");
  const s = doc.state.global;
  const sender = s.from[0];
  const [tab, setTab] = useState<"people" | "headers">("people");
  const [bodyMode, setBodyMode] = useBodyMode();
  const people: { m: Mailbox; role: string }[] = [
    ...s.from.map((m) => ({ m, role: "Sender" })),
    ...s.to.map((m) => ({ m, role: "To" })),
    ...s.cc.map((m) => ({ m, role: "Cc" })),
    ...s.bcc.map((m) => ({ m, role: "Bcc" })),
    ...s.replyTo.map((m) => ({ m, role: "Reply to" })),
  ];
  const toLine = s.to.map(mailboxLabel).join(", ");
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
        className="sk-row sk-row--between sk-row--wrap"
        style={{ alignItems: "flex-start" }}
      >
        <span className="sk-user">
          <Avatar name={sender ? mailboxLabel(sender) : "?"} />
          <span>
            <div className="sk-user__name">
              {sender ? mailboxLabel(sender) : "Unknown sender"}
            </div>
            <div className="sk-user__meta">
              {sender?.address}
              {toLine && (
                <span className="sk-mail__meta-to"> · To: {toLine}</span>
              )}
            </div>
          </span>
        </span>
        <div
          className="sk-row sk-row--2 sk-row--wrap"
          style={{ alignItems: "center" }}
        >
          <span
            className="sk-small sk-text-muted"
            title={fmtDate(s.sentAt ?? s.receivedAt)}
          >
            {fmtWhen(s.sentAt ?? s.receivedAt)}
          </span>
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

      <Body text={s.text} html={s.html} mode={bodyMode} onMode={setBodyMode} />

      {s.notes && (
        <div className="sk-alert">
          <strong>Note</strong> {s.notes}
        </div>
      )}

      {/* Standalone: the files as chips. In the workspace the preview pane's
          picker has them wide; stacked, the list below does. */}
      {!compact && s.attachments.length > 0 && (
        <div className="sk-files">
          {s.attachments.map((a) => (
            <Chip
              key={a.id}
              name={
                <span className={cx(selectedRef === a.ref && "sk-text-brand")}>
                  {a.fileName}
                </span>
              }
              meta={[a.mimeType, bytes(a.sizeBytes)].filter(Boolean).join(" · ")}
              kind={fileKindClass(attachmentKind(a))}
              onClick={onPickAttachment ? () => onPickAttachment(a) : undefined}
            />
          ))}
        </div>
      )}
      {compact && onPickAttachment && s.attachments.length > 0 && (
        <div className="sk-stack-only">
          <PaneSection title="Attachments" count={s.attachments.length}>
            <Selector
              list
              label="Attachments"
              value={selectedRef ?? ""}
              options={s.attachments.map((a) => ({
                value: a.ref,
                name: a.fileName,
                meta: bytes(a.sizeBytes) || a.mimeType || undefined,
              }))}
              onChange={(ref) => {
                const a = s.attachments.find((x) => x.ref === ref);
                if (a) onPickAttachment(a);
              }}
            />
          </PaneSection>
        </div>
      )}

      {/* the people and the headers, at the end */}
      <div className="sk-stack sk-stack--3">
        <Tabs
          value={tab}
          onChange={setTab}
          options={[
            { value: "people", label: "People", count: people.length },
            { value: "headers", label: "Headers", count: shownHeaders.length },
          ]}
        />
        {tab === "people" && (
          <ul className="sk-list sk-list--divided">
            {people.map(({ m, role }, i) => (
              <li key={`${role}-${m.address}-${i}`} className="sk-list-item">
                <Avatar name={mailboxLabel(m)} size="sm" />
                <span className="sk-list-item__body">
                  <span className="sk-list-item__title">{mailboxLabel(m)}</span>
                  <span className="sk-list-item__meta">{m.address}</span>
                </span>
                <span className="sk-list-item__value">
                  <Badge tone={role === "Sender" ? "forest" : "outline"}>
                    {role}
                  </Badge>
                </span>
              </li>
            ))}
          </ul>
        )}
        {tab === "headers" && (
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
        )}
      </div>
    </div>
  );
}

/** The file itself, beside the message it came with. */
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
          <img src={url} alt={file.fileName} className="sk-mail-preview-image" />
        )}
        {url && kind === "pdf" && (
          <iframe src={url} title={file.fileName} className="sk-mail-preview-frame" />
        )}
        {url && kind !== "image" && kind !== "pdf" && (
          <p className="sk-small sk-text-muted">
            No inline preview for {file.mimeType ?? "this file type"}. Open it
            in a new tab or download it.
          </p>
        )}
      </div>
    </div>
  );
}
