/**
 * The v1 → v2 upgrade, written by hand (codegen could not derive it: the
 * line type changed). Hand edits survive regeneration.
 *
 * v1 had one counterparty; v2 has a seller and a buyer. The counterparty
 * becomes the buyer of an outgoing invoice and the seller of an incoming
 * one, its one-line address the street. A v1 line has no VAT category: a
 * rate above zero is standard-rated, a zero rate zero-rated (v1 never said
 * why). v1's free reference becomes the buyer reference.
 */
import type { Action, PHDocument, UpgradeTransition } from "document-model";
import type {
  InvoicePHState as StateV1,
  InvoiceState as GlobalV1,
} from "document-models/invoice/v1";
import type {
  InvoiceParty,
  InvoicePHState as StateV2,
  InvoiceState as GlobalV2,
} from "document-models/invoice/v2";

function emptyParty(): InvoiceParty {
  return {
    name: null,
    contactId: null,
    vatId: null,
    registrationId: null,
    registrationScheme: null,
    endpointId: null,
    endpointScheme: null,
    email: null,
    phone: null,
    street: null,
    additionalStreet: null,
    postalCode: null,
    city: null,
    region: null,
    country: null,
  };
}

export function upgradeGlobal(v1: GlobalV1): GlobalV2 {
  const counterparty: InvoiceParty = {
    ...emptyParty(),
    name: v1.counterparty.name ?? null,
    contactId: v1.counterparty.contactId ?? null,
    email: v1.counterparty.email ?? null,
    vatId: v1.counterparty.vatId ?? null,
    street: v1.counterparty.address ?? null,
  };
  const outgoing = v1.direction === "OUTGOING";
  return {
    kind: "INVOICE",
    direction: v1.direction,
    status: v1.status,
    number: v1.number ?? null,
    subject: null,
    issuedAt: v1.issuedAt ?? null,
    dueAt: v1.dueAt ?? null,
    deliveredAt: null,
    period: null,
    currency: v1.currency,
    vatCurrency: null,
    exchangeRates: [],
    seller: outgoing ? emptyParty() : counterparty,
    buyer: outgoing ? counterparty : emptyParty(),
    references: {
      buyerReference: v1.reference ?? null,
      orderReference: null,
      contractReference: null,
      projectReference: null,
    },
    precedingInvoices: [],
    lines: v1.lines.map((line) => ({
      id: line.id,
      description: line.description,
      note: null,
      quantity: line.quantity,
      unitCode: "C62",
      unitPrice: line.unitPrice,
      vatCategory: line.vatRate > 0 ? "STANDARD" : "ZERO_RATED",
      vatRate: line.vatRate,
      category: null,
      period: null,
      original: null,
      attachments: [],
    })),
    vatReasons: [],
    paymentInstructions: {
      meansCode: null,
      meansText: null,
      account: null,
      accountName: null,
      bic: null,
      remittance: null,
    },
    paymentTerms: null,
    roundingAmount: null,
    notes: v1.notes ?? null,
    attachments: [],
    payments: v1.payments.map((p) => ({ ...p, transactionId: p.transactionId ?? null })),
    voidReason: v1.voidReason ?? null,
  };
}

function upgradeReducer(
  document: PHDocument<StateV1>,
  _action: Action,
): PHDocument<StateV2> {
  return {
    ...document,
    state: {
      ...document.state,
      global: upgradeGlobal(document.state.global),
    },
    initialState: {
      ...document.initialState,
      global: upgradeGlobal(document.initialState.global),
    },
  };
}

export const v2: UpgradeTransition = {
  toVersion: 2,
  upgradeReducer,
  description:
    "Peppol-aligned invoice: the counterparty becomes the buyer (outgoing) or seller (incoming), lines get a VAT category",
};
