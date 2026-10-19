/**
 * OnNewSource — one flow run per source captured since the last tick.
 *
 * The second stage of the pipeline. `ForEvery` drives capture; this drives
 * processing, and each stage is independently resumable: the queue remembers
 * where the walk is, this remembers what has been handed on.
 *
 * The watermark lives in the trigger's own store rather than in a status on
 * the source. A status change would conflate "a trigger saw it" with "work
 * started", and those are different claims — the flow may not have begun,
 * may have failed, or may decide the source needs nothing.
 */
import { createTrigger, TriggerStrategy } from "@powerhousedao/pieces-framework";
import { oscDocumentProp, readCollection } from "./client.js";

const WATERMARK = "osc-on-new-source:last-seen";

interface CapturedSource {
  id: string;
  externalId: string;
  aliases: string[];
  status: string;
  title?: string | null;
  content?: string | null;
  payload?: unknown;
  tags: string[];
  attachments: unknown[];
  capturedAt: string;
  lastSeenAt: string;
  mergedInto?: string | null;
}

/**
 * Sources captured after the watermark, oldest first.
 *
 * Ordered by `capturedAt`, which never moves once a source arrives — unlike
 * `lastSeenAt`, which a re-capture pushes forward and which would therefore
 * hand the same source to the flow again every time it was re-sighted.
 *
 * Folded sources are skipped: they are not new work, they are a record that
 * two captures turned out to be one object.
 */
export function sourcesAfter(
  sources: CapturedSource[],
  watermark: string | null,
): CapturedSource[] {
  return sources
    .filter((source) => !source.mergedInto)
    .filter((source) => !watermark || source.capturedAt > watermark)
    .sort((a, b) => a.capturedAt.localeCompare(b.capturedAt));
}

function shapeOf(documentId: string, source: CapturedSource) {
  return {
    documentId,
    sourceId: source.id,
    externalId: source.externalId,
    aliases: source.aliases,
    status: source.status,
    title: source.title ?? null,
    content: source.content ?? null,
    payload: source.payload ?? null,
    tags: source.tags,
    attachments: source.attachments,
    capturedAt: source.capturedAt,
  };
}

export const distyraOnNewSourceTrigger = createTrigger({
  // Saved workflows refer to the trigger by name: don't rename it once published
  name: "on-new-source",
  requireAuth: false,
  requireReactor: "read",
  displayName: "On New Source",
  description:
    "Runs once per source captured into a collection since the last check, oldest first. Pairs with Capture Source as the second stage of a backfill: one flow brings records in, this one processes them.",
  type: TriggerStrategy.POLLING,
  props: {
    collection: oscDocumentProp,
  },
  sampleData: {
    documentId: "I7mKM1tmZEhRk7gq-kZyrawRRtQU7HeBntDUEt65V04",
    sourceId: "s-hetzner",
    externalId: "gmail:18ef2c91a74b0033",
    aliases: ["drive:1kQb7x9ZzTmAc4Lp", "sha256:4f2b90ce11ad7e6c"],
    status: "NEW",
    title: "Hetzner invoice R0012845921",
    content: "Your invoice for April 2024 is attached.",
    payload: { id: "18ef2c91a74b0033", from: "accounting@hetzner.com" },
    tags: ["invoice", "hosting"],
    attachments: [
      {
        ref: "attachment://v1:0650db71…",
        fileName: "R0012845921.pdf",
        mimeType: "application/pdf",
      },
    ],
    capturedAt: "2026-09-20T09:14:01.000Z",
  },

  async onEnable(context) {
    // Start from now rather than from the beginning of the collection.
    // Enabling a flow on a collection holding four hundred captures should
    // not immediately run it four hundred times; that is a backfill, and a
    // backfill is what the queue is for.
    const state = await readCollection(context, context.propsValue.collection);
    const sources = (state.sources ?? []) as unknown as CapturedSource[];
    const latest = sources.reduce<string | null>(
      (newest, source) =>
        !newest || source.capturedAt > newest ? source.capturedAt : newest,
      null,
    );
    await context.store.put(WATERMARK, latest ?? new Date().toISOString());
  },

  async onDisable(context) {
    await context.store.delete(WATERMARK);
  },

  async run(context) {
    const documentId = context.propsValue.collection;
    const state = await readCollection(context, documentId);
    const sources = (state.sources ?? []) as unknown as CapturedSource[];

    const watermark = await context.store.get<string>(WATERMARK);
    const fresh = sourcesAfter(sources, watermark);
    if (fresh.length === 0) return [];

    // Advanced only after the batch is assembled, and to the newest thing in
    // it — so a source captured while this was running is picked up next
    // tick rather than skipped.
    const newest = fresh[fresh.length - 1].capturedAt;
    await context.store.put(WATERMARK, newest);

    return fresh.map((source) => shapeOf(documentId, source));
  },

  async test(context) {
    // A test must not move the watermark. Testing a trigger is something a
    // person does repeatedly while building a flow, and a test that consumed
    // the backlog would leave the real run with nothing to do.
    const documentId = context.propsValue.collection;
    const state = await readCollection(context, documentId);
    const sources = (state.sources ?? []) as unknown as CapturedSource[];
    const watermark = await context.store.get<string>(WATERMARK);
    return sourcesAfter(sources, watermark)
      .slice(-5)
      .map((source) => shapeOf(documentId, source));
  },
});
