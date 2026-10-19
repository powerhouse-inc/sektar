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
  OriginalSourceCollectionAction,
  OriginalSourceCollectionDocument,
} from "document-models/original-source-collection/v1";
import {
  assertIsOriginalSourceCollectionDocument,
  isOriginalSourceCollectionDocument,
} from "./gen/document-schema.js";

/** Hook to get a OriginalSourceCollection document by its id */
export function useOriginalSourceCollectionDocumentById(
  documentId: string | null | undefined,
):
  | [
      OriginalSourceCollectionDocument,
      DocumentDispatch<OriginalSourceCollectionAction>,
    ]
  | [undefined, undefined] {
  const [document, dispatch] = useDocumentById(documentId);
  if (!isOriginalSourceCollectionDocument(document))
    return [undefined, undefined];
  return [document, dispatch];
}

/** Hook to get the selected OriginalSourceCollection document */
export function useSelectedOriginalSourceCollectionDocument(): [
  OriginalSourceCollectionDocument,
  DocumentDispatch<OriginalSourceCollectionAction>,
] {
  const [document, dispatch] = useSelectedDocument();

  assertIsOriginalSourceCollectionDocument(document);
  return [document, dispatch] as const;
}

/** Hook to get all OriginalSourceCollection documents in the selected drive */
export function useOriginalSourceCollectionDocumentsInSelectedDrive() {
  const documentsInSelectedDrive = useDocumentsInSelectedDrive();
  return documentsInSelectedDrive?.filter(isOriginalSourceCollectionDocument);
}

/** Hook to get all OriginalSourceCollection documents in the selected folder */
export function useOriginalSourceCollectionDocumentsInSelectedFolder() {
  const documentsInSelectedFolder = useDocumentsInSelectedFolder();
  return documentsInSelectedFolder?.filter(isOriginalSourceCollectionDocument);
}
