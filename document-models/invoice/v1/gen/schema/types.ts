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

export type AddLineInput = {
  description: Scalars["String"]["input"];
  id: Scalars["OID"]["input"];
  quantity: Scalars["Float"]["input"];
  unitPrice: Scalars["Float"]["input"];
  vatRate: Scalars["Float"]["input"];
};

export type InvoiceDirection = "INCOMING" | "OUTGOING";

export type InvoiceLine = {
  description: Scalars["String"]["output"];
  id: Scalars["OID"]["output"];
  quantity: Scalars["Float"]["output"];
  unitPrice: Scalars["Float"]["output"];
  vatRate: Scalars["Float"]["output"];
};

export type InvoiceState = {
  counterparty: Party;
  currency: Scalars["String"]["output"];
  direction: InvoiceDirection;
  dueAt: Maybe<Scalars["DateTime"]["output"]>;
  issuedAt: Maybe<Scalars["DateTime"]["output"]>;
  lines: Array<InvoiceLine>;
  notes: Maybe<Scalars["String"]["output"]>;
  number: Maybe<Scalars["String"]["output"]>;
  payments: Array<Payment>;
  reference: Maybe<Scalars["String"]["output"]>;
  status: InvoiceStatus;
  voidReason: Maybe<Scalars["String"]["output"]>;
};

export type InvoiceStatus = "DRAFT" | "OPEN" | "PAID" | "VOID";

export type IssueInvoiceInput = {
  dueAt: Scalars["DateTime"]["input"];
  issuedAt: Scalars["DateTime"]["input"];
  number: Scalars["String"]["input"];
};

export type Party = {
  address: Maybe<Scalars["String"]["output"]>;
  contactId: Maybe<Scalars["String"]["output"]>;
  email: Maybe<Scalars["String"]["output"]>;
  name: Maybe<Scalars["String"]["output"]>;
  vatId: Maybe<Scalars["String"]["output"]>;
};

export type Payment = {
  amount: Scalars["Float"]["output"];
  id: Scalars["OID"]["output"];
  method: PaymentMethod;
  paidAt: Scalars["DateTime"]["output"];
  transactionId: Maybe<Scalars["String"]["output"]>;
};

export type PaymentMethod = "BANK_TRANSFER" | "CARD" | "CASH" | "OTHER";

export type RecordPaymentInput = {
  amount: Scalars["Float"]["input"];
  id: Scalars["OID"]["input"];
  method: PaymentMethod;
  paidAt: Scalars["DateTime"]["input"];
  transactionId?: InputMaybe<Scalars["String"]["input"]>;
};

export type RemoveLineInput = {
  id: Scalars["OID"]["input"];
};

export type SetInvoiceDetailsInput = {
  address?: InputMaybe<Scalars["String"]["input"]>;
  contactId?: InputMaybe<Scalars["String"]["input"]>;
  counterpartyName?: InputMaybe<Scalars["String"]["input"]>;
  currency?: InputMaybe<Scalars["String"]["input"]>;
  direction?: InputMaybe<InvoiceDirection>;
  dueAt?: InputMaybe<Scalars["DateTime"]["input"]>;
  email?: InputMaybe<Scalars["String"]["input"]>;
  notes?: InputMaybe<Scalars["String"]["input"]>;
  number?: InputMaybe<Scalars["String"]["input"]>;
  reference?: InputMaybe<Scalars["String"]["input"]>;
  vatId?: InputMaybe<Scalars["String"]["input"]>;
};

export type UpdateLineInput = {
  description?: InputMaybe<Scalars["String"]["input"]>;
  id: Scalars["OID"]["input"];
  quantity?: InputMaybe<Scalars["Float"]["input"]>;
  unitPrice?: InputMaybe<Scalars["Float"]["input"]>;
  vatRate?: InputMaybe<Scalars["Float"]["input"]>;
};

export type VoidInvoiceInput = {
  reason: Scalars["String"]["input"];
};
