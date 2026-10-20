#!/usr/bin/env node
// Import a directory tree into a Files drive, as the Files app would file
// it: one folder per directory, one File document per file with the file
// stored as its source (and a text file's text as its first rendition).
//
//   node scripts/import-files.mjs <dir> [<dir> …] [--drive files]
//        [--switchboard http://localhost:7540] [--concurrency 6]
//        [--journal .ph/import-files.journal.json] [--limit N]
//
// Each <dir> becomes a top-level folder named after it. The journal makes a
// rerun resume: folders and files already filed are skipped, a file that
// failed is tried again.
//
// Per file: create the File document, put it in its folder (ADD_FILE),
// hash the bytes, set the source (the document now carries the ref), then
// send the bytes. That order is the store's rule: it accepts bytes only for
// a ref a document already carries.
import { openAsBlob } from "node:fs";
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { basename, dirname, extname, join, relative, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";

/* ------------------------------------------------------------- options */

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const at = args.indexOf(`--${name}`);
  if (at < 0) return fallback;
  const value = args[at + 1];
  args.splice(at, 2);
  return value;
};
const DRIVE = opt("drive", "files");
const SWITCHBOARD = opt("switchboard", "http://localhost:7540").replace(/\/+$/, "");
const CONCURRENCY = Number(opt("concurrency", "6"));
const JOURNAL = resolve(opt("journal", ".ph/import-files.journal.json"));
const LIMIT = Number(opt("limit", "0")) || Infinity;
const ROOTS = args.map((a) => resolve(a));
if (ROOTS.length === 0) {
  console.error("usage: node scripts/import-files.mjs <dir> [<dir> …] [--drive files]");
  process.exit(2);
}

// The attachment client, from the workspace's reactor-attachments build.
const here = dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const attachmentsEntry = resolve(here, "../../powerhouse/packages/reactor-attachments/dist/client.js");
const { createAttachmentClient, createRemoteAttachmentService } = await import(pathToFileURL(attachmentsEntry).href);
const attachments = createAttachmentClient(createRemoteAttachmentService({ remoteUrl: SWITCHBOARD }));

/* -------------------------------------------------------------- graphql */

async function gql(query, variables = {}, attempt = 1) {
  let response;
  try {
    response = await fetch(`${SWITCHBOARD}/graphql`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query, variables }),
      signal: AbortSignal.timeout(120_000),
    });
  } catch (error) {
    if (attempt < 5) {
      await sleep(1000 * attempt);
      return gql(query, variables, attempt + 1);
    }
    throw error;
  }
  const json = await response.json().catch(() => ({ errors: [{ message: `HTTP ${response.status}` }] }));
  if (json.errors?.length) {
    const message = json.errors.map((e) => e.message).join("; ");
    if (attempt < 5 && /timeout|ECONNRESET|busy|503|502/i.test(message)) {
      await sleep(1000 * attempt);
      return gql(query, variables, attempt + 1);
    }
    throw new Error(message);
  }
  return json.data;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------------------------------------------------------------- mime */

const MIME = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  heic: "image/heic",
  txt: "text/plain",
  csv: "text/csv",
  md: "text/markdown",
  html: "text/html",
  htm: "text/html",
  json: "application/json",
  xml: "application/xml",
  zip: "application/zip",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  odt: "application/vnd.oasis.opendocument.text",
  ods: "application/vnd.oasis.opendocument.spreadsheet",
  webloc: "application/x-webloc",
};
const mimeOf = (name) => MIME[extname(name).slice(1).toLowerCase()] ?? "application/octet-stream";
const TEXT_INLINE_MAX = 256 * 1024;
/**
 * Text that reads as is. Matched on whole types: "xml" alone also matches
 * Office's "openxmlformats", whose files are zip archives, and storing one
 * as text puts NUL bytes in a JSON column the database refuses.
 */
const isText = (mime) =>
  /^text\//.test(mime) ||
  /^application\/(json|xml|x-yaml|yaml|javascript|ld\+json)$/.test(mime) ||
  /\+(json|xml)$/.test(mime);

/** Names the drive refuses (control characters) or the OS litter we skip. */
const SKIP = /^(\.DS_Store|Thumbs\.db|desktop\.ini|\.dropbox.*|Icon\r)$/i;

/* ------------------------------------------------------------- journal */

let journal = { folders: {}, files: {} };
try {
  journal = JSON.parse(await readFile(JOURNAL, "utf8"));
} catch {
  // a first run
}
let dirty = false;
async function saveJournal() {
  if (!dirty) return;
  dirty = false;
  await mkdir(dirname(JOURNAL), { recursive: true });
  await writeFile(JOURNAL, JSON.stringify(journal));
}
const journalTimer = setInterval(() => void saveJournal(), 3000);

/* -------------------------------------------------------------- walking */

async function walk(root) {
  const folders = [];
  const files = [];
  const visit = async (dir) => {
    const entries = await readdir(dir, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const e of entries) {
      if (SKIP.test(e.name)) continue;
      const full = join(dir, e.name);
      if (e.isDirectory()) {
        folders.push(full);
        await visit(full);
      } else if (e.isFile()) {
        files.push(full);
      }
    }
  };
  folders.push(root);
  await visit(root);
  return { folders, files };
}

/** The journal key of a path: the top folder's name, then the path inside it. */
const keyOf = (root, full) => [basename(root), relative(root, full).replaceAll("\\", "/")].filter(Boolean).join("/");

/* -------------------------------------------------------------- folders */

/** One request per batch of folders: each its own ADD_FOLDER, in order. */
async function createFolders(batch) {
  const fields = batch
    .map(
      (f, i) =>
        `f${i}: addFolder(documentIdOrSlug: $drive, input: { id: $id${i}, name: $name${i}, parentFolder: $parent${i} }) { id }`,
    )
    .join("\n");
  const decl = batch.map((_, i) => `$id${i}: ID!, $name${i}: String!, $parent${i}: ID`).join(", ");
  const variables = { drive: DRIVE };
  batch.forEach((f, i) => {
    variables[`id${i}`] = f.id;
    variables[`name${i}`] = f.name;
    variables[`parent${i}`] = f.parent;
  });
  await gql(`mutation ($drive: String, ${decl}) { DocumentDrive { ${fields} } }`, variables);
}

/* ---------------------------------------------------------------- files */

async function importFile(root, full, parentFolder) {
  const key = keyOf(root, full);
  const entry = journal.files[key] ?? {};
  if (entry.done) return "skipped";
  const name = basename(full);
  const mimeType = mimeOf(name);
  const { size } = await stat(full);

  // 1. the File document, outside any drive, then filed in its folder
  if (!entry.id) {
    const created = await gql(
      `mutation ($name: String!) { File { createDocument(name: $name) { id } } }`,
      { name },
    );
    entry.id = created.File.createDocument.id;
    journal.files[key] = entry;
    dirty = true;
  }
  if (!entry.filed) {
    await gql(
      `mutation ($drive: String, $id: ID!, $name: String!, $parent: ID) {
        DocumentDrive { addFile(documentIdOrSlug: $drive, input: { id: $id, name: $name, documentType: "sektar/file", parentFolder: $parent }) { id } }
      }`,
      { drive: DRIVE, id: entry.id, name, parent: parentFolder },
    );
    entry.filed = true;
    dirty = true;
  }

  // 2. the bytes: hashed, referenced on the document, then sent
  const blob = await openAsBlob(full, { type: mimeType });
  const pre = await attachments.preprocess(blob, { fileName: name, mimeType });
  const now = new Date().toISOString();
  if (!entry.sourced) {
    await gql(
      `mutation ($id: String, $title: File_SetTitleInput!, $source: File_SetAttachmentSourceInput!) {
        File {
          t: setTitle(documentIdOrSlug: $id, input: $title) { id }
          s: setAttachmentSource(documentIdOrSlug: $id, input: $source) { id }
        }
      }`,
      {
        id: entry.id,
        title: { title: name },
        source: { ref: pre.ref, fileName: name, mimeType, sizeBytes: size, setAt: now },
      },
    );
    entry.sourced = true;
    dirty = true;
  }
  await attachments.upload({ preprocessed: pre });

  // 3. a small text file reads in the preview straight away
  if (isText(mimeType) && size <= TEXT_INLINE_MAX && !entry.text) {
    const text = await readFile(full, "utf8");
    await gql(
      `mutation ($id: String, $input: File_AddRenditionInput!) { File { addRendition(documentIdOrSlug: $id, input: $input) { id } } }`,
      {
        id: entry.id,
        input: { id: randomUUID(), mimeType, type: "text", label: "Text", text, createdAt: now },
      },
    );
    entry.text = true;
  }
  entry.done = true;
  dirty = true;
  return "imported";
}

/* ----------------------------------------------------------------- main */

const started = Date.now();
const stats = { folders: 0, imported: 0, skipped: 0, failed: 0, bytes: 0 };
const failures = [];

for (const root of ROOTS) {
  const { folders, files } = await walk(root);
  console.log(`${basename(root)}: ${folders.length} folders, ${files.length} files`);

  // Folders first, parents before children (the walk's order), in batches.
  const pending = [];
  for (const full of folders) {
    const key = keyOf(root, full);
    if (journal.folders[key]) continue;
    const parentKey = full === root ? null : keyOf(root, dirname(full));
    pending.push({ key, id: randomUUID(), name: basename(full), parentKey });
  }
  // Every new folder's id is known before any is sent: a parent in the same
  // batch as its child is not in the journal yet, and looking it up there
  // filed the child at the root.
  const newIds = new Map(pending.map((f) => [f.key, f.id]));
  const idOf = (key) => journal.folders[key] ?? newIds.get(key) ?? null;
  for (let at = 0; at < pending.length; at += 25) {
    const batch = pending.slice(at, at + 25).map((f) => ({
      ...f,
      parent: f.parentKey ? idOf(f.parentKey) : null,
    }));
    await createFolders(batch);
    for (const f of batch) journal.folders[f.key] = f.id;
    stats.folders += batch.length;
    dirty = true;
    process.stdout.write(`\r  folders ${Math.min(at + 25, pending.length)}/${pending.length}   `);
  }
  if (pending.length) process.stdout.write("\n");

  // Files, a few at a time.
  let next = 0;
  let done = 0;
  const todo = files.slice(0, LIMIT);
  const worker = async () => {
    while (next < todo.length) {
      const full = todo[next++];
      const parent = journal.folders[keyOf(root, dirname(full))] ?? null;
      try {
        const outcome = await importFile(root, full, parent);
        stats[outcome] += 1;
        if (outcome === "imported") stats.bytes += (await stat(full)).size;
      } catch (error) {
        stats.failed += 1;
        failures.push({ file: keyOf(root, full), error: String(error?.message ?? error).slice(0, 200) });
      }
      done += 1;
      if (done % 10 === 0 || done === todo.length) {
        const secs = (Date.now() - started) / 1000;
        process.stdout.write(
          `\r  files ${done}/${todo.length}  imported ${stats.imported}  skipped ${stats.skipped}  failed ${stats.failed}  ${(stats.bytes / 1048576).toFixed(0)} MB  ${(stats.imported / secs).toFixed(1)}/s   `,
        );
      }
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  process.stdout.write("\n");
  await saveJournal();
}

clearInterval(journalTimer);
dirty = true;
await saveJournal();
const secs = Math.round((Date.now() - started) / 1000);
console.log(JSON.stringify({ ...stats, mb: Math.round(stats.bytes / 1048576), seconds: secs }));
if (failures.length) {
  console.log(`failures (${failures.length}), first 20:`);
  for (const f of failures.slice(0, 20)) console.log(`  ${f.file}: ${f.error}`);
}
