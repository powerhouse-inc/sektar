/**
 * Reading the identifier index.
 *
 * Read-only by design. The index says where something lives; it never
 * decides whether to capture. That distinction is what keeps a stale index
 * from being able to corrupt anything — the worst it can do is send a
 * capture at the wrong collection, and CAPTURE_SOURCE is idempotent within
 * whichever one it lands in.
 */
import { type BaseSubgraph } from "@powerhousedao/reactor-api";
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
    driveId: string,
    identifiers: string[],
  ): Promise<ReturnType<typeof toLocation>[]> {
    const wanted = [...new Set(identifiers.map((value) => value.trim()))].filter(
      (value) => value !== "",
    );
    if (wanted.length === 0) return [];

    const rows = (await OscIndex.query(driveId, subgraph.relationalDb)
      .selectFrom("osc_identifier")
      .selectAll()
      .where("identifier", "in", wanted)
      .execute()) as Row[];

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
      ) => lookup(args.driveId, [args.identifier]),

      findSources: (
        _parent: unknown,
        args: { driveId: string; identifiers: string[] },
      ) => lookup(args.driveId, args.identifiers),
    },
  };
};
