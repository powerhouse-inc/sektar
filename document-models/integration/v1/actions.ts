/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import { baseActions } from "document-model";
import {
  integrationBackfillActions,
  integrationLifecycleActions,
  integrationLiveActions,
  integrationSetupActions,
} from "./gen/creators.js";

/** Actions for the Integration document model */

export const actions = {
  ...baseActions,
  ...integrationSetupActions,
  ...integrationLiveActions,
  ...integrationBackfillActions,
  ...integrationLifecycleActions,
};
