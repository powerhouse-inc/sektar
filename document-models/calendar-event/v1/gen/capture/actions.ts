/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import type { Action } from "document-model";
import type { CaptureEventInput } from "../types.js";

export type CaptureEventAction = Action & {
  type: "CAPTURE_EVENT";
  input: CaptureEventInput;
};

export type CalendarEventCaptureAction = CaptureEventAction;
