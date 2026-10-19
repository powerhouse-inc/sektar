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
import type { EmailAction, EmailDocument } from "document-models/email/v1";
import {
  assertIsEmailDocument,
  isEmailDocument,
} from "./gen/document-schema.js";

/** Hook to get a Email document by its id */
export function useEmailDocumentById(
  documentId: string | null | undefined,
): [EmailDocument, DocumentDispatch<EmailAction>] | [undefined, undefined] {
  const [document, dispatch] = useDocumentById(documentId);
  if (!isEmailDocument(document)) return [undefined, undefined];
  return [document, dispatch];
}

/** Hook to get the selected Email document */
export function useSelectedEmailDocument(): [
  EmailDocument,
  DocumentDispatch<EmailAction>,
] {
  const [document, dispatch] = useSelectedDocument();

  assertIsEmailDocument(document);
  return [document, dispatch] as const;
}

/** Hook to get all Email documents in the selected drive */
export function useEmailDocumentsInSelectedDrive() {
  const documentsInSelectedDrive = useDocumentsInSelectedDrive();
  return documentsInSelectedDrive?.filter(isEmailDocument);
}

/** Hook to get all Email documents in the selected folder */
export function useEmailDocumentsInSelectedFolder() {
  const documentsInSelectedFolder = useDocumentsInSelectedFolder();
  return documentsInSelectedFolder?.filter(isEmailDocument);
}
