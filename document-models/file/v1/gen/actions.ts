/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import type { FileContentAction } from "./content/actions.js";
import type { FileRenditionsAction } from "./renditions/actions.js";
import type { FileTagsAction } from "./tags/actions.js";

export * from "./content/actions.js";
export * from "./renditions/actions.js";
export * from "./tags/actions.js";

export type FileAction =
  | FileContentAction
  | FileRenditionsAction
  | FileTagsAction;
