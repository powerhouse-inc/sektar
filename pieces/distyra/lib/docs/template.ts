/**
 * Per-item templating for batch steps.
 *
 * The engine resolves `{{…}}` before a step runs and cannot apply a path to
 * every element of a list, so a step that works per item needs a placeholder
 * of its own: `$item.<path>` reads from the item being processed and `$index`
 * is its position in the list. The rule is the engine's own: a string that is
 * exactly one placeholder takes the raw value (an array stays an array, an
 * attachment ref stays a ref), any other string interpolates as text, and
 * `\$item` is the literal characters.
 */

const PLACEHOLDER = /\\?\$(item(?:\.[A-Za-z0-9_-]+|\[\d+\])*|index)\b/g;
const WHOLE = /^\$(item(?:\.[A-Za-z0-9_-]+|\[\d+\])*|index)$/;

/** Read a dotted path, with `[n]` or `.n` for list positions. */
export function valueAt(root: unknown, path: string): unknown {
  const segments = path
    .replace(/\[(\d+)\]/g, ".$1")
    .split(".")
    .filter((segment) => segment !== "");
  let current: unknown = root;
  for (const segment of segments) {
    if (current === null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

/** Text for interpolation: scalars as they are, anything else as JSON. */
export function asText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return JSON.stringify(value);
}

function placeholderValue(expr: string, item: unknown, index: number): unknown {
  if (expr === "index") return index;
  // "item", "item.a.b", "item[0].c": whatever follows "item" is the path.
  return valueAt(item, expr.slice("item".length));
}

/** Whether a string carries any placeholder worth rendering. */
export function hasPlaceholder(text: string): boolean {
  PLACEHOLDER.lastIndex = 0;
  return PLACEHOLDER.test(text);
}

/**
 * Render one string. Exactly one placeholder yields the raw value; otherwise
 * every placeholder is interpolated as text and the result is a string.
 */
export function renderText(text: string, item: unknown, index: number): unknown {
  const whole = WHOLE.exec(text.trim());
  if (whole) return placeholderValue(whole[1], item, index);
  return text.replace(PLACEHOLDER, (match: string, expr: string) =>
    match.startsWith("\\")
      ? match.slice(1)
      : asText(placeholderValue(expr, item, index)),
  );
}

/** Render a whole structure: strings are rendered, containers walked. */
export function renderTemplate(
  template: unknown,
  item: unknown,
  index: number,
): unknown {
  if (typeof template === "string") return renderText(template, item, index);
  if (Array.isArray(template)) {
    return template.map((entry) => renderTemplate(entry, item, index));
  }
  if (template !== null && typeof template === "object") {
    return Object.fromEntries(
      Object.entries(template as Record<string, unknown>).map(
        ([key, value]) => [key, renderTemplate(value, item, index)],
      ),
    );
  }
  return template;
}

/** A template compiled from a text prop, ready to render per item. */
export type Template = (item: unknown, index: number) => unknown;

/**
 * Compile what a text prop holds. Empty means no template. A lone placeholder
 * resolves to the raw value. JSON text is parsed once and rendered as a
 * structure, so `{"type": "SET_TITLE", "input": {"title": "$item.name"}}`
 * works. Anything else renders as text.
 */
export function compileTemplate(
  source: unknown,
  label: string,
): Template | undefined {
  if (source === undefined || source === null) return undefined;
  if (typeof source !== "string") {
    // A Json prop already parsed: render it as a structure.
    return (item, index) => renderTemplate(source, item, index);
  }
  const text = source.trim();
  if (text === "") return undefined;
  if (WHOLE.test(text)) return (item, index) => renderText(text, item, index);
  if (text.startsWith("[") || text.startsWith("{")) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch (error) {
      throw new Error(
        `"${label}" looks like JSON but does not parse: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    return (item, index) => renderTemplate(parsed, item, index);
  }
  return (item, index) => renderText(text, item, index);
}
