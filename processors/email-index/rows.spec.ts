/**
 * What the mailbox index writes for a document.
 *
 * `.spec.ts` so codegen never claims the filename.
 */
import { describe, expect, it } from "vitest";
import {
  decodeCursor,
  encodeCursor,
  mergeAccounts,
  searchWords,
  toMailRow,
} from "./queries.js";
import { applyAction, emptyRow, parseState, rowFromState } from "./rows.js";

const AT = "2026-10-20T08:00:00.000Z";

const capture = {
  externalId: "gmail:1",
  subject: "Invoice 42",
  from: [{ address: "ann@acme.example", name: "Ann" }],
  to: [{ address: "wouter@powerhouse.inc", name: "Wouter" }],
  cc: [{ address: "bob@acme.example" }],
  sentAt: "2026-10-19T10:00:00.000Z",
  text: "Hi   Wouter,\n\nplease find   the invoice attached.",
  labels: ["INBOX", " billing ", ""],
  threadId: "t-1",
  capturedAt: "2026-10-20T07:00:00.000Z",
};

describe("a row from a document's state", () => {
  it("takes what the list shows and what a filter needs", () => {
    const row = rowFromState(
      "d1",
      {
        account: { address: "wouter@powerhouse.inc", name: "Powerhouse", provider: "gmail" },
        externalId: "gmail:1",
        subject: "Invoice 42",
        from: [{ address: "ann@acme.example", name: "Ann" }],
        to: [{ address: "wouter@powerhouse.inc", name: null }],
        cc: [],
        snippet: "please find the invoice attached",
        sentAt: null,
        receivedAt: "2026-10-19T10:00:01.000Z",
        capturedAt: "2026-10-20T07:00:00.000Z",
        read: true,
        flagged: false,
        status: "ARCHIVED",
        labels: ["INBOX"],
        threadId: null,
        attachments: [
          { id: "a1", ref: "attachment://v1:abc", fileName: "invoice.pdf" },
          // the same bytes under a second name count once
          { id: "a2", ref: "attachment://v1:abc", fileName: "attachment-1" },
          { id: "a3", ref: "attachment://v1:def", fileName: "logo.png" },
        ],
      },
      AT,
    );
    expect(row).toMatchObject({
      document_id: "d1",
      captured: true,
      account_address: "wouter@powerhouse.inc",
      account_name: "Powerhouse",
      account_provider: "gmail",
      subject: "Invoice 42",
      from_name: "Ann",
      from_address: "ann@acme.example",
      when_at: "2026-10-19T10:00:01.000Z",
      read: true,
      flagged: false,
      status: "ARCHIVED",
      attachment_count: 2,
      labels: '["INBOX"]',
      participants: "wouter@powerhouse.inc",
      updated_at: AT,
    });
    expect(row.search_text).toContain("invoice 42");
    expect(row.search_text).toContain("ann ann@acme.example");
    expect(row.search_text).toContain("logo.png");
    expect(toMailRow(row).attachmentRefs).toEqual([
      "attachment://v1:abc",
      "attachment://v1:def",
    ]);
  });

  it("lists by sent, else received, else captured, else the operation's time", () => {
    const base = { externalId: "x:1", from: [] };
    expect(rowFromState("d", { ...base, sentAt: "s", receivedAt: "r", capturedAt: "c" }, AT).when_at).toBe("s");
    expect(rowFromState("d", { ...base, receivedAt: "r", capturedAt: "c" }, AT).when_at).toBe("r");
    expect(rowFromState("d", { ...base, capturedAt: "c" }, AT).when_at).toBe("c");
    expect(rowFromState("d", base, AT).when_at).toBe(AT);
  });

  it("is not mail until captured", () => {
    const row = rowFromState("d", { account: { address: "a@b.c" } }, AT);
    expect(row.captured).toBe(false);
    expect(row.status).toBe("INBOX");
  });
});

describe("a row built operation by operation", () => {
  it("follows the reducer through a message's life", () => {
    let row = emptyRow("d1", AT);
    row = applyAction(row, "SET_ACCOUNT", { address: "wouter@powerhouse.inc", name: "Powerhouse" }, AT);
    expect(row.captured).toBe(false);
    row = applyAction(row, "CAPTURE_MESSAGE", capture, AT);
    expect(row).toMatchObject({
      captured: true,
      account_address: "wouter@powerhouse.inc",
      subject: "Invoice 42",
      from_name: "Ann",
      from_address: "ann@acme.example",
      snippet: "Hi Wouter, please find the invoice attached.",
      when_at: "2026-10-19T10:00:00.000Z",
      labels: '["INBOX","billing"]',
      thread_id: "t-1",
      participants: "Wouter wouter@powerhouse.inc bob@acme.example",
      read: false,
      status: "INBOX",
    });

    row = applyAction(row, "ADD_ATTACHMENT", { id: "a1", ref: "attachment://v1:abc", fileName: "invoice.pdf" }, AT);
    // the reducer refuses a duplicate id, and a duplicate ref+name
    row = applyAction(row, "ADD_ATTACHMENT", { id: "a1", ref: "attachment://v1:zzz", fileName: "other.pdf" }, AT);
    row = applyAction(row, "ADD_ATTACHMENT", { id: "a9", ref: "attachment://v1:abc", fileName: "invoice.pdf" }, AT);
    // the same bytes under a second name are one stored file
    row = applyAction(row, "ADD_ATTACHMENT", { id: "a2", ref: "attachment://v1:abc", fileName: "attachment-1" }, AT);
    expect(JSON.parse(row.attachments)).toHaveLength(2);
    expect(row.attachment_count).toBe(1);
    expect(row.search_text).toContain("invoice.pdf");
    row = applyAction(row, "REMOVE_ATTACHMENT", { id: "a2" }, AT);
    expect(JSON.parse(row.attachments)).toHaveLength(1);

    row = applyAction(row, "MARK_READ", {}, AT);
    expect(row.read).toBe(true);
    row = applyAction(row, "MARK_UNREAD", {}, AT);
    expect(row.read).toBe(false);
    row = applyAction(row, "SET_FLAGGED", { flagged: true }, AT);
    expect(row.flagged).toBe(true);
    row = applyAction(row, "ARCHIVE", {}, AT);
    expect(row.status).toBe("ARCHIVED");
    row = applyAction(row, "UNARCHIVE", {}, AT);
    expect(row.status).toBe("INBOX");
    row = applyAction(row, "ADD_LABELS", { labels: ["urgent", "INBOX"] }, AT);
    expect(JSON.parse(row.labels)).toEqual(["INBOX", "billing", "urgent"]);
    row = applyAction(row, "REMOVE_LABELS", { labels: ["billing"] }, AT);
    expect(JSON.parse(row.labels)).toEqual(["INBOX", "urgent"]);
    expect(row.search_text).toContain("urgent");
    expect(row.search_text).not.toContain("billing");
    // notes are not listed, so they leave the row alone
    const before = row;
    row = applyAction(row, "SET_NOTES", { notes: "call them" }, "2026-10-21T00:00:00.000Z");
    expect({ ...row, updated_at: before.updated_at }).toEqual(before);
    expect(row.updated_at).toBe("2026-10-21T00:00:00.000Z");
  });

  it("refuses an external id that is not namespaced, as the reducer does", () => {
    const row = applyAction(emptyRow("d", AT), "CAPTURE_MESSAGE", { ...capture, externalId: "18f3a" }, AT);
    expect(row.captured).toBe(false);
    expect(row.subject).toBeNull();
  });

  it("lists an undated capture by its own capture time", () => {
    const row = applyAction(
      emptyRow("d", "2026-01-01T00:00:00.000Z"),
      "CAPTURE_MESSAGE",
      { externalId: "x:1", from: [], capturedAt: "2026-02-02T00:00:00.000Z" },
      AT,
    );
    expect(row.when_at).toBe("2026-02-02T00:00:00.000Z");
  });

  it("agrees with the row built from the resulting state", () => {
    const byOps = applyAction(
      applyAction(
        applyAction(emptyRow("d1", AT), "SET_ACCOUNT", { address: "w@p.inc", name: "P" }, AT),
        "CAPTURE_MESSAGE",
        capture,
        AT,
      ),
      "ADD_ATTACHMENT",
      { id: "a1", ref: "attachment://v1:abc", fileName: "invoice.pdf" },
      AT,
    );
    const byState = rowFromState(
      "d1",
      {
        account: { address: "w@p.inc", name: "P", provider: null },
        externalId: "gmail:1",
        subject: capture.subject,
        from: capture.from,
        to: capture.to,
        cc: capture.cc,
        sentAt: capture.sentAt,
        receivedAt: null,
        snippet: "Hi Wouter, please find the invoice attached.",
        labels: ["INBOX", "billing"],
        threadId: "t-1",
        capturedAt: capture.capturedAt,
        read: false,
        flagged: false,
        status: "INBOX",
        attachments: [{ id: "a1", ref: "attachment://v1:abc", fileName: "invoice.pdf" }],
      },
      AT,
    );
    expect(byOps).toEqual(byState);
  });
});

describe("the resulting state an operation carries", () => {
  it("is read bare or wrapped per scope, and ignored when it is not JSON", () => {
    expect(parseState('{"subject":"x"}')).toEqual({ subject: "x" });
    expect(parseState('{"global":{"subject":"x"},"local":{}}')).toEqual({ subject: "x" });
    expect(parseState("nope")).toBeNull();
    expect(parseState(undefined)).toBeNull();
  });
});

describe("paging and search helpers", () => {
  it("round-trips a cursor and refuses a malformed one", () => {
    const c = { when: "2026-10-19T10:00:00.000Z", id: "doc|with|bars" };
    expect(decodeCursor(encodeCursor(c))).toEqual(c);
    expect(decodeCursor("")).toBeNull();
    expect(decodeCursor("|x")).toBeNull();
    expect(decodeCursor(null)).toBeNull();
  });

  it("splits a search into a few lower-cased words", () => {
    expect(searchWords("  Invoice   ACME ")).toEqual(["invoice", "acme"]);
    expect(searchWords("a b c d e f g h")).toHaveLength(6);
    expect(searchWords(null)).toEqual([]);
  });

  it("folds totals and unread counts per mailbox", () => {
    expect(
      mergeAccounts(
        [
          { account_address: "b@x", name: "Bea", provider: "gmail", n: "12" },
          { account_address: "a@x", name: null, provider: null, n: 3 },
        ],
        [{ account_address: "b@x", n: "2" }],
      ),
    ).toEqual([
      { address: "a@x", name: "a@x", provider: null, total: 3, unread: 0 },
      { address: "b@x", name: "Bea", provider: "gmail", total: 12, unread: 2 },
    ]);
  });
});
