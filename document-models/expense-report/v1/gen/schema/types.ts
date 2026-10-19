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

export type AddItemInput = {
  amount: Scalars["Float"]["input"];
  category: TransactionCategory;
  contactId?: InputMaybe<Scalars["String"]["input"]>;
  id: Scalars["OID"]["input"];
  merchant: Scalars["String"]["input"];
  note?: InputMaybe<Scalars["String"]["input"]>;
  paidWith: PaidWith;
  receiptName?: InputMaybe<Scalars["String"]["input"]>;
  spentAt: Scalars["DateTime"]["input"];
  vatAmount?: InputMaybe<Scalars["Float"]["input"]>;
};

export type ApproveReportInput = {
  decidedAt: Scalars["DateTime"]["input"];
  decidedBy: Scalars["String"]["input"];
  note?: InputMaybe<Scalars["String"]["input"]>;
};

export type ExpenseItem = {
  amount: Scalars["Float"]["output"];
  category: TransactionCategory;
  contactId: Maybe<Scalars["String"]["output"]>;
  id: Scalars["OID"]["output"];
  merchant: Scalars["String"]["output"];
  note: Maybe<Scalars["String"]["output"]>;
  paidWith: PaidWith;
  receiptName: Maybe<Scalars["String"]["output"]>;
  spentAt: Scalars["DateTime"]["output"];
  vatAmount: Scalars["Float"]["output"];
};

export type ExpenseReportState = {
  currency: Scalars["String"]["output"];
  decidedAt: Maybe<Scalars["DateTime"]["output"]>;
  decidedBy: Maybe<Scalars["String"]["output"]>;
  decisionNote: Maybe<Scalars["String"]["output"]>;
  items: Array<ExpenseItem>;
  reimbursedAt: Maybe<Scalars["DateTime"]["output"]>;
  reimbursementTransactionId: Maybe<Scalars["String"]["output"]>;
  status: ExpenseStatus;
  submittedAt: Maybe<Scalars["DateTime"]["output"]>;
  submitter: Person;
  title: Maybe<Scalars["String"]["output"]>;
};

export type ExpenseStatus =
  | "APPROVED"
  | "DRAFT"
  | "REIMBURSED"
  | "REJECTED"
  | "SUBMITTED";

export type PaidWith = "CASH" | "COMPANY_CARD" | "PERSONAL";

export type Person = {
  email: Maybe<Scalars["String"]["output"]>;
  name: Maybe<Scalars["String"]["output"]>;
};

export type ReimburseReportInput = {
  reimbursedAt: Scalars["DateTime"]["input"];
  transactionId?: InputMaybe<Scalars["String"]["input"]>;
};

export type RejectReportInput = {
  decidedAt: Scalars["DateTime"]["input"];
  decidedBy: Scalars["String"]["input"];
  note: Scalars["String"]["input"];
};

export type RemoveItemInput = {
  id: Scalars["OID"]["input"];
};

export type SetReportDetailsInput = {
  currency?: InputMaybe<Scalars["String"]["input"]>;
  submitterEmail?: InputMaybe<Scalars["String"]["input"]>;
  submitterName?: InputMaybe<Scalars["String"]["input"]>;
  title?: InputMaybe<Scalars["String"]["input"]>;
};

export type SubmitReportInput = {
  submittedAt: Scalars["DateTime"]["input"];
};

export type TransactionCategory =
  | "BANK_FEES"
  | "MARKETING"
  | "OTHER"
  | "PAYROLL"
  | "RENT"
  | "SALES"
  | "SOFTWARE"
  | "SUPPLIES"
  | "TAX"
  | "TRANSFER"
  | "TRAVEL"
  | "UNCATEGORIZED";

export type UpdateItemInput = {
  amount?: InputMaybe<Scalars["Float"]["input"]>;
  category?: InputMaybe<TransactionCategory>;
  contactId?: InputMaybe<Scalars["String"]["input"]>;
  id: Scalars["OID"]["input"];
  merchant?: InputMaybe<Scalars["String"]["input"]>;
  note?: InputMaybe<Scalars["String"]["input"]>;
  paidWith?: InputMaybe<PaidWith>;
  receiptName?: InputMaybe<Scalars["String"]["input"]>;
  spentAt?: InputMaybe<Scalars["DateTime"]["input"]>;
  vatAmount?: InputMaybe<Scalars["Float"]["input"]>;
};
