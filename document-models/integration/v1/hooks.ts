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
  IntegrationAction,
  IntegrationDocument,
} from "document-models/integration/v1";
import {
  assertIsIntegrationDocument,
  isIntegrationDocument,
} from "./gen/document-schema.js";

/** Hook to get a Integration document by its id */
export function useIntegrationDocumentById(
  documentId: string | null | undefined,
):
  | [IntegrationDocument, DocumentDispatch<IntegrationAction>]
  | [undefined, undefined] {
  const [document, dispatch] = useDocumentById(documentId);
  if (!isIntegrationDocument(document)) return [undefined, undefined];
  return [document, dispatch];
}

/** Hook to get the selected Integration document */
export function useSelectedIntegrationDocument(): [
  IntegrationDocument,
  DocumentDispatch<IntegrationAction>,
] {
  const [document, dispatch] = useSelectedDocument();

  assertIsIntegrationDocument(document);
  return [document, dispatch] as const;
}

/** Hook to get all Integration documents in the selected drive */
export function useIntegrationDocumentsInSelectedDrive() {
  const documentsInSelectedDrive = useDocumentsInSelectedDrive();
  return documentsInSelectedDrive?.filter(isIntegrationDocument);
}

/** Hook to get all Integration documents in the selected folder */
export function useIntegrationDocumentsInSelectedFolder() {
  const documentsInSelectedFolder = useDocumentsInSelectedFolder();
  return documentsInSelectedFolder?.filter(isIntegrationDocument);
}
