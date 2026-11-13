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
  BooksSettingsAction,
  BooksSettingsDocument,
} from "document-models/books-settings/v1";
import {
  assertIsBooksSettingsDocument,
  isBooksSettingsDocument,
} from "./gen/document-schema.js";

/** Hook to get a BooksSettings document by its id */
export function useBooksSettingsDocumentById(
  documentId: string | null | undefined,
):
  | [BooksSettingsDocument, DocumentDispatch<BooksSettingsAction>]
  | [undefined, undefined] {
  const [document, dispatch] = useDocumentById(documentId);
  if (!isBooksSettingsDocument(document)) return [undefined, undefined];
  return [document, dispatch];
}

/** Hook to get the selected BooksSettings document */
export function useSelectedBooksSettingsDocument(): [
  BooksSettingsDocument,
  DocumentDispatch<BooksSettingsAction>,
] {
  const [document, dispatch] = useSelectedDocument();

  assertIsBooksSettingsDocument(document);
  return [document, dispatch] as const;
}

/** Hook to get all BooksSettings documents in the selected drive */
export function useBooksSettingsDocumentsInSelectedDrive() {
  const documentsInSelectedDrive = useDocumentsInSelectedDrive();
  return documentsInSelectedDrive?.filter(isBooksSettingsDocument);
}

/** Hook to get all BooksSettings documents in the selected folder */
export function useBooksSettingsDocumentsInSelectedFolder() {
  const documentsInSelectedFolder = useDocumentsInSelectedFolder();
  return documentsInSelectedFolder?.filter(isBooksSettingsDocument);
}
