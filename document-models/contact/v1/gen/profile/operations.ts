/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import { type SignalDispatch } from "document-model";
import type { ContactGlobalState } from "../types.js";
import type {
  AddTagAction,
  RemoveTagAction,
  SetAddressAction,
  SetBankDetailsAction,
  SetPaymentTermsAction,
  SetProfileAction,
} from "./actions.js";

export interface ContactProfileOperations {
  setProfileOperation: (
    state: ContactGlobalState,
    action: SetProfileAction,
    dispatch?: SignalDispatch,
  ) => void;
  setAddressOperation: (
    state: ContactGlobalState,
    action: SetAddressAction,
    dispatch?: SignalDispatch,
  ) => void;
  setBankDetailsOperation: (
    state: ContactGlobalState,
    action: SetBankDetailsAction,
    dispatch?: SignalDispatch,
  ) => void;
  setPaymentTermsOperation: (
    state: ContactGlobalState,
    action: SetPaymentTermsAction,
    dispatch?: SignalDispatch,
  ) => void;
  addTagOperation: (
    state: ContactGlobalState,
    action: AddTagAction,
    dispatch?: SignalDispatch,
  ) => void;
  removeTagOperation: (
    state: ContactGlobalState,
    action: RemoveTagAction,
    dispatch?: SignalDispatch,
  ) => void;
}
