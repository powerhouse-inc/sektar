/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import { type SignalDispatch } from "document-model";
import type { FileGlobalState } from "../types.js";
import type {
  AddTagAction,
  RemoveTagAction,
  UpdateTagAction,
} from "./actions.js";

export interface FileTagsOperations {
  addTagOperation: (
    state: FileGlobalState,
    action: AddTagAction,
    dispatch?: SignalDispatch,
  ) => void;
  updateTagOperation: (
    state: FileGlobalState,
    action: UpdateTagAction,
    dispatch?: SignalDispatch,
  ) => void;
  removeTagOperation: (
    state: FileGlobalState,
    action: RemoveTagAction,
    dispatch?: SignalDispatch,
  ) => void;
}
