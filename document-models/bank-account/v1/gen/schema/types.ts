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

export type AccountKind = "CREDIT_CARD" | "CURRENT" | "SAVINGS";

export type BankAccountState = {
  currency: Scalars["String"]["output"];
  iban: Maybe<Scalars["String"]["output"]>;
  institution: Maybe<Scalars["String"]["output"]>;
  kind: AccountKind;
  lastImportedAt: Maybe<Scalars["DateTime"]["output"]>;
  name: Maybe<Scalars["String"]["output"]>;
  openingBalance: Scalars["Float"]["output"];
  transactions: Array<Transaction>;
};

export type CategorizeTransactionInput = {
  category: TransactionCategory;
  contactId?: InputMaybe<Scalars["String"]["input"]>;
  id: Scalars["OID"]["input"];
};

export type ExcludeTransactionInput = {
  excluded: Scalars["Boolean"]["input"];
  id: Scalars["OID"]["input"];
};

export type ImportTransactionsInput = {
  batchId: Scalars["String"]["input"];
  importedAt: Scalars["DateTime"]["input"];
  transactions: Array<ImportedTransactionInput>;
};

export type ImportedTransactionInput = {
  amount: Scalars["Float"]["input"];
  bookedAt: Scalars["DateTime"]["input"];
  counterparty: Scalars["String"]["input"];
  description?: InputMaybe<Scalars["String"]["input"]>;
  id: Scalars["OID"]["input"];
  reference?: InputMaybe<Scalars["String"]["input"]>;
};

export type MatchKind = "EXPENSE" | "INVOICE";

export type MatchTransactionInput = {
  documentId: Scalars["String"]["input"];
  id: Scalars["OID"]["input"];
  kind: MatchKind;
};

export type SetAccountDetailsInput = {
  currency?: InputMaybe<Scalars["String"]["input"]>;
  iban?: InputMaybe<Scalars["String"]["input"]>;
  institution?: InputMaybe<Scalars["String"]["input"]>;
  kind?: InputMaybe<AccountKind>;
  name?: InputMaybe<Scalars["String"]["input"]>;
  openingBalance?: InputMaybe<Scalars["Float"]["input"]>;
};

export type Transaction = {
  amount: Scalars["Float"]["output"];
  bookedAt: Scalars["DateTime"]["output"];
  category: TransactionCategory;
  contactId: Maybe<Scalars["String"]["output"]>;
  counterparty: Scalars["String"]["output"];
  description: Maybe<Scalars["String"]["output"]>;
  id: Scalars["OID"]["output"];
  importBatch: Maybe<Scalars["String"]["output"]>;
  matchedDocumentId: Maybe<Scalars["String"]["output"]>;
  matchedKind: Maybe<MatchKind>;
  reference: Maybe<Scalars["String"]["output"]>;
  status: TransactionStatus;
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

export type TransactionStatus = "CATEGORIZED" | "EXCLUDED" | "MATCHED" | "NEW";

export type UnmatchTransactionInput = {
  id: Scalars["OID"]["input"];
};
