/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import { createAction } from "document-model";
import { SetPairInputSchema } from "../schema/zod.js";
import type { SetPairInput } from "../types.js";
import type { SetPairAction } from "./actions.js";

export const setPair = (input: SetPairInput) =>
  createAction<SetPairAction>(
    "SET_PAIR",
    { ...input },
    undefined,
    SetPairInputSchema,
    "global",
  );
