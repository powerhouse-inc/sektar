/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import type { DocumentModelModule } from "document-model";
import { createState, defaultBaseState } from "document-model";
import { actions } from "./actions.js";
import { documentModel } from "./gen/document-model.js";
import { reducer } from "./gen/reducer.js";
import type { OriginalSourceQueuePHState } from "./gen/types.js";
import { utils } from "./utils.js";

/** Document model module for the OriginalSourceQueue document type */
export const OriginalSourceQueue = {
  version: 1,
  reducer,
  actions,
  utils,
  documentModel: createState(defaultBaseState(), documentModel),
} as const satisfies DocumentModelModule<OriginalSourceQueuePHState>;
