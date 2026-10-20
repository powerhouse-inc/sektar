/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import { baseActions } from "document-model";
import {
  tripDocumentsActions,
  tripExtrasActions,
  tripMealsActions,
  tripStaysActions,
  tripTransportActions,
  tripTripActions,
} from "./gen/creators.js";

/** Actions for the Trip document model */

export const actions = {
  ...baseActions,
  ...tripTripActions,
  ...tripTransportActions,
  ...tripStaysActions,
  ...tripMealsActions,
  ...tripExtrasActions,
  ...tripDocumentsActions,
};
