/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import { createAction } from "document-model";
import { ArchiveInputSchema } from "../schema/zod.js";
import type { ArchiveInput } from "../types.js";
import type { ArchiveAction } from "./actions.js";

export const archive = (input: ArchiveInput) =>
  createAction<ArchiveAction>(
    "ARCHIVE",
    { ...input },
    undefined,
    ArchiveInputSchema,
    "global",
  );
