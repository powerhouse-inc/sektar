/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import { createAction } from "document-model";
import {
  AddDestinationInputSchema,
  RemoveDestinationInputSchema,
  SetBillingInputSchema,
  SetDetailsInputSchema,
  SetStatusInputSchema,
  SetTravelerInputSchema,
  UpdateDestinationInputSchema,
} from "../schema/zod.js";
import type {
  AddDestinationInput,
  RemoveDestinationInput,
  SetBillingInput,
  SetDetailsInput,
  SetStatusInput,
  SetTravelerInput,
  UpdateDestinationInput,
} from "../types.js";
import type {
  AddDestinationAction,
  RemoveDestinationAction,
  SetBillingAction,
  SetDetailsAction,
  SetStatusAction,
  SetTravelerAction,
  UpdateDestinationAction,
} from "./actions.js";

export const setDetails = (input: SetDetailsInput) =>
  createAction<SetDetailsAction>(
    "SET_DETAILS",
    { ...input },
    undefined,
    SetDetailsInputSchema,
    "global",
  );

export const setStatus = (input: SetStatusInput) =>
  createAction<SetStatusAction>(
    "SET_STATUS",
    { ...input },
    undefined,
    SetStatusInputSchema,
    "global",
  );

export const setTraveler = (input: SetTravelerInput) =>
  createAction<SetTravelerAction>(
    "SET_TRAVELER",
    { ...input },
    undefined,
    SetTravelerInputSchema,
    "global",
  );

export const setBilling = (input: SetBillingInput) =>
  createAction<SetBillingAction>(
    "SET_BILLING",
    { ...input },
    undefined,
    SetBillingInputSchema,
    "global",
  );

export const addDestination = (input: AddDestinationInput) =>
  createAction<AddDestinationAction>(
    "ADD_DESTINATION",
    { ...input },
    undefined,
    AddDestinationInputSchema,
    "global",
  );

export const updateDestination = (input: UpdateDestinationInput) =>
  createAction<UpdateDestinationAction>(
    "UPDATE_DESTINATION",
    { ...input },
    undefined,
    UpdateDestinationInputSchema,
    "global",
  );

export const removeDestination = (input: RemoveDestinationInput) =>
  createAction<RemoveDestinationAction>(
    "REMOVE_DESTINATION",
    { ...input },
    undefined,
    RemoveDestinationInputSchema,
    "global",
  );
