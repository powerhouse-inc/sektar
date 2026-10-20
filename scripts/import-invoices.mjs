#!/usr/bin/env node
// Import KSDC's issued invoices of a year into the Sektar drive's Invoices
// folder as sektar/invoice documents (v2), with their documents attached.
//
//   node scripts/import-invoices.mjs <year-dir> --plan            # dry run: prints and writes the plan
//   node scripts/import-invoices.mjs <year-dir> [--drive sektar] [--switchboard http://localhost:7540]
//
// <year-dir> is a facturen/bvba/<year> folder: the issued PDFs, the
// …-supporting-materials.zip next to them, and originals/ with the .docx
// sources, prijscalculatie.xlsx (one sheet per invoice: the lines and the
// month's EUR.USD rate) and the receipts behind the re-billed costs.
//
// Per invoice: the lines and the rate come from its sheet; the header
// (dates, subject, party, VAT mention, "already paid") from the PDF text
// (pdftotext on the PATH). Each receipt is matched to the line it bills by
// its amount and vendor; receipts that match no line go on the invoice.
// The invoice is issued with its number and dates, then the documents are
// attached (an issued invoice still takes documents), then a payment is
// recorded where the PDF says it was already paid.
//
// A journal (.ph/import-invoices.journal.json) makes a rerun resume.
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { openAsBlob, readFileSync, existsSync } from "node:fs";
import { mkdir, readdir, stat, writeFile } from "node:fs/promises";
import { basename, dirname, extname, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseInvoicePdf } from "./invoice-pdf.mjs";

/* ------------------------------------------------------------- options */

const args = process.argv.slice(2);
const flag = (name) => {
  const at = args.indexOf(`--${name}`);
  if (at < 0) return false;
  args.splice(at, 1);
  return true;
};
const opt = (name, fallback) => {
  const at = args.indexOf(`--${name}`);
  if (at < 0) return fallback;
  const value = args[at + 1];
  args.splice(at, 2);
  return value;
};
const PLAN_ONLY = flag("plan");
const DRIVE = opt("drive", "sektar");
const FOLDER_NAME = opt("folder", "Invoices");
const SWITCHBOARD = opt("switchboard", "http://localhost:7540").replace(/\/+$/, "");
const JOURNAL = resolve(opt("journal", ".ph/import-invoices.journal.json"));
const PLAN_OUT = opt("plan-out", null);
// --settle: mark the invoices of a closed year paid (method OTHER, an "assumed" reference)
const SETTLE_ARCHIVE = flag("settle");
const YEAR_DIR = args[0] && resolve(args[0]);
if (!YEAR_DIR) {
  console.error("usage: node scripts/import-invoices.mjs <year-dir> [--plan]");
  process.exit(2);
}
const ORIGINALS = join(YEAR_DIR, "originals");

/* ------------------------------------------------------------ the seller */

const KSDC = {
  name: "KSDC bv",
  vatId: "BE0545965488",
  registrationId: "0545965488",
  registrationScheme: "0208",
  endpointId: "0545965488",
  endpointScheme: "0208",
  email: "contact@ksdc.be",
  phone: "+32 474 685 373",
  street: "Denise de Weerdtpad 12/401",
  postalCode: "9000",
  city: "Gent",
  country: "BE",
};
const BANK = { account: "BE40737041382263", accountName: "KSDC bv", bic: "KREDBEBB" };

/** The customers, as the invoices print them. */
const CUSTOMERS = {
  PH: {
    party: {
      name: "Powerhouse Genesis",
      registrationId: "CHE-290.454.155",
      registrationScheme: "0183",
      street: "Bahnhofstrasse 20",
      postalCode: "6300",
      city: "Zug",
      country: "CH",
    },
    contact: { email: null, website: "https://powerhouse.inc" },
  },
  DAIF: {
    party: {
      name: "Dai Fonden",
      registrationId: "40645799",
      registrationScheme: "0184",
      email: "invoice@daifoundation.org",
      street: "Ryesgade 74",
      postalCode: "2100",
      city: "København Ø",
      country: "DK",
    },
    contact: { email: "invoice@daifoundation.org", website: null },
  },
};

/** The legal mention each customer's invoices carry, and the category it implies. */
const VAT = {
  PH: {
    category: "REVERSE_CHARGE",
    code: "VATEX-EU-AE",
    text: "BTW verlegd / VAT reverse charge",
  },
  // Art. 39bis W.btw is the exemption for intra-community supplies: the
  // category follows the article the invoice cites.
  DAIF: {
    category: "INTRA_COMMUNITY",
    code: "VATEX-EU-IC",
    text: "Vrijgesteld van BTW, overeenkomstig art. 39bis WBTW / Exempt from VAT in accordance with art. 39bis WBTW",
  },
};

/* ---------------------------------------------------------------- utils */

const round2 = (n) => (Math.sign(n) * Math.round(Math.abs(n) * 100 + 1e-9)) / 100;
const iso = (d, m, y) => new Date(Date.UTC(Number(y), Number(m) - 1, Number(d), 12)).toISOString();
const MONTHS = { JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6, JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12 };
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pdfText = (file) => {
  try {
    return execFileSync("pdftotext", ["-layout", file, "-"], { encoding: "utf8", maxBuffer: 32 << 20, stdio: ["ignore", "pipe", "ignore"] });
  } catch {
    return "";
  }
};
const MIME = {
  pdf: "application/pdf",
  zip: "application/zip",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
};
const mimeOf = (name) => MIME[extname(name).slice(1).toLowerCase()] ?? "application/octet-stream";

async function walk(dir) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(full)));
    else if (!/^(\.DS_Store|Thumbs\.db|desktop\.ini)$/i.test(entry.name)) out.push(full);
  }
  return out.sort((a, b) => a.localeCompare(b));
}

/* ----------------------------------------------------------- the sheets */

function readXlsx(file) {
  const tmp = join(dirname(JOURNAL), "import-invoices-xlsx");
  execFileSync("unzip", ["-o", "-q", file, "-d", tmp]);
  const read = (p) => readFileSync(join(tmp, p), "utf8");
  const decode = (s) =>
    s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'");
  const shared = [...read("xl/sharedStrings.xml").matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) =>
    decode([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join("")),
  );
  const rels = Object.fromEntries(
    [...read("xl/_rels/workbook.xml.rels").matchAll(/<Relationship [^>]*Id="([^"]+)"[^>]*Target="([^"]+)"/g)].map((m) => [m[1], m[2]]),
  );
  const sheets = {};
  for (const m of read("xl/workbook.xml").matchAll(/<sheet name="([^"]+)"[^>]*r:id="([^"]+)"/g)) {
    const xml = read("xl/" + rels[m[2]].replace(/^\/?xl\//, ""));
    const rows = {};
    for (const c of xml.matchAll(/<c r="([A-Z]+)(\d+)"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const [, col, row, attrs, inner = ""] = c;
      const v = /<v>([\s\S]*?)<\/v>/.exec(inner)?.[1];
      let value;
      if (/t="s"/.test(attrs) && v !== undefined) value = shared[Number(v)];
      else if (v !== undefined) value = /t="str"/.test(attrs) ? decode(v) : Number(v);
      if (value === undefined || value === "") continue;
      (rows[row] ??= {})[col] = value;
    }
    sheets[decode(m[1])] = rows;
  }
  return sheets;
}

/** The sheet name an invoice file uses: 2026002-ph-january → PH-JAN, 2026001-daif-2025-q4 → DAIF-25Q4. */
function sheetName(stem) {
  const ph = /-ph-([a-z]+)$/.exec(stem);
  if (ph) return `PH-${ph[1].slice(0, 3).toUpperCase()}`;
  const daif = /-daif-(\d{4})-q(\d)$/.exec(stem);
  if (daif) return `DAIF-${daif[1].slice(2)}Q${daif[2]}`;
  return null;
}

/** Lines and rate from a sheet. EUR costs re-billed in USD carry their EUR amount. */
function linesFrom(sheet, usd) {
  const rate = usd ? Number(sheet["4"]?.G) : null;
  const lines = [];
  for (const [row, c] of Object.entries(sheet)) {
    if (Number(row) < 6 || typeof c.B !== "string" || typeof c.C !== "number") continue;
    const raw = c.B.trim();
    const cat = /^(Software|Travel|Restaurant|Hotel|Hardware|Office)\s*-\s*(.*)$/.exec(raw);
    let description = cat ? cat[2] : raw;
    const eur = / - ([\d.,]+) EUR$/.exec(description);
    if (eur) description = description.slice(0, eur.index);
    // "31/JAN" alone says when, not what: keep the category in front.
    if (cat && /^\d{1,2}\/[A-Z]{3}$/i.test(description.trim())) description = `${cat[1]} ${description.trim()}`;
    const price = c.C;
    let original = null;
    if (usd && eur) {
      original = { amount: round2(price / rate), currency: "EUR" };
      const printed = Number(eur[1].replace(/\.(?=\d{3}\b)/g, "").replace(/,(?=\d{3}\b)/g, "").replace(",", "."));
      if (Math.abs(printed - original.amount) > 0.011)
        console.warn(`  ! ${raw}: printed ${eur[1]} EUR, sheet implies ${original.amount}`);
      // The model prices a re-billed line from its cost and the rate: that
      // must land on the price the invoice was issued with.
      if (round2(original.amount * rate) !== round2(price))
        console.warn(`  ! ${raw}: ${original.amount} × ${rate} = ${round2(original.amount * rate)}, invoiced ${round2(price)}`);
    } else if (usd && cat) {
      original = { amount: round2(price), currency: "USD" };
    }
    lines.push({
      description: description.trim(),
      category: cat ? cat[1] : null,
      quantity: Number(c.D ?? 1),
      unitPrice: round2(price),
      exactNet: price * Number(c.D ?? 1),
      original,
    });
  }
  const total = Object.values(sheet).find((c) => c.F === "Total Excl VAT")?.G;
  return { lines, rate, sheetTotal: typeof total === "number" ? round2(total) : null };
}

/* ------------------------------------------------------------ receipts */

// Words that say nothing about the vendor: the categories, the months, and
// the customer's own names, which every receipt billed to it carries.
const GENERIC = new Set(["software", "travel", "restaurant", "subscription", "monthly", "annual", "api", "team", "the", "and", "extra", "tickets", "hotel", "flights", "train", "jan", "feb", "mar", "apr", "may", "jun", "claude", "workspace", "conf", "powerhouse", "makerdao", "ksdc", "wouter", "kampmann", "genesis", "ses", "invoice", "receipt"]);
const MON = { jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06", jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12" };

/**
 * What ties a receipt to one line among look-alikes: a number the line ends
 * on ("API 0015" ↔ "…-0015", "Descript 2" ↔ "…-0002") or a date it names
 * ("15/FEB", "17/04" ↔ "20260215", "…0417…").
 */
function tieBonus(line, name) {
  let bonus = 0;
  const num = /(\d+)$/.exec(line.description)?.[1];
  const fileNum = /(\d+)\.pdf$/i.exec(name)?.[1];
  if (num && fileNum && Number(num) === Number(fileNum)) bonus += 2;
  const date = /(\d{1,2})\/([a-z]{3}|\d{2})/i.exec(line.description);
  if (date) {
    const mm = MON[date[2].toLowerCase()] ?? date[2];
    if (name.includes(`${mm}${date[1].padStart(2, "0")}`)) bonus += 2;
  }
  return bonus;
}
/** Words of a line that a receipt from that vendor would carry. */
function vendorWords(line) {
  const words = line.description
    .toLowerCase()
    .replace(/\d+\/[a-z]+|\d+\/\d+/g, " ")
    .split(/[^a-zà-ÿ0-9]+/)
    .filter((w) => w.length >= 3 && !GENERIC.has(w) && !/^\d+$/.test(w));
  const extra = {
    aws: ["amazon web services", "aws"],
    google: ["google"],
    gitbook: ["gitbook"],
    united: ["united airlines", "united.com"],
    standard: ["the standard"],
    uber: ["uber"],
    "dweb": ["dweb"],
    local: ["local-first", "local first", "tito"],
    gästehaus: ["holidu", "schlamau"],
    bru: ["lufthansa", "brussels airlines"],
    indigo: ["indigo"],
  };
  const out = new Set(words);
  for (const w of words) for (const e of extra[w] ?? []) out.add(e);
  return [...out];
}

/** "1201.34" as receipts print it: 1,201.34 · 1201.34 · 1.201,34 · 1201,34. */
function amountForms(n) {
  const [int, dec] = n.toFixed(2).split(".");
  const group = (sep) => int.replace(/\B(?=(\d{3})+(?!\d))/g, sep);
  return [...new Set([`${group(",")}.${dec}`, `${int}.${dec}`, `${group(".")},${dec}`, `${int},${dec}`, `${group(" ")},${dec}`])];
}

function matchReceipts(lines, files) {
  const texts = files.map((f) => ({ file: f, text: pdfText(f).toLowerCase(), name: basename(f).toLowerCase() }));
  const assigned = new Map();
  const reasons = new Map();
  // Score every pair, then take the best pairs first; a receipt goes to one line.
  const pairs = [];
  texts.forEach((t, ti) => {
    lines.forEach((line, li) => {
      const amount = line.original?.amount ?? line.unitPrice;
      const hasAmount = amount > 0 && amountForms(amount).some((form) => t.text.includes(form));
      const vendor = vendorWords(line).find((w) => t.text.includes(w) || t.name.includes(w.replace(/ /g, "")));
      const tie = hasAmount || vendor ? tieBonus(line, t.name) : 0;
      const score = (hasAmount ? 3 : 0) + (vendor ? 2 : 0) + tie;
      if (score >= 3)
        pairs.push({ ti, li, score, why: [hasAmount && `amount ${amount}`, vendor && `“${vendor}”`, tie && "its number or date"].filter(Boolean).join(" + ") });
    });
  });
  pairs.sort((a, b) => b.score - a.score || a.li - b.li);
  const lineTaken = new Map();
  const take = (p) => {
    assigned.set(p.ti, p.li);
    reasons.set(p.ti, p.why);
    lineTaken.set(p.li, (lineTaken.get(p.li) ?? 0) + 1);
  };
  // First every line gets at most one receipt, so look-alike lines (three
  // Descript seats at $35) each get their own; then a full match may add a
  // second receipt to a line (an invoice and its payment receipt).
  for (const p of pairs) if (!assigned.has(p.ti) && !lineTaken.get(p.li)) take(p);
  for (const p of pairs) if (!assigned.has(p.ti) && p.score >= 5) take(p);
  // A vendor-only match is good enough for a line that has no receipt yet.
  texts.forEach((t, ti) => {
    if (assigned.has(ti)) return;
    const li = lines.findIndex((line, i) => !lineTaken.get(i) && vendorWords(line).some((w) => t.text.includes(w) || t.name.includes(w.replace(/ /g, ""))));
    if (li >= 0) {
      assigned.set(ti, li);
      reasons.set(ti, "vendor only");
      lineTaken.set(li, 1);
    }
  });
  return texts.map((t, ti) => ({ file: t.file, line: assigned.has(ti) ? assigned.get(ti) : null, why: reasons.get(ti) ?? (t.text.trim() ? "no line matches" : "no text (a scan)") }));
}

/* ------------------------------------------------------------- the plan */

function header(pdf) {
  const text = pdfText(pdf);
  const date = (label) => {
    const m = new RegExp(`${label}:\\s*(\\d{2})/(\\d{2})/(\\d{4})`).exec(text);
    return m ? iso(m[1], m[2], m[3]) : null;
  };
  const paid = /ALREADY PAID\s+(\d{2})\/([A-Z]{3})\/(\d{4})/.exec(text);
  const subject = /^\s*((?:Dai Foundation|Powerhouse Expenses)\s+\S\s+[^\n]+?)\s{2,}/m.exec(text) ?? /^\s*((?:Dai Foundation|Powerhouse Expenses)\s+\S\s+.+)$/m.exec(text);
  return {
    issuedAt: date("Invoice Date"),
    deliveredAt: date("Delivery Date"),
    dueAt: date("Due Date"),
    paidAt: paid ? iso(paid[1], MONTHS[paid[2]], paid[3]) : null,
    subject: subject ? subject[1].replace(/\s\S\s/, " – ").replace(/\s+/g, " ").trim() : null,
  };
}

/** The period a subject names: "January 2026" → the month, "Q4 2025" → the quarter. */
function periodOf(subject) {
  const q = /Q([1-4]) (\d{4})/.exec(subject ?? "");
  if (q) {
    const y = Number(q[2]);
    const m0 = (Number(q[1]) - 1) * 3;
    return { start: new Date(Date.UTC(y, m0, 1, 12)).toISOString(), end: new Date(Date.UTC(y, m0 + 3, 0, 12)).toISOString() };
  }
  const DUTCH = ["januari", "februari", "maart", "april", "mei", "juni", "juli", "augustus", "september", "oktober", "november", "december"];
  const m = new RegExp(`(${[...MONTH_NAMES, ...DUTCH].join("|")}) (\\d{4})`, "i").exec(subject ?? "");
  if (m) {
    const y = Number(m[2]);
    const i = [...MONTH_NAMES, ...DUTCH].findIndex((n) => n.toLowerCase() === m[1].toLowerCase()) % 12;
    return { start: new Date(Date.UTC(y, i, 1, 12)).toISOString(), end: new Date(Date.UTC(y, i + 1, 0, 12)).toISOString() };
  }
  return null;
}

/* ------------------------------------------------- the earlier years */

// Before 2026 the sheets follow no one naming, and before 2021 there are
// none: the issued PDF is the record. Every customer of those years becomes a
// contact; the 2026 ones keep their keys.
const customerKey = (name) =>
  /^Powerhouse Genesis/i.test(name) ? "PH" : /^Dai Fonden/i.test(name) ? "DAIF" : name.normalize("NFKD").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "").toUpperCase();

/** KSDC as the invoice prints it: bvba until the 2019 reform, Belzele until the move to Gent. */
function sellerAsPrinted(text) {
  const seller = { ...KSDC, name: /KSDC bvba/i.test(text) ? "KSDC bvba" : "KSDC bv" };
  if (/Biezenstraat 13/i.test(text)) Object.assign(seller, { street: "Biezenstraat 13", postalCode: "9940", city: "Evergem (Belzele)" });
  if (/wouter@ksdc\.be/i.test(text)) seller.email = "wouter@ksdc.be";
  return seller;
}

/** "Software - Toggl - 185,13 EUR" → the category, the description, the cost billed on. */
function splitLine(raw, usd) {
  const cat = /^(Software|Travel|Restaurant|Hotel|Hardware|Office|Offsite)(?:\s*\(([^)]*)\))?\s*-\s*(.*)$/i.exec(raw);
  let description = cat ? cat[3] : raw;
  const note = cat?.[2] ? cat[2] : null;
  const orig = / - ([\d.,]+) ?(EUR|DKK|CAD|PLN|ARS|CHF|GBP|SEK|NOK|USD|JPY|AUD|MXN|BRL|TRY|CZK|HUF)\$?$/i.exec(description) ?? /\/ ([\d.,]+) ([A-Z]{3})$/.exec(description) ?? /\(([\d.,]+) ([A-Z]{3})\)$/.exec(description);
  let original = null;
  if (orig) {
    description = description.slice(0, orig.index).trim();
    const amount = parseAmountLoose(orig[1]);
    if (amount !== null && (usd || orig[2].toUpperCase() !== "EUR")) original = { amount, currency: orig[2].toUpperCase() };
  }
  if (cat && /^\d{1,2}[-/][A-Z]{3}$/i.test(description.trim())) description = `${cat[1]} ${description.trim()}`;
  const category = cat ? (/^offsite$/i.test(cat[1]) ? "Travel" : cat[1][0].toUpperCase() + cat[1].slice(1).toLowerCase()) : null;
  return { description: (note ? `${description} (${note})` : description).trim(), category, original };
}
const parseAmountLoose = (s) => {
  const t = s.replace(/\s/g, "");
  const last = Math.max(t.lastIndexOf("."), t.lastIndexOf(","));
  const n = last >= 0 && t.length - last - 1 !== 3 ? Number(t.slice(0, last).replace(/[.,]/g, "") + "." + t.slice(last + 1)) : Number(t.replace(/[.,]/g, ""));
  return Number.isFinite(n) ? n : null;
};

async function planFromPdf(pdf, files) {
  const stem = pdf.slice(0, -4);
  const number = stem.slice(0, 7);
  const file = join(YEAR_DIR, pdf);
  const p = parseInvoicePdf(file);
  const text = pdfText(file);
  const usd = p.currency === "USD";
  const key = customerKey(p.buyer.name ?? stem);
  CUSTOMERS[key] ??= {
    party: Object.fromEntries(Object.entries(p.buyer).filter(([, v]) => v)),
    contact: { email: p.buyer.email ?? null, website: null },
  };
  const legal = p.legal ?? (p.lines.every((l) => l.vatRate === 0) ? { category: "OUTSIDE_SCOPE", code: "VATEX-EU-O", text: "Not subject to VAT" } : null);
  const lines = p.lines.map((l) => {
    const split = l.recovered ? { description: l.description, category: null, original: null } : splitLine(l.description, usd);
    // a deduction ("Voorschot reeds betaald", a reimbursement): the model wants a negative quantity
    const negative = l.unitPrice < 0;
    if (negative && split.original) split.original.amount = Math.abs(split.original.amount);
    // The model prices a re-billed line from its cost and the rate. A line
    // billed at another rate (another month's, or 1:1 as 2023011's seat
    // reservation) carries the rate it was billed at, so its price stays.
    if (split.original && usd) {
      const docRate = split.original.currency === "EUR" ? p.rate : null;
      const price = Math.abs(l.unitPrice);
      if (!docRate || round2(split.original.amount * docRate) !== round2(price)) split.original.rate = price / split.original.amount;
    }
    return {
      description: split.description,
      category: split.category,
      quantity: negative ? -Math.abs(l.quantity) : l.quantity,
      unitPrice: Math.abs(l.unitPrice),
      vatRate: l.vatRate,
      vatCategory: l.vatRate > 0 ? "STANDARD" : legal?.category ?? "OUTSIDE_SCOPE",
      original: split.original,
      note: l.note ?? null,
    };
  });
  const net = round2(lines.reduce((s, l) => s + round2(l.quantity * l.unitPrice), 0));
  const rounding = p.totalExcl === null ? 0 : round2(p.totalExcl - net);
  // the PDFs that share the invoice's number: timesheets, worklogs, attachments
  const companions = files.filter((n) => n !== pdf && n.startsWith(number) && /\.pdf$/i.test(n) && (/attachment/i.test(n) || !parseInvoicePdf(join(YEAR_DIR, n)).number));
  const receiptDir = join(ORIGINALS, `${number}-supporting-materials`);
  const receipts = usd ? matchReceipts(lines, (await walk(receiptDir)).filter((f) => /\.pdf$/i.test(f))) : [];
  const zip = files.find((n) => n.startsWith(number) && /supporting-(materials|documents)\.zip$/i.test(n));
  const docs = [
    { file, role: "ISSUED_COPY", description: p.kind === "CREDIT_NOTE" ? "The credit note as sent" : "The invoice as sent" },
    existsSync(join(ORIGINALS, `${stem}.docx`)) && { file: join(ORIGINALS, `${stem}.docx`), role: "SOURCE", description: "The editable original" },
    zip && { file: join(YEAR_DIR, zip), role: "SUPPORTING", description: "Every receipt behind the re-billed costs, as sent with the invoice" },
    ...companions.map((n) => ({ file: join(YEAR_DIR, n), role: "SUPPORTING", description: "Sent with the invoice" })),
    ...receipts.filter((r) => r.line === null).map((r) => ({ file: r.file, role: "RECEIPT", description: `Not matched to a line: ${r.why}` })),
  ].filter(Boolean);
  return {
    key: stem,
    number,
    kind: p.kind,
    customer: key,
    seller: sellerAsPrinted(text),
    legal,
    currency: p.currency,
    rate: p.rate,
    issuedAt: p.issuedAt,
    deliveredAt: p.deliveredAt,
    dueAt: p.dueAt,
    paidAt: p.paidAt,
    subject: p.subject,
    period: periodOf(p.subject),
    lines,
    sheetTotal: p.totalExcl,
    totalIncl: p.totalIncl ?? (p.vatTotal === 0 && p.totalExcl !== null ? p.totalExcl : null),
    net,
    rounding,
    receipts: receipts.filter((r) => r.line !== null),
    docs,
    archived: true,
  };
}

async function makePlan() {
  const sheets = existsSync(join(ORIGINALS, "prijscalculatie.xlsx")) ? readXlsx(join(ORIGINALS, "prijscalculatie.xlsx")) : {};
  const files = (await readdir(YEAR_DIR)).sort();
  const pdfs = files.filter((n) => /^\d{7}-.*\.pdf$/.test(n));
  const plan = [];
  for (const pdf of pdfs) {
    const stem = pdf.slice(0, -4);
    const number = stem.slice(0, 7);
    const customer = /-ph-/.test(stem) ? "PH" : "DAIF";
    const sheet = sheets[sheetName(stem)];
    if (!sheet) {
      // a timesheet or an attachment goes with its invoice, not on its own
      // (an attachment can be someone else's invoice: "2021010-attachment-google-workspaces")
      if (/attachment/i.test(pdf) || !parseInvoicePdf(join(YEAR_DIR, pdf)).number) continue;
      plan.push(await planFromPdf(pdf, files));
      continue;
    }
    const usd = customer === "PH";
    const { lines, rate, sheetTotal } = linesFrom(sheet, usd);
    const h = header(join(YEAR_DIR, pdf));
    const net = round2(lines.reduce((s, l) => s + round2(l.quantity * l.unitPrice), 0));
    const rounding = sheetTotal === null ? 0 : round2(sheetTotal - net);
    const receiptDir = join(ORIGINALS, `${number}-supporting-materials`);
    const receipts = usd ? matchReceipts(lines, (await walk(receiptDir)).filter((f) => /\.pdf$/i.test(f))) : [];
    const docs = [
      { file: join(YEAR_DIR, pdf), role: "ISSUED_COPY", description: "The invoice as sent" },
      existsSync(join(ORIGINALS, `${stem}.docx`)) && { file: join(ORIGINALS, `${stem}.docx`), role: "SOURCE", description: "The editable original" },
      existsSync(join(YEAR_DIR, `${number}-supporting-materials.zip`)) && {
        file: join(YEAR_DIR, `${number}-supporting-materials.zip`),
        role: "SUPPORTING",
        description: "Every receipt behind the re-billed costs, as sent with the invoice",
      },
      ...receipts.filter((r) => r.line === null).map((r) => ({ file: r.file, role: "RECEIPT", description: `Not matched to a line: ${r.why}` })),
    ].filter(Boolean);
    plan.push({
      key: stem,
      number,
      customer,
      currency: usd ? "USD" : "EUR",
      rate,
      ...h,
      period: periodOf(h.subject),
      lines,
      sheetTotal,
      net,
      rounding,
      receipts: receipts.filter((r) => r.line !== null),
      docs,
    });
  }
  return plan;
}

function printPlan(plan) {
  for (const p of plan) {
    console.log(`\n${p.number} · ${p.subject} · ${p.currency}${p.rate ? ` @ EUR.USD ${p.rate}` : ""}`);
    console.log(`  issued ${p.issuedAt?.slice(0, 10)} · delivered ${p.deliveredAt?.slice(0, 10)} · due ${p.dueAt?.slice(0, 10)}${p.paidAt ? ` · paid ${p.paidAt.slice(0, 10)}` : ""} · period ${p.period?.start.slice(0, 10)}…${p.period?.end.slice(0, 10)}`);
    console.log(`  ${p.lines.length} lines · net ${p.net} · sheet ${p.sheetTotal}${p.rounding ? ` · rounding ${p.rounding}` : ""}`);
    p.lines.forEach((l, i) => {
      const rs = p.receipts.filter((r) => r.line === i);
      console.log(
        `   ${String(i + 1).padStart(2)}. ${(l.category ? `[${l.category}] ` : "") + l.description}`.padEnd(60) +
          `${l.unitPrice}`.padStart(10) +
          (l.original ? `  ← ${l.original.amount} ${l.original.currency}` : "") +
          (rs.length ? `  ⟵ ${rs.map((r) => `${basename(r.file)} (${r.why})`).join(", ")}` : ""),
      );
    });
    for (const d of p.docs) console.log(`   + ${d.role.padEnd(11)} ${relative(YEAR_DIR, d.file)}${d.role === "RECEIPT" ? `  (${d.description})` : ""}`);
  }
}

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
  if (json.errors?.length) throw new Error(json.errors.map((e) => e.message).join("; "));
  return json.data;
}

/**
 * Applies invoice actions in one request, in order, through the reactor's
 * generic execute. Not the Invoice subgraph's own mutations: with two model
 * versions registered, that subgraph resolves actions against v1 and
 * refuses every action v2 added ("Action SET_HEADER not found").
 */
async function invoice(id, ops) {
  if (!ops.length) return;
  const now = Date.now();
  const actions = ops.map(([, type, input], i) => ({
    id: randomUUID(),
    type: type.replace(/([a-z])([A-Z])/g, "$1_$2").toUpperCase(),
    timestampUtcMs: new Date(now + i).toISOString(),
    input,
    scope: "global",
  }));
  await gql(`mutation ($id: String!, $actions: [ActionInput!]!) { execute(documentIdOrSlug: $id, actions: $actions) { id } }`, {
    id,
    actions,
  });
}

/** The document's operation errors, newest last: a reducer refusal shows here, not as a GraphQL error. */
async function opErrors(id) {
  const data = await gql(
    `query ($id: String!) { documentOperations(filter: { documentId: $id }, paging: { limit: 500 }) { items { action { type } error } } }`,
    { id },
  ).catch(() => null);
  return (data?.documentOperations?.items ?? []).filter((o) => o.error).map((o) => `${o.action.type}: ${o.error}`);
}

/* ------------------------------------------------------------- journal */

let journal = { contacts: {}, invoices: {} };
try {
  journal = JSON.parse(readFileSync(JOURNAL, "utf8"));
} catch {
  // a first run
}
const saveJournal = async () => {
  await mkdir(dirname(JOURNAL), { recursive: true });
  await writeFile(JOURNAL, JSON.stringify(journal, null, 1));
};

/* -------------------------------------------------------------- import */

async function folderId() {
  const data = await gql(`query ($d: String!) { document(idOrSlug: $d) { document { id state } } }`, { d: DRIVE });
  const doc = data.document.document;
  const nodes = (doc.state.global ?? doc.state).nodes;
  const folder = nodes.find((n) => n.kind === "folder" && n.name === FOLDER_NAME && !n.parentFolder);
  if (!folder) throw new Error(`No ${FOLDER_NAME} folder in the ${DRIVE} drive`);
  return { driveId: doc.id, folder: folder.id, nodes };
}

async function ensureContact(key, where) {
  const c = CUSTOMERS[key];
  let id = journal.contacts[key];
  if (!id) {
    const existing = where.nodes.find((n) => n.documentType === "sektar/contact" && n.name === c.party.name);
    if (existing) {
      journal.contacts[key] = existing.id;
      journal.contactsDone = { ...journal.contactsDone, [key]: true };
      await saveJournal();
      return existing.id;
    }
    const contactsFolder = where.nodes.find((n) => n.kind === "folder" && n.name === "Contacts" && !n.parentFolder)?.id ?? null;
    const created = await gql(`mutation ($n: String!) { Contact { createDocument(name: $n) { id } } }`, { n: c.party.name });
    id = created.Contact.createDocument.id;
    await gql(
      `mutation ($d: String, $id: ID!, $n: String!, $p: ID) { DocumentDrive { addFile(documentIdOrSlug: $d, input: { id: $id, name: $n, documentType: "sektar/contact", parentFolder: $p }) { id } } }`,
      { d: where.driveId, id, n: c.party.name, p: contactsFolder },
    );
    journal.contacts[key] = id;
    await saveJournal();
  }
  if (!journal.contactsDone?.[key]) {
    await gql(
      `mutation ($id: String, $p: Contact_SetProfileInput!, $a: Contact_SetAddressInput!, $t: Contact_SetPaymentTermsInput!) {
        Contact {
          p: setProfile(documentIdOrSlug: $id, input: $p) { id }
          a: setAddress(documentIdOrSlug: $id, input: $a) { id }
          t: setPaymentTerms(documentIdOrSlug: $id, input: $t) { id }
        }
      }`,
      {
        id,
        p: {
          name: c.party.name,
          kind: "CUSTOMER",
          email: c.contact.email,
          website: c.contact.website,
          registrationNumber: c.party.registrationId,
        },
        a: { street: c.party.street, postalCode: c.party.postalCode, city: c.party.city, country: c.party.country },
        t: { paymentTermsDays: 30, defaultCategory: "SALES" },
      },
    );
    journal.contactsDone = { ...journal.contactsDone, [key]: true };
    await saveJournal();
  }
  return id;
}

let attachments;
async function upload(id, file, input) {
  const name = basename(file);
  const mimeType = mimeOf(name);
  const { size } = await stat(file);
  const blob = await openAsBlob(file, { type: mimeType });
  const pre = await attachments.preprocess(blob, { fileName: name, mimeType });
  await invoice(id, [
    ["addAttachment", "AddAttachment", { id: randomUUID(), fileName: name, mimeType, ref: pre.ref, sizeBytes: size, addedAt: new Date().toISOString(), ...input }],
  ]);
  await attachments.upload({ preprocessed: pre });
}

async function importOne(p, where) {
  const entry = (journal.invoices[p.key] ??= {});
  if (entry.done) return "skipped";
  const contactId = await ensureContact(p.customer, where);
  const name = `${p.number} · ${CUSTOMERS[p.customer].party.name}`;
  if (!entry.id) {
    const created = await gql(`mutation ($n: String!) { Invoice { createDocument(name: $n) { id } } }`, { n: name });
    entry.id = created.Invoice.createDocument.id;
    await saveJournal();
  }
  const id = entry.id;
  if (!entry.filed) {
    await gql(
      `mutation ($d: String, $id: ID!, $n: String!, $p: ID) { DocumentDrive { addFile(documentIdOrSlug: $d, input: { id: $id, name: $n, documentType: "sektar/invoice", parentFolder: $p }) { id } } }`,
      { d: where.driveId, id, n: name, p: where.folder },
    );
    entry.filed = true;
    await saveJournal();
  }
  const vat = p.archived ? p.legal : VAT[p.customer];
  if (!entry.drafted) {
    const ops = [
      [
        "setHeader",
        "SetHeader",
        {
          kind: p.kind ?? "INVOICE",
          direction: "OUTGOING",
          subject: p.subject,
          deliveredAt: p.deliveredAt,
          periodStart: p.period?.start ?? null,
          periodEnd: p.period?.end ?? null,
          dueAt: p.dueAt,
          ...(p.rounding ? { roundingAmount: p.rounding } : {}),
        },
      ],
      ["setSeller", "SetSeller", p.seller ?? KSDC],
      ["setBuyer", "SetBuyer", { ...CUSTOMERS[p.customer].party, contactId }],
    ];
    if (p.currency !== "EUR") {
      ops.push(["setCurrency", "SetCurrency", { currency: p.currency, vatCurrency: "EUR" }]);
      if (p.rate) ops.push(["setExchangeRate", "SetExchangeRate", { base: "EUR", quote: p.currency, rate: p.rate, date: p.deliveredAt, source: "The month's rate, as on the invoice" }]);
    }
    p.lines.forEach((l, i) => {
      l.id = entry.lineIds?.[i] ?? randomUUID();
      ops.push([
        "addLine",
        "AddLine",
        {
          id: l.id,
          description: l.description,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          vatCategory: l.vatCategory ?? vat.category,
          vatRate: l.vatRate ?? 0,
          category: l.category,
          ...(l.note ? { note: l.note } : {}),
          ...(l.original ? { originalAmount: l.original.amount, originalCurrency: l.original.currency, ...(l.original.rate ? { originalRate: l.original.rate } : {}) } : {}),
        },
      ]);
    });
    entry.lineIds = p.lines.map((l) => l.id);
    if (vat && p.lines.some((l) => (l.vatCategory ?? vat.category) === vat.category))
      ops.push(["setVatReason", "SetVatReason", { category: vat.category, code: vat.code, text: vat.text }]);
    ops.push([
      "setPaymentInstructions",
      "SetPaymentInstructions",
      {
        meansCode: p.currency === "EUR" ? "58" : "30",
        meansText: p.currency === "EUR" ? null : `Full amount payable in ${p.currency}`,
        ...BANK,
        remittance: p.number,
      },
    ]);
    ops.push(["issueInvoice", "IssueInvoice", { number: p.number, issuedAt: p.issuedAt, dueAt: p.dueAt }]);
    await invoice(id, ops);
    entry.drafted = true;
    await saveJournal();
  }
  entry.docs ??= {};
  for (const d of p.docs) {
    const key = relative(YEAR_DIR, d.file);
    if (entry.docs[key]) continue;
    await upload(id, d.file, { role: d.role, description: d.description });
    entry.docs[key] = true;
    await saveJournal();
  }
  for (const r of p.receipts) {
    const key = relative(YEAR_DIR, r.file);
    if (entry.docs[key]) continue;
    await upload(id, r.file, { role: "RECEIPT", lineId: entry.lineIds[r.line] });
    entry.docs[key] = true;
    await saveJournal();
  }
  if (p.paidAt && !entry.paid) {
    const total = round2(p.net + p.rounding);
    await invoice(id, [["recordPayment", "RecordPayment", { id: randomUUID(), paidAt: p.paidAt, amount: total, method: "BANK_TRANSFER" }]]);
    entry.paid = true;
  } else if (p.archived && SETTLE_ARCHIVE && p.kind !== "CREDIT_NOTE" && !entry.paid && p.totalIncl) {
    // The books of these years are closed: the invoice was settled, but no
    // bank line of the time is in the Sektar drive to say when. The payment
    // says so in its reference, so a later bank import can replace it.
    await invoice(id, [["recordPayment", "RecordPayment", { id: randomUUID(), paidAt: p.dueAt ?? p.issuedAt, amount: p.totalIncl, method: "OTHER", transactionId: "assumed: closed year, no bank line matched" }]]);
    entry.paid = true;
  }
  const errors = await opErrors(id);
  if (errors.length) console.warn(`  ! ${p.number}: ${errors.join(" | ")}`);
  entry.done = errors.length === 0;
  await saveJournal();
  return errors.length ? "with errors" : "imported";
}

/* ----------------------------------------------------------------- main */

const plan = await makePlan();
printPlan(plan);
if (PLAN_OUT) await writeFile(resolve(PLAN_OUT), JSON.stringify(plan, null, 1));
if (PLAN_ONLY) process.exit(0);

const attachmentsEntry = resolve(dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "../../powerhouse/packages/reactor-attachments/dist/client.js");
const { createAttachmentClient, createRemoteAttachmentService } = await import(pathToFileURL(attachmentsEntry).href);
attachments = createAttachmentClient(createRemoteAttachmentService({ remoteUrl: SWITCHBOARD }));
const where = await folderId();
console.log(`\nImporting ${plan.length} invoices into ${DRIVE}/${FOLDER_NAME}…`);
for (const p of plan) {
  const t = Date.now();
  const result = await importOne(p, where);
  console.log(`  ${p.number} ${result} (${((Date.now() - t) / 1000).toFixed(1)} s)`);
}
