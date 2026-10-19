import {
  addAttachment,
  addLabels,
  archive,
  captureMessage,
  markRead,
  markUnread,
  reducer,
  removeAttachment,
  removeLabels,
  setAccount,
  setFlagged,
  setNotes,
  unarchive,
  utils,
  type EmailDocument,
} from "document-models/email/v1";
import { describe, expect, it } from "vitest";

const lastError = (doc: EmailDocument) => doc.operations.global.at(-1)?.error;

const AT = "2026-10-19T20:05:40.000Z";

/** A Gmail search result, shaped the way the workflow step hands it over. */
const gmailCapture = () =>
  captureMessage({
    externalId: "gmail:1a154a768b7faffb",
    messageId: "<calendar-184b8d1b@google.com>",
    threadId: "1a154a768b7faffb",
    references: ["<CAB8iD9h@mail.gmail.com>"],
    subject: "Accepted: Multi-reactor next steps",
    from: [
      { address: "thegoldenmule@powerhouse.inc", name: "The Golden Mule" },
    ],
    to: [{ address: "wouter@powerhouse.inc", name: "Wouter" }],
    cc: [{ address: "team@powerhouse.inc" }],
    replyTo: [{ address: "thegoldenmule@powerhouse.inc", name: null }],
    sentAt: "2026-10-19T14:53:38.000Z",
    receivedAt: "2026-10-19T14:53:40.000Z",
    text: "The Golden Mule   has accepted\n\nthis invitation.",
    html: "<p>The Golden Mule has accepted this invitation.</p>",
    headers: [
      { key: "message-id", value: "<calendar-184b8d1b@google.com>" },
      { key: "content-type", value: "multipart/mixed" },
    ],
    labels: ["INBOX", " calendar ", "INBOX", ""],
    source: "gmail",
    capturedAt: AT,
  });

describe("email as captured from Gmail", () => {
  it("files a full message end to end and triages it", () => {
    let doc = reducer(
      utils.createDocument(),
      setAccount({
        address: "wouter@powerhouse.inc",
        name: "Powerhouse GMail",
        provider: "gmail",
      }),
    );
    doc = reducer(doc, gmailCapture());
    expect(lastError(doc)).toBeUndefined();
    const s = doc.state.global;
    expect(s.account).toEqual({
      address: "wouter@powerhouse.inc",
      name: "Powerhouse GMail",
      provider: "gmail",
    });
    expect(s.externalId).toBe("gmail:1a154a768b7faffb");
    expect(s.messageId).toBe("<calendar-184b8d1b@google.com>");
    expect(s.threadId).toBe("1a154a768b7faffb");
    expect(s.inReplyTo).toBeNull();
    expect(s.references).toEqual(["<CAB8iD9h@mail.gmail.com>"]);
    expect(s.from).toEqual([
      { address: "thegoldenmule@powerhouse.inc", name: "The Golden Mule" },
    ]);
    expect(s.cc).toEqual([{ address: "team@powerhouse.inc", name: null }]);
    expect(s.bcc).toEqual([]);
    expect(s.replyTo[0].name).toBeNull();
    expect(s.snippet).toBe("The Golden Mule has accepted this invitation.");
    expect(s.headers).toHaveLength(2);
    // labels are trimmed, de-duplicated and never empty
    expect(s.labels).toEqual(["INBOX", "calendar"]);
    expect(s.source).toBe("gmail");
    expect(s.capturedAt).toBe(AT);
    expect(s.status).toBe("INBOX");
    expect(s.read).toBe(false);

    doc = reducer(
      doc,
      addAttachment({
        id: "att-1",
        ref: "attachment://v1:aadbf1f8953a99e53bb8d217851d6828f8dbe1ad7d48e5805192c6477b104fd3",
        fileName: " invite.ics ",
        mimeType: "application/ics",
        sizeBytes: 1202,
        contentId: null,
        inline: null,
      }),
    );
    expect(lastError(doc)).toBeUndefined();
    expect(doc.state.global.attachments).toEqual([
      {
        id: "att-1",
        ref: "attachment://v1:aadbf1f8953a99e53bb8d217851d6828f8dbe1ad7d48e5805192c6477b104fd3",
        fileName: "invite.ics",
        mimeType: "application/ics",
        sizeBytes: 1202,
        contentId: null,
        inline: false,
      },
    ]);
    doc = reducer(
      doc,
      addAttachment({
        id: "att-2",
        ref: "attachment://v1:0000",
        fileName: "logo.png",
        contentId: "<logo@mail>",
        inline: true,
      }),
    );
    expect(doc.state.global.attachments[1]).toMatchObject({
      inline: true,
      contentId: "<logo@mail>",
      mimeType: null,
      sizeBytes: null,
    });

    doc = reducer(doc, markRead({}));
    doc = reducer(doc, markRead({}));
    expect(doc.state.global.read).toBe(true);
    doc = reducer(doc, markUnread({}));
    expect(doc.state.global.read).toBe(false);
    doc = reducer(doc, setFlagged({ flagged: true }));
    expect(doc.state.global.flagged).toBe(true);
    doc = reducer(doc, addLabels({ labels: ["invoice", " calendar"] }));
    expect(doc.state.global.labels).toEqual(["INBOX", "calendar", "invoice"]);
    doc = reducer(doc, removeLabels({ labels: ["INBOX "] }));
    expect(doc.state.global.labels).toEqual(["calendar", "invoice"]);
    doc = reducer(doc, setNotes({ notes: "Meeting accepted, nothing to do." }));
    expect(doc.state.global.notes).toBe("Meeting accepted, nothing to do.");
    doc = reducer(doc, setNotes({ notes: null }));
    expect(doc.state.global.notes).toBeNull();
    doc = reducer(doc, archive({}));
    expect(doc.state.global.status).toBe("ARCHIVED");
    doc = reducer(doc, unarchive({}));
    expect(doc.state.global.status).toBe("INBOX");
    doc = reducer(doc, removeAttachment({ id: "att-2" }));
    expect(doc.state.global.attachments.map((a) => a.id)).toEqual(["att-1"]);
    expect(doc.operations.global.every((op) => !op.error)).toBe(true);
  });

  it("re-captures the same message in place, with the sparse fields nulled", () => {
    let doc = reducer(utils.createDocument(), gmailCapture());
    doc = reducer(
      doc,
      captureMessage({
        externalId: " gmail:1a154a768b7faffb ",
        from: [{ address: "a@b.c" }],
        capturedAt: "2026-10-20T00:00:00.000Z",
      }),
    );
    expect(lastError(doc)).toBeUndefined();
    const s = doc.state.global;
    expect(s.externalId).toBe("gmail:1a154a768b7faffb");
    expect(s.subject).toBeNull();
    expect(s.text).toBeNull();
    expect(s.html).toBeNull();
    expect(s.snippet).toBeNull();
    expect(s.to).toEqual([]);
    expect(s.cc).toEqual([]);
    expect(s.replyTo).toEqual([]);
    expect(s.references).toEqual([]);
    expect(s.headers).toEqual([]);
    expect(s.labels).toEqual([]);
    expect(s.sentAt).toBeNull();
    expect(s.receivedAt).toBeNull();
    expect(s.messageId).toBeNull();
    expect(s.threadId).toBeNull();
    // the source survives a re-capture that does not name one
    expect(s.source).toBe("gmail");
    expect(s.capturedAt).toBe("2026-10-20T00:00:00.000Z");
  });

  it("keeps the account partial updates apart", () => {
    let doc = reducer(
      utils.createDocument(),
      setAccount({ address: "jane@juniper.studio" }),
    );
    expect(doc.state.global.account).toEqual({
      address: "jane@juniper.studio",
      name: null,
      provider: null,
    });
    doc = reducer(doc, setAccount({ name: "Studio", provider: "gmail" }));
    expect(doc.state.global.account).toEqual({
      address: "jane@juniper.studio",
      name: "Studio",
      provider: "gmail",
    });
    doc = reducer(doc, setAccount({ address: null }));
    expect(doc.state.global.account.address).toBeNull();
  });

  it("refuses an external id without a system namespace", () => {
    const doc = reducer(
      utils.createDocument(),
      captureMessage({
        externalId: "1a154a768b7faffb",
        from: [{ address: "a@b.c" }],
        capturedAt: AT,
      }),
    );
    expect(doc.operations.global[0].error).toContain("namespaced");
    expect(doc.state.global.externalId).toBeNull();
  });

  it("refuses to overwrite a document with a different message", () => {
    let doc = reducer(utils.createDocument(), gmailCapture());
    doc = reducer(
      doc,
      captureMessage({
        externalId: "gmail:other",
        from: [{ address: "a@b.c" }],
        capturedAt: AT,
      }),
    );
    expect(doc.operations.global[1].error).toBe(
      "This document holds gmail:1a154a768b7faffb, not gmail:other",
    );
    expect(doc.state.global.externalId).toBe("gmail:1a154a768b7faffb");
  });

  it("rejects attachments without a name or already on the message", () => {
    let doc = reducer(
      utils.createDocument(),
      addAttachment({ id: "a", ref: "attachment://v1:1", fileName: "  " }),
    );
    expect(doc.operations.global[0].error).toBe(
      "An attachment needs a file name",
    );
    doc = reducer(
      doc,
      addAttachment({ id: "a", ref: "attachment://v1:1", fileName: "x.pdf" }),
    );
    expect(lastError(doc)).toBeUndefined();
    // same id
    doc = reducer(
      doc,
      addAttachment({ id: "a", ref: "attachment://v1:2", fileName: "y.pdf" }),
    );
    expect(lastError(doc)).toBe("Attachment y.pdf is already on the message");
    // same bytes under the same name
    doc = reducer(
      doc,
      addAttachment({ id: "b", ref: "attachment://v1:1", fileName: "x.pdf" }),
    );
    expect(lastError(doc)).toBe("Attachment x.pdf is already on the message");
    // same bytes under another name is a second attachment (Gmail does this)
    doc = reducer(
      doc,
      addAttachment({ id: "b", ref: "attachment://v1:1", fileName: "z.pdf" }),
    );
    expect(lastError(doc)).toBeUndefined();
    expect(doc.state.global.attachments).toHaveLength(2);
    doc = reducer(doc, removeAttachment({ id: "nope" }));
    expect(lastError(doc)).toBe("Attachment nope not found");
    expect(doc.state.global.attachments).toHaveLength(2);
  });

  it("guards the archive transitions and the labels", () => {
    let doc = reducer(utils.createDocument(), unarchive({}));
    expect(doc.operations.global[0].error).toBe("The message is not archived");
    doc = reducer(doc, archive({}));
    doc = reducer(doc, archive({}));
    expect(lastError(doc)).toBe("The message is archived already");
    expect(doc.state.global.status).toBe("ARCHIVED");
    doc = reducer(doc, addLabels({ labels: ["ok", "   "] }));
    expect(lastError(doc)).toBe("A label cannot be empty");
    // the failed operation left no half-applied label behind
    expect(doc.state.global.labels).toEqual([]);
    doc = reducer(doc, addLabels({ labels: ["ok"] }));
    doc = reducer(doc, removeLabels({ labels: ["missing"] }));
    expect(lastError(doc)).toBe('No label "missing" on the message');
    expect(doc.state.global.labels).toEqual(["ok"]);
  });
});
