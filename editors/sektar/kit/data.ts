// Reading and writing Sektar's documents. Reads are hooks over the Sektar
// drive; writes are imperative helpers around addDocument/dispatchActions so
// boards, panels, editors and the seed share one vocabulary.
import {
  addDocument,
  addFolder,
  dispatchActions,
  useDocumentsByIds,
  useDrives,
} from "@powerhousedao/reactor-browser";
import type {
  DocumentDriveDocument,
  FileNode,
  FolderNode,
} from "@powerhousedao/shared/document-drive";
import { generateId } from "document-model";
import {
  actions as bankActions,
  isBankAccountDocument,
  type AccountKind,
  type BankAccountDocument,
  type MatchKind,
  type Transaction,
  type TransactionCategory,
} from "document-models/bank-account";
import {
  actions as contactActions,
  isContactDocument,
  type ContactDocument,
  type ContactKind,
} from "document-models/contact";
import {
  actions as expenseActions,
  isExpenseReportDocument,
  type ExpenseReportDocument,
  type PaidWith,
} from "document-models/expense-report";
import {
  actions as invoiceActions,
  isInvoiceDocument,
  type InvoiceDirection,
  type InvoiceDocument,
  type PaymentMethod,
} from "document-models/invoice";
import { useMemo } from "react";

/** The business drive, declared in the host files. */
export const SEKTAR_DRIVE_SLUG = "sektar";

export const DOC_TYPES = {
  account: "sektar/bank-account",
  invoice: "sektar/invoice",
  expense: "sektar/expense-report",
  contact: "sektar/contact",
} as const;

export const FOLDERS = {
  accounts: "Bank & cards",
  invoices: "Invoices",
  expenses: "Expenses",
  contacts: "Contacts",
} as const;

const now = () => new Date().toISOString();

/* ------------------------------------------------------------- reading */

export function useSektarDrive(): DocumentDriveDocument | undefined {
  const drives = useDrives();
  return drives?.find(
    (d) =>
      d.header.slug === SEKTAR_DRIVE_SLUG || d.header.id === SEKTAR_DRIVE_SLUG,
  );
}

export function fileIds(
  drive: DocumentDriveDocument | undefined,
  type: string,
) {
  return (drive?.state.global.nodes ?? [])
    .filter((n): n is FileNode => n.kind === "file")
    .filter((n) => n.documentType === type)
    .map((n) => n.id);
}

/** Stable id list (by content), so subscriptions do not churn per render. */
function useIdsOfType(type: string): string[] {
  const drive = useSektarDrive();
  const key = fileIds(drive, type).join(",");
  return useMemo(() => (key ? key.split(",") : []), [key]);
}

export function useAccounts(): BankAccountDocument[] {
  return useDocumentsByIds(useIdsOfType(DOC_TYPES.account)).filter(
    isBankAccountDocument,
  );
}

export function useInvoices(): InvoiceDocument[] {
  return useDocumentsByIds(useIdsOfType(DOC_TYPES.invoice)).filter(
    isInvoiceDocument,
  );
}

export function useExpenseReports(): ExpenseReportDocument[] {
  return useDocumentsByIds(useIdsOfType(DOC_TYPES.expense)).filter(
    isExpenseReportDocument,
  );
}

export function useContacts(): ContactDocument[] {
  return useDocumentsByIds(useIdsOfType(DOC_TYPES.contact)).filter(
    isContactDocument,
  );
}

/** Every transaction across accounts, newest first, with its account. */
export type TransactionRow = {
  tx: Transaction;
  account: BankAccountDocument;
};

export function useTransactions(): TransactionRow[] {
  const accounts = useAccounts();
  return useMemo(
    () =>
      accounts
        .flatMap((account) =>
          account.state.global.transactions.map((tx) => ({ tx, account })),
        )
        .sort((a, b) => b.tx.bookedAt.localeCompare(a.tx.bookedAt)),
    [accounts],
  );
}

export function accountBalance(account: BankAccountDocument): number {
  const s = account.state.global;
  return s.transactions
    .filter((t) => t.status !== "EXCLUDED")
    .reduce((sum, t) => sum + t.amount, s.openingBalance);
}

export function folderNode(
  drive: DocumentDriveDocument,
  name: string,
): FolderNode | undefined {
  return drive.state.global.nodes.find(
    (n): n is FolderNode =>
      n.kind === "folder" && n.name === name && !n.parentFolder,
  );
}

export function fileNodeOf(
  drive: DocumentDriveDocument | undefined,
  documentId: string,
): FileNode | undefined {
  return drive?.state.global.nodes.find(
    (n): n is FileNode => n.kind === "file" && n.id === documentId,
  );
}

/** Folders created this session, so a batch of writes against one (stale)
 * drive snapshot — the seed, a multi-document import — reuses the folder it
 * just made instead of adding "(copy) n" siblings. */
const createdFolders = new Map<string, string>();

async function ensureFolder(drive: DocumentDriveDocument, name: string) {
  const key = `${drive.header.id}:${name}`;
  const cached = createdFolders.get(key);
  if (cached) return cached;
  const existing = folderNode(drive, name);
  if (existing) {
    createdFolders.set(key, existing.id);
    return existing.id;
  }
  const created = await addFolder(drive.header.id, name);
  createdFolders.set(key, created.id);
  return created.id;
}

/* ------------------------------------------------------------- accounts */

export type NewAccount = {
  name: string;
  institution?: string;
  iban?: string;
  kind: AccountKind;
  currency?: string;
  openingBalance?: number;
};

export async function createAccount(
  drive: DocumentDriveDocument,
  input: NewAccount,
): Promise<string> {
  const folder = await ensureFolder(drive, FOLDERS.accounts);
  const node = await addDocument(
    drive.header.id,
    input.name,
    DOC_TYPES.account,
    folder,
  );
  await dispatchActions(
    bankActions.setAccountDetails({
      name: input.name,
      institution: input.institution ?? null,
      iban: input.iban ?? null,
      kind: input.kind,
      currency: input.currency ?? "EUR",
      openingBalance: input.openingBalance ?? 0,
    }),
    node.id,
  );
  return node.id;
}

export type ImportedTransaction = {
  bookedAt: string;
  amount: number;
  counterparty: string;
  description?: string;
  reference?: string;
};

export function importTransactions(
  accountId: string,
  rows: ImportedTransaction[],
  importedAt = now(),
) {
  return dispatchActions(
    bankActions.importTransactions({
      batchId: generateId(),
      importedAt,
      transactions: rows.map((r) => ({
        id: generateId(),
        bookedAt: r.bookedAt,
        amount: r.amount,
        counterparty: r.counterparty,
        description: r.description ?? null,
        reference: r.reference ?? null,
      })),
    }),
    accountId,
  );
}

export function categorizeTransaction(
  accountId: string,
  id: string,
  category: TransactionCategory,
  contactId?: string | null,
) {
  return dispatchActions(
    bankActions.categorizeTransaction({
      id,
      category,
      contactId: contactId === undefined ? undefined : contactId,
    }),
    accountId,
  );
}

export function matchTransaction(
  accountId: string,
  id: string,
  documentId: string,
  kind: MatchKind,
) {
  return dispatchActions(
    bankActions.matchTransaction({ id, documentId, kind }),
    accountId,
  );
}

export function unmatchTransaction(accountId: string, id: string) {
  return dispatchActions(bankActions.unmatchTransaction({ id }), accountId);
}

export function excludeTransaction(
  accountId: string,
  id: string,
  excluded: boolean,
) {
  return dispatchActions(
    bankActions.excludeTransaction({ id, excluded }),
    accountId,
  );
}

/* ------------------------------------------------------------- invoices */

export type NewInvoiceLine = {
  description: string;
  quantity: number;
  unitPrice: number;
  vatRate: number;
};

export type NewInvoice = {
  direction: InvoiceDirection;
  counterpartyName: string;
  contactId?: string | null;
  email?: string | null;
  vatId?: string | null;
  address?: string | null;
  currency?: string;
  reference?: string | null;
  notes?: string | null;
  dueAt?: string | null;
  number?: string | null;
  lines: NewInvoiceLine[];
};

export function invoiceDocumentName(inv: NewInvoice): string {
  const who = inv.counterpartyName || "Untitled";
  return inv.number ? `${inv.number} · ${who}` : `Draft · ${who}`;
}

export async function createInvoice(
  drive: DocumentDriveDocument,
  input: NewInvoice,
): Promise<string> {
  const folder = await ensureFolder(drive, FOLDERS.invoices);
  const node = await addDocument(
    drive.header.id,
    invoiceDocumentName(input),
    DOC_TYPES.invoice,
    folder,
  );
  await dispatchActions(
    [
      invoiceActions.setInvoiceDetails({
        direction: input.direction,
        number: input.number ?? null,
        counterpartyName: input.counterpartyName,
        contactId: input.contactId ?? null,
        email: input.email ?? null,
        vatId: input.vatId ?? null,
        address: input.address ?? null,
        currency: input.currency ?? "EUR",
        reference: input.reference ?? null,
        notes: input.notes ?? null,
        dueAt: input.dueAt ?? null,
      }),
      ...input.lines.map((line) =>
        invoiceActions.addLine({ id: generateId(), ...line }),
      ),
    ],
    node.id,
  );
  return node.id;
}

export function addInvoiceLine(invoiceId: string, line: NewInvoiceLine) {
  return dispatchActions(
    invoiceActions.addLine({ id: generateId(), ...line }),
    invoiceId,
  );
}

export function updateInvoiceLine(
  invoiceId: string,
  id: string,
  line: Partial<NewInvoiceLine>,
) {
  return dispatchActions(invoiceActions.updateLine({ id, ...line }), invoiceId);
}

export function removeInvoiceLine(invoiceId: string, id: string) {
  return dispatchActions(invoiceActions.removeLine({ id }), invoiceId);
}

export function setInvoiceDetails(
  invoiceId: string,
  details: Partial<Omit<NewInvoice, "lines">>,
) {
  return dispatchActions(invoiceActions.setInvoiceDetails(details), invoiceId);
}

export function issueInvoice(
  invoiceId: string,
  number: string,
  dueAt: string,
  issuedAt = now(),
) {
  return dispatchActions(
    invoiceActions.issueInvoice({ number, issuedAt, dueAt }),
    invoiceId,
  );
}

export function recordPayment(
  invoiceId: string,
  amount: number,
  method: PaymentMethod,
  opts: { paidAt?: string; transactionId?: string | null } = {},
) {
  return dispatchActions(
    invoiceActions.recordPayment({
      id: generateId(),
      paidAt: opts.paidAt ?? now(),
      amount,
      method,
      transactionId: opts.transactionId ?? null,
    }),
    invoiceId,
  );
}

export function voidInvoice(invoiceId: string, reason: string) {
  return dispatchActions(invoiceActions.voidInvoice({ reason }), invoiceId);
}

/** "INV-2026-0012": one sequence per direction, from the existing documents. */
export function nextInvoiceNumber(
  invoices: InvoiceDocument[],
  direction: InvoiceDirection,
  at = new Date(),
): string {
  const prefix = direction === "OUTGOING" ? "INV" : "BILL";
  const year = at.getUTCFullYear();
  const used = invoices
    .map((i) => i.state.global.number ?? "")
    .filter((n) => n.startsWith(`${prefix}-${year}-`))
    .map((n) => Number(n.split("-").pop()))
    .filter((n) => Number.isFinite(n));
  const next = Math.max(0, ...used) + 1;
  return `${prefix}-${year}-${String(next).padStart(4, "0")}`;
}

/* ------------------------------------------------------------- expenses */

export type NewExpenseItem = {
  spentAt: string;
  merchant: string;
  category: TransactionCategory;
  amount: number;
  vatAmount?: number;
  paidWith: PaidWith;
  receiptName?: string | null;
  note?: string | null;
  contactId?: string | null;
};

export type NewExpenseReport = {
  title: string;
  submitterName: string;
  submitterEmail?: string | null;
  currency?: string;
  items: NewExpenseItem[];
};

export async function createExpenseReport(
  drive: DocumentDriveDocument,
  input: NewExpenseReport,
): Promise<string> {
  const folder = await ensureFolder(drive, FOLDERS.expenses);
  const node = await addDocument(
    drive.header.id,
    input.title,
    DOC_TYPES.expense,
    folder,
  );
  await dispatchActions(
    [
      expenseActions.setReportDetails({
        title: input.title,
        submitterName: input.submitterName,
        submitterEmail: input.submitterEmail ?? null,
        currency: input.currency ?? "EUR",
      }),
      ...input.items.map((item) =>
        expenseActions.addItem({
          id: generateId(),
          ...item,
          vatAmount: item.vatAmount ?? 0,
        }),
      ),
    ],
    node.id,
  );
  return node.id;
}

export function addExpenseItem(reportId: string, item: NewExpenseItem) {
  return dispatchActions(
    expenseActions.addItem({
      id: generateId(),
      ...item,
      vatAmount: item.vatAmount ?? 0,
    }),
    reportId,
  );
}

export function updateExpenseItem(
  reportId: string,
  id: string,
  item: Partial<NewExpenseItem>,
) {
  return dispatchActions(expenseActions.updateItem({ id, ...item }), reportId);
}

export function removeExpenseItem(reportId: string, id: string) {
  return dispatchActions(expenseActions.removeItem({ id }), reportId);
}

export function setReportDetails(
  reportId: string,
  details: Partial<Omit<NewExpenseReport, "items">>,
) {
  return dispatchActions(expenseActions.setReportDetails(details), reportId);
}

export function submitReport(reportId: string, submittedAt = now()) {
  return dispatchActions(
    expenseActions.submitReport({ submittedAt }),
    reportId,
  );
}

export function approveReport(
  reportId: string,
  decidedBy: string,
  note?: string | null,
  decidedAt = now(),
) {
  return dispatchActions(
    expenseActions.approveReport({ decidedAt, decidedBy, note: note ?? null }),
    reportId,
  );
}

export function rejectReport(
  reportId: string,
  decidedBy: string,
  note: string,
  decidedAt = now(),
) {
  return dispatchActions(
    expenseActions.rejectReport({ decidedAt, decidedBy, note }),
    reportId,
  );
}

export function reimburseReport(
  reportId: string,
  transactionId?: string | null,
  reimbursedAt = now(),
) {
  return dispatchActions(
    expenseActions.reimburseReport({
      reimbursedAt,
      transactionId: transactionId ?? null,
    }),
    reportId,
  );
}

/* ------------------------------------------------------------- contacts */

export type NewContact = {
  name: string;
  kind: ContactKind;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  vatId?: string | null;
  registrationNumber?: string | null;
  notes?: string | null;
  address?: {
    street?: string;
    postalCode?: string;
    city?: string;
    country?: string;
  };
  bank?: { iban?: string; bic?: string; accountHolder?: string };
  paymentTermsDays?: number;
  defaultCategory?: TransactionCategory;
  tags?: string[];
  people?: { name: string; role?: string; email?: string; phone?: string }[];
};

export async function createContact(
  drive: DocumentDriveDocument,
  input: NewContact,
): Promise<string> {
  const folder = await ensureFolder(drive, FOLDERS.contacts);
  const node = await addDocument(
    drive.header.id,
    input.name,
    DOC_TYPES.contact,
    folder,
  );
  await dispatchActions(
    [
      contactActions.setProfile({
        name: input.name,
        kind: input.kind,
        email: input.email ?? null,
        phone: input.phone ?? null,
        website: input.website ?? null,
        vatId: input.vatId ?? null,
        registrationNumber: input.registrationNumber ?? null,
        notes: input.notes ?? null,
      }),
      ...(input.address ? [contactActions.setAddress(input.address)] : []),
      ...(input.bank ? [contactActions.setBankDetails(input.bank)] : []),
      contactActions.setPaymentTerms({
        paymentTermsDays: input.paymentTermsDays ?? 30,
        defaultCategory: input.defaultCategory ?? null,
      }),
      ...(input.tags ?? []).map((tag) => contactActions.addTag({ tag })),
      ...(input.people ?? []).map((p) =>
        contactActions.addPerson({ id: generateId(), ...p }),
      ),
    ],
    node.id,
  );
  return node.id;
}

export function setContactProfile(
  contactId: string,
  profile: Partial<
    Pick<
      NewContact,
      | "name"
      | "kind"
      | "email"
      | "phone"
      | "website"
      | "vatId"
      | "registrationNumber"
      | "notes"
    >
  >,
) {
  return dispatchActions(contactActions.setProfile(profile), contactId);
}

export function setContactAddress(
  contactId: string,
  address: NonNullable<NewContact["address"]>,
) {
  return dispatchActions(contactActions.setAddress(address), contactId);
}

export function setContactBank(
  contactId: string,
  bank: NonNullable<NewContact["bank"]>,
) {
  return dispatchActions(contactActions.setBankDetails(bank), contactId);
}

export function setContactTerms(
  contactId: string,
  paymentTermsDays: number,
  defaultCategory?: TransactionCategory,
) {
  return dispatchActions(
    contactActions.setPaymentTerms({
      paymentTermsDays,
      defaultCategory: defaultCategory ?? null,
    }),
    contactId,
  );
}

export function addContactTag(contactId: string, tag: string) {
  return dispatchActions(contactActions.addTag({ tag }), contactId);
}

export function removeContactTag(contactId: string, tag: string) {
  return dispatchActions(contactActions.removeTag({ tag }), contactId);
}

export function addContactPerson(
  contactId: string,
  person: { name: string; role?: string; email?: string; phone?: string },
) {
  return dispatchActions(
    contactActions.addPerson({ id: generateId(), ...person }),
    contactId,
  );
}

export function removeContactPerson(contactId: string, id: string) {
  return dispatchActions(contactActions.removePerson({ id }), contactId);
}

export function archiveContact(contactId: string, archived: boolean) {
  return dispatchActions(
    contactActions.archiveContact({ archived }),
    contactId,
  );
}

export { generateId };
