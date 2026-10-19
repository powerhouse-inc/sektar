/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import { createAction } from "document-model";
import {
  AddPersonInputSchema,
  RemovePersonInputSchema,
  UpdatePersonInputSchema,
} from "../schema/zod.js";
import type {
  AddPersonInput,
  RemovePersonInput,
  UpdatePersonInput,
} from "../types.js";
import type {
  AddPersonAction,
  RemovePersonAction,
  UpdatePersonAction,
} from "./actions.js";

export const addPerson = (input: AddPersonInput) =>
  createAction<AddPersonAction>(
    "ADD_PERSON",
    { ...input },
    undefined,
    AddPersonInputSchema,
    "global",
  );

export const updatePerson = (input: UpdatePersonInput) =>
  createAction<UpdatePersonAction>(
    "UPDATE_PERSON",
    { ...input },
    undefined,
    UpdatePersonInputSchema,
    "global",
  );

export const removePerson = (input: RemovePersonInput) =>
  createAction<RemovePersonAction>(
    "REMOVE_PERSON",
    { ...input },
    undefined,
    RemovePersonInputSchema,
    "global",
  );
