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
  CurrencyPairAction,
  CurrencyPairDocument,
} from "document-models/currency-pair/v1";
import {
  assertIsCurrencyPairDocument,
  isCurrencyPairDocument,
} from "./gen/document-schema.js";

/** Hook to get a CurrencyPair document by its id */
export function useCurrencyPairDocumentById(
  documentId: string | null | undefined,
):
  | [CurrencyPairDocument, DocumentDispatch<CurrencyPairAction>]
  | [undefined, undefined] {
  const [document, dispatch] = useDocumentById(documentId);
  if (!isCurrencyPairDocument(document)) return [undefined, undefined];
  return [document, dispatch];
}

/** Hook to get the selected CurrencyPair document */
export function useSelectedCurrencyPairDocument(): [
  CurrencyPairDocument,
  DocumentDispatch<CurrencyPairAction>,
] {
  const [document, dispatch] = useSelectedDocument();

  assertIsCurrencyPairDocument(document);
  return [document, dispatch] as const;
}

/** Hook to get all CurrencyPair documents in the selected drive */
export function useCurrencyPairDocumentsInSelectedDrive() {
  const documentsInSelectedDrive = useDocumentsInSelectedDrive();
  return documentsInSelectedDrive?.filter(isCurrencyPairDocument);
}

/** Hook to get all CurrencyPair documents in the selected folder */
export function useCurrencyPairDocumentsInSelectedFolder() {
  const documentsInSelectedFolder = useDocumentsInSelectedFolder();
  return documentsInSelectedFolder?.filter(isCurrencyPairDocument);
}
