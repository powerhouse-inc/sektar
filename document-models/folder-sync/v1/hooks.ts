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
  FolderSyncAction,
  FolderSyncDocument,
} from "document-models/folder-sync/v1";
import {
  assertIsFolderSyncDocument,
  isFolderSyncDocument,
} from "./gen/document-schema.js";

/** Hook to get a FolderSync document by its id */
export function useFolderSyncDocumentById(
  documentId: string | null | undefined,
):
  | [FolderSyncDocument, DocumentDispatch<FolderSyncAction>]
  | [undefined, undefined] {
  const [document, dispatch] = useDocumentById(documentId);
  if (!isFolderSyncDocument(document)) return [undefined, undefined];
  return [document, dispatch];
}

/** Hook to get the selected FolderSync document */
export function useSelectedFolderSyncDocument(): [
  FolderSyncDocument,
  DocumentDispatch<FolderSyncAction>,
] {
  const [document, dispatch] = useSelectedDocument();

  assertIsFolderSyncDocument(document);
  return [document, dispatch] as const;
}

/** Hook to get all FolderSync documents in the selected drive */
export function useFolderSyncDocumentsInSelectedDrive() {
  const documentsInSelectedDrive = useDocumentsInSelectedDrive();
  return documentsInSelectedDrive?.filter(isFolderSyncDocument);
}

/** Hook to get all FolderSync documents in the selected folder */
export function useFolderSyncDocumentsInSelectedFolder() {
  const documentsInSelectedFolder = useDocumentsInSelectedFolder();
  return documentsInSelectedFolder?.filter(isFolderSyncDocument);
}
