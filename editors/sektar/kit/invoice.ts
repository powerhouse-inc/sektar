// The invoice's vocabulary and rules as the editor shows them: VAT
// categories and their legal mentions, payment means, units, attachment
// roles, the Peppol readiness checks, numbering, and storing a file beside
// the invoice (preprocess, reference it, then upload).
import { dispatchActions } from "@powerhousedao/reactor-browser";
import { generateId } from "document-model";
import {
  actions,
  CATEGORY_NEEDS_REASON,
  computeTotals,
  findRate,
  type AttachmentRole,
  type InvoiceDocument,
  type InvoiceLine,
  type InvoiceParty,
  type InvoiceState,
  type VatCategory,
} from "document-models/invoice";
import type { AttachmentClient } from "./files.js";
import type { BadgeTone } from "./format.js";

/* ------------------------------------------------------------------- VAT */

export const VAT_CATEGORIES: readonly {
  value: VatCategory;
  label: string;
  short: string;
  code: string;
  hint: string;
}[] = [
  { value: "STANDARD", label: "Standard rate", short: "VAT", code: "S", hint: "VAT is charged at a rate" },
  { value: "ZERO_RATED", label: "Zero rated", short: "0 %", code: "Z", hint: "Taxable at a rate of 0 %" },
  { value: "EXEMPT", label: "Exempt", short: "Exempt", code: "E", hint: "Exempt by law; say which article" },
  { value: "REVERSE_CHARGE", label: "Reverse charge", short: "Reverse charge", code: "AE", hint: "The buyer accounts for the VAT" },
  { value: "INTRA_COMMUNITY", label: "Intra-community supply", short: "Intra-EU", code: "K", hint: "A supply to a business in another EU country" },
  { value: "EXPORT", label: "Export outside the EU", short: "Export", code: "G", hint: "Goods leaving the EU" },
  { value: "OUTSIDE_SCOPE", label: "Outside the scope of VAT", short: "Out of scope", code: "O", hint: "Not subject to VAT here at all" },
];

export function vatCategory(value: VatCategory) {
  return VAT_CATEGORIES.find((c) => c.value === value) ?? VAT_CATEGORIES[0];
}

/** What a line's VAT column says: "21 %", or the category for a 0 % line. */
export function vatLabel(line: Pick<InvoiceLine, "vatCategory" | "vatRate">): string {
  return line.vatCategory === "STANDARD" ? `${line.vatRate} %` : vatCategory(line.vatCategory).short;
}

/** The legal mentions that usually go with a category (BT-120 text, BT-121 VATEX code). */
export const VATEX_PRESETS: Record<VatCategory, readonly { code: string; text: string }[]> = {
  STANDARD: [],
  ZERO_RATED: [],
  EXEMPT: [
    { code: "VATEX-EU-132", text: "Exempt based on article 132 of Council Directive 2006/112/EC" },
    { code: "VATEX-EU-79-C", text: "Exempt based on article 79, point c of Council Directive 2006/112/EC: repayment of expenditure incurred in the name and for the account of the customer" },
    { code: "", text: "Vrijgesteld van btw, art. 44 W.btw" },
  ],
  REVERSE_CHARGE: [
    { code: "VATEX-EU-AE", text: "Reverse charge" },
    { code: "VATEX-EU-AE", text: "BTW verlegd / VAT reverse charge" },
    { code: "VATEX-EU-AE", text: "Autoliquidation / reverse charge, art. 196 Council Directive 2006/112/EC" },
  ],
  INTRA_COMMUNITY: [
    { code: "VATEX-EU-IC", text: "Intra-Community supply" },
    { code: "VATEX-EU-IC", text: "Vrijstelling btw, art. 39bis W.btw" },
  ],
  EXPORT: [{ code: "VATEX-EU-G", text: "Export outside the EU" }],
  OUTSIDE_SCOPE: [
    { code: "VATEX-EU-O", text: "Not subject to VAT" },
    { code: "VATEX-EU-O", text: "Services outside the scope of Belgian VAT, art. 21 §2 W.btw" },
  ],
};

/* --------------------------------------------------------------- payment */

export const PAYMENT_MEANS: readonly { code: string; label: string }[] = [
  { code: "58", label: "SEPA credit transfer" },
  { code: "30", label: "Credit transfer" },
  { code: "59", label: "SEPA direct debit" },
  { code: "48", label: "Card payment" },
  { code: "10", label: "Cash" },
  { code: "ZZZ", label: "Other, described below" },
];

export function meansLabel(code: string | null | undefined): string | null {
  if (!code) return null;
  return PAYMENT_MEANS.find((m) => m.code === code)?.label ?? `Means ${code}`;
}

/** Credit transfers name the account to pay to (BR-61). */
export const isCreditTransfer = (code: string | null | undefined) => code === "30" || code === "58";

/** An IBAN in groups of four, as people read it. */
export function formatAccount(account: string | null | undefined): string {
  if (!account) return "";
  return /^[A-Z]{2}\d{2}[A-Z0-9]+$/.test(account) ? account.replace(/(.{4})(?=.)/g, "$1 ") : account;
}

/* ----------------------------------------------------- parties, numbers */

/** ISO 6523 schemes for company numbers and Peppol addresses, the common ones first. */
export const SCHEMES: readonly { code: string; label: string }[] = [
  { code: "0208", label: "0208 · Belgian company number (KBO/BCE)" },
  { code: "9925", label: "9925 · Belgian VAT number" },
  { code: "0106", label: "0106 · Dutch KvK number" },
  { code: "0190", label: "0190 · Dutch OIN" },
  { code: "0184", label: "0184 · Danish CVR number" },
  { code: "0183", label: "0183 · Swiss UID number" },
  { code: "0009", label: "0009 · French SIRET" },
  { code: "0002", label: "0002 · French SIRENE" },
  { code: "0204", label: "0204 · German Leitweg-ID" },
  { code: "9930", label: "9930 · German VAT number" },
  { code: "0088", label: "0088 · GLN (GS1)" },
  { code: "0060", label: "0060 · DUNS" },
];

export const CURRENCIES = ["EUR", "USD", "GBP", "CHF", "DKK", "SEK", "NOK", "PLN", "CZK", "HUF", "CAD", "AUD", "JPY"];

/** "1.173,46", "1,173.46", "1173,46" and "1173.46" all read as 1173.46; "1,173094" as 1.173094. */
export function parseNumber(input: string): number | null {
  const s = input.replace(/[\s'’]/g, "").replace(/^[^\d+-]+|[^\d]+$/g, "");
  if (!s || s === "-" || s === "+") return null;
  const lastDot = s.lastIndexOf(".");
  const lastComma = s.lastIndexOf(",");
  let normal = s;
  if (lastDot >= 0 && lastComma >= 0) {
    normal = lastComma > lastDot ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  } else if (lastComma >= 0) {
    // One kind of separator is the decimal one: a rate of 1,173 is not 1173.
    normal = s.indexOf(",") === lastComma ? s.replace(",", ".") : s.replace(/,/g, "");
  }
  const n = Number(normal);
  return Number.isFinite(n) ? n : null;
}

export function fmtNumber(n: number | null | undefined, maxDecimals = 6): string {
  if (n === null || n === undefined) return "";
  return String(Number(n.toFixed(maxDecimals)));
}

/* ----------------------------------------------------------------- units */

export const UNITS: readonly { code: string; label: string; plural: string }[] = [
  { code: "C62", label: "unit", plural: "units" },
  { code: "HUR", label: "hour", plural: "hours" },
  { code: "DAY", label: "day", plural: "days" },
  { code: "MON", label: "month", plural: "months" },
  { code: "ANN", label: "year", plural: "years" },
  { code: "KMT", label: "km", plural: "km" },
  { code: "KGM", label: "kg", plural: "kg" },
  { code: "LS", label: "lump sum", plural: "lump sums" },
];

export function unitLabel(code: string, quantity = 1): string {
  const u = UNITS.find((x) => x.code === code);
  if (!u) return code;
  return Math.abs(quantity) === 1 ? u.label : u.plural;
}

/* ------------------------------------------------------------ attachments */

export const ATTACHMENT_ROLES: readonly { value: AttachmentRole; label: string }[] = [
  { value: "ISSUED_COPY", label: "Invoice as sent" },
  { value: "SOURCE", label: "Editable original" },
  { value: "SUPPORTING", label: "Supporting document" },
  { value: "RECEIPT", label: "Receipt" },
  { value: "TIMESHEET", label: "Timesheet" },
  { value: "OTHER", label: "Other" },
];

export function roleLabel(role: AttachmentRole): string {
  return ATTACHMENT_ROLES.find((r) => r.value === role)?.label ?? role;
}

/** A guess at a dropped file's role: the PDF named after the invoice is the copy that was sent. */
export function guessRole(file: { name: string; type: string }, state: InvoiceState, onLine: boolean): AttachmentRole {
  if (onLine) return "RECEIPT";
  const name = file.name.toLowerCase();
  const pdf = file.type === "application/pdf" || name.endsWith(".pdf");
  if (pdf && state.number && name.includes(state.number.toLowerCase())) return "ISSUED_COPY";
  if (/\.(docx?|odt|pages)$/.test(name)) return "SOURCE";
  if (/timesheet|uren|hours/.test(name)) return "TIMESHEET";
  return "SUPPORTING";
}

/** Peppol carries attachments of these types only; others travel as links. */
export const PEPPOL_ATTACHMENT_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "text/csv",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.oasis.opendocument.spreadsheet",
]);

/** Store `file` and attach it to the invoice, or to one of its lines. */
export async function attachFile(
  client: AttachmentClient,
  documentId: string,
  file: Blob & { name?: string },
  opts: { lineId?: string | null; role: AttachmentRole; description?: string | null },
): Promise<string> {
  const fileName = file.name ?? "attachment";
  const mimeType = file.type || "application/octet-stream";
  const pre = await client.preprocess(file, { fileName, mimeType });
  const id = generateId();
  await dispatchActions(
    actions.addAttachment({
      id,
      lineId: opts.lineId ?? null,
      role: opts.role,
      fileName,
      mimeType,
      ref: pre.ref,
      sizeBytes: pre.sizeBytes,
      description: opts.description ?? null,
      addedAt: new Date().toISOString(),
    }),
    documentId,
  );
  await client.upload({ preprocessed: pre });
  return id;
}

/** "Invoice-TOGGL-2066546.pdf" → "Invoice TOGGL 2066546": a first description for a re-billed receipt. */
export function describeFile(name: string): string {
  return name
    .replace(/\.[a-z0-9]{1,5}$/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/* --------------------------------------------------------------- numbers */

/**
 * The next number in the sequence the latest issued invoice in that
 * direction uses: "2026009" → "2026010", "INV-2026-0012" → "INV-2026-0013".
 * A new year restarts a sequence that starts with the year.
 */
export function nextNumber(
  invoices: readonly InvoiceDocument[],
  direction: InvoiceState["direction"],
  at = new Date(),
): string {
  const year = String(at.getUTCFullYear());
  const numbers = invoices
    .filter((i) => i.state.global.direction === direction && i.state.global.number)
    .map((i) => i.state.global.number as string);
  const sameYear = numbers.filter((n) => n.includes(year));
  const pool = sameYear.length ? sameYear : numbers;
  const best = pool
    .map((n) => {
      const m = /^(.*?)(\d+)$/.exec(n);
      return m ? { prefix: m[1], digits: m[2], value: Number(m[2]) } : null;
    })
    .filter((x): x is { prefix: string; digits: string; value: number } => x !== null)
    .sort((a, b) => b.value - a.value)
    .at(0);
  if (!best) return direction === "OUTGOING" ? `${year}001` : `BILL-${year}-001`;
  if (!sameYear.length) {
    // Last year's sequence carries the year: this year's starts again at 1
    // ("2025015" → "2026001", "INV-2025-0012" → "INV-2026-0001").
    const lastYear = String(at.getUTCFullYear() - 1);
    const joined = best.prefix + best.digits;
    const at4 = joined.indexOf(lastYear);
    const tail = /^(.*?)(\d+)$/.exec(at4 >= 0 ? joined.slice(at4 + 4) : "");
    if (at4 >= 0 && tail)
      return joined.slice(0, at4) + year + tail[1] + "1".padStart(tail[2].length, "0");
  }
  const next = String(best.value + 1).padStart(best.digits.length, "0");
  return best.prefix + next;
}

/** Days from payment terms such as "30 days" or "Net 60". */
export function termsDays(terms: string | null | undefined): number | null {
  const m = /(\d{1,3})/.exec(terms ?? "");
  return m ? Number(m[1]) : null;
}

/* ---------------------------------------------------------------- checks */

export type Check = {
  level: "error" | "warning" | "info";
  text: string;
  /** Which part of the editor fixes it */
  section: "parties" | "details" | "currency" | "lines" | "vat" | "payment" | "attachments";
};

export const CHECK_TONE: Record<Check["level"], BadgeTone> = {
  error: "danger",
  warning: "warning",
  info: "info",
};

const hasAddress = (p: InvoiceParty) => !!p.country;

/**
 * What the invoice still needs for EN 16931 / Peppol BIS Billing 3.0. Errors
 * break a business rule; warnings are what a receiver will likely refuse or
 * ask about; infos are recommendations.
 */
export function invoiceChecks(state: InvoiceState): Check[] {
  const out: Check[] = [];
  const add = (level: Check["level"], section: Check["section"], text: string) =>
    out.push({ level, section, text });
  const cats = new Set(state.lines.map((l) => l.vatCategory));

  if (state.lines.length === 0) add("error", "lines", "Add at least one line.");
  if (!state.seller.name) add("error", "parties", "The seller needs a name.");
  if (!state.buyer.name) add("error", "parties", "The buyer needs a name.");
  if (!hasAddress(state.seller)) add("error", "parties", "The seller's address needs a country.");
  if (!hasAddress(state.buyer)) add("error", "parties", "The buyer's address needs a country.");
  if (!state.seller.vatId && [...cats].some((c) => c !== "OUTSIDE_SCOPE"))
    add("error", "parties", "The seller's VAT number is missing.");
  if (state.seller.vatId && !/^[A-Z]{2}/.test(state.seller.vatId))
    add("warning", "parties", "A VAT number starts with its country code, such as BE.");

  for (const c of cats) {
    if (CATEGORY_NEEDS_REASON[c] && !state.vatReasons.some((r) => r.category === c))
      add("error", "vat", `${vatCategory(c).label} lines need the legal mention that explains why no VAT is charged.`);
  }
  if (cats.has("REVERSE_CHARGE") && !state.buyer.vatId && !state.buyer.registrationId)
    add("error", "parties", "A reverse charge needs the buyer's VAT or company number.");
  if (cats.has("INTRA_COMMUNITY")) {
    if (!state.buyer.vatId) add("error", "parties", "An intra-community supply needs the buyer's VAT number.");
    if (!state.deliveredAt && !state.period)
      add("error", "details", "An intra-community supply needs a delivery date or a period.");
  }
  if (cats.has("OUTSIDE_SCOPE")) {
    if (cats.size > 1)
      add("error", "lines", "Out-of-scope lines cannot share an invoice with other VAT categories.");
    if (state.seller.vatId || state.buyer.vatId)
      add("warning", "parties", "An out-of-scope invoice carries no VAT numbers; Peppol refuses them.");
  }

  if (state.vatCurrency && findRate(state.exchangeRates, state.currency, state.vatCurrency) === null)
    add("error", "currency", `VAT is reported in ${state.vatCurrency}: add the ${state.vatCurrency}–${state.currency} rate.`);
  const missingRates = new Set<string>();
  for (const line of state.lines) {
    const o = line.original;
    if (o && o.rate === null && findRate(state.exchangeRates, o.currency, state.currency) === null)
      missingRates.add(o.currency);
  }
  for (const c of missingRates)
    add("error", "currency", `Re-billed costs in ${c} need a ${c}–${state.currency} rate.`);

  if (state.kind === "CREDIT_NOTE" && state.precedingInvoices.length === 0)
    add("warning", "details", "Say which invoice this credit note corrects.");
  if (isCreditTransfer(state.paymentInstructions.meansCode) && !state.paymentInstructions.account)
    add("error", "payment", "A credit transfer needs the account to pay to.");
  if (!state.paymentInstructions.meansCode && state.direction === "OUTGOING")
    add("warning", "payment", "Say how to pay: the payment means and the account.");
  const totals = computeTotals(state);
  if (totals.due > 0 && !state.dueAt && !state.paymentTerms && state.status !== "DRAFT")
    add("warning", "details", "Give a due date or payment terms.");
  if (!state.references.buyerReference && !state.references.orderReference)
    add("warning", "details", "Peppol asks for the buyer's reference or an order reference.");
  if (!state.deliveredAt && !state.period)
    add("info", "details", "A delivery date or a service period is recommended.");
  if (!state.buyer.endpointId && state.direction === "OUTGOING")
    add("info", "parties", "Without the buyer's Peppol address the invoice cannot be sent over Peppol.");
  const notPeppol = [...state.attachments, ...state.lines.flatMap((l) => l.attachments)].filter(
    (a) => !PEPPOL_ATTACHMENT_TYPES.has(a.mimeType),
  );
  if (notPeppol.length)
    add(
      "info",
      "attachments",
      `${notPeppol.length === 1 ? "One attachment is" : `${notPeppol.length} attachments are`} not a PDF, image, CSV or spreadsheet: Peppol carries ${notPeppol.length === 1 ? "it" : "them"} as a link only.`,
    );
  return out;
}

/** What blocks issuing: the errors. */
export function blockers(state: InvoiceState): Check[] {
  return invoiceChecks(state).filter((c) => c.level === "error");
}
