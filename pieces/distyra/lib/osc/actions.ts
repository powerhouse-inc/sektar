/**
 * Capturing into a collection, and asking where something already lives.
 *
 * `CaptureSource` runs the same lookup `FindSource` does, so a flow does not
 * have to do it itself: an identifier the index already knows is updated
 * where it lives rather than copied into whichever collection the step was
 * pointed at. That is what stops one object existing separately in two
 * collections because two flows found it.
 *
 * Every step sets `requireAuth: false`. The piece's auth is a Distyra bank
 * connection and these reach the reactor instead; inheriting it would force
 * someone to attach a bank account before they could file an email.
 */
import { createAction, Property } from "@powerhousedao/pieces-framework";
import {
  applyToCollection,
  driveIdProp,
  findLocations,
  isNamespaced,
  oscDocumentProp,
  readCollection,
  type CaptureInput,
  type CapturedAttachment,
} from "./client.js";

/** Reducers cannot generate ids, so every new record needs one from here. */
function oid(): string {
  return crypto.randomUUID();
}

function now(): string {
  return new Date().toISOString();
}

/**
 * A field from a Json prop, if it is actually text.
 *
 * These arrive as `unknown`, and `String()` on an object yields
 * "[object Object]" — a title that reads like a bug report. Narrowing drops
 * a wrong-typed field instead of storing nonsense.
 */
function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
}

/** Whether an optional Json field was actually supplied. */
function present(value: unknown): boolean {
  return value !== undefined && value !== null;
}

function asArray<T>(value: unknown): T[] {
  if (value === null || value === undefined || value === "") return [];
  return Array.isArray(value) ? (value as T[]) : [value as T];
}

export const distyraOscFindSourceAction = createAction({
  name: "osc-find-source",
  requireAuth: false,
  displayName: "Find Source",
  description:
    "Ask whether an identifier has already been captured, and where. Returns the collection holding it, so a flow can skip fetching something it already has. A folded identifier resolves to the record that absorbed it, never to the tombstone.",
  props: {
    driveId: driveIdProp,
    identifiers: Property.Array({
      displayName: "Identifiers",
      description:
        "Namespaced, as the model stores them: gmail:18f3a, sha256:9de1.",
      required: true,
    }),
  },
  async run(context) {
    const identifiers = asArray<string>(context.propsValue.identifiers);
    const matches = await findLocations(context.propsValue.driveId, identifiers);
    return {
      found: matches.length > 0,
      // The first hit is the ergonomic answer; `matches` is the honest one,
      // since two backfills may have captured the same object separately.
      documentId: matches[0]?.documentId ?? null,
      sourceId: matches[0]?.sourceId ?? null,
      matches,
    };
  },
});

const captureProps = {
  collection: oscDocumentProp,
  driveId: driveIdProp,
  searchAllCollections: Property.Checkbox({
    displayName: "Search every collection first",
    description:
      "On by default. Off keeps this flow's captures inside the chosen collection, at the cost of the same object possibly existing in two.",
    required: false,
    defaultValue: true,
  }),
};

/** Where a capture should land, and whether the index had seen it. */
async function targetFor(
  driveId: string,
  fallback: string,
  identifiers: string[],
  search: boolean,
): Promise<{ documentId: string; known: boolean }> {
  if (!search) return { documentId: fallback, known: false };
  const matches = await findLocations(driveId, identifiers);
  if (matches.length === 0) return { documentId: fallback, known: false };
  return { documentId: matches[0].documentId, known: true };
}

export const distyraOscCaptureSourceAction = createAction({
  name: "osc-capture-source",
  requireAuth: false,
  requireReactor: "write",
  displayName: "Capture Source",
  description:
    "Store one record exactly as it arrived. Pairs with the For Every trigger: the queue hands a slice, the fetch produces a record, this files it. Re-capturing an identifier updates it in place rather than duplicating, so a re-run of a backfill is safe.",
  props: {
    ...captureProps,
    externalId: Property.ShortText({
      displayName: "Identifier",
      description:
        "Namespaced by its system: gmail:18f3a. Required, and the namespace is not optional — without it an id from one system and an id from another are the same key.",
      required: true,
    }),
    aliases: Property.Array({
      displayName: "Other identifiers",
      description:
        "Anything else this object is known by. Supplying two that belong to different sources folds them together.",
      required: false,
    }),
    title: Property.ShortText({ displayName: "Title", required: false }),
    origin: Property.ShortText({
      displayName: "Origin URL",
      required: false,
    }),
    content: Property.LongText({
      displayName: "Content",
      description: "Human-readable text, when the source has any.",
      required: false,
    }),
    payload: Property.Json({
      displayName: "Payload",
      description: "The record exactly as received. Stored untouched.",
      required: false,
    }),
    attachments: Property.Json({
      displayName: "Attachments",
      description:
        "A list of {ref, fileName, sizeBytes, mimeType}. A piece that wrote a file through context.files.write gets a ref back in exactly this form.",
      required: false,
    }),
    tags: Property.Array({ displayName: "Tags", required: false }),
    occurredAt: Property.DateTime({
      displayName: "Happened at",
      description: "When it happened at the source, if that is known.",
      required: false,
    }),
  },
  async run(context) {
    const input = context.propsValue;
    const externalId = input.externalId.trim();
    if (!isNamespaced(externalId)) {
      throw new Error(
        `Identifier "${externalId}" does not name the system it came from. Use system:value, for example gmail:18f3a.`,
      );
    }

    const aliases = asArray<string>(input.aliases).map((a) => a.trim());
    const { documentId, known } = await targetFor(
      input.driveId,
      input.collection,
      [externalId, ...aliases],
      input.searchAllCollections ?? true,
    );

    const captured: CaptureInput = {
      id: oid(),
      externalId,
      aliases,
      capturedAt: now(),
      ...(input.title ? { title: input.title } : {}),
      ...(input.origin ? { origin: input.origin } : {}),
      ...(input.content ? { content: input.content } : {}),
      ...(present(input.payload) ? { payload: input.payload } : {}),
      ...(input.occurredAt ? { occurredAt: input.occurredAt } : {}),
      ...(asArray<string>(input.tags).length > 0
        ? { tags: asArray<string>(input.tags) }
        : {}),
      ...(asArray<CapturedAttachment>(input.attachments).length > 0
        ? { attachments: asArray<CapturedAttachment>(input.attachments) }
        : {}),
    };

    await applyToCollection(context, documentId, [
      { type: "CAPTURE_SOURCE", input: captured },
    ]);

    const after = await readCollection(context, documentId);
    return {
      documentId,
      collectionTitle: after.title ?? null,
      // From the index rather than from counting: the index is what decided
      // where this went, so it is the honest thing to report.
      updatedExisting: known,
      sources: after.sources?.length ?? 0,
    };
  },
});

export const distyraOscCaptureSourcesAction = createAction({
  name: "osc-capture-sources",
  requireAuth: false,
  requireReactor: "write",
  displayName: "Capture Sources",
  description:
    "The batch form. One lookup and one write per collection rather than one of each per record, which matters when a week of Gmail is three hundred messages.",
  props: {
    ...captureProps,
    sources: Property.Json({
      displayName: "Records",
      description:
        "A list of {externalId, aliases, title, origin, content, payload, attachments, tags, occurredAt}. Only externalId is required.",
      required: true,
    }),
  },
  async run(context) {
    const input = context.propsValue;
    const records = asArray<Record<string, unknown>>(input.sources);
    if (records.length === 0) {
      return { captured: 0, collections: [], skipped: [] };
    }

    const skipped: string[] = [];
    const prepared: { identifiers: string[]; captured: CaptureInput }[] = [];
    for (const record of records) {
      const externalId = (text(record.externalId) ?? "").trim();
      if (!isNamespaced(externalId)) {
        // Named rather than dropped: a batch that silently discards a record
        // is a batch whose count cannot be trusted.
        skipped.push(externalId || "(no identifier)");
        continue;
      }
      const aliases = asArray<string>(record.aliases).map((a) => a.trim());
      prepared.push({
        identifiers: [externalId, ...aliases],
        captured: {
          id: oid(),
          externalId,
          aliases,
          capturedAt: now(),
          ...(text(record.title) ? { title: text(record.title) } : {}),
          ...(text(record.origin) ? { origin: text(record.origin) } : {}),
          ...(text(record.content) ? { content: text(record.content) } : {}),
          ...(present(record.payload) ? { payload: record.payload } : {}),
          ...(text(record.occurredAt)
            ? { occurredAt: text(record.occurredAt) }
            : {}),
          ...(asArray<string>(record.tags).length > 0
            ? { tags: asArray<string>(record.tags) }
            : {}),
          ...(asArray<CapturedAttachment>(record.attachments).length > 0
            ? { attachments: asArray<CapturedAttachment>(record.attachments) }
            : {}),
        },
      });
    }

    // One lookup for the whole batch, then one write per collection.
    const search = input.searchAllCollections ?? true;
    const locations = search
      ? await findLocations(
          input.driveId,
          prepared.flatMap((entry) => entry.identifiers),
        )
      : [];
    const home = new Map(
      locations.map((location) => [location.identifier, location.documentId]),
    );

    const batches = new Map<string, CaptureInput[]>();
    let updatedExisting = 0;
    for (const entry of prepared) {
      const known = entry.identifiers.find((identifier) => home.has(identifier));
      if (known) updatedExisting++;
      const documentId = known
        ? (home.get(known) as string)
        : input.collection;
      batches.set(documentId, [
        ...(batches.get(documentId) ?? []),
        entry.captured,
      ]);
    }

    const collections: { documentId: string; captured: number }[] = [];
    for (const [documentId, captures] of batches) {
      await applyToCollection(
        context,
        documentId,
        captures.map((captured) => ({
          type: "CAPTURE_SOURCE",
          input: captured,
        })),
      );
      collections.push({ documentId, captured: captures.length });
    }

    return {
      captured: prepared.length,
      updatedExisting,
      collections,
      skipped,
    };
  },
});

export const distyraOscTagSourceAction = createAction({
  name: "osc-tag-source",
  requireAuth: false,
  requireReactor: "write",
  displayName: "Tag Source",
  description:
    "Add tags to a captured source. Tags are a set, so tagging twice is not an error.",
  props: {
    collection: oscDocumentProp,
    source: Property.ShortText({
      displayName: "Source id",
      description: "The OID of the source, as Find Source reports it.",
      required: true,
    }),
    tags: Property.Array({ displayName: "Tags", required: true }),
  },
  async run(context) {
    const tags = asArray<string>(context.propsValue.tags);
    await applyToCollection(context, context.propsValue.collection, [
      { type: "TAG_SOURCE", input: { source: context.propsValue.source, tags } },
    ]);
    return { source: context.propsValue.source, tags };
  },
});

export const distyraOscSetSourceStatusAction = createAction({
  name: "osc-set-source-status",
  requireAuth: false,
  requireReactor: "write",
  displayName: "Set Source Status",
  description:
    "Move a source through NEW, PROCESSING and COMPLETED, or discard it. A source folded into another keeps the status that records the merge.",
  props: {
    collection: oscDocumentProp,
    source: Property.ShortText({ displayName: "Source id", required: true }),
    status: Property.StaticDropdown({
      displayName: "Status",
      required: true,
      options: {
        options: [
          { label: "new", value: "NEW" },
          { label: "processing", value: "PROCESSING" },
          { label: "completed", value: "COMPLETED" },
          { label: "discarded", value: "DISCARDED" },
        ],
      },
    }),
  },
  async run(context) {
    await applyToCollection(context, context.propsValue.collection, [
      {
        type: "SET_SOURCE_STATUS",
        input: {
          source: context.propsValue.source,
          status: context.propsValue.status,
        },
      },
    ]);
    return {
      source: context.propsValue.source,
      status: context.propsValue.status,
    };
  },
});

export const distyraOscMergeSourcesAction = createAction({
  name: "osc-merge-sources",
  requireAuth: false,
  requireReactor: "write",
  displayName: "Merge Sources",
  description:
    "Fold sources into one because they are the same object. The losers keep their own payloads and files and gain a pointer to the winner — only the identity moves, and Split Source undoes it.",
  props: {
    collection: oscDocumentProp,
    keep: Property.ShortText({
      displayName: "Keep",
      description: "The source id that survives.",
      required: true,
    }),
    merge: Property.Array({
      displayName: "Fold in",
      description: "Source ids to fold into it.",
      required: true,
    }),
  },
  async run(context) {
    const merge = asArray<string>(context.propsValue.merge);
    await applyToCollection(context, context.propsValue.collection, [
      {
        type: "MERGE_SOURCES",
        input: { keep: context.propsValue.keep, merge, mergedAt: now() },
      },
    ]);
    return { keep: context.propsValue.keep, merged: merge.length };
  },
});

export const distyraOscCreateTaskAction = createAction({
  name: "osc-create-task",
  requireAuth: false,
  requireReactor: "write",
  displayName: "Create Task",
  description:
    "Raise work for a person — this one needs a human. Attach it to a source, or leave the source empty to raise it about the batch.",
  props: {
    collection: oscDocumentProp,
    description: Property.ShortText({
      displayName: "What needs doing",
      required: true,
    }),
    source: Property.ShortText({
      displayName: "About this source",
      description: "Leave empty for a task about the whole collection.",
      required: false,
    }),
    owner: Property.ShortText({ displayName: "Owner", required: false }),
  },
  async run(context) {
    const id = oid();
    const source = context.propsValue.source?.trim();
    await applyToCollection(context, context.propsValue.collection, [
      {
        type: "CREATE_TASK",
        input: {
          id,
          description: context.propsValue.description,
          createdAt: now(),
          ...(source ? { source } : {}),
          ...(context.propsValue.owner
            ? { owner: context.propsValue.owner }
            : {}),
        },
      },
    ]);
    return { task: id };
  },
});
