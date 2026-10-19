/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import type { Action } from "document-model";
import type {
  AddTagInput,
  RemoveTagInput,
  SetAddressInput,
  SetBankDetailsInput,
  SetPaymentTermsInput,
  SetProfileInput,
} from "../types.js";

export type SetProfileAction = Action & {
  type: "SET_PROFILE";
  input: SetProfileInput;
};
export type SetAddressAction = Action & {
  type: "SET_ADDRESS";
  input: SetAddressInput;
};
export type SetBankDetailsAction = Action & {
  type: "SET_BANK_DETAILS";
  input: SetBankDetailsInput;
};
export type SetPaymentTermsAction = Action & {
  type: "SET_PAYMENT_TERMS";
  input: SetPaymentTermsInput;
};
export type AddTagAction = Action & { type: "ADD_TAG"; input: AddTagInput };
export type RemoveTagAction = Action & {
  type: "REMOVE_TAG";
  input: RemoveTagInput;
};

export type ContactProfileAction =
  | SetProfileAction
  | SetAddressAction
  | SetBankDetailsAction
  | SetPaymentTermsAction
  | AddTagAction
  | RemoveTagAction;
