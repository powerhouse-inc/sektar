/**
 * Gmail messages to email actions — the adapter between the Gmail piece's
 * Search Email step and the Upsert Documents step.
 *
 * Its own step rather than props bolted onto the upsert, for the same reason
 * Map Records is its own step: testing it shows the exact actions each
 * message will produce before any document is written. It reaches nothing;
 * it is arithmetic on the previous step's output.
 *
 * The mapping is the one in docs/specs/email.md. Search Email fetches each
 * message raw and parses it with mailparser, so a message is `{ id, ...parsed,
 * attachments }`: mailboxes sit under `from.value`, the date is `date`,
 * headers are only usable as `headerLines`, and each attachment's `data` is
 * the attachment ref the host minted when the step returned.
 */
import { createAction, Property } from "@powerhousedao/pieces-framework";
import { asList } from "./upsert.js";

export const EMAIL_TYPE = "sektar/email";

export interface Mailbox {
  address: string;
  name: string | null;
}

export interface EmailAction {
  type: string;
  input: unknown;
}

/** One message as the upsert step wants it: a key, a name, and the actions. */
export interface EmailItem {
  key: string;
  name: string;
  /** The mailbox, and the folder it is filed under: its name, else its address. */
  account: { address: string; name: string | null; provider: string };
  folder: string;
  subject: string | null;
  from: Mailbox[];
  sentAt: string | null;
  attachmentCount: number;
  /** Sent after the document is created: account, message, attachments. */
  actions: EmailAction[];
  /** Sent to a document that already holds the message: no attachments, since re-adding one is refused. */
  updateActions: EmailAction[];
}

export interface GmailMapOptions {
  account: { address: string; name?: string | null; provider?: string | null };
  labels?: string[];
  source?: string;
  includeHtml?: boolean;
  includeHeaders?: boolean;
  capturedAt: string;
}

export interface GmailMapResult {
  items: EmailItem[];
  skipped: { index: number; reason: string }[];
  count: number;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

/**
 * mailparser's address objects: `{ value: [{ address, name }] }`, or a list of
 * them when a header repeats. A bare `{ address }` list is accepted too.
 */
export function mailboxesOf(value: unknown): Mailbox[] {
  const out: Mailbox[] = [];
  const push = (entry: unknown) => {
    const box = record(entry);
    const address = box ? text(box.address) : null;
    if (address) out.push({ address: address.trim(), name: text(box?.name) });
  };
  const walk = (node: unknown) => {
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    const obj = record(node);
    if (!obj) return;
    if (Array.isArray(obj.value)) obj.value.forEach(push);
    else push(obj);
  };
  walk(value);
  return out;
}

/** `headerLines` is `{ key, line }` with the raw line; the value follows the first ": ". */
export function headersOf(value: unknown): { key: string; value: string }[] {
  if (!Array.isArray(value)) return [];
  const out: { key: string; value: string }[] = [];
  for (const entry of value) {
    const line = record(entry);
    const key = line ? text(line.key) : null;
    const raw = line ? text(line.line) : null;
    if (!key || !raw) continue;
    const colon = raw.indexOf(":");
    out.push({
      key,
      value: colon === -1 ? raw.trim() : raw.slice(colon + 1).trim(),
    });
  }
  return out;
}

/** `references` is one string of ids, or already a list. */
export function referencesOf(value: unknown): string[] {
  if (typeof value === "string") {
    return value.split(/\s+/).filter((id) => id !== "");
  }
  if (Array.isArray(value)) {
    return value.flatMap((entry) => referencesOf(entry));
  }
  return [];
}

/** A date as ISO text, from the string or number JSON made of it. */
export function isoOf(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

interface GmailAttachment {
  fileName: string;
  mimeType: string | null;
  sizeBytes: number | null;
  ref: string;
}

/** The attachments the host turned into refs; one that failed to stage is null and dropped. */
export function attachmentsOf(value: unknown): GmailAttachment[] {
  if (!Array.isArray(value)) return [];
  const out: GmailAttachment[] = [];
  for (const entry of value) {
    const file = record(entry);
    if (!file) continue;
    const ref = text(file.data);
    if (!ref) continue;
    out.push({
      fileName: text(file.fileName) ?? "attachment",
      mimeType: text(file.mimeType),
      sizeBytes: typeof file.size === "number" ? file.size : null,
      ref,
    });
  }
  return out;
}

/** The document's name: the subject, else who it came from. */
export function emailName(subject: string | null, from: Mailbox[]): string {
  const trimmed = subject?.trim();
  if (trimmed) return trimmed.slice(0, 120);
  if (from.length === 0) return "(no subject)";
  const sender = from[0];
  return `(no subject) from ${sender.name ?? sender.address}`;
}

export function mapGmailMessages(
  messages: unknown,
  options: GmailMapOptions,
): GmailMapResult {
  const items: EmailItem[] = [];
  const skipped: { index: number; reason: string }[] = [];
  const labels = [
    ...new Set((options.labels ?? []).map((l) => l.trim()).filter(Boolean)),
  ];
  const account = {
    address: options.account.address,
    name: options.account.name ?? null,
    provider: options.account.provider ?? "gmail",
  };
  const setAccount: EmailAction = { type: "SET_ACCOUNT", input: account };
  // One folder per mailbox, named as the Mail workspace names it.
  const folder = account.name?.trim() || account.address;

  asList(messages).forEach((entry, index) => {
    const message = record(entry);
    const id = message ? text(message.id) : null;
    if (!message || !id) {
      skipped.push({ index, reason: "no Gmail id" });
      return;
    }
    if (text(message.error)) {
      // The piece reports a message it could not fetch as { id, error }.
      skipped.push({ index, reason: `Gmail: ${String(message.error)}` });
      return;
    }
    const subject = text(message.subject);
    const from = mailboxesOf(message.from);
    const sentAt = isoOf(message.date);
    const attachments = attachmentsOf(message.attachments);
    const capture: EmailAction = {
      type: "CAPTURE_MESSAGE",
      input: {
        externalId: `gmail:${id.trim()}`,
        messageId: text(message.messageId),
        threadId: text(message.threadId),
        inReplyTo: text(message.inReplyTo),
        references: referencesOf(message.references),
        subject,
        from,
        to: mailboxesOf(message.to),
        cc: mailboxesOf(message.cc),
        bcc: mailboxesOf(message.bcc),
        replyTo: mailboxesOf(message.replyTo),
        sentAt,
        receivedAt: null,
        text: text(message.text),
        html: options.includeHtml === false ? null : text(message.html),
        headers:
          options.includeHeaders === false
            ? []
            : headersOf(message.headerLines),
        labels,
        source: options.source ?? "gmail",
        capturedAt: options.capturedAt,
      },
    };
    const addAttachments: EmailAction[] = attachments.map((file) => ({
      type: "ADD_ATTACHMENT",
      input: {
        id: crypto.randomUUID(),
        ref: file.ref,
        fileName: file.fileName,
        mimeType: file.mimeType,
        sizeBytes: file.sizeBytes,
        contentId: null,
        inline: false,
      },
    }));
    items.push({
      key: `gmail:${id.trim()}`,
      name: emailName(subject, from),
      account,
      folder,
      subject,
      from,
      sentAt,
      attachmentCount: attachments.length,
      actions: [setAccount, capture, ...addAttachments],
      updateActions: [setAccount, capture],
    });
  });

  return { items, skipped, count: items.length };
}

function csv(value: unknown): string[] {
  if (typeof value !== "string") return [];
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry !== "");
}

export const distyraGmailToEmailAction = createAction({
  // Saved workflows refer to the action by name: don't rename it once published
  name: "gmail-to-email",
  // Reaches nothing: this step is arithmetic on the previous step's output.
  requireAuth: false,
  displayName: "Gmail Messages to Email",
  description:
    `Turn the Gmail Search Email step's messages into items for Upsert Documents: one per message, keyed gmail:<id>, with the SET_ACCOUNT, CAPTURE_MESSAGE and ADD_ATTACHMENT actions a ${EMAIL_TYPE} document takes. In the upsert, set Items to this step's items, Item key to key, Document key to externalId, Document name to $item.name, Folder by name to $item.folder, Actions on create to $item.actions and Actions on update to $item.updateActions.`,
  props: {
    messages: Property.Json({
      displayName: "Messages",
      description:
        "The Gmail search result's messages, e.g. {{steps.search_email.output.results.messages}}.",
      required: true,
    }),
    accountAddress: Property.ShortText({
      displayName: "Mailbox address",
      description:
        "The mailbox the messages came from. Gmail's output does not say, so it is set here.",
      required: true,
    }),
    accountName: Property.ShortText({
      displayName: "Mailbox name",
      required: false,
    }),
    labels: Property.ShortText({
      displayName: "Labels",
      description:
        "Comma-separated labels to stamp on every message, e.g. the label the search was run with.",
      required: false,
    }),
    includeHtml: Property.Checkbox({
      displayName: "Keep the HTML body",
      description:
        "On by default. Off keeps only the text body, which makes a message a fraction of the size.",
      required: false,
      defaultValue: true,
    }),
    includeHeaders: Property.Checkbox({
      displayName: "Keep the headers",
      description: "On by default.",
      required: false,
      defaultValue: true,
    }),
  },
  run(context) {
    const p = context.propsValue;
    return Promise.resolve(
      mapGmailMessages(p.messages, {
        account: {
          address: p.accountAddress.trim(),
          name:
            typeof p.accountName === "string" && p.accountName.trim() !== ""
              ? p.accountName.trim()
              : null,
          provider: "gmail",
        },
        labels: csv(p.labels),
        source: "gmail",
        includeHtml: p.includeHtml !== false,
        includeHeaders: p.includeHeaders !== false,
        capturedAt: new Date().toISOString(),
      }),
    );
  },
});
