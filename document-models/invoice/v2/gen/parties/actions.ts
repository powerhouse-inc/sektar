/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import type { Action } from "document-model";
import type { SetBuyerInput, SetSellerInput } from "../types.js";

export type SetSellerAction = Action & {
  type: "SET_SELLER";
  input: SetSellerInput;
};
export type SetBuyerAction = Action & {
  type: "SET_BUYER";
  input: SetBuyerInput;
};

export type InvoicePartiesAction = SetSellerAction | SetBuyerAction;
