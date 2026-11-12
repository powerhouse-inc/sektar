/* eslint-disable @typescript-eslint/no-empty-object-type */
/* eslint-disable @typescript-eslint/no-unused-vars */
import * as z from "zod";
import type {
  CurrencyPairState,
  RatePoint,
  RecordRatesInput,
  RecordedRateInput,
  RemoveRateInput,
  SetManualRateInput,
  SetPairInput,
} from "./types.js";

type Properties<T> = Required<{
  [K in keyof T]: z.ZodType<T[K]>;
}>;

type definedNonNullAny = {};

export const isDefinedNonNullAny = (v: any): v is definedNonNullAny =>
  v !== undefined && v !== null;

export const definedNonNullAnySchema = z
  .any()
  .refine((v) => isDefinedNonNullAny(v));

export function CurrencyPairStateSchema(): z.ZodObject<
  Properties<CurrencyPairState>
> {
  return z.object({
    __typename: z.literal("CurrencyPairState").optional(),
    base: z.string().nullish(),
    lastFetchedAt: z.iso.datetime().nullish(),
    quote: z.string().nullish(),
    rates: z.array(z.lazy(() => RatePointSchema())),
  });
}

export function RatePointSchema(): z.ZodObject<Properties<RatePoint>> {
  return z.object({
    __typename: z.literal("RatePoint").optional(),
    date: z.iso.datetime(),
    id: z.string(),
    manual: z.boolean(),
    rate: z.number(),
    source: z.string().nullish(),
  });
}

export function RecordRatesInputSchema(): z.ZodObject<
  Properties<RecordRatesInput>
> {
  return z.object({
    fetchedAt: z.iso.datetime(),
    rates: z.array(z.lazy(() => RecordedRateInputSchema())),
    source: z.string(),
  });
}

export function RecordedRateInputSchema(): z.ZodObject<
  Properties<RecordedRateInput>
> {
  return z.object({
    date: z.iso.datetime(),
    id: z.string(),
    rate: z.number(),
  });
}

export function RemoveRateInputSchema(): z.ZodObject<
  Properties<RemoveRateInput>
> {
  return z.object({
    date: z.iso.datetime(),
  });
}

export function SetManualRateInputSchema(): z.ZodObject<
  Properties<SetManualRateInput>
> {
  return z.object({
    date: z.iso.datetime(),
    id: z.string(),
    rate: z.number(),
  });
}

export function SetPairInputSchema(): z.ZodObject<Properties<SetPairInput>> {
  return z.object({
    base: z.string(),
    quote: z.string(),
  });
}
