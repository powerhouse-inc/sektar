/**
 * Upsert Documents — the step a flow uses to turn a list into documents.
 *
 * Generic on purpose: the list can be anything, the key is a path into each
 * item, and what gets written is a per-item template. The email flow is one
 * user of it; nothing here knows about mail.
 */
import { createAction, Property } from "@powerhousedao/pieces-framework";
import { compileTemplate } from "./template.js";
import { DEFAULT_LIMIT, runUpsert } from "./upsert.js";

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== ""
    ? value.trim()
    : undefined;
}

export const distyraUpsertDocumentsAction = createAction({
  // Saved workflows refer to the action by name: don't rename it once published
  name: "upsert-documents",
  // Reaches the reactor, not Distyra.
  requireAuth: false,
  requireReactor: "write",
  displayName: "Upsert Documents",
  description:
    "One document per item of a list, deduplicated on a key: an item whose key is already held by a document of the type in the drive updates that document, any other is created and filed in the folder. Documents are found by a slug made from their key, so a batch costs one indexed read. Templates use $item.<path> and $index. Safe to rerun — the lookup precedes every create. Outputs references by outcome: created, updated, skipped, failed.",
  props: {
    items: Property.Json({
      displayName: "Items",
      description:
        "The list to upsert, e.g. {{steps.map_emails.output.items}}. A single item is accepted and wrapped.",
      required: true,
    }),
    documentType: Property.ShortText({
      displayName: "Document type",
      description: "The model of the documents, e.g. sektar/email.",
      required: true,
    }),
    driveId: Property.ShortText({
      displayName: "Drive",
      description:
        "The drive the documents live in. Also the scope of the lookup: only documents of the type in this drive count as existing.",
      required: true,
    }),
    folderId: Property.ShortText({
      displayName: "Folder",
      description: "A folder id to file new documents in. Omit for the drive root.",
      required: false,
    }),
    folderName: Property.ShortText({
      displayName: "Folder by name",
      description:
        "File new documents in a folder of this name under the folder above (or the root), creating it when missing. May vary per item: $item.account.name.",
      required: false,
    }),
    itemKeyPath: Property.ShortText({
      displayName: "Item key",
      description:
        "Path into each item that yields its identity, e.g. id or key. Items without one are skipped and reported.",
      required: true,
      defaultValue: "key",
    }),
    keyPrefix: Property.ShortText({
      displayName: "Key prefix",
      description:
        "Prepended to the item key, e.g. gmail: — so the key compared against documents is gmail:<id>. Leave empty when the item key is already namespaced.",
      required: false,
    }),
    documentKeyPath: Property.ShortText({
      displayName: "Document key",
      description:
        "Path in the document state holding the key, e.g. externalId.",
      required: true,
      defaultValue: "externalId",
    }),
    name: Property.ShortText({
      displayName: "Document name",
      description:
        "Per-item template for a new document's name, e.g. $item.name. Falls back to the key.",
      required: false,
    }),
    createActions: Property.LongText({
      displayName: "Actions on create",
      description:
        'Sent to a new document right after it is created. Either a placeholder that resolves to a list, e.g. $item.actions, or a JSON list with placeholders inside: [{ "type": "SET_TITLE", "input": { "title": "$item.name" } }].',
      required: false,
    }),
    updateActions: Property.LongText({
      displayName: "Actions on update",
      description:
        "Sent to a document that already holds the key. Same forms as above; defaults to the create actions. Use it to leave out actions that must not repeat, such as adding attachments.",
      required: false,
    }),
    limit: Property.Number({
      displayName: "Limit",
      description: `At most this many items are written; the rest are reported as skipped. Default ${DEFAULT_LIMIT}.`,
      required: false,
    }),
    stopOnError: Property.Checkbox({
      displayName: "Stop on first failure",
      description:
        "Off by default: a failing item is reported and the batch carries on. On, the step fails at the first item that does, naming it.",
      required: false,
    }),
    lookup: Property.StaticDropdown({
      displayName: "Find existing documents by",
      description:
        "Key index (default): the switchboard's key index knows every document of the type that holds a key, whatever created it — one small query per batch. Slug: documents this step creates carry a slug made from their key and are found by it; blind to documents made any other way. Scan: every document of the type in the drive is read with its state — a thousand emails is a hundred megabytes per run; never on a schedule.",
      required: false,
      defaultValue: "index",
      options: {
        options: [
          { label: "Key index (switchboard)", value: "index" },
          { label: "Slug (documents this step created)", value: "slug" },
          { label: "Scan every document (slow, legacy)", value: "scan" },
        ],
      },
    }),
    indexUrl: Property.ShortText({
      displayName: "Key index URL",
      description:
        "The switchboard that hosts the key index. Leave blank for this reactor's own.",
      required: false,
      advanced: true,
    }),
  },
  async run(context) {
    const p = context.propsValue;
    const itemKeyPath = text(p.itemKeyPath);
    const documentKeyPath = text(p.documentKeyPath);
    if (!itemKeyPath) throw new Error('"Item key" is required.');
    if (!documentKeyPath) throw new Error('"Document key" is required.');
    return runUpsert(context.reactor, {
      items: p.items,
      documentType: p.documentType.trim(),
      driveId: p.driveId.trim(),
      folderId: text(p.folderId),
      folderName: compileTemplate(p.folderName, "Folder by name"),
      itemKeyPath,
      keyPrefix: text(p.keyPrefix),
      documentKeyPath,
      name: compileTemplate(p.name, "Document name"),
      createActions: compileTemplate(p.createActions, "Actions on create"),
      updateActions: compileTemplate(p.updateActions, "Actions on update"),
      limit: typeof p.limit === "number" ? p.limit : undefined,
      stopOnError: p.stopOnError === true,
      lookup:
        p.lookup === "scan" ? "scan" : p.lookup === "slug" ? "slug" : "index",
      indexUrl: text(p.indexUrl),
    });
  },
});
