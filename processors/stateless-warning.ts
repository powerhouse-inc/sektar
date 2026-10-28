/**
 * The warning for operations that reached an index without a resulting state:
 * how many, and which documents (the five with the most), so the reactor's
 * replay log can say why (a deleted document, or a state it could not rebuild).
 */
export function statelessWarning(
  index: string,
  byDocument: ReadonlyMap<string, number>,
): string | null {
  if (byDocument.size === 0) return null;
  let total = 0;
  for (const n of byDocument.values()) total += n;
  const top = [...byDocument]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id, n]) => `${id} (${n})`);
  const more =
    byDocument.size > top.length
      ? `, +${byDocument.size - top.length} more`
      : "";
  return `[${index}] ${total} operation(s) of ${byDocument.size} document(s) without a resulting state left their rows unchanged: ${top.join(", ")}${more}`;
}
