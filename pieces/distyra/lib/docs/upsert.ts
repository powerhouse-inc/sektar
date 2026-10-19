/**
 * Upsert — many documents from one list, deduplicated on a key.
 *
 * The property that makes a batch write safe at all is that a rerun
 * converges: every create is preceded by a lookup on a stable key, so a
 * retry after a timed-out write finds what the first attempt made and
 * updates it instead of filing it twice. Everything else here follows from
 * that: the lookup is done once for the whole batch, items are deduplicated
 * among themselves before anything is written, and the output reports every
 * item by outcome rather than collapsing to a count.
 *
 * Reads and writes go through the reactor client the framework hands a
 * step. executeBatch is refused to pieces, so this is one job per document
 * and one drive write for every ADD_FILE; the lookup pages through find,
 * which filters on type and parent only, so the key comparison happens here.
 */
import { toGlobalAction } from "../osc/client.js";
import { asText, valueAt, type Template } from "./template.js";

export const DEFAULT_LIMIT = 100;
const PAGE = 100;
const BRANCH = "main";

/** The slice of a document this step reads or makes. */
export interface DocumentLike {
  header: { id: string; name: string; documentType: string };
  state: unknown;
}

export interface ModuleLike {
  documentModel: { global: { id: string } };
  utils: { createDocument: () => DocumentLike };
}

export interface ActionLike {
  type: string;
  input?: unknown;
}

/** The reactor calls the upsert makes, narrow enough to fake in a test. */
export interface UpsertReactor {
  get(identifier: string): Promise<DocumentLike>;
  find(
    search: { type?: string; parentId?: string },
    view: undefined,
    paging: { cursor: string; limit: number },
  ): Promise<{ results: DocumentLike[]; nextCursor?: string }>;
  create(
    document: DocumentLike,
    parentIdentifier?: string,
  ): Promise<DocumentLike>;
  execute(
    identifier: string,
    branch: string,
    actions: ReturnType<typeof toGlobalAction>[],
  ): Promise<DocumentLike>;
  getDocumentModelModule(documentType: string): Promise<ModuleLike>;
}

export interface UpsertOptions {
  items: unknown;
  documentType: string;
  driveId: string;
  /** A folder id the documents are filed in; the drive root otherwise. */
  folderId?: string;
  /** A folder by name, created under folderId (or the root) when absent; may use $item. */
  folderName?: Template;
  itemKeyPath: string;
  keyPrefix?: string;
  documentKeyPath: string;
  name?: Template;
  createActions?: Template;
  /** Sent to an existing document; defaults to the create actions. */
  updateActions?: Template;
  limit?: number;
  stopOnError?: boolean;
}

export interface Skipped {
  index: number;
  reason: string;
}

export interface Failed {
  index: number;
  key: string;
  error: string;
}

export interface Written {
  index: number;
  key: string;
  documentId: string;
  documentType: string;
  name: string;
}

export interface UpsertResult {
  created: Written[];
  updated: Written[];
  skipped: Skipped[];
  failed: Failed[];
  counts: {
    items: number;
    created: number;
    updated: number;
    skipped: number;
    failed: number;
  };
}

/** A Json prop arrives as whatever it was given; only a list can be upserted. */
export function asList(value: unknown): unknown[] {
  if (value === null || value === undefined || value === "") return [];
  if (typeof value === "string") {
    const text = value.trim();
    if (text.startsWith("[")) {
      try {
        return asList(JSON.parse(text));
      } catch {
        return [value];
      }
    }
    return [value];
  }
  return Array.isArray(value) ? value : [value];
}

/** A key is text; a number is accepted since ids often are; nothing else. */
export function asKey(value: unknown): string | undefined {
  if (typeof value === "string") return value.trim() || undefined;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return undefined;
}

export interface PlannedItem {
  index: number;
  item: unknown;
  key: string;
}

export interface Plan {
  entries: PlannedItem[];
  skipped: Skipped[];
}

/**
 * Keys first, before anything is written: an item without one is reported,
 * never silently dropped, and a key seen twice in one batch resolves to its
 * first item so two entries never race for the same document.
 */
export function planUpsert(
  items: unknown[],
  keyPath: string,
  prefix: string | undefined,
  limit: number,
): Plan {
  const entries: PlannedItem[] = [];
  const skipped: Skipped[] = [];
  const seen = new Map<string, number>();
  items.forEach((item, index) => {
    if (entries.length >= limit) {
      skipped.push({ index, reason: `beyond the limit of ${limit}` });
      return;
    }
    const raw = asKey(valueAt(item, keyPath));
    if (raw === undefined) {
      skipped.push({ index, reason: `no key at "${keyPath}"` });
      return;
    }
    const key = `${prefix ?? ""}${raw}`;
    const first = seen.get(key);
    if (first !== undefined) {
      skipped.push({ index, reason: `duplicate of item ${first} (${key})` });
      return;
    }
    seen.set(key, index);
    entries.push({ index, item, key });
  });
  return { entries, skipped };
}

/** The global state, whether the reactor wrapped it in its scope or not. */
export function globalStateOf(state: unknown): unknown {
  const outer = state as { global?: unknown } | null;
  return outer && typeof outer === "object" && "global" in outer
    ? outer.global
    : state;
}

/** Every document of the type in the drive, by the value at the key path. */
export async function indexByKey(
  reactor: UpsertReactor,
  documentType: string,
  driveId: string,
  keyPath: string,
): Promise<Map<string, DocumentLike>> {
  const index = new Map<string, DocumentLike>();
  let cursor = "";
  for (;;) {
    const page = await reactor.find(
      { type: documentType, parentId: driveId },
      undefined,
      { cursor, limit: PAGE },
    );
    for (const document of page.results) {
      const key = asKey(valueAt(globalStateOf(document.state), keyPath));
      // First wins: two documents under one key is a problem the index
      // cannot fix, and updating the older one is the predictable choice.
      if (key !== undefined && !index.has(key)) index.set(key, document);
    }
    if (!page.nextCursor || page.results.length === 0) break;
    cursor = page.nextCursor;
  }
  return index;
}

interface DriveNode {
  id: string;
  kind: string;
  name: string;
  parentFolder?: string | null;
}

function nodesOf(drive: DocumentLike): DriveNode[] {
  const state = globalStateOf(drive.state) as { nodes?: unknown } | null;
  const nodes = state && typeof state === "object" ? state.nodes : undefined;
  return Array.isArray(nodes) ? (nodes as DriveNode[]) : [];
}

/** Folders by name under a parent, created once per batch when missing. */
class Folders {
  private nodes: DriveNode[] | undefined;

  constructor(
    private readonly reactor: UpsertReactor,
    private readonly driveId: string,
  ) {}

  async resolve(
    name: string,
    parentFolder: string | undefined,
  ): Promise<string> {
    this.nodes ??= nodesOf(await this.reactor.get(this.driveId));
    const existing = this.nodes.find(
      (node) =>
        node.kind === "folder" &&
        node.name === name &&
        (node.parentFolder ?? undefined) === parentFolder,
    );
    if (existing) return existing.id;
    const id = crypto.randomUUID();
    await this.reactor.execute(this.driveId, BRANCH, [
      toGlobalAction({
        type: "ADD_FOLDER",
        input: { id, name, parentFolder: parentFolder ?? null },
      }),
    ]);
    this.nodes.push({
      id,
      kind: "folder",
      name,
      parentFolder: parentFolder ?? null,
    });
    return id;
  }
}

function actionsFrom(value: unknown, label: string): ActionLike[] {
  if (value === undefined || value === null || value === "") return [];
  const list = Array.isArray(value) ? value : [value];
  return list.map((entry, position) => {
    const candidate = entry as { type?: unknown; input?: unknown } | null;
    if (
      !candidate ||
      typeof candidate !== "object" ||
      typeof candidate.type !== "string" ||
      candidate.type.trim() === ""
    ) {
      throw new Error(
        `${label}[${position}] is not an action: expected { "type": …, "input": … }`,
      );
    }
    return { type: candidate.type, input: candidate.input };
  });
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function runUpsert(
  reactor: UpsertReactor,
  options: UpsertOptions,
): Promise<UpsertResult> {
  const items = asList(options.items);
  const limit = Math.max(1, Math.floor(options.limit ?? DEFAULT_LIMIT));
  const plan = planUpsert(
    items,
    options.itemKeyPath,
    options.keyPrefix,
    limit,
  );
  const result: UpsertResult = {
    created: [],
    updated: [],
    skipped: [...plan.skipped],
    failed: [],
    counts: {
      items: items.length,
      created: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
    },
  };
  if (plan.entries.length === 0) return finish(result);

  const index = await indexByKey(
    reactor,
    options.documentType,
    options.driveId,
    options.documentKeyPath,
  );
  const folders = new Folders(reactor, options.driveId);
  // Fetched lazily: a batch that only updates never needs the model.
  let module: ModuleLike | undefined;

  for (const entry of plan.entries) {
    const { index: position, item, key } = entry;
    try {
      const existing = index.get(key);
      if (existing) {
        const template = options.updateActions ?? options.createActions;
        const actions = actionsFrom(
          template?.(item, position),
          "updateActions",
        );
        if (actions.length > 0) {
          await reactor.execute(
            existing.header.id,
            BRANCH,
            actions.map(toGlobalAction),
          );
        }
        result.updated.push(written(entry, existing));
        continue;
      }

      module ??= await reactor.getDocumentModelModule(options.documentType);
      const documentType = module.documentModel.global.id;
      // Rendered before anything is written, so a bad template costs no
      // stray document.
      const actions = actionsFrom(
        options.createActions?.(item, position),
        "createActions",
      );
      const name = asText(options.name?.(item, position)).trim() || key;
      let folder = options.folderId;
      if (options.folderName) {
        const folderName = asText(options.folderName(item, position)).trim();
        if (folderName !== "") {
          folder = await folders.resolve(folderName, folder);
        }
      }

      const draft = module.utils.createDocument();
      draft.header.name = name;
      const created = await reactor.create(draft, options.driveId);
      await reactor.execute(options.driveId, BRANCH, [
        toGlobalAction({
          type: "ADD_FILE",
          input: {
            id: created.header.id,
            name: created.header.name || name,
            documentType,
            parentFolder: folder ?? null,
          },
        }),
      ]);
      if (actions.length > 0) {
        await reactor.execute(
          created.header.id,
          BRANCH,
          actions.map(toGlobalAction),
        );
      }
      // Visible to a later item in this batch, should its key repeat after
      // a prefix collision the planner could not see.
      index.set(key, created);
      result.created.push(written(entry, created));
    } catch (error) {
      result.failed.push({ index: position, key, error: errorText(error) });
      if (options.stopOnError) {
        throw new Error(
          `Item ${position} (${key}) failed: ${errorText(error)}. ` +
            `${result.created.length} created and ${result.updated.length} updated before it; the rest were not attempted.`,
        );
      }
    }
  }
  return finish(result);
}

function written(entry: PlannedItem, document: DocumentLike): Written {
  return {
    index: entry.index,
    key: entry.key,
    documentId: document.header.id,
    documentType: document.header.documentType,
    name: document.header.name,
  };
}

function finish(result: UpsertResult): UpsertResult {
  result.skipped.sort((a, b) => a.index - b.index);
  result.counts.created = result.created.length;
  result.counts.updated = result.updated.length;
  result.counts.skipped = result.skipped.length;
  result.counts.failed = result.failed.length;
  return result;
}
