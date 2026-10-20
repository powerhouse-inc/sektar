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
import type { TripAction, TripDocument } from "document-models/trip/v1";
import { assertIsTripDocument, isTripDocument } from "./gen/document-schema.js";

/** Hook to get a Trip document by its id */
export function useTripDocumentById(
  documentId: string | null | undefined,
): [TripDocument, DocumentDispatch<TripAction>] | [undefined, undefined] {
  const [document, dispatch] = useDocumentById(documentId);
  if (!isTripDocument(document)) return [undefined, undefined];
  return [document, dispatch];
}

/** Hook to get the selected Trip document */
export function useSelectedTripDocument(): [
  TripDocument,
  DocumentDispatch<TripAction>,
] {
  const [document, dispatch] = useSelectedDocument();

  assertIsTripDocument(document);
  return [document, dispatch] as const;
}

/** Hook to get all Trip documents in the selected drive */
export function useTripDocumentsInSelectedDrive() {
  const documentsInSelectedDrive = useDocumentsInSelectedDrive();
  return documentsInSelectedDrive?.filter(isTripDocument);
}

/** Hook to get all Trip documents in the selected folder */
export function useTripDocumentsInSelectedFolder() {
  const documentsInSelectedFolder = useDocumentsInSelectedFolder();
  return documentsInSelectedFolder?.filter(isTripDocument);
}
