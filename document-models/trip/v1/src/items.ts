import type { TripCost, TripInvoiceLink, TripState } from "document-models/trip/v1";

/** The flat cost fields every item's input carries. */
export type CostInput = {
  amount?: number | null;
  currency?: string | null;
  converted?: number | null;
};

/** The flat invoice-link fields every item's input carries. */
export type LinkInput = {
  invoiceId?: string | null;
  invoiceLineId?: string | null;
  invoiceNumber?: string | null;
};

/**
 * A cost from an item's input: none without an amount. The currency defaults
 * to the trip's; a converted amount only means something in another currency.
 */
export function costFrom(i: CostInput, tripCurrency: string): TripCost | null {
  if (i.amount === undefined || i.amount === null) return null;
  const currency = i.currency || tripCurrency;
  return {
    amount: i.amount,
    currency,
    converted: currency === tripCurrency ? null : (i.converted ?? null),
  };
}

/** A cost after an update: the fields the input names replace the old ones; a null amount clears it. */
export function mergeCost(
  old: TripCost | null | undefined,
  i: CostInput,
  tripCurrency: string,
): TripCost | null {
  if (i.amount === null) return null;
  return costFrom(
    {
      amount: i.amount ?? old?.amount,
      currency: i.currency !== undefined ? i.currency : old?.currency,
      converted: i.converted !== undefined ? i.converted : old?.converted,
    },
    tripCurrency,
  );
}

/** The invoice line an item was billed on with: none without an invoice. */
export function invoiceFrom(i: LinkInput): TripInvoiceLink | null {
  if (!i.invoiceId) return null;
  return {
    invoiceId: i.invoiceId,
    lineId: i.invoiceLineId ?? null,
    number: i.invoiceNumber ?? null,
  };
}

/** Whether a transport leg, stay, meal or extra with this id is on the trip. */
export function itemExists(state: TripState, id: string): boolean {
  return (
    state.transport.some((x) => x.id === id) ||
    state.stays.some((x) => x.id === id) ||
    state.meals.some((x) => x.id === id) ||
    state.extras.some((x) => x.id === id)
  );
}
