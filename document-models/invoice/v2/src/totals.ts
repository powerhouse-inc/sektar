// Totals the way EN 16931 computes them: each line's net amount is rounded
// to the cent (BT-131), VAT is computed per category and rate on the sum of
// those (BG-23), and every document total is rounded to the cent. The
// reducer (is an invoice paid?), the editor and the indexes all use these,
// so an invoice reads the same everywhere.
import type {
  ExchangeRate,
  InvoiceLine,
  InvoiceState,
  VatCategory,
} from "../gen/schema/types.js";

/** Round to two decimals, half away from zero, without float drift (1.005 → 1.01). */
export function round2(value: number): number {
  const sign = value < 0 ? -1 : 1;
  return (sign * Math.round(Math.abs(value) * 100 + 1e-9)) / 100;
}

/** BT-131: quantity × net price, rounded. */
export function lineNet(line: Pick<InvoiceLine, "quantity" | "unitPrice">): number {
  return round2(line.quantity * line.unitPrice);
}

/**
 * How many `to` one `from` is worth, from a list of rates quoted either way
 * (1 base = rate quote). Null when the pair is unknown.
 */
export function findRate(
  rates: readonly ExchangeRate[],
  from: string,
  to: string,
): number | null {
  if (from === to) return 1;
  const direct = rates.find((r) => r.base === from && r.quote === to);
  if (direct) return direct.rate;
  const inverse = rates.find((r) => r.base === to && r.quote === from);
  if (inverse) return 1 / inverse.rate;
  return null;
}

/**
 * The rate that turns a forward-billed line's original cost into the invoice
 * currency: the line's own rate, else the invoice's rate for the pair.
 */
export function originalRate(
  state: Pick<InvoiceState, "currency" | "exchangeRates">,
  line: Pick<InvoiceLine, "original">,
): number | null {
  const original = line.original;
  if (!original) return null;
  if (original.rate !== null && original.rate !== undefined) return original.rate;
  return findRate(state.exchangeRates, original.currency, state.currency);
}

export type VatGroup = {
  category: VatCategory;
  rate: number;
  /** BT-116 */
  taxable: number;
  /** BT-117 */
  tax: number;
};

export type Totals = {
  /** BT-106: the sum of the line net amounts */
  net: number;
  /** BT-110 */
  vat: number;
  /** BT-112 */
  gross: number;
  /** BT-113: what the recorded payments cover */
  paid: number;
  /** BT-114 */
  rounding: number;
  /** BT-115: what is still to be paid */
  due: number;
  /** BT-111: the VAT in the VAT accounting currency, when there is one and its rate is known */
  vatInVatCurrency: number | null;
  /** One row per VAT category and rate, in the order the lines use them */
  groups: VatGroup[];
};

export function computeTotals(
  state: Pick<
    InvoiceState,
    "lines" | "payments" | "roundingAmount" | "currency" | "vatCurrency" | "exchangeRates"
  >,
): Totals {
  const groups: VatGroup[] = [];
  let net = 0;
  for (const line of state.lines) {
    const amount = lineNet(line);
    net += amount;
    let group = groups.find(
      (g) => g.category === line.vatCategory && g.rate === line.vatRate,
    );
    if (!group) {
      group = { category: line.vatCategory, rate: line.vatRate, taxable: 0, tax: 0 };
      groups.push(group);
    }
    group.taxable += amount;
  }
  let vat = 0;
  for (const group of groups) {
    group.taxable = round2(group.taxable);
    group.tax = round2((group.taxable * group.rate) / 100);
    vat += group.tax;
  }
  net = round2(net);
  vat = round2(vat);
  const gross = round2(net + vat);
  const paid = round2(state.payments.reduce((sum, p) => sum + p.amount, 0));
  const rounding = state.roundingAmount ?? 0;
  const due = round2(gross - paid + rounding);
  const toVat = state.vatCurrency
    ? findRate(state.exchangeRates, state.currency, state.vatCurrency)
    : null;
  return {
    net,
    vat,
    gross,
    paid,
    rounding,
    due,
    vatInVatCurrency: toVat === null ? null : round2(vat * toVat),
    groups,
  };
}

/** Peppol's code for each category (UNCL 5305). */
export const VAT_CATEGORY_CODE: Record<VatCategory, string> = {
  STANDARD: "S",
  ZERO_RATED: "Z",
  EXEMPT: "E",
  REVERSE_CHARGE: "AE",
  INTRA_COMMUNITY: "K",
  EXPORT: "G",
  OUTSIDE_SCOPE: "O",
};

/** Categories whose VAT breakdown must say why no VAT is charged (BR-E-10, BR-AE-10, BR-IC-10, BR-G-10, BR-O-10). */
export const CATEGORY_NEEDS_REASON: Record<VatCategory, boolean> = {
  STANDARD: false,
  ZERO_RATED: false,
  EXEMPT: true,
  REVERSE_CHARGE: true,
  INTRA_COMMUNITY: true,
  EXPORT: true,
  OUTSIDE_SCOPE: true,
};
