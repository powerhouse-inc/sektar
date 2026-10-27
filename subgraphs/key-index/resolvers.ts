/**
 * Reading the key index.
 *
 * Read-only by design: the index says which document holds a key, never
 * whether to write one. The worst a stale row can do is point an update at
 * a document that is gone, which the write then reports by name.
 *
 * Access is declared in index.ts and applied by the subgraph wrapper: the
 * handler gets `restrict`, which narrows a query to the caller's readable
 * documents (a refused caller gets no rows, never an error, so a lookup
 * that cannot see a key reports "absent").
 */
import type { IndexQuery } from "@powerhousedao/reactor-api";
import type { KeyIndex } from "processors/key-index";

type Db = KeyIndex["query"];

interface Row {
  document_type: string;
  key: string;
  document_id: string;
}

interface FindArgs {
  driveId: string;
  documentType: string;
  keys: string[];
}

/** Keys per query. 500 keys is 500 bind parameters, far under any driver's cap. */
const CHUNK = 500;

async function find({
  db,
  args,
  restrict,
}: IndexQuery<Db, FindArgs>): Promise<
  { key: string; documentId: string; documentType: string }[]
> {
  const wanted = [...new Set(args.keys.map((value) => value.trim()))].filter(
    (value) => value !== "",
  );
  const out: { key: string; documentId: string; documentType: string }[] = [];
  for (let at = 0; at < wanted.length; at += CHUNK) {
    const rows = (await restrict(
      db
        .selectFrom("key_index")
        .selectAll()
        .where("document_type", "=", args.documentType)
        .where("key", "in", wanted.slice(at, at + CHUNK)),
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

export const resolvers = {
  Query: {
    keyIndex: () => ({}),
  },
};

export const queries = {
  "KeyIndexQueries.find": find,
};
