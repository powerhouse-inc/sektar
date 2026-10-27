/**
 * Reading the key index.
 *
 * Read-only by design: the index says which document holds a key, never
 * whether to write one. The worst a stale row can do is point an update at
 * a document that is gone, which the write then reports by name.
 *
 * Access: every row is one document (`document_id`), so the host's readable
 * documents read model filters rows by the caller, after the drive itself
 * passed (`indexAccess`). A caller the drive refuses gets no rows, never an
 * error: a lookup that cannot see a key reports "absent", which the upsert
 * treats as "create" only when it may write there anyway.
 */
import {
  applyReadableFilter,
  type BaseSubgraph,
  type Context,
} from "@powerhousedao/reactor-api";
import { KeyIndex } from "processors/key-index";

interface Row {
  document_type: string;
  key: string;
  document_id: string;
}

/** Keys per query. 500 keys is 500 bind parameters, far under any driver's cap. */
const CHUNK = 500;

export const getResolvers = (
  subgraph: BaseSubgraph,
): Record<string, unknown> => {
  async function find(
    ctx: Context,
    driveId: string,
    documentType: string,
    keys: string[],
  ): Promise<{ key: string; documentId: string; documentType: string }[]> {
    const access = await subgraph.indexAccess(ctx, driveId);
    if (access.kind === "none") return [];
    const wanted = [...new Set(keys.map((value) => value.trim()))].filter(
      (value) => value !== "",
    );
    const out: { key: string; documentId: string; documentType: string }[] = [];
    for (let at = 0; at < wanted.length; at += CHUNK) {
      const rows = (await applyReadableFilter(
        KeyIndex.query(driveId, subgraph.relationalDb)
          .selectFrom("key_index")
          .selectAll()
          .where("document_type", "=", documentType)
          .where("key", "in", wanted.slice(at, at + CHUNK)),
        "document_id",
        access,
      ).execute()) as Row[];
      for (const row of rows) {
        out.push({
          key: row.key,
          documentId: row.document_id,
          documentType: row.document_type,
        });
      }
    }
    return out;
  }

  return {
    Query: {
      keyIndex: () => ({}),
    },
    KeyIndexQueries: {
      find: (
        _parent: unknown,
        args: { driveId: string; documentType: string; keys: string[] },
        ctx: Context,
      ) => find(ctx, args.driveId, args.documentType, args.keys),
    },
  };
};
