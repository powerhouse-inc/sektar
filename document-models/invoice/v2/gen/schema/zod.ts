/* eslint-disable @typescript-eslint/no-empty-object-type */
/* eslint-disable @typescript-eslint/no-unused-vars */
import * as z from "zod";
import type {
  AddAttachmentInput,
  AddLineInput,
  AddPrecedingInvoiceInput,
  AttachmentRole,
  ExchangeRate,
  InvoiceAttachment,
  InvoiceDirection,
  InvoiceKind,
  InvoiceLine,
  InvoiceParty,
  InvoicePeriod,
  InvoiceReferences,
  InvoiceState,
  InvoiceStatus,
  IssueInvoiceInput,
  MoveAttachmentInput,
  MoveLineInput,
  OriginalAmount,
  Payment,
  PaymentInstructions,
  PaymentMethod,
  PrecedingInvoice,
  RecordPaymentInput,
  RemoveAttachmentInput,
  RemoveExchangeRateInput,
  RemoveLineInput,
  RemovePaymentInput,
  RemovePrecedingInvoiceInput,
  RemoveVatReasonInput,
  SetBuyerInput,
  SetCurrencyInput,
  SetExchangeRateInput,
  SetHeaderInput,
  SetPaymentInstructionsInput,
  SetSellerInput,
  SetVatReasonInput,
  UpdateAttachmentInput,
  UpdateLineInput,
  VatCategory,
  VatReason,
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

export const AttachmentRoleSchema = z.enum([
  "ISSUED_COPY",
  "OTHER",
  "RECEIPT",
  "SOURCE",
  "SUPPORTING",
  "TIMESHEET",
]);

export const InvoiceDirectionSchema = z.enum(["INCOMING", "OUTGOING"]);

export const InvoiceKindSchema = z.enum(["CREDIT_NOTE", "INVOICE"]);

export const InvoiceStatusSchema = z.enum(["DRAFT", "OPEN", "PAID", "VOID"]);

export const PaymentMethodSchema = z.enum([
  "BANK_TRANSFER",
  "CARD",
  "CASH",
  "OTHER",
]);

export const VatCategorySchema = z.enum([
  "EXEMPT",
  "EXPORT",
  "INTRA_COMMUNITY",
  "OUTSIDE_SCOPE",
  "REVERSE_CHARGE",
  "STANDARD",
  "ZERO_RATED",
]);

export function AddAttachmentInputSchema(): z.ZodObject<
  Properties<AddAttachmentInput>
> {
  return z.object({
    addedAt: z.iso.datetime(),
    description: z.string().nullish(),
    documentId: z.string().nullish(),
    fileName: z.string(),
    id: z.string(),
    lineId: z.string().nullish(),
    mimeType: z.string(),
    ref: z
      .custom<`attachment://v${number}:${string}`>((val) =>
        /^attachment:\/\/v\d+:.+$/.test(val as string),
      )
      .nullish(),
    role: AttachmentRoleSchema,
    sizeBytes: z.number().nullish(),
    url: z.url().nullish(),
  });
}

export function AddLineInputSchema(): z.ZodObject<Properties<AddLineInput>> {
  return z.object({
    category: z.string().nullish(),
    description: z.string(),
    id: z.string(),
    note: z.string().nullish(),
    originalAmount: z.number().nullish(),
    originalCurrency: z.string().nullish(),
    originalRate: z.number().nullish(),
    originalReference: z.string().nullish(),
    periodEnd: z.iso.datetime().nullish(),
    periodStart: z.iso.datetime().nullish(),
    position: z.number().nullish(),
    quantity: z.number(),
    unitCode: z.string().nullish(),
    unitPrice: z.number(),
    vatCategory: VatCategorySchema,
    vatRate: z.number(),
  });
}

export function AddPrecedingInvoiceInputSchema(): z.ZodObject<
  Properties<AddPrecedingInvoiceInput>
> {
  return z.object({
    documentId: z.string().nullish(),
    id: z.string(),
    issuedAt: z.iso.datetime().nullish(),
    number: z.string(),
  });
}

export function ExchangeRateSchema(): z.ZodObject<Properties<ExchangeRate>> {
  return z.object({
    __typename: z.literal("ExchangeRate").optional(),
    base: z.string(),
    date: z.iso.datetime().nullish(),
    quote: z.string(),
    rate: z.number(),
    source: z.string().nullish(),
  });
}

export function InvoiceAttachmentSchema(): z.ZodObject<
  Properties<InvoiceAttachment>
> {
  return z.object({
    __typename: z.literal("InvoiceAttachment").optional(),
    addedAt: z.iso.datetime(),
    description: z.string().nullish(),
    documentId: z.string().nullish(),
    fileName: z.string(),
    id: z.string(),
    mimeType: z.string(),
    ref: z
      .custom<`attachment://v${number}:${string}`>((val) =>
        /^attachment:\/\/v\d+:.+$/.test(val as string),
      )
      .nullish(),
    role: AttachmentRoleSchema,
    sizeBytes: z.number().nullish(),
    url: z.url().nullish(),
  });
}

export function InvoiceLineSchema(): z.ZodObject<Properties<InvoiceLine>> {
  return z.object({
    __typename: z.literal("InvoiceLine").optional(),
    attachments: z.array(z.lazy(() => InvoiceAttachmentSchema())),
    category: z.string().nullish(),
    description: z.string(),
    id: z.string(),
    note: z.string().nullish(),
    original: z.lazy(() => OriginalAmountSchema().nullish()),
    period: z.lazy(() => InvoicePeriodSchema().nullish()),
    quantity: z.number(),
    unitCode: z.string(),
    unitPrice: z.number(),
    vatCategory: VatCategorySchema,
    vatRate: z.number(),
  });
}

export function InvoicePartySchema(): z.ZodObject<Properties<InvoiceParty>> {
  return z.object({
    __typename: z.literal("InvoiceParty").optional(),
    additionalStreet: z.string().nullish(),
    city: z.string().nullish(),
    contactId: z.string().nullish(),
    country: z.string().nullish(),
    email: z.string().nullish(),
    endpointId: z.string().nullish(),
    endpointScheme: z.string().nullish(),
    name: z.string().nullish(),
    phone: z.string().nullish(),
    postalCode: z.string().nullish(),
    region: z.string().nullish(),
    registrationId: z.string().nullish(),
    registrationScheme: z.string().nullish(),
    street: z.string().nullish(),
    vatId: z.string().nullish(),
  });
}

export function InvoicePeriodSchema(): z.ZodObject<Properties<InvoicePeriod>> {
  return z.object({
    __typename: z.literal("InvoicePeriod").optional(),
    end: z.iso.datetime().nullish(),
    start: z.iso.datetime().nullish(),
  });
}

export function InvoiceReferencesSchema(): z.ZodObject<
  Properties<InvoiceReferences>
> {
  return z.object({
    __typename: z.literal("InvoiceReferences").optional(),
    buyerReference: z.string().nullish(),
    contractReference: z.string().nullish(),
    orderReference: z.string().nullish(),
    projectReference: z.string().nullish(),
  });
}

export function InvoiceStateSchema(): z.ZodObject<Properties<InvoiceState>> {
  return z.object({
    __typename: z.literal("InvoiceState").optional(),
    attachments: z.array(z.lazy(() => InvoiceAttachmentSchema())),
    buyer: z.lazy(() => InvoicePartySchema()),
    currency: z.string(),
    deliveredAt: z.iso.datetime().nullish(),
    direction: InvoiceDirectionSchema,
    dueAt: z.iso.datetime().nullish(),
    exchangeRates: z.array(z.lazy(() => ExchangeRateSchema())),
    issuedAt: z.iso.datetime().nullish(),
    kind: InvoiceKindSchema,
    lines: z.array(z.lazy(() => InvoiceLineSchema())),
    notes: z.string().nullish(),
    number: z.string().nullish(),
    paymentInstructions: z.lazy(() => PaymentInstructionsSchema()),
    paymentTerms: z.string().nullish(),
    payments: z.array(z.lazy(() => PaymentSchema())),
    period: z.lazy(() => InvoicePeriodSchema().nullish()),
    precedingInvoices: z.array(z.lazy(() => PrecedingInvoiceSchema())),
    references: z.lazy(() => InvoiceReferencesSchema()),
    roundingAmount: z.number().nullish(),
    seller: z.lazy(() => InvoicePartySchema()),
    status: InvoiceStatusSchema,
    subject: z.string().nullish(),
    vatCurrency: z.string().nullish(),
    vatReasons: z.array(z.lazy(() => VatReasonSchema())),
    voidReason: z.string().nullish(),
  });
}

export function IssueInvoiceInputSchema(): z.ZodObject<
  Properties<IssueInvoiceInput>
> {
  return z.object({
    dueAt: z.iso.datetime().nullish(),
    issuedAt: z.iso.datetime(),
    number: z.string(),
  });
}

export function MoveAttachmentInputSchema(): z.ZodObject<
  Properties<MoveAttachmentInput>
> {
  return z.object({
    id: z.string(),
    lineId: z.string().nullish(),
  });
}

export function MoveLineInputSchema(): z.ZodObject<Properties<MoveLineInput>> {
  return z.object({
    id: z.string(),
    index: z.number(),
  });
}

export function OriginalAmountSchema(): z.ZodObject<
  Properties<OriginalAmount>
> {
  return z.object({
    __typename: z.literal("OriginalAmount").optional(),
    amount: z.number(),
    currency: z.string(),
    rate: z.number().nullish(),
    reference: z.string().nullish(),
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

export function PaymentInstructionsSchema(): z.ZodObject<
  Properties<PaymentInstructions>
> {
  return z.object({
    __typename: z.literal("PaymentInstructions").optional(),
    account: z.string().nullish(),
    accountName: z.string().nullish(),
    bic: z.string().nullish(),
    meansCode: z.string().nullish(),
    meansText: z.string().nullish(),
    remittance: z.string().nullish(),
  });
}

export function PrecedingInvoiceSchema(): z.ZodObject<
  Properties<PrecedingInvoice>
> {
  return z.object({
    __typename: z.literal("PrecedingInvoice").optional(),
    documentId: z.string().nullish(),
    id: z.string(),
    issuedAt: z.iso.datetime().nullish(),
    number: z.string(),
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

export function RemoveAttachmentInputSchema(): z.ZodObject<
  Properties<RemoveAttachmentInput>
> {
  return z.object({
    id: z.string(),
  });
}

export function RemoveExchangeRateInputSchema(): z.ZodObject<
  Properties<RemoveExchangeRateInput>
> {
  return z.object({
    base: z.string(),
    quote: z.string(),
  });
}

export function RemoveLineInputSchema(): z.ZodObject<
  Properties<RemoveLineInput>
> {
  return z.object({
    id: z.string(),
  });
}

export function RemovePaymentInputSchema(): z.ZodObject<
  Properties<RemovePaymentInput>
> {
  return z.object({
    id: z.string(),
  });
}

export function RemovePrecedingInvoiceInputSchema(): z.ZodObject<
  Properties<RemovePrecedingInvoiceInput>
> {
  return z.object({
    id: z.string(),
  });
}

export function RemoveVatReasonInputSchema(): z.ZodObject<
  Properties<RemoveVatReasonInput>
> {
  return z.object({
    category: VatCategorySchema,
  });
}

export function SetBuyerInputSchema(): z.ZodObject<Properties<SetBuyerInput>> {
  return z.object({
    additionalStreet: z.string().nullish(),
    city: z.string().nullish(),
    contactId: z.string().nullish(),
    country: z.string().nullish(),
    email: z.string().nullish(),
    endpointId: z.string().nullish(),
    endpointScheme: z.string().nullish(),
    name: z.string().nullish(),
    phone: z.string().nullish(),
    postalCode: z.string().nullish(),
    region: z.string().nullish(),
    registrationId: z.string().nullish(),
    registrationScheme: z.string().nullish(),
    street: z.string().nullish(),
    vatId: z.string().nullish(),
  });
}

export function SetCurrencyInputSchema(): z.ZodObject<
  Properties<SetCurrencyInput>
> {
  return z.object({
    currency: z.string().nullish(),
    vatCurrency: z.string().nullish(),
  });
}

export function SetExchangeRateInputSchema(): z.ZodObject<
  Properties<SetExchangeRateInput>
> {
  return z.object({
    base: z.string(),
    date: z.iso.datetime().nullish(),
    quote: z.string(),
    rate: z.number(),
    source: z.string().nullish(),
  });
}

export function SetHeaderInputSchema(): z.ZodObject<
  Properties<SetHeaderInput>
> {
  return z.object({
    buyerReference: z.string().nullish(),
    contractReference: z.string().nullish(),
    deliveredAt: z.iso.datetime().nullish(),
    direction: InvoiceDirectionSchema.nullish(),
    dueAt: z.iso.datetime().nullish(),
    kind: InvoiceKindSchema.nullish(),
    notes: z.string().nullish(),
    orderReference: z.string().nullish(),
    paymentTerms: z.string().nullish(),
    periodEnd: z.iso.datetime().nullish(),
    periodStart: z.iso.datetime().nullish(),
    projectReference: z.string().nullish(),
    roundingAmount: z.number().nullish(),
    subject: z.string().nullish(),
  });
}

export function SetPaymentInstructionsInputSchema(): z.ZodObject<
  Properties<SetPaymentInstructionsInput>
> {
  return z.object({
    account: z.string().nullish(),
    accountName: z.string().nullish(),
    bic: z.string().nullish(),
    meansCode: z.string().nullish(),
    meansText: z.string().nullish(),
    remittance: z.string().nullish(),
  });
}

export function SetSellerInputSchema(): z.ZodObject<
  Properties<SetSellerInput>
> {
  return z.object({
    additionalStreet: z.string().nullish(),
    city: z.string().nullish(),
    contactId: z.string().nullish(),
    country: z.string().nullish(),
    email: z.string().nullish(),
    endpointId: z.string().nullish(),
    endpointScheme: z.string().nullish(),
    name: z.string().nullish(),
    phone: z.string().nullish(),
    postalCode: z.string().nullish(),
    region: z.string().nullish(),
    registrationId: z.string().nullish(),
    registrationScheme: z.string().nullish(),
    street: z.string().nullish(),
    vatId: z.string().nullish(),
  });
}

export function SetVatReasonInputSchema(): z.ZodObject<
  Properties<SetVatReasonInput>
> {
  return z.object({
    category: VatCategorySchema,
    code: z.string().nullish(),
    text: z.string().nullish(),
  });
}

export function UpdateAttachmentInputSchema(): z.ZodObject<
  Properties<UpdateAttachmentInput>
> {
  return z.object({
    description: z.string().nullish(),
    documentId: z.string().nullish(),
    fileName: z.string().nullish(),
    id: z.string(),
    role: AttachmentRoleSchema.nullish(),
    url: z.url().nullish(),
  });
}

export function UpdateLineInputSchema(): z.ZodObject<
  Properties<UpdateLineInput>
> {
  return z.object({
    category: z.string().nullish(),
    description: z.string().nullish(),
    id: z.string(),
    note: z.string().nullish(),
    originalAmount: z.number().nullish(),
    originalCurrency: z.string().nullish(),
    originalRate: z.number().nullish(),
    originalReference: z.string().nullish(),
    periodEnd: z.iso.datetime().nullish(),
    periodStart: z.iso.datetime().nullish(),
    quantity: z.number().nullish(),
    unitCode: z.string().nullish(),
    unitPrice: z.number().nullish(),
    vatCategory: VatCategorySchema.nullish(),
    vatRate: z.number().nullish(),
  });
}

export function VatReasonSchema(): z.ZodObject<Properties<VatReason>> {
  return z.object({
    __typename: z.literal("VatReason").optional(),
    category: VatCategorySchema,
    code: z.string().nullish(),
    text: z.string().nullish(),
  });
}

export function VoidInvoiceInputSchema(): z.ZodObject<
  Properties<VoidInvoiceInput>
> {
  return z.object({
    reason: z.string(),
  });
}
