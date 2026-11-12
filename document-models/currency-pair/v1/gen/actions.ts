/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import type { CurrencyPairPairAction } from "./pair/actions.js";
import type { CurrencyPairRatesAction } from "./rates/actions.js";

export * from "./pair/actions.js";
export * from "./rates/actions.js";

export type CurrencyPairAction =
  | CurrencyPairPairAction
  | CurrencyPairRatesAction;
