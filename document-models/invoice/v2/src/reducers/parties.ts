import type {
  InvoicePartiesOperations,
  InvoiceParty,
  SetBuyerInput,
} from "document-models/invoice/v2";
import { InvoiceNotDraftError } from "../../gen/parties/error.js";
import { code, text } from "../rules.js";

/** A party's fields from an input: trimmed, codes upper-cased, VAT ids without spaces. */
function applyParty(party: InvoiceParty, i: SetBuyerInput): void {
  for (const key of [
    "name",
    "registrationId",
    "registrationScheme",
    "endpointId",
    "endpointScheme",
    "email",
    "phone",
    "street",
    "additionalStreet",
    "postalCode",
    "city",
    "region",
  ] as const) {
    if (i[key] !== undefined) party[key] = text(i[key]);
  }
  if (i.contactId !== undefined) party.contactId = i.contactId ?? null;
  if (i.vatId !== undefined)
    party.vatId = code(i.vatId)?.replace(/\s+/g, "") ?? null;
  if (i.country !== undefined) party.country = code(i.country);
}

export const invoicePartiesOperations: InvoicePartiesOperations = {
  setSellerOperation(state, action) {
    if (state.status !== "DRAFT")
      throw new InvoiceNotDraftError(
        "The parties are fixed once the invoice is issued",
      );
    applyParty(state.seller, action.input);
  },
  setBuyerOperation(state, action) {
    if (state.status !== "DRAFT")
      throw new InvoiceNotDraftError(
        "The parties are fixed once the invoice is issued",
      );
    applyParty(state.buyer, action.input);
  },
};
