/**
 * Reading the integration index.
 *
 * Read-only by design: the index says what the integrations, backfills and
 * workflows drives hold, never changes it. Edits go through the documents,
 * and the processor brings the index up to date behind it.
 *
 * Access is declared in index.ts and applied by the subgraph wrapper: every
 * query goes through `restrict`.
 */
import type { IndexQuery } from "@powerhousedao/reactor-api";
import { onScreenOf, type OnScreen } from "./on-screen.js";
import {
  cleanIds,
  connectionsQuery,
  integrationsQuery,
  queuesQuery,
  toConnectionRow,
  toIntegrationRow,
  toQueueRow,
  type ConnectionListRow,
  type IntegrationIndex,
  type IntegrationListRow,
  type QueueListRow,
} from "processors/integration-index";

type Db = IntegrationIndex["query"];

async function integrations({
  db,
  restrict,
}: IndexQuery<Db, { driveId: string }>): Promise<IntegrationListRow[]> {
  const rows = await restrict(integrationsQuery(db)).execute();
  return rows.map(toIntegrationRow);
}

async function queues({
  db,
  args,
  restrict,
}: IndexQuery<
  Db,
  { driveId: string; ids?: string[] | null }
>): Promise<QueueListRow[]> {
  // Absent: every queue; an empty list asks for none.
  const ids = args.ids == null ? null : cleanIds(args.ids);
  if (ids && ids.length === 0) return [];
  const rows = await restrict(queuesQuery(db, ids)).execute();
  return rows.map(toQueueRow);
}

async function connections({
  db,
  args,
  restrict,
}: IndexQuery<
  Db,
  { driveId: string; ids: string[] }
>): Promise<ConnectionListRow[]> {
  const ids = cleanIds(args.ids);
  if (ids.length === 0) return [];
  const rows = await restrict(connectionsQuery(db, ids)).execute();
  return rows.map(toConnectionRow);
}

export const resolvers = {
  Query: {
    integrationIndex: () => ({}),
  },
};

/** The person asking, as a bank sees an end user on screen (on-screen.ts). */
function onScreen({ ctx }: IndexQuery<Db, { driveId: string }>): OnScreen | null {
  return onScreenOf(ctx.headers);
}

export const queries = {
  "IntegrationIndexQueries.integrations": integrations,
  "IntegrationIndexQueries.queues": queues,
  "IntegrationIndexQueries.connections": connections,
  "IntegrationIndexQueries.onScreen": onScreen,
};
