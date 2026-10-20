// Turns an email document into its index row. Pure, shared by the processor
// (which runs in the switchboard and in a tab's in-process reactor) and by
// its tests. An operation that carries the resulting state gives the exact
// row; one that does not is applied to the row the way the reducer applies
// it to the document, field by field, so the two paths agree.
import type { EmailRow } from "./schema.js";

type Json = Record<string, unknown>;

interface Mailbox {
  address: string;
  name: string | null;
}

interface Attachment {
  id: string;
  ref: string;
  name: string;
}

const str = (v: unknown): string | null =>
  typeof v === "string" && v.trim() ? v.trim() : null;

const bool = (v: unknown, fallback: boolean): boolean =>
  typeof v === "boolean" ? v : fallback;

function mailboxes(v: unknown): Mailbox[] {
  if (!Array.isArray(v)) return [];
  const out: Mailbox[] = [];
  for (const m of v) {
    if (!m || typeof m !== "object") continue;
    const address = str((m as Json).address);
    if (!address) continue;
    out.push({ address, name: str((m as Json).name) });
  }
  return out;
}

function strings(v: unknown): string[] {
  return Array.isArray(v)
    ? v.filter((s): s is string => typeof s === "string" && s.trim() !== "").map((s) => s.trim())
    : [];
}

function parseJson<T>(text: string, fallback: T): T {
  try {
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}

/** A row for a document nothing has been applied to yet. */
export function emptyRow(documentId: string, at: string): EmailRow {
  return {
    document_id: documentId,
    captured: false,
    account_address: null,
    account_name: null,
    account_provider: null,
    subject: null,
    from_name: null,
    from_address: null,
    snippet: null,
    when_at: at,
    sent_at: null,
    received_at: null,
    read: false,
    flagged: false,
    status: "INBOX",
    attachments: "[]",
    attachment_count: 0,
    labels: "[]",
    thread_id: null,
    participants: "",
    search_text: "",
    updated_at: at,
  };
}

/**
 * The derived columns, recomputed from the stored ones. `capturedAt` is the
 * document's own fallback for the listing instant; the operation's own time
 * (`at`) stands in only for a document captured without any date at all.
 */
function finish(
  row: EmailRow,
  extra: { capturedAt?: string | null; at: string },
): EmailRow {
  const files = parseJson<Attachment[]>(row.attachments, []);
  const refs = new Set(files.map((f) => f.ref));
  const labels = parseJson<string[]>(row.labels, []);
  const sender = [row.from_name, row.from_address].filter(Boolean).join(" ");
  return {
    ...row,
    when_at:
      row.sent_at ?? row.received_at ?? extra.capturedAt ?? row.when_at,
    attachment_count: refs.size,
    search_text: [
      row.subject,
      row.snippet,
      sender,
      row.participants,
      labels.join(" "),
      files.map((f) => f.name).join(" "),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase(),
    updated_at: extra.at,
  };
}

/** The row for a whole document from its global state. */
export function rowFromState(
  documentId: string,
  state: Json,
  at: string,
): EmailRow {
  const account = (state.account ?? {}) as Json;
  const sender = mailboxes(state.from).at(0);
  const others = [...mailboxes(state.to), ...mailboxes(state.cc)];
  const files: Attachment[] = Array.isArray(state.attachments)
    ? (state.attachments as Json[])
        .map((a) => ({
          id: str(a.id) ?? "",
          ref: str(a.ref) ?? "",
          name: str(a.fileName) ?? "",
        }))
        .filter((a) => a.id && a.ref)
    : [];
  const row: EmailRow = {
    ...emptyRow(documentId, at),
    captured: Boolean(str(state.externalId)),
    account_address: str(account.address),
    account_name: str(account.name),
    account_provider: str(account.provider),
    subject: str(state.subject),
    from_name: sender?.name ?? null,
    from_address: sender?.address ?? null,
    snippet: str(state.snippet),
    sent_at: str(state.sentAt),
    received_at: str(state.receivedAt),
    read: bool(state.read, false),
    flagged: bool(state.flagged, false),
    status: str(state.status) ?? "INBOX",
    attachments: JSON.stringify(files),
    labels: JSON.stringify(strings(state.labels)),
    thread_id: str(state.threadId),
    participants: others.map((m) => `${m.name ?? ""} ${m.address}`.trim()).join(" "),
  };
  return finish(row, { capturedAt: str(state.capturedAt), at });
}

/**
 * One operation applied to a row, as the reducer applies it to the document.
 * Unknown actions (SET_NOTES, say) leave the row as it is apart from its
 * update time.
 */
export function applyAction(
  row: EmailRow,
  type: string,
  input: unknown,
  at: string,
): EmailRow {
  const i = (input && typeof input === "object" ? input : {}) as Json;
  let next: EmailRow = { ...row };
  let capturedAt: string | null | undefined;
  switch (type) {
    case "SET_ACCOUNT": {
      if (i.address !== undefined) next.account_address = str(i.address);
      if (i.name !== undefined) next.account_name = str(i.name);
      if (i.provider !== undefined) next.account_provider = str(i.provider);
      break;
    }
    case "CAPTURE_MESSAGE": {
      const externalId = str(i.externalId);
      // The reducer refuses an id that is not namespaced; so does the index.
      if (!externalId || !/^[a-z0-9_-]+:.+/i.test(externalId)) return next;
      const sender = mailboxes(i.from).at(0);
      const others = [...mailboxes(i.to), ...mailboxes(i.cc)];
      const text = str(i.text);
      next = {
        ...next,
        captured: true,
        subject: str(i.subject),
        from_name: sender?.name ?? null,
        from_address: sender?.address ?? null,
        snippet: text ? text.replace(/\s+/g, " ").trim().slice(0, 160) : null,
        sent_at: str(i.sentAt),
        received_at: str(i.receivedAt),
        labels: JSON.stringify([...new Set(strings(i.labels))]),
        thread_id: str(i.threadId),
        participants: others.map((m) => `${m.name ?? ""} ${m.address}`.trim()).join(" "),
      };
      capturedAt = str(i.capturedAt);
      break;
    }
    case "ADD_ATTACHMENT": {
      const id = str(i.id);
      const ref = str(i.ref);
      const name = str(i.fileName) ?? "";
      if (!id || !ref) break;
      const files = parseJson<Attachment[]>(next.attachments, []);
      // The reducer rejects a duplicate id, and a duplicate ref+name.
      if (files.some((f) => f.id === id || (f.ref === ref && f.name === name))) break;
      next.attachments = JSON.stringify([...files, { id, ref, name }]);
      break;
    }
    case "REMOVE_ATTACHMENT": {
      const id = str(i.id);
      const files = parseJson<Attachment[]>(next.attachments, []);
      next.attachments = JSON.stringify(files.filter((f) => f.id !== id));
      break;
    }
    case "MARK_READ":
      next.read = true;
      break;
    case "MARK_UNREAD":
      next.read = false;
      break;
    case "SET_FLAGGED":
      next.flagged = bool(i.flagged, next.flagged);
      break;
    case "ARCHIVE":
      next.status = "ARCHIVED";
      break;
    case "UNARCHIVE":
      next.status = "INBOX";
      break;
    case "ADD_LABELS": {
      const labels = parseJson<string[]>(next.labels, []);
      next.labels = JSON.stringify([...new Set([...labels, ...strings(i.labels)])]);
      break;
    }
    case "REMOVE_LABELS": {
      const drop = new Set(strings(i.labels));
      const labels = parseJson<string[]>(next.labels, []);
      next.labels = JSON.stringify(labels.filter((l) => !drop.has(l)));
      break;
    }
    default:
      break;
  }
  return finish(next, { capturedAt, at });
}

/** The scope's state out of an operation's `resultingState`, if it carries one. */
export function parseState(json: string | undefined): Json | null {
  if (!json) return null;
  try {
    const parsed = JSON.parse(json) as unknown;
    if (parsed && typeof parsed === "object") {
      // resultingState is the scope's state; some transports wrap it per scope.
      const obj = parsed as Json;
      return obj.global && typeof obj.global === "object"
        ? (obj.global as Json)
        : obj;
    }
  } catch {
    // not JSON: fall back to the action path
  }
  return null;
}
