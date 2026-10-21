/* eslint-disable @typescript-eslint/no-empty-object-type */
/* eslint-disable @typescript-eslint/no-unused-vars */
import * as z from "zod";
import type {
  CompletePullInput,
  FinishRunInput,
  FolderSyncConflictPolicy,
  FolderSyncContent,
  FolderSyncDirection,
  FolderSyncFromDisk,
  FolderSyncHost,
  FolderSyncIssue,
  FolderSyncIssueInput,
  FolderSyncIssueKind,
  FolderSyncOptions,
  FolderSyncOtherDocuments,
  FolderSyncPull,
  FolderSyncRemovedPolicy,
  FolderSyncRequest,
  FolderSyncRun,
  FolderSyncRunStatus,
  FolderSyncState,
  FolderSyncStatus,
  FolderSyncTrigger,
  RequestPullInput,
  RequestSyncInput,
  ResolveIssueInput,
  SetEnabledInput,
  SetIssuesInput,
  SetLocalPathInput,
  SetOptionsInput,
  SetTargetInput,
  StartRunInput,
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

export const FolderSyncConflictPolicySchema = z.enum([
  "KEEP_BOTH",
  "OVERWRITE",
  "SKIP",
]);

export const FolderSyncContentSchema = z.enum([
  "SOURCE",
  "SOURCE_AND_RENDITIONS",
]);

export const FolderSyncDirectionSchema = z.enum(["TO_DISK"]);

export const FolderSyncFromDiskSchema = z.enum([
  "AUTO_PULL",
  "AUTO_PULL_WITH_DELETES",
  "OFF",
  "PLACEHOLDERS",
]);

export const FolderSyncIssueKindSchema = z.enum([
  "CONFLICT",
  "ERROR",
  "NAME_CLASH",
  "NO_SOURCE",
  "PATH_TOO_LONG",
]);

export const FolderSyncOtherDocumentsSchema = z.enum(["EXPORT_PHD", "SKIP"]);

export const FolderSyncRemovedPolicySchema = z.enum(["DELETE", "KEEP"]);

export const FolderSyncRunStatusSchema = z.enum([
  "CANCELLED",
  "ERROR",
  "OK",
  "PARTIAL",
  "RUNNING",
]);

export const FolderSyncStatusSchema = z.enum([
  "ERROR",
  "NEVER",
  "OK",
  "PARTIAL",
  "REQUESTED",
  "RUNNING",
]);

export const FolderSyncTriggerSchema = z.enum(["MANUAL", "ON_CHANGE"]);

export function CompletePullInputSchema(): z.ZodObject<
  Properties<CompletePullInput>
> {
  return z.object({
    id: z.string(),
  });
}

export function FinishRunInputSchema(): z.ZodObject<
  Properties<FinishRunInput>
> {
  return z.object({
    bytesWritten: z.number().nullish(),
    conflicts: z.number().nullish(),
    deleted: z.number().nullish(),
    error: z.string().nullish(),
    errors: z.number().nullish(),
    finishedAt: z.iso.datetime(),
    id: z.string(),
    placeholders: z.number().nullish(),
    pulled: z.number().nullish(),
    skipped: z.number().nullish(),
    status: FolderSyncRunStatusSchema,
    unchanged: z.number().nullish(),
    written: z.number().nullish(),
  });
}

export function FolderSyncHostSchema(): z.ZodObject<
  Properties<FolderSyncHost>
> {
  return z.object({
    __typename: z.literal("FolderSyncHost").optional(),
    name: z.string().nullish(),
    platform: z.string().nullish(),
    reactorId: z.string().nullish(),
  });
}

export function FolderSyncIssueSchema(): z.ZodObject<
  Properties<FolderSyncIssue>
> {
  return z.object({
    __typename: z.literal("FolderSyncIssue").optional(),
    at: z.iso.datetime(),
    documentId: z.string().nullish(),
    id: z.string(),
    kind: FolderSyncIssueKindSchema,
    message: z.string(),
    nodeId: z.string().nullish(),
    relativePath: z.string().nullish(),
  });
}

export function FolderSyncIssueInputSchema(): z.ZodObject<
  Properties<FolderSyncIssueInput>
> {
  return z.object({
    at: z.iso.datetime(),
    documentId: z.string().nullish(),
    id: z.string(),
    kind: FolderSyncIssueKindSchema,
    message: z.string(),
    nodeId: z.string().nullish(),
    relativePath: z.string().nullish(),
  });
}

export function FolderSyncOptionsSchema(): z.ZodObject<
  Properties<FolderSyncOptions>
> {
  return z.object({
    __typename: z.literal("FolderSyncOptions").optional(),
    content: FolderSyncContentSchema,
    fromDisk: FolderSyncFromDiskSchema.nullish(),
    includeSubfolders: z.boolean(),
    onConflict: FolderSyncConflictPolicySchema,
    onRemoved: FolderSyncRemovedPolicySchema,
    otherDocuments: FolderSyncOtherDocumentsSchema,
    trigger: FolderSyncTriggerSchema,
    writeFiles: z.boolean().nullish(),
  });
}

export function FolderSyncPullSchema(): z.ZodObject<
  Properties<FolderSyncPull>
> {
  return z.object({
    __typename: z.literal("FolderSyncPull").optional(),
    id: z.string(),
    nodeIds: z.array(z.string()),
    requestedAt: z.iso.datetime(),
    requestedBy: z.string().nullish(),
  });
}

export function FolderSyncRequestSchema(): z.ZodObject<
  Properties<FolderSyncRequest>
> {
  return z.object({
    __typename: z.literal("FolderSyncRequest").optional(),
    full: z.boolean(),
    id: z.string(),
    requestedAt: z.iso.datetime(),
    requestedBy: z.string().nullish(),
  });
}

export function FolderSyncRunSchema(): z.ZodObject<Properties<FolderSyncRun>> {
  return z.object({
    __typename: z.literal("FolderSyncRun").optional(),
    bytesWritten: z.number(),
    conflicts: z.number(),
    deleted: z.number(),
    driveRevision: z.number().nullish(),
    error: z.string().nullish(),
    errors: z.number(),
    finishedAt: z.iso.datetime().nullish(),
    full: z.boolean(),
    id: z.string(),
    placeholders: z.number().nullish(),
    pulled: z.number().nullish(),
    requestId: z.string().nullish(),
    skipped: z.number(),
    startedAt: z.iso.datetime(),
    status: FolderSyncRunStatusSchema,
    unchanged: z.number(),
    written: z.number(),
  });
}

export function FolderSyncStateSchema(): z.ZodObject<
  Properties<FolderSyncState>
> {
  return z.object({
    __typename: z.literal("FolderSyncState").optional(),
    direction: FolderSyncDirectionSchema,
    driveId: z.string().nullish(),
    enabled: z.boolean(),
    folderId: z.string().nullish(),
    folderPath: z.string().nullish(),
    host: z.lazy(() => FolderSyncHostSchema().nullish()),
    issues: z.array(z.lazy(() => FolderSyncIssueSchema())),
    localPath: z.string().nullish(),
    options: z.lazy(() => FolderSyncOptionsSchema()),
    pulls: z.array(z.lazy(() => FolderSyncPullSchema())).nullish(),
    request: z.lazy(() => FolderSyncRequestSchema().nullish()),
    runs: z.array(z.lazy(() => FolderSyncRunSchema())),
    status: FolderSyncStatusSchema,
  });
}

export function RequestPullInputSchema(): z.ZodObject<
  Properties<RequestPullInput>
> {
  return z.object({
    id: z.string(),
    nodeIds: z.array(z.string()).nullish(),
    requestedAt: z.iso.datetime(),
    requestedBy: z.string().nullish(),
  });
}

export function RequestSyncInputSchema(): z.ZodObject<
  Properties<RequestSyncInput>
> {
  return z.object({
    full: z.boolean().nullish(),
    id: z.string(),
    requestedAt: z.iso.datetime(),
    requestedBy: z.string().nullish(),
  });
}

export function ResolveIssueInputSchema(): z.ZodObject<
  Properties<ResolveIssueInput>
> {
  return z.object({
    id: z.string(),
  });
}

export function SetEnabledInputSchema(): z.ZodObject<
  Properties<SetEnabledInput>
> {
  return z.object({
    enabled: z.boolean(),
  });
}

export function SetIssuesInputSchema(): z.ZodObject<
  Properties<SetIssuesInput>
> {
  return z.object({
    issues: z.array(z.lazy(() => FolderSyncIssueInputSchema())),
  });
}

export function SetLocalPathInputSchema(): z.ZodObject<
  Properties<SetLocalPathInput>
> {
  return z.object({
    localPath: z.string(),
  });
}

export function SetOptionsInputSchema(): z.ZodObject<
  Properties<SetOptionsInput>
> {
  return z.object({
    content: FolderSyncContentSchema.nullish(),
    fromDisk: FolderSyncFromDiskSchema.nullish(),
    includeSubfolders: z.boolean().nullish(),
    onConflict: FolderSyncConflictPolicySchema.nullish(),
    onRemoved: FolderSyncRemovedPolicySchema.nullish(),
    otherDocuments: FolderSyncOtherDocumentsSchema.nullish(),
    trigger: FolderSyncTriggerSchema.nullish(),
    writeFiles: z.boolean().nullish(),
  });
}

export function SetTargetInputSchema(): z.ZodObject<
  Properties<SetTargetInput>
> {
  return z.object({
    driveId: z.string(),
    folderId: z.string().nullish(),
    folderPath: z.string().nullish(),
  });
}

export function StartRunInputSchema(): z.ZodObject<Properties<StartRunInput>> {
  return z.object({
    driveRevision: z.number().nullish(),
    full: z.boolean().nullish(),
    hostName: z.string().nullish(),
    hostPlatform: z.string().nullish(),
    id: z.string(),
    reactorId: z.string().nullish(),
    requestId: z.string().nullish(),
    startedAt: z.iso.datetime(),
  });
}
