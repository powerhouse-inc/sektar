/* eslint-disable @typescript-eslint/no-empty-object-type */
/* eslint-disable @typescript-eslint/no-unused-vars */
import * as z from "zod";
import type {
  AccountKind,
  BankAccountState,
  CategorizeTransactionInput,
  ExcludeTransactionInput,
  ImportTransactionsInput,
  ImportedTransactionInput,
  MatchKind,
  MatchTransactionInput,
  SetAccountDetailsInput,
  Transaction,
  TransactionCategory,
  TransactionStatus,
  UnmatchTransactionInput,
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

export const AccountKindSchema = z.enum(["CREDIT_CARD", "CURRENT", "SAVINGS"]);

export const MatchKindSchema = z.enum(["EXPENSE", "INVOICE"]);

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

export const TransactionStatusSchema = z.enum([
  "CATEGORIZED",
  "EXCLUDED",
  "MATCHED",
  "NEW",
]);

export function BankAccountStateSchema(): z.ZodObject<
  Properties<BankAccountState>
> {
  return z.object({
    __typename: z.literal("BankAccountState").optional(),
    currency: z.string(),
    iban: z.string().nullish(),
    institution: z.string().nullish(),
    kind: AccountKindSchema,
    lastImportedAt: z.iso.datetime().nullish(),
    name: z.string().nullish(),
    openingBalance: z.number(),
    transactions: z.array(z.lazy(() => TransactionSchema())),
  });
}

export function CategorizeTransactionInputSchema(): z.ZodObject<
  Properties<CategorizeTransactionInput>
> {
  return z.object({
    category: TransactionCategorySchema,
    contactId: z.string().nullish(),
    id: z.string(),
  });
}

export function ExcludeTransactionInputSchema(): z.ZodObject<
  Properties<ExcludeTransactionInput>
> {
  return z.object({
    excluded: z.boolean(),
    id: z.string(),
  });
}

export function ImportTransactionsInputSchema(): z.ZodObject<
  Properties<ImportTransactionsInput>
> {
  return z.object({
    batchId: z.string(),
    importedAt: z.iso.datetime(),
    transactions: z.array(z.lazy(() => ImportedTransactionInputSchema())),
  });
}

export function ImportedTransactionInputSchema(): z.ZodObject<
  Properties<ImportedTransactionInput>
> {
  return z.object({
    amount: z.number(),
    bookedAt: z.iso.datetime(),
    counterparty: z.string(),
    description: z.string().nullish(),
    id: z.string(),
    reference: z.string().nullish(),
  });
}

export function MatchTransactionInputSchema(): z.ZodObject<
  Properties<MatchTransactionInput>
> {
  return z.object({
    documentId: z.string(),
    id: z.string(),
    kind: MatchKindSchema,
  });
}

export function SetAccountDetailsInputSchema(): z.ZodObject<
  Properties<SetAccountDetailsInput>
> {
  return z.object({
    currency: z.string().nullish(),
    iban: z.string().nullish(),
    institution: z.string().nullish(),
    kind: AccountKindSchema.nullish(),
    name: z.string().nullish(),
    openingBalance: z.number().nullish(),
  });
}

export function TransactionSchema(): z.ZodObject<Properties<Transaction>> {
  return z.object({
    __typename: z.literal("Transaction").optional(),
    amount: z.number(),
    bookedAt: z.iso.datetime(),
    category: TransactionCategorySchema,
    contactId: z.string().nullish(),
    counterparty: z.string(),
    description: z.string().nullish(),
    id: z.string(),
    importBatch: z.string().nullish(),
    matchedDocumentId: z.string().nullish(),
    matchedKind: MatchKindSchema.nullish(),
    reference: z.string().nullish(),
    status: TransactionStatusSchema,
  });
}

export function UnmatchTransactionInputSchema(): z.ZodObject<
  Properties<UnmatchTransactionInput>
> {
  return z.object({
    id: z.string(),
  });
}
