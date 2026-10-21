/* eslint-disable @typescript-eslint/no-empty-object-type */
/* eslint-disable @typescript-eslint/no-unused-vars */
import * as z from "zod";
import type {
  AddRenditionInput,
  AddTagInput,
  ApplyDiskVersionInput,
  ClearPlaceholderInput,
  ClearSourceInput,
  FilePlaceholder,
  FilePlaceholderChange,
  FilePlaceholderTarget,
  FileRendition,
  FileSource,
  FileSourceKind,
  FileState,
  FileTag,
  RemoveRenditionInput,
  RemoveTagInput,
  SetAttachmentSourceInput,
  SetDescriptionInput,
  SetDocumentSourceInput,
  SetPlaceholderInput,
  SetTitleInput,
  UpdateRenditionInput,
  UpdateTagInput,
} from "./types.js";

type Properties<T> = Required<{
  [K in keyof T]: z.ZodType<T[K]>;
}>;

type definedNonNullAny = {};

export const isDefinedNonNullAny = (v: any): v is definedNonNullAny =>
  v !== undefined && v !== null;

export const definedNonNullAnySchema = z
  .any()
  .refine((v) => isDefinedNonNullAny(v));

export const FilePlaceholderChangeSchema = z.enum([
  "CREATE",
  "DELETE",
  "UPDATE",
]);

export const FilePlaceholderTargetSchema = z.enum(["DOCUMENT", "FILE"]);

export const FileSourceKindSchema = z.enum([
  "ATTACHMENT",
  "DOCUMENT",
  "DOCUMENT_PLACEHOLDER",
  "FILE_PLACEHOLDER",
]);

export function AddRenditionInputSchema(): z.ZodObject<
  Properties<AddRenditionInput>
> {
  return z.object({
    createdAt: z.iso.datetime(),
    fileName: z.string().nullish(),
    id: z.string(),
    label: z.string().nullish(),
    mimeType: z.string(),
    ref: z
      .custom<`attachment://v${number}:${string}`>((val) =>
        /^attachment:\/\/v\d+:.+$/.test(val as string),
      )
      .nullish(),
    sizeBytes: z.number().nullish(),
    text: z.string().nullish(),
    type: z.string().nullish(),
  });
}

export function AddTagInputSchema(): z.ZodObject<Properties<AddTagInput>> {
  return z.object({
    color: z.string(),
    id: z.string(),
    label: z.string(),
  });
}

export function ApplyDiskVersionInputSchema(): z.ZodObject<
  Properties<ApplyDiskVersionInput>
> {
  return z.object({
    fileName: z.string(),
    mimeType: z.string().nullish(),
    previousId: z.string(),
    ref: z.custom<`attachment://v${number}:${string}`>((val) =>
      /^attachment:\/\/v\d+:.+$/.test(val as string),
    ),
    setAt: z.iso.datetime(),
    sizeBytes: z.number().nullish(),
  });
}

export function ClearPlaceholderInputSchema(): z.ZodObject<
  Properties<ClearPlaceholderInput>
> {
  return z.object({
    _: z.boolean().nullish(),
  });
}

export function ClearSourceInputSchema(): z.ZodObject<
  Properties<ClearSourceInput>
> {
  return z.object({
    _: z.boolean().nullish(),
  });
}

export function FilePlaceholderSchema(): z.ZodObject<
  Properties<FilePlaceholder>
> {
  return z.object({
    __typename: z.literal("FilePlaceholder").optional(),
    change: FilePlaceholderChangeSchema,
    documentId: z.string().nullish(),
    documentName: z.string().nullish(),
    documentType: z.string().nullish(),
    fileName: z.string(),
    foundAt: z.iso.datetime(),
    hash: z.string().nullish(),
    mappingId: z.string(),
    mimeType: z.string().nullish(),
    modifiedAt: z.iso.datetime().nullish(),
    relativePath: z.string(),
    sizeBytes: z.number().nullish(),
    target: FilePlaceholderTargetSchema,
  });
}

export function FileRenditionSchema(): z.ZodObject<Properties<FileRendition>> {
  return z.object({
    __typename: z.literal("FileRendition").optional(),
    createdAt: z.iso.datetime(),
    fileName: z.string().nullish(),
    id: z.string(),
    label: z.string().nullish(),
    mimeType: z.string(),
    ref: z
      .custom<`attachment://v${number}:${string}`>((val) =>
        /^attachment:\/\/v\d+:.+$/.test(val as string),
      )
      .nullish(),
    sizeBytes: z.number().nullish(),
    text: z.string().nullish(),
    type: z.string().nullish(),
  });
}

export function FileSourceSchema(): z.ZodObject<Properties<FileSource>> {
  return z.object({
    __typename: z.literal("FileSource").optional(),
    documentId: z.string().nullish(),
    documentName: z.string().nullish(),
    documentType: z.string().nullish(),
    fileName: z.string().nullish(),
    kind: FileSourceKindSchema,
    mimeType: z.string().nullish(),
    ref: z
      .custom<`attachment://v${number}:${string}`>((val) =>
        /^attachment:\/\/v\d+:.+$/.test(val as string),
      )
      .nullish(),
    setAt: z.iso.datetime(),
    sizeBytes: z.number().nullish(),
  });
}

export function FileStateSchema(): z.ZodObject<Properties<FileState>> {
  return z.object({
    __typename: z.literal("FileState").optional(),
    description: z.string().nullish(),
    placeholder: z.lazy(() => FilePlaceholderSchema().nullish()),
    renditions: z.array(z.lazy(() => FileRenditionSchema())),
    source: z.lazy(() => FileSourceSchema().nullish()),
    tags: z.array(z.lazy(() => FileTagSchema())),
    title: z.string().nullish(),
  });
}

export function FileTagSchema(): z.ZodObject<Properties<FileTag>> {
  return z.object({
    __typename: z.literal("FileTag").optional(),
    color: z.string(),
    id: z.string(),
    label: z.string(),
  });
}

export function RemoveRenditionInputSchema(): z.ZodObject<
  Properties<RemoveRenditionInput>
> {
  return z.object({
    id: z.string(),
  });
}

export function RemoveTagInputSchema(): z.ZodObject<
  Properties<RemoveTagInput>
> {
  return z.object({
    id: z.string(),
  });
}

export function SetAttachmentSourceInputSchema(): z.ZodObject<
  Properties<SetAttachmentSourceInput>
> {
  return z.object({
    fileName: z.string(),
    mimeType: z.string().nullish(),
    ref: z.custom<`attachment://v${number}:${string}`>((val) =>
      /^attachment:\/\/v\d+:.+$/.test(val as string),
    ),
    setAt: z.iso.datetime(),
    sizeBytes: z.number().nullish(),
  });
}

export function SetDescriptionInputSchema(): z.ZodObject<
  Properties<SetDescriptionInput>
> {
  return z.object({
    description: z.string().nullish(),
  });
}

export function SetDocumentSourceInputSchema(): z.ZodObject<
  Properties<SetDocumentSourceInput>
> {
  return z.object({
    documentId: z.string(),
    documentName: z.string().nullish(),
    documentType: z.string(),
    setAt: z.iso.datetime(),
  });
}

export function SetPlaceholderInputSchema(): z.ZodObject<
  Properties<SetPlaceholderInput>
> {
  return z.object({
    change: FilePlaceholderChangeSchema,
    documentId: z.string().nullish(),
    documentName: z.string().nullish(),
    documentType: z.string().nullish(),
    fileName: z.string(),
    foundAt: z.iso.datetime(),
    hash: z.string().nullish(),
    mappingId: z.string(),
    mimeType: z.string().nullish(),
    modifiedAt: z.iso.datetime().nullish(),
    relativePath: z.string(),
    sizeBytes: z.number().nullish(),
    target: FilePlaceholderTargetSchema,
  });
}

export function SetTitleInputSchema(): z.ZodObject<Properties<SetTitleInput>> {
  return z.object({
    title: z.string().nullish(),
  });
}

export function UpdateRenditionInputSchema(): z.ZodObject<
  Properties<UpdateRenditionInput>
> {
  return z.object({
    id: z.string(),
    label: z.string().nullish(),
    mimeType: z.string().nullish(),
    type: z.string().nullish(),
  });
}

export function UpdateTagInputSchema(): z.ZodObject<
  Properties<UpdateTagInput>
> {
  return z.object({
    color: z.string().nullish(),
    id: z.string(),
    label: z.string().nullish(),
  });
}
