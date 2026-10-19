/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import type { Action } from "document-model";
import type { ArchiveContactInput } from "../types.js";

export type ArchiveContactAction = Action & {
  type: "ARCHIVE_CONTACT";
  input: ArchiveContactInput;
};

export type ContactLifecycleAction = ArchiveContactAction;
