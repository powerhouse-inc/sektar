/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import { createAction } from "document-model";
import {
  RecordBackfillDocumentInputSchema,
  RecordCheckInputSchema,
  RecordResourcesInputSchema,
  RecordRunnerInputSchema,
  RequestCheckInputSchema,
} from "../schema/zod.js";
import type {
  RecordBackfillDocumentInput,
  RecordCheckInput,
  RecordResourcesInput,
  RecordRunnerInput,
  RequestCheckInput,
} from "../types.js";
import type {
  RecordBackfillDocumentAction,
  RecordCheckAction,
  RecordResourcesAction,
  RecordRunnerAction,
  RequestCheckAction,
} from "./actions.js";

export const requestCheck = (input: RequestCheckInput) =>
  createAction<RequestCheckAction>(
    "REQUEST_CHECK",
    { ...input },
    undefined,
    RequestCheckInputSchema,
    "global",
  );

export const recordRunner = (input: RecordRunnerInput) =>
  createAction<RecordRunnerAction>(
    "RECORD_RUNNER",
    { ...input },
    undefined,
    RecordRunnerInputSchema,
    "global",
  );

export const recordResources = (input: RecordResourcesInput) =>
  createAction<RecordResourcesAction>(
    "RECORD_RESOURCES",
    { ...input },
    undefined,
    RecordResourcesInputSchema,
    "global",
  );

export const recordBackfillDocument = (input: RecordBackfillDocumentInput) =>
  createAction<RecordBackfillDocumentAction>(
    "RECORD_BACKFILL_DOCUMENT",
    { ...input },
    undefined,
    RecordBackfillDocumentInputSchema,
    "global",
  );

export const recordCheck = (input: RecordCheckInput) =>
  createAction<RecordCheckAction>(
    "RECORD_CHECK",
    { ...input },
    undefined,
    RecordCheckInputSchema,
    "global",
  );
