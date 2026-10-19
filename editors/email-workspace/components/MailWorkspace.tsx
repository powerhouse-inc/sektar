// The Mail workspace: the design system's panes pattern. Four panes — the
// inbox chooser (a level-0 parent, visible only when stacked), the message
// list, the message, the attachment preview — side by side on a wide
// screen and one at a time under 640px of container width, as a push
// navigation. The top bar's search filters the list; the inbox selector is
// a second top-bar row wide, and the list's title is the switch to the
// chooser when stacked.
import {
  isFileNodeKind,
  useAttachments,
  useSelectedDrive,
  useSelectedNode,
} from "@powerhousedao/reactor-browser";
import type { EmailAttachment, EmailDocument } from "document-models/email";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import {
  AttachmentPreview,
  EmailBadges,
  EmailDetail,
  EmailMenu,
} from "../../sektar/components/EmailDetail.js";
import {
  accountsOf,
  bytes,
  EMAIL_TYPE,
  fmtWhen,
  mail,
  mailboxLabel,
  matchesMail,
  seedSampleMail,
  uniqueAttachments,
  useEmails,
} from "../../sektar/kit/mail.js";
import { fileIds } from "../../sektar/kit/data.js";
import { traceChange, traceRender, useDomDiagnostics } from "../../sektar/kit/diagnostics.js";
import { Menu } from "../../sektar/kit/menu.js";
import { useSearch } from "../../sektar/kit/search-context.js";
import {
  Avatar,
  Badge,
  Button,
  cx,
  EmptyState,
  Icon,
  ListItem,
  Progress,
  Selector,
  Skeleton,
} from "../../sektar/kit/ui.js";
import {
  Pane,
  PaneSwitch,
  SubBar,
  Workspace,
} from "../../sektar/kit/workspace.js";

const ALL = "all";
type View = "inbox" | "unread" | "flagged" | "archived";
const VIEWS: { value: View; label: string }[] = [
  { value: "inbox", label: "Inbox" },
  { value: "unread", label: "Unread" },
  { value: "flagged", label: "Flagged" },
  { value: "archived", label: "Archived" },
];

/** Which level a stacked workspace shows: 0 inboxes · 1 list · 2 message · 3 file */
type Level = 0 | 1 | 2 | 3;

export function MailWorkspace() {
  traceRender("MailWorkspace");
  const [drive] = useSelectedDrive();
  const node = useSelectedNode();
  const client = useAttachments();
  const emails = useEmails(drive);
  const accounts = useMemo(() => accountsOf(emails), [emails]);
  const { query } = useSearch();

  const [account, setAccount] = useState<string>(ALL);
  const [view, setView] = useState<View>("inbox");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [checked, setChecked] = useState<Set<string>>(() => new Set());
  const [fileRef, setFileRef] = useState<string | null>(null);
  const [level, setLevel] = useState<Level>(1);
  const [listCollapsed, setListCollapsed] = useState(false);
  // The preview pane: null means "decide for me" — collapsed to its strip
  // while the workspace is too narrow for three readable panes; a toggle or
  // an explicitly picked file makes the choice explicit.
  const [previewPref, setPreviewPref] = useState<boolean | null>(null);

  // A message opened by URL (/d/mail/<node>) is the selection.
  useEffect(() => {
    if (node && isFileNodeKind(node) && node.documentType === "sektar/email") {
      setSelectedId(node.id);
      setLevel(2);
    }
  }, [node]);

  const visible = useMemo(
    () =>
      emails.filter((doc) => {
        const s = doc.state.global;
        if (account !== ALL && s.account.address !== account) return false;
        if (view === "archived") {
          if (s.status !== "ARCHIVED") return false;
        } else if (s.status === "ARCHIVED") return false;
        if (view === "unread" && s.read) return false;
        if (view === "flagged" && !s.flagged) return false;
        return matchesMail(query, doc);
      }),
    [emails, account, view, query],
  );

  const selected = emails.find((d) => d.header.id === selectedId);
  const files = useMemo(
    () => (selected ? uniqueAttachments(selected.state.global.attachments) : []),
    [selected],
  );
  const hasFiles = files.length > 0;
  const file = files.find((a) => a.ref === fileRef) ?? null;

  const pick = (doc: EmailDocument) => {
    setSelectedId(doc.header.id);
    // Line up the first file so an open preview follows the selection, but
    // keep a collapsed preview collapsed: a pane that reopens itself is a
    // pane you cannot close.
    setFileRef(uniqueAttachments(doc.state.global.attachments)[0]?.ref ?? null);
    setLevel(2);
    if (!doc.state.global.read) void mail.markRead(doc.header.id);
  };

  const pickFile = (a: EmailAttachment) => {
    setFileRef(a.ref);
    setPreviewPref(false);
    setLevel(3);
  };

  const toggleChecked = (id: string) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // One mailbox: nothing to choose between, so no selector, no chooser
  // screen and no switch; the list is simply titled after the mailbox.
  const single = accounts.length <= 1;
  const accountName = single
    ? (accounts[0]?.name ?? "Inbox")
    : account === ALL
      ? "All inboxes"
      : (accounts.find((a) => a.address === account)?.name ?? account);
  const accountOptions = [
    {
      value: ALL,
      name: "All inboxes",
      meta: `${accounts.length} ${accounts.length === 1 ? "account" : "accounts"}`,
      icon: "mail" as const,
    },
    ...accounts.map((a) => ({
      value: a.address,
      name: a.name,
      meta: a.address,
      icon: "customers" as const,
    })),
  ];

  // The root only exists once there is mail (the empty state renders
  // without it), so the measuring hooks re-arm when it appears.
  const root = useRef<HTMLDivElement>(null);
  const hasMail = emails.length > 0;
  const height = useFillHeight(root, hasMail);
  const narrow = useNarrow(root, 1000, hasMail);
  // Opt-in: localStorage sk:mail-debug=1 or ?debug=mail (kit/diagnostics.ts)
  useDomDiagnostics(root, hasMail);
  const previewCollapsed = previewPref ?? narrow;
  traceChange("state", {
    mail: emails.length,
    visible: visible.length,
    accounts: accounts.length,
    selected: selectedId?.slice(0, 8) ?? null,
    found: Boolean(selected),
    files: selected?.state.global.attachments.length ?? null,
    file: fileRef?.slice(-8) ?? null,
    fileFound: Boolean(file),
    collapsed: previewCollapsed,
    narrow,
    level,
    height,
  });

  if (emails.length === 0) {
    // The drive's node list arrives before the documents it names (a
    // remote drive syncs in that order), so for a few seconds there is mail
    // on the way but none to show: a skeleton, not the empty state.
    const expected = fileIds(drive, EMAIL_TYPE).length;
    return (
      <div
        className="sk-page"
        style={{ padding: "var(--sk-space-10) var(--sk-space-6)" }}
      >
        {expected > 0 ? (
          <div className="sk-stack sk-stack--4" style={{ maxWidth: 560, margin: "0 auto" }}>
            <Skeleton width={180} height={20} />
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} height={64} />
            ))}
          </div>
        ) : (
          <MailEmpty drive={drive} hasStore={Boolean(client)} />
        )}
      </div>
    );
  }

  return (
    <div
      ref={root}
      className="sk-mail"
      style={{ height: height ? `${height}px` : undefined }}
    >
      {/* The inbox selector: a second top-bar row. Narrow, the design system
          hides it and the list's title becomes the switch to the chooser. */}
      {!single && (
        <SubBar className="sk-subbar--wide">
          <Selector
            value={account}
            options={accountOptions}
            onChange={(v) => {
              setAccount(v);
              setLevel(1);
            }}
            label="Inbox"
          />
        </SubBar>
      )}

      <Workspace level={level} hasParent={!single}>
        {!single && (
          <Pane parent title="Inboxes" count={accounts.length} flush>
            <Selector
              value={account}
              options={accountOptions}
              onChange={(v) => {
                setAccount(v);
                setLevel(1);
              }}
              label="Inbox"
              list
            />
          </Pane>
        )}

        <Pane
          side="start"
          grow={1}
          flush
          collapsed={listCollapsed}
          onToggle={() => setListCollapsed((v) => !v)}
          count={visible.length}
          // The switch's own title is what the collapsed strip shows.
          title={single ? accountName : undefined}
          header={
            single ? undefined : (
              <PaneSwitch
                label={accountName}
                ariaLabel="Choose inbox"
                onClick={() => setLevel(0)}
              />
            )
          }
          trailing={
            <Menu
                label="View"
                items={VIEWS.map((v) => ({
                  label: v.label,
                  active: v.value === view,
                  onSelect: () => setView(v.value),
                }))}
                trigger={(open, toggle) => (
                  <button
                    type="button"
                    className="sk-btn sk-btn--ghost sk-btn--sm"
                    aria-haspopup="menu"
                    aria-expanded={open}
                    onClick={toggle}
                  >
                    {VIEWS.find((v) => v.value === view)?.label}
                    <Icon name="chevron-down" size={16} mono />
                  </button>
                )}
              />
          }
        >
          {visible.length === 0 ? (
            <div style={{ padding: "var(--sk-space-6)" }}>
              <EmptyState icon="mail" title="Nothing here">
                {query
                  ? "No message matches that search."
                  : "No messages in this view."}
              </EmptyState>
            </div>
          ) : (
            <ul className="sk-list sk-list--rich">
              {visible.map((doc) => (
                <li key={doc.header.id}>
                  <MessageRow
                    doc={doc}
                    selected={doc.header.id === selectedId}
                    checked={checked.has(doc.header.id)}
                    onCheck={() => toggleChecked(doc.header.id)}
                    onClick={() => pick(doc)}
                  />
                </li>
              ))}
            </ul>
          )}
        </Pane>

        <Pane
          grow={1.35}
          onBack={() => setLevel(1)}
          backLabel="Back to the list"
          title={
            selected?.state.global.subject ??
            (selected ? "(no subject)" : "Mail")
          }
          titleDisplay
          header={
            selected && (
              <>
                <EmailBadges doc={selected} />
                <span className="sk-pane__spacer" />
                <EmailMenu doc={selected} />
              </>
            )
          }
        >
          {selected ? (
            <EmailDetail
              doc={selected}
              compact
              selectedRef={fileRef}
              onPickAttachment={pickFile}
            />
          ) : (
            <EmptyState icon="mail" title="Pick a message">
              The message opens here; its files open beside it.
            </EmptyState>
          )}
        </Pane>

        <Pane
          side="end"
          grow={1}
          collapsed={previewCollapsed}
          onToggle={() => setPreviewPref(!previewCollapsed)}
          onBack={() => setLevel(2)}
          backLabel="Back to the message"
          // With files the header is the picker and the title appears only
          // when collapsed; without, the title is the header.
          collapsedTitle={hasFiles ? "Attachments" : undefined}
          title={hasFiles ? undefined : "Attachments"}
          header={
            hasFiles && selected ? (
              <Selector
                value={fileRef ?? files[0].ref}
                options={files.map((a) => ({
                  value: a.ref,
                  name: a.fileName,
                  meta: bytes(a.sizeBytes) || a.mimeType || undefined,
                }))}
                onChange={(ref) => setFileRef(ref)}
                label="Attachment"
              />
            ) : undefined
          }
        >
          {selected ? (
            <AttachmentPreview
              key={file?.ref ?? "none"}
              documentId={selected.header.id}
              file={file}
            />
          ) : (
            <p className="sk-small sk-text-muted">
              Files travel with their message.
            </p>
          )}
        </Pane>
      </Workspace>
    </div>
  );
}

/**
 * A row re-renders only when its own message, selection or checkbox changes.
 * The drive syncs one operation at a time while a backfill runs, and every
 * sync re-renders the workspace; React re-applies `type` and `name` on each
 * controlled checkbox it re-renders, which the browser paints as a blink.
 * Two hundred rows blinking once a second was the "flicker".
 */
const MessageRow = memo(MessageRowImpl, (a, b) =>
  a.selected === b.selected &&
  a.checked === b.checked &&
  a.doc.header.id === b.doc.header.id &&
  // Every sync hands out new state objects; the modification time is what
  // says whether this message changed.
  a.doc.header.lastModifiedAtUtcIso === b.doc.header.lastModifiedAtUtcIso,
);

function MessageRowImpl({
  doc,
  selected,
  checked,
  onCheck,
  onClick,
}: {
  doc: EmailDocument;
  selected: boolean;
  checked: boolean;
  onCheck: () => void;
  onClick: () => void;
}) {
  traceRender("MessageRow");
  const s = doc.state.global;
  const sender = s.from[0];
  const name = sender ? mailboxLabel(sender) : "Unknown sender";
  const fileCount = uniqueAttachments(s.attachments).length;
  return (
    <ListItem
      rich
      selected={selected}
      onClick={onClick}
      // Stacked, this row leads to the message screen: the chevron says so.
      drill={2}
      leading={
        <label
          className="sk-check"
          onClick={(e) => e.stopPropagation()}
          aria-label="Select message"
        >
          <input type="checkbox" checked={checked} onChange={onCheck} />
        </label>
      }
      icon={<Avatar name={name} />}
      title={
        <span className={cx(!s.read && "sk-mail__unread")}>
          {name}
          {!s.read && (
            <span
              className="sk-badge sk-badge--dot sk-badge--mint"
              style={{ marginLeft: 4 }}
              aria-label="Unread"
            />
          )}
        </span>
      }
      sub={[
        <span key="subject" style={{ color: "var(--sk-text)" }}>
          {s.subject ?? "(no subject)"}
        </span>,
        s.snippet ?? "",
      ]}
      aside={
        <>
          <span>{fmtWhen(s.sentAt ?? s.receivedAt)}</span>
          {fileCount > 0 && (
            <span
              className="sk-mail__files"
              title={`${fileCount} ${fileCount === 1 ? "attachment" : "attachments"}`}
            >
              <Icon name="upload" size={16} mono />
              {fileCount > 1 && fileCount}
            </span>
          )}
          {s.flagged && (
            <Badge tone="warning" dot pill>
              Flagged
            </Badge>
          )}
        </>
      }
      chevron
    />
  );
}

function MailEmpty({
  drive,
  hasStore,
}: {
  drive: ReturnType<typeof useSelectedDrive>[0];
  hasStore: boolean;
}) {
  const client = useAttachments();
  const [step, setStep] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const busy = step !== null && step !== "Done";
  return (
    <div
      className="sk-stack sk-stack--6"
      style={{ maxWidth: 560, margin: "0 auto" }}
    >
      <EmptyState
        icon="mail"
        title="No mail yet"
        action={
          !busy && (
            <Button
              variant="primary"
              icon="leaf"
              onClick={() => {
                setError(null);
                setStep("Starting");
                seedSampleMail(drive, client, setStep).catch((e: unknown) => {
                  setError(e instanceof Error ? e.message : String(e));
                  setStep(null);
                });
              }}
            >
              Add sample mail
            </Button>
          )
        }
      >
        A workflow files mail here as it arrives: one document per message,
        its attachments stored beside it. Until one runs, try it with a
        morning's worth of mail for Juniper Studio
        {hasStore ? "." : " (files need a switchboard behind the drive)."}
      </EmptyState>
      {busy && (
        <div
          className="sk-stack sk-stack--2"
          style={{ width: 320, margin: "0 auto" }}
        >
          <Progress value={step === "Done" ? 100 : 50} />
          <span className="sk-caption">{step}…</span>
        </div>
      )}
      {error && <p className="sk-text-danger sk-small">{error}</p>}
    </div>
  );
}

/** Whether the workspace is narrower than `px` (side by side, but cramped). */
function useNarrow(
  ref: React.RefObject<HTMLDivElement | null>,
  px: number,
  mounted: boolean,
): boolean {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const width = entry.contentRect.width;
      // Zero means hidden (a suspended subtree, a background tab), not narrow.
      if (width > 0) setNarrow(width < px);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref, px, mounted]);
  return narrow;
}

/**
 * The workspace fills the viewport below whatever sits above it. Connect's
 * wrapper grows with its content, so `height: 100%` would be circular; the
 * offset is measured instead and re-measured on resize.
 */
function useFillHeight(
  ref: React.RefObject<HTMLDivElement | null>,
  mounted: boolean,
): number {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    const measure = () => {
      if (!ref.current) return;
      const top = ref.current.getBoundingClientRect().top;
      const next = Math.max(360, Math.round(window.innerHeight - top));
      setHeight((prev) => (Math.abs(prev - next) > 1 ? next : prev));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [ref, mounted]);
  return height;
}
