// What the reducers check and normalise. Every check runs before a reducer
// changes anything: the runtime keeps a partial mutation when a reducer
// throws halfway.
import type {
  InvoiceAttachment,
  InvoiceLine,
  InvoiceState,
  VatCategory,
} from "../gen/schema/types.js";
import { originalRate, round2 } from "./totals.js";

/** Trimmed text, or null when empty. Callers check for undefined ("leave as is") first. */
export function text(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed === "" ? null : trimmed;
}

/** Upper-cased, trimmed code (currency, country, unit), or null. */
export function code(value: string | null | undefined): string | null {
  return text(value)?.toUpperCase() ?? null;
}

export function isCurrencyCode(value: string | null | undefined): value is string {
  return typeof value === "string" && /^[A-Z]{3}$/.test(value);
}

/** Why a line breaks a rule, or null when it is fine. */
export function lineProblem(line: InvoiceLine): string | null {
  if (line.description.trim() === "") return "A line needs a description";
  if (!Number.isFinite(line.quantity) || line.quantity === 0)
    return "The quantity must be a number other than zero";
  const o = line.original;
  if (o) {
    if (!Number.isFinite(o.amount) || o.amount < 0)
      return "The original cost cannot be negative";
    if (!isCurrencyCode(o.currency)) return "The original currency must be an ISO 4217 code";
    if (o.rate !== null && o.rate !== undefined && !(Number.isFinite(o.rate) && o.rate > 0))
      return "The exchange rate must be positive";
  }
  if (!Number.isFinite(line.unitPrice) || line.unitPrice < 0)
    return "The price cannot be negative: use a negative quantity for a deduction";
  if (!/^[A-Z0-9]{1,3}$/.test(line.unitCode))
    return "The unit must be a UN/ECE code, such as C62, HUR or DAY";
  if (!Number.isFinite(line.vatRate) || line.vatRate < 0 || line.vatRate > 100)
    return "The VAT rate must be a percentage";
  if (line.vatCategory === "STANDARD" && line.vatRate === 0)
    return "Standard-rated VAT needs a rate above zero; pick zero-rated or an exemption instead";
  if (line.vatCategory !== "STANDARD" && line.vatRate !== 0)
    return `${categoryLabel(line.vatCategory)} lines carry no VAT: the rate must be 0`;
  const p = line.period;
  if (p?.start && p.end && p.end < p.start) return "The period ends before it starts";
  return null;
}

function categoryLabel(category: VatCategory): string {
  return {
    STANDARD: "Standard-rated",
    ZERO_RATED: "Zero-rated",
    EXEMPT: "Exempt",
    REVERSE_CHARGE: "Reverse-charge",
    INTRA_COMMUNITY: "Intra-community",
    EXPORT: "Export",
    OUTSIDE_SCOPE: "Out-of-scope",
  }[category];
}

/**
 * A forward-billed line's price follows its original cost: when a rate is
 * known, the unit price is the cost converted and rounded. Without a rate
 * the price stays as it was given.
 */
export function derivePrice(
  state: Pick<InvoiceState, "currency" | "exchangeRates">,
  line: InvoiceLine,
): void {
  const rate = originalRate(state, line);
  if (rate !== null && line.original) line.unitPrice = round2(line.original.amount * rate);
}

/** Re-price every forward-billed line, after a currency or a rate changed. */
export function repriceLines(state: InvoiceState): void {
  for (const line of state.lines) derivePrice(state, line);
}

/** Every attachment id in use, at invoice and line level. */
export function allAttachments(state: InvoiceState): InvoiceAttachment[] {
  return [...state.attachments, ...state.lines.flatMap((l) => l.attachments)];
}

/** The list that holds an attachment, and its index there. */
export function locateAttachment(
  state: InvoiceState,
  id: string,
): { list: InvoiceAttachment[]; index: number } | null {
  const lists = [state.attachments, ...state.lines.map((l) => l.attachments)];
  for (const list of lists) {
    const index = list.findIndex((a) => a.id === id);
    if (index >= 0) return { list, index };
  }
  return null;
}
