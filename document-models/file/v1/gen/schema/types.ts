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

export type AddRenditionInput = {
  createdAt: Scalars["DateTime"]["input"];
  fileName?: InputMaybe<Scalars["String"]["input"]>;
  id: Scalars["OID"]["input"];
  label?: InputMaybe<Scalars["String"]["input"]>;
  mimeType: Scalars["String"]["input"];
  ref?: InputMaybe<Scalars["AttachmentRef"]["input"]>;
  sizeBytes?: InputMaybe<Scalars["Int"]["input"]>;
  text?: InputMaybe<Scalars["String"]["input"]>;
  type?: InputMaybe<Scalars["String"]["input"]>;
};

export type AddTagInput = {
  color: Scalars["String"]["input"];
  id: Scalars["OID"]["input"];
  label: Scalars["String"]["input"];
};

export type ClearSourceInput = {
  _?: InputMaybe<Scalars["Boolean"]["input"]>;
};

export type FileRendition = {
  createdAt: Scalars["DateTime"]["output"];
  fileName: Maybe<Scalars["String"]["output"]>;
  id: Scalars["OID"]["output"];
  label: Maybe<Scalars["String"]["output"]>;
  /** Any MIME type: text/plain, text/html, application/pdf, image/png */
  mimeType: Scalars["String"]["output"];
  /** Stored content */
  ref: Maybe<Scalars["AttachmentRef"]["output"]>;
  sizeBytes: Maybe<Scalars["Int"]["output"]>;
  /** Or inline text content */
  text: Maybe<Scalars["String"]["output"]>;
  /** A free-form role, e.g. preview, ocr, pdf-export, thumbnail */
  type: Maybe<Scalars["String"]["output"]>;
};

export type FileSource = {
  /** DOCUMENT: the document this file stands for, its type and a cached name */
  documentId: Maybe<Scalars["PHID"]["output"]>;
  documentName: Maybe<Scalars["String"]["output"]>;
  documentType: Maybe<Scalars["String"]["output"]>;
  fileName: Maybe<Scalars["String"]["output"]>;
  kind: FileSourceKind;
  mimeType: Maybe<Scalars["String"]["output"]>;
  /** ATTACHMENT: the stored bytes and what they are */
  ref: Maybe<Scalars["AttachmentRef"]["output"]>;
  setAt: Scalars["DateTime"]["output"];
  sizeBytes: Maybe<Scalars["Int"]["output"]>;
};

export type FileSourceKind = "ATTACHMENT" | "DOCUMENT";

export type FileState = {
  description: Maybe<Scalars["String"]["output"]>;
  /** Content extracted from or rendered for the source: text, html, pdf, images */
  renditions: Array<FileRendition>;
  /** The source of truth: a stored file, or another document. Null until set. */
  source: Maybe<FileSource>;
  tags: Array<FileTag>;
  title: Maybe<Scalars["String"]["output"]>;
};

export type FileTag = {
  /** A colour name from the design system: forest, sage, mint, clay, amber, info, neutral */
  color: Scalars["String"]["output"];
  id: Scalars["OID"]["output"];
  label: Scalars["String"]["output"];
};

export type RemoveRenditionInput = {
  id: Scalars["OID"]["input"];
};

export type RemoveTagInput = {
  id: Scalars["OID"]["input"];
};

export type SetAttachmentSourceInput = {
  fileName: Scalars["String"]["input"];
  mimeType?: InputMaybe<Scalars["String"]["input"]>;
  ref: Scalars["AttachmentRef"]["input"];
  setAt: Scalars["DateTime"]["input"];
  sizeBytes?: InputMaybe<Scalars["Int"]["input"]>;
};

export type SetDescriptionInput = {
  description?: InputMaybe<Scalars["String"]["input"]>;
};

export type SetDocumentSourceInput = {
  documentId: Scalars["PHID"]["input"];
  documentName?: InputMaybe<Scalars["String"]["input"]>;
  documentType: Scalars["String"]["input"];
  setAt: Scalars["DateTime"]["input"];
};

export type SetTitleInput = {
  title?: InputMaybe<Scalars["String"]["input"]>;
};

export type UpdateRenditionInput = {
  id: Scalars["OID"]["input"];
  label?: InputMaybe<Scalars["String"]["input"]>;
  mimeType?: InputMaybe<Scalars["String"]["input"]>;
  type?: InputMaybe<Scalars["String"]["input"]>;
};

export type UpdateTagInput = {
  color?: InputMaybe<Scalars["String"]["input"]>;
  id: Scalars["OID"]["input"];
  label?: InputMaybe<Scalars["String"]["input"]>;
};
