/**
 * Map Records — the adapter between a fetch step and a capture step.
 *
 * Its own step rather than props bolted onto Capture Sources, because the
 * whole value of a backfill is being able to look at what is about to be
 * written before it is written. Testing this step shows you the exact
 * records, identifiers and attachment refs the capture will store; folding
 * it into the capture would leave "it wrote 214 sources" as the only
 * evidence of a mapping that could be wrong in a dozen quiet ways.
 *
 * It is provider-agnostic on purpose. Gmail and Dropbox are the first two
 * users and neither is named in here — the differences between them are all
 * expressible as paths, which is the test of whether this is the right shape.
 */
import { createAction, Property } from "@powerhousedao/pieces-framework";
import { mapRecords, type MappingSpec } from "./mapping.js";

/** A Json prop arrives as whatever it was given; only a list can be mapped. */
function asList(value: unknown): unknown[] {
  if (value === null || value === undefined || value === "") return [];
  return Array.isArray(value) ? value : [value];
}

/** A comma-separated prop, emptied of blanks. */
function asCsv(value: unknown): string[] {
  if (typeof value !== "string") return [];
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry !== "");
}

function optional(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== ""
    ? value.trim()
    : undefined;
}

export const distyraOscMapRecordsAction = createAction({
  name: "osc-map-records",
  // Reaches nothing: this step is arithmetic on the previous step's output.
  requireAuth: false,
  displayName: "Map Records",
  description:
    "Turn a provider's records into capture records. Reads the identifier, title, dates and attachments out of each one by path, namespaces the identifier, and optionally keeps only the file types and the time window you want. The record itself is carried through untouched as the payload. Feed the output straight to Capture Sources.",
  props: {
    records: Property.Json({
      displayName: "Records",
      description:
        "The list to map, e.g. {{steps.find.output.results.messages}} for Gmail or {{steps.list.output.entries}} for Dropbox.",
      required: true,
    }),
    namespace: Property.ShortText({
      displayName: "Namespace",
      description:
        "What system these came from: gmail, dropbox. The identifier becomes namespace:id, which is what stops an id from one system colliding with an id from another.",
      required: true,
    }),
    idPath: Property.ShortText({
      displayName: "Identifier field",
      description:
        "Path to the id within a record. Dotted paths work: id, file.id. Pick something that survives a rename — a path does not.",
      required: true,
      defaultValue: "id",
    }),
    aliasPaths: Property.ShortText({
      displayName: "Alias fields",
      description:
        "Comma-separated extra identifiers, each field or namespace:field. rfc822:messageId files a Message-ID under its own namespace rather than pretending it is a Gmail id. A second sighting under any of these lands on the record that already exists.",
      required: false,
    }),
    titlePath: Property.ShortText({
      displayName: "Title field",
      required: false,
    }),
    contentPath: Property.ShortText({
      displayName: "Content field",
      description: "The body, if the record has one. Gmail: text.",
      required: false,
    }),
    originPath: Property.ShortText({
      displayName: "Origin field",
      description:
        "A URL the record can be opened at. Anything that is not a valid URL is left off rather than passed on to be rejected at capture.",
      required: false,
    }),
    occurredAtPath: Property.ShortText({
      displayName: "Happened-at field",
      description:
        "When it happened at the source, as opposed to when we got it. Gmail: date. Dropbox: server_modified.",
      required: false,
    }),
    tags: Property.ShortText({
      displayName: "Tags",
      description: "Comma-separated, applied to every record in the batch.",
      required: false,
    }),
    namePath: Property.ShortText({
      displayName: "Filename field",
      description: "Only needed when filtering by file type. Dropbox: name.",
      required: false,
    }),
    extensions: Property.ShortText({
      displayName: "File types",
      description:
        "Comma-separated and without the dot: pdf,jpg,png. Empty keeps everything. Folders carry no extension, so this drops them too.",
      required: false,
    }),
    attachmentsPath: Property.ShortText({
      displayName: "Attachments field",
      description:
        "Path to the attachment list. Gmail: attachments — the search step has already written the bytes to the attachment store, so what is mapped here are references to files that exist.",
      required: false,
    }),
    attachmentRefPath: Property.ShortText({
      displayName: "Attachment reference field",
      description:
        "Where the attachment:// reference sits on each attachment. Gmail calls it data.",
      required: false,
      defaultValue: "data",
    }),
    attachmentNamePath: Property.ShortText({
      displayName: "Attachment filename field",
      required: false,
      defaultValue: "fileName",
    }),
    attachmentSizePath: Property.ShortText({
      displayName: "Attachment size field",
      required: false,
      defaultValue: "size",
    }),
    attachmentMimePath: Property.ShortText({
      displayName: "Attachment type field",
      required: false,
      defaultValue: "mimeType",
    }),
    windowPath: Property.ShortText({
      displayName: "Window field",
      description:
        "The date the window is applied to. Set this when the provider cannot filter by date itself, which is what makes a queue's weekly slice actually mean that week.",
      required: false,
    }),
    from: Property.ShortText({
      displayName: "From",
      description:
        "Inclusive lower bound, e.g. {{trigger.payload.ranges.week.from}}.",
      required: false,
    }),
    to: Property.ShortText({
      displayName: "To",
      description:
        "Exclusive upper bound, e.g. {{trigger.payload.ranges.week.to}}. Half-open, so a record exactly on the boundary belongs to the next slice and is not captured twice.",
      required: false,
    }),
  },
  // Returns a resolved promise rather than being async: there is nothing to
  // await here, which is the point — this step is arithmetic, not I/O.
  run(context) {
    const input = context.propsValue;
    const spec: MappingSpec = {
      namespace: input.namespace.trim(),
      idPath: input.idPath.trim(),
      aliasPaths: asCsv(input.aliasPaths),
      titlePath: optional(input.titlePath),
      contentPath: optional(input.contentPath),
      originPath: optional(input.originPath),
      occurredAtPath: optional(input.occurredAtPath),
      tags: asCsv(input.tags),
      namePath: optional(input.namePath),
      extensions: asCsv(input.extensions),
      attachments: {
        path: optional(input.attachmentsPath),
        refPath: optional(input.attachmentRefPath) ?? "data",
        namePath: optional(input.attachmentNamePath) ?? "fileName",
        sizePath: optional(input.attachmentSizePath),
        mimePath: optional(input.attachmentMimePath),
      },
      windowPath: optional(input.windowPath),
      from: optional(input.from),
      to: optional(input.to),
    };

    const result = mapRecords(asList(input.records), spec);

    // Ready to hand to the reactor piece's Dispatch step.
    //
    // Only `@powerhousedao/piece-reactor` is given reactor access — the host
    // decides that by package name (`servesReactorPort`), so no third-party
    // piece can write a document itself. Everything that touches the reactor
    // therefore goes through Dispatch, and a step like this one earns its
    // place by preparing the actions rather than applying them.
    //
    // `id` and `capturedAt` are minted here because a reducer may not: they
    // have to arrive in the action's input.
    const capturedAt = new Date().toISOString();
    const dispatchActions = result.records.map((record) => ({
      type: "CAPTURE_SOURCE",
      input: { id: crypto.randomUUID(), capturedAt, ...record },
    }));

    return Promise.resolve({
      dispatchActions,
      ...result,
      // What came in, so a run that mapped nothing can be told apart from one
      // that was handed nothing. They have very different causes.
      received: asList(input.records).length,
      attachments: result.records.reduce(
        (total, record) => total + record.attachments.length,
        0,
      ),
    });
  },
});
