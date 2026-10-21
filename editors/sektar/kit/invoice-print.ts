// A sales invoice to send: the printable A4 page, laid out like KSDC's
// own invoices (parties, bank, dates, the month's rate, the lines with what
// each re-billed cost was, totals, the legal mention), and the bundle of
// receipts behind its forward-billed lines.
import {
  computeTotals,
  type InvoiceDocument,
  type InvoiceParty,
  type InvoiceState,
} from "document-models/invoice";
import type { AttachmentClient } from "./files.js";
import { printHtml, saveBlob } from "./print.js";
import { zip, type ZipEntry } from "./zip.js";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const slug = (s: string) =>
  s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

/** 4.714,99: the amounts as Belgian invoices write them. */
const num = (n: number, digits = 2) =>
  new Intl.NumberFormat("nl-BE", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n);

const SYMBOL: Record<string, string> = { USD: "$", EUR: "€", GBP: "£", CHF: "CHF", DKK: "DKK" };
const amount = (n: number, cur: string) => `${SYMBOL[cur] ?? cur} ${num(n)}`;
const amountWithSymbol = amount;

const ddmmyyyy = (iso: string | null | undefined) => {
  if (!iso) return "";
  const d = new Date(iso);
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
};
const paidStamp = (iso: string) => {
  const d = new Date(iso);
  const mon = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"][d.getUTCMonth()];
  return `${String(d.getUTCDate()).padStart(2, "0")}/${mon}/${d.getUTCFullYear()}`;
};

function country(code: string | null | undefined): string {
  if (!code) return "";
  try {
    return (new Intl.DisplayNames(["en"], { type: "region" }).of(code) ?? code).toUpperCase();
  } catch {
    return code;
  }
}

const BANKS: Record<string, string> = { KREDBEBB: "KBC Bank, Havenlaan 2, B-1080, Brussels, Belgium" };

function partyLines(p: InvoiceParty, withContact: boolean): string[] {
  const city = [p.postalCode, p.city].filter(Boolean).join(" ");
  const out = [p.street, p.additionalStreet, city, country(p.country)].filter((x): x is string => !!x);
  if (withContact && p.phone) out.push(`Tel: ${p.phone}`);
  if (withContact && p.email) out.push(`E-mail: ${p.email}`);
  if (p.vatId) out.push(`VAT: ${p.vatId}`);
  if (p.registrationId && p.registrationId !== p.vatId) out.push(`Corp. Reg. No.: ${p.registrationId}`);
  if (!withContact && p.email) out.push(p.email);
  return out;
}

/** "2026010-powerhouse-genesis-powerhouse-expenses-july-2026": the PDF's name. */
export function invoiceFileName(s: InvoiceState): string {
  const other = s.direction === "OUTGOING" ? s.buyer : s.seller;
  return [s.number ?? "draft", slug(other.name ?? ""), slug(s.subject ?? "")].filter(Boolean).join("-").slice(0, 90);
}

/** The invoice as a printable page (A4, page numbers in the footer). */
/** The lines table's columns, as the PDF heads them; the first is the description. */
export const LINE_HEADERS = ["Description", "Unit Price Excl VAT", "Amount", "Price Excl VAT", "VAT", "Price Incl VAT"] as const;

/** One line's cells as the PDF writes them: text, not HTML. */
export interface PrintedLine {
  description: string;
  note: string | null;
  unitPrice: string;
  quantity: string;
  net: string;
  vatRate: string;
  gross: string;
}

/**
 * `symbol: false` leaves the currency out of the money cells, for a table
 * that says "All amounts in …" once, as the PDF does above its lines.
 */
export function printedLine(l: InvoiceState["lines"][number], cur: string, { symbol = true }: { symbol?: boolean } = {}): PrintedLine {
  const net = Math.round(l.quantity * l.unitPrice * 100) / 100;
  const vat = Math.round(net * l.vatRate) / 100;
  const amount = (n: number, c: string) => (symbol ? amountWithSymbol(n, c) : num(n));
  return {
    description:
      [l.category, l.description].filter(Boolean).join(" - ") +
      (l.original && l.original.currency !== cur ? ` - ${num(l.original.amount)} ${l.original.currency}` : ""),
    note: l.note && !/receipt to come/i.test(l.note) ? l.note : null,
    unitPrice: amount(l.unitPrice, cur),
    quantity: num(l.quantity, Number.isInteger(l.quantity) ? 0 : 2),
    net: amount(net, cur),
    vatRate: `${num(l.vatRate, 0)}%`,
    gross: amount(net + vat, cur),
  };
}

export function invoicePrintHtml(s: InvoiceState): string {
  const cur = s.currency;
  const t = computeTotals(s);
  const credit = s.kind === "CREDIT_NOTE";
  const kind = credit ? "Credit note" : "Invoice";
  const draft = s.status === "DRAFT";
  const p = s.paymentInstructions;
  const rate = s.vatCurrency ? s.exchangeRates.find((r) => (r.base === s.vatCurrency && r.quote === cur) || (r.base === cur && r.quote === s.vatCurrency)) : undefined;
  const rateMonth = rate?.date
    ? new Date(rate.date).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" })
    : "";
  const lastPaid = s.status === "PAID" ? s.payments.map((x) => x.paidAt).sort().at(-1) : undefined;

  const rows = s.lines
    .map((l) => {
      const p = printedLine(l, cur);
      return `<tr><td>${esc(p.description)}${p.note ? `<div class="sub">${esc(p.note)}</div>` : ""}</td>
        <td class="n">${p.unitPrice}</td><td class="n">${p.quantity}</td>
        <td class="n">${p.net}</td><td class="n">${p.vatRate}</td><td class="n">${p.gross}</td></tr>`;
    })
    .join("");

  const vatRows = t.groups.length
    ? t.groups.map((g) => `<tr><td>VAT ${num(g.rate, 0)}%</td><td class="n">${g.tax ? amount(g.tax, cur) : `${SYMBOL[cur] ?? cur} -`}</td></tr>`).join("")
    : `<tr><td>VAT</td><td class="n">${SYMBOL[cur] ?? cur} -</td></tr>`;
  const mentions = s.vatReasons
    .filter((r) => s.lines.some((l) => l.vatCategory === r.category))
    .map((r) => (r.text ?? r.code ?? "").split(" / "))
    .flat()
    .map((m) => `<p>${esc(m)}</p>`)
    .join("");
  const seller = s.seller;
  const meta: [string, string][] = [
    [`${kind} Date`, s.issuedAt ? ddmmyyyy(s.issuedAt) : draft ? "(on issue)" : ""],
    ["Delivery Date", ddmmyyyy(s.deliveredAt)],
    ["Due Date", ddmmyyyy(s.dueAt)],
  ];
  const title = invoiceFileName(s);

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>
  @page { size: A4; margin: 16mm 15mm 18mm;
    @bottom-left { content: "${esc(`${seller.name ?? ""} - ${kind}`)}"; font: 9px Helvetica, Arial, sans-serif; color: #555; }
    @bottom-right { content: "Pag. " counter(page) "/" counter(pages); font: 9px Helvetica, Arial, sans-serif; color: #555; } }
  html, body { margin: 0; background: #fff; }
  body { font: 10.5px/1.45 Helvetica, Arial, sans-serif; color: #111; }
  h1 { font: 600 26px/1.1 Georgia, "Times New Roman", serif; margin: 0 0 18px; letter-spacing: .01em; }
  .parties { display: flex; justify-content: space-between; gap: 24px; }
  .parties > div { flex: 1 1 0; }
  .parties .to { padding-left: 24%; }
  .name { font-weight: 700; font-size: 12px; margin-bottom: 2px; }
  .bank { margin-top: 10px; }
  .bank b, .label { font-weight: 700; }
  .subject { font-weight: 700; font-size: 12px; margin: 22px 0 8px; }
  .meta { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; }
  .meta table td { padding: 1px 12px 1px 0; }
  .meta .no { font-weight: 700; }
  .cur { display: flex; justify-content: space-between; margin: 12px 0 6px; font-style: italic; }
  table.lines { width: 100%; border-collapse: collapse; }
  table.lines th { text-align: left; font-weight: 700; border-bottom: 1px solid #111; padding: 4px 6px 4px 0; }
  table.lines td { border-bottom: 1px solid #ddd; padding: 4px 6px 4px 0; vertical-align: top; }
  table.lines .n { text-align: right; white-space: nowrap; }
  table.lines tr { break-inside: avoid; }
  .sub { color: #666; font-size: 9.5px; }
  .foot { display: flex; justify-content: flex-end; margin-top: 12px; break-inside: avoid; }
  .totals td { padding: 2px 0 2px 24px; }
  .totals .n { text-align: right; white-space: nowrap; }
  .totals .grand td { font-weight: 700; border-top: 1px solid #111; padding-top: 4px; }
  .notes { margin-top: 18px; break-inside: avoid; }
  .notes p { margin: 0 0 3px; }
  .paid { margin: 16px 0 0 auto; width: max-content; border: 2px solid #1f6f43; color: #1f6f43; font-weight: 700; padding: 4px 12px; text-align: center; transform: rotate(-4deg); }
  .draft { position: fixed; top: 40%; left: 0; right: 0; text-align: center; font: 700 110px/1 Helvetica, Arial, sans-serif; color: rgba(200, 30, 30, .12); transform: rotate(-30deg); pointer-events: none; }
</style></head><body>
${draft ? `<div class="draft">DRAFT</div>` : ""}
<h1>${kind}</h1>
<div class="parties">
  <div><div class="name">${esc(seller.name ?? "")}</div>${partyLines(seller, true).map((l) => `<div>${esc(l)}</div>`).join("")}
    ${p.account ? `<div class="bank"><b>Bank Account</b><div>IBAN: ${esc(p.account.replace(/(.{4})(?=.)/g, "$1 "))}</div>${p.bic ? `<div>BIC: ${esc(p.bic)}</div>` : ""}${p.bic && BANKS[p.bic] ? `<div>Bank: ${esc(BANKS[p.bic])}</div>` : ""}</div>` : ""}
  </div>
  <div class="to"><div class="name">${esc(s.buyer.name ?? "")}</div>${partyLines(s.buyer, false).map((l) => `<div>${esc(l)}</div>`).join("")}</div>
</div>
${s.subject ? `<div class="subject">${esc(s.subject)}</div>` : ""}
<div class="meta">
  <table>${meta.filter(([, v]) => v).map(([k, v]) => `<tr><td>${k}:</td><td>${esc(v)}</td></tr>`).join("")}</table>
  <div class="no">${kind} No.: ${esc(s.number ?? (draft ? "(on issue)" : ""))}</div>
</div>
${credit && s.precedingInvoices.length ? `<p>Corrects invoice ${s.precedingInvoices.map((x) => esc(x.number)).join(", ")}.</p>` : ""}
<div class="cur"><span>All amounts in ${esc(cur)}</span>${rate && rateMonth ? `<span>${esc(rateMonth)} ${esc(rate.base)}.${esc(rate.quote)} ${SYMBOL[rate.quote] ?? rate.quote} ${num(rate.rate, 6)}</span>` : ""}</div>
<table class="lines">
  <thead><tr>${LINE_HEADERS.map((h, i) => `<th${i ? ' class="n"' : ""}>${h}</th>`).join("")}</tr></thead>
  <tbody>${rows}</tbody>
</table>
<div class="foot"><table class="totals">
  <tr><td>Total Excl VAT</td><td class="n">${amount(t.net, cur)}</td></tr>
  ${vatRows}
  ${t.rounding ? `<tr><td>Rounding</td><td class="n">${amount(t.rounding, cur)}</td></tr>` : ""}
  <tr class="grand"><td>Total Incl VAT</td><td class="n">${amount(t.gross + t.rounding, cur)}</td></tr>
  ${s.vatCurrency && t.vatInVatCurrency !== null ? `<tr><td>VAT in ${esc(s.vatCurrency)}</td><td class="n">${amount(t.vatInVatCurrency, s.vatCurrency)}</td></tr>` : ""}
</table></div>
${lastPaid ? `<div class="paid">ALREADY PAID<br>${paidStamp(lastPaid)}</div>` : ""}
<div class="notes">
  ${p.meansText ? `<p>${esc(p.meansText)}</p>` : ""}
  ${mentions}
  ${p.remittance && p.remittance !== s.number ? `<p>Reference: ${esc(p.remittance)}</p>` : ""}
  ${s.paymentTerms ? `<p>${esc(s.paymentTerms)}</p>` : ""}
  ${s.notes ? `<p>${esc(s.notes)}</p>` : ""}
</div>
</body></html>`;
}

export function printInvoice(doc: InvoiceDocument): Promise<void> {
  return printHtml(invoicePrintHtml(doc.state.global));
}

/** The folder a line's receipt goes in: its category, as the bundles always had. */
const folderOf = (category: string | null | undefined) => slug(category ?? "") || "other";

/**
 * Everything that backs the invoice in one zip: each line's receipts in a
 * folder per category, and the supporting documents at invoice level.
 */
export async function downloadInvoiceBundle(doc: InvoiceDocument, client: AttachmentClient): Promise<number> {
  const s = doc.state.global;
  const base = `${s.number ?? "draft"}-supporting-materials`;
  const items = [
    ...s.lines.flatMap((l) => l.attachments.map((a) => ({ a, folder: folderOf(l.category) }))),
    ...s.attachments.filter((a) => a.role !== "ISSUED_COPY" && a.role !== "SOURCE").map((a) => ({ a, folder: "" })),
  ].filter((x) => x.a.ref);
  const used = new Set<string>();
  const entries: ZipEntry[] = [];
  for (const { a, folder } of items) {
    const { blob } = await client.downloadBlob({ documentId: doc.header.id, ref: a.ref as `attachment://v${number}:${string}` });
    let path = [base, folder, a.fileName].filter(Boolean).join("/");
    // The same file name twice (two receipts named receipt.pdf) keeps both.
    for (let n = 2; used.has(path); n++) path = path.replace(/(\.[^./]+)?$/, (ext) => ` (${n})${ext}`);
    used.add(path);
    entries.push({ path, bytes: new Uint8Array(await blob.arrayBuffer()), modified: new Date(a.addedAt) });
  }
  saveBlob(zip(entries), `${base}.zip`);
  return entries.length;
}

