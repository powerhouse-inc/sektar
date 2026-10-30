// For the tools' tests: the app's store as the tools read it, and a stubbed
// fetch that runs each request through the real subgraph schema, so a field,
// an argument or an enum value the subgraphs don't have fails the test.
import {
  buildASTSchema,
  execute,
  getOperationAST,
  Kind,
  parse,
  validate,
  type GraphQLSchema,
} from "graphql";
import { vi } from "vitest";
import { schema as calendarIndex } from "../subgraphs/calendar-index/schema.js";
import { schema as emailIndex } from "../subgraphs/email-index/schema.js";
import { schema as filesIndex } from "../subgraphs/files-index/schema.js";
import { schema as financeIndex } from "../subgraphs/finance-index/schema.js";
import { schema as integrationIndex } from "../subgraphs/integration-index/schema.js";
import { schema as searchIndex } from "../subgraphs/search-index/schema.js";
import { schema as tripIndex } from "../subgraphs/trip-index/schema.js";

const SCHEMAS: Record<string, GraphQLSchema> = {
  calendarIndex: buildASTSchema(calendarIndex),
  emailIndex: buildASTSchema(emailIndex),
  filesIndex: buildASTSchema(filesIndex),
  financeIndex: buildASTSchema(financeIndex),
  integrationIndex: buildASTSchema(integrationIndex),
  searchIndex: buildASTSchema(searchIndex),
  tripIndex: buildASTSchema(tripIndex),
};

export const BASE = "http://switchboard.test";
export const TOKEN = "the-callers-token";

export interface Call {
  url: string;
  authorization: string | undefined;
  root: string;
  query: string;
  variables: Record<string, unknown>;
}

const fakeDrive = (id: string, slug: string) => ({ header: { id, slug } });

/** The store of a pure remote client: drives by slug, the GraphQL client's URL. */
export function installStore(
  overrides: Record<string, unknown> = {},
  drives = [
    "sektar",
    "mail",
    "calendar",
    "files",
    "trips",
    "integrations",
    "backfills",
    "workflows",
  ].map((slug) => fakeDrive(`id-of-${slug}`, slug)),
): void {
  vi.stubGlobal("window", {
    dispatchEvent: () => true,
    ph: {
      drives,
      reactorGraphQLClient: { url: `${BASE}/graphql` },
      renown: { user: {}, getBearerToken: () => Promise.resolve(TOKEN) },
      ...overrides,
    },
  });
}

/**
 * Serves `roots` (keyed by the query's root field, each field a value or a
 * function of its arguments) and records the calls.
 */
export function serve(roots: Record<string, unknown>): Call[] {
  const calls: Call[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      const { query, variables } = JSON.parse(init.body as string) as {
        query: string;
        variables: Record<string, unknown>;
      };
      const document = parse(query);
      const first = getOperationAST(document)?.selectionSet.selections[0];
      const root = first?.kind === Kind.FIELD ? first.name.value : "";
      if (!(root in SCHEMAS)) throw new Error(`No subgraph serves ${root}`);
      const schema = SCHEMAS[root];
      const invalid = validate(schema, document);
      if (invalid.length > 0) {
        throw new Error(
          `The subgraph refuses this query: ${invalid.map((e) => e.message).join("; ")}`,
        );
      }
      calls.push({
        url,
        authorization: (init.headers as Record<string, string>).authorization,
        root,
        query,
        variables,
      });
      const result = await execute({
        schema,
        document,
        rootValue: roots,
        variableValues: variables,
      });
      return Response.json(result);
    }),
  );
  return calls;
}

/** Every request fails before it reaches the switchboard. */
export function unreachable(): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(() => Promise.reject(new Error("connection refused"))),
  );
}

/** Every request is answered with this. */
export function answerWith(response: () => Response): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(() => Promise.resolve(response())),
  );
}
