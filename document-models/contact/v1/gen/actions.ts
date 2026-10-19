/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import type { ContactLifecycleAction } from "./lifecycle/actions.js";
import type { ContactPeopleAction } from "./people/actions.js";
import type { ContactProfileAction } from "./profile/actions.js";

export * from "./lifecycle/actions.js";
export * from "./people/actions.js";
export * from "./profile/actions.js";

export type ContactAction =
  | ContactProfileAction
  | ContactPeopleAction
  | ContactLifecycleAction;
