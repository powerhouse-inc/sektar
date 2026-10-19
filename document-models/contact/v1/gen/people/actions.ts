/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import type { Action } from "document-model";
import type {
  AddPersonInput,
  RemovePersonInput,
  UpdatePersonInput,
} from "../types.js";

export type AddPersonAction = Action & {
  type: "ADD_PERSON";
  input: AddPersonInput;
};
export type UpdatePersonAction = Action & {
  type: "UPDATE_PERSON";
  input: UpdatePersonInput;
};
export type RemovePersonAction = Action & {
  type: "REMOVE_PERSON";
  input: RemovePersonInput;
};

export type ContactPeopleAction =
  | AddPersonAction
  | UpdatePersonAction
  | RemovePersonAction;
