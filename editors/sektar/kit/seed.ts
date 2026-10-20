// Demo company: Juniper Studio, a nine-person brand & design studio in
// Amsterdam. Three months of bank and card activity, invoices in both
// directions, expense claims in every state, and the contacts behind them.
// Everything is a document in the Sektar drive; nothing here is mocked.
import type { DocumentDriveDocument } from "@powerhousedao/shared/document-drive";
import {
  isBankAccountDocument,
  type TransactionCategory,
} from "document-models/bank-account";
import type { PaidWith } from "document-models/expense-report";
import { isoDaysAgo } from "./format.js";
import {
  approveReport,
  categorizeTransaction,
  createAccount,
  createContact,
  createExpenseReport,
  createInvoice,
  importTransactions,
  issueInvoice,
  matchTransaction,
  recordPayment,
  reimburseReport,
  submitReport,
  voidInvoice,
  type ImportedTransaction,
  type NewContact,
  type NewExpenseItem,
  type NewInvoiceLine,
} from "./data.js";

export const COMPANY = {
  name: "Juniper Studio",
  owner: "Jane Doe",
  city: "Amsterdam",
  currency: "EUR",
} as const;

export const TEAM = [
  "Jane Doe",
  "Sara Visser",
  "Tom Bakker",
  "Nadia Haddad",
  "Eli Brandt",
];

type ContactSeed = NewContact & { key: string };

export const CONTACTS: ContactSeed[] = [
  {
    key: "bright",
    name: "Bright Media Ltd",
    kind: "CUSTOMER",
    email: "accounts@brightmedia.co.uk",
    vatId: "GB 553 2211 09",
    address: {
      street: "14 Old Street",
      postalCode: "EC1V 9AB",
      city: "London",
      country: "United Kingdom",
    },
    paymentTermsDays: 30,
    defaultCategory: "SALES",
    tags: ["agency", "retainer"],
    people: [
      {
        name: "Priya Shah",
        role: "Head of Brand",
        email: "priya@brightmedia.co.uk",
      },
    ],
  },
  {
    key: "acme",
    name: "Acme Client BV",
    kind: "CUSTOMER",
    email: "finance@acme-client.nl",
    vatId: "NL 8542.11.001.B01",
    address: {
      street: "Herengracht 420",
      postalCode: "1017 BZ",
      city: "Amsterdam",
      country: "Netherlands",
    },
    paymentTermsDays: 14,
    defaultCategory: "SALES",
    tags: ["product"],
    people: [
      { name: "Daan de Vries", role: "CMO", email: "daan@acme-client.nl" },
    ],
  },
  {
    key: "nordlys",
    name: "Nordlys Hotels",
    kind: "CUSTOMER",
    email: "invoices@nordlys.no",
    vatId: "NO 998 877 665 MVA",
    address: {
      street: "Storgata 8",
      postalCode: "0155",
      city: "Oslo",
      country: "Norway",
    },
    paymentTermsDays: 45,
    defaultCategory: "SALES",
    tags: ["hospitality"],
    people: [{ name: "Ingrid Solberg", role: "Marketing Director" }],
  },
  {
    key: "terra",
    name: "Terra Foods Coöperatie",
    kind: "CUSTOMER",
    email: "admin@terrafoods.nl",
    address: {
      street: "Veemarkt 12",
      postalCode: "3521 AD",
      city: "Utrecht",
      country: "Netherlands",
    },
    paymentTermsDays: 30,
    defaultCategory: "SALES",
    tags: ["food", "packaging"],
  },
  {
    key: "maple",
    name: "Maple & Finch",
    kind: "BOTH",
    email: "hello@mapleandfinch.com",
    address: {
      street: "Prinsengracht 200",
      postalCode: "1016 HC",
      city: "Amsterdam",
      country: "Netherlands",
    },
    paymentTermsDays: 30,
    defaultCategory: "SALES",
    tags: ["photography", "partner"],
    people: [{ name: "Lotte Maple", role: "Founder" }],
  },
  {
    key: "wework",
    name: "WeWork Amsterdam",
    kind: "SUPPLIER",
    email: "billing@wework.com",
    vatId: "NL 8225.12.345.B01",
    address: {
      street: "Weesperstraat 61",
      postalCode: "1018 VN",
      city: "Amsterdam",
      country: "Netherlands",
    },
    bank: {
      iban: "NL02 ABNA 0123 4567 89",
      bic: "ABNANL2A",
      accountHolder: "WeWork Netherlands BV",
    },
    paymentTermsDays: 14,
    defaultCategory: "RENT",
    tags: ["office"],
  },
  {
    key: "adobe",
    name: "Adobe Systems",
    kind: "SUPPLIER",
    email: "billing@adobe.com",
    website: "https://adobe.com",
    paymentTermsDays: 0,
    defaultCategory: "SOFTWARE",
    tags: ["subscription"],
  },
  {
    key: "figma",
    name: "Figma Inc",
    kind: "SUPPLIER",
    email: "billing@figma.com",
    website: "https://figma.com",
    paymentTermsDays: 0,
    defaultCategory: "SOFTWARE",
    tags: ["subscription"],
  },
  {
    key: "office",
    name: "Office Supplies Co",
    kind: "SUPPLIER",
    email: "orders@officesupplies.nl",
    address: {
      street: "Industrieweg 4",
      postalCode: "2031 CS",
      city: "Haarlem",
      country: "Netherlands",
    },
    bank: {
      iban: "NL91 RABO 0300 0123 45",
      bic: "RABONL2U",
      accountHolder: "Office Supplies Co BV",
    },
    paymentTermsDays: 30,
    defaultCategory: "SUPPLIES",
    tags: ["supplies"],
  },
  {
    key: "stripe",
    name: "Stripe Payments",
    kind: "SUPPLIER",
    website: "https://stripe.com",
    paymentTermsDays: 0,
    defaultCategory: "BANK_FEES",
    tags: ["payments"],
  },
  {
    key: "klm",
    name: "KLM Royal Dutch Airlines",
    kind: "SUPPLIER",
    website: "https://klm.com",
    paymentTermsDays: 0,
    defaultCategory: "TRAVEL",
    tags: ["travel"],
  },
];

const L = (
  description: string,
  quantity: number,
  unitPrice: number,
  vatRate = 21,
): NewInvoiceLine => ({ description, quantity, unitPrice, vatRate });

type InvoiceSeed = {
  key: string;
  direction: "OUTGOING" | "INCOMING";
  contact: string;
  number?: string;
  reference?: string;
  lines: NewInvoiceLine[];
  issuedDaysAgo?: number;
  termsDays?: number;
  status: "DRAFT" | "OPEN" | "PAID" | "VOID";
  paidDaysAgo?: number;
  notes?: string;
  bankRef?: string; // the bank transaction that settles it
};

export const INVOICES: InvoiceSeed[] = [
  {
    key: "inv1",
    direction: "OUTGOING",
    contact: "bright",
    number: "INV-2026-0041",
    lines: [
      L("Brand identity — phase 2 (strategy & logo system)", 1, 9800),
      L("Design retainer — July", 1, 3200),
    ],
    issuedDaysAgo: 82,
    termsDays: 30,
    status: "PAID",
    paidDaysAgo: 55,
    bankRef: "SEPA-BRIGHT-0041",
  },
  {
    key: "inv2",
    direction: "OUTGOING",
    contact: "acme",
    number: "INV-2026-0042",
    lines: [
      L("Product launch campaign — concept & key visuals", 1, 7400),
      L("Motion assets (6)", 6, 450),
    ],
    issuedDaysAgo: 70,
    termsDays: 14,
    status: "PAID",
    paidDaysAgo: 58,
    bankRef: "SEPA-ACME-0042",
  },
  {
    key: "inv3",
    direction: "OUTGOING",
    contact: "nordlys",
    number: "INV-2026-0043",
    lines: [
      L("Hotel brand guidelines", 1, 6200, 0),
      L("Signage system", 1, 2900, 0),
    ],
    issuedDaysAgo: 61,
    termsDays: 45,
    status: "PAID",
    paidDaysAgo: 20,
    bankRef: "SWIFT-NORDLYS-0043",
  },
  {
    key: "inv4",
    direction: "OUTGOING",
    contact: "terra",
    number: "INV-2026-0044",
    lines: [
      L("Packaging range — 4 SKUs", 4, 1150),
      L("Print management", 1, 600),
    ],
    issuedDaysAgo: 48,
    termsDays: 30,
    status: "PAID",
    paidDaysAgo: 21,
    bankRef: "SEPA-TERRA-0044",
  },
  {
    key: "inv5",
    direction: "OUTGOING",
    contact: "bright",
    number: "INV-2026-0045",
    lines: [
      L("Design retainer — August", 1, 3200),
      L("Design retainer — September", 1, 3200),
    ],
    issuedDaysAgo: 40,
    termsDays: 30,
    status: "OPEN",
  },
  {
    key: "inv6",
    direction: "OUTGOING",
    contact: "maple",
    number: "INV-2026-0046",
    lines: [
      L("Website redesign — discovery", 1, 4800),
      L("UX prototype", 1, 3600),
    ],
    issuedDaysAgo: 36,
    termsDays: 30,
    status: "OPEN",
    notes: "Second reminder sent.",
  },
  {
    key: "inv7",
    direction: "OUTGOING",
    contact: "acme",
    number: "INV-2026-0047",
    lines: [L("Campaign iteration — autumn", 1, 5200)],
    issuedDaysAgo: 9,
    termsDays: 14,
    status: "OPEN",
  },
  {
    key: "inv8",
    direction: "OUTGOING",
    contact: "nordlys",
    lines: [L("Seasonal campaign — winter 2026", 1, 8400, 0)],
    status: "DRAFT",
  },
  {
    key: "inv9",
    direction: "OUTGOING",
    contact: "terra",
    number: "INV-2026-0040",
    lines: [L("Packaging range — 4 SKUs", 4, 1150)],
    issuedDaysAgo: 86,
    termsDays: 30,
    status: "VOID",
    notes: "Re-issued as INV-2026-0044 after scope change.",
  },
  {
    key: "bill1",
    direction: "INCOMING",
    contact: "wework",
    number: "BILL-2026-0101",
    reference: "WW-AMS-88213",
    lines: [L("Private office 4.12 — August", 1, 2450)],
    issuedDaysAgo: 75,
    termsDays: 14,
    status: "PAID",
    paidDaysAgo: 64,
    bankRef: "SEPA-WEWORK-AUG",
  },
  {
    key: "bill2",
    direction: "INCOMING",
    contact: "wework",
    number: "BILL-2026-0102",
    reference: "WW-AMS-88977",
    lines: [L("Private office 4.12 — September", 1, 2450)],
    issuedDaysAgo: 45,
    termsDays: 14,
    status: "PAID",
    paidDaysAgo: 33,
    bankRef: "SEPA-WEWORK-SEP",
  },
  {
    key: "bill3",
    direction: "INCOMING",
    contact: "wework",
    number: "BILL-2026-0103",
    reference: "WW-AMS-89650",
    lines: [L("Private office 4.12 — October", 1, 2450)],
    issuedDaysAgo: 14,
    termsDays: 14,
    status: "OPEN",
  },
  {
    key: "bill4",
    direction: "INCOMING",
    contact: "adobe",
    number: "BILL-2026-0104",
    reference: "ADB-3391-77",
    lines: [L("Creative Cloud for teams — 9 seats, annual", 9, 780)],
    issuedDaysAgo: 52,
    termsDays: 0,
    status: "PAID",
    paidDaysAgo: 52,
    bankRef: "CARD-ADOBE-ANNUAL",
  },
  {
    key: "bill5",
    direction: "INCOMING",
    contact: "office",
    number: "BILL-2026-0105",
    reference: "OSC-2026-5521",
    lines: [L("Ergonomic chairs", 3, 420), L("Standing desk", 1, 690)],
    issuedDaysAgo: 12,
    termsDays: 30,
    status: "OPEN",
  },
  {
    key: "bill6",
    direction: "INCOMING",
    contact: "figma",
    number: "BILL-2026-0106",
    reference: "FIG-INV-204411",
    lines: [L("Figma Organization — 9 editors, October", 9, 45)],
    issuedDaysAgo: 6,
    termsDays: 0,
    status: "OPEN",
  },
];

type ExpenseSeed = {
  key: string;
  title: string;
  submitter: string;
  status: "DRAFT" | "SUBMITTED" | "APPROVED" | "REIMBURSED";
  items: (Omit<NewExpenseItem, "spentAt"> & { daysAgo: number })[];
  cardRefs?: string[];
};

const E = (
  daysAgo: number,
  merchant: string,
  category: TransactionCategory,
  amount: number,
  paidWith: PaidWith,
  note?: string,
  receiptName?: string,
) => ({
  daysAgo,
  merchant,
  category,
  amount,
  vatAmount: Math.round(((amount * 0.21) / 1.21) * 100) / 100,
  paidWith,
  note: note ?? null,
  receiptName: receiptName ?? null,
});

export const EXPENSES: ExpenseSeed[] = [
  {
    key: "exp1",
    title: "Berlin client trip — Bright Media",
    submitter: "Sara Visser",
    status: "SUBMITTED",
    items: [
      E(
        11,
        "Deutsche Bahn",
        "TRAVEL",
        189,
        "PERSONAL",
        "Amsterdam–Berlin return",
        "db-ticket.pdf",
      ),
      E(
        10,
        "Hotel Oderberger",
        "TRAVEL",
        312,
        "COMPANY_CARD",
        "2 nights",
        "hotel.pdf",
      ),
      E(10, "Café Einstein", "TRAVEL", 64.5, "CASH", "Client lunch"),
    ],
    cardRefs: ["CARD-HOTEL-BERLIN"],
  },
  {
    key: "exp2",
    title: "Q3 team offsite — Texel",
    submitter: "Tom Bakker",
    status: "APPROVED",
    items: [
      E(34, "TESO Ferry", "TRAVEL", 98, "COMPANY_CARD", "9 people + van"),
      E(
        33,
        "Strandhotel",
        "TRAVEL",
        1340,
        "COMPANY_CARD",
        "Rooms, 1 night",
        "strandhotel.pdf",
      ),
      E(
        33,
        "Albert Heijn",
        "OTHER",
        212.4,
        "PERSONAL",
        "Groceries for the workshop",
      ),
      E(32, "Fietsverhuur Texel", "TRAVEL", 135, "CASH", "Bikes"),
    ],
    cardRefs: ["CARD-TESO", "CARD-STRANDHOTEL"],
  },
  {
    key: "exp3",
    title: "Awwwards conference — Amsterdam",
    submitter: "Nadia Haddad",
    status: "REIMBURSED",
    items: [
      E(
        58,
        "Awwwards",
        "MARKETING",
        495,
        "PERSONAL",
        "Conference ticket",
        "awwwards.pdf",
      ),
      E(57, "Uber", "TRAVEL", 23.8, "PERSONAL"),
    ],
  },
  {
    key: "exp4",
    title: "October small expenses",
    submitter: "Eli Brandt",
    status: "DRAFT",
    items: [
      E(5, "Bol.com", "SUPPLIES", 46.9, "PERSONAL", "USB-C hub"),
      E(2, "Coffee Company", "OTHER", 18.2, "CASH", "Candidate interview"),
    ],
  },
];

/* --------------------------------------------------------------- bank feed */

type TxSeed = ImportedTransaction & {
  category?: TransactionCategory;
  contact?: string;
  status?: "NEW";
};

const T = (
  daysAgo: number,
  amount: number,
  counterparty: string,
  description: string,
  reference: string,
  category?: TransactionCategory,
  contact?: string,
): TxSeed => ({
  bookedAt: isoDaysAgo(daysAgo),
  amount,
  counterparty,
  description,
  reference,
  category,
  contact,
});

export const CURRENT_FEED: TxSeed[] = [
  T(
    88,
    -2450,
    "WeWork Netherlands BV",
    "Office 4.12 July",
    "SEPA-WEWORK-JUL",
    "RENT",
    "wework",
  ),
  T(
    86,
    12400.5,
    "Stripe Payments",
    "Payout 2026-07-23",
    "STRIPE-PO-2307",
    "SALES",
    "stripe",
  ),
  T(
    84,
    -21400,
    "Juniper Studio payroll",
    "Salaries July",
    "PAYROLL-JUL",
    "PAYROLL",
  ),
  T(80, -8.5, "ING Bank", "Monthly account fee", "FEE-JUL", "BANK_FEES"),
  T(
    79,
    -1250,
    "Marktplaats Zakelijk",
    "Advertising July",
    "MKT-7781",
    "MARKETING",
  ),
  T(
    72,
    -5000,
    "Juniper Studio savings",
    "Transfer to savings",
    "XFER-SAV-1",
    "TRANSFER",
  ),
  T(
    64,
    -2450,
    "WeWork Netherlands BV",
    "Office 4.12 August",
    "SEPA-WEWORK-AUG",
    "RENT",
    "wework",
  ),
  T(
    58,
    15730,
    "Acme Client BV",
    "INV-2026-0042",
    "SEPA-ACME-0042",
    "SALES",
    "acme",
  ),
  T(
    55,
    15730,
    "Bright Media Ltd",
    "INV-2026-0041 brand identity",
    "SEPA-BRIGHT-0041",
    "SALES",
    "bright",
  ),
  T(
    54,
    -21400,
    "Juniper Studio payroll",
    "Salaries August",
    "PAYROLL-AUG",
    "PAYROLL",
  ),
  T(
    52,
    9840.2,
    "Stripe Payments",
    "Payout 2026-08-26",
    "STRIPE-PO-2608",
    "SALES",
    "stripe",
  ),
  T(50, -8.5, "ING Bank", "Monthly account fee", "FEE-AUG", "BANK_FEES"),
  T(47, -14860, "Belastingdienst", "VAT Q2 2026", "TAX-VAT-Q2", "TAX"),
  T(44, -89, "Notion Labs", "Team plan September", "NOTION-SEP", "SOFTWARE"),
  T(
    41,
    -540,
    "Awwwards / Nadia Haddad",
    "Expense reimbursement",
    "REIMB-NADIA-1",
    "TRAVEL",
  ),
  T(
    33,
    -2450,
    "WeWork Netherlands BV",
    "Office 4.12 September",
    "SEPA-WEWORK-SEP",
    "RENT",
    "wework",
  ),
  T(
    28,
    -5000,
    "Juniper Studio savings",
    "Transfer to savings",
    "XFER-SAV-2",
    "TRANSFER",
  ),
  T(
    24,
    -21400,
    "Juniper Studio payroll",
    "Salaries September",
    "PAYROLL-SEP",
    "PAYROLL",
  ),
  T(
    22,
    11210,
    "Stripe Payments",
    "Payout 2026-09-25",
    "STRIPE-PO-2509",
    "SALES",
    "stripe",
  ),
  T(
    21,
    6292,
    "Terra Foods Cooperatie",
    "INV-2026-0044",
    "SEPA-TERRA-0044",
    "SALES",
    "terra",
  ),
  T(
    20,
    9100,
    "Nordlys Hotels AS",
    "INV-2026-0043 guidelines",
    "SWIFT-NORDLYS-0043",
    "SALES",
    "nordlys",
  ),
  T(19, -8.5, "ING Bank", "Monthly account fee", "FEE-SEP", "BANK_FEES"),
  T(18, -42.3, "ING Bank", "SWIFT incoming charge", "FEE-SWIFT-1", "BANK_FEES"),
  T(14, -89, "Notion Labs", "Team plan October", "NOTION-OCT"),
  T(12, -1250, "Marktplaats Zakelijk", "Advertising September", "MKT-8120"),
  T(8, -2300, "Juniper Studio savings", "Transfer to savings", "XFER-SAV-3"),
  T(6, 2420, "Maple & Finch", "Photo day — shared shoot", "SEPA-MAPLE-SHOOT"),
  T(4, -1780.5, "SEPA transfer", "Ref 00448812 — unknown", "SEPA-UNKNOWN-1"),
  T(
    1,
    1500,
    "Bright Media Ltd",
    "Part payment INV-2026-0045",
    "SEPA-BRIGHT-PART",
  ),
];

export const CARD_FEED: TxSeed[] = [
  T(
    60,
    -7020,
    "Adobe Systems",
    "Creative Cloud teams annual",
    "CARD-ADOBE-ANNUAL",
    "SOFTWARE",
    "adobe",
  ),
  T(
    52,
    -405,
    "Figma",
    "Organization — 9 editors",
    "CARD-FIGMA-SEP",
    "SOFTWARE",
    "figma",
  ),
  T(
    38,
    -212.9,
    "KLM",
    "AMS–OSL Nordlys kickoff",
    "CARD-KLM-OSL",
    "TRAVEL",
    "klm",
  ),
  T(34, -98, "TESO", "Ferry Texel", "CARD-TESO", "TRAVEL"),
  T(
    33,
    -1340,
    "Strandhotel Texel",
    "Team offsite",
    "CARD-STRANDHOTEL",
    "TRAVEL",
  ),
  T(
    26,
    -59,
    "Google Workspace",
    "Business starter 9 users",
    "CARD-GWS-SEP",
    "SOFTWARE",
  ),
  T(
    22,
    -405,
    "Figma",
    "Organization — 9 editors",
    "CARD-FIGMA-OCT",
    "SOFTWARE",
    "figma",
  ),
  T(15, -37.4, "Albert Heijn", "Office snacks", "CARD-AH-1"),
  T(10, -312, "Hotel Oderberger", "Berlin", "CARD-HOTEL-BERLIN", "TRAVEL"),
  T(7, -59, "Google Workspace", "Business starter 9 users", "CARD-GWS-OCT"),
  T(3, -129, "Linear", "Team plan", "CARD-LINEAR"),
  T(2, -24.9, "Dribbble", "Hiring post", "CARD-DRIBBBLE"),
];

/* ------------------------------------------------------------------ seed */

export type SeedProgress = (step: string) => void;

export async function seedDemoCompany(
  drive: DocumentDriveDocument,
  onProgress: SeedProgress = () => {},
) {
  const failures: string[] = [];
  const attempt = async (label: string, fn: () => Promise<void>) => {
    try {
      await fn();
    } catch (e) {
      failures.push(label);
      console.error(`[seed] ${label} failed`, e);
    }
  };
  onProgress("Adding contacts");
  const contactIds = new Map<string, string>();
  for (const c of CONTACTS) {
    const { key, ...input } = c;
    await attempt(`contact ${key}`, async () => {
      contactIds.set(key, await createContact(drive, input));
    });
  }
  const contactId = (key: string | undefined) =>
    key ? (contactIds.get(key) ?? null) : null;
  const contactName = (key: string) =>
    CONTACTS.find((c) => c.key === key)?.name ?? key;
  const contactOf = (key: string) => CONTACTS.find((c) => c.key === key);

  onProgress("Opening bank accounts");
  const current = await createAccount(drive, {
    name: "Business Current",
    institution: "ING",
    iban: "NL18 INGB 0005 2211 97",
    kind: "CURRENT",
    openingBalance: 52000,
  });
  const savings = await createAccount(drive, {
    name: "Business Savings",
    institution: "ING",
    iban: "NL55 INGB 0005 2211 98",
    kind: "SAVINGS",
    openingBalance: 24800,
  });
  const card = await createAccount(drive, {
    name: "Company Card",
    institution: "American Express",
    kind: "CREDIT_CARD",
    openingBalance: 0,
  });

  onProgress("Writing invoices");
  const invoiceIds = new Map<string, string>();
  for (const inv of INVOICES)
    await attempt(`invoice ${inv.key}`, async () => {
      const c = contactOf(inv.contact);
      const issuedAt =
        inv.issuedDaysAgo !== undefined
          ? isoDaysAgo(inv.issuedDaysAgo)
          : undefined;
      const dueAt =
        issuedAt && inv.termsDays !== undefined
          ? isoDaysAgo(inv.issuedDaysAgo! - inv.termsDays)
          : null;
      const id = await createInvoice(drive, {
        direction: inv.direction,
        party: {
          name: contactName(inv.contact),
          contactId: contactId(inv.contact),
          email: c?.email ?? null,
          vatId: c?.vatId ?? null,
          street: c?.address?.street ?? null,
          postalCode: c?.address?.postalCode ?? null,
          city: c?.address?.city ?? null,
          country: c?.address?.country ?? null,
        },
        us: { name: COMPANY.name, city: COMPANY.city, country: "NL" },
        reference: inv.reference ?? null,
        notes: inv.notes ?? null,
        lines: inv.lines,
        number: inv.status === "DRAFT" ? null : inv.number,
        dueAt,
      });
      invoiceIds.set(inv.key, id);
      if (inv.status !== "DRAFT" && inv.number && issuedAt && dueAt) {
        await issueInvoice(id, inv.number, dueAt, issuedAt);
      }
      if (inv.status === "VOID") await voidInvoice(id, inv.notes ?? "Voided");
    });

  onProgress("Filing expense claims");
  const expenseIds = new Map<string, string>();
  for (const exp of EXPENSES)
    await attempt(`expense ${exp.key}`, async () => {
      const id = await createExpenseReport(drive, {
        title: exp.title,
        submitterName: exp.submitter,
        submitterEmail: `${exp.submitter.split(" ")[0].toLowerCase()}@juniper.studio`,
        items: exp.items.map(({ daysAgo, ...item }) => ({
          ...item,
          spentAt: isoDaysAgo(daysAgo),
        })),
      });
      expenseIds.set(exp.key, id);
      const newest = Math.min(...exp.items.map((i) => i.daysAgo));
      if (exp.status !== "DRAFT")
        await submitReport(id, isoDaysAgo(newest - 1));
      if (exp.status === "APPROVED" || exp.status === "REIMBURSED")
        await approveReport(
          id,
          COMPANY.owner,
          "Looks good — thanks for the receipts.",
          isoDaysAgo(newest - 3),
        );
      if (exp.status === "REIMBURSED")
        await reimburseReport(id, null, isoDaysAgo(newest - 6));
    });

  onProgress("Importing the bank feed");
  const byRef = new Map<string, { accountId: string; txId: string }>();
  const SAVINGS_FEED: TxSeed[] = [
    T(
      72,
      5000,
      "Juniper Studio current",
      "Transfer from current",
      "SAV-IN-1",
      "TRANSFER",
    ),
    T(
      28,
      5000,
      "Juniper Studio current",
      "Transfer from current",
      "SAV-IN-2",
      "TRANSFER",
    ),
    T(
      8,
      2300,
      "Juniper Studio current",
      "Transfer from current",
      "SAV-IN-3",
      "TRANSFER",
    ),
    T(1, 31.6, "ING Bank", "Interest Q3", "SAV-INT-Q3", "OTHER"),
  ];
  const feeds: [string, TxSeed[]][] = [
    [current, CURRENT_FEED],
    [card, CARD_FEED],
    [savings, SAVINGS_FEED],
  ];
  for (const [accountId, feed] of feeds)
    await attempt(`import ${accountId}`, async () => {
      const doc = await importTransactions(accountId, feed, isoDaysAgo(0));
      if (!isBankAccountDocument(doc)) return;
      for (const tx of doc.state.global.transactions) {
        if (tx.reference) byRef.set(tx.reference, { accountId, txId: tx.id });
      }
      for (const row of feed) {
        const hit = byRef.get(row.reference ?? "");
        if (hit && row.category) {
          await categorizeTransaction(
            hit.accountId,
            hit.txId,
            row.category,
            contactId(row.contact),
          );
        }
      }
    });

  onProgress("Matching payments to invoices");
  await attempt("matching", async () => {
    for (const inv of INVOICES) {
      if (inv.status !== "PAID" || !inv.bankRef) continue;
      const id = invoiceIds.get(inv.key);
      const hit = byRef.get(inv.bankRef);
      if (!id || !hit) continue;
      const gross = inv.lines.reduce(
        (s, l) => s + l.quantity * l.unitPrice * (1 + l.vatRate / 100),
        0,
      );
      await recordPayment(
        id,
        Math.round(gross * 100) / 100,
        inv.bankRef.startsWith("CARD") ? "CARD" : "BANK_TRANSFER",
        {
          paidAt: isoDaysAgo(inv.paidDaysAgo ?? 0),
          transactionId: hit.txId,
        },
      );
      await matchTransaction(hit.accountId, hit.txId, id, "INVOICE");
    }
    // The part payment on INV-2026-0045 stays OPEN with an outstanding balance.
    const partial = byRef.get("SEPA-BRIGHT-PART");
    const inv5 = invoiceIds.get("inv5");
    if (partial && inv5) {
      await recordPayment(inv5, 1500, "BANK_TRANSFER", {
        paidAt: isoDaysAgo(1),
        transactionId: partial.txId,
      });
      await matchTransaction(partial.accountId, partial.txId, inv5, "INVOICE");
    }
    for (const exp of EXPENSES) {
      const id = expenseIds.get(exp.key);
      for (const ref of exp.cardRefs ?? []) {
        const hit = byRef.get(ref);
        if (id && hit)
          await matchTransaction(hit.accountId, hit.txId, id, "EXPENSE");
      }
    }
  });
  console.info(
    `[seed] done${failures.length ? `, failed: ${failures.join(", ")}` : ""}`,
  );
  onProgress("Done");
  if (failures.length)
    throw new Error(
      `Some records could not be created: ${failures.join(", ")}`,
    );
}
