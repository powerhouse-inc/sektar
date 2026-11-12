/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import { PHDocumentController } from "document-model";
import { BooksSettings } from "../module.js";
import type { BooksSettingsAction, BooksSettingsPHState } from "./types.js";

export const BooksSettingsController = PHDocumentController.forDocumentModel<
  BooksSettingsPHState,
  BooksSettingsAction
>(BooksSettings);
