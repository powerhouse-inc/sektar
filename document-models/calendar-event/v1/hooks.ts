/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import type { DocumentDispatch } from "@powerhousedao/reactor-browser";
import {
  useDocumentById,
  useDocumentsInSelectedDrive,
  useDocumentsInSelectedFolder,
  useSelectedDocument,
} from "@powerhousedao/reactor-browser";
import type {
  CalendarEventAction,
  CalendarEventDocument,
} from "document-models/calendar-event/v1";
import {
  assertIsCalendarEventDocument,
  isCalendarEventDocument,
} from "./gen/document-schema.js";

/** Hook to get a CalendarEvent document by its id */
export function useCalendarEventDocumentById(
  documentId: string | null | undefined,
):
  | [CalendarEventDocument, DocumentDispatch<CalendarEventAction>]
  | [undefined, undefined] {
  const [document, dispatch] = useDocumentById(documentId);
  if (!isCalendarEventDocument(document)) return [undefined, undefined];
  return [document, dispatch];
}

/** Hook to get the selected CalendarEvent document */
export function useSelectedCalendarEventDocument(): [
  CalendarEventDocument,
  DocumentDispatch<CalendarEventAction>,
] {
  const [document, dispatch] = useSelectedDocument();

  assertIsCalendarEventDocument(document);
  return [document, dispatch] as const;
}

/** Hook to get all CalendarEvent documents in the selected drive */
export function useCalendarEventDocumentsInSelectedDrive() {
  const documentsInSelectedDrive = useDocumentsInSelectedDrive();
  return documentsInSelectedDrive?.filter(isCalendarEventDocument);
}

/** Hook to get all CalendarEvent documents in the selected folder */
export function useCalendarEventDocumentsInSelectedFolder() {
  const documentsInSelectedFolder = useDocumentsInSelectedFolder();
  return documentsInSelectedFolder?.filter(isCalendarEventDocument);
}
