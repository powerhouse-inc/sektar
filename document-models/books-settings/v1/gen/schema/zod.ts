/* eslint-disable @typescript-eslint/no-empty-object-type */
/* eslint-disable @typescript-eslint/no-unused-vars */
import * as z from "zod";
import type { BooksSettingsState, SetBaseCurrencyInput } from "./types.js";

type Properties<T> = Required<{
  [K in keyof T]: z.ZodType<T[K]>;
}>;

type definedNonNullAny = {};

export const isDefinedNonNullAny = (v: any): v is definedNonNullAny =>
  v !== undefined && v !== null;

export const definedNonNullAnySchema = z
  .any()
  .refine((v) => isDefinedNonNullAny(v));

export function BooksSettingsStateSchema(): z.ZodObject<
  Properties<BooksSettingsState>
> {
  return z.object({
    __typename: z.literal("BooksSettingsState").optional(),
    baseCurrency: z.string(),
    baseCurrencyChangedAt: z.iso.datetime().nullish(),
  });
}

export function SetBaseCurrencyInputSchema(): z.ZodObject<
  Properties<SetBaseCurrencyInput>
> {
  return z.object({
    changedAt: z.iso.datetime(),
    currency: z.string(),
  });
}
