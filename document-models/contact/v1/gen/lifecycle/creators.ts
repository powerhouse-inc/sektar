/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import { createAction } from "document-model";
import { ArchiveContactInputSchema } from "../schema/zod.js";
import type { ArchiveContactInput } from "../types.js";
import type { ArchiveContactAction } from "./actions.js";

export const archiveContact = (input: ArchiveContactInput) =>
  createAction<ArchiveContactAction>(
    "ARCHIVE_CONTACT",
    { ...input },
    undefined,
    ArchiveContactInputSchema,
    "global",
  );
