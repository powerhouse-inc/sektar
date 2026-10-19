/**
 * The per-item placeholder.
 *
 * The thing worth testing is the raw-versus-text rule: a lone `$item.actions`
 * must hand over the list itself, and an attachment ref must come through
 * untouched, while `Hello $item.name` is a sentence.
 *
 * `.spec.ts` so codegen never claims the filename.
 */
import { describe, expect, it } from "vitest";
import {
  compileTemplate,
  hasPlaceholder,
  renderTemplate,
  renderText,
  valueAt,
} from "./template.js";

const item = {
  id: "18f3a",
  subject: "Invoice 7781",
  from: [{ address: "a@b.c", name: "A" }],
  actions: [{ type: "SET_NOTES", input: { notes: "x" } }],
  attachments: [{ data: "attachment://v1:abc" }],
  count: 0,
};

describe("reading a path", () => {
  it("walks dots and indexes", () => {
    expect(valueAt(item, "subject")).toBe("Invoice 7781");
    expect(valueAt(item, "from[0].address")).toBe("a@b.c");
    expect(valueAt(item, "from.0.name")).toBe("A");
  });

  it("answers undefined off the end rather than throwing", () => {
    expect(valueAt(item, "from[3].address")).toBeUndefined();
    expect(valueAt(item, "subject.length.x")).toBeUndefined();
    expect(valueAt(null, "a")).toBeUndefined();
  });
});

describe("rendering text", () => {
  it("hands over the raw value for a lone placeholder", () => {
    expect(renderText("$item.actions", item, 0)).toBe(item.actions);
    expect(renderText("  $item.attachments[0].data ", item, 0)).toBe(
      "attachment://v1:abc",
    );
    expect(renderText("$item", item, 0)).toBe(item);
    expect(renderText("$index", item, 4)).toBe(4);
    // Falsy-but-valid values are values.
    expect(renderText("$item.count", item, 0)).toBe(0);
  });

  it("interpolates as text otherwise", () => {
    expect(renderText("Re: $item.subject (#$index)", item, 2)).toBe(
      "Re: Invoice 7781 (#2)",
    );
    expect(renderText("from $item.from[0].name", item, 0)).toBe("from A");
    expect(renderText("$item.from", item, 0)).toBe(item.from);
    expect(renderText("list: $item.from", item, 0)).toBe(
      'list: [{"address":"a@b.c","name":"A"}]',
    );
  });

  it("renders a missing path as empty text, not the word undefined", () => {
    expect(renderText("x $item.nope y", item, 0)).toBe("x  y");
    expect(renderText("$item.nope", item, 0)).toBeUndefined();
  });

  it("keeps an escaped placeholder literal", () => {
    expect(renderText("costs \\$item.price", item, 0)).toBe("costs $item.price");
    expect(hasPlaceholder("plain")).toBe(false);
    expect(hasPlaceholder("$item.id")).toBe(true);
  });

  it("does not mistake a dollar amount for a placeholder", () => {
    expect(renderText("$12 and $items", item, 0)).toBe("$12 and $items");
  });
});

describe("rendering a structure", () => {
  it("renders every string inside, leaving the shape alone", () => {
    expect(
      renderTemplate(
        {
          type: "SET_TITLE",
          input: { title: "$item.subject", refs: ["$item.attachments[0].data"], n: 1 },
        },
        item,
        0,
      ),
    ).toEqual({
      type: "SET_TITLE",
      input: { title: "Invoice 7781", refs: ["attachment://v1:abc"], n: 1 },
    });
  });
});

describe("compiling a prop", () => {
  it("is nothing for an empty prop", () => {
    expect(compileTemplate(undefined, "x")).toBeUndefined();
    expect(compileTemplate("   ", "x")).toBeUndefined();
  });

  it("parses JSON text once and renders it per item", () => {
    const template = compileTemplate(
      '[{ "type": "SET_NOTES", "input": { "notes": "$item.subject" } }]',
      "Actions",
    );
    expect(template?.(item, 0)).toEqual([
      { type: "SET_NOTES", input: { notes: "Invoice 7781" } },
    ]);
  });

  it("names the prop when the JSON is broken", () => {
    expect(() => compileTemplate('[{ "type": ', "Actions on create")).toThrow(
      /"Actions on create" looks like JSON/,
    );
  });

  it("takes an already parsed structure as it is", () => {
    const template = compileTemplate({ a: "$item.id" }, "x");
    expect(template?.(item, 0)).toEqual({ a: "18f3a" });
  });
});
