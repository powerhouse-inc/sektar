/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import { createAction } from "document-model";
import { UpdateMemoryInputSchema } from "../schema/zod.js";
import type { UpdateMemoryInput } from "../types.js";
import type { UpdateMemoryAction } from "./actions.js";

export const updateMemory = (input: UpdateMemoryInput) =>
  createAction<UpdateMemoryAction>(
    "UPDATE_MEMORY",
    { ...input },
    undefined,
    UpdateMemoryInputSchema,
    "global",
  );
