// Reads an issued KSDC invoice back from its PDF: the header, the buyer, the
// lines and the totals. The layouts changed over the years (Dutch 2014–2018,
// English after; EUR, then USD with the month's rate), so every field is
// found by its label rather than its place. `pdftotext -table` keeps a line's
// description and its numbers on one row; `-layout` keeps the two address
// columns apart.
import { execFileSync } from "node:child_process";

const run = (mode, file) => {
  try {
    return execFileSync("pdftotext", ["-enc", "UTF-8", mode, file, "-"], { encoding: "utf8", maxBuffer: 32 << 20, stdio: ["ignore", "pipe", "ignore"] });
  } catch {
    return "";
  }
};

export const round2 = (n) => (Math.sign(n) * Math.round(Math.abs(n) * 100 + 1e-9)) / 100;
const iso = (d, m, y) => new Date(Date.UTC(Number(y), Number(m) - 1, Number(d), 12)).toISOString();

/** "1.000,00", "1,062.50", "2 145.00", "15 000.00", "53,48", "6.5", "21.25" → a number. */
export function parseAmount(raw) {
  let s = String(raw).replace(/[$€\s]/g, "");
  if (!/\d/.test(s)) return null;
  const neg = /^-/.test(s);
  s = s.replace(/^-/, "");
  const last = Math.max(s.lastIndexOf("."), s.lastIndexOf(","));
  if (last >= 0 && s.length - last - 1 !== 3) {
    // the last separator is the decimal one
    s = s.slice(0, last).replace(/[.,]/g, "") + "." + s.slice(last + 1);
  } else {
    // "1.000" / "1,000": a thousands separator (no invoice prints 3 decimals)
    s = s.replace(/[.,]/g, "");
  }
  const n = Number(s);
  return Number.isFinite(n) ? (neg ? -n : n) : null;
}

const NUM = String.raw`-?[$€]?\s?\d{1,3}(?:[ .,]\d{3})*(?:[.,]\d+)?|-?[$€]?\s?\d+(?:[.,]\d+)?`;
// unit price · quantity · net · vat% · incl — currency signs may stick to a number ("1$ 396,75")
const ROW = new RegExp(String.raw`^(.*?\S)\s{2,}(?:[$€]\s*)?(${NUM})\s+(?:[$€]\s*)?(\d+(?:[.,]\d+)?)\s*(?:[$€]\s*)?(${NUM})\s+(\d{1,3})\s?%\s+(?:[$€]\s*)?(${NUM}|-)\s*$`);
const ROW_NO_UNIT = new RegExp(String.raw`^(.*?\S)\s{2,}(?:[$€]\s*)?(${NUM})\s+(\d{1,3})\s?%\s+(?:[$€]\s*)?(${NUM}|-)\s*$`);

function dateAfter(text, labels) {
  const m = new RegExp(String.raw`(?:${labels})\s*:?\s*(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})`, "i").exec(text);
  return m ? iso(m[1], m[2], m[3]) : null;
}

/** The buyer: the right-hand address column of the page's top. */
function buyerBlock(layout) {
  const top = [];
  for (const line of layout.split(/\r?\n/)) {
    if (/Facturatiedatum|Invoice Date|Factuurdatum|^\s*Datum:/i.test(line)) break;
    top.push(line);
  }
  // the column starts where most top lines have a run of spaces then text
  const starts = top
    .map((l) => /^(.*?\S)?\s{3,}(\S.*)$/.exec(l))
    .filter(Boolean)
    .map((m) => (m[1] ? m[1].length : 0) + (m[0].length - m[1]?.length - m[2].length || 0));
  const col = starts.length ? starts.sort((a, b) => a - b)[Math.floor(starts.length / 2)] : 40;
  const right = top
    .map((l) => (l.length > col - 4 ? l.slice(col - 4).trim() : ""))
    .filter((l) => l && !/^(Invoice|Factuur)$/i.test(l));
  return right;
}

const COUNTRY = { BELGIUM: "BE", BELGIË: "BE", DENMARK: "DK", PHILIPPINES: "PH", SWITZERLAND: "CH", "UNITED STATES": "US", USA: "US", NETHERLANDS: "NL", GERMANY: "DE", "UNITED KINGDOM": "GB", "CAYMAN ISLANDS": "KY", PANAMA: "PA", ESTONIA: "EE" };

function partyFrom(block) {
  const party = { name: block[0] ?? null };
  const rest = block.slice(1);
  const addr = [];
  for (const l of rest) {
    let m;
    if ((m = /^(?:BTW|VAT(?: No\.?)?|TVA)\s*:?\s*([A-Z]{2})\s?([\d.\s]+)$/i.exec(l))) party.vatId = (m[1] + m[2].replace(/[.\s]/g, "")).toUpperCase();
    else if ((m = /^(?:CVR(?:-nr)?|Company ID|Corp\. Reg\. No\.|UID|Reg(?:istration)? No\.?)\s*:?\s*(.+)$/i.exec(l))) party.registrationId = m[1].trim();
    else if ((m = /^(?:E-?mail\s*:?\s*)?([\w.+-]+@[\w.-]+\.[a-z]{2,})$/i.exec(l))) party.email = m[1];
    else if (COUNTRY[l.toUpperCase().replace(/[,.]$/, "")]) party.country = COUNTRY[l.toUpperCase().replace(/[,.]$/, "")];
    else addr.push(l.replace(/,$/, ""));
  }
  // the postal line: "8500 Kortrijk", "2300 Copenhagen", "6300 Zug", "6014 Mandaue City"
  const pc = addr.findIndex((l) => /^(?:[A-Z]{1,2}-)?\d{4,5}\s+\S/.test(l));
  if (pc >= 0) {
    const m = /^((?:[A-Z]{1,2}-)?\d{4,5})\s+(.+)$/.exec(addr[pc]);
    party.postalCode = m[1];
    party.city = m[2];
    party.street = addr[pc - 1] ?? null;
    const before = addr.slice(0, Math.max(0, pc - 1));
    if (before.length) party.additionalStreet = before.join(", ");
  } else if (addr.length) {
    party.street = addr.join(", ");
  }
  if (!party.country && party.vatId) party.country = party.vatId.slice(0, 2);
  if (!party.country && /^\d{4}$/.test(party.postalCode ?? "") && /Kortrijk|Gent|Ghent|Brussel|Antwerpen|Evergem|Leuven|Brugge/i.test(party.city ?? "")) party.country = "BE";
  return party;
}

function legal(text) {
  if (/verlegd|reverse charge|autoliquidation|taxable in the country of the recipient/i.test(text))
    return { category: "REVERSE_CHARGE", code: "VATEX-EU-AE", text: /BTW verlegd/i.test(text) ? "BTW verlegd / VAT reverse charge" : /taxable in the country/i.test(text) ? "Service taxable in the country of the recipient" : "Reverse charge" };
  if (/39bis/i.test(text))
    return { category: "INTRA_COMMUNITY", code: "VATEX-EU-IC", text: "Vrijgesteld van BTW, overeenkomstig art. 39bis WBTW / Exempt from VAT in accordance with art. 39bis WBTW" };
  if (/art\.?\s*21/i.test(text)) return { category: "OUTSIDE_SCOPE", code: "VATEX-EU-O", text: "Services outside the scope of Belgian VAT, art. 21 §2 W.btw" };
  return null;
}

export function parseInvoicePdf(file) {
  const table = run("-table", file);
  const layout = run("-layout", file);
  const flat = layout.replace(/\s+/g, " ");
  const number = /(?:Factuurnummer|Creditnotanummer|Invoice No\.?|Invoice Number|Credit Note No\.?)\s*:?\s*(\d{7})/i.exec(flat)?.[1] ?? null;
  const creditNote = /Creditnota|Credit Note/i.test(flat);
  const usd = /All amounts (?:are )?in USD|payable in USD/i.test(flat) || /Total Excl VAT\s*\$/.test(flat);
  const rateM = /(\w+) EUR\.USD:?\s*\$?\s*([\d.,]+)/.exec(flat) ?? /EUR\.USD:\s*\$\s*([\d.,]+)/.exec(flat);
  // the rate may print on the line above its label (2024011): take the 1.0x–1.3x number nearest the label
  let rate = null;
  if (usd) {
    const near = /EUR\.USD[\s\S]{0,200}/.exec(layout)?.[0] ?? "";
    const around = (/[\s\S]{0,200}EUR\.USD/.exec(layout)?.[0] ?? "") + near;
    const cands = [...around.matchAll(/\b1[,.]\d{4,6}\b/g)].map((m) => parseAmount(m[0]));
    rate = cands.find((n) => n > 0.9 && n < 1.4) ?? (rateM ? parseAmount(rateM[2] ?? rateM[1]) : null);
    // two months printed ("March 2025 - EUR.USD 1,078858" above "June 2025 - EUR.USD"): the
    // delivery month's rate is the invoice's; the lines priced at another carry their own
    const all = [...layout.matchAll(/\b1[,.]\d{6}\b/g)].map((m) => parseAmount(m[0])).filter((n) => n > 0.9 && n < 1.4);
    if (new Set(all).size > 1) rate = all.at(-1);
  }

  // lines: between the column header and the "Total Excl" row
  const rows = table.split(/\r?\n/);
  const head = rows.findIndex((l) => /^\s*(Omschrijving|Des\s?crip\s?tio\s?n|Description)\b/i.test(l));
  const lines = [];
  let pending = [];
  let totalExcl = null;
  let totalIncl = null;
  let vatTotal = null;
  for (let i = head + 1; head >= 0 && i < rows.length; i++) {
    // a page's footer ("KSDC bv - Invoice    Pag. 1/2") is not part of the row it lands beside
    const l = rows[i].replace(/^\s*KSDC bv(?:ba)? - (?:Invoice|Factuur)\s+Pag\.\s*\d+\/\d+\s*/i, "").replace(/\s+KSDC bv(?:ba)? - (?:Invoice|Factuur)\s+Pag\.\s*\d+\/\d+\s*$/i, "").replace(/\s+$/, "");
    if (!l.trim()) continue;
    let m;
    if ((m = /(?:Totaal|Total)\s+Excl\.?\s*(?:BTW|VAT)\s*(?:[$€]\s*)?(\S.*)$/i.exec(l))) {
      // a second "Total Excl" closes a reprint of the same table (2023014)
      if (totalExcl === null) totalExcl = /^[\d\s.,-]+$/.test(m[1].trim()) ? parseAmount(m[1]) : NaN;
      continue;
    }
    if (totalExcl !== null && /(?:Totaal|Total)\s+Incl/i.test(l) === false && !/^\s*(?:BTW|VAT)\s+\d/i.test(l)) continue;
    if ((m = /(?:Totaal|Total)\s+Incl\.?\s*(?:BTW|VAT)\s*(?:[$€]\s*)?(\S.*)$/i.exec(l))) {
      totalIncl = parseAmount(m[1]);
      break;
    }
    if ((m = /^\s*(?:BTW|VAT)\s+\d+\s?%\s*(?:[$€]\s*)?(\S.*)$/i.exec(l))) {
      vatTotal = m[1].trim() === "-" ? 0 : parseAmount(m[1]);
      continue;
    }
    if ((m = ROW.exec(l))) {
      const description = [...pending, m[1].trim()].join(" ").replace(/\s+/g, " ");
      pending = [];
      lines.push({ description, unitPrice: parseAmount(m[2]), quantity: parseAmount(m[3]), net: parseAmount(m[4]), vatRate: Number(m[5]) });
    } else if ((m = ROW_NO_UNIT.exec(l))) {
      const description = [...pending, m[1].trim()].join(" ").replace(/\s+/g, " ");
      pending = [];
      const net = parseAmount(m[2]);
      lines.push({ description, unitPrice: net, quantity: 1, net, vatRate: Number(m[3]) });
    } else if (totalExcl === null) {
      pending.push(l.trim());
    }
  }
  // a description continued below its row ("Management fees, …" above, two lines of text)
  if (pending.length && lines.length && totalExcl === null) lines.at(-1).description += " " + pending.join(" ");

  // a VAT rate the PDF misprints ("121%", "100%"): the invoice's own rate
  const after = table.slice(Math.max(0, table.search(/(?:Totaal|Total)\s+Excl/i)));
  const docRate = Number(/(?:BTW|VAT)\s+(\d{1,2})\s?%/i.exec(after)?.[1] ?? 0);
  for (const l of lines) if (l.vatRate > 27) l.vatRate = docRate;
  if (Number.isNaN(totalExcl)) totalExcl = null;
  if (totalExcl === null && totalIncl !== null) totalExcl = round2(totalIncl - (vatTotal ?? 0));
  // the unit price prints rounded ("592.60 × 10 = 5 925.98"): the net is what was invoiced
  for (const l of lines) if (l.net !== null && l.quantity && round2(l.quantity * l.unitPrice) !== round2(l.net)) l.unitPrice = l.net / l.quantity;
  // a row the page footer printed over ("KSoSftDwaCre…Pag1.01,8/12") cannot be read back:
  // what it billed is the difference to the printed total
  const readable = round2(lines.reduce((s, l) => s + round2(l.quantity * l.unitPrice), 0));
  const garbled = rows.filter((r) => /Pag(?!\.\s)\S*\d/.test(r)).length;
  if (totalExcl !== null && readable < totalExcl - 0.015 && garbled) {
    const missing = round2(totalExcl - readable);
    lines.push({
      description: garbled > 1 ? `${garbled} lines not readable from the PDF` : "Line not readable from the PDF",
      note: "The page footer prints over this row in the issued PDF; the amount is the difference to the invoice's total. See the issued copy.",
      unitPrice: missing,
      quantity: 1,
      net: missing,
      vatRate: lines[0]?.vatRate ?? 0,
      recovered: true,
    });
  }
  const sum = round2(lines.reduce((s, l) => s + round2(l.quantity * l.unitPrice), 0));
  // the subject: the line above the dates ("CogniStreamer Januari 2014", "MakerDAO Consultancy   Invoice No.: 2019001")
  const ll = layout.split(/\r?\n/);
  const at = ll.findIndex((l) => /Facturatiedatum|Invoice Date|Factuurdatum|^\s*Datum:/i.test(l));
  let subject = null;
  for (let i = at - 1; at > 0 && i >= 0; i--) {
    const l = ll[i].replace(/\s{2,}(?:Invoice No|Factuurnummer|Creditnotanummer)[^\n]*$/i, "").trim();
    if (!l) continue;
    if (!/^(BIC|Bank|IBAN|KBC|E-mail|Tel|BTW|VAT|Corp|Invoice$|Factuur$)/i.test(l) && !/:/.test(l)) subject = l;
    break;
  }
  return {
    number,
    kind: creditNote ? "CREDIT_NOTE" : "INVOICE",
    issuedAt: dateAfter(flat, "Facturatiedatum|Factuurdatum|Invoice Date") ?? dateAfter(flat, "Datum"),
    deliveredAt: dateAfter(flat, "Leverdatum|Delivery Date"),
    dueAt: dateAfter(flat, "Vervaldatum|Due Date"),
    paidAt: (() => {
      const p = /ALREADY PAID\s+(\d{2})\/([A-Z]{3})\/(\d{4})/.exec(flat);
      const MON = { JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6, JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12 };
      return p ? iso(p[1], MON[p[2]], p[3]) : null;
    })(),
    subject,
    language: /Factuurnummer|Facturatiedatum/i.test(flat) ? "nl" : "en",
    currency: usd ? "USD" : "EUR",
    rate,
    buyer: partyFrom(buyerBlock(layout)),
    legal: legal(flat),
    lines,
    sum,
    totalExcl,
    vatTotal,
    totalIncl,
    balanced: totalExcl !== null && Math.abs(sum - totalExcl) < 0.015,
  };
}
