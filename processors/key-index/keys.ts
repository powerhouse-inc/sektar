/**
 * Which documents the key index covers, and where their key comes from.
 *
 * A key is the identity a batch write deduplicates on — for an email, the
 * namespaced Gmail id. It is read off the operation that sets it, so the
 * index never has to load a document: the operation already carries the
 * value, and a document's history replays through here on first install.
 */
export interface KeyedAction {
  /** The action whose input carries the key, e.g. CAPTURE_MESSAGE. */
  type: string;
  /** Dotted path into the action's input, e.g. externalId. */
  path: string;
}

export interface KeyedType {
  documentType: string;
  actions: KeyedAction[];
}

export const KEYED_TYPES: readonly KeyedType[] = [
  {
    documentType: "sektar/email",
    actions: [{ type: "CAPTURE_MESSAGE", path: "externalId" }],
  },
  {
    documentType: "sektar/calendar-event",
    actions: [{ type: "CAPTURE_EVENT", path: "externalId" }],
  },
];

/** Read a dotted path off an action input. */
export function valueAt(root: unknown, path: string): unknown {
  let current: unknown = root;
  for (const segment of path.split(".")) {
    if (segment === "") continue;
    if (current === null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}
