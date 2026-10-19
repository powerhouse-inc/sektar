/**
 * Planning for Ensure Day Collection: given a drive's node list, which
 * folders of a path already exist, which still have to be created, and
 * whether the day's document is already filed at the end of it.
 *
 * Pure on purpose. The action around it mints ids and dispatches; everything
 * that can be wrong in an interesting way — path walking, duplicate names,
 * root parentage, a file of the wrong type shadowing the name — is decided
 * here, where a test can reach it.
 */

/** A drive node as the reactor returns it. Files carry a documentType. */
export interface DriveNode {
  id: string;
  name: string;
  kind: string;
  documentType?: string;
  parentFolder?: string | null;
}

export interface EnsurePlan {
  /**
   * The deepest folder of the path that already exists — the parent the
   * first missing folder must be created under. Null means the path is
   * missing from the root down.
   */
  parentId: string | null;
  /** Folder names still to create, outermost first. Empty: the path exists. */
  missing: string[];
  /**
   * The day document, when the full path exists and a file of the right
   * type with the right name is already filed in its final folder.
   */
  documentId: string | null;
}

function childFolder(
  nodes: DriveNode[],
  parentId: string | null,
  name: string,
): DriveNode | undefined {
  // First match wins. Duplicate names can exist (the drive reducer renames
  // on collision, but nothing forbids a "x" next to a "x (copy) 1"), and
  // walking into the first is at least deterministic.
  return nodes.find(
    (node) =>
      node.kind === "folder" &&
      node.name === name &&
      (node.parentFolder ?? null) === parentId,
  );
}

export function planEnsure(
  nodes: DriveNode[],
  segments: string[],
  documentName: string,
  documentType: string,
): EnsurePlan {
  let parentId: string | null = null;
  for (const [index, segment] of segments.entries()) {
    const found = childFolder(nodes, parentId, segment);
    if (!found) {
      return { parentId, missing: segments.slice(index), documentId: null };
    }
    parentId = found.id;
  }

  const file = nodes.find(
    (node) =>
      node.kind === "file" &&
      node.documentType === documentType &&
      node.name === documentName &&
      (node.parentFolder ?? null) === parentId,
  );
  return { parentId, missing: [], documentId: file?.id ?? null };
}

/** The slash path split into clean segments, with the date's year and month
 * appended: "e-mails/powerhouse" + 2026-10-01 -> [e-mails, powerhouse, 2026, 10]. */
export function pathSegments(basePath: string, date: string): string[] {
  const base = basePath
    .split("/")
    .map((segment) => segment.trim())
    .filter((segment) => segment !== "");
  return [...base, date.slice(0, 4), date.slice(5, 7)];
}
