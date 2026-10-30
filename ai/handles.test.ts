import { beforeEach, describe, expect, it } from "vitest";
import {
  fileForHandle,
  forgetHandles,
  handleFor,
  isFileRef,
  withoutRefs,
  type HandledFile,
} from "./handles.js";

const HASH = "a".repeat(64);
const REF = `attachment://v1:${HASH}` as const;
const OTHER = `attachment://v1:${"b".repeat(64)}` as const;

const file = (over: Partial<HandledFile> = {}): HandledFile => ({
  documentId: "invoice-1",
  ref: REF,
  fileName: "receipt.pdf",
  mimeType: "application/pdf",
  sizeBytes: 1200,
  ...over,
});

beforeEach(() => {
  forgetHandles();
});

describe("a file reference", () => {
  it("has exactly 64 hex characters", () => {
    expect(isFileRef(REF)).toBe(true);
    expect(isFileRef(`attachment://v12:${HASH}`)).toBe(true);
  });

  // The 78 characters are what the live model made of a 64-character hash.
  it.each([
    ["too short", `attachment://v1:${"a".repeat(63)}`],
    ["too long", `attachment://v1:${"a".repeat(65)}`],
    ["the live garbling", `attachment://v1:${"a".repeat(78)}`],
    ["not hex", `attachment://v1:${"g".repeat(64)}`],
    ["upper case, which the store refuses", `attachment://v1:${"A".repeat(64)}`],
    ["a trailing line", `${REF}\n`],
    ["no version", `attachment://${HASH}`],
    ["a bare hash", HASH],
  ])("is refused when it is %s", (_, value) => {
    expect(isFileRef(value)).toBe(false);
  });
});

describe("the handle table", () => {
  it("hands out short handles", () => {
    expect(handleFor(file())).toBe("file-1");
    expect(handleFor(file({ ref: OTHER }))).toBe("file-2");
  });

  it("gives the same ref on the same document the same handle", () => {
    expect(handleFor(file())).toBe(handleFor(file()));
  });

  it("gives the same ref on another document its own handle", () => {
    const here = handleFor(file());
    const there = handleFor(file({ documentId: "mail-1" }));
    expect(there).not.toBe(here);
    expect(fileForHandle(here).documentId).toBe("invoice-1");
    expect(fileForHandle(there).documentId).toBe("mail-1");
  });

  it("gives back the real reference and what is known of the file", () => {
    expect(fileForHandle(handleFor(file()))).toEqual(file());
  });

  it("adds to what it knows, and forgets none of it", () => {
    const bare = {
      fileName: null,
      mimeType: null,
      sizeBytes: null,
    };
    const handle = handleFor(file(bare));
    expect(fileForHandle(handle).fileName).toBeNull();
    expect(handleFor(file())).toBe(handle);
    expect(fileForHandle(handle)).toEqual(file());
    expect(handleFor(file(bare))).toBe(handle);
    expect(fileForHandle(handle)).toEqual(file());
  });

  it("keeps a saved image apart from the same ref on a document", () => {
    expect(handleFor(file({ documentId: null }))).not.toBe(handleFor(file()));
  });

  it("gives a damaged reference no handle", () => {
    expect(() =>
      handleFor(file({ ref: `attachment://v1:${"a".repeat(78)}` })),
    ).toThrow(/damaged/);
    expect(() => fileForHandle("file-1")).toThrow(/not a file handle/);
  });

  it("does not take an unknown handle for an empty result", () => {
    expect(() => fileForHandle("file-9")).toThrow(
      /file-9 is not a file handle this chat knows.*list the document's files again/,
    );
  });

  it("does not repeat a reference typed in place of a handle", () => {
    expect(() => fileForHandle(REF)).toThrow(/^That is not a file handle/);
  });
});

describe("withoutRefs", () => {
  it("takes out a reference, garbled or whole, and a bare hash", () => {
    expect(withoutRefs(`Forbidden: ${REF}.`)).toBe(
      "Forbidden: [a file reference]",
    );
    expect(withoutRefs(`No ${HASH} here`)).toBe("No [a file reference] here");
    expect(withoutRefs(`No ${"a".repeat(78)} here`)).toBe(
      "No [a file reference] here",
    );
  });

  it("leaves other text alone", () => {
    expect(withoutRefs("invoice-1 is void, file-3 too")).toBe(
      "invoice-1 is void, file-3 too",
    );
  });
});
