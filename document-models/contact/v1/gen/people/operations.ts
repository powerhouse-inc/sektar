/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import { type SignalDispatch } from "document-model";
import type { ContactGlobalState } from "../types.js";
import type {
  AddPersonAction,
  RemovePersonAction,
  UpdatePersonAction,
} from "./actions.js";

export interface ContactPeopleOperations {
  addPersonOperation: (
    state: ContactGlobalState,
    action: AddPersonAction,
    dispatch?: SignalDispatch,
  ) => void;
  updatePersonOperation: (
    state: ContactGlobalState,
    action: UpdatePersonAction,
    dispatch?: SignalDispatch,
  ) => void;
  removePersonOperation: (
    state: ContactGlobalState,
    action: RemovePersonAction,
    dispatch?: SignalDispatch,
  ) => void;
}
