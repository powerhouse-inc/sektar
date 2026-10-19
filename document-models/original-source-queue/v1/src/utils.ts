/**
 * The public surface of this model beyond its actions and types.
 *
 * Codegen re-exports this file through the model's barrel, so anything here
 * is reachable as `from "document-models/original-source-queue"` — which is
 * where editors and pieces should get it.
 */
import type {
  OsqCollectionCursor,
  OsqCursor,
  OsqDateTimeCursor,
  OsqNumberCursor,
} from "../gen/schema/types.js";

/**
 * Telling the three cursor kinds apart.
 *
 * The generated union carries no `__typename`, so each kind is identified by
 * the one field only it has. Keeping these in one place matters: a consumer
 * that open-codes `"step" in cursor` is a consumer that breaks silently if a
 * field is ever renamed.
 */
export function isNumberCursor(cursor: OsqCursor): cursor is OsqNumberCursor {
  return "step" in cursor;
}

export function isDateTimeCursor(
  cursor: OsqCursor,
): cursor is OsqDateTimeCursor {
  return "deltaSeconds" in cursor;
}

export function isCollectionCursor(
  cursor: OsqCursor,
): cursor is OsqCollectionCursor {
  return "collection" in cursor;
}

/** What a cursor is called on screen, falling back to something identifying. */
export function cursorLabel(cursor: OsqCursor): string {
  if (cursor.name) return cursor.name;
  if (isNumberCursor(cursor)) return "Number range";
  if (isDateTimeCursor(cursor)) return "Time range";
  return "Queue";
}
