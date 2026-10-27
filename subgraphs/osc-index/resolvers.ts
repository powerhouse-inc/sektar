/**
 * Reading the identifier index.
 *
 * Read-only by design. The index says where something lives; it never
 * decides whether to capture. That distinction is what keeps a stale index
 * from being able to corrupt anything — the worst it can do is send a
 * capture at the wrong collection, and CAPTURE_SOURCE is idempotent within
 * whichever one it lands in.
 *
 * Access: a location row names the collection document that holds the
 * identifier (`document_id`), so rows are filtered through the host's
 * readable documents read model for the caller once the drive passed
 * (`indexAccess`). A caller who may not see a collection is told the
 * identifier is absent there, never that it exists.
 */
import {
  applyReadableFilter,
  type BaseSubgraph,
  type Context,
} from "@powerhousedao/reactor-api";
import { OscIndex } from "processors/osc-index";

interface Row {
  identifier: string;
  document_id: string;
  source_id: string;
  is_alias: boolean;
  status: string;
  title: string | null;
  captured_at: string;
  last_seen_at: string;
  collection_title: string | null;
}

function toLocation(row: Row) {
  return {
    identifier: row.identifier,
    documentId: row.document_id,
    sourceId: row.source_id,
    // SQLite has no boolean, so a driver may hand back 0/1.
    isAlias: Boolean(row.is_alias),
    status: row.status,
    title: row.title,
    capturedAt: row.captured_at,
    lastSeenAt: row.last_seen_at,
    collectionTitle: row.collection_title,
  };
}

export const getResolvers = (
  subgraph: BaseSubgraph,
): Record<string, unknown> => {
  async function lookup(
    ctx: Context,
    driveId: string,
    identifiers: string[],
  ): Promise<ReturnType<typeof toLocation>[]> {
    const wanted = [
      ...new Set(identifiers.map((value) => value.trim())),
    ].filter((value) => value !== "");
    if (wanted.length === 0) return [];
    const access = await subgraph.indexAccess(ctx, driveId);
    if (access.kind === "none") return [];

    const rows = (await applyReadableFilter(
      OscIndex.query(driveId, subgraph.relationalDb)
        .selectFrom("osc_identifier")
        .selectAll()
        .where("identifier", "in", wanted),
      "document_id",
      access,
    ).execute()) as Row[];

    return rows.map(toLocation);
  }

  return {
    Query: {
      oscIndex: () => ({}),
    },
    OscIndexQueries: {
      findSource: (
        _parent: unknown,
        args: { driveId: string; identifier: string },
        ctx: Context,
      ) => lookup(ctx, args.driveId, [args.identifier]),

      findSources: (
        _parent: unknown,
        args: { driveId: string; identifiers: string[] },
        ctx: Context,
      ) => lookup(ctx, args.driveId, args.identifiers),
    },
  };
};
