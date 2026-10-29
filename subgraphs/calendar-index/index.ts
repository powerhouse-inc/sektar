import { defineIndexSubgraph } from "@powerhousedao/reactor-api";
import { CalendarIndex } from "processors/calendar-index";
import { queries, resolvers } from "./resolvers.js";
import { schema } from "./schema.js";

/**
 * The calendar index as an index subgraph: an event row is one document;
 * the calendar list derives from event rows. Both are filtered on
 * `document_id` for the caller once the drive passed.
 */
export const CalendarIndexSubgraph = defineIndexSubgraph({
  name: "calendar-index",
  typeDefs: schema,
  index: (driveId, db) => CalendarIndex.query(driveId, db),
  access: {
    scope: { drive: "driveId" },
    fields: {
      "CalendarIndexQueries.events": { rows: "document", column: "document_id" },
      "CalendarIndexQueries.calendars": { rows: "derived", column: "document_id" },
    },
  },
  resolvers,
  queries,
});
