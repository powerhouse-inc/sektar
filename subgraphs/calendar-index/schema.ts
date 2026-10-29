import type { DocumentNode } from "graphql";
import { gql } from "graphql-tag";

export const schema: DocumentNode = gql`
  """
  One calendar event as the week reads it. Lean on purpose: the attendees
  and the description stay on the document, which is loaded only when the
  event is opened.
  """
  type CalendarEventRow {
    id: String!
    """<account>|<calendar id>: the calendar the event is on"""
    calendarKey: String!
    calendarId: String
    calendarAccount: String
    calendarName: String
    """The calendar's name, else its account, else its id"""
    calendarLabel: String!
    title: String
    location: String
    meetingUrl: String
    """The first start, an ISO instant (a whole-day event's date at UTC midnight)"""
    startAt: String
    """The end, exclusive, on the same terms"""
    endAt: String
    """A whole-day event's own dates, yyyy-mm-dd, the end exclusive"""
    startDate: String
    endDate: String
    """The zone the event was planned in"""
    timeZone: String
    allDay: Boolean!
    busy: Boolean!
    """Tentative, or the account has not said yes"""
    tentative: Boolean!
    """CONFIRMED | TENTATIVE | CANCELLED"""
    status: String!
    """A series the week expands"""
    repeats: Boolean!
    """The RRULE, EXDATE and RDATE lines"""
    recurrence: [String!]!
    """For a changed occurrence: the original start it replaces"""
    recurrenceId: String
    uid: String
    """<calendarKey>|<uid>: a series and its changed occurrences share it"""
    seriesId: String
    """An instant no occurrence of the series ends after; null when it never ends"""
    seriesEnd: String
    organizerName: String
    organizerEmail: String
    updatedAt: String!
  }

  type CalendarSummary {
    key: String!
    label: String!
    """Events on this calendar (a series counts once)"""
    events: Int!
  }

  type CalendarIndexQueries {
    """
    The events that can show in [from, to) (ISO instants): one-off events
    and changed occurrences that overlap it, every series that starts before
    \`to\` and does not end before \`from\`, and every changed occurrence of
    those series. The caller expands the series. Whole-day dates read as UTC
    midnight: widen the range by a day for a local week.
    """
    events(driveId: String!, from: String!, to: String!): [CalendarEventRow!]!

    """Every calendar in the drive, with how many events it holds."""
    calendars(driveId: String!): [CalendarSummary!]!
  }

  type Query {
    calendarIndex: CalendarIndexQueries!
  }
`;
