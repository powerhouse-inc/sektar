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

export type AddPersonInput = {
  email?: InputMaybe<Scalars["String"]["input"]>;
  id: Scalars["OID"]["input"];
  name: Scalars["String"]["input"];
  phone?: InputMaybe<Scalars["String"]["input"]>;
  role?: InputMaybe<Scalars["String"]["input"]>;
};

export type AddTagInput = {
  tag: Scalars["String"]["input"];
};

export type ArchiveContactInput = {
  archived: Scalars["Boolean"]["input"];
};

export type BankDetails = {
  accountHolder: Maybe<Scalars["String"]["output"]>;
  bic: Maybe<Scalars["String"]["output"]>;
  iban: Maybe<Scalars["String"]["output"]>;
};

export type ContactKind = "BOTH" | "CUSTOMER" | "OTHER" | "SUPPLIER";

export type ContactPerson = {
  email: Maybe<Scalars["String"]["output"]>;
  id: Scalars["OID"]["output"];
  name: Scalars["String"]["output"];
  phone: Maybe<Scalars["String"]["output"]>;
  role: Maybe<Scalars["String"]["output"]>;
};

export type ContactState = {
  address: PostalAddress;
  bank: BankDetails;
  defaultCategory: TransactionCategory;
  email: Maybe<Scalars["String"]["output"]>;
  kind: ContactKind;
  name: Maybe<Scalars["String"]["output"]>;
  notes: Maybe<Scalars["String"]["output"]>;
  paymentTermsDays: Scalars["Int"]["output"];
  people: Array<ContactPerson>;
  phone: Maybe<Scalars["String"]["output"]>;
  registrationNumber: Maybe<Scalars["String"]["output"]>;
  status: ContactStatus;
  tags: Array<Scalars["String"]["output"]>;
  vatId: Maybe<Scalars["String"]["output"]>;
  website: Maybe<Scalars["String"]["output"]>;
};

export type ContactStatus = "ACTIVE" | "ARCHIVED";

export type PostalAddress = {
  city: Maybe<Scalars["String"]["output"]>;
  country: Maybe<Scalars["String"]["output"]>;
  postalCode: Maybe<Scalars["String"]["output"]>;
  street: Maybe<Scalars["String"]["output"]>;
};

export type RemovePersonInput = {
  id: Scalars["OID"]["input"];
};

export type RemoveTagInput = {
  tag: Scalars["String"]["input"];
};

export type SetAddressInput = {
  city?: InputMaybe<Scalars["String"]["input"]>;
  country?: InputMaybe<Scalars["String"]["input"]>;
  postalCode?: InputMaybe<Scalars["String"]["input"]>;
  street?: InputMaybe<Scalars["String"]["input"]>;
};

export type SetBankDetailsInput = {
  accountHolder?: InputMaybe<Scalars["String"]["input"]>;
  bic?: InputMaybe<Scalars["String"]["input"]>;
  iban?: InputMaybe<Scalars["String"]["input"]>;
};

export type SetPaymentTermsInput = {
  defaultCategory?: InputMaybe<TransactionCategory>;
  paymentTermsDays: Scalars["Int"]["input"];
};

export type SetProfileInput = {
  email?: InputMaybe<Scalars["String"]["input"]>;
  kind?: InputMaybe<ContactKind>;
  name?: InputMaybe<Scalars["String"]["input"]>;
  notes?: InputMaybe<Scalars["String"]["input"]>;
  phone?: InputMaybe<Scalars["String"]["input"]>;
  registrationNumber?: InputMaybe<Scalars["String"]["input"]>;
  vatId?: InputMaybe<Scalars["String"]["input"]>;
  website?: InputMaybe<Scalars["String"]["input"]>;
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

export type UpdatePersonInput = {
  email?: InputMaybe<Scalars["String"]["input"]>;
  id: Scalars["OID"]["input"];
  name?: InputMaybe<Scalars["String"]["input"]>;
  phone?: InputMaybe<Scalars["String"]["input"]>;
  role?: InputMaybe<Scalars["String"]["input"]>;
};
