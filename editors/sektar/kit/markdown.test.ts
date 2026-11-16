import { describe, expect, it } from "vitest";
import {
  inlineText,
  pageCount,
  parseInline,
  parseMarkdown,
  safeHref,
  type Block,
  type Inline,
} from "./markdown.js";

const text = (value: string): Inline => ({ kind: "text", text: value });

it.each([">".repeat(3000), "> ".repeat(5000), "- ".repeat(5000)])(
  "keeps deeply nested input readable as text beyond the nesting limit",
  (markers) => {
    const blocks = parseMarkdown(`${markers} tail text`);
    expect(blocks.map(words).join("\n")).toContain("tail text");
    expect(blocks.map(words).join("\n")).toContain(markers.slice(0, 100));
  },
);

/** The words of a block, to check what a reader would see without spelling out the tree. */
function words(block: Block): string {
  switch (block.kind) {
    case "heading":
    case "paragraph":
      return inlineText(block.children);
    case "code":
      return block.text;
    case "list":
      return block.items.map((item) => item.map(words).join(" / ")).join(" | ");
    case "quote":
      return block.children.map(words).join(" / ");
    case "table":
      return [block.head, ...block.rows]
        .map((row) => row.map(inlineText).join(" ; "))
        .join(" | ");
    case "rule":
      return "---";
    case "page":
      return `page ${block.page}`;
    default: {
      const _exhaustive: never = block;
      return _exhaustive;
    }
  }
}

describe("a converted PDF's Markdown", () => {
  // The dialect the converter writes: docture's exportDocument("markdown").
  const converted = [
    "<!-- page: 1 -->",
    "",
    "# Invoice INV\\-2026\\-1042",
    "",
    "**Northwind Studio**",
    "Issued: 10 November 2026",
    "",
    "| Description | Amount |",
    "| --- | --- |",
    "| Design services<br>Phase 1 | $1,200.00 |",
    "| Research \\| discovery | $300.00 |",
    "",
    "<!-- page: 2 -->",
    "",
    "1. Pay within 30 days",
    "2. Quote the reference",
    "",
    "See [our terms](https://northwind.example/terms).",
  ].join("\n");

  it("reads pages, headings, tables, lists and links in order", () => {
    const blocks = parseMarkdown(converted);
    expect(blocks.map((block) => block.kind)).toEqual([
      "page",
      "heading",
      "paragraph",
      "table",
      "page",
      "list",
      "paragraph",
    ]);
    expect(pageCount(blocks)).toBe(2);
    expect(words(blocks[1])).toBe("Invoice INV-2026-1042");
    expect(words(blocks[5])).toBe("Pay within 30 days | Quote the reference");
  });

  it("keeps a table's cells apart, with an escaped pipe inside one and a break for <br>", () => {
    const table = parseMarkdown(converted)[3];
    if (table.kind !== "table") throw new Error("not a table");
    expect(table.head.map(inlineText)).toEqual(["Description", "Amount"]);
    expect(table.rows).toHaveLength(2);
    expect(table.rows[0][0]).toEqual([
      text("Design services"),
      { kind: "break" },
      text("Phase 1"),
    ]);
    expect(inlineText(table.rows[1][0])).toBe("Research | discovery");
    expect(inlineText(table.rows[1][1])).toBe("$300.00");
  });

  it("reads the characters the converter escapes as themselves", () => {
    const [paragraph] = parseMarkdown(
      "2026\\. A \\*starred\\* note \\<b\\> with 5 &amp;lt; 6 and R&amp;D \\#1",
    );
    expect(words(paragraph)).toBe(
      "2026. A *starred* note <b> with 5 &lt; 6 and R&D #1",
    );
  });

  it("keeps the hashes a heading ends with when they are escaped", () => {
    expect(words(parseMarkdown("## C \\#")[0])).toBe("C #");
    expect(words(parseMarkdown("## Closed ##")[0])).toBe("Closed");
  });

  it("fills a short row and drops cells past the header's", () => {
    const [table] = parseMarkdown("| a | b |\n| - | - |\n| 1 |\n| 1 | 2 | 3 |");
    if (table.kind !== "table") throw new Error("not a table");
    expect(table.rows.map((row) => row.map(inlineText))).toEqual([
      ["1", ""],
      ["1", "2"],
    ]);
  });

  it("reads column alignment from the delimiter row", () => {
    const [table] = parseMarkdown(
      "| a | b | c |\n| :-- | :-: | --: |\n| 1 | 2 | 3 |",
    );
    if (table.kind !== "table") throw new Error("not a table");
    expect(table.align).toEqual(["left", "center", "right"]);
  });

  it("reads a fenced block as it is written, markup and all", () => {
    const [code, after] = parseMarkdown(
      "````text\n```\n<script>alert(1)</script>\n**not bold**\n```\n````\n\nafter",
    );
    expect(code).toEqual({
      kind: "code",
      language: "text",
      text: "```\n<script>alert(1)</script>\n**not bold**\n```",
    });
    expect(words(after)).toBe("after");
  });

  it("leaves a comment that is not a page marker out", () => {
    const blocks = parseMarkdown(
      "before\n\n<!-- a note\nover two lines -->\n\nafter",
    );
    expect(blocks.map(words)).toEqual(["before", "after"]);
  });
});

describe("everyday Markdown", () => {
  it("reads emphasis, strong, both, strike and code", () => {
    expect(parseInline("a *b* **c** ***d*** ~~e~~ `f`")).toEqual([
      text("a "),
      { kind: "emphasis", children: [text("b")] },
      text(" "),
      { kind: "strong", children: [text("c")] },
      text(" "),
      {
        kind: "strong",
        children: [{ kind: "emphasis", children: [text("d")] }],
      },
      text(" "),
      { kind: "strike", children: [text("e")] },
      text(" "),
      { kind: "code", text: "f" },
    ]);
  });

  it("nests emphasis inside strong and the other way round", () => {
    expect(parseInline("**a *b* c**")).toEqual([
      {
        kind: "strong",
        children: [
          text("a "),
          { kind: "emphasis", children: [text("b")] },
          text(" c"),
        ],
      },
    ]);
    expect(inlineText(parseInline("*a **b** c*"))).toBe("a b c");
  });

  it("leaves snake_case, lone asterisks and arithmetic alone", () => {
    expect(parseInline("file_name_v2 and 2 * 3 * 4 and *open")).toEqual([
      text("file_name_v2 and 2 * 3 * 4 and *open"),
    ]);
  });

  it("does not read markup inside a code span", () => {
    expect(parseInline("`**a** [b](https://x.example)`")).toEqual([
      { kind: "code", text: "**a** [b](https://x.example)" },
    ]);
  });

  it("breaks a line on two trailing spaces or a backslash, and joins the rest", () => {
    expect(parseInline("one  \ntwo\\\nthree\nfour")).toEqual([
      text("one"),
      { kind: "break" },
      text("two"),
      { kind: "break" },
      text("three\nfour"),
    ]);
  });

  it("reads nested and loose lists", () => {
    const [list] = parseMarkdown(
      [
        "- one",
        "  - inner a",
        "  - inner b",
        "- two",
        "",
        "  still two",
        "- three",
      ].join("\n"),
    );
    if (list.kind !== "list") throw new Error("not a list");
    expect(list.ordered).toBe(false);
    expect(list.items).toHaveLength(3);
    expect(list.items[0].map((block) => block.kind)).toEqual([
      "paragraph",
      "list",
    ]);
    expect(words(list.items[0][1])).toBe("inner a | inner b");
    expect(list.items[1].map(words)).toEqual(["two", "still two"]);
  });

  it("keeps an item's continuation line that lost its indent", () => {
    const [list, after] = parseMarkdown(
      "- first line\nsecond line\n- next\n\nafter",
    );
    expect(words(list)).toBe("first line\nsecond line | next");
    expect(words(after)).toBe("after");
  });

  it("starts an ordered list where it says and ends it at another kind of list", () => {
    const blocks = parseMarkdown("3) three\n4) four\n- bullet");
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toMatchObject({ kind: "list", ordered: true, start: 3 });
    expect(blocks[1]).toMatchObject({ kind: "list", ordered: false });
  });

  it("does not let a year at the start of a line cut a paragraph in two", () => {
    const blocks = parseMarkdown("Founded in\n2019. Still here.");
    expect(blocks).toHaveLength(1);
    expect(words(blocks[0])).toBe("Founded in\n2019. Still here.");
  });

  it("reads quotes, rules and underlined headings", () => {
    const blocks = parseMarkdown(
      "> quoted\n> more\n\n---\n\nTitle\n=====\n\nSub\n---",
    );
    expect(blocks.map((block) => block.kind)).toEqual([
      "quote",
      "rule",
      "heading",
      "heading",
    ]);
    expect(words(blocks[0])).toBe("quoted\nmore");
    expect(blocks[2]).toMatchObject({ level: 1 });
    expect(blocks[3]).toMatchObject({ level: 2 });
  });

  it("reads Windows line endings", () => {
    expect(parseMarkdown("# a\r\n\r\nb\r\n").map(words)).toEqual(["a", "b"]);
  });
});

describe("what a preview may open or run", () => {
  it("opens web, mail and phone addresses only", () => {
    expect(safeHref("https://sektar.io/docs")).toBe("https://sektar.io/docs");
    expect(safeHref(" mailto:a@b.example ")).toBe("mailto:a@b.example");
    expect(safeHref("tel:+3212345")).toBe("tel:+3212345");
    for (const refused of [
      "javascript:alert(1)",
      "JaVaScRiPt:alert(1)",
      "java\nscript:alert(1)",
      "data:text/html,<script>alert(1)</script>",
      "vbscript:x",
      "file:///etc/passwd",
      "//evil.example",
      "/relative",
      "#anchor",
      "https://a.example/ b",
      "",
    ]) {
      expect(safeHref(refused), refused).toBeNull();
    }
  });

  it("keeps the words of a link it will not open", () => {
    expect(parseInline("[click **me**](javascript:alert(1)) now")).toEqual([
      text("click "),
      { kind: "strong", children: [text("me")] },
      text(" now"),
    ]);
  });

  it("reads a target in angle brackets and one with parentheses", () => {
    expect(
      parseInline("[a](<https://x.example/a%20b>) [b](https://x.example/(c))"),
    ).toEqual([
      { kind: "link", href: "https://x.example/a%20b", children: [text("a")] },
      text(" "),
      { kind: "link", href: "https://x.example/(c)", children: [text("b")] },
    ]);
  });

  it("reads an autolink and an address in angle brackets", () => {
    expect(parseInline("<https://x.example> <me@x.example>")).toEqual([
      {
        kind: "link",
        href: "https://x.example",
        children: [text("https://x.example")],
      },
      text(" "),
      {
        kind: "link",
        href: "mailto:me@x.example",
        children: [text("me@x.example")],
      },
    ]);
  });

  it("names an image by its target and alt text, and loads nothing", () => {
    expect(parseInline("![The **chart**](assets/chart.png)")).toEqual([
      { kind: "image", src: "assets/chart.png", alt: "The chart" },
    ]);
  });

  it("shows raw HTML as the text it is", () => {
    const blocks = parseMarkdown(
      '<script>alert(1)</script>\n\n<img src=x onerror="alert(1)">\n\n<a href="javascript:alert(1)">x</a>',
    );
    expect(blocks.map((block) => block.kind)).toEqual([
      "paragraph",
      "paragraph",
      "paragraph",
    ]);
    expect(blocks.map(words)).toEqual([
      "<script>alert(1)</script>",
      '<img src=x onerror="alert(1)">',
      '<a href="javascript:alert(1)">x</a>',
    ]);
  });

  it("decodes entities to characters, never to markup", () => {
    expect(
      inlineText(
        parseInline(
          "&lt;b&gt; &#60;i&#62; &#x3C;u&#x3E; &copy; &unknown; &#0;",
        ),
      ),
    ).toBe("<b> <i> <u> © &unknown; �");
  });
});

describe("text that is not well formed", () => {
  it("reads unclosed markup as text", () => {
    expect(inlineText(parseInline("**a [b](c `d"))).toBe("**a [b](c `d");
    expect(parseMarkdown("```\nnever closed").map(words)).toEqual([
      "never closed",
    ]);
  });

  it("reads long runs of stray delimiters as text, without stalling", () => {
    const started = performance.now();
    for (const stray of [
      "*a ".repeat(20_000),
      "_a ".repeat(20_000),
      "[".repeat(20_000),
      "[x](<".repeat(5_000),
      '[x](y "'.repeat(5_000),
    ]) {
      // Compared as a boolean: a mismatch would print megabytes.
      expect(inlineText(parseInline(stray)) === stray).toBe(true);
    }
    parseInline("`a ``b ```c ".repeat(5_000));
    parseMarkdown("- a\n".repeat(20_000));
    parseMarkdown("| a | b |\n".repeat(20_000));
    expect(performance.now() - started).toBeLessThan(3_000);
  });

  it("reads an empty document as nothing", () => {
    expect(parseMarkdown("")).toEqual([]);
    expect(parseMarkdown("\n\n  \n")).toEqual([]);
  });
});

// What the conversion service answered for a one-page invoice on the live
// host (2026-11-10): Docture's Markdown as it really is.
const LIVE_INVOICE = [
  "<!-- page: 1 -->",
  "",
  "# Larkspur Sample Supply Co. INVOICE",
  "",
  "400 Example Avenue, Springfield, ST 00000",
  "",
  "billing@larkspur.example",
  "",
  "Bill To:",
  "",
  "Bluebird Sample Bakery LLC",
  "17 Sample Road",
  "",
  "\\# Description SKU Qty Unit Price Amount",
  "",
  "| 1 | Copy paper A4, 80 g, box of 5 reams | PAP-A4-80 | 12 | $24.90 | $298.80 |",
  "| --- | --- | --- | --- | --- | --- |",
  "| 2 | Ballpoint pens, blue (pack of 50) | PEN-BL-50 | 4 | $11.25 | $45.00 |",
  "|  |  |  |  | Subtotal | $664.17 |",
  "|  |  |  | Sales Tax (8%) |  | $53.13 |",
  "",
  "Payment terms: Net 30. Thank you for your business.",
  "",
].join("\n");

describe("a document the converter really wrote", () => {
  const blocks = parseMarkdown(LIVE_INVOICE);

  it("reads an escaped # line as text and keeps every cell of the table, empty ones included", () => {
    expect(
      blocks.filter((block) => block.kind === "heading").map(words),
    ).toEqual(["Larkspur Sample Supply Co. INVOICE"]);
    expect(blocks.map(words)).toContain(
      "# Description SKU Qty Unit Price Amount",
    );
    const table = blocks.find((block) => block.kind === "table");
    if (table?.kind !== "table") throw new Error("expected a table");
    expect(table.head.map(inlineText)).toEqual([
      "1",
      "Copy paper A4, 80 g, box of 5 reams",
      "PAP-A4-80",
      "12",
      "$24.90",
      "$298.80",
    ]);
    expect(table.rows.map((row) => row.map(inlineText))).toEqual([
      [
        "2",
        "Ballpoint pens, blue (pack of 50)",
        "PEN-BL-50",
        "4",
        "$11.25",
        "$45.00",
      ],
      ["", "", "", "", "Subtotal", "$664.17"],
      ["", "", "", "Sales Tax (8%)", "", "$53.13"],
    ]);
  });
});
