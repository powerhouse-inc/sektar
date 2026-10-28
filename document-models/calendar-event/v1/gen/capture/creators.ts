/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import { createAction } from "document-model";
import { CaptureEventInputSchema } from "../schema/zod.js";
import type { CaptureEventInput } from "../types.js";
import type { CaptureEventAction } from "./actions.js";

export const captureEvent = (input: CaptureEventInput) =>
  createAction<CaptureEventAction>(
    "CAPTURE_EVENT",
    { ...input },
    undefined,
    CaptureEventInputSchema,
    "global",
  );
