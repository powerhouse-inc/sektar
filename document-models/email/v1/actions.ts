/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import { baseActions } from "document-model";
import {
  emailAttachmentsActions,
  emailMessageActions,
  emailTriageActions,
} from "./gen/creators.js";

/** Actions for the Email document model */

export const actions = {
  ...baseActions,
  ...emailMessageActions,
  ...emailAttachmentsActions,
  ...emailTriageActions,
};
