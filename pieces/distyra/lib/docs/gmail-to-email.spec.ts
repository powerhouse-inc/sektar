/**
 * The Gmail-to-email mapping.
 *
 * Tested against the shape the Gmail piece actually emits (mailparser's
 * output plus the host's attachment refs), because every field here is a
 * place where "looks like data" and "is the right data" can quietly differ:
 * an address object instead of a list, a Map of headers that JSON turned
 * into `{}`, a date that is now a string.
 *
 * `.spec.ts` so codegen never claims the filename.
 */
import { describe, expect, it } from "vitest";
import {
  attachmentsOf,
  emailName,
  headersOf,
  isoOf,
  mailboxesOf,
  mapGmailMessages,
  referencesOf,
} from "./gmail-to-email.js";

/** A message as Search Email returns it, after the host minted the refs. */
function gmailMessage(over: Record<string, unknown> = {}) {
  return {
    id: "18f3a2b4c5d6e7f8",
    subject: "Invoice 7781",
    from: { value: [{ address: "billing@acme.example", name: "ACME Billing" }], text: "ACME" },
    to: { value: [{ address: "jane@juniper.studio", name: "" }], text: "jane" },
    cc: undefined,
    date: "2026-10-18T09:12:00.000Z",
    messageId: "<7781@acme.example>",
    inReplyTo: "<7780@acme.example>",
    references: "<7779@acme.example> <7780@acme.example>",
    text: "Please find the invoice attached.",
    html: "<p>Please find the invoice attached.</p>",
    textAsHtml: "<p>Please find the invoice attached.</p>",
    headers: {},
    headerLines: [
      { key: "subject", line: "Subject: Invoice 7781" },
      { key: "x-mailer", line: "X-Mailer: acme-bill/2" },
    ],
    attachments: [
      { fileName: "invoice-7781.pdf", mimeType: "application/pdf", size: 48213, data: "attachment://v1:9de1" },
      null,
    ],
    ...over,
  };
}

const options = {
  account: { address: "jane@juniper.studio", name: "Jane", provider: "gmail" },
  labels: ["INBOX", " INBOX", ""],
  capturedAt: "2026-10-19T20:00:00.000Z",
};

describe("field helpers", () => {
  it("reads mailboxes from an address object, a list of them, or bare boxes", () => {
    expect(mailboxesOf({ value: [{ address: "a@b.c", name: "A" }] })).toEqual([
      { address: "a@b.c", name: "A" },
    ]);
    expect(
      mailboxesOf([{ value: [{ address: "a@b.c" }] }, { value: [{ address: "d@e.f", name: "" }] }]),
    ).toEqual([
      { address: "a@b.c", name: null },
      { address: "d@e.f", name: null },
    ]);
    expect(mailboxesOf([{ address: "x@y.z", name: "X" }])).toEqual([{ address: "x@y.z", name: "X" }]);
    expect(mailboxesOf(undefined)).toEqual([]);
    expect(mailboxesOf({ value: [{ name: "no address" }] })).toEqual([]);
  });

  it("takes a header's value from after the first colon", () => {
    expect(headersOf([{ key: "subject", line: "Subject: Re: a: b" }, { key: "x", line: "nocolon" }])).toEqual([
      { key: "subject", value: "Re: a: b" },
      { key: "x", value: "nocolon" },
    ]);
    expect(headersOf({})).toEqual([]);
  });

  it("splits references on whitespace", () => {
    expect(referencesOf("<a> <b>\n<c>")).toEqual(["<a>", "<b>", "<c>"]);
    expect(referencesOf(["<a>", "<b> <c>"])).toEqual(["<a>", "<b>", "<c>"]);
    expect(referencesOf(undefined)).toEqual([]);
  });

  it("normalises a date and refuses a non-date", () => {
    expect(isoOf("2026-10-18T09:12:00Z")).toBe("2026-10-18T09:12:00.000Z");
    expect(isoOf(Date.parse("2026-10-18T09:12:00Z"))).toBe("2026-10-18T09:12:00.000Z");
    expect(isoOf("yesterday")).toBeNull();
    expect(isoOf(null)).toBeNull();
  });

  it("keeps only attachments the host turned into refs", () => {
    expect(
      attachmentsOf([
        { fileName: "a.pdf", mimeType: "application/pdf", size: 10, data: "attachment://v1:a" },
        { fileName: "lost.pdf" },
        null,
      ]),
    ).toEqual([{ fileName: "a.pdf", mimeType: "application/pdf", sizeBytes: 10, ref: "attachment://v1:a" }]);
  });

  it("names a document by subject, else by sender", () => {
    expect(emailName("  Hello ", [])).toBe("Hello");
    expect(emailName(null, [{ address: "a@b.c", name: "A" }])).toBe("(no subject) from A");
    expect(emailName("", [{ address: "a@b.c", name: null }])).toBe("(no subject) from a@b.c");
    expect(emailName(null, [])).toBe("(no subject)");
  });
});

describe("mapping messages", () => {
  it("produces the key, the name and the three kinds of action", () => {
    const { items, skipped, count } = mapGmailMessages([gmailMessage()], options);
    expect(skipped).toEqual([]);
    expect(count).toBe(1);
    const [item] = items;
    expect(item.key).toBe("gmail:18f3a2b4c5d6e7f8");
    expect(item.name).toBe("Invoice 7781");
    expect(item.account).toEqual({ address: "jane@juniper.studio", name: "Jane", provider: "gmail" });
    expect(item.folder).toBe("Jane");
    expect(item.attachmentCount).toBe(1);
    expect(item.actions.map((a) => a.type)).toEqual(["SET_ACCOUNT", "CAPTURE_MESSAGE", "ADD_ATTACHMENT"]);
    // No attachment on update: the reducer refuses a duplicate ref.
    expect(item.updateActions.map((a) => a.type)).toEqual(["SET_ACCOUNT", "CAPTURE_MESSAGE"]);

    expect(item.actions[0].input).toEqual({ address: "jane@juniper.studio", name: "Jane", provider: "gmail" });
    expect(item.actions[1].input).toEqual({
      externalId: "gmail:18f3a2b4c5d6e7f8",
      messageId: "<7781@acme.example>",
      threadId: null,
      inReplyTo: "<7780@acme.example>",
      references: ["<7779@acme.example>", "<7780@acme.example>"],
      subject: "Invoice 7781",
      from: [{ address: "billing@acme.example", name: "ACME Billing" }],
      to: [{ address: "jane@juniper.studio", name: null }],
      cc: [],
      bcc: [],
      replyTo: [],
      sentAt: "2026-10-18T09:12:00.000Z",
      receivedAt: null,
      text: "Please find the invoice attached.",
      html: "<p>Please find the invoice attached.</p>",
      headers: [
        { key: "subject", value: "Invoice 7781" },
        { key: "x-mailer", value: "acme-bill/2" },
      ],
      labels: ["INBOX"],
      source: "gmail",
      capturedAt: "2026-10-19T20:00:00.000Z",
    });
    expect(item.actions[2].input).toMatchObject({
      ref: "attachment://v1:9de1",
      fileName: "invoice-7781.pdf",
      mimeType: "application/pdf",
      sizeBytes: 48213,
      inline: false,
    });
  });

  it("can leave the html and the headers behind", () => {
    const { items } = mapGmailMessages([gmailMessage()], {
      ...options,
      includeHtml: false,
      includeHeaders: false,
    });
    expect(items[0].actions[1].input).toMatchObject({ html: null, headers: [] });
  });

  it("skips what has no id and what Gmail could not fetch, by position", () => {
    const { items, skipped } = mapGmailMessages(
      [{ subject: "orphan" }, gmailMessage(), { id: "x1", threadId: "t", error: "Failed to retrieve message details" }],
      options,
    );
    expect(items).toHaveLength(1);
    expect(skipped).toEqual([
      { index: 0, reason: "no Gmail id" },
      { index: 2, reason: "Gmail: Failed to retrieve message details" },
    ]);
  });

  it("files under the address when the mailbox has no name", () => {
    const { items } = mapGmailMessages([gmailMessage()], {
      ...options,
      account: { address: "jane@juniper.studio" },
    });
    expect(items[0].folder).toBe("jane@juniper.studio");
    expect(items[0].actions[0].input).toEqual({ address: "jane@juniper.studio", name: null, provider: "gmail" });
  });

  it("accepts a single message and nothing at all", () => {
    expect(mapGmailMessages(gmailMessage(), options).count).toBe(1);
    expect(mapGmailMessages(undefined, options).count).toBe(0);
  });
});
