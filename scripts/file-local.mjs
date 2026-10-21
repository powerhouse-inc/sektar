#!/usr/bin/env node
// File local PDFs (downloads, scans) into the Files drive's kwartaalaangiftes
// folders, as File documents. The counterpart of file-quarter.mjs for documents
// that did not arrive by mail.
//
//   node scripts/file-local.mjs <plan.json> [--drive files] [--root kwartaalaangiftes]
//        [--switchboard http://localhost:7540] [--dry-run]
//
// The plan is a list of items:
//   { path: "D:/.../20260730-radius-fuel.pdf", quarter: "2026-Q3",
//     folder: "accounts-payable/radius", description: "Peppol invoice" }
// The file keeps its own name. A file of that name already in the folder is
// skipped, and a journal makes a rerun resume.
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const args = process.argv.slice(2);
const flag = (n) => {
  const i = args.indexOf(`--${n}`);
  if (i < 0) return false;
  args.splice(i, 1);
  return true;
};
const opt = (n, d) => {
  const i = args.indexOf(`--${n}`);
  if (i < 0) return d;
  const v = args[i + 1];
  args.splice(i, 2);
  return v;
};
const DRY = flag("dry-run");
const DRIVE = opt("drive", "files");
const ROOT = opt("root", "kwartaalaangiftes");
const SWITCHBOARD = opt("switchboard", "http://localhost:7540").replace(/\/+$/, "");
const JOURNAL = resolve(opt("journal", ".ph/file-local.journal.json"));
const plan = JSON.parse(readFileSync(resolve(args[0]), "utf8"));

const here = dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const { createAttachmentClient, createRemoteAttachmentService } = await import(
  pathToFileURL(resolve(here, "../../powerhouse/packages/reactor-attachments/dist/client.js")).href
);
const attachments = createAttachmentClient(createRemoteAttachmentService({ remoteUrl: SWITCHBOARD }));

async function gql(query, variables = {}) {
  const r = await fetch(`${SWITCHBOARD}/graphql`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(120_000),
  });
  const j = await r.json();
  if (j.errors?.length) throw new Error(j.errors.map((e) => e.message).join("; "));
  return j.data;
}

let journal = { files: {} };
try {
  journal = JSON.parse(readFileSync(JOURNAL, "utf8"));
} catch {
  // a first run
}
const save = async () => {
  await mkdir(dirname(JOURNAL), { recursive: true });
  await writeFile(JOURNAL, JSON.stringify(journal, null, 1));
};

const driveDoc = (await gql(`query ($d: String!) { document(idOrSlug: $d) { document { id state } } }`, { d: DRIVE })).document.document;
const DRIVE_ID = driveDoc.id;
const nodes = [...(driveDoc.state.global ?? driveDoc.state).nodes];
const root = nodes.find((n) => n.kind === "folder" && n.name === ROOT && !n.parentFolder);
if (!root) throw new Error(`No ${ROOT} folder in the ${DRIVE} drive`);
const childFolder = (parent, name) => nodes.find((n) => n.kind === "folder" && n.parentFolder === parent && n.name === name);

async function ensureFolder(path) {
  let parent = root.id;
  for (const name of path.split("/").filter(Boolean)) {
    let f = childFolder(parent, name);
    if (!f) {
      f = { id: randomUUID(), name, kind: "folder", parentFolder: parent };
      if (!DRY)
        await gql(
          `mutation ($d: String, $i: DocumentDrive_AddFolderInput!) { DocumentDrive { addFolder(documentIdOrSlug: $d, input: $i) { id } } }`,
          { d: DRIVE_ID, i: { id: f.id, name, parentFolder: parent } },
        );
      nodes.push(f);
    }
    parent = f.id;
  }
  return parent;
}

async function fileOne(blob, name, folderId, description) {
  const created = await gql(`mutation ($n: String!) { File { createDocument(name: $n) { id } } }`, { n: name });
  const id = created.File.createDocument.id;
  await gql(
    `mutation ($d: String, $id: ID!, $n: String!, $p: ID) { DocumentDrive { addFile(documentIdOrSlug: $d, input: { id: $id, name: $n, documentType: "sektar/file", parentFolder: $p }) { id } } }`,
    { d: DRIVE_ID, id, n: name, p: folderId },
  );
  const pre = await attachments.preprocess(blob, { fileName: name, mimeType: "application/pdf" });
  await gql(
    `mutation ($id: String, $t: File_SetTitleInput!, $ds: File_SetDescriptionInput!, $s: File_SetAttachmentSourceInput!) {
      File {
        t: setTitle(documentIdOrSlug: $id, input: $t) { id }
        d: setDescription(documentIdOrSlug: $id, input: $ds) { id }
        s: setAttachmentSource(documentIdOrSlug: $id, input: $s) { id }
      }
    }`,
    {
      id,
      t: { title: name },
      ds: { description },
      s: { ref: pre.ref, fileName: name, mimeType: "application/pdf", sizeBytes: blob.size, setAt: new Date().toISOString() },
    },
  );
  await attachments.upload({ preprocessed: pre });
  nodes.push({ id, name, kind: "file", parentFolder: folderId });
  return id;
}

const counts = { filed: 0, skipped: 0, failed: 0 };
for (const item of plan) {
  const name = basename(item.path);
  const folderPath = [item.quarter, item.folder].filter(Boolean).join("/");
  const jkey = `${folderPath}/${name}`;
  if (journal.files[jkey]) {
    counts.skipped++;
    continue;
  }
  const existing = folderPath.split("/").reduce((id, part) => (id ? childFolder(id, part)?.id : undefined), root.id);
  if (existing && nodes.some((n) => n.parentFolder === existing && n.kind !== "folder" && n.name === name)) {
    console.log(`  = ${jkey}: already there`);
    counts.skipped++;
    continue;
  }
  if (DRY) {
    console.log(`  + ${jkey}`);
    counts.filed++;
    continue;
  }
  try {
    const folderId = await ensureFolder(folderPath);
    const blob = new Blob([readFileSync(item.path)], { type: "application/pdf" });
    journal.files[jkey] = await fileOne(blob, name, folderId, item.description);
    await save();
    counts.filed++;
    console.log(`  + ${jkey} (${Math.round(blob.size / 1024)} KB)`);
  } catch (e) {
    counts.failed++;
    console.warn(`  ! ${jkey}: ${e instanceof Error ? e.message : String(e)}`);
  }
}
console.log(counts);
