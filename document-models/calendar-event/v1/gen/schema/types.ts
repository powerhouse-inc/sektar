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

export type CalendarEventAttendee = {
  email: Scalars["String"]["output"];
  /** The address in lower case */
  id: Scalars["OID"]["output"];
  name: Maybe<Scalars["String"]["output"]>;
  optional: Scalars["Boolean"]["output"];
  organizer: Scalars["Boolean"]["output"];
  response: CalendarEventResponse;
  /** The account the calendar belongs to */
  self: Scalars["Boolean"]["output"];
};

export type CalendarEventAttendeeInput = {
  email: Scalars["String"]["input"];
  name?: InputMaybe<Scalars["String"]["input"]>;
  optional?: InputMaybe<Scalars["Boolean"]["input"]>;
  organizer?: InputMaybe<Scalars["Boolean"]["input"]>;
  response: CalendarEventResponse;
  self?: InputMaybe<Scalars["Boolean"]["input"]>;
};

export type CalendarEventCalendar = {
  /** The account the calendar belongs to, e.g. the Google address */
  account: Maybe<Scalars["String"]["output"]>;
  /** The provider's calendar id */
  id: Scalars["String"]["output"];
  name: Maybe<Scalars["String"]["output"]>;
};

export type CalendarEventCalendarInput = {
  account?: InputMaybe<Scalars["String"]["input"]>;
  id: Scalars["String"]["input"];
  name?: InputMaybe<Scalars["String"]["input"]>;
};

export type CalendarEventPerson = {
  email: Maybe<Scalars["String"]["output"]>;
  name: Maybe<Scalars["String"]["output"]>;
};

export type CalendarEventPersonInput = {
  email?: InputMaybe<Scalars["String"]["input"]>;
  name?: InputMaybe<Scalars["String"]["input"]>;
};

export type CalendarEventResponse =
  | "ACCEPTED"
  | "DECLINED"
  | "NEEDS_ACTION"
  | "TENTATIVE";

export type CalendarEventState = {
  /** A whole-day event: start and end are dates, the end exclusive */
  allDay: Scalars["Boolean"]["output"];
  attendees: Array<CalendarEventAttendee>;
  /** Busy or free in the person's availability */
  busy: Scalars["Boolean"]["output"];
  /** The calendar the event is on */
  calendar: Maybe<CalendarEventCalendar>;
  /** When this document last took the provider's version */
  capturedAt: Maybe<Scalars["DateTime"]["output"]>;
  description: Maybe<Scalars["String"]["output"]>;
  end: Maybe<CalendarEventTime>;
  /** The identity imports deduplicate on: cal:<account>:<UID>[:<recurrence-id>] */
  externalId: Maybe<Scalars["String"]["output"]>;
  location: Maybe<Scalars["String"]["output"]>;
  /** A video meeting link (Meet, Zoom, Teams) */
  meetingUrl: Maybe<Scalars["String"]["output"]>;
  organizer: Maybe<CalendarEventPerson>;
  /** How a series repeats: its RRULE, EXDATE and RDATE lines */
  recurrence: Array<Scalars["String"]["output"]>;
  /** For a changed occurrence of a series: the original start it replaces */
  recurrenceId: Maybe<Scalars["String"]["output"]>;
  /** Where it came from: google, microsoft, caldav */
  source: Maybe<Scalars["String"]["output"]>;
  /** The provider's own id of the event */
  sourceId: Maybe<Scalars["String"]["output"]>;
  /** When the provider last changed the event */
  sourceUpdatedAt: Maybe<Scalars["DateTime"]["output"]>;
  /** The event on the provider's site */
  sourceUrl: Maybe<Scalars["String"]["output"]>;
  start: Maybe<CalendarEventTime>;
  status: CalendarEventStatus;
  summary: Maybe<Scalars["String"]["output"]>;
  /** The iCalendar UID (Google: iCalUID) */
  uid: Maybe<Scalars["String"]["output"]>;
};

export type CalendarEventStatus = "CANCELLED" | "CONFIRMED" | "TENTATIVE";

export type CalendarEventTime = {
  /** A moment, for an event with times */
  at: Maybe<Scalars["DateTime"]["output"]>;
  /** A date (yyyy-mm-dd), for a whole-day event: the Date scalar takes a date-time */
  date: Maybe<Scalars["String"]["output"]>;
  /** The zone the event was planned in, e.g. Europe/Brussels */
  timeZone: Maybe<Scalars["String"]["output"]>;
};

export type CalendarEventTimeInput = {
  at?: InputMaybe<Scalars["DateTime"]["input"]>;
  date?: InputMaybe<Scalars["String"]["input"]>;
  timeZone?: InputMaybe<Scalars["String"]["input"]>;
};

export type CaptureEventInput = {
  allDay: Scalars["Boolean"]["input"];
  attendees?: InputMaybe<Array<CalendarEventAttendeeInput>>;
  busy?: InputMaybe<Scalars["Boolean"]["input"]>;
  calendar?: InputMaybe<CalendarEventCalendarInput>;
  capturedAt: Scalars["DateTime"]["input"];
  description?: InputMaybe<Scalars["String"]["input"]>;
  end?: InputMaybe<CalendarEventTimeInput>;
  externalId: Scalars["String"]["input"];
  location?: InputMaybe<Scalars["String"]["input"]>;
  meetingUrl?: InputMaybe<Scalars["String"]["input"]>;
  organizer?: InputMaybe<CalendarEventPersonInput>;
  recurrence?: InputMaybe<Array<Scalars["String"]["input"]>>;
  recurrenceId?: InputMaybe<Scalars["String"]["input"]>;
  source: Scalars["String"]["input"];
  sourceId?: InputMaybe<Scalars["String"]["input"]>;
  sourceUpdatedAt?: InputMaybe<Scalars["DateTime"]["input"]>;
  sourceUrl?: InputMaybe<Scalars["String"]["input"]>;
  start?: InputMaybe<CalendarEventTimeInput>;
  status: CalendarEventStatus;
  summary?: InputMaybe<Scalars["String"]["input"]>;
  uid?: InputMaybe<Scalars["String"]["input"]>;
};
