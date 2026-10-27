import { defineIndexSubgraph } from "@powerhousedao/reactor-api";
import { TripIndex } from "processors/trip-index";
import { queries, resolvers } from "./resolvers.js";
import { schema } from "./schema.js";

/**
 * The trip index as an index subgraph: a trip row is one document; the
 * years and places derive from trip rows. All are filtered on
 * `document_id` for the caller once the drive passed.
 */
export const TripIndexSubgraph = defineIndexSubgraph({
  name: "trip-index",
  typeDefs: schema,
  index: (driveId, db) => TripIndex.query(driveId, db),
  access: {
    scope: { drive: "driveId" },
    fields: {
      "TripIndexQueries.trips": { rows: "document", column: "document_id" },
      "TripIndexQueries.years": { rows: "derived", column: "document_id" },
      "TripIndexQueries.places": { rows: "derived", column: "document_id" },
    },
  },
  resolvers,
  queries,
});
