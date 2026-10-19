/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import { type SignalDispatch } from "document-model";
import type { ContactGlobalState } from "../types.js";
import type { ArchiveContactAction } from "./actions.js";

export interface ContactLifecycleOperations {
  archiveContactOperation: (
    state: ContactGlobalState,
    action: ArchiveContactAction,
    dispatch?: SignalDispatch,
  ) => void;
}
