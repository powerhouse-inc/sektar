// Markdown as a tree, for the preview of converted PDFs.
//
// The converter writes a small, regular Markdown: a page marker
// (`<!-- page: 3 -->`) before each page, headings, paragraphs, lists, fenced
// code, pipe tables (a `<br>` for a line break inside a cell), links and
// images. This reads that dialect and the everyday Markdown around it:
// emphasis, block quotes, rules, nested lists, autolinks.
//
// It never produces HTML. Raw HTML in the source stays text, `<br>` is the
// one tag read (as a line break), and a link keeps its target only when it is
// an http(s), mailto or tel address; components/Markdown.tsx turns the tree
// into React elements. Anything this does not understand is shown as the
// text it is, and the raw view always has the exact source.

export type Inline =
  | { kind: "text"; text: string }
  | { kind: "strong"; children: Inline[] }
  | { kind: "emphasis"; children: Inline[] }
  | { kind: "strike"; children: Inline[] }
  | { kind: "code"; text: string }
  | { kind: "link"; href: string; children: Inline[] }
  | { kind: "image"; src: string; alt: string }
  | { kind: "break" };

export type Align = "left" | "center" | "right" | null;

export type Block =
  | { kind: "heading"; level: 1 | 2 | 3 | 4 | 5 | 6; children: Inline[] }
  | { kind: "paragraph"; children: Inline[] }
  | { kind: "code"; text: string; language: string | null }
  | { kind: "list"; ordered: boolean; start: number; items: Block[][] }
  | { kind: "quote"; children: Block[] }
  | { kind: "table"; align: Align[]; head: Inline[][]; rows: Inline[][][] }
  | { kind: "rule" }
  /** Where a page of the source PDF begins */
  | { kind: "page"; page: number };

/* ---------------------------------------------------------------- inline */

const PUNCTUATION = /[!-/:-@[-`{-~]/;
const ESCAPED = /\\([!-/:-@[-`{-~])/g;
const ALPHANUMERIC = /[\p{L}\p{N}]/u;

const ENTITIES: Partial<Record<string, string>> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  copy: "©",
  reg: "®",
  trade: "™",
  hellip: "…",
  mdash: "—",
  ndash: "–",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
  bull: "•",
  middot: "·",
  deg: "°",
  times: "×",
  euro: "€",
  pound: "£",
  yen: "¥",
  sect: "§",
};

const ENTITY =
  /&(?:#[xX]([0-9a-fA-F]{1,6})|#([0-9]{1,7})|([a-zA-Z][a-zA-Z0-9]{1,31}));/y;
const BREAK_TAG = /<br\s*\/?>/iy;
const AUTOLINK =
  /<((?:https?:\/\/|mailto:)[^\s<>]+|[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+)>/iy;

/** How far a link's text, its target or its title may run. Past it the brackets are text. */
const LINK_SPAN = 2000;

/** What `pattern` (a sticky expression) matches exactly at `at`, if anything. */
function matchAt(
  pattern: RegExp,
  text: string,
  at: number,
): RegExpExecArray | null {
  pattern.lastIndex = at;
  return pattern.exec(text);
}

/** The character the entity at `at` stands for, and how long the entity is. */
function entityAt(
  text: string,
  at: number,
): { char: string; length: number } | null {
  const match = matchAt(ENTITY, text, at);
  if (!match) return null;
  const length = match[0].length;
  // Only one of the three groups matched.
  const hex = match.at(1);
  const decimal = match.at(2);
  const name = match.at(3);
  if (name !== undefined) {
    const char = ENTITIES[name];
    return char === undefined ? null : { char, length };
  }
  const code = hex !== undefined ? parseInt(hex, 16) : Number(decimal);
  const valid =
    code > 0 && code <= 0x10ffff && (code < 0xd800 || code > 0xdfff);
  return { char: valid ? String.fromCodePoint(code) : "�", length };
}

/**
 * A link target a preview may open: a web, mail or phone address. Relative
 * targets have nowhere to go from a preview, and every other scheme
 * (javascript:, data:, file:) is refused.
 */
export function safeHref(href: string): string | null {
  const target = href.trim();
  // No white space and no control character anywhere in the target.
  return /^(?:https?:\/\/|mailto:|tel:)[^\s\p{Cc}]+$/iu.test(target)
    ? target
    : null;
}

function runLength(text: string, at: number, char: string): number {
  let end = at;
  while (text[end] === char) end++;
  return end - at;
}

/** Where the code span opened at `at` ends (past its closing run), or -1. */
function codeSpanEnd(text: string, at: number): number {
  const run = runLength(text, at, "`");
  let from = at + run;
  while (from < text.length) {
    const next = text.indexOf("`", from);
    if (next === -1) return -1;
    const closing = runLength(text, next, "`");
    if (closing === run) return next + run;
    from = next + closing;
  }
  return -1;
}

/** Past the escape or code span at `at`, or -1 when `at` starts neither. */
function skipOpaque(text: string, at: number): number {
  if (text[at] === "\\") return at + 2;
  if (text[at] !== "`") return -1;
  const end = codeSpanEnd(text, at);
  return end === -1 ? at + runLength(text, at, "`") : end;
}

/**
 * Where the delimiter run that closes one opened before `from` starts: the
 * next run of exactly `length` `char`s with text right before it. Escapes,
 * code spans and runs of another length (an emphasis inside) are passed over.
 */
function closerOf(
  text: string,
  from: number,
  char: string,
  length: number,
): number {
  let at = from;
  while (at < text.length) {
    const past = skipOpaque(text, at);
    if (past !== -1) {
      at = past;
      continue;
    }
    if (text[at] !== char) {
      at++;
      continue;
    }
    const run = runLength(text, at, char);
    const before = text[at - 1] ?? " ";
    const after = text[at + run] ?? " ";
    const closes =
      run === length &&
      at > from &&
      !/\s/.test(before) &&
      (char !== "_" || !ALPHANUMERIC.test(after));
    if (closes) return at;
    at += run;
  }
  return -1;
}

/** The index of the `]` that closes the `[` at `open`, or -1. */
function labelEnd(text: string, open: number): number {
  const limit = Math.min(text.length, open + LINK_SPAN);
  let depth = 0;
  let at = open;
  while (at < limit) {
    const past = skipOpaque(text, at);
    if (past !== -1) {
      at = past;
      continue;
    }
    if (text[at] === "[") depth++;
    if (text[at] === "]" && --depth === 0) return at;
    at++;
  }
  return -1;
}

const skipSpace = (text: string, at: number) => {
  let end = at;
  while (text[end] === " " || text[end] === "\n") end++;
  return end;
};

/**
 * The `(destination "title")` at `open`: its destination and where it ends
 * (past the closing parenthesis), or null when there is none.
 */
function destinationAt(
  text: string,
  open: number,
): { destination: string; end: number } | null {
  if (text[open] !== "(") return null;
  const limit = Math.min(text.length, open + LINK_SPAN);
  let at = skipSpace(text, open + 1);
  let destination: string;
  if (text[at] === "<") {
    const close = text.slice(at + 1, limit).search(/[>\n]/);
    if (close === -1 || text[at + 1 + close] !== ">") return null;
    destination = text.slice(at + 1, at + 1 + close);
    at += close + 2;
  } else {
    const start = at;
    let depth = 0;
    while (at < limit) {
      const here = text[at];
      if (here === "\\") {
        at += 2;
        continue;
      }
      if (/\s/.test(here) || (here === ")" && depth === 0)) break;
      if (here === "(") depth++;
      if (here === ")") depth--;
      at++;
    }
    destination = text.slice(start, at);
  }
  at = skipSpace(text, at);
  const quote = text[at];
  if (quote === '"' || quote === "'") {
    const close = text.slice(at + 1, limit).indexOf(quote);
    if (close === -1) return null;
    at = skipSpace(text, at + close + 2);
  }
  if (text[at] !== ")") return null;
  return { destination: destination.replace(ESCAPED, "$1"), end: at + 1 };
}

/** The words of inline content, without its markup. */
export function inlineText(nodes: readonly Inline[]): string {
  return nodes
    .map((node) => {
      switch (node.kind) {
        case "text":
        case "code":
          return node.text;
        case "image":
          return node.alt;
        case "break":
          return "\n";
        case "strong":
        case "emphasis":
        case "strike":
        case "link":
          return inlineText(node.children);
        default: {
          const _exhaustive: never = node;
          return _exhaustive;
        }
      }
    })
    .join("");
}

export function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  // Plain text is taken from `text` in runs, never a character at a time: a
  // page of prose is one long paragraph, and it must read in one pass.
  let chunks: string[] = [];
  let plainFrom = 0;
  /** Takes the plain run that ends at `end`, without its last `drop` characters. */
  const take = (end: number, drop = 0) => {
    if (end - drop > plainFrom) chunks.push(text.slice(plainFrom, end - drop));
  };
  const flush = () => {
    if (chunks.length > 0) out.push({ kind: "text", text: chunks.join("") });
    chunks = [];
  };
  // Where a delimiter was last found to have no closer: every later one of
  // its kind has none either, so a line of stray asterisks is read once.
  const unclosedFrom = new Map<string, number>();

  let at = 0;
  /** Ends the plain run at `at`, emits `node` and carries on at `next`. */
  const emit = (node: Inline, next: number) => {
    take(at);
    flush();
    out.push(node);
    at = plainFrom = next;
  };
  /** Ends the plain run at `at`, adds `literal` to the text and carries on at `next`. */
  const write = (literal: string, next: number) => {
    take(at);
    chunks.push(literal);
    at = plainFrom = next;
  };

  while (at < text.length) {
    const here = text[at];

    if (here === "\\") {
      const next = text.at(at + 1);
      if (next === "\n") emit({ kind: "break" }, at + 2);
      else if (next !== undefined && PUNCTUATION.test(next))
        write(next, at + 2);
      else at++;
      continue;
    }

    if (here === "\n") {
      // Two spaces before the line end ask for a break; a bare line end is a space.
      let blanks = 0;
      while (
        at - blanks > plainFrom &&
        (text[at - blanks - 1] === " " || text[at - blanks - 1] === "\t")
      ) {
        blanks++;
      }
      const hard = blanks >= 2 && !text.slice(at - blanks, at).includes("\t");
      take(at, blanks);
      plainFrom = at + 1;
      if (hard) {
        flush();
        out.push({ kind: "break" });
      } else {
        chunks.push("\n");
      }
      at++;
      continue;
    }

    if (here === "`") {
      const run = runLength(text, at, "`");
      const end = codeSpanEnd(text, at);
      if (end === -1) {
        at += run;
        continue;
      }
      let code = text.slice(at + run, end - run).replace(/\n/g, " ");
      if (code.startsWith(" ") && code.endsWith(" ") && code.trim() !== "") {
        code = code.slice(1, -1);
      }
      emit({ kind: "code", text: code }, end);
      continue;
    }

    if (here === "&") {
      const entity = entityAt(text, at);
      if (entity) {
        write(entity.char, at + entity.length);
        continue;
      }
    }

    if (here === "<") {
      const tag = matchAt(BREAK_TAG, text, at);
      if (tag) {
        emit({ kind: "break" }, at + tag[0].length);
        continue;
      }
      const auto = matchAt(AUTOLINK, text, at);
      if (auto) {
        const shown = auto[1];
        const href = safeHref(
          /^[a-z][a-z0-9+.-]*:/i.test(shown) ? shown : `mailto:${shown}`,
        );
        if (href) {
          emit(
            { kind: "link", href, children: [{ kind: "text", text: shown }] },
            at + auto[0].length,
          );
        } else {
          write(shown, at + auto[0].length);
        }
        continue;
      }
    }

    if (here === "[" || (here === "!" && text[at + 1] === "[")) {
      const image = here === "!";
      const open = image ? at + 1 : at;
      const close = labelEnd(text, open);
      const target = close === -1 ? null : destinationAt(text, close + 1);
      if (target) {
        const label = parseInline(text.slice(open + 1, close));
        const href = image ? null : safeHref(target.destination);
        if (image) {
          emit(
            { kind: "image", src: target.destination, alt: inlineText(label) },
            target.end,
          );
        } else if (href) {
          emit({ kind: "link", href, children: label }, target.end);
        } else {
          // A target that may not be opened leaves its words as they are.
          take(at);
          flush();
          out.push(...label);
          at = plainFrom = target.end;
        }
        continue;
      }
    }

    if (here === "*" || here === "_" || here === "~") {
      const run = runLength(text, at, here);
      const length = here === "~" ? 2 : run;
      const kind = `${here}${length}`;
      const before = text[at - 1] ?? " ";
      const after = text[at + run] ?? " ";
      const opens =
        run === length &&
        length <= 3 &&
        !/\s/.test(after) &&
        (here !== "_" || !ALPHANUMERIC.test(before)) &&
        at < (unclosedFrom.get(kind) ?? Infinity);
      const close = opens ? closerOf(text, at + run, here, length) : -1;
      if (close === -1) {
        if (opens) unclosedFrom.set(kind, at);
        at += run;
        continue;
      }
      const inner = parseInline(text.slice(at + run, close));
      const node: Inline =
        here === "~"
          ? { kind: "strike", children: inner }
          : length === 1
            ? { kind: "emphasis", children: inner }
            : length === 2
              ? { kind: "strong", children: inner }
              : {
                  kind: "strong",
                  children: [{ kind: "emphasis", children: inner }],
                };
      emit(node, close + length);
      continue;
    }

    at++;
  }
  take(at);
  flush();
  return out;
}

/* ----------------------------------------------------------------- blocks */

const PAGE_MARKER = /^ {0,3}<!--\s*page:?\s*(\d+)\s*-->\s*$/i;
const COMMENT_OPEN = /^ {0,3}<!--/;
const FENCE = /^ {0,3}(`{3,}|~{3,})\s*([^`\s]*)[^`]*$/;
const HEADING = /^ {0,3}(#{1,6})(?:[ \t]+(.*?))?(?:[ \t]+#+)?[ \t]*$/;
const SETEXT = /^ {0,3}(=+|-+)[ \t]*$/;
const RULE = /^ {0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/;
const QUOTE = /^ {0,3}>[ \t]?/;
const ITEM = /^( {0,3})([-+*]|\d{1,9}[.)])(?:([ \t]+)(.*)|[ \t]*)$/;
const DELIMITER_CELL = /^:?-+:?$/;
const LEVELS = [1, 2, 3, 4, 5, 6] as const;

const isBlank = (line: string) => line.trim() === "";

/** A table row's cells: split on pipes that are not escaped, without the outer pipes. */
function cellsOf(line: string): string[] {
  const cells: string[] = [];
  let cell = "";
  for (let at = 0; at < line.length; at++) {
    const here = line[at];
    if (here === "\\" && at + 1 < line.length) {
      cell += here + line[at + 1];
      at++;
    } else if (here === "|") {
      cells.push(cell);
      cell = "";
    } else {
      cell += here;
    }
  }
  cells.push(cell);
  if (cells[0].trim() === "") cells.shift();
  if (cells.length > 0 && cells[cells.length - 1].trim() === "") cells.pop();
  return cells.map((text) => text.trim());
}

/** The alignments a delimiter row gives, or null when the line is not one. */
function alignmentsOf(line: string): Align[] | null {
  if (!line.includes("-")) return null;
  const cells = cellsOf(line);
  if (cells.length === 0 || !cells.every((cell) => DELIMITER_CELL.test(cell))) {
    return null;
  }
  return cells.map((cell) => {
    const left = cell.startsWith(":");
    const right = cell.endsWith(":");
    return left && right ? "center" : right ? "right" : left ? "left" : null;
  });
}

/** Whether a line begins a block of its own, so it ends the paragraph above it. */
function startsBlock(line: string): boolean {
  return (
    PAGE_MARKER.test(line) ||
    COMMENT_OPEN.test(line) ||
    FENCE.test(line) ||
    HEADING.test(line) ||
    RULE.test(line) ||
    QUOTE.test(line) ||
    ITEM.test(line)
  );
}

function parseBlocks(lines: readonly string[], depth = 0): Block[] {
  if (depth >= 32)
    return [
      {
        kind: "paragraph",
        children: [{ kind: "text", text: lines.join("\n") }],
      },
    ];
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  const flush = () => {
    if (paragraph.length > 0) {
      blocks.push({
        kind: "paragraph",
        children: parseInline(paragraph.join("\n")),
      });
    }
    paragraph = [];
  };

  let at = 0;
  while (at < lines.length) {
    const line = lines[at];

    if (isBlank(line)) {
      flush();
      at++;
      continue;
    }

    const page = PAGE_MARKER.exec(line);
    if (page) {
      flush();
      blocks.push({ kind: "page", page: Number(page[1]) });
      at++;
      continue;
    }

    // Any other comment is not content: it is left out, to its closing `-->`.
    if (COMMENT_OPEN.test(line)) {
      flush();
      while (at < lines.length && !lines[at].includes("-->")) at++;
      at++;
      continue;
    }

    const fence = FENCE.exec(line);
    if (fence) {
      flush();
      const [, marker, language] = fence;
      const closing = new RegExp(
        `^ {0,3}${marker[0]}{${marker.length},}[ \\t]*$`,
      );
      const body: string[] = [];
      at++;
      while (at < lines.length && !closing.test(lines[at]))
        body.push(lines[at++]);
      at++;
      blocks.push({
        kind: "code",
        text: body.join("\n"),
        language: language || null,
      });
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading) {
      flush();
      // A heading may be empty: the group for its words then matched nothing.
      const title = heading.at(2);
      blocks.push({
        kind: "heading",
        level: LEVELS[heading[1].length - 1],
        children: parseInline(title ?? ""),
      });
      at++;
      continue;
    }

    if (paragraph.length > 0 && SETEXT.test(line)) {
      const children = parseInline(paragraph.join("\n"));
      paragraph = [];
      blocks.push({
        kind: "heading",
        level: line.trim().startsWith("=") ? 1 : 2,
        children,
      });
      at++;
      continue;
    }

    if (RULE.test(line)) {
      flush();
      blocks.push({ kind: "rule" });
      at++;
      continue;
    }

    if (QUOTE.test(line)) {
      flush();
      const quoted: string[] = [];
      while (at < lines.length && QUOTE.test(lines[at])) {
        quoted.push(lines[at++].replace(QUOTE, ""));
      }
      blocks.push({ kind: "quote", children: parseBlocks(quoted, depth + 1) });
      continue;
    }

    const item = ITEM.exec(line);
    // Only a bullet or a list that starts at 1 may interrupt a paragraph.
    if (
      item &&
      (paragraph.length === 0 ||
        !/^\d/.test(item[2]) ||
        /^1[.)]$/.test(item[2]))
    ) {
      flush();
      const list = parseList(lines, at, depth);
      blocks.push(list.block);
      at = list.end;
      continue;
    }

    const align =
      paragraph.length === 0 && line.includes("|") && at + 1 < lines.length
        ? alignmentsOf(lines[at + 1])
        : null;
    const head = align ? cellsOf(line) : [];
    if (align && head.length === align.length) {
      const rows: Inline[][][] = [];
      at += 2;
      while (
        at < lines.length &&
        !isBlank(lines[at]) &&
        lines[at].includes("|")
      ) {
        const cells = cellsOf(lines[at++]);
        rows.push(align.map((_, column) => parseInline(cells[column] ?? "")));
      }
      blocks.push({ kind: "table", align, head: head.map(parseInline), rows });
      continue;
    }

    paragraph.push(line.replace(/^[ \t]+/, ""));
    at++;
  }
  flush();
  return blocks;
}

/** The list that starts at `start`: its block, and the first line past it. */
function parseList(
  lines: readonly string[],
  start: number,
  depth: number,
): { block: Block; end: number } {
  const first = ITEM.exec(lines[start]);
  const marker = first?.[2] ?? "-";
  const ordered = /^\d/.test(marker);
  // Items of one list share a bullet character, or an ordered delimiter.
  const family = ordered ? marker.slice(-1) : marker;
  const sameList = (found: RegExpExecArray) =>
    ordered
      ? /^\d/.test(found[2]) && found[2].endsWith(family)
      : found[2] === family;

  const items: Block[][] = [];
  let at = start;
  while (at < lines.length) {
    const opening = RULE.test(lines[at]) ? null : ITEM.exec(lines[at]);
    if (!opening || !sameList(opening)) break;
    // An item with nothing after its marker has neither a gap nor a first line.
    const gap = opening.at(3);
    const firstLine = opening.at(4);
    // Content starts after the marker and its space; a wider gap is not indent.
    const offset =
      opening[1].length +
      opening[2].length +
      (gap === undefined || gap.length > 4 ? 1 : gap.length);
    const body: string[] = [firstLine ?? ""];
    at++;
    let blankBefore = false;
    while (at < lines.length) {
      const line = lines[at];
      if (isBlank(line)) {
        blankBefore = true;
        body.push("");
        at++;
        continue;
      }
      const leading = line.length - line.trimStart().length;
      if (leading >= offset) {
        body.push(line.slice(offset));
      } else if (!blankBefore && !startsBlock(line)) {
        // A line of the same paragraph, written without its indent.
        body.push(line.trimStart());
      } else {
        break;
      }
      blankBefore = false;
      at++;
    }
    // Blank lines after an item's last line belong to what follows the list.
    while (body.length > 1 && body[body.length - 1] === "") body.pop();
    items.push(parseBlocks(body, depth + 1));
  }
  const number = ordered ? Number.parseInt(marker, 10) : 1;
  return { block: { kind: "list", ordered, start: number, items }, end: at };
}

/** Markdown as blocks, top to bottom. */
export function parseMarkdown(source: string): Block[] {
  return parseBlocks(source.replace(/\r\n?/g, "\n").split("\n"));
}

/** How many pages of the source a document's markers name. */
export function pageCount(blocks: readonly Block[]): number {
  return blocks.filter((block) => block.kind === "page").length;
}
