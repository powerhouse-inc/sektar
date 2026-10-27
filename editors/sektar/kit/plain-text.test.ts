import { describe, expect, it } from "vitest";
import { isPlainText } from "./mail.js";

describe("isPlainText", () => {
  it("takes text/plain with any charset, and nothing else", () => {
    expect(isPlainText({ fileName: "a.bin", mimeType: "text/plain" })).toBe(
      true,
    );
    expect(
      isPlainText({ fileName: "a", mimeType: "Text/Plain; charset=utf-8" }),
    ).toBe(true);
    expect(isPlainText({ fileName: "a.txt", mimeType: "text/calendar" })).toBe(
      false,
    );
    expect(
      isPlainText({ fileName: "a.txt", mimeType: "application/pdf" }),
    ).toBe(false);
  });

  it("reads a .txt name only when no type is known", () => {
    expect(isPlainText({ fileName: "Notes.TXT", mimeType: null })).toBe(true);
    expect(isPlainText({ fileName: "notes.md", mimeType: null })).toBe(false);
  });

  it("lets the type the file is served with win over the declared one", () => {
    expect(
      isPlainText(
        { fileName: "a.dat", mimeType: "application/octet-stream" },
        "text/plain",
      ),
    ).toBe(true);
    expect(
      isPlainText({ fileName: "a.txt", mimeType: "text/plain" }, "image/png"),
    ).toBe(false);
  });
});
