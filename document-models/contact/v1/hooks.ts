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
  ContactAction,
  ContactDocument,
} from "document-models/contact/v1";
import {
  assertIsContactDocument,
  isContactDocument,
} from "./gen/document-schema.js";

/** Hook to get a Contact document by its id */
export function useContactDocumentById(
  documentId: string | null | undefined,
): [ContactDocument, DocumentDispatch<ContactAction>] | [undefined, undefined] {
  const [document, dispatch] = useDocumentById(documentId);
  if (!isContactDocument(document)) return [undefined, undefined];
  return [document, dispatch];
}

/** Hook to get the selected Contact document */
export function useSelectedContactDocument(): [
  ContactDocument,
  DocumentDispatch<ContactAction>,
] {
  const [document, dispatch] = useSelectedDocument();

  assertIsContactDocument(document);
  return [document, dispatch] as const;
}

/** Hook to get all Contact documents in the selected drive */
export function useContactDocumentsInSelectedDrive() {
  const documentsInSelectedDrive = useDocumentsInSelectedDrive();
  return documentsInSelectedDrive?.filter(isContactDocument);
}

/** Hook to get all Contact documents in the selected folder */
export function useContactDocumentsInSelectedFolder() {
  const documentsInSelectedFolder = useDocumentsInSelectedFolder();
  return documentsInSelectedFolder?.filter(isContactDocument);
}
