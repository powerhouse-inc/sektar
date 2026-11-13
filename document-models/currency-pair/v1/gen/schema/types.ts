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

export type CurrencyPairState = {
  /** The currency converted from, e.g. USD */
  base: Maybe<Scalars["String"]["output"]>;
  lastFetchedAt: Maybe<Scalars["DateTime"]["output"]>;
  /** The currency converted to: the main currency of the books, e.g. EUR */
  quote: Maybe<Scalars["String"]["output"]>;
  /** One rate per day, the oldest first */
  rates: Array<RatePoint>;
};

export type RatePoint = {
  /** The day the rate applies to, at midnight UTC */
  date: Scalars["Date"]["output"];
  id: Scalars["OID"]["output"];
  /** Entered by hand: a fetched rate never overwrites it */
  manual: Scalars["Boolean"]["output"];
  /** How many quote one base is worth */
  rate: Scalars["Float"]["output"];
  /** Where the rate comes from, e.g. ECB */
  source: Maybe<Scalars["String"]["output"]>;
};

export type RecordRatesInput = {
  fetchedAt: Scalars["DateTime"]["input"];
  rates: Array<RecordedRateInput>;
  source: Scalars["String"]["input"];
};

export type RecordedRateInput = {
  date: Scalars["Date"]["input"];
  id: Scalars["OID"]["input"];
  rate: Scalars["Float"]["input"];
};

export type RemoveRateInput = {
  date: Scalars["Date"]["input"];
};

export type SetManualRateInput = {
  date: Scalars["Date"]["input"];
  id: Scalars["OID"]["input"];
  rate: Scalars["Float"]["input"];
};

export type SetPairInput = {
  base: Scalars["String"]["input"];
  quote: Scalars["String"]["input"];
};
