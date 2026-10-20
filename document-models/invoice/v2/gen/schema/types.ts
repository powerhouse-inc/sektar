export type Maybe<T> = T | null | undefined;
export type InputMaybe<T> = T | null | undefined;
export type Exact<T extends { [key: string]: unknown }> = {
  [K in keyof T]: T[K];
};
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & {
  [SubKey in K]?: Maybe<T[SubKey]>;
};
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & {
  [SubKey in K]: Maybe<T[SubKey]>;
};
export type MakeEmpty<
  T extends { [key: string]: unknown },
  K extends keyof T,
> = { [_ in K]?: never };
export type Incremental<T> =
  | T
  | {
      [P in keyof T]?: P extends " $fragmentName" | "__typename" ? T[P] : never;
    };
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string };
  String: { input: string; output: string };
  Boolean: { input: boolean; output: boolean };
  Int: { input: number; output: number };
  Float: { input: number; output: number };
  Address: { input: `${string}:0x${string}`; output: `${string}:0x${string}` };
  Amount: {
    input: { unit?: string; value?: number };
    output: { unit?: string; value?: number };
  };
  Amount_Crypto: {
    input: { unit: string; value: string };
    output: { unit: string; value: string };
  };
  Amount_Currency: {
    input: { unit: string; value: string };
    output: { unit: string; value: string };
  };
  Amount_Fiat: {
    input: { unit: string; value: number };
    output: { unit: string; value: number };
  };
  Amount_Money: { input: number; output: number };
  Amount_Percentage: { input: number; output: number };
  Amount_Tokens: { input: number; output: number };
  AttachmentRef: {
    input: `attachment://v${number}:${string}`;
    output: `attachment://v${number}:${string}`;
  };
  Currency: { input: string; output: string };
  Date: { input: string; output: string };
  DateTime: { input: string; output: string };
  EmailAddress: { input: string; output: string };
  EthereumAddress: { input: string; output: string };
  OID: { input: string; output: string };
  OLabel: { input: string; output: string };
  PHID: { input: string; output: string };
  URL: { input: string; output: string };
  Unknown: { input: unknown; output: unknown };
  Upload: { input: File; output: File };
};

export type AddAttachmentInput = {
  addedAt: Scalars["DateTime"]["input"];
  description?: InputMaybe<Scalars["String"]["input"]>;
  documentId?: InputMaybe<Scalars["PHID"]["input"]>;
  fileName: Scalars["String"]["input"];
  id: Scalars["OID"]["input"];
  lineId?: InputMaybe<Scalars["OID"]["input"]>;
  mimeType: Scalars["String"]["input"];
  ref?: InputMaybe<Scalars["AttachmentRef"]["input"]>;
  role: AttachmentRole;
  sizeBytes?: InputMaybe<Scalars["Int"]["input"]>;
  url?: InputMaybe<Scalars["URL"]["input"]>;
};

export type AddLineInput = {
  category?: InputMaybe<Scalars["String"]["input"]>;
  description: Scalars["String"]["input"];
  id: Scalars["OID"]["input"];
  note?: InputMaybe<Scalars["String"]["input"]>;
  originalAmount?: InputMaybe<Scalars["Float"]["input"]>;
  originalCurrency?: InputMaybe<Scalars["String"]["input"]>;
  originalRate?: InputMaybe<Scalars["Float"]["input"]>;
  periodEnd?: InputMaybe<Scalars["DateTime"]["input"]>;
  periodStart?: InputMaybe<Scalars["DateTime"]["input"]>;
  position?: InputMaybe<Scalars["Int"]["input"]>;
  quantity: Scalars["Float"]["input"];
  unitCode?: InputMaybe<Scalars["String"]["input"]>;
  unitPrice: Scalars["Float"]["input"];
  vatCategory: VatCategory;
  vatRate: Scalars["Float"]["input"];
};

export type AddPrecedingInvoiceInput = {
  documentId?: InputMaybe<Scalars["PHID"]["input"]>;
  id: Scalars["OID"]["input"];
  issuedAt?: InputMaybe<Scalars["DateTime"]["input"]>;
  number: Scalars["String"]["input"];
};

export type AttachmentRole =
  /** The invoice as issued, e.g. the PDF that was sent */
  | "ISSUED_COPY"
  | "OTHER"
  | "RECEIPT"
  /** The editable original, e.g. the .docx */
  | "SOURCE"
  | "SUPPORTING"
  | "TIMESHEET";

export type ExchangeRate = {
  base: Scalars["String"]["output"];
  /** The day the rate applies to */
  date: Maybe<Scalars["DateTime"]["output"]>;
  quote: Scalars["String"]["output"];
  rate: Scalars["Float"]["output"];
  /** Where the rate comes from, e.g. ECB, a bank statement */
  source: Maybe<Scalars["String"]["output"]>;
};

export type InvoiceAttachment = {
  addedAt: Scalars["DateTime"]["output"];
  /** BT-123 */
  description: Maybe<Scalars["String"]["output"]>;
  /** A document here that holds it, e.g. a File in the Files drive */
  documentId: Maybe<Scalars["PHID"]["output"]>;
  fileName: Scalars["String"]["output"];
  id: Scalars["OID"]["output"];
  mimeType: Scalars["String"]["output"];
  /** Stored bytes */
  ref: Maybe<Scalars["AttachmentRef"]["output"]>;
  role: AttachmentRole;
  sizeBytes: Maybe<Scalars["Int"]["output"]>;
  /** BT-124: an external location */
  url: Maybe<Scalars["URL"]["output"]>;
};

export type InvoiceDirection = "INCOMING" | "OUTGOING";

export type InvoiceKind = "CREDIT_NOTE" | "INVOICE";

export type InvoiceLine = {
  /** Receipts and other evidence for this line */
  attachments: Array<InvoiceAttachment>;
  /** BT-133: the buyer's accounting reference, e.g. Software, Travel */
  category: Maybe<Scalars["String"]["output"]>;
  /** BT-153 */
  description: Scalars["String"]["output"];
  id: Scalars["OID"]["output"];
  /** BT-127 */
  note: Maybe<Scalars["String"]["output"]>;
  /** A forward-billed cost: what it cost, in its own currency */
  original: Maybe<OriginalAmount>;
  /** BG-26 */
  period: Maybe<InvoicePeriod>;
  /** BT-129: negative for a deduction */
  quantity: Scalars["Float"]["output"];
  /** BT-130: UN/ECE Rec 20, e.g. C62 (unit), HUR (hour), DAY */
  unitCode: Scalars["String"]["output"];
  /** BT-146, in the invoice currency; never negative */
  unitPrice: Scalars["Float"]["output"];
  /** BT-151 */
  vatCategory: VatCategory;
  /** BT-152, percent */
  vatRate: Scalars["Float"]["output"];
};

export type InvoiceParty = {
  additionalStreet: Maybe<Scalars["String"]["output"]>;
  city: Maybe<Scalars["String"]["output"]>;
  contactId: Maybe<Scalars["PHID"]["output"]>;
  /** ISO 3166-1 alpha-2 */
  country: Maybe<Scalars["String"]["output"]>;
  email: Maybe<Scalars["String"]["output"]>;
  /** BT-34 / BT-49: the Peppol address */
  endpointId: Maybe<Scalars["String"]["output"]>;
  endpointScheme: Maybe<Scalars["String"]["output"]>;
  /** BT-27 / BT-44 */
  name: Maybe<Scalars["String"]["output"]>;
  phone: Maybe<Scalars["String"]["output"]>;
  postalCode: Maybe<Scalars["String"]["output"]>;
  region: Maybe<Scalars["String"]["output"]>;
  /** BT-30 / BT-47 */
  registrationId: Maybe<Scalars["String"]["output"]>;
  /** ISO 6523 ICD scheme of the registration id, e.g. 0208 (BE), 0184 (DK), 0183 (CH) */
  registrationScheme: Maybe<Scalars["String"]["output"]>;
  street: Maybe<Scalars["String"]["output"]>;
  /** BT-31 / BT-48, with the country prefix */
  vatId: Maybe<Scalars["String"]["output"]>;
};

export type InvoicePeriod = {
  end: Maybe<Scalars["DateTime"]["output"]>;
  start: Maybe<Scalars["DateTime"]["output"]>;
};

export type InvoiceReferences = {
  /** BT-10 */
  buyerReference: Maybe<Scalars["String"]["output"]>;
  /** BT-12 */
  contractReference: Maybe<Scalars["String"]["output"]>;
  /** BT-13 */
  orderReference: Maybe<Scalars["String"]["output"]>;
  /** BT-11 */
  projectReference: Maybe<Scalars["String"]["output"]>;
};

export type InvoiceState = {
  /** BG-24: documents at invoice level */
  attachments: Array<InvoiceAttachment>;
  /** BG-7 */
  buyer: InvoiceParty;
  /** BT-5 */
  currency: Scalars["String"]["output"];
  /** BT-72 */
  deliveredAt: Maybe<Scalars["DateTime"]["output"]>;
  direction: InvoiceDirection;
  /** BT-9 */
  dueAt: Maybe<Scalars["DateTime"]["output"]>;
  /** 1 base = rate quote. Converts forward-billed costs and the VAT total (BT-111). */
  exchangeRates: Array<ExchangeRate>;
  /** BT-2 */
  issuedAt: Maybe<Scalars["DateTime"]["output"]>;
  /** BT-3: an invoice (380) or a credit note (381) */
  kind: InvoiceKind;
  /** BG-25 */
  lines: Array<InvoiceLine>;
  /** BT-22 */
  notes: Maybe<Scalars["String"]["output"]>;
  /** BT-1 */
  number: Maybe<Scalars["String"]["output"]>;
  /** BG-16 */
  paymentInstructions: PaymentInstructions;
  /** BT-20 */
  paymentTerms: Maybe<Scalars["String"]["output"]>;
  payments: Array<Payment>;
  /** BG-14 */
  period: Maybe<InvoicePeriod>;
  /** BG-3: the invoices a credit note corrects */
  precedingInvoices: Array<PrecedingInvoice>;
  references: InvoiceReferences;
  /** BT-114 */
  roundingAmount: Maybe<Scalars["Float"]["output"]>;
  /** BG-4 */
  seller: InvoiceParty;
  status: InvoiceStatus;
  /** What the invoice is for, e.g. Powerhouse expenses, January 2026 */
  subject: Maybe<Scalars["String"]["output"]>;
  /** BT-6: the currency VAT is accounted in, when it is not the invoice currency */
  vatCurrency: Maybe<Scalars["String"]["output"]>;
  /** BT-120/121 per VAT category (BG-23) */
  vatReasons: Array<VatReason>;
  voidReason: Maybe<Scalars["String"]["output"]>;
};

export type InvoiceStatus = "DRAFT" | "OPEN" | "PAID" | "VOID";

export type IssueInvoiceInput = {
  dueAt?: InputMaybe<Scalars["DateTime"]["input"]>;
  issuedAt: Scalars["DateTime"]["input"];
  number: Scalars["String"]["input"];
};

export type MoveAttachmentInput = {
  id: Scalars["OID"]["input"];
  lineId?: InputMaybe<Scalars["OID"]["input"]>;
};

export type MoveLineInput = {
  id: Scalars["OID"]["input"];
  index: Scalars["Int"]["input"];
};

export type OriginalAmount = {
  amount: Scalars["Float"]["output"];
  currency: Scalars["String"]["output"];
  /** 1 original currency = rate invoice currency; null uses the invoice's exchange rates */
  rate: Maybe<Scalars["Float"]["output"]>;
};

export type Payment = {
  amount: Scalars["Float"]["output"];
  id: Scalars["OID"]["output"];
  method: PaymentMethod;
  paidAt: Scalars["DateTime"]["output"];
  transactionId: Maybe<Scalars["String"]["output"]>;
};

export type PaymentInstructions = {
  /** BT-84: an IBAN, or another account such as a wallet address */
  account: Maybe<Scalars["String"]["output"]>;
  /** BT-85 */
  accountName: Maybe<Scalars["String"]["output"]>;
  /** BT-86 */
  bic: Maybe<Scalars["String"]["output"]>;
  /** BT-81: UNCL 4461, e.g. 30 or 58 (credit transfer), 48 (card), ZZZ (mutually defined) */
  meansCode: Maybe<Scalars["String"]["output"]>;
  /** BT-82 */
  meansText: Maybe<Scalars["String"]["output"]>;
  /** BT-83 */
  remittance: Maybe<Scalars["String"]["output"]>;
};

export type PaymentMethod = "BANK_TRANSFER" | "CARD" | "CASH" | "OTHER";

export type PrecedingInvoice = {
  /** The corrected invoice, when it is a document here */
  documentId: Maybe<Scalars["PHID"]["output"]>;
  id: Scalars["OID"]["output"];
  /** BT-26 */
  issuedAt: Maybe<Scalars["DateTime"]["output"]>;
  /** BT-25 */
  number: Scalars["String"]["output"];
};

export type RecordPaymentInput = {
  amount: Scalars["Float"]["input"];
  id: Scalars["OID"]["input"];
  method: PaymentMethod;
  paidAt: Scalars["DateTime"]["input"];
  transactionId?: InputMaybe<Scalars["String"]["input"]>;
};

export type RemoveAttachmentInput = {
  id: Scalars["OID"]["input"];
};

export type RemoveExchangeRateInput = {
  base: Scalars["String"]["input"];
  quote: Scalars["String"]["input"];
};

export type RemoveLineInput = {
  id: Scalars["OID"]["input"];
};

export type RemovePaymentInput = {
  id: Scalars["OID"]["input"];
};

export type RemovePrecedingInvoiceInput = {
  id: Scalars["OID"]["input"];
};

export type RemoveVatReasonInput = {
  category: VatCategory;
};

export type SetBuyerInput = {
  additionalStreet?: InputMaybe<Scalars["String"]["input"]>;
  city?: InputMaybe<Scalars["String"]["input"]>;
  contactId?: InputMaybe<Scalars["PHID"]["input"]>;
  country?: InputMaybe<Scalars["String"]["input"]>;
  email?: InputMaybe<Scalars["String"]["input"]>;
  endpointId?: InputMaybe<Scalars["String"]["input"]>;
  endpointScheme?: InputMaybe<Scalars["String"]["input"]>;
  name?: InputMaybe<Scalars["String"]["input"]>;
  phone?: InputMaybe<Scalars["String"]["input"]>;
  postalCode?: InputMaybe<Scalars["String"]["input"]>;
  region?: InputMaybe<Scalars["String"]["input"]>;
  registrationId?: InputMaybe<Scalars["String"]["input"]>;
  registrationScheme?: InputMaybe<Scalars["String"]["input"]>;
  street?: InputMaybe<Scalars["String"]["input"]>;
  vatId?: InputMaybe<Scalars["String"]["input"]>;
};

export type SetCurrencyInput = {
  currency?: InputMaybe<Scalars["String"]["input"]>;
  vatCurrency?: InputMaybe<Scalars["String"]["input"]>;
};

export type SetExchangeRateInput = {
  base: Scalars["String"]["input"];
  date?: InputMaybe<Scalars["DateTime"]["input"]>;
  quote: Scalars["String"]["input"];
  rate: Scalars["Float"]["input"];
  source?: InputMaybe<Scalars["String"]["input"]>;
};

export type SetHeaderInput = {
  buyerReference?: InputMaybe<Scalars["String"]["input"]>;
  contractReference?: InputMaybe<Scalars["String"]["input"]>;
  deliveredAt?: InputMaybe<Scalars["DateTime"]["input"]>;
  direction?: InputMaybe<InvoiceDirection>;
  dueAt?: InputMaybe<Scalars["DateTime"]["input"]>;
  kind?: InputMaybe<InvoiceKind>;
  notes?: InputMaybe<Scalars["String"]["input"]>;
  orderReference?: InputMaybe<Scalars["String"]["input"]>;
  paymentTerms?: InputMaybe<Scalars["String"]["input"]>;
  periodEnd?: InputMaybe<Scalars["DateTime"]["input"]>;
  periodStart?: InputMaybe<Scalars["DateTime"]["input"]>;
  projectReference?: InputMaybe<Scalars["String"]["input"]>;
  roundingAmount?: InputMaybe<Scalars["Float"]["input"]>;
  subject?: InputMaybe<Scalars["String"]["input"]>;
};

export type SetPaymentInstructionsInput = {
  account?: InputMaybe<Scalars["String"]["input"]>;
  accountName?: InputMaybe<Scalars["String"]["input"]>;
  bic?: InputMaybe<Scalars["String"]["input"]>;
  meansCode?: InputMaybe<Scalars["String"]["input"]>;
  meansText?: InputMaybe<Scalars["String"]["input"]>;
  remittance?: InputMaybe<Scalars["String"]["input"]>;
};

export type SetSellerInput = {
  additionalStreet?: InputMaybe<Scalars["String"]["input"]>;
  city?: InputMaybe<Scalars["String"]["input"]>;
  contactId?: InputMaybe<Scalars["PHID"]["input"]>;
  country?: InputMaybe<Scalars["String"]["input"]>;
  email?: InputMaybe<Scalars["String"]["input"]>;
  endpointId?: InputMaybe<Scalars["String"]["input"]>;
  endpointScheme?: InputMaybe<Scalars["String"]["input"]>;
  name?: InputMaybe<Scalars["String"]["input"]>;
  phone?: InputMaybe<Scalars["String"]["input"]>;
  postalCode?: InputMaybe<Scalars["String"]["input"]>;
  region?: InputMaybe<Scalars["String"]["input"]>;
  registrationId?: InputMaybe<Scalars["String"]["input"]>;
  registrationScheme?: InputMaybe<Scalars["String"]["input"]>;
  street?: InputMaybe<Scalars["String"]["input"]>;
  vatId?: InputMaybe<Scalars["String"]["input"]>;
};

export type SetVatReasonInput = {
  category: VatCategory;
  code?: InputMaybe<Scalars["String"]["input"]>;
  text?: InputMaybe<Scalars["String"]["input"]>;
};

export type UpdateAttachmentInput = {
  description?: InputMaybe<Scalars["String"]["input"]>;
  documentId?: InputMaybe<Scalars["PHID"]["input"]>;
  fileName?: InputMaybe<Scalars["String"]["input"]>;
  id: Scalars["OID"]["input"];
  role?: InputMaybe<AttachmentRole>;
  url?: InputMaybe<Scalars["URL"]["input"]>;
};

export type UpdateLineInput = {
  category?: InputMaybe<Scalars["String"]["input"]>;
  description?: InputMaybe<Scalars["String"]["input"]>;
  id: Scalars["OID"]["input"];
  note?: InputMaybe<Scalars["String"]["input"]>;
  originalAmount?: InputMaybe<Scalars["Float"]["input"]>;
  originalCurrency?: InputMaybe<Scalars["String"]["input"]>;
  originalRate?: InputMaybe<Scalars["Float"]["input"]>;
  periodEnd?: InputMaybe<Scalars["DateTime"]["input"]>;
  periodStart?: InputMaybe<Scalars["DateTime"]["input"]>;
  quantity?: InputMaybe<Scalars["Float"]["input"]>;
  unitCode?: InputMaybe<Scalars["String"]["input"]>;
  unitPrice?: InputMaybe<Scalars["Float"]["input"]>;
  vatCategory?: InputMaybe<VatCategory>;
  vatRate?: InputMaybe<Scalars["Float"]["input"]>;
};

export type VatCategory =
  /** E */
  | "EXEMPT"
  /** G */
  | "EXPORT"
  /** K */
  | "INTRA_COMMUNITY"
  /** O */
  | "OUTSIDE_SCOPE"
  /** AE */
  | "REVERSE_CHARGE"
  /** S */
  | "STANDARD"
  /** Z */
  | "ZERO_RATED";

export type VatReason = {
  category: VatCategory;
  /** BT-121: a VATEX code, e.g. VATEX-EU-AE */
  code: Maybe<Scalars["String"]["output"]>;
  /** BT-120: the legal mention as printed */
  text: Maybe<Scalars["String"]["output"]>;
};

export type VoidInvoiceInput = {
  reason: Scalars["String"]["input"];
};
