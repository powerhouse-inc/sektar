/* eslint-disable @typescript-eslint/no-empty-object-type */
/* eslint-disable @typescript-eslint/no-unused-vars */
import * as z from "zod";
import type {
  AddItemInput,
  ApproveReportInput,
  ExpenseItem,
  ExpenseReportState,
  ExpenseStatus,
  PaidWith,
  Person,
  ReimburseReportInput,
  RejectReportInput,
  RemoveItemInput,
  SetReportDetailsInput,
  SubmitReportInput,
  TransactionCategory,
  UpdateItemInput,
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

export const ExpenseStatusSchema = z.enum([
  "APPROVED",
  "DRAFT",
  "REIMBURSED",
  "REJECTED",
  "SUBMITTED",
]);

export const PaidWithSchema = z.enum(["CASH", "COMPANY_CARD", "PERSONAL"]);

export const TransactionCategorySchema = z.enum([
  "BANK_FEES",
  "MARKETING",
  "OTHER",
  "PAYROLL",
  "RENT",
  "SALES",
  "SOFTWARE",
  "SUPPLIES",
  "TAX",
  "TRANSFER",
  "TRAVEL",
  "UNCATEGORIZED",
]);

export function AddItemInputSchema(): z.ZodObject<Properties<AddItemInput>> {
  return z.object({
    amount: z.number(),
    category: TransactionCategorySchema,
    contactId: z.string().nullish(),
    id: z.string(),
    merchant: z.string(),
    note: z.string().nullish(),
    paidWith: PaidWithSchema,
    receiptName: z.string().nullish(),
    spentAt: z.iso.datetime(),
    vatAmount: z.number().nullish(),
  });
}

export function ApproveReportInputSchema(): z.ZodObject<
  Properties<ApproveReportInput>
> {
  return z.object({
    decidedAt: z.iso.datetime(),
    decidedBy: z.string(),
    note: z.string().nullish(),
  });
}

export function ExpenseItemSchema(): z.ZodObject<Properties<ExpenseItem>> {
  return z.object({
    __typename: z.literal("ExpenseItem").optional(),
    amount: z.number(),
    category: TransactionCategorySchema,
    contactId: z.string().nullish(),
    id: z.string(),
    merchant: z.string(),
    note: z.string().nullish(),
    paidWith: PaidWithSchema,
    receiptName: z.string().nullish(),
    spentAt: z.iso.datetime(),
    vatAmount: z.number(),
  });
}

export function ExpenseReportStateSchema(): z.ZodObject<
  Properties<ExpenseReportState>
> {
  return z.object({
    __typename: z.literal("ExpenseReportState").optional(),
    currency: z.string(),
    decidedAt: z.iso.datetime().nullish(),
    decidedBy: z.string().nullish(),
    decisionNote: z.string().nullish(),
    items: z.array(z.lazy(() => ExpenseItemSchema())),
    reimbursedAt: z.iso.datetime().nullish(),
    reimbursementTransactionId: z.string().nullish(),
    status: ExpenseStatusSchema,
    submittedAt: z.iso.datetime().nullish(),
    submitter: z.lazy(() => PersonSchema()),
    title: z.string().nullish(),
  });
}

export function PersonSchema(): z.ZodObject<Properties<Person>> {
  return z.object({
    __typename: z.literal("Person").optional(),
    email: z.string().nullish(),
    name: z.string().nullish(),
  });
}

export function ReimburseReportInputSchema(): z.ZodObject<
  Properties<ReimburseReportInput>
> {
  return z.object({
    reimbursedAt: z.iso.datetime(),
    transactionId: z.string().nullish(),
  });
}

export function RejectReportInputSchema(): z.ZodObject<
  Properties<RejectReportInput>
> {
  return z.object({
    decidedAt: z.iso.datetime(),
    decidedBy: z.string(),
    note: z.string(),
  });
}

export function RemoveItemInputSchema(): z.ZodObject<
  Properties<RemoveItemInput>
> {
  return z.object({
    id: z.string(),
  });
}

export function SetReportDetailsInputSchema(): z.ZodObject<
  Properties<SetReportDetailsInput>
> {
  return z.object({
    currency: z.string().nullish(),
    submitterEmail: z.string().nullish(),
    submitterName: z.string().nullish(),
    title: z.string().nullish(),
  });
}

export function SubmitReportInputSchema(): z.ZodObject<
  Properties<SubmitReportInput>
> {
  return z.object({
    submittedAt: z.iso.datetime(),
  });
}

export function UpdateItemInputSchema(): z.ZodObject<
  Properties<UpdateItemInput>
> {
  return z.object({
    amount: z.number().nullish(),
    category: TransactionCategorySchema.nullish(),
    contactId: z.string().nullish(),
    id: z.string(),
    merchant: z.string().nullish(),
    note: z.string().nullish(),
    paidWith: PaidWithSchema.nullish(),
    receiptName: z.string().nullish(),
    spentAt: z.iso.datetime().nullish(),
    vatAmount: z.number().nullish(),
  });
}
