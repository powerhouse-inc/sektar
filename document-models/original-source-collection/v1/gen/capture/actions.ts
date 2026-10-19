/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import type { Action } from "document-model";
import type {
  AddSourceReferenceInput,
  AttachToSourceInput,
  CaptureSourceInput,
  DetachFromSourceInput,
} from "../types.js";

export type CaptureSourceAction = Action & {
  type: "CAPTURE_SOURCE";
  input: CaptureSourceInput;
};
export type AttachToSourceAction = Action & {
  type: "ATTACH_TO_SOURCE";
  input: AttachToSourceInput;
};
export type DetachFromSourceAction = Action & {
  type: "DETACH_FROM_SOURCE";
  input: DetachFromSourceInput;
};
export type AddSourceReferenceAction = Action & {
  type: "ADD_SOURCE_REFERENCE";
  input: AddSourceReferenceInput;
};

export type OriginalSourceCollectionCaptureAction =
  | CaptureSourceAction
  | AttachToSourceAction
  | DetachFromSourceAction
  | AddSourceReferenceAction;
