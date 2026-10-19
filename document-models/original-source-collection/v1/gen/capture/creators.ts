/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import { createAction } from "document-model";
import {
  AddSourceReferenceInputSchema,
  AttachToSourceInputSchema,
  CaptureSourceInputSchema,
  DetachFromSourceInputSchema,
} from "../schema/zod.js";
import type {
  AddSourceReferenceInput,
  AttachToSourceInput,
  CaptureSourceInput,
  DetachFromSourceInput,
} from "../types.js";
import type {
  AddSourceReferenceAction,
  AttachToSourceAction,
  CaptureSourceAction,
  DetachFromSourceAction,
} from "./actions.js";

export const captureSource = (input: CaptureSourceInput) =>
  createAction<CaptureSourceAction>(
    "CAPTURE_SOURCE",
    { ...input },
    undefined,
    CaptureSourceInputSchema,
    "global",
  );

export const attachToSource = (input: AttachToSourceInput) =>
  createAction<AttachToSourceAction>(
    "ATTACH_TO_SOURCE",
    { ...input },
    undefined,
    AttachToSourceInputSchema,
    "global",
  );

export const detachFromSource = (input: DetachFromSourceInput) =>
  createAction<DetachFromSourceAction>(
    "DETACH_FROM_SOURCE",
    { ...input },
    undefined,
    DetachFromSourceInputSchema,
    "global",
  );

export const addSourceReference = (input: AddSourceReferenceInput) =>
  createAction<AddSourceReferenceAction>(
    "ADD_SOURCE_REFERENCE",
    { ...input },
    undefined,
    AddSourceReferenceInputSchema,
    "global",
  );
