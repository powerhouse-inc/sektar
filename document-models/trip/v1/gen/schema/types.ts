export type Maybe<T> = T | null | undefined;
export type InputMaybe<T> = T | null | undefined;
export type Exact<T extends { [key: string]: unknown }> = {
  [K in keyof T]: T[K];
};
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & {
  [SubKey in K]?: Maybe<T[SubKey]>;
};
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & {
  [SubKey in K]: Maybe<T[SubKey]>;
};
export type MakeEmpty<
  T extends { [key: string]: unknown },
  K extends keyof T,
> = { [_ in K]?: never };
export type Incremental<T> =
  | T
  | {
      [P in keyof T]?: P extends " $fragmentName" | "__typename" ? T[P] : never;
    };
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string };
  String: { input: string; output: string };
  Boolean: { input: boolean; output: boolean };
  Int: { input: number; output: number };
  Float: { input: number; output: number };
  Address: { input: `${string}:0x${string}`; output: `${string}:0x${string}` };
  Amount: {
    input: { unit?: string; value?: number };
    output: { unit?: string; value?: number };
  };
  Amount_Crypto: {
    input: { unit: string; value: string };
    output: { unit: string; value: string };
  };
  Amount_Currency: {
    input: { unit: string; value: string };
    output: { unit: string; value: string };
  };
  Amount_Fiat: {
    input: { unit: string; value: number };
    output: { unit: string; value: number };
  };
  Amount_Money: { input: number; output: number };
  Amount_Percentage: { input: number; output: number };
  Amount_Tokens: { input: number; output: number };
  AttachmentRef: {
    input: `attachment://v${number}:${string}`;
    output: `attachment://v${number}:${string}`;
  };
  Currency: { input: string; output: string };
  Date: { input: string; output: string };
  DateTime: { input: string; output: string };
  EmailAddress: { input: string; output: string };
  EthereumAddress: { input: string; output: string };
  OID: { input: string; output: string };
  OLabel: { input: string; output: string };
  PHID: { input: string; output: string };
  URL: { input: string; output: string };
  Unknown: { input: unknown; output: unknown };
  Upload: { input: File; output: File };
};

export type AddAttachmentInput = {
  addedAt: Scalars["DateTime"]["input"];
  documentId?: InputMaybe<Scalars["PHID"]["input"]>;
  fileName: Scalars["String"]["input"];
  id: Scalars["OID"]["input"];
  itemId?: InputMaybe<Scalars["OID"]["input"]>;
  mimeType?: InputMaybe<Scalars["String"]["input"]>;
  ref?: InputMaybe<Scalars["String"]["input"]>;
  role: TripAttachmentRole;
  sizeBytes?: InputMaybe<Scalars["Int"]["input"]>;
};

export type AddDestinationInput = {
  arriveOn?: InputMaybe<Scalars["Date"]["input"]>;
  city: Scalars["String"]["input"];
  country?: InputMaybe<Scalars["String"]["input"]>;
  id: Scalars["OID"]["input"];
  leaveOn?: InputMaybe<Scalars["Date"]["input"]>;
};

export type AddExtraInput = {
  amount?: InputMaybe<Scalars["Float"]["input"]>;
  at?: InputMaybe<Scalars["DateTime"]["input"]>;
  converted?: InputMaybe<Scalars["Float"]["input"]>;
  currency?: InputMaybe<Scalars["String"]["input"]>;
  description: Scalars["String"]["input"];
  id: Scalars["OID"]["input"];
  invoiceId?: InputMaybe<Scalars["PHID"]["input"]>;
  invoiceLineId?: InputMaybe<Scalars["OID"]["input"]>;
  invoiceNumber?: InputMaybe<Scalars["String"]["input"]>;
  kind: TripExtraKind;
  note?: InputMaybe<Scalars["String"]["input"]>;
};

export type AddMealInput = {
  amount?: InputMaybe<Scalars["Float"]["input"]>;
  at?: InputMaybe<Scalars["DateTime"]["input"]>;
  attendees?: InputMaybe<Scalars["String"]["input"]>;
  converted?: InputMaybe<Scalars["Float"]["input"]>;
  currency?: InputMaybe<Scalars["String"]["input"]>;
  id: Scalars["OID"]["input"];
  invoiceId?: InputMaybe<Scalars["PHID"]["input"]>;
  invoiceLineId?: InputMaybe<Scalars["OID"]["input"]>;
  invoiceNumber?: InputMaybe<Scalars["String"]["input"]>;
  kind: TripMealKind;
  note?: InputMaybe<Scalars["String"]["input"]>;
  venue?: InputMaybe<Scalars["String"]["input"]>;
};

export type AddSourceInput = {
  at?: InputMaybe<Scalars["DateTime"]["input"]>;
  documentId?: InputMaybe<Scalars["PHID"]["input"]>;
  id: Scalars["OID"]["input"];
  kind: TripSourceKind;
  label?: InputMaybe<Scalars["String"]["input"]>;
  lineId?: InputMaybe<Scalars["OID"]["input"]>;
};

export type AddStayInput = {
  address?: InputMaybe<Scalars["String"]["input"]>;
  amount?: InputMaybe<Scalars["Float"]["input"]>;
  bookedVia?: InputMaybe<Scalars["String"]["input"]>;
  bookingReference?: InputMaybe<Scalars["String"]["input"]>;
  checkIn?: InputMaybe<Scalars["Date"]["input"]>;
  checkOut?: InputMaybe<Scalars["Date"]["input"]>;
  city?: InputMaybe<Scalars["String"]["input"]>;
  converted?: InputMaybe<Scalars["Float"]["input"]>;
  currency?: InputMaybe<Scalars["String"]["input"]>;
  id: Scalars["OID"]["input"];
  invoiceId?: InputMaybe<Scalars["PHID"]["input"]>;
  invoiceLineId?: InputMaybe<Scalars["OID"]["input"]>;
  invoiceNumber?: InputMaybe<Scalars["String"]["input"]>;
  name: Scalars["String"]["input"];
  note?: InputMaybe<Scalars["String"]["input"]>;
};

export type AddTransportInput = {
  amount?: InputMaybe<Scalars["Float"]["input"]>;
  arriveAt?: InputMaybe<Scalars["DateTime"]["input"]>;
  bookingReference?: InputMaybe<Scalars["String"]["input"]>;
  carrier?: InputMaybe<Scalars["String"]["input"]>;
  converted?: InputMaybe<Scalars["Float"]["input"]>;
  currency?: InputMaybe<Scalars["String"]["input"]>;
  departAt?: InputMaybe<Scalars["DateTime"]["input"]>;
  from?: InputMaybe<Scalars["String"]["input"]>;
  id: Scalars["OID"]["input"];
  invoiceId?: InputMaybe<Scalars["PHID"]["input"]>;
  invoiceLineId?: InputMaybe<Scalars["OID"]["input"]>;
  invoiceNumber?: InputMaybe<Scalars["String"]["input"]>;
  mode: TripTransportMode;
  note?: InputMaybe<Scalars["String"]["input"]>;
  number?: InputMaybe<Scalars["String"]["input"]>;
  seat?: InputMaybe<Scalars["String"]["input"]>;
  to?: InputMaybe<Scalars["String"]["input"]>;
};

export type RemoveAttachmentInput = {
  id: Scalars["OID"]["input"];
};

export type RemoveDestinationInput = {
  id: Scalars["OID"]["input"];
};

export type RemoveExtraInput = {
  id: Scalars["OID"]["input"];
};

export type RemoveMealInput = {
  id: Scalars["OID"]["input"];
};

export type RemoveSourceInput = {
  id: Scalars["OID"]["input"];
};

export type RemoveStayInput = {
  id: Scalars["OID"]["input"];
};

export type RemoveTransportInput = {
  id: Scalars["OID"]["input"];
};

export type SetBillingInput = {
  billable: Scalars["Boolean"]["input"];
  customerId?: InputMaybe<Scalars["PHID"]["input"]>;
  customerName?: InputMaybe<Scalars["String"]["input"]>;
};

export type SetDetailsInput = {
  currency?: InputMaybe<Scalars["String"]["input"]>;
  endDate?: InputMaybe<Scalars["Date"]["input"]>;
  notes?: InputMaybe<Scalars["String"]["input"]>;
  purpose?: InputMaybe<Scalars["String"]["input"]>;
  purposeKind?: InputMaybe<TripPurposeKind>;
  startDate?: InputMaybe<Scalars["Date"]["input"]>;
  title?: InputMaybe<Scalars["String"]["input"]>;
};

export type SetStatusInput = {
  status: TripStatus;
};

export type SetTravelerInput = {
  email?: InputMaybe<Scalars["String"]["input"]>;
  name?: InputMaybe<Scalars["String"]["input"]>;
};

export type TripAttachment = {
  addedAt: Scalars["DateTime"]["output"];
  /** The document it is kept in: an email or a File */
  documentId: Maybe<Scalars["PHID"]["output"]>;
  fileName: Scalars["String"]["output"];
  id: Scalars["OID"]["output"];
  /** The transport leg, stay, meal or extra it belongs to; none for the trip as a whole */
  itemId: Maybe<Scalars["OID"]["output"]>;
  mimeType: Maybe<Scalars["String"]["output"]>;
  ref: Maybe<Scalars["String"]["output"]>;
  role: TripAttachmentRole;
  sizeBytes: Maybe<Scalars["Int"]["output"]>;
};

export type TripAttachmentRole =
  | "BOOKING"
  | "INVOICE"
  | "ITINERARY"
  | "OTHER"
  | "RECEIPT"
  | "TICKET";

export type TripBilling = {
  billable: Scalars["Boolean"]["output"];
  customerId: Maybe<Scalars["PHID"]["output"]>;
  customerName: Maybe<Scalars["String"]["output"]>;
};

/** A cost, in the currency it was paid in and in the trip's currency */
export type TripCost = {
  amount: Scalars["Float"]["output"];
  /** The amount in the trip's currency, when it differs */
  converted: Maybe<Scalars["Float"]["output"]>;
  currency: Scalars["String"]["output"];
};

export type TripDestination = {
  arriveOn: Maybe<Scalars["Date"]["output"]>;
  city: Scalars["String"]["output"];
  /** ISO 3166-1 alpha-2 */
  country: Maybe<Scalars["String"]["output"]>;
  id: Scalars["OID"]["output"];
  leaveOn: Maybe<Scalars["Date"]["output"]>;
};

export type TripExtra = {
  at: Maybe<Scalars["DateTime"]["output"]>;
  cost: Maybe<TripCost>;
  description: Scalars["String"]["output"];
  id: Scalars["OID"]["output"];
  invoice: Maybe<TripInvoiceLink>;
  kind: TripExtraKind;
  note: Maybe<Scalars["String"]["output"]>;
};

export type TripExtraKind =
  | "CONNECTIVITY"
  | "COWORKING"
  | "EVENT_TICKET"
  | "INSURANCE"
  | "OTHER"
  | "SUPPLIES"
  | "VISA";

/** The invoice line a cost was billed on with */
export type TripInvoiceLink = {
  invoiceId: Scalars["PHID"]["output"];
  lineId: Maybe<Scalars["OID"]["output"]>;
  number: Maybe<Scalars["String"]["output"]>;
};

export type TripMeal = {
  at: Maybe<Scalars["DateTime"]["output"]>;
  /** With whom: a client dinner, the team */
  attendees: Maybe<Scalars["String"]["output"]>;
  cost: Maybe<TripCost>;
  id: Scalars["OID"]["output"];
  invoice: Maybe<TripInvoiceLink>;
  kind: TripMealKind;
  note: Maybe<Scalars["String"]["output"]>;
  venue: Maybe<Scalars["String"]["output"]>;
};

export type TripMealKind =
  | "BREAKFAST"
  | "COFFEE"
  | "DINNER"
  | "DRINKS"
  | "LUNCH"
  | "OTHER"
  | "SNACK";

export type TripPurposeKind =
  | "CLIENT_VISIT"
  | "CONFERENCE"
  | "OFFSITE"
  | "OTHER"
  | "SALES"
  | "TRAINING"
  | "WORKSHOP";

export type TripSource = {
  at: Maybe<Scalars["DateTime"]["output"]>;
  documentId: Maybe<Scalars["PHID"]["output"]>;
  id: Scalars["OID"]["output"];
  kind: TripSourceKind;
  label: Maybe<Scalars["String"]["output"]>;
  lineId: Maybe<Scalars["OID"]["output"]>;
};

export type TripSourceKind =
  | "CALENDAR"
  | "EMAIL"
  | "FILE"
  | "INVOICE_LINE"
  | "MANUAL";

export type TripState = {
  attachments: Array<TripAttachment>;
  /** Who pays: the customer the costs are billed on to */
  billing: Maybe<TripBilling>;
  /** The currency the trip is reported in */
  currency: Scalars["String"]["output"];
  destinations: Array<TripDestination>;
  endDate: Maybe<Scalars["Date"]["output"]>;
  extras: Array<TripExtra>;
  meals: Array<TripMeal>;
  notes: Maybe<Scalars["String"]["output"]>;
  /** Why the trip is made: the meeting, the event, the client */
  purpose: Maybe<Scalars["String"]["output"]>;
  purposeKind: Maybe<TripPurposeKind>;
  /** Where what is known about the trip came from: mails, invoice lines, files */
  sources: Array<TripSource>;
  /** The first and last day away */
  startDate: Maybe<Scalars["Date"]["output"]>;
  status: TripStatus;
  stays: Array<TripStay>;
  /** What the trip is called, e.g. Copenhagen – Sky offsite */
  title: Maybe<Scalars["String"]["output"]>;
  transport: Array<TripTransport>;
  traveler: Maybe<TripTraveler>;
};

export type TripStatus = "BOOKED" | "CANCELLED" | "COMPLETED" | "PLANNED";

export type TripStay = {
  address: Maybe<Scalars["String"]["output"]>;
  /** Through whom it was booked: Booking.com, Airbnb, the hotel */
  bookedVia: Maybe<Scalars["String"]["output"]>;
  bookingReference: Maybe<Scalars["String"]["output"]>;
  checkIn: Maybe<Scalars["Date"]["output"]>;
  checkOut: Maybe<Scalars["Date"]["output"]>;
  city: Maybe<Scalars["String"]["output"]>;
  cost: Maybe<TripCost>;
  id: Scalars["OID"]["output"];
  invoice: Maybe<TripInvoiceLink>;
  name: Scalars["String"]["output"];
  note: Maybe<Scalars["String"]["output"]>;
};

export type TripTransport = {
  arriveAt: Maybe<Scalars["DateTime"]["output"]>;
  /** The booking or PNR code */
  bookingReference: Maybe<Scalars["String"]["output"]>;
  /** The airline, the railway, the taxi company */
  carrier: Maybe<Scalars["String"]["output"]>;
  cost: Maybe<TripCost>;
  departAt: Maybe<Scalars["DateTime"]["output"]>;
  from: Maybe<Scalars["String"]["output"]>;
  id: Scalars["OID"]["output"];
  invoice: Maybe<TripInvoiceLink>;
  mode: TripTransportMode;
  note: Maybe<Scalars["String"]["output"]>;
  /** The flight or train number */
  number: Maybe<Scalars["String"]["output"]>;
  seat: Maybe<Scalars["String"]["output"]>;
  to: Maybe<Scalars["String"]["output"]>;
};

export type TripTransportMode =
  | "BUS"
  | "CAR"
  | "FERRY"
  | "FLIGHT"
  | "OTHER"
  | "PARKING"
  | "PUBLIC_TRANSPORT"
  | "RIDE_HAIL"
  | "TAXI"
  | "TRAIN";

export type TripTraveler = {
  email: Maybe<Scalars["String"]["output"]>;
  name: Maybe<Scalars["String"]["output"]>;
};

export type UpdateDestinationInput = {
  arriveOn?: InputMaybe<Scalars["Date"]["input"]>;
  city?: InputMaybe<Scalars["String"]["input"]>;
  country?: InputMaybe<Scalars["String"]["input"]>;
  id: Scalars["OID"]["input"];
  leaveOn?: InputMaybe<Scalars["Date"]["input"]>;
};

export type UpdateExtraInput = {
  amount?: InputMaybe<Scalars["Float"]["input"]>;
  at?: InputMaybe<Scalars["DateTime"]["input"]>;
  converted?: InputMaybe<Scalars["Float"]["input"]>;
  currency?: InputMaybe<Scalars["String"]["input"]>;
  description?: InputMaybe<Scalars["String"]["input"]>;
  id: Scalars["OID"]["input"];
  invoiceId?: InputMaybe<Scalars["PHID"]["input"]>;
  invoiceLineId?: InputMaybe<Scalars["OID"]["input"]>;
  invoiceNumber?: InputMaybe<Scalars["String"]["input"]>;
  kind?: InputMaybe<TripExtraKind>;
  note?: InputMaybe<Scalars["String"]["input"]>;
};

export type UpdateMealInput = {
  amount?: InputMaybe<Scalars["Float"]["input"]>;
  at?: InputMaybe<Scalars["DateTime"]["input"]>;
  attendees?: InputMaybe<Scalars["String"]["input"]>;
  converted?: InputMaybe<Scalars["Float"]["input"]>;
  currency?: InputMaybe<Scalars["String"]["input"]>;
  id: Scalars["OID"]["input"];
  invoiceId?: InputMaybe<Scalars["PHID"]["input"]>;
  invoiceLineId?: InputMaybe<Scalars["OID"]["input"]>;
  invoiceNumber?: InputMaybe<Scalars["String"]["input"]>;
  kind?: InputMaybe<TripMealKind>;
  note?: InputMaybe<Scalars["String"]["input"]>;
  venue?: InputMaybe<Scalars["String"]["input"]>;
};

export type UpdateStayInput = {
  address?: InputMaybe<Scalars["String"]["input"]>;
  amount?: InputMaybe<Scalars["Float"]["input"]>;
  bookedVia?: InputMaybe<Scalars["String"]["input"]>;
  bookingReference?: InputMaybe<Scalars["String"]["input"]>;
  checkIn?: InputMaybe<Scalars["Date"]["input"]>;
  checkOut?: InputMaybe<Scalars["Date"]["input"]>;
  city?: InputMaybe<Scalars["String"]["input"]>;
  converted?: InputMaybe<Scalars["Float"]["input"]>;
  currency?: InputMaybe<Scalars["String"]["input"]>;
  id: Scalars["OID"]["input"];
  invoiceId?: InputMaybe<Scalars["PHID"]["input"]>;
  invoiceLineId?: InputMaybe<Scalars["OID"]["input"]>;
  invoiceNumber?: InputMaybe<Scalars["String"]["input"]>;
  name?: InputMaybe<Scalars["String"]["input"]>;
  note?: InputMaybe<Scalars["String"]["input"]>;
};

export type UpdateTransportInput = {
  amount?: InputMaybe<Scalars["Float"]["input"]>;
  arriveAt?: InputMaybe<Scalars["DateTime"]["input"]>;
  bookingReference?: InputMaybe<Scalars["String"]["input"]>;
  carrier?: InputMaybe<Scalars["String"]["input"]>;
  converted?: InputMaybe<Scalars["Float"]["input"]>;
  currency?: InputMaybe<Scalars["String"]["input"]>;
  departAt?: InputMaybe<Scalars["DateTime"]["input"]>;
  from?: InputMaybe<Scalars["String"]["input"]>;
  id: Scalars["OID"]["input"];
  invoiceId?: InputMaybe<Scalars["PHID"]["input"]>;
  invoiceLineId?: InputMaybe<Scalars["OID"]["input"]>;
  invoiceNumber?: InputMaybe<Scalars["String"]["input"]>;
  mode?: InputMaybe<TripTransportMode>;
  note?: InputMaybe<Scalars["String"]["input"]>;
  number?: InputMaybe<Scalars["String"]["input"]>;
  seat?: InputMaybe<Scalars["String"]["input"]>;
  to?: InputMaybe<Scalars["String"]["input"]>;
};
