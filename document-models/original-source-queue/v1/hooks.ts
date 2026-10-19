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
  OriginalSourceQueueAction,
  OriginalSourceQueueDocument,
} from "document-models/original-source-queue/v1";
import {
  assertIsOriginalSourceQueueDocument,
  isOriginalSourceQueueDocument,
} from "./gen/document-schema.js";

/** Hook to get a OriginalSourceQueue document by its id */
export function useOriginalSourceQueueDocumentById(
  documentId: string | null | undefined,
):
  | [OriginalSourceQueueDocument, DocumentDispatch<OriginalSourceQueueAction>]
  | [undefined, undefined] {
  const [document, dispatch] = useDocumentById(documentId);
  if (!isOriginalSourceQueueDocument(document)) return [undefined, undefined];
  return [document, dispatch];
}

/** Hook to get the selected OriginalSourceQueue document */
export function useSelectedOriginalSourceQueueDocument(): [
  OriginalSourceQueueDocument,
  DocumentDispatch<OriginalSourceQueueAction>,
] {
  const [document, dispatch] = useSelectedDocument();

  assertIsOriginalSourceQueueDocument(document);
  return [document, dispatch] as const;
}

/** Hook to get all OriginalSourceQueue documents in the selected drive */
export function useOriginalSourceQueueDocumentsInSelectedDrive() {
  const documentsInSelectedDrive = useDocumentsInSelectedDrive();
  return documentsInSelectedDrive?.filter(isOriginalSourceQueueDocument);
}

/** Hook to get all OriginalSourceQueue documents in the selected folder */
export function useOriginalSourceQueueDocumentsInSelectedFolder() {
  const documentsInSelectedFolder = useDocumentsInSelectedFolder();
  return documentsInSelectedFolder?.filter(isOriginalSourceQueueDocument);
}
