/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import { type SignalDispatch } from "document-model";
import type { CalendarEventGlobalState } from "../types.js";
import type { CaptureEventAction } from "./actions.js";

export interface CalendarEventCaptureOperations {
  captureEventOperation: (
    state: CalendarEventGlobalState,
    action: CaptureEventAction,
    dispatch?: SignalDispatch,
  ) => void;
}
