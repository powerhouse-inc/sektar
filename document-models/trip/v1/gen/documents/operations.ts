/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import { type SignalDispatch } from "document-model";
import type { TripGlobalState } from "../types.js";
import type {
  AddAttachmentAction,
  AddSourceAction,
  RemoveAttachmentAction,
  RemoveSourceAction,
} from "./actions.js";

export interface TripDocumentsOperations {
  addAttachmentOperation: (
    state: TripGlobalState,
    action: AddAttachmentAction,
    dispatch?: SignalDispatch,
  ) => void;
  removeAttachmentOperation: (
    state: TripGlobalState,
    action: RemoveAttachmentAction,
    dispatch?: SignalDispatch,
  ) => void;
  addSourceOperation: (
    state: TripGlobalState,
    action: AddSourceAction,
    dispatch?: SignalDispatch,
  ) => void;
  removeSourceOperation: (
    state: TripGlobalState,
    action: RemoveSourceAction,
    dispatch?: SignalDispatch,
  ) => void;
}
