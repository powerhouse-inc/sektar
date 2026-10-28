/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import { PHDocumentController } from "document-model";
import { CalendarEvent } from "../module.js";
import type { CalendarEventAction, CalendarEventPHState } from "./types.js";

export const CalendarEventController = PHDocumentController.forDocumentModel<
  CalendarEventPHState,
  CalendarEventAction
>(CalendarEvent);
