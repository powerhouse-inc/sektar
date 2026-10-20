/**
 * The mailbox index: one lean row per email document.
 *
 * A mailbox is listed, filtered, counted and searched far more often than any
 * one message is read, and a list of tens of thousands of messages cannot be
 * built by loading tens of thousands of documents — each one carries its
 * bodies and headers, a hundred kilobytes that the list never shows. The
 * index holds what a row shows and what a filter needs, nothing else; the
 * message itself is loaded only when it is opened.
 *
 * Rows come off the operations themselves (see `rows.ts`), so a history
 * replay on first install walks every past operation once without loading a
 * document.
 */
export interface EmailRow {
  document_id: string;
  /** True once CAPTURE_MESSAGE has run: an uncaptured document is not mail yet. */
  captured: boolean;
  account_address: string | null;
  account_name: string | null;
  account_provider: string | null;
  subject: string | null;
  from_name: string | null;
  from_address: string | null;
  snippet: string | null;
  /** The instant the message lists by: sent, else received, else captured, else the operation's. */
  when_at: string;
  sent_at: string | null;
  received_at: string | null;
  read: boolean;
  flagged: boolean;
  /** INBOX | ARCHIVED */
  status: string;
  /** JSON: [{ id, ref, name }], as the document carries them. */
  attachments: string;
  /** Distinct stored files: the number the row shows. */
  attachment_count: number;
  /** JSON: string[] */
  labels: string;
  thread_id: string | null;
  /** Everyone else on the message (to, cc), for search only. */
  participants: string;
  /** Lower-cased haystack: subject, snippet, sender, participants, labels, file names. */
  search_text: string;
  updated_at: string;
}

export interface DB {
  email_index: EmailRow;
}
