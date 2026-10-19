/* eslint-disable @typescript-eslint/no-empty-object-type */
/* eslint-disable @typescript-eslint/no-unused-vars */
import * as z from "zod";
import type {
  AddLineInput,
  InvoiceDirection,
  InvoiceLine,
  InvoiceState,
  InvoiceStatus,
  IssueInvoiceInput,
  Party,
  Payment,
  PaymentMethod,
  RecordPaymentInput,
  RemoveLineInput,
  SetInvoiceDetailsInput,
  UpdateLineInput,
  VoidInvoiceInput,
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

export const InvoiceDirectionSchema = z.enum(["INCOMING", "OUTGOING"]);

export const InvoiceStatusSchema = z.enum(["DRAFT", "OPEN", "PAID", "VOID"]);

export const PaymentMethodSchema = z.enum([
  "BANK_TRANSFER",
  "CARD",
  "CASH",
  "OTHER",
]);

export function AddLineInputSchema(): z.ZodObject<Properties<AddLineInput>> {
  return z.object({
    description: z.string(),
    id: z.string(),
    quantity: z.number(),
    unitPrice: z.number(),
    vatRate: z.number(),
  });
}

export function InvoiceLineSchema(): z.ZodObject<Properties<InvoiceLine>> {
  return z.object({
    __typename: z.literal("InvoiceLine").optional(),
    description: z.string(),
    id: z.string(),
    quantity: z.number(),
    unitPrice: z.number(),
    vatRate: z.number(),
  });
}

export function InvoiceStateSchema(): z.ZodObject<Properties<InvoiceState>> {
  return z.object({
    __typename: z.literal("InvoiceState").optional(),
    counterparty: z.lazy(() => PartySchema()),
    currency: z.string(),
    direction: InvoiceDirectionSchema,
    dueAt: z.iso.datetime().nullish(),
    issuedAt: z.iso.datetime().nullish(),
    lines: z.array(z.lazy(() => InvoiceLineSchema())),
    notes: z.string().nullish(),
    number: z.string().nullish(),
    payments: z.array(z.lazy(() => PaymentSchema())),
    reference: z.string().nullish(),
    status: InvoiceStatusSchema,
    voidReason: z.string().nullish(),
  });
}

export function IssueInvoiceInputSchema(): z.ZodObject<
  Properties<IssueInvoiceInput>
> {
  return z.object({
    dueAt: z.iso.datetime(),
    issuedAt: z.iso.datetime(),
    number: z.string(),
  });
}

export function PartySchema(): z.ZodObject<Properties<Party>> {
  return z.object({
    __typename: z.literal("Party").optional(),
    address: z.string().nullish(),
    contactId: z.string().nullish(),
    email: z.string().nullish(),
    name: z.string().nullish(),
    vatId: z.string().nullish(),
  });
}

export function PaymentSchema(): z.ZodObject<Properties<Payment>> {
  return z.object({
    __typename: z.literal("Payment").optional(),
    amount: z.number(),
    id: z.string(),
    method: PaymentMethodSchema,
    paidAt: z.iso.datetime(),
    transactionId: z.string().nullish(),
  });
}

export function RecordPaymentInputSchema(): z.ZodObject<
  Properties<RecordPaymentInput>
> {
  return z.object({
    amount: z.number(),
    id: z.string(),
    method: PaymentMethodSchema,
    paidAt: z.iso.datetime(),
    transactionId: z.string().nullish(),
  });
}

export function RemoveLineInputSchema(): z.ZodObject<
  Properties<RemoveLineInput>
> {
  return z.object({
    id: z.string(),
  });
}

export function SetInvoiceDetailsInputSchema(): z.ZodObject<
  Properties<SetInvoiceDetailsInput>
> {
  return z.object({
    address: z.string().nullish(),
    contactId: z.string().nullish(),
    counterpartyName: z.string().nullish(),
    currency: z.string().nullish(),
    direction: InvoiceDirectionSchema.nullish(),
    dueAt: z.iso.datetime().nullish(),
    email: z.string().nullish(),
    notes: z.string().nullish(),
    number: z.string().nullish(),
    reference: z.string().nullish(),
    vatId: z.string().nullish(),
  });
}

export function UpdateLineInputSchema(): z.ZodObject<
  Properties<UpdateLineInput>
> {
  return z.object({
    description: z.string().nullish(),
    id: z.string(),
    quantity: z.number().nullish(),
    unitPrice: z.number().nullish(),
    vatRate: z.number().nullish(),
  });
}

export function VoidInvoiceInputSchema(): z.ZodObject<
  Properties<VoidInvoiceInput>
> {
  return z.object({
    reason: z.string(),
  });
}
