/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import { PHDocumentController } from "document-model";
import { Contact } from "../module.js";
import type { ContactAction, ContactPHState } from "./types.js";

export const ContactController = PHDocumentController.forDocumentModel<
  ContactPHState,
  ContactAction
>(Contact);
