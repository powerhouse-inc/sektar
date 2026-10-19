/* eslint-disable @typescript-eslint/no-empty-object-type */
/* eslint-disable @typescript-eslint/no-unused-vars */
import * as z from "zod";
import type {
  AddAliasInput,
  AddSourceReferenceInput,
  AssignTaskInput,
  AttachToSourceInput,
  CaptureSourceInput,
  CapturedAttachmentInput,
  CreateTaskInput,
  DetachFromSourceInput,
  DiscardCollectionInput,
  DiscardSourceInput,
  MergeSourcesInput,
  OscAttachment,
  OscCounts,
  OscProvenance,
  OriginalSource,
  OriginalSourceCollectionState,
  OriginalSourceStatus,
  ProcessingTask,
  ProcessingTaskStatus,
  RemoveAliasInput,
  RestoreCollectionInput,
  SetDescriptionInput,
  SetProvenanceInput,
  SetSourceStatusInput,
  SetSourceTitleInput,
  SetTaskDescriptionInput,
  SetTaskStatusInput,
  SetTitleInput,
  SplitSourceInput,
  TagSourceInput,
  UntagSourceInput,
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

export const OriginalSourceStatusSchema = z.enum([
  "COMPLETED",
  "DISCARDED",
  "NEW",
  "PROCESSING",
]);

export const ProcessingTaskStatusSchema = z.enum([
  "CANCELLED",
  "DONE",
  "DRAFT",
  "IN_PROGRESS",
  "TODO",
]);

export function AddAliasInputSchema(): z.ZodObject<Properties<AddAliasInput>> {
  return z.object({
    alias: z.string(),
    source: z.string(),
  });
}

export function AddSourceReferenceInputSchema(): z.ZodObject<
  Properties<AddSourceReferenceInput>
> {
  return z.object({
    reference: z.url(),
    source: z.string(),
  });
}

export function AssignTaskInputSchema(): z.ZodObject<
  Properties<AssignTaskInput>
> {
  return z.object({
    owner: z.string().nullish(),
    task: z.string(),
  });
}

export function AttachToSourceInputSchema(): z.ZodObject<
  Properties<AttachToSourceInput>
> {
  return z.object({
    fileName: z.string(),
    mimeType: z.string().nullish(),
    ref: z.custom<`attachment://v${number}:${string}`>((val) =>
      /^attachment:\/\/v\d+:.+$/.test(val as string),
    ),
    sizeBytes: z.number().nullish(),
    source: z.string(),
  });
}

export function CaptureSourceInputSchema(): z.ZodObject<
  Properties<CaptureSourceInput>
> {
  return z.object({
    aliases: z.array(z.string()).nullish(),
    attachments: z
      .array(z.lazy(() => CapturedAttachmentInputSchema()))
      .nullish(),
    capturedAt: z.iso.datetime(),
    content: z.string().nullish(),
    externalId: z.string(),
    id: z.string(),
    occurredAt: z.iso.datetime().nullish(),
    origin: z.url().nullish(),
    payload: z.unknown().nullish(),
    references: z.array(z.url()).nullish(),
    tags: z.array(z.string()).nullish(),
    title: z.string().nullish(),
  });
}

export function CapturedAttachmentInputSchema(): z.ZodObject<
  Properties<CapturedAttachmentInput>
> {
  return z.object({
    fileName: z.string(),
    mimeType: z.string().nullish(),
    ref: z.custom<`attachment://v${number}:${string}`>((val) =>
      /^attachment:\/\/v\d+:.+$/.test(val as string),
    ),
    sizeBytes: z.number().nullish(),
  });
}

export function CreateTaskInputSchema(): z.ZodObject<
  Properties<CreateTaskInput>
> {
  return z.object({
    createdAt: z.iso.datetime(),
    description: z.string().nullish(),
    id: z.string(),
    owner: z.string().nullish(),
    source: z.string().nullish(),
    status: ProcessingTaskStatusSchema.nullish(),
  });
}

export function DetachFromSourceInputSchema(): z.ZodObject<
  Properties<DetachFromSourceInput>
> {
  return z.object({
    ref: z.custom<`attachment://v${number}:${string}`>((val) =>
      /^attachment:\/\/v\d+:.+$/.test(val as string),
    ),
    source: z.string(),
  });
}

export function DiscardCollectionInputSchema(): z.ZodObject<
  Properties<DiscardCollectionInput>
> {
  return z.object({
    _: z.boolean().nullish(),
  });
}

export function DiscardSourceInputSchema(): z.ZodObject<
  Properties<DiscardSourceInput>
> {
  return z.object({
    source: z.string(),
  });
}

export function MergeSourcesInputSchema(): z.ZodObject<
  Properties<MergeSourcesInput>
> {
  return z.object({
    keep: z.string(),
    merge: z.array(z.string()),
    mergedAt: z.iso.datetime(),
  });
}

export function OscAttachmentSchema(): z.ZodObject<Properties<OscAttachment>> {
  return z.object({
    __typename: z.literal("OSCAttachment").optional(),
    fileName: z.string(),
    mimeType: z.string().nullish(),
    ref: z.custom<`attachment://v${number}:${string}`>((val) =>
      /^attachment:\/\/v\d+:.+$/.test(val as string),
    ),
    sizeBytes: z.number().nullish(),
  });
}

export function OscCountsSchema(): z.ZodObject<Properties<OscCounts>> {
  return z.object({
    __typename: z.literal("OSCCounts").optional(),
    completed: z.number(),
    discarded: z.number(),
    merged: z.number(),
    new: z.number(),
    openTasks: z.number(),
    processing: z.number(),
    total: z.number(),
  });
}

export function OscProvenanceSchema(): z.ZodObject<Properties<OscProvenance>> {
  return z.object({
    __typename: z.literal("OSCProvenance").optional(),
    detail: z.unknown().nullish(),
    queue: z.string().nullish(),
    system: z.string().nullish(),
  });
}

export function OriginalSourceSchema(): z.ZodObject<
  Properties<OriginalSource>
> {
  return z.object({
    __typename: z.literal("OriginalSource").optional(),
    aliases: z.array(z.string()),
    attachments: z.array(z.lazy(() => OscAttachmentSchema())),
    capturedAt: z.iso.datetime(),
    content: z.string().nullish(),
    externalId: z.string(),
    id: z.string(),
    lastSeenAt: z.iso.datetime(),
    mergedAt: z.iso.datetime().nullish(),
    mergedFrom: z.array(z.string()),
    mergedInto: z.string().nullish(),
    occurredAt: z.iso.datetime().nullish(),
    origin: z.url().nullish(),
    payload: z.unknown().nullish(),
    references: z.array(z.url()),
    status: OriginalSourceStatusSchema,
    tags: z.array(z.string()),
    title: z.string().nullish(),
  });
}

export function OriginalSourceCollectionStateSchema(): z.ZodObject<
  Properties<OriginalSourceCollectionState>
> {
  return z.object({
    __typename: z.literal("OriginalSourceCollectionState").optional(),
    counts: z.lazy(() => OscCountsSchema()),
    description: z.string().nullish(),
    provenance: z.lazy(() => OscProvenanceSchema().nullish()),
    sources: z.array(z.lazy(() => OriginalSourceSchema())),
    status: OriginalSourceStatusSchema,
    tasks: z.array(z.lazy(() => ProcessingTaskSchema())),
    title: z.string().nullish(),
  });
}

export function ProcessingTaskSchema(): z.ZodObject<
  Properties<ProcessingTask>
> {
  return z.object({
    __typename: z.literal("ProcessingTask").optional(),
    createdAt: z.iso.datetime(),
    description: z.string().nullish(),
    id: z.string(),
    owner: z.string().nullish(),
    source: z.string().nullish(),
    status: ProcessingTaskStatusSchema,
  });
}

export function RemoveAliasInputSchema(): z.ZodObject<
  Properties<RemoveAliasInput>
> {
  return z.object({
    alias: z.string(),
    source: z.string(),
  });
}

export function RestoreCollectionInputSchema(): z.ZodObject<
  Properties<RestoreCollectionInput>
> {
  return z.object({
    _: z.boolean().nullish(),
  });
}

export function SetDescriptionInputSchema(): z.ZodObject<
  Properties<SetDescriptionInput>
> {
  return z.object({
    description: z.string().nullish(),
  });
}

export function SetProvenanceInputSchema(): z.ZodObject<
  Properties<SetProvenanceInput>
> {
  return z.object({
    detail: z.unknown().nullish(),
    queue: z.string().nullish(),
    system: z.string().nullish(),
  });
}

export function SetSourceStatusInputSchema(): z.ZodObject<
  Properties<SetSourceStatusInput>
> {
  return z.object({
    source: z.string(),
    status: OriginalSourceStatusSchema,
  });
}

export function SetSourceTitleInputSchema(): z.ZodObject<
  Properties<SetSourceTitleInput>
> {
  return z.object({
    source: z.string(),
    title: z.string().nullish(),
  });
}

export function SetTaskDescriptionInputSchema(): z.ZodObject<
  Properties<SetTaskDescriptionInput>
> {
  return z.object({
    description: z.string().nullish(),
    task: z.string(),
  });
}

export function SetTaskStatusInputSchema(): z.ZodObject<
  Properties<SetTaskStatusInput>
> {
  return z.object({
    status: ProcessingTaskStatusSchema,
    task: z.string(),
  });
}

export function SetTitleInputSchema(): z.ZodObject<Properties<SetTitleInput>> {
  return z.object({
    title: z.string().nullish(),
  });
}

export function SplitSourceInputSchema(): z.ZodObject<
  Properties<SplitSourceInput>
> {
  return z.object({
    source: z.string(),
    status: OriginalSourceStatusSchema.nullish(),
  });
}

export function TagSourceInputSchema(): z.ZodObject<
  Properties<TagSourceInput>
> {
  return z.object({
    source: z.string(),
    tags: z.array(z.string()),
  });
}

export function UntagSourceInputSchema(): z.ZodObject<
  Properties<UntagSourceInput>
> {
  return z.object({
    source: z.string(),
    tags: z.array(z.string()),
  });
}
