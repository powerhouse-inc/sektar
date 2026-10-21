import type { IRelationalDb } from "@powerhousedao/reactor-browser";
import type { DB } from "./schema.js";

// Folder syncs keep their state on the mapping documents and in the manifest
// beside the files, so the processor's namespace holds no tables.
export async function up(_db: IRelationalDb<DB>): Promise<void> {
  // nothing to create
}

export async function down(_db: IRelationalDb<DB>): Promise<void> {
  // nothing to drop
}
