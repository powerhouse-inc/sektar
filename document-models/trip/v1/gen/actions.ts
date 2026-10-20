/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import type { TripDocumentsAction } from "./documents/actions.js";
import type { TripExtrasAction } from "./extras/actions.js";
import type { TripMealsAction } from "./meals/actions.js";
import type { TripStaysAction } from "./stays/actions.js";
import type { TripTransportAction } from "./transport/actions.js";
import type { TripTripAction } from "./trip/actions.js";

export * from "./documents/actions.js";
export * from "./extras/actions.js";
export * from "./meals/actions.js";
export * from "./stays/actions.js";
export * from "./transport/actions.js";
export * from "./trip/actions.js";

export type TripAction =
  | TripTripAction
  | TripTransportAction
  | TripStaysAction
  | TripMealsAction
  | TripExtrasAction
  | TripDocumentsAction;
