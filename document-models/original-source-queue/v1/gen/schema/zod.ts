/* eslint-disable @typescript-eslint/no-empty-object-type */
/* eslint-disable @typescript-eslint/no-unused-vars */
import * as z from "zod";
import type {
  AddCollectionValueInput,
  ClearCollectionInput,
  CreateCollectionCursorInput,
  CreateCollectionInput,
  CreateDateTimeCursorInput,
  CreateNumberCursorInput,
  OsqCollection,
  OsqCollectionCursor,
  OsqCursorValue,
  OsqDateTimeCursor,
  OsqError,
  OsqMemoryEntry,
  OsqNumberCursor,
  OsqStatus,
  OriginalSourceQueueState,
  PauseInput,
  ProceedInput,
  ProceedWithErrorInput,
  ReorderCursorsInput,
  ReportErrorInput,
  ResetInput,
  SetCursorDescriptionInput,
  SetCursorNameInput,
  SetDescriptionInput,
  StartInput,
  TerminateInput,
  UnpauseInput,
  UpdateMemoryInput,
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

export const OsqStatusSchema = z.enum([
  "DRAFT",
  "FINISHED",
  "IN_PROGRESS",
  "PAUSED",
]);

export function AddCollectionValueInputSchema(): z.ZodObject<
  Properties<AddCollectionValueInput>
> {
  return z.object({
    collection: z.string(),
    values: z.array(z.unknown()),
  });
}

export function ClearCollectionInputSchema(): z.ZodObject<
  Properties<ClearCollectionInput>
> {
  return z.object({
    collection: z.string(),
  });
}

export function CreateCollectionCursorInputSchema(): z.ZodObject<
  Properties<CreateCollectionCursorInput>
> {
  return z.object({
    collection: z.string(),
    description: z.string().nullish(),
    id: z.string(),
    name: z.string().nullish(),
  });
}

export function CreateCollectionInputSchema(): z.ZodObject<
  Properties<CreateCollectionInput>
> {
  return z.object({
    id: z.string(),
    name: z.string(),
    values: z.array(z.unknown()).nullish(),
  });
}

export function CreateDateTimeCursorInputSchema(): z.ZodObject<
  Properties<CreateDateTimeCursorInput>
> {
  return z.object({
    deltaSeconds: z.number(),
    description: z.string().nullish(),
    first: z.iso.datetime(),
    id: z.string(),
    last: z.iso.datetime(),
    name: z.string().nullish(),
  });
}

export function CreateNumberCursorInputSchema(): z.ZodObject<
  Properties<CreateNumberCursorInput>
> {
  return z.object({
    description: z.string().nullish(),
    first: z.number(),
    id: z.string(),
    last: z.number(),
    name: z.string().nullish(),
    step: z.number(),
  });
}

export function OsqCollectionSchema(): z.ZodObject<Properties<OsqCollection>> {
  return z.object({
    __typename: z.literal("OSQCollection").optional(),
    id: z.string(),
    name: z.string(),
    values: z.array(z.unknown()),
  });
}

export function OsqCollectionCursorSchema(): z.ZodObject<
  Properties<OsqCollectionCursor>
> {
  return z.object({
    __typename: z.literal("OSQCollectionCursor").optional(),
    collection: z.string(),
    count: z.number(),
    current: z.number().nullish(),
    description: z.string().nullish(),
    finished: z.boolean(),
    id: z.string(),
    name: z.string().nullish(),
    next: z.number().nullish(),
    position: z.number(),
  });
}

export function OsqCursorSchema() {
  return z.union([
    OsqCollectionCursorSchema(),
    OsqDateTimeCursorSchema(),
    OsqNumberCursorSchema(),
  ]);
}

export function OsqCursorValueSchema(): z.ZodObject<
  Properties<OsqCursorValue>
> {
  return z.object({
    __typename: z.literal("OSQCursorValue").optional(),
    cursor: z.string(),
    value: z.unknown().nullish(),
  });
}

export function OsqDateTimeCursorSchema(): z.ZodObject<
  Properties<OsqDateTimeCursor>
> {
  return z.object({
    __typename: z.literal("OSQDateTimeCursor").optional(),
    count: z.number(),
    current: z.iso.datetime().nullish(),
    deltaSeconds: z.number(),
    description: z.string().nullish(),
    finished: z.boolean(),
    first: z.iso.datetime(),
    id: z.string(),
    last: z.iso.datetime(),
    name: z.string().nullish(),
    next: z.iso.datetime().nullish(),
    position: z.number(),
  });
}

export function OsqErrorSchema(): z.ZodObject<Properties<OsqError>> {
  return z.object({
    __typename: z.literal("OSQError").optional(),
    cursors: z.array(z.lazy(() => OsqCursorValueSchema())),
    data: z.unknown().nullish(),
    id: z.string(),
    message: z.string(),
  });
}

export function OsqMemoryEntrySchema(): z.ZodObject<
  Properties<OsqMemoryEntry>
> {
  return z.object({
    __typename: z.literal("OSQMemoryEntry").optional(),
    key: z.string(),
    value: z.unknown().nullish(),
  });
}

export function OsqNumberCursorSchema(): z.ZodObject<
  Properties<OsqNumberCursor>
> {
  return z.object({
    __typename: z.literal("OSQNumberCursor").optional(),
    count: z.number(),
    current: z.number().nullish(),
    description: z.string().nullish(),
    finished: z.boolean(),
    first: z.number(),
    id: z.string(),
    last: z.number(),
    name: z.string().nullish(),
    next: z.number().nullish(),
    position: z.number(),
    step: z.number(),
  });
}

export function OriginalSourceQueueStateSchema(): z.ZodObject<
  Properties<OriginalSourceQueueState>
> {
  return z.object({
    __typename: z.literal("OriginalSourceQueueState").optional(),
    awaitingValues: z.boolean(),
    collections: z.array(z.lazy(() => OsqCollectionSchema())),
    cursors: z.array(z.lazy(() => OsqCursorSchema())),
    description: z.string().nullish(),
    errors: z.array(z.lazy(() => OsqErrorSchema())),
    memory: z.array(z.lazy(() => OsqMemoryEntrySchema())),
    progress: z.number(),
    status: OsqStatusSchema,
  });
}

export function PauseInputSchema(): z.ZodObject<Properties<PauseInput>> {
  return z.object({
    _: z.boolean().nullish(),
  });
}

export function ProceedInputSchema(): z.ZodObject<Properties<ProceedInput>> {
  return z.object({
    _: z.boolean().nullish(),
  });
}

export function ProceedWithErrorInputSchema(): z.ZodObject<
  Properties<ProceedWithErrorInput>
> {
  return z.object({
    data: z.unknown().nullish(),
    id: z.string(),
    message: z.string(),
  });
}

export function ReorderCursorsInputSchema(): z.ZodObject<
  Properties<ReorderCursorsInput>
> {
  return z.object({
    order: z.array(z.string()),
  });
}

export function ReportErrorInputSchema(): z.ZodObject<
  Properties<ReportErrorInput>
> {
  return z.object({
    data: z.unknown().nullish(),
    id: z.string(),
    message: z.string(),
  });
}

export function ResetInputSchema(): z.ZodObject<Properties<ResetInput>> {
  return z.object({
    _: z.boolean().nullish(),
  });
}

export function SetCursorDescriptionInputSchema(): z.ZodObject<
  Properties<SetCursorDescriptionInput>
> {
  return z.object({
    description: z.string().nullish(),
    id: z.string(),
  });
}

export function SetCursorNameInputSchema(): z.ZodObject<
  Properties<SetCursorNameInput>
> {
  return z.object({
    id: z.string(),
    name: z.string().nullish(),
  });
}

export function SetDescriptionInputSchema(): z.ZodObject<
  Properties<SetDescriptionInput>
> {
  return z.object({
    description: z.string().nullish(),
  });
}

export function StartInputSchema(): z.ZodObject<Properties<StartInput>> {
  return z.object({
    _: z.boolean().nullish(),
  });
}

export function TerminateInputSchema(): z.ZodObject<
  Properties<TerminateInput>
> {
  return z.object({
    _: z.boolean().nullish(),
  });
}

export function UnpauseInputSchema(): z.ZodObject<Properties<UnpauseInput>> {
  return z.object({
    _: z.boolean().nullish(),
  });
}

export function UpdateMemoryInputSchema(): z.ZodObject<
  Properties<UpdateMemoryInput>
> {
  return z.object({
    key: z.string(),
    value: z.unknown().nullish(),
  });
}
