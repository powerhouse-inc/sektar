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

  """A numbered invoice: the issue dialog's and the credit note's pickers."""
  type FinanceInvoiceNumber {
    id: String!
    number: String!
    """INVOICE | CREDIT_NOTE"""
    kind: String!
    issuedAt: String
  }

  """Our side of an invoice, as a new invoice copies it."""
  type FinanceParty {
    name: String
    street: String
    additionalStreet: String
    postalCode: String
    city: String
    region: String
    country: String
    vatId: String
    registrationId: String
    registrationScheme: String
    endpointId: String
    endpointScheme: String
    email: String
    phone: String
  }

  """One expense claim as the board's card shows it."""
  type FinanceExpenseRow {
    id: String!
    title: String
    submitterName: String
    submitterEmail: String
    """DRAFT | SUBMITTED | APPROVED | REJECTED | REIMBURSED"""
    status: String!
    currency: String!
    total: Float!
    """Paid personally or in cash: owed back."""
    reimbursable: Float!
    vatTotal: Float!
    itemCount: Int!
    """The receipts' categories, distinct, in item order."""
    categories: [String!]!
    """The first receipt's date."""
    firstSpentAt: String
    submittedAt: String
    decidedAt: String
    reimbursedAt: String
    createdAt: String!
    updatedAt: String!
  }

  type FinanceExpensePage {
    items: [FinanceExpenseRow!]!
    total: Int!
    hasMore: Boolean!
  }

  type FinanceExpenseStatusCount {
    status: String!
    count: Int!
    """The claims' totals added up."""
    total: Float!
    reimbursable: Float!
  }

  type FinanceExpenseCounts {
    all: Int!
    """One entry per status, DRAFT to REIMBURSED."""
    byStatus: [FinanceExpenseStatusCount!]!
  }

  """The Contacts board's filter."""
  enum FinanceContactView {
    """Every active contact."""
    ALL
    CUSTOMERS
    SUPPLIERS
    ARCHIVED
  }

  """One contact with what the books hold on it."""
  type FinanceContactRow {
    id: String!
    name: String
    """SUPPLIER | CUSTOMER | BOTH | OTHER"""
    kind: String!
    """ACTIVE | ARCHIVED"""
    status: String!
    email: String
    phone: String
    website: String
    vatId: String
    registrationNumber: String
    street: String
    postalCode: String
    city: String
    country: String
    paymentTermsDays: Int!
    defaultCategory: String!
    tags: [String!]!
    """OPEN invoices whose other party is this contact."""
    openInvoiceCount: Int!
    """Their book outstanding added up."""
    openBookOutstanding: Float!
    """Bank transactions linked to the contact."""
    transactionCount: Int!
    lastTransactionAt: String
  }

  type FinanceContactPage {
    items: [FinanceContactRow!]!
    total: Int!
    hasMore: Boolean!
  }

  type FinanceContactCounts {
    """Active contacts."""
    all: Int!
    customers: Int!
    suppliers: Int!
    archived: Int!
  }

  type FinanceContactName {
    id: String!
    name: String
  }

  """One transaction with its account and what it is matched to."""
  type FinanceTransactionDetail {
    id: String!
    accountId: String!
    bookedAt: String!
    counterparty: String!
    description: String
    reference: String
    category: String!
    status: String!
    amount: Float!
    currency: String!
    contactId: String
    matchedDocumentId: String
    matchedKind: String
    importBatch: String
    accountName: String
    """CURRENT | SAVINGS | CREDIT_CARD"""
    accountKind: String!
    """The matched invoice's number or claim's title."""
    matchedLabel: String
  }

  type FinanceMatchCandidate {
    """INVOICE | EXPENSE"""
    kind: String!
    id: String!
    label: String!
    """Left to pay (an invoice) or to reimburse (a claim)."""
    amount: Float!
    """How far the amount is from the transaction's."""
    distance: Float!
  }

  """How many documents of each kind the books hold."""
  type FinanceCounts {
    accounts: Int!
    invoices: Int!
    expenses: Int!
    contacts: Int!
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
      """Only the invoices whose other party is this contact."""
      contactId: String
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
      """Only the transactions linked to this contact."""
      contactId: String
      offset: Int
      limit: Int = 100
    ): FinanceTransactionPage!

    """The status menu's counts, for one account or all."""
    transactionCounts(driveId: String!, accountId: String): FinanceTransactionCounts!

    """The Finances dashboard's numbers as of \`now\` (ISO)."""
    dashboard(driveId: String!, now: String!): FinanceDashboardStats!

    """Every numbered invoice in a direction, highest number first."""
    invoiceNumbers(driveId: String!, direction: String!): [FinanceInvoiceNumber!]!

    """
    The next number in the direction's sequence as of \`now\` (ISO; the
    server's clock when absent), leaving out the invoice \`excludeId\`.
    """
    nextInvoiceNumber(
      driveId: String!
      direction: String!
      now: String
      excludeId: String
    ): String!

    """Our side as the latest invoice in the direction has it; null when none names it."""
    latestOurParty(driveId: String!, direction: String!): FinanceParty

    """
    A page of expense claims, the latest changed first. \`statuses\` keeps
    any of those; \`query\` is a word search over title, submitter and
    merchants.
    """
    expenses(
      driveId: String!
      statuses: [String!]
      query: String
      offset: Int
      limit: Int = 100
    ): FinanceExpensePage!

    """Claims per status with their totals, for the search given."""
    expenseCounts(driveId: String!, query: String): FinanceExpenseCounts!

    """Receipts spent in the 90 days before \`now\` (ISO), added up."""
    spend90d(driveId: String!, now: String): Float!

    """
    A page of contacts by name, with their open invoices and bank activity.
    \`query\` is a word search over name, email, city and tags.
    """
    contacts(
      driveId: String!
      view: FinanceContactView = ALL
      query: String
      offset: Int
      limit: Int = 100
    ): FinanceContactPage!

    """The Contacts board's filter counts."""
    contactCounts(driveId: String!): FinanceContactCounts!

    """One contact with its open invoices and bank activity."""
    contact(driveId: String!, id: String!): FinanceContactRow

    """The names of the contacts asked for."""
    contactNames(driveId: String!, ids: [String!]!): [FinanceContactName!]!

    """One transaction with its account and what it is matched to."""
    transaction(driveId: String!, id: String!): FinanceTransactionDetail

    """
    What a transaction of \`amount\` could settle, closest first: OPEN
    invoices in the money's direction and, for money out, claims approved
    or awaiting approval. At most eight.
    """
    matchCandidates(driveId: String!, amount: Float!): [FinanceMatchCandidate!]!

    """How many accounts, invoices, claims and contacts the books hold."""
    counts(driveId: String!): FinanceCounts!
  }

  type Query {
    financeIndex: FinanceIndexQueries!
  }
`;
