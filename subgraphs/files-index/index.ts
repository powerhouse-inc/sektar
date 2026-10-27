import { defineIndexSubgraph } from "@powerhousedao/reactor-api";
import { FilesIndex } from "processors/files-index";
import { queries, resolvers } from "./resolvers.js";
import { schema } from "./schema.js";

/**
 * The Files index as an index subgraph: a file row is one document (the
 * node id is the File document's id), filtered on `n.id` for the caller
 * once the drive passed. A folder row is drive structure, not a document:
 * it is listed whenever the drive is (`passWhen`), so the tree stays
 * navigable, and what it holds is filtered file by file.
 */
export const FilesIndexSubgraph = defineIndexSubgraph({
  name: "files-index",
  typeDefs: schema,
  index: (driveId, db) => FilesIndex.query(driveId, db),
  access: {
    scope: { drive: "driveId" },
    fields: {
      "FilesIndexQueries.listing": {
        rows: "document",
        column: "n.id",
        passWhen: { column: "n.kind", equals: "folder" },
      },
    },
  },
  resolvers,
  queries,
});
