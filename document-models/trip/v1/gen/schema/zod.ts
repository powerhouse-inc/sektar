/* eslint-disable @typescript-eslint/no-empty-object-type */
/* eslint-disable @typescript-eslint/no-unused-vars */
import * as z from "zod";
import type {
  AddAttachmentInput,
  AddDestinationInput,
  AddExtraInput,
  AddMealInput,
  AddSourceInput,
  AddStayInput,
  AddTransportInput,
  RemoveAttachmentInput,
  RemoveDestinationInput,
  RemoveExtraInput,
  RemoveMealInput,
  RemoveSourceInput,
  RemoveStayInput,
  RemoveTransportInput,
  SetBillingInput,
  SetDetailsInput,
  SetStatusInput,
  SetTravelerInput,
  TripAttachment,
  TripAttachmentRole,
  TripBilling,
  TripCost,
  TripDestination,
  TripExtra,
  TripExtraKind,
  TripInvoiceLink,
  TripMeal,
  TripMealKind,
  TripPurposeKind,
  TripSource,
  TripSourceKind,
  TripState,
  TripStatus,
  TripStay,
  TripTransport,
  TripTransportMode,
  TripTraveler,
  UpdateDestinationInput,
  UpdateExtraInput,
  UpdateMealInput,
  UpdateStayInput,
  UpdateTransportInput,
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

export const TripAttachmentRoleSchema = z.enum([
  "BOOKING",
  "INVOICE",
  "ITINERARY",
  "OTHER",
  "RECEIPT",
  "TICKET",
]);

export const TripExtraKindSchema = z.enum([
  "CONNECTIVITY",
  "COWORKING",
  "EVENT_TICKET",
  "INSURANCE",
  "OTHER",
  "SUPPLIES",
  "VISA",
]);

export const TripMealKindSchema = z.enum([
  "BREAKFAST",
  "COFFEE",
  "DINNER",
  "DRINKS",
  "LUNCH",
  "OTHER",
  "SNACK",
]);

export const TripPurposeKindSchema = z.enum([
  "CLIENT_VISIT",
  "CONFERENCE",
  "OFFSITE",
  "OTHER",
  "SALES",
  "TRAINING",
  "WORKSHOP",
]);

export const TripSourceKindSchema = z.enum([
  "CALENDAR",
  "EMAIL",
  "FILE",
  "INVOICE_LINE",
  "MANUAL",
]);

export const TripStatusSchema = z.enum([
  "BOOKED",
  "CANCELLED",
  "COMPLETED",
  "PLANNED",
]);

export const TripTransportModeSchema = z.enum([
  "BUS",
  "CAR",
  "FERRY",
  "FLIGHT",
  "OTHER",
  "PARKING",
  "PUBLIC_TRANSPORT",
  "RIDE_HAIL",
  "TAXI",
  "TRAIN",
]);

export function AddAttachmentInputSchema(): z.ZodObject<
  Properties<AddAttachmentInput>
> {
  return z.object({
    addedAt: z.iso.datetime(),
    documentId: z.string().nullish(),
    fileName: z.string(),
    id: z.string(),
    itemId: z.string().nullish(),
    mimeType: z.string().nullish(),
    ref: z.string().nullish(),
    role: TripAttachmentRoleSchema,
    sizeBytes: z.number().nullish(),
  });
}

export function AddDestinationInputSchema(): z.ZodObject<
  Properties<AddDestinationInput>
> {
  return z.object({
    arriveOn: z.iso.datetime().nullish(),
    city: z.string(),
    country: z.string().nullish(),
    id: z.string(),
    leaveOn: z.iso.datetime().nullish(),
  });
}

export function AddExtraInputSchema(): z.ZodObject<Properties<AddExtraInput>> {
  return z.object({
    amount: z.number().nullish(),
    at: z.iso.datetime().nullish(),
    converted: z.number().nullish(),
    currency: z.string().nullish(),
    description: z.string(),
    id: z.string(),
    invoiceId: z.string().nullish(),
    invoiceLineId: z.string().nullish(),
    invoiceNumber: z.string().nullish(),
    kind: TripExtraKindSchema,
    note: z.string().nullish(),
  });
}

export function AddMealInputSchema(): z.ZodObject<Properties<AddMealInput>> {
  return z.object({
    amount: z.number().nullish(),
    at: z.iso.datetime().nullish(),
    attendees: z.string().nullish(),
    converted: z.number().nullish(),
    currency: z.string().nullish(),
    id: z.string(),
    invoiceId: z.string().nullish(),
    invoiceLineId: z.string().nullish(),
    invoiceNumber: z.string().nullish(),
    kind: TripMealKindSchema,
    note: z.string().nullish(),
    venue: z.string().nullish(),
  });
}

export function AddSourceInputSchema(): z.ZodObject<
  Properties<AddSourceInput>
> {
  return z.object({
    at: z.iso.datetime().nullish(),
    documentId: z.string().nullish(),
    id: z.string(),
    kind: TripSourceKindSchema,
    label: z.string().nullish(),
    lineId: z.string().nullish(),
  });
}

export function AddStayInputSchema(): z.ZodObject<Properties<AddStayInput>> {
  return z.object({
    address: z.string().nullish(),
    amount: z.number().nullish(),
    bookedVia: z.string().nullish(),
    bookingReference: z.string().nullish(),
    checkIn: z.iso.datetime().nullish(),
    checkOut: z.iso.datetime().nullish(),
    city: z.string().nullish(),
    converted: z.number().nullish(),
    currency: z.string().nullish(),
    id: z.string(),
    invoiceId: z.string().nullish(),
    invoiceLineId: z.string().nullish(),
    invoiceNumber: z.string().nullish(),
    name: z.string(),
    note: z.string().nullish(),
  });
}

export function AddTransportInputSchema(): z.ZodObject<
  Properties<AddTransportInput>
> {
  return z.object({
    amount: z.number().nullish(),
    arriveAt: z.iso.datetime().nullish(),
    bookingReference: z.string().nullish(),
    carrier: z.string().nullish(),
    converted: z.number().nullish(),
    currency: z.string().nullish(),
    departAt: z.iso.datetime().nullish(),
    from: z.string().nullish(),
    id: z.string(),
    invoiceId: z.string().nullish(),
    invoiceLineId: z.string().nullish(),
    invoiceNumber: z.string().nullish(),
    mode: TripTransportModeSchema,
    note: z.string().nullish(),
    number: z.string().nullish(),
    seat: z.string().nullish(),
    to: z.string().nullish(),
  });
}

export function RemoveAttachmentInputSchema(): z.ZodObject<
  Properties<RemoveAttachmentInput>
> {
  return z.object({
    id: z.string(),
  });
}

export function RemoveDestinationInputSchema(): z.ZodObject<
  Properties<RemoveDestinationInput>
> {
  return z.object({
    id: z.string(),
  });
}

export function RemoveExtraInputSchema(): z.ZodObject<
  Properties<RemoveExtraInput>
> {
  return z.object({
    id: z.string(),
  });
}

export function RemoveMealInputSchema(): z.ZodObject<
  Properties<RemoveMealInput>
> {
  return z.object({
    id: z.string(),
  });
}

export function RemoveSourceInputSchema(): z.ZodObject<
  Properties<RemoveSourceInput>
> {
  return z.object({
    id: z.string(),
  });
}

export function RemoveStayInputSchema(): z.ZodObject<
  Properties<RemoveStayInput>
> {
  return z.object({
    id: z.string(),
  });
}

export function RemoveTransportInputSchema(): z.ZodObject<
  Properties<RemoveTransportInput>
> {
  return z.object({
    id: z.string(),
  });
}

export function SetBillingInputSchema(): z.ZodObject<
  Properties<SetBillingInput>
> {
  return z.object({
    billable: z.boolean(),
    customerId: z.string().nullish(),
    customerName: z.string().nullish(),
  });
}

export function SetDetailsInputSchema(): z.ZodObject<
  Properties<SetDetailsInput>
> {
  return z.object({
    currency: z.string().nullish(),
    endDate: z.iso.datetime().nullish(),
    notes: z.string().nullish(),
    purpose: z.string().nullish(),
    purposeKind: TripPurposeKindSchema.nullish(),
    startDate: z.iso.datetime().nullish(),
    title: z.string().nullish(),
  });
}

export function SetStatusInputSchema(): z.ZodObject<
  Properties<SetStatusInput>
> {
  return z.object({
    status: TripStatusSchema,
  });
}

export function SetTravelerInputSchema(): z.ZodObject<
  Properties<SetTravelerInput>
> {
  return z.object({
    email: z.string().nullish(),
    name: z.string().nullish(),
  });
}

export function TripAttachmentSchema(): z.ZodObject<
  Properties<TripAttachment>
> {
  return z.object({
    __typename: z.literal("TripAttachment").optional(),
    addedAt: z.iso.datetime(),
    documentId: z.string().nullish(),
    fileName: z.string(),
    id: z.string(),
    itemId: z.string().nullish(),
    mimeType: z.string().nullish(),
    ref: z.string().nullish(),
    role: TripAttachmentRoleSchema,
    sizeBytes: z.number().nullish(),
  });
}

export function TripBillingSchema(): z.ZodObject<Properties<TripBilling>> {
  return z.object({
    __typename: z.literal("TripBilling").optional(),
    billable: z.boolean(),
    customerId: z.string().nullish(),
    customerName: z.string().nullish(),
  });
}

export function TripCostSchema(): z.ZodObject<Properties<TripCost>> {
  return z.object({
    __typename: z.literal("TripCost").optional(),
    amount: z.number(),
    converted: z.number().nullish(),
    currency: z.string(),
  });
}

export function TripDestinationSchema(): z.ZodObject<
  Properties<TripDestination>
> {
  return z.object({
    __typename: z.literal("TripDestination").optional(),
    arriveOn: z.iso.datetime().nullish(),
    city: z.string(),
    country: z.string().nullish(),
    id: z.string(),
    leaveOn: z.iso.datetime().nullish(),
  });
}

export function TripExtraSchema(): z.ZodObject<Properties<TripExtra>> {
  return z.object({
    __typename: z.literal("TripExtra").optional(),
    at: z.iso.datetime().nullish(),
    cost: z.lazy(() => TripCostSchema().nullish()),
    description: z.string(),
    id: z.string(),
    invoice: z.lazy(() => TripInvoiceLinkSchema().nullish()),
    kind: TripExtraKindSchema,
    note: z.string().nullish(),
  });
}

export function TripInvoiceLinkSchema(): z.ZodObject<
  Properties<TripInvoiceLink>
> {
  return z.object({
    __typename: z.literal("TripInvoiceLink").optional(),
    invoiceId: z.string(),
    lineId: z.string().nullish(),
    number: z.string().nullish(),
  });
}

export function TripMealSchema(): z.ZodObject<Properties<TripMeal>> {
  return z.object({
    __typename: z.literal("TripMeal").optional(),
    at: z.iso.datetime().nullish(),
    attendees: z.string().nullish(),
    cost: z.lazy(() => TripCostSchema().nullish()),
    id: z.string(),
    invoice: z.lazy(() => TripInvoiceLinkSchema().nullish()),
    kind: TripMealKindSchema,
    note: z.string().nullish(),
    venue: z.string().nullish(),
  });
}

export function TripSourceSchema(): z.ZodObject<Properties<TripSource>> {
  return z.object({
    __typename: z.literal("TripSource").optional(),
    at: z.iso.datetime().nullish(),
    documentId: z.string().nullish(),
    id: z.string(),
    kind: TripSourceKindSchema,
    label: z.string().nullish(),
    lineId: z.string().nullish(),
  });
}

export function TripStateSchema(): z.ZodObject<Properties<TripState>> {
  return z.object({
    __typename: z.literal("TripState").optional(),
    attachments: z.array(z.lazy(() => TripAttachmentSchema())),
    billing: z.lazy(() => TripBillingSchema().nullish()),
    currency: z.string(),
    destinations: z.array(z.lazy(() => TripDestinationSchema())),
    endDate: z.iso.datetime().nullish(),
    extras: z.array(z.lazy(() => TripExtraSchema())),
    meals: z.array(z.lazy(() => TripMealSchema())),
    notes: z.string().nullish(),
    purpose: z.string().nullish(),
    purposeKind: TripPurposeKindSchema.nullish(),
    sources: z.array(z.lazy(() => TripSourceSchema())),
    startDate: z.iso.datetime().nullish(),
    status: TripStatusSchema,
    stays: z.array(z.lazy(() => TripStaySchema())),
    title: z.string().nullish(),
    transport: z.array(z.lazy(() => TripTransportSchema())),
    traveler: z.lazy(() => TripTravelerSchema().nullish()),
  });
}

export function TripStaySchema(): z.ZodObject<Properties<TripStay>> {
  return z.object({
    __typename: z.literal("TripStay").optional(),
    address: z.string().nullish(),
    bookedVia: z.string().nullish(),
    bookingReference: z.string().nullish(),
    checkIn: z.iso.datetime().nullish(),
    checkOut: z.iso.datetime().nullish(),
    city: z.string().nullish(),
    cost: z.lazy(() => TripCostSchema().nullish()),
    id: z.string(),
    invoice: z.lazy(() => TripInvoiceLinkSchema().nullish()),
    name: z.string(),
    note: z.string().nullish(),
  });
}

export function TripTransportSchema(): z.ZodObject<Properties<TripTransport>> {
  return z.object({
    __typename: z.literal("TripTransport").optional(),
    arriveAt: z.iso.datetime().nullish(),
    bookingReference: z.string().nullish(),
    carrier: z.string().nullish(),
    cost: z.lazy(() => TripCostSchema().nullish()),
    departAt: z.iso.datetime().nullish(),
    from: z.string().nullish(),
    id: z.string(),
    invoice: z.lazy(() => TripInvoiceLinkSchema().nullish()),
    mode: TripTransportModeSchema,
    note: z.string().nullish(),
    number: z.string().nullish(),
    seat: z.string().nullish(),
    to: z.string().nullish(),
  });
}

export function TripTravelerSchema(): z.ZodObject<Properties<TripTraveler>> {
  return z.object({
    __typename: z.literal("TripTraveler").optional(),
    email: z.string().nullish(),
    name: z.string().nullish(),
  });
}

export function UpdateDestinationInputSchema(): z.ZodObject<
  Properties<UpdateDestinationInput>
> {
  return z.object({
    arriveOn: z.iso.datetime().nullish(),
    city: z.string().nullish(),
    country: z.string().nullish(),
    id: z.string(),
    leaveOn: z.iso.datetime().nullish(),
  });
}

export function UpdateExtraInputSchema(): z.ZodObject<
  Properties<UpdateExtraInput>
> {
  return z.object({
    amount: z.number().nullish(),
    at: z.iso.datetime().nullish(),
    converted: z.number().nullish(),
    currency: z.string().nullish(),
    description: z.string().nullish(),
    id: z.string(),
    invoiceId: z.string().nullish(),
    invoiceLineId: z.string().nullish(),
    invoiceNumber: z.string().nullish(),
    kind: TripExtraKindSchema.nullish(),
    note: z.string().nullish(),
  });
}

export function UpdateMealInputSchema(): z.ZodObject<
  Properties<UpdateMealInput>
> {
  return z.object({
    amount: z.number().nullish(),
    at: z.iso.datetime().nullish(),
    attendees: z.string().nullish(),
    converted: z.number().nullish(),
    currency: z.string().nullish(),
    id: z.string(),
    invoiceId: z.string().nullish(),
    invoiceLineId: z.string().nullish(),
    invoiceNumber: z.string().nullish(),
    kind: TripMealKindSchema.nullish(),
    note: z.string().nullish(),
    venue: z.string().nullish(),
  });
}

export function UpdateStayInputSchema(): z.ZodObject<
  Properties<UpdateStayInput>
> {
  return z.object({
    address: z.string().nullish(),
    amount: z.number().nullish(),
    bookedVia: z.string().nullish(),
    bookingReference: z.string().nullish(),
    checkIn: z.iso.datetime().nullish(),
    checkOut: z.iso.datetime().nullish(),
    city: z.string().nullish(),
    converted: z.number().nullish(),
    currency: z.string().nullish(),
    id: z.string(),
    invoiceId: z.string().nullish(),
    invoiceLineId: z.string().nullish(),
    invoiceNumber: z.string().nullish(),
    name: z.string().nullish(),
    note: z.string().nullish(),
  });
}

export function UpdateTransportInputSchema(): z.ZodObject<
  Properties<UpdateTransportInput>
> {
  return z.object({
    amount: z.number().nullish(),
    arriveAt: z.iso.datetime().nullish(),
    bookingReference: z.string().nullish(),
    carrier: z.string().nullish(),
    converted: z.number().nullish(),
    currency: z.string().nullish(),
    departAt: z.iso.datetime().nullish(),
    from: z.string().nullish(),
    id: z.string(),
    invoiceId: z.string().nullish(),
    invoiceLineId: z.string().nullish(),
    invoiceNumber: z.string().nullish(),
    mode: TripTransportModeSchema.nullish(),
    note: z.string().nullish(),
    number: z.string().nullish(),
    seat: z.string().nullish(),
    to: z.string().nullish(),
  });
}
