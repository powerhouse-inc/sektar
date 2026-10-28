import type { CalendarEventCaptureOperations } from "document-models/calendar-event/v1";
import { OtherEventError } from "../../gen/capture/error.js";

export const calendarEventCaptureOperations: CalendarEventCaptureOperations = {
  captureEventOperation(state, action) {
    const i = action.input;
    if (state.externalId && state.externalId !== i.externalId)
      throw new OtherEventError(
        `This document is ${state.externalId}, not ${i.externalId}`,
      );
    const time = (
      t:
        | { at?: string | null; date?: string | null; timeZone?: string | null }
        | null
        | undefined,
    ) =>
      t
        ? {
            at: t.at ?? null,
            date: t.date ?? null,
            timeZone: t.timeZone ?? null,
          }
        : null;
    state.externalId = i.externalId;
    state.uid = i.uid ?? null;
    state.recurrenceId = i.recurrenceId ?? null;
    state.calendar = i.calendar
      ? {
          id: i.calendar.id,
          name: i.calendar.name ?? null,
          account: i.calendar.account ?? null,
        }
      : null;
    state.source = i.source;
    state.sourceId = i.sourceId ?? null;
    state.sourceUrl = i.sourceUrl ?? null;
    state.summary = i.summary ?? null;
    state.description = i.description ?? null;
    state.location = i.location ?? null;
    state.meetingUrl = i.meetingUrl ?? null;
    state.start = time(i.start);
    state.end = time(i.end);
    state.allDay = i.allDay;
    state.status = i.status;
    state.busy = i.busy ?? true;
    state.organizer = i.organizer
      ? { email: i.organizer.email ?? null, name: i.organizer.name ?? null }
      : null;
    const seen = new Set();
    state.attendees = (i.attendees ?? []).flatMap((a) => {
      const key = a.email.trim().toLowerCase();
      if (!key || seen.has(key)) return [];
      seen.add(key);
      return [
        {
          id: key,
          email: a.email.trim(),
          name: a.name ?? null,
          response: a.response,
          optional: a.optional ?? false,
          organizer: a.organizer ?? false,
          self: a.self ?? false,
        },
      ];
    });
    state.recurrence = i.recurrence ?? [];
    state.sourceUpdatedAt = i.sourceUpdatedAt ?? null;
    state.capturedAt = i.capturedAt;
  },
};
