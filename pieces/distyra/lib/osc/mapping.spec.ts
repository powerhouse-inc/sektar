/**
 * What the mapper turns a provider's record into.
 *
 * The shapes below are the real ones. Gmail's come from `simpleParser` plus
 * the piece's own attachment rewrite (`{fileName, mimeType, size, data}`,
 * where `data` is what `files.write` returned); Dropbox's come from
 * `files/list_folder`. Testing against invented shapes would prove the
 * mapper self-consistent and nothing else.
 */
import { describe, expect, it } from "vitest";
import {
  asInstant,
  at,
  hasWantedExtension,
  inWindow,
  mapRecords,
  type MappingSpec,
} from "./mapping.js";

const GMAIL: MappingSpec = {
  namespace: "gmail",
  idPath: "id",
  aliasPaths: ["rfc822:messageId"],
  titlePath: "subject",
  contentPath: "text",
  occurredAtPath: "date",
  tags: ["email"],
  extensions: [],
  attachments: {
    path: "attachments",
    refPath: "data",
    namePath: "fileName",
    sizePath: "size",
    mimePath: "mimeType",
  },
};

const DROPBOX: MappingSpec = {
  namespace: "dropbox",
  idPath: "id",
  aliasPaths: ["dropbox-path:path_lower"],
  titlePath: "name",
  occurredAtPath: "server_modified",
  tags: ["file"],
  namePath: "name",
  extensions: ["pdf", "jpg", "png"],
  attachments: { refPath: "data", namePath: "fileName" },
  windowPath: "server_modified",
  from: "2026-09-20T00:00:00.000Z",
  to: "2026-09-27T00:00:00.000Z",
};

function mail(over: Record<string, unknown> = {}) {
  return {
    id: "18ef2c91a74b0033",
    messageId: "<CADn9x@mail.gmail.com>",
    subject: "Hetzner invoice R0012845921",
    text: "Your invoice for April is attached.",
    date: "2026-09-22T09:14:01.000Z",
    attachments: [
      {
        fileName: "R0012845921.pdf",
        mimeType: "application/pdf",
        size: 48210,
        data: "attachment://v1:0650db71",
      },
    ],
    ...over,
  };
}

function entry(over: Record<string, unknown> = {}) {
  return {
    ".tag": "file",
    name: "Contract.pdf",
    id: "id:a4ayc_80_OEAAAAAAAAAXw",
    path_lower: "/legal/contract.pdf",
    path_display: "/Legal/Contract.pdf",
    server_modified: "2026-09-22T11:02:00Z",
    size: 91234,
    ...over,
  };
}

describe("reading a field out of a record", () => {
  it("follows a dotted path", () => {
    expect(at({ from: { text: "a@b.c" } }, "from.text")).toBe("a@b.c");
  });

  it("gives nothing rather than throwing when the path runs out", () => {
    expect(at({ from: null }, "from.text")).toBeUndefined();
    expect(at({}, "a.b.c")).toBeUndefined();
    expect(at(undefined, "a")).toBeUndefined();
  });

  it("reads a date whether it survived a step boundary or not", () => {
    // Within one step mailparser hands over a Date; across one it is an ISO
    // string. Both have to land on the same instant.
    expect(asInstant(new Date("2026-09-22T09:14:01.000Z"))).toBe(
      "2026-09-22T09:14:01.000Z",
    );
    expect(asInstant("2026-09-22T09:14:01.000Z")).toBe(
      "2026-09-22T09:14:01.000Z",
    );
  });

  it("treats an unreadable date as absent, not as Invalid Date", () => {
    expect(asInstant("not a date")).toBeUndefined();
    expect(asInstant({ deep: 1 })).toBeUndefined();
  });
});

describe("a Gmail message", () => {
  it("becomes one capture record", () => {
    const { records, mapped } = mapRecords([mail()], GMAIL);
    expect(mapped).toBe(1);
    expect(records[0].externalId).toBe("gmail:18ef2c91a74b0033");
    expect(records[0].title).toBe("Hetzner invoice R0012845921");
    expect(records[0].occurredAt).toBe("2026-09-22T09:14:01.000Z");
    expect(records[0].tags).toEqual(["email"]);
  });

  it("files the Message-ID under its own namespace", () => {
    // Not gmail:, because it is not a Gmail id — the same mail reached
    // through IMAP carries this and must land on this record.
    const { records } = mapRecords([mail()], GMAIL);
    expect(records[0].aliases).toEqual(["rfc822:<CADn9x@mail.gmail.com>"]);
  });

  it("lifts the attachment reference into the shape the model stores", () => {
    // The whole reason this step exists: `data` -> `ref`, `size` ->
    // `sizeBytes`. No expression can rename a field inside a list.
    const { records } = mapRecords([mail()], GMAIL);
    expect(records[0].attachments).toEqual([
      {
        ref: "attachment://v1:0650db71",
        fileName: "R0012845921.pdf",
        sizeBytes: 48210,
        mimeType: "application/pdf",
      },
    ]);
  });

  it("keeps the record itself untouched as the payload", () => {
    const original = mail();
    const { records } = mapRecords([original], GMAIL);
    expect(records[0].payload).toEqual(original);
  });

  it("drops an attachment with no reference", () => {
    // A name pointing at nothing is worse than no attachment: it reads in
    // the editor as a file you can open, and it cannot be opened.
    const { records } = mapRecords(
      [mail({ attachments: [{ fileName: "ghost.pdf", size: 10 }] })],
      GMAIL,
    );
    expect(records[0].attachments).toEqual([]);
  });

  it("copes with a message that has no attachments at all", () => {
    const { records } = mapRecords([mail({ attachments: undefined })], GMAIL);
    expect(records[0].attachments).toEqual([]);
  });

  it("leaves off fields the message does not have", () => {
    const { records } = mapRecords(
      [mail({ subject: undefined, text: "", messageId: undefined })],
      GMAIL,
    );
    expect(records[0].title).toBeUndefined();
    expect(records[0].content).toBeUndefined();
    expect(records[0].aliases).toEqual([]);
  });

  it("counts a message with no id instead of capturing it", () => {
    const { mapped, unidentified } = mapRecords([mail({ id: "" })], GMAIL);
    expect(mapped).toBe(0);
    expect(unidentified).toBe(1);
  });
});

describe("a Dropbox listing", () => {
  it("keeps a PDF inside the week", () => {
    const { records, mapped } = mapRecords([entry()], DROPBOX);
    expect(mapped).toBe(1);
    expect(records[0].externalId).toBe("dropbox:id:a4ayc_80_OEAAAAAAAAAXw");
    expect(records[0].aliases).toEqual(["dropbox-path:/legal/contract.pdf"]);
  });

  it("drops a folder, which has neither extension nor timestamp", () => {
    const folder = { ".tag": "folder", name: "Legal", id: "id:folder1" };
    const { mapped, wrongType } = mapRecords([folder], DROPBOX);
    expect(mapped).toBe(0);
    expect(wrongType).toBe(1);
  });

  it("drops a file type nobody asked for", () => {
    const { mapped, wrongType } = mapRecords(
      [entry({ name: "notes.docx" })],
      DROPBOX,
    );
    expect(mapped).toBe(0);
    expect(wrongType).toBe(1);
  });

  it("matches the extension case-insensitively", () => {
    const { mapped } = mapRecords([entry({ name: "SCAN.PNG" })], DROPBOX);
    expect(mapped).toBe(1);
  });

  it("does not match a suffix that is not an extension", () => {
    // `notapdf` ends with `pdf` and is not a PDF.
    expect(hasWantedExtension("notapdf", ["pdf"])).toBe(false);
    expect(hasWantedExtension("a.pdf", ["pdf"])).toBe(true);
  });

  it("keeps everything when no type was named", () => {
    expect(hasWantedExtension("anything", [])).toBe(true);
    expect(hasWantedExtension(undefined, [])).toBe(true);
  });

  it("drops a file modified before the week", () => {
    const { mapped, outsideWindow } = mapRecords(
      [entry({ server_modified: "2026-09-19T23:59:59Z" })],
      DROPBOX,
    );
    expect(mapped).toBe(0);
    expect(outsideWindow).toBe(1);
  });

  it("puts a file on the upper boundary in the next slice, not this one", () => {
    // Half-open. Inclusive at both ends would capture every boundary twice,
    // and across five slices that is five duplicated days.
    const { mapped, outsideWindow } = mapRecords(
      [entry({ server_modified: "2026-09-27T00:00:00Z" })],
      DROPBOX,
    );
    expect(mapped).toBe(0);
    expect(outsideWindow).toBe(1);
  });

  it("includes a file exactly on the lower boundary", () => {
    const { mapped } = mapRecords(
      [entry({ server_modified: "2026-09-20T00:00:00Z" })],
      DROPBOX,
    );
    expect(mapped).toBe(1);
  });

  it("keeps an undated file rather than losing it from every slice", () => {
    // It would fall out of all five windows and leave no trace that it had
    // been seen. Capture is idempotent, so keeping it costs nothing.
    const { mapped, undated } = mapRecords(
      [entry({ server_modified: "whenever" })],
      DROPBOX,
    );
    expect(mapped).toBe(1);
    expect(undated).toBe(1);
  });

  it("refuses a path as an origin", () => {
    // `origin` is a URL in the model. Passing a path on would fail the whole
    // batch at capture, after the fetch had already been paid for.
    const { records } = mapRecords([entry()], {
      ...DROPBOX,
      originPath: "path_display",
    });
    expect(records[0].origin).toBeUndefined();
  });

  it("accepts a real URL as an origin", () => {
    const { records } = mapRecords(
      [entry({ link: "https://www.dropbox.com/s/abc/Contract.pdf" })],
      { ...DROPBOX, originPath: "link" },
    );
    expect(records[0].origin).toBe(
      "https://www.dropbox.com/s/abc/Contract.pdf",
    );
  });
});

describe("identifiers", () => {
  it("does not namespace an id that already names its system", () => {
    const { records } = mapRecords([mail({ id: "gmail:already" })], GMAIL);
    expect(records[0].externalId).toBe("gmail:already");
  });

  it("never lists the canonical id as one of its own aliases", () => {
    // The bug the permutation test caught in the reducer, reachable again
    // from here: a provider whose alias field repeats the id.
    const { records } = mapRecords([mail({ messageId: "18ef2c91a74b0033" })], {
      ...GMAIL,
      aliasPaths: ["messageId"],
    });
    expect(records[0].aliases).toEqual([]);
  });

  it("does not list the same alias twice", () => {
    const { records } = mapRecords([mail()], {
      ...GMAIL,
      aliasPaths: ["rfc822:messageId", "rfc822:messageId"],
    });
    expect(records[0].aliases).toEqual(["rfc822:<CADn9x@mail.gmail.com>"]);
  });

  it("gives every mapped identifier a namespace, as the model demands", () => {
    const { records } = mapRecords([mail(), entry()], {
      ...GMAIL,
      aliasPaths: ["rfc822:messageId", "dropbox-path:path_lower"],
    });
    for (const record of records) {
      for (const identifier of [record.externalId, ...record.aliases]) {
        expect(identifier).toMatch(/^[a-z0-9_-]+:.+/i);
      }
    }
  });
});

describe("the window on its own", () => {
  it("is open at both ends when neither bound is given", () => {
    expect(inWindow("2026-01-01T00:00:00.000Z", undefined, undefined)).toBe(
      true,
    );
  });

  it("applies one bound without the other", () => {
    expect(inWindow("2026-01-01T00:00:00.000Z", "2026-06-01T00:00:00.000Z", undefined)).toBe(false);
    expect(inWindow("2026-01-01T00:00:00.000Z", undefined, "2026-06-01T00:00:00.000Z")).toBe(true);
  });

  it("is not applied at all when no field was named", () => {
    // Bounds without a field to compare them to must not silently drop
    // everything — the queue always supplies bounds, even to Gmail, whose
    // fetch has already applied them server-side.
    const { mapped } = mapRecords([mail()], {
      ...GMAIL,
      from: "2020-01-01T00:00:00.000Z",
      to: "2020-01-02T00:00:00.000Z",
    });
    expect(mapped).toBe(1);
  });
});

describe("a batch", () => {
  it("reports every category so the counts add up", () => {
    const result = mapRecords(
      [
        entry(),
        entry({ id: "id:2", name: "b.pdf", server_modified: "2026-01-01T00:00:00Z" }),
        entry({ id: "id:3", name: "c.docx" }),
        entry({ id: "", name: "d.pdf" }),
      ],
      DROPBOX,
    );
    expect(result.mapped).toBe(1);
    expect(result.outsideWindow).toBe(1);
    expect(result.wrongType).toBe(1);
    expect(result.unidentified).toBe(1);
  });

  it("maps nothing from nothing", () => {
    const result = mapRecords([], DROPBOX);
    expect(result.records).toEqual([]);
    expect(result.mapped).toBe(0);
  });
});

describe("characters a document cannot hold", () => {
  const NUL = String.fromCharCode(0);
  const HIGH = String.fromCharCode(0xd800);
  const LOW = String.fromCharCode(0xdc00);

  it("removes a NUL from a body", () => {
    // The real case: one NUL inside a tracking URL failed a whole day of
    // Gmail, because jsonb rejects the batch, not the message.
    const { records, scrubbed } = mapRecords(
      [mail({ text: "click he" + NUL + "re" })],
      GMAIL,
    );
    expect(records[0].content).toBe("click here");
    expect(scrubbed).toBe(1);
  });

  it("removes an unpaired surrogate", () => {
    const { records } = mapRecords([mail({ subject: "hi" + HIGH + "there" })], GMAIL);
    expect(records[0].title).toBe("hithere");
  });

  it("keeps a real surrogate pair, which is an ordinary emoji", () => {
    const { records, scrubbed } = mapRecords(
      [mail({ subject: "done " + HIGH + LOW })],
      GMAIL,
    );
    expect(records[0].title).toBe("done " + HIGH + LOW);
    expect(scrubbed).toBe(0);
  });

  it("cleans the payload too, not only the fields read out of it", () => {
    const { records } = mapRecords([mail({ html: "<p>a" + NUL + "b</p>" })], GMAIL);
    const payload = records[0].payload as { html: string };
    expect(payload.html).toBe("<p>ab</p>");
  });

  it("cleans a key as well as a value", () => {
    const { records } = mapRecords([mail({ ["od" + NUL + "d"]: 1 })], GMAIL);
    expect(Object.keys(records[0].payload as object)).toContain("odd");
  });

  it("leaves a clean record entirely alone", () => {
    // The common case by far: no copying, and the count stays honest.
    const { records, scrubbed } = mapRecords([mail()], GMAIL);
    expect(scrubbed).toBe(0);
    expect(records[0].title).toBe("Hetzner invoice R0012845921");
  });
});
