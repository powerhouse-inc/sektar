// Reading and writing captured emails. Reads are hooks over whatever drive
// the Mail workspace is showing; writes are imperative helpers around
// addDocument/dispatchActions, shaped so a Gmail search result maps onto
// them field by field (see docs/specs/email.md).
import {
  addDocument,
  addFolder,
  dispatchActions,
  useDocumentsByIds,
  type useAttachments,
} from "@powerhousedao/reactor-browser";
import type { DocumentDriveDocument } from "@powerhousedao/shared/document-drive";
import { generateId } from "document-model";
import {
  actions as emailActions,
  isEmailDocument,
  type EmailAttachment,
  type EmailDocument,
  type Mailbox,
} from "document-models/email";
import { useDeferredValue, useMemo } from "react";
import { fileIds, folderNode } from "./data.js";

export const EMAIL_TYPE = "sektar/email";

/** The attachment client Connect hands out when a switchboard backs the drive. */
export type AttachmentClient = NonNullable<ReturnType<typeof useAttachments>>;

/* -------------------------------------------------------------- reading */

/**
 * Every captured email in the drive, newest first.
 *
 * The id list is read through a deferred value: `useDocumentsByIds` ends in
 * `use(promise)`, and a new id makes that promise new and unresolved, so the
 * component suspends. Suspending on a deferred value keeps the previous
 * render on screen while the new one resolves; suspending on the live value
 * made React hide the whole view and show the shell's skeleton for every
 * message a backfill filed.
 *
 * A document that exists but has not been captured yet (created, capture
 * still on its way) is left out: it has no sender, no subject and no
 * mailbox, and would surface as an "unknown" inbox for a moment.
 */
export function useEmails(
  drive: DocumentDriveDocument | undefined,
): EmailDocument[] {
  const key = fileIds(drive, EMAIL_TYPE).join(",");
  const ids = useMemo(() => (key ? key.split(",") : []), [key]);
  const settledIds = useDeferredValue(ids);
  const docs = useDocumentsByIds(settledIds);
  return useMemo(
    () =>
      docs
        .filter(isEmailDocument)
        .filter((d) => Boolean(d.state.global.externalId))
        .sort((a, b) => whenOf(b).localeCompare(whenOf(a))),
    [docs],
  );
}

/** The instant a message is listed by: sent, else received, else captured. */
export function whenOf(doc: EmailDocument): string {
  const s = doc.state.global;
  return s.sentAt ?? s.receivedAt ?? s.capturedAt ?? doc.header.createdAtUtcIso;
}

export type MailAccountSummary = {
  address: string;
  name: string;
  provider: string | null;
  total: number;
  unread: number;
};

/** The mailboxes the drive holds mail for, with their counts. */
export function accountsOf(emails: EmailDocument[]): MailAccountSummary[] {
  const map = new Map<string, MailAccountSummary>();
  for (const doc of emails) {
    const a = doc.state.global.account;
    const address = a.address ?? "unknown";
    const cur = map.get(address) ?? {
      address,
      name: a.name ?? address,
      provider: a.provider ?? null,
      total: 0,
      unread: 0,
    };
    cur.total += 1;
    if (!doc.state.global.read && doc.state.global.status === "INBOX")
      cur.unread += 1;
    map.set(address, cur);
  }
  return [...map.values()].sort((x, y) => x.name.localeCompare(y.name));
}

export function mailboxLabel(m: Mailbox): string {
  return m.name?.trim() || m.address;
}

/** A time for a list: the hour today, the day this year, the date otherwise. */
export function fmtWhen(iso: string | null | undefined, now = new Date()): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) {
    return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  }
  if (d.getFullYear() === now.getFullYear()) {
    return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
  }
  return d.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function bytes(size: number | null | undefined): string {
  if (size === null || size === undefined) return "";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export type AttachmentKind = "image" | "pdf" | "sheet" | "document" | "other";

/** What a file is, for the tile and the preview. The store's own mime type wins over the one the sender claimed. */
export function attachmentKind(
  file: Pick<EmailAttachment, "fileName" | "mimeType">,
  actualMime?: string,
): AttachmentKind {
  const mime = (actualMime ?? file.mimeType ?? "").toLowerCase();
  const name = file.fileName.toLowerCase();
  if (mime.startsWith("image/") || /\.(png|jpe?g|gif|webp|svg)$/.test(name))
    return "image";
  if (mime === "application/pdf" || name.endsWith(".pdf")) return "pdf";
  if (/sheet|excel|csv/.test(mime) || /\.(xlsx?|csv)$/.test(name))
    return "sheet";
  if (/word|document|text\/plain/.test(mime) || /\.(docx?|txt|md)$/.test(name))
    return "document";
  return "other";
}

/** Free-text match over the fields a person scans a mailbox by. */
export function matchesMail(query: string, doc: EmailDocument): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const s = doc.state.global;
  const hay = [
    s.subject,
    s.snippet,
    ...s.from.map((m) => `${m.name ?? ""} ${m.address}`),
    ...s.to.map((m) => `${m.name ?? ""} ${m.address}`),
    ...s.labels,
    ...s.attachments.map((a) => a.fileName),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return q.split(/\s+/).every((word) => hay.includes(word));
}

/* -------------------------------------------------------------- writing */

export type NewMailbox = { address: string; name?: string | null };

export type NewAttachment = {
  ref: EmailAttachment["ref"];
  fileName: string;
  mimeType?: string | null;
  sizeBytes?: number | null;
  contentId?: string | null;
  inline?: boolean | null;
};

/** A message to file, in the Gmail step's vocabulary. */
export type NewEmail = {
  account: { address: string; name?: string | null; provider?: string | null };
  externalId: string;
  messageId?: string | null;
  threadId?: string | null;
  inReplyTo?: string | null;
  references?: string[];
  subject?: string | null;
  from: NewMailbox[];
  to?: NewMailbox[];
  cc?: NewMailbox[];
  bcc?: NewMailbox[];
  replyTo?: NewMailbox[];
  sentAt?: string | null;
  receivedAt?: string | null;
  text?: string | null;
  html?: string | null;
  headers?: { key: string; value: string }[];
  labels?: string[];
  source?: string | null;
  capturedAt?: string;
  attachments?: NewAttachment[];
  read?: boolean;
  flagged?: boolean;
};

const createdFolders = new Map<string, string>();

/** One folder per mailbox at the root, created once per session. */
async function ensureAccountFolder(
  drive: DocumentDriveDocument,
  account: NewEmail["account"],
): Promise<string> {
  const name = account.name?.trim() || account.address;
  const key = `${drive.header.id}:${name}`;
  const cached = createdFolders.get(key);
  if (cached) return cached;
  const existing = folderNode(drive, name);
  if (existing) {
    createdFolders.set(key, existing.id);
    return existing.id;
  }
  const created = await addFolder(drive.header.id, name);
  createdFolders.set(key, created.id);
  return created.id;
}

export function emailDocumentName(input: Pick<NewEmail, "subject" | "from">): string {
  const subject = input.subject?.trim();
  if (subject) return subject.slice(0, 120);
  const sender = input.from[0];
  return sender ? `(no subject) from ${sender.name ?? sender.address}` : "(no subject)";
}

/** File a message: one document in the mailbox's folder, captured in one batch. */
export async function captureEmail(
  drive: DocumentDriveDocument,
  input: NewEmail,
): Promise<string> {
  const folder = await ensureAccountFolder(drive, input.account);
  const node = await addDocument(
    drive.header.id,
    emailDocumentName(input),
    EMAIL_TYPE,
    folder,
  );
  await dispatchActions(
    [
      emailActions.setAccount({
        address: input.account.address,
        name: input.account.name ?? null,
        provider: input.account.provider ?? null,
      }),
      emailActions.captureMessage({
        externalId: input.externalId,
        messageId: input.messageId ?? null,
        threadId: input.threadId ?? null,
        inReplyTo: input.inReplyTo ?? null,
        references: input.references ?? [],
        subject: input.subject ?? null,
        from: input.from,
        to: input.to ?? [],
        cc: input.cc ?? [],
        bcc: input.bcc ?? [],
        replyTo: input.replyTo ?? [],
        sentAt: input.sentAt ?? null,
        receivedAt: input.receivedAt ?? null,
        text: input.text ?? null,
        html: input.html ?? null,
        headers: input.headers ?? [],
        labels: input.labels ?? [],
        source: input.source ?? null,
        capturedAt: input.capturedAt ?? new Date().toISOString(),
      }),
      ...(input.attachments ?? []).map((a) =>
        emailActions.addAttachment({
          id: generateId(),
          ref: a.ref,
          fileName: a.fileName,
          mimeType: a.mimeType ?? null,
          sizeBytes: a.sizeBytes ?? null,
          contentId: a.contentId ?? null,
          inline: a.inline ?? false,
        }),
      ),
      ...(input.read ? [emailActions.markRead({})] : []),
      ...(input.flagged ? [emailActions.setFlagged({ flagged: true })] : []),
    ],
    node.id,
  );
  return node.id;
}

/**
 * Store a file beside a message: hash it, reference it on the document, then
 * send the bytes. The order matters — the store only accepts bytes for a ref
 * a document already carries.
 */
export async function attachFile(
  client: AttachmentClient,
  emailId: string,
  file: Blob,
  meta: { fileName: string; mimeType?: string; contentId?: string; inline?: boolean },
): Promise<EmailAttachment["ref"]> {
  const pre = await client.preprocess(file, {
    fileName: meta.fileName,
    mimeType: meta.mimeType,
  });
  await dispatchActions(
    emailActions.addAttachment({
      id: generateId(),
      ref: pre.ref,
      fileName: meta.fileName,
      mimeType: meta.mimeType ?? null,
      sizeBytes: pre.sizeBytes,
      contentId: meta.contentId ?? null,
      inline: meta.inline ?? false,
    }),
    emailId,
  );
  await client.upload({ preprocessed: pre });
  return pre.ref;
}

/** Triage, one operation each. */
export const mail = {
  markRead: (id: string) => dispatchActions(emailActions.markRead({}), id),
  markUnread: (id: string) => dispatchActions(emailActions.markUnread({}), id),
  setFlagged: (id: string, flagged: boolean) =>
    dispatchActions(emailActions.setFlagged({ flagged }), id),
  archive: (id: string) => dispatchActions(emailActions.archive({}), id),
  unarchive: (id: string) => dispatchActions(emailActions.unarchive({}), id),
  addLabels: (id: string, labels: string[]) =>
    dispatchActions(emailActions.addLabels({ labels }), id),
  removeLabels: (id: string, labels: string[]) =>
    dispatchActions(emailActions.removeLabels({ labels }), id),
  setNotes: (id: string, notes: string | null) =>
    dispatchActions(emailActions.setNotes({ notes }), id),
};

/* --------------------------------------------------------------- sample */

const STUDIO = {
  address: "jane@juniper.studio",
  name: "Juniper Studio",
  provider: "gmail",
};
const PERSONAL = {
  address: "jane.doe@gmail.com",
  name: "Personal",
  provider: "gmail",
};

function ago(hours: number, now = Date.now()): string {
  return new Date(now - hours * 3_600_000).toISOString();
}

/** A one-page PDF that says what it is, for the preview pane. */
function samplePdf(title: string): Blob {
  const text = `BT /F1 18 Tf 72 720 Td (${title}) Tj ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${text.length} >>\nstream\n${text}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const o of offsets) out += `${String(o).padStart(10, "0")} 00000 n \n`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new Blob([out], { type: "application/pdf" });
}

function sampleSvg(label: string): Blob {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 200"><rect width="320" height="200" rx="16" fill="#BFD7BD"/><path d="M40 160 Q 90 40 160 100 T 280 60" fill="none" stroke="#1F3A2E" stroke-width="10" stroke-linecap="round"/><text x="24" y="40" font-family="sans-serif" font-size="18" fill="#1F3A2E">${label}</text></svg>`;
  return new Blob([svg], { type: "image/svg+xml" });
}

function sampleIcs(summary: string, start: string): Blob {
  const stamp = start.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Sektar//Sample//EN",
    "BEGIN:VEVENT",
    `UID:${stamp}@juniper.studio`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${stamp}`,
    `SUMMARY:${summary}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  return new Blob([ics], { type: "text/calendar" });
}

type SampleFile = {
  blob: Blob;
  fileName: string;
  mimeType: string;
};

type SampleEmail = NewEmail & { files?: SampleFile[] };

function sampleMail(now = Date.now()): SampleEmail[] {
  const h = (n: number) => ago(n, now);
  return [
    {
      account: STUDIO,
      externalId: "sample:brand-refresh-round-2",
      messageId: "<brand-refresh-2@brightmedia.co.uk>",
      threadId: "brand-refresh",
      inReplyTo: "<brand-refresh-1@juniper.studio>",
      references: ["<brand-refresh-1@juniper.studio>"],
      subject: "Re: Brand refresh — round 2 feedback",
      from: [{ address: "priya@brightmedia.co.uk", name: "Priya Shah" }],
      to: [{ address: STUDIO.address, name: "Jane Doe" }],
      cc: [{ address: "accounts@brightmedia.co.uk", name: "Bright Media accounts" }],
      sentAt: h(1.5),
      receivedAt: h(1.5),
      text:
        "Hi Jane,\n\nThanks for the second round. The team is aligned on direction B — the sage palette reads calmer on the product pages and the wordmark finally sits well at small sizes.\n\nTwo things before we sign off:\n1. Can the icon set lose the outlines? Filled shapes only, like the dashboard mock.\n2. We need the deck in our template by Thursday for the board.\n\nAttached is the marked-up board of what we meant.\n\nBest,\nPriya",
      html: "<p>Hi Jane,</p><p>Thanks for the second round. The team is aligned on <strong>direction B</strong> — the sage palette reads calmer on the product pages and the wordmark finally sits well at small sizes.</p><p>Two things before we sign off:</p><ol><li>Can the icon set lose the outlines? Filled shapes only, like the dashboard mock.</li><li>We need the deck in our template by Thursday for the board.</li></ol><p>Attached is the marked-up board of what we meant.</p><p>Best,<br>Priya</p>",
      headers: [
        { key: "message-id", value: "<brand-refresh-2@brightmedia.co.uk>" },
        { key: "content-type", value: "multipart/mixed" },
      ],
      labels: ["INBOX", "client", "bright-media"],
      source: "sample",
      files: [
        { blob: sampleSvg("Direction B — marked up"), fileName: "direction-b-markup.svg", mimeType: "image/svg+xml" },
      ],
    },
    {
      account: STUDIO,
      externalId: "sample:acme-inv-0041",
      messageId: "<inv-0041@acme-client.nl>",
      subject: "Your invoice INV-2026-0041 has been received",
      from: [{ address: "finance@acme-client.nl", name: "Acme Client BV" }],
      to: [{ address: STUDIO.address }],
      sentAt: h(5),
      receivedAt: h(5),
      text:
        "Dear Juniper Studio,\n\nWe confirm receipt of invoice INV-2026-0041 for EUR 8,470.00. It has been scheduled for payment on the next run, within the agreed 30 days.\n\nRemittance advice attached.\n\nAcme Client BV — Finance",
      labels: ["INBOX", "invoice"],
      source: "sample",
      files: [
        { blob: samplePdf("Remittance advice INV-2026-0041"), fileName: "remittance-INV-2026-0041.pdf", mimeType: "application/pdf" },
      ],
    },
    {
      account: STUDIO,
      externalId: "sample:q4-planning-accept",
      messageId: "<calendar-q4@google.com>",
      subject: "Accepted: Q4 planning @ Thu 14:00 – 15:30 (Nadia Haddad)",
      from: [{ address: "nadia@juniper.studio", name: "Nadia Haddad" }],
      to: [{ address: STUDIO.address, name: "Jane Doe" }],
      replyTo: [{ address: "nadia@juniper.studio", name: "Nadia Haddad" }],
      sentAt: h(9),
      receivedAt: h(9),
      text: "Nadia Haddad has accepted this invitation.\n\nQ4 planning\nThursday 14:00 – 15:30\nCentral European Time - Amsterdam\n\nJoin with Google Meet",
      headers: [{ key: "auto-submitted", value: "auto-replied" }],
      labels: ["INBOX", "calendar"],
      source: "sample",
      read: true,
      files: [
        { blob: sampleIcs("Q4 planning", h(-60)), fileName: "invite.ics", mimeType: "text/calendar" },
      ],
    },
    {
      account: STUDIO,
      externalId: "sample:hetzner-r0012845921",
      messageId: "<R0012845921@hetzner.com>",
      subject: "Your Hetzner invoice R0012845921",
      from: [{ address: "accounting@hetzner.com", name: "Hetzner Online" }],
      to: [{ address: STUDIO.address }],
      sentAt: h(30),
      receivedAt: h(30),
      text: "Your invoice for October is attached. The amount of EUR 46.41 will be debited from your account within the next days.\n\nHetzner Online GmbH",
      labels: ["INBOX", "invoice", "hosting"],
      source: "sample",
      flagged: true,
      files: [
        { blob: samplePdf("Hetzner invoice R0012845921"), fileName: "R0012845921.pdf", mimeType: "application/pdf" },
      ],
    },
    {
      account: STUDIO,
      externalId: "sample:standup-notes",
      messageId: "<standup-19@juniper.studio>",
      subject: "Standup notes — Monday",
      from: [{ address: "tom@juniper.studio", name: "Tom Bakker" }],
      to: [{ address: "team@juniper.studio", name: "Team" }],
      sentAt: h(50),
      receivedAt: h(50),
      text: "Done: Bright Media round 2 shipped.\nNext: Acme onboarding flow, icon set cleanup.\nBlocked: waiting on the KvK extract for the bank.",
      labels: ["INBOX", "team"],
      source: "sample",
      read: true,
    },
    {
      account: STUDIO,
      externalId: "sample:wework-october",
      messageId: "<oct-membership@wework.com>",
      subject: "Your October membership statement",
      from: [{ address: "billing@wework.com", name: "WeWork" }],
      to: [{ address: STUDIO.address }],
      sentAt: h(200),
      receivedAt: h(200),
      text: "Your statement for Weesperstraat 61 is ready. Total: EUR 2,400.00, collected by direct debit on the 1st.",
      labels: ["rent"],
      source: "sample",
      read: true,
    },
    {
      account: PERSONAL,
      externalId: "sample:notion-digest",
      messageId: "<digest@notion.so>",
      subject: "Your weekly digest",
      from: [{ address: "team@notion.so", name: "Notion" }],
      to: [{ address: PERSONAL.address }],
      sentAt: h(26),
      receivedAt: h(26),
      text: "Top pages this week: Studio handbook, Q4 planning, Brand refresh. 14 edits by 3 people.",
      html: "<h2>Your weekly digest</h2><p>Top pages this week: <b>Studio handbook</b>, <b>Q4 planning</b>, <b>Brand refresh</b>.</p><p>14 edits by 3 people.</p>",
      labels: ["INBOX", "newsletters"],
      source: "sample",
      read: true,
    },
    {
      account: PERSONAL,
      externalId: "sample:stripe-receipt",
      messageId: "<receipt-4421@stripe.com>",
      subject: "Your receipt from Figma #4421-0098",
      from: [{ address: "receipts@stripe.com", name: "Stripe" }],
      to: [{ address: PERSONAL.address, name: "Jane Doe" }],
      sentAt: h(3),
      receivedAt: h(3),
      text: "Receipt from Figma. Amount paid: EUR 15.00. Figma Professional, monthly.",
      labels: ["INBOX", "receipts"],
      source: "sample",
      flagged: true,
    },
  ];
}

/**
 * Fill an empty mail drive with a morning's worth of mail for Juniper Studio.
 * Files are stored through the attachment client when the drive has one; a
 * browser-only drive gets the messages without their files.
 */
export async function seedSampleMail(
  drive: DocumentDriveDocument,
  attachments: AttachmentClient | undefined,
  onStep?: (step: string) => void,
): Promise<void> {
  const samples = sampleMail();
  for (const [i, sample] of samples.entries()) {
    onStep?.(`Filing ${i + 1} of ${samples.length}`);
    const { files, ...input } = sample;
    const id = await captureEmail(drive, input);
    if (attachments && files) {
      for (const f of files) {
        await attachFile(attachments, id, f.blob, {
          fileName: f.fileName,
          mimeType: f.mimeType,
        });
      }
    }
  }
  onStep?.("Done");
}
