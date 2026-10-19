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
  contentId?: InputMaybe<Scalars["String"]["input"]>;
  fileName: Scalars["String"]["input"];
  id: Scalars["OID"]["input"];
  inline?: InputMaybe<Scalars["Boolean"]["input"]>;
  mimeType?: InputMaybe<Scalars["String"]["input"]>;
  ref: Scalars["AttachmentRef"]["input"];
  sizeBytes?: InputMaybe<Scalars["Int"]["input"]>;
};

export type AddLabelsInput = {
  labels: Array<Scalars["String"]["input"]>;
};

export type ArchiveInput = {
  _?: InputMaybe<Scalars["Boolean"]["input"]>;
};

export type CaptureMessageInput = {
  bcc?: InputMaybe<Array<CapturedMailboxInput>>;
  capturedAt: Scalars["DateTime"]["input"];
  cc?: InputMaybe<Array<CapturedMailboxInput>>;
  externalId: Scalars["String"]["input"];
  from: Array<CapturedMailboxInput>;
  headers?: InputMaybe<Array<CapturedHeaderInput>>;
  html?: InputMaybe<Scalars["String"]["input"]>;
  inReplyTo?: InputMaybe<Scalars["String"]["input"]>;
  labels?: InputMaybe<Array<Scalars["String"]["input"]>>;
  messageId?: InputMaybe<Scalars["String"]["input"]>;
  receivedAt?: InputMaybe<Scalars["DateTime"]["input"]>;
  references?: InputMaybe<Array<Scalars["String"]["input"]>>;
  replyTo?: InputMaybe<Array<CapturedMailboxInput>>;
  sentAt?: InputMaybe<Scalars["DateTime"]["input"]>;
  source?: InputMaybe<Scalars["String"]["input"]>;
  subject?: InputMaybe<Scalars["String"]["input"]>;
  text?: InputMaybe<Scalars["String"]["input"]>;
  threadId?: InputMaybe<Scalars["String"]["input"]>;
  to?: InputMaybe<Array<CapturedMailboxInput>>;
};

export type CapturedHeaderInput = {
  key: Scalars["String"]["input"];
  value: Scalars["String"]["input"];
};

export type CapturedMailboxInput = {
  address: Scalars["String"]["input"];
  name?: InputMaybe<Scalars["String"]["input"]>;
};

export type EmailAttachment = {
  contentId: Maybe<Scalars["String"]["output"]>;
  fileName: Scalars["String"]["output"];
  id: Scalars["OID"]["output"];
  inline: Scalars["Boolean"]["output"];
  mimeType: Maybe<Scalars["String"]["output"]>;
  ref: Scalars["AttachmentRef"]["output"];
  sizeBytes: Maybe<Scalars["Int"]["output"]>;
};

export type EmailHeader = {
  key: Scalars["String"]["output"];
  value: Scalars["String"]["output"];
};

export type EmailState = {
  account: MailAccount;
  attachments: Array<EmailAttachment>;
  bcc: Array<Mailbox>;
  capturedAt: Maybe<Scalars["DateTime"]["output"]>;
  cc: Array<Mailbox>;
  externalId: Maybe<Scalars["String"]["output"]>;
  flagged: Scalars["Boolean"]["output"];
  from: Array<Mailbox>;
  headers: Array<EmailHeader>;
  html: Maybe<Scalars["String"]["output"]>;
  inReplyTo: Maybe<Scalars["String"]["output"]>;
  labels: Array<Scalars["String"]["output"]>;
  messageId: Maybe<Scalars["String"]["output"]>;
  notes: Maybe<Scalars["String"]["output"]>;
  read: Scalars["Boolean"]["output"];
  receivedAt: Maybe<Scalars["DateTime"]["output"]>;
  references: Array<Scalars["String"]["output"]>;
  replyTo: Array<Mailbox>;
  sentAt: Maybe<Scalars["DateTime"]["output"]>;
  snippet: Maybe<Scalars["String"]["output"]>;
  source: Maybe<Scalars["String"]["output"]>;
  status: EmailStatus;
  subject: Maybe<Scalars["String"]["output"]>;
  text: Maybe<Scalars["String"]["output"]>;
  threadId: Maybe<Scalars["String"]["output"]>;
  to: Array<Mailbox>;
};

export type EmailStatus = "ARCHIVED" | "INBOX";

export type MailAccount = {
  address: Maybe<Scalars["String"]["output"]>;
  name: Maybe<Scalars["String"]["output"]>;
  provider: Maybe<Scalars["String"]["output"]>;
};

export type Mailbox = {
  address: Scalars["String"]["output"];
  name: Maybe<Scalars["String"]["output"]>;
};

export type MarkReadInput = {
  _?: InputMaybe<Scalars["Boolean"]["input"]>;
};

export type MarkUnreadInput = {
  _?: InputMaybe<Scalars["Boolean"]["input"]>;
};

export type RemoveAttachmentInput = {
  id: Scalars["OID"]["input"];
};

export type RemoveLabelsInput = {
  labels: Array<Scalars["String"]["input"]>;
};

export type SetAccountInput = {
  address?: InputMaybe<Scalars["String"]["input"]>;
  name?: InputMaybe<Scalars["String"]["input"]>;
  provider?: InputMaybe<Scalars["String"]["input"]>;
};

export type SetFlaggedInput = {
  flagged: Scalars["Boolean"]["input"];
};

export type SetNotesInput = {
  notes?: InputMaybe<Scalars["String"]["input"]>;
};

export type UnarchiveInput = {
  _?: InputMaybe<Scalars["Boolean"]["input"]>;
};
