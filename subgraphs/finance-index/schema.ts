import type { DocumentNode } from "graphql";
import { gql } from "graphql-tag";

export const schema: DocumentNode = gql`
  """
  One invoice as the list shows it. Lean on purpose: lines, parties and
  files stay on the document, which is loaded only when it is opened.
  Amounts are in the invoice's currency; the book amounts in the book
  currency (EUR), at the invoice's own rate when it has one.
  """
  type FinanceInvoiceRow {
    id: String!
    """OUTGOING | INCOMING"""
    direction: String!
    """INVOICE | CREDIT_NOTE"""
    kind: String!
    """DRAFT | OPEN | PAID | VOID"""
    status: String!
    number: String
    counterpartyName: String
    counterpartyContactId: String
    subject: String
    """The first line's description, for a row without a subject."""
    firstLine: String
    currency: String!
    issuedAt: String
    dueAt: String
    deliveredAt: String
    periodStart: String
    periodEnd: String
    createdAt: String!
    gross: Float!
    """What is still to be paid, never below zero."""
    outstanding: Float!
    bookGross: Float!
    bookOutstanding: Float!
    """False when the invoice has no rate to the book currency: the book amounts are unconverted."""
    bookRateKnown: Boolean!
    """OPEN with a due date before the request's \`now\`."""
    overdue: Boolean!
    issuedCopyId: String
    issuedCopyRef: String
    lineCount: Int!
    linesMissingAttachments: Int!
    lastPaidAt: String
    updatedAt: String!
  }

  type FinanceInvoicePage {
    items: [FinanceInvoiceRow!]!
    """Every invoice the filters match, not just this page."""
    total: Int!
    hasMore: Boolean!
  }

  """The Invoices workspace's status menu."""
  enum FinanceInvoiceView {
    ALL
    DRAFT
    OPEN
    OVERDUE
    SETTLED
  }

  type FinanceViewCount {
    direction: String!
    view: FinanceInvoiceView!
    count: Int!
  }

  type FinanceInvoiceCounts {
    outgoing: Int!
    incoming: Int!
    """One count per direction and view."""
    byView: [FinanceViewCount!]!
  }

  type FinanceAccountRow {
    id: String!
    name: String
    """CURRENT | SAVINGS | CREDIT_CARD"""
    kind: String!
    institution: String
    ibanLast4: String
    currency: String!
    openingBalance: Float!
    """Opening balance plus every transaction not excluded."""
    balance: Float!
    txCount: Int!
    """Transactions still to review."""
    newCount: Int!
    lastImportedAt: String
    updatedAt: String!
  }

  type FinanceTransactionRow {
    id: String!
    """The account document that holds it."""
    accountId: String!
    bookedAt: String!
    counterparty: String!
    description: String
    reference: String
    category: String!
    """NEW | CATEGORIZED | MATCHED | EXCLUDED"""
    status: String!
    amount: Float!
    """The account's currency."""
    currency: String!
    contactId: String
    matchedDocumentId: String
    """INVOICE | EXPENSE"""
    matchedKind: String
    importBatch: String
  }

  type FinanceTransactionPage {
    items: [FinanceTransactionRow!]!
    total: Int!
    hasMore: Boolean!
  }

  type FinanceTransactionCounts {
    all: Int!
    new: Int!
    categorised: Int!
    matched: Int!
    excluded: Int!
  }

  type FinanceMonth {
    """YYYY-MM"""
    key: String!
    in: Float!
    out: Float!
  }

  type FinanceSpend {
    category: String!
    amount: Float!
  }

  """
  The Finances dashboard's numbers, all in the book currency except the
  recent transactions (their account's currency).
  """
  type FinanceDashboardStats {
    bookCurrency: String!
    """Balances of every account that is not a credit card."""
    cash: Float!
    """Balances of the credit cards (negative when owed)."""
    card: Float!
    """Book outstanding of OPEN sales invoices."""
    receivable: Float!
    """Book outstanding of OPEN purchase bills."""
    payable: Float!
    """OPEN invoices due before \`now\`, the most overdue first."""
    overdue: [FinanceInvoiceRow!]!
    """Transactions still NEW."""
    toReview: Int!
    """Money in and out for the six months up to \`now\`, oldest first; transfers and excluded rows left out."""
    months: [FinanceMonth!]!
    """Spending by category over the 90 days before \`now\`, largest first, at most six."""
    spend: [FinanceSpend!]!
    """Transactions categorised, percent (0 with none)."""
    readiness: Int!
    """Transactions categorised, percent (100 with none)."""
    categorisedPct: Int!
    """Matched transactions over sales transactions, percent (100 with none)."""
    matchedPct: Int!
    """Invoices issued (not DRAFT), percent (100 with none)."""
    issuedPct: Int!
    transactionCount: Int!
    categorisedCount: Int!
    matchedCount: Int!
    salesCount: Int!
    invoiceCount: Int!
    issuedCount: Int!
    """The seven latest transactions."""
    recent: [FinanceTransactionRow!]!
  }

  type FinanceIndexQueries {
    """
    A page of invoices in the workspace's order: drafts first (latest first
    by delivery, period or creation), then the issued by number, highest
    first. \`query\` is a word search over number, counterparty, subject,
    buyer reference and gross. \`now\` (ISO) decides open versus overdue;
    the server's clock when absent.
    """
    invoices(
      driveId: String!
      direction: String
      view: FinanceInvoiceView = ALL
      query: String
      now: String
      offset: Int
      limit: Int = 100
    ): FinanceInvoicePage!

    """Invoices per direction and per view."""
    invoiceCounts(driveId: String!, now: String): FinanceInvoiceCounts!

    """Every bank account, by name."""
    accounts(driveId: String!): [FinanceAccountRow!]!

    """
    A page of transactions, latest booked first. \`query\` is a word search
    over counterparty, description, reference, amount and category label.
    """
    transactions(
      driveId: String!
      accountId: String
      status: String
      category: String
      query: String
      offset: Int
      limit: Int = 100
    ): FinanceTransactionPage!

    """The status menu's counts, for one account or all."""
    transactionCounts(driveId: String!, accountId: String): FinanceTransactionCounts!

    """The Finances dashboard's numbers as of \`now\` (ISO)."""
    dashboard(driveId: String!, now: String!): FinanceDashboardStats!
  }

  type Query {
    financeIndex: FinanceIndexQueries!
  }
`;
