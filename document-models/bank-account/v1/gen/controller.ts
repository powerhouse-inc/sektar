/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import { PHDocumentController } from "document-model";
import { BankAccount } from "../module.js";
import type { BankAccountAction, BankAccountPHState } from "./types.js";

export const BankAccountController = PHDocumentController.forDocumentModel<
  BankAccountPHState,
  BankAccountAction
>(BankAccount);
