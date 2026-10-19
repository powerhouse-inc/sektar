/**
 * Talking to an Original Source Collection from a workflow step.
 *
 * Two channels, because they answer different questions. Writes go through
 * the reactor the framework hands every step. Lookups go to the index
 * subgraph over HTTP, because "have I captured this already" is a question
 * across documents and no single document can answer it.
 *
 * The HTTP hop needs the switchboard's own origin, which a piece is never
 * given — the same gap as
 * `docs/bugs/subgraphs-have-no-attachment-client.md`. It is resolved the way
 * `subgraphs/statements/lib/config.ts` resolves it, and can be set
 * explicitly when the guess is wrong.
 */
import {
  Property,
  type ReactorClient,
  type ReactorReadClient,
} from "@powerhousedao/pieces-framework";

export const OSC_TYPE = "distyra/original-source-collection";

/**
 * A plain, global-scoped action for the reactor client's `execute`. The host
 * signs every action it runs, so a worker-side id and timestamp are fine here:
 * this is piece code, not a reducer, and nothing deterministic depends on them.
 */
export function toGlobalAction(action: { type: string; input?: unknown }) {
  return {
    id: crypto.randomUUID(),
    timestampUtcMs: new Date().toISOString(),
    type: action.type,
    input: action.input,
    scope: "global",
  };
}

/** Where the switchboard is, as best as a piece can tell. */
function switchboardUrl(): string {
  const env = process.env;
  const explicit = env.PH_SWITCHBOARD_PUBLIC_URL ?? env.REACTOR_GRAPHQL_URL;
  if (explicit) {
    return explicit.replace(/\/graphql\/?$/, "").replace(/\/+$/, "");
  }
  return "http://localhost:7540";
}

export interface SourceLocation {
  identifier: string;
  documentId: string;
  sourceId: string;
  isAlias: boolean;
  status: string;
  title: string | null;
  capturedAt: string;
  lastSeenAt: string;
  collectionTitle: string | null;
}

/**
 * Ask the index where these identifiers already live.
 *
 * Returns nothing rather than throwing when the index cannot be reached. A
 * lookup failure must not stop a capture: the index only decides WHICH
 * collection to write to, never whether to write, so the worst a miss costs
 * is a record filed in the default collection instead of beside its twin.
 */
export async function findLocations(
  driveId: string,
  identifiers: string[],
): Promise<SourceLocation[]> {
  const wanted = [...new Set(identifiers.map((value) => value.trim()))].filter(
    (value) => value !== "",
  );
  if (wanted.length === 0) return [];

  try {
    const response = await fetch(`${switchboardUrl()}/graphql`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        query: `query ($d: String!, $ids: [String!]!) {
          oscIndex { findSources(driveId: $d, identifiers: $ids) {
            identifier documentId sourceId isAlias status title
            capturedAt lastSeenAt collectionTitle
          } }
        }`,
        variables: { d: driveId, ids: wanted },
      }),
    });
    const json = (await response.json()) as {
      data?: { oscIndex?: { findSources?: SourceLocation[] } };
    };
    return json.data?.oscIndex?.findSources ?? [];
  } catch {
    return [];
  }
}

/** An identifier must name the system it came from, as the model requires. */
export function isNamespaced(value: string): boolean {
  return /^[a-z0-9_-]+:.+/i.test(value.trim());
}

export interface CapturedAttachment {
  ref: string;
  fileName: string;
  sizeBytes?: number;
  mimeType?: string;
}

/** The input a CAPTURE_SOURCE action carries. */
export interface CaptureInput {
  id: string;
  externalId: string;
  aliases?: string[];
  title?: string;
  origin?: string;
  content?: string;
  payload?: unknown;
  attachments?: CapturedAttachment[];
  references?: string[];
  tags?: string[];
  occurredAt?: string;
  capturedAt: string;
}

export async function applyToCollection(
  ctx: { reactor: ReactorClient },
  documentId: string,
  actions: { type: string; input?: unknown }[],
): Promise<unknown> {
  const after = await ctx.reactor.execute(
    documentId,
    "main",
    actions.map(toGlobalAction),
  );
  return after.state;
}

export async function readCollection(
  ctx: { reactor: ReactorReadClient },
  documentId: string,
): Promise<{ title?: string | null; sources?: { id: string }[] }> {
  const summary = await ctx.reactor.get(documentId);
  if (summary.header.documentType !== OSC_TYPE) {
    throw new Error(
      `Document ${documentId} is a ${summary.header.documentType}, not an Original Source Collection.`,
    );
  }
  const outer = summary.state as { global?: unknown } | null;
  const inner =
    outer && typeof outer === "object" && "global" in outer
      ? outer.global
      : summary.state;
  return (inner ?? {}) as { title?: string | null; sources?: { id: string }[] };
}

/**
 * Picks the collection a step writes to.
 *
 * For a capture this is where a NEW source goes; one the index already knows
 * is updated wherever it actually lives.
 */
export const oscDocumentProp = Property.Dropdown<string, true>({
  displayName: "Collection",
  description:
    "Where a newly captured source is filed. An identifier the index already knows is updated in the collection that holds it, not copied here.",
  required: true,
  auth: undefined,
  refreshers: [],
  options: async (_propsValue, ctx) => {
    if (!ctx.reactor) {
      return {
        disabled: true,
        placeholder: "Reactor access is not available here",
        options: [],
      };
    }
    try {
      const page = await ctx.reactor.find({ type: OSC_TYPE }, undefined, {
        cursor: "",
        limit: 200,
      });
      const found = page.results;
      if (found.length === 0) {
        return {
          disabled: true,
          placeholder: "No Original Source Collection documents yet",
          options: [],
        };
      }
      return {
        options: found.map((document) => ({
          label: document.header.name,
          value: document.header.id,
        })),
      };
    } catch (error) {
      return {
        disabled: true,
        placeholder:
          error instanceof Error
            ? `Could not list collections: ${error.message}`
            : "Could not list collections",
        options: [],
      };
    }
  },
});

export const driveIdProp = Property.ShortText({
  displayName: "Drive",
  description:
    "The drive whose index to search. The read model is built per drive, so a lookup is scoped to one.",
  required: true,
});
