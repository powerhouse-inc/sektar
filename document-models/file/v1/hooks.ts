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
import type { FileAction, FileDocument } from "document-models/file/v1";
import { assertIsFileDocument, isFileDocument } from "./gen/document-schema.js";

/** Hook to get a File document by its id */
export function useFileDocumentById(
  documentId: string | null | undefined,
): [FileDocument, DocumentDispatch<FileAction>] | [undefined, undefined] {
  const [document, dispatch] = useDocumentById(documentId);
  if (!isFileDocument(document)) return [undefined, undefined];
  return [document, dispatch];
}

/** Hook to get the selected File document */
export function useSelectedFileDocument(): [
  FileDocument,
  DocumentDispatch<FileAction>,
] {
  const [document, dispatch] = useSelectedDocument();

  assertIsFileDocument(document);
  return [document, dispatch] as const;
}

/** Hook to get all File documents in the selected drive */
export function useFileDocumentsInSelectedDrive() {
  const documentsInSelectedDrive = useDocumentsInSelectedDrive();
  return documentsInSelectedDrive?.filter(isFileDocument);
}

/** Hook to get all File documents in the selected folder */
export function useFileDocumentsInSelectedFolder() {
  const documentsInSelectedFolder = useDocumentsInSelectedFolder();
  return documentsInSelectedFolder?.filter(isFileDocument);
}
