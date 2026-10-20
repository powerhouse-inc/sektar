#!/usr/bin/env node
// File a quarter's purchase documents from the mail into the Files drive's
// kwartaalaangiftes folders, as File documents.
//
//   node scripts/file-quarter.mjs <plan.json> [--drive files] [--root kwartaalaangiftes]
//        [--switchboard http://localhost:7540] [--chrome <path to chrome.exe>] [--dry-run]
//
// The plan is a list of items, one per mail:
//   { mail, quarter: "2026-Q3", folder: "accounts-payable/aws",
//     take: "attachments", files: [{ fileName, ref }] }      the mail's PDFs, as they are
//   { mail, quarter, folder, take: "print", name: "20260921-icloud.pdf" }
//                                                            the mail printed to PDF
// A printed mail is the Mail app's printable page (editors/sektar/kit/email-print.ts,
// the same function its Print button uses) rendered by a headless Chromium.
//
// A file already in the quarter's folder, or in the quarter before it under
// the same name (an invoice of the last days of a quarter mailed in the
// first days of the next), is skipped. A journal makes a rerun resume.
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { emailPrintHtml } from "../editors/sektar/kit/email-print.ts";

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
const CHROME = opt("chrome", process.env.CHROME_PATH ?? `${process.env.LOCALAPPDATA}/ms-playwright/chromium-1223/chrome-win64/chrome.exe`);
const JOURNAL = resolve(opt("journal", ".ph/file-quarter.journal.json"));
const PLAYWRIGHT = opt("playwright", `${process.env.APPDATA}/nvm/v24.19.0/node_modules/@playwright/cli/node_modules/playwright-core/index.mjs`);
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

/* ------------------------------------------------------------- journal */

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

/* ------------------------------------------------------------- folders */

const driveDoc = (await gql(`query ($d: String!) { document(idOrSlug: $d) { document { id state } } }`, { d: DRIVE })).document.document;
const DRIVE_ID = driveDoc.id;
const nodes = [...(driveDoc.state.global ?? driveDoc.state).nodes];
const root = nodes.find((n) => n.kind === "folder" && n.name === ROOT && !n.parentFolder);
if (!root) throw new Error(`No ${ROOT} folder in the ${DRIVE} drive`);
const childFolder = (parent, name) => nodes.find((n) => n.kind === "folder" && n.parentFolder === parent && n.name === name);

async function ensureFolder(path) {
  let parent = root.id;
  for (const name of path.split("/")) {
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

/** Every file name under a folder, at any depth. */
function namesUnder(folderId) {
  const out = new Set();
  const walk = (id) => {
    for (const n of nodes.filter((x) => x.parentFolder === id)) {
      if (n.kind === "folder") walk(n.id);
      else out.add(n.name);
    }
  };
  if (folderId) walk(folderId);
  return out;
}

/** "Invoice_EUINBE26_179713.pdf" and "EUINBE26-179713.pdf" are the same invoice. */
const key = (name) => name.toLowerCase().replace(/\.[a-z0-9]+$/, "").replace(/invoice/g, "").replace(/[^a-z0-9]/g, "");
const sameFile = (a, b) => {
  const [x, y] = [key(a), key(b)];
  return x === y || (Math.min(x.length, y.length) >= 6 && (x.includes(y) || y.includes(x)));
};
const previousQuarter = (q) => {
  const [y, n] = q.split("-Q").map(Number);
  return n === 1 ? `${y - 1}-Q4` : `${y}-Q${n - 1}`;
};

/* ---------------------------------------------------------------- mail */

const mailCache = new Map();
async function mailState(id) {
  if (!mailCache.has(id)) {
    const d = await gql(`query ($id: String!) { document(idOrSlug: $id) { document { state } } }`, { id });
    mailCache.set(id, d.document.document.state.global);
  }
  return mailCache.get(id);
}

async function bytesOf(mailId, ref) {
  const { blob } = await attachments.downloadBlob({ documentId: mailId, ref });
  return blob;
}

let browser;
async function printMail(mailId) {
  const s = await mailState(mailId);
  const cids = new Map();
  for (const a of s.attachments.filter((x) => x.contentId)) {
    try {
      const blob = await bytesOf(mailId, a.ref);
      const b64 = Buffer.from(await blob.arrayBuffer()).toString("base64");
      cids.set(a.contentId.replace(/^<|>$/g, "").toLowerCase(), `data:${a.mimeType ?? "application/octet-stream"};base64,${b64}`);
    } catch {
      // an inline image that will not load is left out
    }
  }
  const html = emailPrintHtml(s, { resolveCid: (cid) => cids.get(cid.replace(/^<|>$/g, "").toLowerCase()) });
  if (!browser) {
    const { chromium } = await import(pathToFileURL(PLAYWRIGHT).href);
    browser = await chromium.launch({ executablePath: existsSync(CHROME) ? CHROME : undefined });
  }
  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: "networkidle", timeout: 45_000 }).catch(() => page.setContent(html, { waitUntil: "load" }));
    const pdf = await page.pdf({ format: "A4", printBackground: true, preferCSSPageSize: true });
    return new Blob([pdf], { type: "application/pdf" });
  } finally {
    await page.close();
  }
}

/* ---------------------------------------------------------------- file */

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

/* ---------------------------------------------------------------- main */

const counts = { filed: 0, skipped: 0, earlier: 0, failed: 0 };
for (const item of plan) {
  const s = await mailState(item.mail);
  const sender = s.from?.[0]?.name || s.from?.[0]?.address || "";
  const when = (s.sentAt ?? s.receivedAt ?? "").slice(0, 10);
  const description = `From the mail of ${when} by ${sender}: ${s.subject ?? "(no subject)"}${item.take === "print" ? " (the mail, printed)" : ""}`;
  const wanted = item.take === "print" ? [{ fileName: item.name }] : item.files;
  const quarterFolder = childFolder(root.id, item.quarter);
  const before = namesUnder(childFolder(root.id, previousQuarter(item.quarter))?.id);
  for (const f of wanted) {
    const jkey = `${item.quarter}/${item.folder}/${f.fileName}`;
    if (journal.files[jkey]) {
      counts.skipped++;
      continue;
    }
    if ([...before].some((n) => sameFile(n, f.fileName))) {
      console.log(`  = ${jkey}: already in ${previousQuarter(item.quarter)}`);
      counts.earlier++;
      continue;
    }
    if ([...namesUnder(quarterFolder?.id)].some((n) => n === f.fileName)) {
      counts.skipped++;
      continue;
    }
    if (DRY) {
      console.log(`  + ${jkey} (${item.take})`);
      counts.filed++;
      continue;
    }
    try {
      const folderId = await ensureFolder(`${item.quarter}/${item.folder}`);
      const blob = item.take === "print" ? await printMail(item.mail) : await bytesOf(item.mail, f.ref);
      journal.files[jkey] = await fileOne(blob, f.fileName, folderId, description);
      await save();
      counts.filed++;
      console.log(`  + ${jkey} (${item.take}, ${Math.round(blob.size / 1024)} KB)`);
    } catch (e) {
      counts.failed++;
      console.warn(`  ! ${jkey}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
}
await browser?.close();
console.log(counts);
