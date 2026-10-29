/**
 * Which drive a slug names, where a drive was converted to a reactor-drive.
 *
 * The host files declare Sektar's drives by slug, and a fresh store makes each
 * one under its slug. A store whose drives were converted (Mail on 2026-10-26,
 * the others on 2026-10-29) holds a new reactor-drive under its own id, next
 * to the legacy drive, which keeps the slug and is no longer written. The
 * converted drive is pinned here (drive-ids.json; the vetra host pins the same
 * ids for the studio switchboard), and every lookup takes the pinned drive where
 * the store has it, else the drive under the slug.
 */
import pins from "./drive-ids.json" with { type: "json" };

export type DriveSlug = keyof typeof pins;

/** The converted drive's id for a slug, if one was pinned. */
export function pinnedDriveId(slug: string): string | undefined {
  return (pins as Record<string, string | undefined>)[slug];
}

/** The ids and slug a drive of this slug may be found under, in order. */
export function driveKeys(slug: string): string[] {
  const pinned = pinnedDriveId(slug);
  return pinned ? [pinned, slug] : [slug];
}

type HasHeader = { header: { id: string; slug: string } };

/** The drive a slug names among loaded drives: the pinned one first. */
export function findDrive<T extends HasHeader>(
  drives: readonly T[] | undefined,
  slug: string,
): T | undefined {
  if (!drives) return undefined;
  const pinned = pinnedDriveId(slug);
  return (
    (pinned ? drives.find((d) => d.header.id === pinned) : undefined) ??
    drives.find((d) => d.header.slug === slug || d.header.id === slug)
  );
}

type DriveReader = { get: (idOrSlug: string) => Promise<{ header: { id: string } }> };

/** The id of the drive a slug names in this store, or null if it has none. */
export async function resolveDriveId(
  read: DriveReader,
  slug: string,
): Promise<string | null> {
  for (const key of driveKeys(slug)) {
    try {
      return (await read.get(key)).header.id;
    } catch {
      // not here: try the next
    }
  }
  return null;
}

/**
 * Whether a processor bound to a drive app should run on this drive: the
 * converted drive pinned for `slug`, or (where the store has no pinned drive)
 * a drive under the slug or with the app as its preferred editor. A processor
 * that writes (the integration reconciler, folder sync) binds this way: after
 * a conversion the legacy drive holds the same documents, and a second writer
 * over them would do every write twice.
 */
export async function bindsTo(
  read: DriveReader,
  header: { id: string; slug: string; meta?: unknown },
  slug: string,
  app: string,
): Promise<boolean> {
  const pinned = pinnedDriveId(slug);
  if (pinned && header.id === pinned) return true;
  const editor = (header.meta as { preferredEditor?: string } | undefined)
    ?.preferredEditor;
  if (editor !== app && header.slug !== slug && header.id !== slug) return false;
  if (!pinned) return true;
  try {
    await read.get(pinned);
    return false;
  } catch {
    return true;
  }
}

/**
 * Whether a loaded drive is a legacy drive whose converted drive is loaded
 * too: lists of drives leave it out, as nothing is filed there any more.
 */
export function supersededDrive<T extends HasHeader>(
  drives: readonly T[] | undefined,
  drive: T,
): boolean {
  const pinned = pinnedDriveId(drive.header.slug);
  return (
    !!pinned &&
    drive.header.id !== pinned &&
    !!drives?.some((d) => d.header.id === pinned)
  );
}
