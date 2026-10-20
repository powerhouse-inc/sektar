/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import { type SignalDispatch } from "document-model";
import type { FileGlobalState } from "../types.js";
import type {
  AddRenditionAction,
  RemoveRenditionAction,
  UpdateRenditionAction,
} from "./actions.js";

export interface FileRenditionsOperations {
  addRenditionOperation: (
    state: FileGlobalState,
    action: AddRenditionAction,
    dispatch?: SignalDispatch,
  ) => void;
  updateRenditionOperation: (
    state: FileGlobalState,
    action: UpdateRenditionAction,
    dispatch?: SignalDispatch,
  ) => void;
  removeRenditionOperation: (
    state: FileGlobalState,
    action: RemoveRenditionAction,
    dispatch?: SignalDispatch,
  ) => void;
}
