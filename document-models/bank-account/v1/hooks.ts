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
  BankAccountAction,
  BankAccountDocument,
} from "document-models/bank-account/v1";
import {
  assertIsBankAccountDocument,
  isBankAccountDocument,
} from "./gen/document-schema.js";

/** Hook to get a BankAccount document by its id */
export function useBankAccountDocumentById(
  documentId: string | null | undefined,
):
  | [BankAccountDocument, DocumentDispatch<BankAccountAction>]
  | [undefined, undefined] {
  const [document, dispatch] = useDocumentById(documentId);
  if (!isBankAccountDocument(document)) return [undefined, undefined];
  return [document, dispatch];
}

/** Hook to get the selected BankAccount document */
export function useSelectedBankAccountDocument(): [
  BankAccountDocument,
  DocumentDispatch<BankAccountAction>,
] {
  const [document, dispatch] = useSelectedDocument();

  assertIsBankAccountDocument(document);
  return [document, dispatch] as const;
}

/** Hook to get all BankAccount documents in the selected drive */
export function useBankAccountDocumentsInSelectedDrive() {
  const documentsInSelectedDrive = useDocumentsInSelectedDrive();
  return documentsInSelectedDrive?.filter(isBankAccountDocument);
}

/** Hook to get all BankAccount documents in the selected folder */
export function useBankAccountDocumentsInSelectedFolder() {
  const documentsInSelectedFolder = useDocumentsInSelectedFolder();
  return documentsInSelectedFolder?.filter(isBankAccountDocument);
}
