import type { DocumentModelGlobalState } from "document-model";

export const documentModel: DocumentModelGlobalState = {
  id: "sektar/invoice",
  name: "Invoice",
  author: {
    name: "Sektar",
    website: "https://sektar.example",
  },
  extension: "inv",
  description:
    "An outgoing (receivable) or incoming (payable) invoice or credit note, aligned to EN 16931 / Peppol BIS Billing 3.0: parties, lines with a VAT category, VAT exemption reasons, currencies and exchange rates, forward-billed costs, payment instructions, attachments at invoice and line level, and the payments that settle it.",
  specifications: [
    {
      version: 1,
      changeLog: [],
      state: {
        global: {
          schema:
            "type InvoiceState {\n  direction: InvoiceDirection!\n  number: String\n  status: InvoiceStatus!\n  counterparty: Party!\n  issuedAt: DateTime\n  dueAt: DateTime\n  currency: String!\n  lines: [InvoiceLine!]!\n  payments: [Payment!]!\n  reference: String\n  notes: String\n  voidReason: String\n}\n\ntype Party {\n  name: String\n  contactId: String\n  email: String\n  vatId: String\n  address: String\n}\n\ntype InvoiceLine {\n  id: OID!\n  description: String!\n  quantity: Float!\n  unitPrice: Float!\n  vatRate: Float!\n}\n\ntype Payment {\n  id: OID!\n  paidAt: DateTime!\n  amount: Float!\n  method: PaymentMethod!\n  transactionId: String\n}\n\nenum InvoiceDirection {\n  OUTGOING\n  INCOMING\n}\n\nenum InvoiceStatus {\n  DRAFT\n  OPEN\n  PAID\n  VOID\n}\n\nenum PaymentMethod {\n  BANK_TRANSFER\n  CARD\n  CASH\n  OTHER\n}",
          initialValue:
            '{"direction": "OUTGOING", "number": null, "status": "DRAFT", "counterparty": {"name": null, "contactId": null, "email": null, "vatId": null, "address": null}, "issuedAt": null, "dueAt": null, "currency": "EUR", "lines": [], "payments": [], "reference": null, "notes": null, "voidReason": null}',
          examples: [],
        },
        local: {
          schema: "",
          initialValue: "",
          examples: [],
        },
      },
      modules: [
        {
          id: "d50ad2d3-85e5-4600-909b-d3eca62a5887",
          name: "details",
          description: "Header and counterparty",
          operations: [
            {
              id: "ab1325f7-f415-48c1-b264-f90d4d081c2d",
              name: "SET_INVOICE_DETAILS",
              description: "",
              schema:
                "input SetInvoiceDetailsInput {\n  direction: InvoiceDirection\n  number: String\n  counterpartyName: String\n  contactId: String\n  email: String\n  vatId: String\n  address: String\n  currency: String\n  reference: String\n  notes: String\n  dueAt: DateTime\n}",
              template: "",
              reducer:
                'if (state.status === "PAID" || state.status === "VOID") throw new InvoiceClosedError("A paid or void invoice cannot change");\nconst i = action.input;\nif (i.direction !== undefined && i.direction !== null) {\n  if (state.status !== "DRAFT") throw new InvoiceIssuedError("The direction is fixed once the invoice is issued");\n  state.direction = i.direction;\n}\nif (i.currency !== undefined && i.currency !== null) {\n  if (state.status !== "DRAFT") throw new InvoiceIssuedError("The currency is fixed once the invoice is issued");\n  state.currency = i.currency;\n}\nif (i.number !== undefined) state.number = i.number;\nif (i.counterpartyName !== undefined) state.counterparty.name = i.counterpartyName;\nif (i.contactId !== undefined) state.counterparty.contactId = i.contactId;\nif (i.email !== undefined) state.counterparty.email = i.email;\nif (i.vatId !== undefined) state.counterparty.vatId = i.vatId;\nif (i.address !== undefined) state.counterparty.address = i.address;\nif (i.reference !== undefined) state.reference = i.reference;\nif (i.notes !== undefined) state.notes = i.notes;\nif (i.dueAt !== undefined) state.dueAt = i.dueAt;',
              errors: [
                {
                  id: "63a2c1bf-b65d-40f6-b14c-9ab16fe1bc99",
                  code: "INVOICE_CLOSED",
                  name: "InvoiceClosedError",
                  description: "The invoice is paid or void",
                  template: "",
                },
                {
                  id: "f3147dfe-faec-4599-a42a-bcfa058f5d94",
                  code: "INVOICE_ISSUED",
                  name: "InvoiceIssuedError",
                  description: "The field is fixed after issuing",
                  template: "",
                },
              ],
              examples: [],
              scope: "global",
            },
          ],
        },
        {
          id: "f6e6ffa3-989b-41af-93e6-d77d4128e5d8",
          name: "lines",
          description: "Invoice lines",
          operations: [
            {
              id: "f2db79a6-5f32-4e49-988b-69e845203d39",
              name: "ADD_LINE",
              description: "",
              schema:
                "input AddLineInput {\n  id: OID!\n  description: String!\n  quantity: Float!\n  unitPrice: Float!\n  vatRate: Float!\n}",
              template: "",
              reducer:
                'if (state.status !== "DRAFT") throw new InvoiceNotDraftError("Lines can only change on a draft");\nif (action.input.quantity <= 0) throw new InvalidLineError("Quantity must be positive");\nstate.lines.push({\n  id: action.input.id,\n  description: action.input.description,\n  quantity: action.input.quantity,\n  unitPrice: action.input.unitPrice,\n  vatRate: action.input.vatRate,\n});',
              errors: [
                {
                  id: "97332528-6333-4cff-b572-269e6ce68400",
                  code: "INVOICE_NOT_DRAFT",
                  name: "InvoiceNotDraftError",
                  description: "Lines are locked once issued",
                  template: "",
                },
                {
                  id: "5c30cbad-7a7b-4405-b6da-2f5e1297006c",
                  code: "INVALID_LINE",
                  name: "InvalidLineError",
                  description: "The line quantity is not positive",
                  template: "",
                },
              ],
              examples: [],
              scope: "global",
            },
            {
              id: "9bb40faf-8328-4828-bac9-82f5937f0b94",
              name: "UPDATE_LINE",
              description: "",
              schema:
                "input UpdateLineInput {\n  id: OID!\n  description: String\n  quantity: Float\n  unitPrice: Float\n  vatRate: Float\n}",
              template: "",
              reducer:
                'if (state.status !== "DRAFT") throw new InvoiceNotDraftError("Lines can only change on a draft");\nconst line = state.lines.find((l) => l.id === action.input.id);\nif (!line) throw new LineNotFoundError(`Line ${action.input.id} not found`);\nif (action.input.quantity !== undefined && action.input.quantity !== null) {\n  if (action.input.quantity <= 0) throw new InvalidLineError("Quantity must be positive");\n  line.quantity = action.input.quantity;\n}\nif (action.input.description !== undefined && action.input.description !== null) line.description = action.input.description;\nif (action.input.unitPrice !== undefined && action.input.unitPrice !== null) line.unitPrice = action.input.unitPrice;\nif (action.input.vatRate !== undefined && action.input.vatRate !== null) line.vatRate = action.input.vatRate;',
              errors: [
                {
                  id: "bbeaf2e9-3755-4841-987f-7707b1e98ce9",
                  code: "INVOICE_NOT_DRAFT",
                  name: "InvoiceNotDraftError",
                  description: "Lines are locked once issued",
                  template: "",
                },
                {
                  id: "168a3d57-ced0-4c66-ae94-44ba1a96e818",
                  code: "LINE_NOT_FOUND",
                  name: "LineNotFoundError",
                  description: "No line with that id",
                  template: "",
                },
                {
                  id: "2c69afd8-1bb3-401c-aff1-3d1340f7060f",
                  code: "INVALID_LINE",
                  name: "InvalidLineError",
                  description: "The line quantity is not positive",
                  template: "",
                },
              ],
              examples: [],
              scope: "global",
            },
            {
              id: "955f8434-3dab-417c-b792-c66677411be3",
              name: "REMOVE_LINE",
              description: "",
              schema: "input RemoveLineInput {\n  id: OID!\n}",
              template: "",
              reducer:
                'if (state.status !== "DRAFT") throw new InvoiceNotDraftError("Lines can only change on a draft");\nconst index = state.lines.findIndex((l) => l.id === action.input.id);\nif (index === -1) throw new LineNotFoundError(`Line ${action.input.id} not found`);\nstate.lines.splice(index, 1);',
              errors: [
                {
                  id: "33e3b580-9bf2-4006-90a1-4c86f77e6b32",
                  code: "INVOICE_NOT_DRAFT",
                  name: "InvoiceNotDraftError",
                  description: "Lines are locked once issued",
                  template: "",
                },
                {
                  id: "dadbc332-26c8-4204-af27-e27cb1073e63",
                  code: "LINE_NOT_FOUND",
                  name: "LineNotFoundError",
                  description: "No line with that id",
                  template: "",
                },
              ],
              examples: [],
              scope: "global",
            },
          ],
        },
        {
          id: "af62891d-2f7e-4a28-8b28-18637839617e",
          name: "lifecycle",
          description: "Issue, settle, void",
          operations: [
            {
              id: "f374d4d9-48c0-4462-9568-8e0eb8715043",
              name: "ISSUE_INVOICE",
              description: "",
              schema:
                "input IssueInvoiceInput {\n  number: String!\n  issuedAt: DateTime!\n  dueAt: DateTime!\n}",
              template: "",
              reducer:
                'if (state.status !== "DRAFT") throw new InvoiceNotDraftError("Only a draft can be issued");\nif (state.lines.length === 0) throw new NoLinesError("An invoice needs at least one line");\nstate.number = action.input.number;\nstate.issuedAt = action.input.issuedAt;\nstate.dueAt = action.input.dueAt;\nstate.status = "OPEN";',
              errors: [
                {
                  id: "50dc2002-8367-4f8e-a7c9-ca725d2e4c59",
                  code: "INVOICE_NOT_DRAFT",
                  name: "InvoiceNotDraftError",
                  description: "The invoice was issued before",
                  template: "",
                },
                {
                  id: "0cc6494c-b5e0-4799-ba74-19bfbabd8f41",
                  code: "NO_LINES",
                  name: "NoLinesError",
                  description: "The invoice has no lines",
                  template: "",
                },
              ],
              examples: [],
              scope: "global",
            },
            {
              id: "e857958a-2f57-4406-a70e-ca09d8e4ea6d",
              name: "RECORD_PAYMENT",
              description: "",
              schema:
                "input RecordPaymentInput {\n  id: OID!\n  paidAt: DateTime!\n  amount: Float!\n  method: PaymentMethod!\n  transactionId: String\n}",
              template: "",
              reducer:
                'if (state.status !== "OPEN") throw new InvoiceNotOpenError("Payments apply to open invoices only");\nif (action.input.amount <= 0) throw new InvalidPaymentError("A payment must be positive");\nstate.payments.push({\n  id: action.input.id,\n  paidAt: action.input.paidAt,\n  amount: action.input.amount,\n  method: action.input.method,\n  transactionId: action.input.transactionId || null,\n});\nconst total = state.lines.reduce((sum, l) => sum + l.quantity * l.unitPrice * (1 + l.vatRate / 100), 0);\nconst paid = state.payments.reduce((sum, p) => sum + p.amount, 0);\nif (paid >= total - 0.005) state.status = "PAID";',
              errors: [
                {
                  id: "ab1a290d-4b1d-41b6-b8de-89084a5ed1a0",
                  code: "INVOICE_NOT_OPEN",
                  name: "InvoiceNotOpenError",
                  description: "The invoice is not open",
                  template: "",
                },
                {
                  id: "e9ffe3b4-b3d4-468f-b69d-8cb02604062a",
                  code: "INVALID_PAYMENT",
                  name: "InvalidPaymentError",
                  description: "The payment amount is not positive",
                  template: "",
                },
              ],
              examples: [],
              scope: "global",
            },
            {
              id: "b4ac2cb6-d95f-479c-86cb-0bc51e22362b",
              name: "VOID_INVOICE",
              description: "",
              schema: "input VoidInvoiceInput {\n  reason: String!\n}",
              template: "",
              reducer:
                'if (state.status === "PAID") throw new InvoicePaidError("A paid invoice cannot be voided");\nif (state.status === "VOID") throw new InvoiceVoidError("The invoice is already void");\nstate.status = "VOID";\nstate.voidReason = action.input.reason;',
              errors: [
                {
                  id: "15464351-df9c-464e-a816-2aab371693b3",
                  code: "INVOICE_PAID",
                  name: "InvoicePaidError",
                  description: "The invoice is paid",
                  template: "",
                },
                {
                  id: "91fb21d7-31da-43ac-ba41-1816f2f349e7",
                  code: "INVOICE_VOID",
                  name: "InvoiceVoidError",
                  description: "The invoice is already void",
                  template: "",
                },
              ],
              examples: [],
              scope: "global",
            },
          ],
        },
      ],
    },
    {
      version: 2,
      changeLog: [
        "Aligned to EN 16931 / Peppol BIS Billing 3.0: invoice or credit note, seller and buyer, delivery date and period, VAT categories and exemption reasons, VAT currency and exchange rates, forward-billed costs, payment instructions, attachments at invoice and line level.",
      ],
      state: {
        global: {
          schema:
            'type InvoiceState {\n  "BT-3: an invoice (380) or a credit note (381)"\n  kind: InvoiceKind!\n  direction: InvoiceDirection!\n  status: InvoiceStatus!\n  "BT-1"\n  number: String\n  "What the invoice is for, e.g. Powerhouse expenses, January 2026"\n  subject: String\n  "BT-2"\n  issuedAt: DateTime\n  "BT-9"\n  dueAt: DateTime\n  "BT-72"\n  deliveredAt: DateTime\n  "BG-14"\n  period: InvoicePeriod\n  "BT-5"\n  currency: String!\n  "BT-6: the currency VAT is accounted in, when it is not the invoice currency"\n  vatCurrency: String\n  "1 base = rate quote. Converts forward-billed costs and the VAT total (BT-111)."\n  exchangeRates: [ExchangeRate!]!\n  "BG-4"\n  seller: InvoiceParty!\n  "BG-7"\n  buyer: InvoiceParty!\n  references: InvoiceReferences!\n  "BG-3: the invoices a credit note corrects"\n  precedingInvoices: [PrecedingInvoice!]!\n  "BG-25"\n  lines: [InvoiceLine!]!\n  "BT-120/121 per VAT category (BG-23)"\n  vatReasons: [VatReason!]!\n  "BG-16"\n  paymentInstructions: PaymentInstructions!\n  "BT-20"\n  paymentTerms: String\n  "BT-114"\n  roundingAmount: Float\n  "BT-22"\n  notes: String\n  "BG-24: documents at invoice level"\n  attachments: [InvoiceAttachment!]!\n  payments: [Payment!]!\n  voidReason: String\n}\n\nenum InvoiceKind {\n  INVOICE\n  CREDIT_NOTE\n}\n\nenum InvoiceDirection {\n  OUTGOING\n  INCOMING\n}\n\nenum InvoiceStatus {\n  DRAFT\n  OPEN\n  PAID\n  VOID\n}\n\ntype InvoicePeriod {\n  start: DateTime\n  end: DateTime\n}\n\ntype ExchangeRate {\n  base: String!\n  quote: String!\n  rate: Float!\n  "The day the rate applies to"\n  date: DateTime\n  "Where the rate comes from, e.g. ECB, a bank statement"\n  source: String\n}\n\ntype InvoiceParty {\n  "BT-27 / BT-44"\n  name: String\n  contactId: PHID\n  "BT-31 / BT-48, with the country prefix"\n  vatId: String\n  "BT-30 / BT-47"\n  registrationId: String\n  "ISO 6523 ICD scheme of the registration id, e.g. 0208 (BE), 0184 (DK), 0183 (CH)"\n  registrationScheme: String\n  "BT-34 / BT-49: the Peppol address"\n  endpointId: String\n  endpointScheme: String\n  email: String\n  phone: String\n  street: String\n  additionalStreet: String\n  postalCode: String\n  city: String\n  region: String\n  "ISO 3166-1 alpha-2"\n  country: String\n}\n\ntype InvoiceReferences {\n  "BT-10"\n  buyerReference: String\n  "BT-13"\n  orderReference: String\n  "BT-12"\n  contractReference: String\n  "BT-11"\n  projectReference: String\n}\n\ntype PrecedingInvoice {\n  id: OID!\n  "BT-25"\n  number: String!\n  "BT-26"\n  issuedAt: DateTime\n  "The corrected invoice, when it is a document here"\n  documentId: PHID\n}\n\nenum VatCategory {\n  "S"\n  STANDARD\n  "Z"\n  ZERO_RATED\n  "E"\n  EXEMPT\n  "AE"\n  REVERSE_CHARGE\n  "K"\n  INTRA_COMMUNITY\n  "G"\n  EXPORT\n  "O"\n  OUTSIDE_SCOPE\n}\n\ntype InvoiceLine {\n  id: OID!\n  "BT-153"\n  description: String!\n  "BT-127"\n  note: String\n  "BT-129: negative for a deduction"\n  quantity: Float!\n  "BT-130: UN/ECE Rec 20, e.g. C62 (unit), HUR (hour), DAY"\n  unitCode: String!\n  "BT-146, in the invoice currency; never negative"\n  unitPrice: Float!\n  "BT-151"\n  vatCategory: VatCategory!\n  "BT-152, percent"\n  vatRate: Float!\n  "BT-133: the buyer\'s accounting reference, e.g. Software, Travel"\n  category: String\n  "BG-26"\n  period: InvoicePeriod\n  "A forward-billed cost: what it cost, in its own currency"\n  original: OriginalAmount\n  "Receipts and other evidence for this line"\n  attachments: [InvoiceAttachment!]!\n}\n\ntype OriginalAmount {\n  amount: Float!\n  currency: String!\n  "1 original currency = rate invoice currency; null uses the invoice\'s exchange rates"\n  rate: Float\n  "The supplier\'s invoice or receipt number"\n  reference: String\n}\n\ntype VatReason {\n  category: VatCategory!\n  "BT-121: a VATEX code, e.g. VATEX-EU-AE"\n  code: String\n  "BT-120: the legal mention as printed"\n  text: String\n}\n\ntype PaymentInstructions {\n  "BT-81: UNCL 4461, e.g. 30 or 58 (credit transfer), 48 (card), ZZZ (mutually defined)"\n  meansCode: String\n  "BT-82"\n  meansText: String\n  "BT-84: an IBAN, or another account such as a wallet address"\n  account: String\n  "BT-85"\n  accountName: String\n  "BT-86"\n  bic: String\n  "BT-83"\n  remittance: String\n}\n\nenum AttachmentRole {\n  "The invoice as issued, e.g. the PDF that was sent"\n  ISSUED_COPY\n  "The editable original, e.g. the .docx"\n  SOURCE\n  SUPPORTING\n  RECEIPT\n  TIMESHEET\n  OTHER\n}\n\ntype InvoiceAttachment {\n  id: OID!\n  role: AttachmentRole!\n  fileName: String!\n  mimeType: String!\n  "Stored bytes"\n  ref: AttachmentRef\n  sizeBytes: Int\n  "BT-123"\n  description: String\n  "BT-124: an external location"\n  url: URL\n  "A document here that holds it, e.g. a File in the Files drive"\n  documentId: PHID\n  addedAt: DateTime!\n}\n\nenum PaymentMethod {\n  BANK_TRANSFER\n  CARD\n  CASH\n  OTHER\n}\n\ntype Payment {\n  id: OID!\n  paidAt: DateTime!\n  amount: Float!\n  method: PaymentMethod!\n  transactionId: String\n}',
          initialValue:
            '{\n  "kind": "INVOICE",\n  "direction": "OUTGOING",\n  "status": "DRAFT",\n  "number": null,\n  "subject": null,\n  "issuedAt": null,\n  "dueAt": null,\n  "deliveredAt": null,\n  "period": null,\n  "currency": "EUR",\n  "vatCurrency": null,\n  "exchangeRates": [],\n  "seller": {\n    "name": null,\n    "contactId": null,\n    "vatId": null,\n    "registrationId": null,\n    "registrationScheme": null,\n    "endpointId": null,\n    "endpointScheme": null,\n    "email": null,\n    "phone": null,\n    "street": null,\n    "additionalStreet": null,\n    "postalCode": null,\n    "city": null,\n    "region": null,\n    "country": null\n  },\n  "buyer": {\n    "name": null,\n    "contactId": null,\n    "vatId": null,\n    "registrationId": null,\n    "registrationScheme": null,\n    "endpointId": null,\n    "endpointScheme": null,\n    "email": null,\n    "phone": null,\n    "street": null,\n    "additionalStreet": null,\n    "postalCode": null,\n    "city": null,\n    "region": null,\n    "country": null\n  },\n  "references": {\n    "buyerReference": null,\n    "orderReference": null,\n    "contractReference": null,\n    "projectReference": null\n  },\n  "precedingInvoices": [],\n  "lines": [],\n  "vatReasons": [],\n  "paymentInstructions": {\n    "meansCode": null,\n    "meansText": null,\n    "account": null,\n    "accountName": null,\n    "bic": null,\n    "remittance": null\n  },\n  "paymentTerms": null,\n  "roundingAmount": null,\n  "notes": null,\n  "attachments": [],\n  "payments": [],\n  "voidReason": null\n}',
          examples: [],
        },
        local: {
          schema: "",
          initialValue: "",
          examples: [],
        },
      },
      modules: [
        {
          id: "ecf10e85-a8dc-4a93-a0c5-c3b98273424e",
          name: "header",
          description: "Kind, direction, subject, dates and references",
          operations: [
            {
              id: "36f57779-fbce-40c0-92a0-2254f7e4efd0",
              name: "SET_HEADER",
              description:
                "Sets the header fields; omitted fields stay, null clears",
              schema:
                "input SetHeaderInput {\n  kind: InvoiceKind\n  direction: InvoiceDirection\n  subject: String\n  dueAt: DateTime\n  deliveredAt: DateTime\n  periodStart: DateTime\n  periodEnd: DateTime\n  paymentTerms: String\n  notes: String\n  buyerReference: String\n  orderReference: String\n  contractReference: String\n  projectReference: String\n  roundingAmount: Float\n}",
              template: "",
              reducer:
                'const i = action.input;\nif (state.status === "PAID" || state.status === "VOID")\n  throw new InvoiceClosedError("A paid or void invoice cannot change");\nif (state.status === "OPEN") {\n  const fixed = Object.entries(i).find(\n    ([key, value]) => value !== undefined && !AFTER_ISSUE.has(key),\n  );\n  if (fixed)\n    throw new InvoiceNotDraftError(\n      `The ${fixed[0]} is fixed once the invoice is issued`,\n    );\n}\nconst start =\n  i.periodStart !== undefined\n    ? i.periodStart\n    : (state.period?.start ?? null);\nconst end =\n  i.periodEnd !== undefined ? i.periodEnd : (state.period?.end ?? null);\nif (start && end && end < start)\n  throw new InvalidPeriodError("The period ends before it starts");\n\nif (i.kind) state.kind = i.kind;\nif (i.direction) state.direction = i.direction;\nif (i.subject !== undefined) state.subject = text(i.subject);\nif (i.dueAt !== undefined) state.dueAt = i.dueAt ?? null;\nif (i.deliveredAt !== undefined) state.deliveredAt = i.deliveredAt ?? null;\nif (i.periodStart !== undefined || i.periodEnd !== undefined)\n  state.period = start || end ? { start, end } : null;\nif (i.paymentTerms !== undefined)\n  state.paymentTerms = text(i.paymentTerms);\nif (i.notes !== undefined) state.notes = text(i.notes);\nif (i.buyerReference !== undefined)\n  state.references.buyerReference = text(i.buyerReference);\nif (i.orderReference !== undefined)\n  state.references.orderReference = text(i.orderReference);\nif (i.contractReference !== undefined)\n  state.references.contractReference = text(i.contractReference);\nif (i.projectReference !== undefined)\n  state.references.projectReference = text(i.projectReference);\nif (i.roundingAmount !== undefined)\n  state.roundingAmount =\n    i.roundingAmount === 0 ? null : (i.roundingAmount ?? null);',
              errors: [
                {
                  id: "fa51fd50-1acc-4aec-bd96-a99769617e67",
                  code: "INVOICE_NOT_DRAFT",
                  name: "InvoiceNotDraftError",
                  description: "Only a draft can change",
                  template: "",
                },
                {
                  id: "5824e39f-3d20-44f3-bd1a-7242cf144768",
                  code: "INVOICE_CLOSED",
                  name: "InvoiceClosedError",
                  description: "A paid or void invoice cannot change",
                  template: "",
                },
                {
                  id: "cf4bd14a-31e9-4a8b-bb39-2a2895ed9ceb",
                  code: "INVALID_PERIOD",
                  name: "InvalidPeriodError",
                  description: "The period ends before it starts",
                  template: "",
                },
              ],
              examples: [],
              scope: "global",
            },
            {
              id: "4405acdd-20c9-4521-8afd-8ece37be8574",
              name: "ADD_PRECEDING_INVOICE",
              description: "References an invoice this credit note corrects",
              schema:
                "input AddPrecedingInvoiceInput {\n  id: OID!\n  number: String!\n  issuedAt: DateTime\n  documentId: PHID\n}",
              template: "",
              reducer:
                'const i = action.input;\nif (state.status !== "DRAFT")\n  throw new InvoiceNotDraftError(\n    "References are fixed once the invoice is issued",\n  );\nif (state.precedingInvoices.some((p) => p.id === i.id))\n  throw new DuplicateReferenceError("The id is already used");\nstate.precedingInvoices.push({\n  id: i.id,\n  number: i.number.trim(),\n  issuedAt: i.issuedAt ?? null,\n  documentId: i.documentId ?? null,\n});',
              errors: [
                {
                  id: "6cd2f483-eab8-4bf5-b428-93fa412682a1",
                  code: "INVOICE_NOT_DRAFT",
                  name: "InvoiceNotDraftError",
                  description: "Only a draft can change",
                  template: "",
                },
                {
                  id: "1b7c7fcf-a599-4ece-97e6-4b1982300407",
                  code: "DUPLICATE_REFERENCE",
                  name: "DuplicateReferenceError",
                  description: "The id is already used",
                  template: "",
                },
              ],
              examples: [],
              scope: "global",
            },
            {
              id: "97acfc5a-db22-4b59-98fd-45cd9ea87efb",
              name: "REMOVE_PRECEDING_INVOICE",
              description: "Removes a preceding invoice reference",
              schema: "input RemovePrecedingInvoiceInput {\n  id: OID!\n}",
              template: "",
              reducer:
                'if (state.status !== "DRAFT")\n  throw new InvoiceNotDraftError(\n    "References are fixed once the invoice is issued",\n  );\nconst index = state.precedingInvoices.findIndex(\n  (p) => p.id === action.input.id,\n);\nif (index < 0) throw new ReferenceNotFoundError("No such reference");\nstate.precedingInvoices.splice(index, 1);',
              errors: [
                {
                  id: "ee3a7ad9-3c13-4b04-b17d-fbb5eec9533b",
                  code: "INVOICE_NOT_DRAFT",
                  name: "InvoiceNotDraftError",
                  description: "Only a draft can change",
                  template: "",
                },
                {
                  id: "78e71b5f-d916-49f8-b9e7-b60070d4b40b",
                  code: "REFERENCE_NOT_FOUND",
                  name: "ReferenceNotFoundError",
                  description: "No such reference",
                  template: "",
                },
              ],
              examples: [],
              scope: "global",
            },
          ],
        },
        {
          id: "74b5ca3a-4a80-4509-bd0e-b94a5ffed03a",
          name: "parties",
          description: "Seller and buyer, copied onto the invoice",
          operations: [
            {
              id: "60b9b996-7d71-494b-8cb0-1c8b92505e47",
              name: "SET_SELLER",
              description:
                "Sets the seller fields; omitted fields stay, null clears",
              schema:
                "input SetSellerInput {\n  name: String\n  contactId: PHID\n  vatId: String\n  registrationId: String\n  registrationScheme: String\n  endpointId: String\n  endpointScheme: String\n  email: String\n  phone: String\n  street: String\n  additionalStreet: String\n  postalCode: String\n  city: String\n  region: String\n  country: String\n}",
              template: "",
              reducer:
                'if (state.status !== "DRAFT")\n  throw new InvoiceNotDraftError(\n    "The parties are fixed once the invoice is issued",\n  );\napplyParty(state.seller, action.input);',
              errors: [
                {
                  id: "16fcd203-e764-4a9c-9a3d-a6c15c6c156f",
                  code: "INVOICE_NOT_DRAFT",
                  name: "InvoiceNotDraftError",
                  description: "Only a draft can change",
                  template: "",
                },
              ],
              examples: [],
              scope: "global",
            },
            {
              id: "a5229dde-143a-4259-a5f6-6e6b898dd8de",
              name: "SET_BUYER",
              description:
                "Sets the buyer fields; omitted fields stay, null clears",
              schema:
                "input SetBuyerInput {\n  name: String\n  contactId: PHID\n  vatId: String\n  registrationId: String\n  registrationScheme: String\n  endpointId: String\n  endpointScheme: String\n  email: String\n  phone: String\n  street: String\n  additionalStreet: String\n  postalCode: String\n  city: String\n  region: String\n  country: String\n}",
              template: "",
              reducer:
                'if (state.status !== "DRAFT")\n  throw new InvoiceNotDraftError(\n    "The parties are fixed once the invoice is issued",\n  );\napplyParty(state.buyer, action.input);',
              errors: [
                {
                  id: "a0820906-9692-4b6a-b69f-aeb84f827bdc",
                  code: "INVOICE_NOT_DRAFT",
                  name: "InvoiceNotDraftError",
                  description: "Only a draft can change",
                  template: "",
                },
              ],
              examples: [],
              scope: "global",
            },
          ],
        },
        {
          id: "6b8b9e4a-dd0c-46dd-9c10-1dea7976750a",
          name: "currency",
          description: "Invoice and VAT currencies, exchange rates",
          operations: [
            {
              id: "e512b657-3ce7-4135-83f6-bb73b1f3a309",
              name: "SET_CURRENCY",
              description:
                "Sets the invoice currency and the VAT accounting currency",
              schema:
                "input SetCurrencyInput {\n  currency: String\n  vatCurrency: String\n}",
              template: "",
              reducer:
                'if (state.status !== "DRAFT")\n  throw new InvoiceNotDraftError(\n    "The currency is fixed once the invoice is issued",\n  );\nconst currency =\n  action.input.currency === undefined || action.input.currency === null\n    ? state.currency\n    : code(action.input.currency);\nconst vatCurrency =\n  action.input.vatCurrency === undefined\n    ? state.vatCurrency\n    : code(action.input.vatCurrency);\nif (!isCurrencyCode(currency))\n  throw new InvalidCurrencyError(\n    "The currency must be an ISO 4217 code, such as EUR",\n  );\nif (\n  vatCurrency !== null &&\n  vatCurrency !== undefined &&\n  !isCurrencyCode(vatCurrency)\n)\n  throw new InvalidCurrencyError(\n    "The VAT currency must be an ISO 4217 code, such as EUR",\n  );\nif (vatCurrency === currency)\n  throw new InvalidCurrencyError(\n    "The VAT currency is only set when it differs from the invoice currency",\n  );\nstate.currency = currency;\nstate.vatCurrency = vatCurrency ?? null;\nrepriceLines(state);',
              errors: [
                {
                  id: "6d966609-e441-4fee-9cb8-a084d9ecc206",
                  code: "INVOICE_NOT_DRAFT",
                  name: "InvoiceNotDraftError",
                  description: "Only a draft can change",
                  template: "",
                },
                {
                  id: "095d4c70-fb63-4808-9df8-f91b088317f5",
                  code: "INVALID_CURRENCY",
                  name: "InvalidCurrencyError",
                  description:
                    "Not an ISO 4217 code, or the VAT currency equals the invoice currency",
                  template: "",
                },
              ],
              examples: [],
              scope: "global",
            },
            {
              id: "dee4e56b-9905-4956-ad0e-40048ebf101d",
              name: "SET_EXCHANGE_RATE",
              description:
                "Adds or replaces the rate for a currency pair: 1 base = rate quote",
              schema:
                "input SetExchangeRateInput {\n  base: String!\n  quote: String!\n  rate: Float!\n  date: DateTime\n  source: String\n}",
              template: "",
              reducer:
                'const i = action.input;\nif (state.status !== "DRAFT")\n  throw new InvoiceNotDraftError(\n    "Exchange rates are fixed once the invoice is issued",\n  );\nconst base = code(i.base);\nconst quote = code(i.quote);\nif (!isCurrencyCode(base) || !isCurrencyCode(quote) || base === quote)\n  throw new InvalidRateError(\n    "A rate links two different ISO 4217 currencies",\n  );\nif (!Number.isFinite(i.rate) || i.rate <= 0)\n  throw new InvalidRateError("The rate must be positive");\nconst kept = state.exchangeRates.filter(\n  (r) =>\n    !(\n      (r.base === base && r.quote === quote) ||\n      (r.base === quote && r.quote === base)\n    ),\n);\nkept.push({\n  base,\n  quote,\n  rate: i.rate,\n  date: i.date ?? null,\n  source: text(i.source),\n});\nstate.exchangeRates = kept;\nrepriceLines(state);',
              errors: [
                {
                  id: "aa745ee6-cb76-4f48-900b-eec57eeb2138",
                  code: "INVOICE_NOT_DRAFT",
                  name: "InvoiceNotDraftError",
                  description: "Only a draft can change",
                  template: "",
                },
                {
                  id: "cddd22cb-d9be-48da-85a6-7aa2711c7891",
                  code: "INVALID_RATE",
                  name: "InvalidRateError",
                  description:
                    "The rate must be positive between two different ISO 4217 currencies",
                  template: "",
                },
              ],
              examples: [],
              scope: "global",
            },
            {
              id: "9e448135-78e5-42df-bfa3-666724430ef4",
              name: "REMOVE_EXCHANGE_RATE",
              description:
                "Removes the rate for a currency pair (either direction)",
              schema:
                "input RemoveExchangeRateInput {\n  base: String!\n  quote: String!\n}",
              template: "",
              reducer:
                'if (state.status !== "DRAFT")\n  throw new InvoiceNotDraftError(\n    "Exchange rates are fixed once the invoice is issued",\n  );\nconst base = code(action.input.base);\nconst quote = code(action.input.quote);\nconst index = state.exchangeRates.findIndex(\n  (r) =>\n    (r.base === base && r.quote === quote) ||\n    (r.base === quote && r.quote === base),\n);\nif (index < 0) throw new RateNotFoundError("No rate for that pair");\nstate.exchangeRates.splice(index, 1);',
              errors: [
                {
                  id: "e21ed02d-31b8-4e64-9bda-b268250fc89e",
                  code: "INVOICE_NOT_DRAFT",
                  name: "InvoiceNotDraftError",
                  description: "Only a draft can change",
                  template: "",
                },
                {
                  id: "bbf93ae8-12ed-4c8c-a422-0c4e11bcda0e",
                  code: "RATE_NOT_FOUND",
                  name: "RateNotFoundError",
                  description: "No rate for that pair",
                  template: "",
                },
              ],
              examples: [],
              scope: "global",
            },
          ],
        },
        {
          id: "ea56a8c6-2fc8-4c32-8328-7f0901f50fa0",
          name: "lines",
          description: "Invoice lines",
          operations: [
            {
              id: "2f1fc9c2-9da3-4191-8127-5b79102767fb",
              name: "ADD_LINE",
              description: "Adds a line, at the end or at a position",
              schema:
                "input AddLineInput {\n  id: OID!\n  description: String!\n  note: String\n  quantity: Float!\n  unitCode: String\n  unitPrice: Float!\n  vatCategory: VatCategory!\n  vatRate: Float!\n  category: String\n  periodStart: DateTime\n  periodEnd: DateTime\n  originalAmount: Float\n  originalCurrency: String\n  originalRate: Float\n  originalReference: String\n  position: Int\n}",
              template: "",
              reducer:
                'const i = action.input;\nif (state.status !== "DRAFT")\n  throw new InvoiceNotDraftError("Lines can only change on a draft");\nif (state.lines.some((l) => l.id === i.id))\n  throw new InvalidLineError("The line id is already used");\nconst amount = i.originalAmount;\nconst originalCurrency = code(i.originalCurrency);\nif (amount !== undefined && amount !== null && !originalCurrency)\n  throw new InvalidLineError(\n    "A forward-billed cost needs an amount and a currency",\n  );\nconst line: InvoiceLine = {\n  id: i.id,\n  description: i.description.trim(),\n  note: text(i.note),\n  quantity: i.quantity,\n  unitCode: code(i.unitCode) ?? "C62",\n  unitPrice: i.unitPrice,\n  vatCategory: i.vatCategory,\n  vatRate: i.vatRate,\n  category: text(i.category),\n  period:\n    i.periodStart || i.periodEnd\n      ? { start: i.periodStart ?? null, end: i.periodEnd ?? null }\n      : null,\n  original:\n    amount !== undefined && amount !== null && originalCurrency\n      ? {\n          amount,\n          currency: originalCurrency,\n          rate: i.originalRate ?? null,\n          reference: text(i.originalReference),\n        }\n      : null,\n  attachments: [],\n};\nderivePrice(state, line);\nconst problem = lineProblem(line);\nif (problem) throw new InvalidLineError(problem);\nconst at =\n  i.position === undefined || i.position === null\n    ? state.lines.length\n    : Math.max(0, Math.min(state.lines.length, i.position));\nstate.lines.splice(at, 0, line);',
              errors: [
                {
                  id: "5768c1dd-cba3-4fba-a20e-91cb1efad070",
                  code: "INVOICE_NOT_DRAFT",
                  name: "InvoiceNotDraftError",
                  description: "Only a draft can change",
                  template: "",
                },
                {
                  id: "23409dc9-7eac-4dab-ad7e-6165ba45cf82",
                  code: "INVALID_LINE",
                  name: "InvalidLineError",
                  description:
                    "The line breaks a rule: zero quantity, negative price, a VAT rate that does not fit its category, a bad currency",
                  template: "",
                },
              ],
              examples: [],
              scope: "global",
            },
            {
              id: "1fd8e336-820e-417c-aabb-0ec300ccf141",
              name: "UPDATE_LINE",
              description:
                "Changes a line; omitted fields stay, null clears the optional ones",
              schema:
                "input UpdateLineInput {\n  id: OID!\n  description: String\n  note: String\n  quantity: Float\n  unitCode: String\n  unitPrice: Float\n  vatCategory: VatCategory\n  vatRate: Float\n  category: String\n  periodStart: DateTime\n  periodEnd: DateTime\n  originalAmount: Float\n  originalCurrency: String\n  originalRate: Float\n  originalReference: String\n}",
              template: "",
              reducer:
                'if (state.status !== "DRAFT")\n  throw new InvoiceNotDraftError("Lines can only change on a draft");\nconst index = state.lines.findIndex((l) => l.id === action.input.id);\nif (index < 0) throw new LineNotFoundError("No such line");\nconst next = updated(state.lines[index], action.input);\nderivePrice(state, next);\nconst problem = lineProblem(next);\nif (problem) throw new InvalidLineError(problem);\nstate.lines[index] = next;',
              errors: [
                {
                  id: "4e09d8b4-45ed-4d69-bc04-6a6a39e9f47c",
                  code: "INVOICE_NOT_DRAFT",
                  name: "InvoiceNotDraftError",
                  description: "Only a draft can change",
                  template: "",
                },
                {
                  id: "5e419743-6b17-4f07-b342-565527f3c216",
                  code: "LINE_NOT_FOUND",
                  name: "LineNotFoundError",
                  description: "No such line",
                  template: "",
                },
                {
                  id: "a5a116ba-c81d-468d-803f-1d705d8e342b",
                  code: "INVALID_LINE",
                  name: "InvalidLineError",
                  description:
                    "The line breaks a rule: zero quantity, negative price, a VAT rate that does not fit its category, a bad currency",
                  template: "",
                },
              ],
              examples: [],
              scope: "global",
            },
            {
              id: "c257b922-f716-40b0-b201-61d0d3597980",
              name: "REMOVE_LINE",
              description: "Removes a line and its attachments",
              schema: "input RemoveLineInput {\n  id: OID!\n}",
              template: "",
              reducer:
                'if (state.status !== "DRAFT")\n  throw new InvoiceNotDraftError("Lines can only change on a draft");\nconst index = state.lines.findIndex((l) => l.id === action.input.id);\nif (index < 0) throw new LineNotFoundError("No such line");\nstate.lines.splice(index, 1);',
              errors: [
                {
                  id: "35b0f567-3e4f-4a2c-a937-eb0aeb4d7a59",
                  code: "INVOICE_NOT_DRAFT",
                  name: "InvoiceNotDraftError",
                  description: "Only a draft can change",
                  template: "",
                },
                {
                  id: "e178bbe1-e5dd-4457-9bc0-983bf33c1e44",
                  code: "LINE_NOT_FOUND",
                  name: "LineNotFoundError",
                  description: "No such line",
                  template: "",
                },
              ],
              examples: [],
              scope: "global",
            },
            {
              id: "5bb4b584-2f11-4f8c-9650-2fcc83d95ff3",
              name: "MOVE_LINE",
              description: "Moves a line to a position",
              schema: "input MoveLineInput {\n  id: OID!\n  index: Int!\n}",
              template: "",
              reducer:
                'if (state.status !== "DRAFT")\n  throw new InvoiceNotDraftError("Lines can only change on a draft");\nconst index = state.lines.findIndex((l) => l.id === action.input.id);\nif (index < 0) throw new LineNotFoundError("No such line");\nstate.lines.splice(index, 1);',
              errors: [
                {
                  id: "14d6adb5-1c8a-45d2-a3a9-c23753ed8260",
                  code: "INVOICE_NOT_DRAFT",
                  name: "InvoiceNotDraftError",
                  description: "Only a draft can change",
                  template: "",
                },
                {
                  id: "e8594f57-4e58-4830-b22b-4674c9500ad6",
                  code: "LINE_NOT_FOUND",
                  name: "LineNotFoundError",
                  description: "No such line",
                  template: "",
                },
              ],
              examples: [],
              scope: "global",
            },
          ],
        },
        {
          id: "e167afde-0adc-4633-bc5d-bce88c847841",
          name: "vat",
          description: "VAT exemption reasons per category",
          operations: [
            {
              id: "0ada5a70-952e-448b-9250-42d4e33a409c",
              name: "SET_VAT_REASON",
              description: "Sets the exemption reason for a VAT category",
              schema:
                "input SetVatReasonInput {\n  category: VatCategory!\n  code: String\n  text: String\n}",
              template: "",
              reducer:
                'const i = action.input;\nif (state.status !== "DRAFT")\n  throw new InvoiceNotDraftError(\n    "VAT reasons are fixed once the invoice is issued",\n  );\nif (!CATEGORY_NEEDS_REASON[i.category])\n  throw new InvalidVatReasonError(\n    "Standard and zero-rated VAT take no exemption reason",\n  );\nconst reasonCode = code(i.code);\nconst reasonText = text(i.text);\nif (!reasonCode && !reasonText)\n  throw new InvalidVatReasonError(\n    "A reason needs a VATEX code or the legal mention",\n  );\nconst reason = { category: i.category, code: reasonCode, text: reasonText };\nconst index = state.vatReasons.findIndex((r) => r.category === i.category);\nif (index >= 0) state.vatReasons[index] = reason;\nelse state.vatReasons.push(reason);',
              errors: [
                {
                  id: "fa1963ac-8b11-4a0a-83a0-962cc182f417",
                  code: "INVOICE_NOT_DRAFT",
                  name: "InvoiceNotDraftError",
                  description: "Only a draft can change",
                  template: "",
                },
                {
                  id: "3ad8e79e-b8da-4e3e-9f69-4b350c9d6cb4",
                  code: "INVALID_VAT_REASON",
                  name: "InvalidVatReasonError",
                  description:
                    "Standard and zero-rated VAT take no exemption reason; a reason needs a code or a text",
                  template: "",
                },
              ],
              examples: [],
              scope: "global",
            },
            {
              id: "6d767b4e-7dd4-4062-ba86-dc596a6bbc73",
              name: "REMOVE_VAT_REASON",
              description: "Removes the exemption reason for a VAT category",
              schema:
                "input RemoveVatReasonInput {\n  category: VatCategory!\n}",
              template: "",
              reducer:
                'if (state.status !== "DRAFT")\n  throw new InvoiceNotDraftError(\n    "VAT reasons are fixed once the invoice is issued",\n  );\nconst index = state.vatReasons.findIndex(\n  (r) => r.category === action.input.category,\n);\nif (index < 0)\n  throw new VatReasonNotFoundError("No reason for that category");\nstate.vatReasons.splice(index, 1);',
              errors: [
                {
                  id: "1beb63d7-6329-4861-aec0-d895ab87bcbd",
                  code: "INVOICE_NOT_DRAFT",
                  name: "InvoiceNotDraftError",
                  description: "Only a draft can change",
                  template: "",
                },
                {
                  id: "045b7012-4bfe-4afc-bcca-8087ff7b3758",
                  code: "VAT_REASON_NOT_FOUND",
                  name: "VatReasonNotFoundError",
                  description: "No reason for that category",
                  template: "",
                },
              ],
              examples: [],
              scope: "global",
            },
          ],
        },
        {
          id: "80249a7c-076c-4040-8bce-ec9ca0308893",
          name: "payment",
          description: "Payment instructions",
          operations: [
            {
              id: "e3f0a782-445b-40c4-8093-307045bc1d2a",
              name: "SET_PAYMENT_INSTRUCTIONS",
              description: "Sets how to pay; omitted fields stay, null clears",
              schema:
                "input SetPaymentInstructionsInput {\n  meansCode: String\n  meansText: String\n  account: String\n  accountName: String\n  bic: String\n  remittance: String\n}",
              template: "",
              reducer:
                'const i = action.input;\nif (state.status !== "DRAFT")\n  throw new InvoiceNotDraftError(\n    "Payment instructions are fixed once the invoice is issued",\n  );\nconst p = state.paymentInstructions;\nif (i.meansCode !== undefined) p.meansCode = code(i.meansCode);\nif (i.meansText !== undefined) p.meansText = text(i.meansText);\n// An IBAN reads in groups of four but is stored without spaces; any other account stays as given.\nif (i.account !== undefined) {\n  const account = text(i.account);\n  p.account =\n    account && /^[A-Z]{2}\\d{2}[A-Z0-9 ]+$/i.test(account)\n      ? account.replace(/\\s+/g, "").toUpperCase()\n      : account;\n}\nif (i.accountName !== undefined)\n  p.accountName = text(i.accountName);\nif (i.bic !== undefined) p.bic = code(i.bic);\nif (i.remittance !== undefined) p.remittance = text(i.remittance);',
              errors: [
                {
                  id: "48f477bb-bf3d-4151-8d54-a473ea9520d4",
                  code: "INVOICE_NOT_DRAFT",
                  name: "InvoiceNotDraftError",
                  description: "Only a draft can change",
                  template: "",
                },
              ],
              examples: [],
              scope: "global",
            },
          ],
        },
        {
          id: "3a9233b4-c41f-4c6d-866b-08b73b9b2f3f",
          name: "attachments",
          description:
            "Documents at invoice and line level; they can be added after issuing",
          operations: [
            {
              id: "582cd67e-6378-459b-b589-32d907094291",
              name: "ADD_ATTACHMENT",
              description: "Attaches a document to the invoice, or to a line",
              schema:
                "input AddAttachmentInput {\n  id: OID!\n  lineId: OID\n  role: AttachmentRole!\n  fileName: String!\n  mimeType: String!\n  ref: AttachmentRef\n  sizeBytes: Int\n  description: String\n  url: URL\n  documentId: PHID\n  addedAt: DateTime!\n}",
              template: "",
              reducer:
                'const i = action.input;\nif (state.status === "VOID")\n  throw new AttachmentsClosedError("A void invoice takes no attachments");\nconst line = i.lineId\n  ? state.lines.find((l) => l.id === i.lineId)\n  : undefined;\nif (i.lineId && !line)\n  throw new AttachmentLineNotFoundError("No such line");\nif (allAttachments(state).some((a) => a.id === i.id))\n  throw new InvalidAttachmentError("The attachment id is already used");\nconst fileName = i.fileName.trim();\nconst mimeType = i.mimeType.trim().toLowerCase();\nif (!fileName || !mimeType)\n  throw new InvalidAttachmentError(\n    "An attachment needs a file name and a type",\n  );\nif (!i.ref && !i.url && !i.documentId)\n  throw new InvalidAttachmentError(\n    "An attachment needs stored bytes, a URL or a document",\n  );\nconst attachment = {\n  id: i.id,\n  role: i.role,\n  fileName,\n  mimeType,\n  ref: i.ref ?? null,\n  sizeBytes: i.sizeBytes ?? null,\n  description: text(i.description),\n  url: i.url ?? null,\n  documentId: i.documentId ?? null,\n  addedAt: i.addedAt,\n};\n(line ? line.attachments : state.attachments).push(attachment);',
              errors: [
                {
                  id: "efb1972e-295b-449f-9ae6-5c9d2c083bd6",
                  code: "ATTACHMENTS_CLOSED",
                  name: "AttachmentsClosedError",
                  description: "A void invoice takes no attachments",
                  template: "",
                },
                {
                  id: "926a0a18-7438-4467-8282-6888fe3e7978",
                  code: "ATTACHMENT_LINE_NOT_FOUND",
                  name: "AttachmentLineNotFoundError",
                  description: "No such line",
                  template: "",
                },
                {
                  id: "db28649b-e5fa-463b-a512-58bf0f563368",
                  code: "INVALID_ATTACHMENT",
                  name: "InvalidAttachmentError",
                  description:
                    "An attachment needs stored bytes, a URL or a document, and a unique id",
                  template: "",
                },
              ],
              examples: [],
              scope: "global",
            },
            {
              id: "2d443766-dff4-449e-b3cf-c79a3a3bbc35",
              name: "UPDATE_ATTACHMENT",
              description: "Changes an attachment role, name or description",
              schema:
                "input UpdateAttachmentInput {\n  id: OID!\n  role: AttachmentRole\n  fileName: String\n  description: String\n  url: URL\n  documentId: PHID\n}",
              template: "",
              reducer:
                'const i = action.input;\nif (state.status === "VOID")\n  throw new AttachmentsClosedError("A void invoice takes no attachments");\nconst at = locateAttachment(state, i.id);\nif (!at) throw new AttachmentNotFoundError("No such attachment");\nconst attachment = at.list[at.index];\nif (i.role) attachment.role = i.role;\nif (i.fileName)\n  attachment.fileName = i.fileName.trim() || attachment.fileName;\nif (i.description !== undefined)\n  attachment.description = text(i.description);\nif (i.url !== undefined) attachment.url = i.url ?? null;\nif (i.documentId !== undefined)\n  attachment.documentId = i.documentId ?? null;',
              errors: [
                {
                  id: "9769a57e-2ea8-4221-b565-7991baf6027f",
                  code: "ATTACHMENTS_CLOSED",
                  name: "AttachmentsClosedError",
                  description: "A void invoice takes no attachments",
                  template: "",
                },
                {
                  id: "7e37581a-ce7f-406c-8508-6ef1271873fc",
                  code: "ATTACHMENT_NOT_FOUND",
                  name: "AttachmentNotFoundError",
                  description: "No such attachment",
                  template: "",
                },
              ],
              examples: [],
              scope: "global",
            },
            {
              id: "0ea46534-60e9-4395-a163-f19d27eaeae5",
              name: "REMOVE_ATTACHMENT",
              description: "Removes an attachment",
              schema: "input RemoveAttachmentInput {\n  id: OID!\n}",
              template: "",
              reducer:
                'if (state.status === "VOID")\n  throw new AttachmentsClosedError("A void invoice takes no attachments");\nconst at = locateAttachment(state, action.input.id);\nif (!at) throw new AttachmentNotFoundError("No such attachment");\nat.list.splice(at.index, 1);',
              errors: [
                {
                  id: "28f6f764-4306-4651-b595-c5baa7ab8506",
                  code: "ATTACHMENTS_CLOSED",
                  name: "AttachmentsClosedError",
                  description: "A void invoice takes no attachments",
                  template: "",
                },
                {
                  id: "96e04345-0e9a-4ea0-af26-a7e4c200e6bb",
                  code: "ATTACHMENT_NOT_FOUND",
                  name: "AttachmentNotFoundError",
                  description: "No such attachment",
                  template: "",
                },
              ],
              examples: [],
              scope: "global",
            },
            {
              id: "1f53df28-0125-4118-b922-54cffb1fd433",
              name: "MOVE_ATTACHMENT",
              description:
                "Moves an attachment to a line, or to the invoice (lineId null)",
              schema:
                "input MoveAttachmentInput {\n  id: OID!\n  lineId: OID\n}",
              template: "",
              reducer:
                'if (state.status === "VOID")\n  throw new AttachmentsClosedError("A void invoice takes no attachments");\nconst at = locateAttachment(state, action.input.id);\nif (!at) throw new AttachmentNotFoundError("No such attachment");\nat.list.splice(at.index, 1);',
              errors: [
                {
                  id: "ff805ef0-0c40-4eae-95df-eac38fb926db",
                  code: "ATTACHMENTS_CLOSED",
                  name: "AttachmentsClosedError",
                  description: "A void invoice takes no attachments",
                  template: "",
                },
                {
                  id: "819581ae-80da-42a0-ab86-987efef94080",
                  code: "ATTACHMENT_NOT_FOUND",
                  name: "AttachmentNotFoundError",
                  description: "No such attachment",
                  template: "",
                },
                {
                  id: "fca21922-ae6b-4eb1-ae8b-16aabccc8fb9",
                  code: "ATTACHMENT_LINE_NOT_FOUND",
                  name: "AttachmentLineNotFoundError",
                  description: "No such line",
                  template: "",
                },
              ],
              examples: [],
              scope: "global",
            },
          ],
        },
        {
          id: "96ea3e38-2f46-44ff-ae38-91ce9d5a0edb",
          name: "lifecycle",
          description: "Issue, pay, void",
          operations: [
            {
              id: "0dbe8ac3-f8f8-498b-9a8a-aa8c2727e4c0",
              name: "ISSUE_INVOICE",
              description:
                "Issues a draft: it gets its number and dates, and is fixed from then on",
              schema:
                "input IssueInvoiceInput {\n  number: String!\n  issuedAt: DateTime!\n  dueAt: DateTime\n}",
              template: "",
              reducer:
                'const i = action.input;\nif (state.status !== "DRAFT")\n  throw new InvoiceNotDraftError("Only a draft can be issued");\nif (state.lines.length === 0)\n  throw new NoLinesError("An invoice needs at least one line");\nconst number = i.number.trim();\nif (!number)\n  throw new InvalidNumberError("An issued invoice needs a number");\nstate.number = number;\nstate.issuedAt = i.issuedAt;\nif (i.dueAt !== undefined && i.dueAt !== null) state.dueAt = i.dueAt;\nstate.status = "OPEN";',
              errors: [
                {
                  id: "1758785e-6f51-4c32-b683-ced024d0b04f",
                  code: "INVOICE_NOT_DRAFT",
                  name: "InvoiceNotDraftError",
                  description: "Only a draft can change",
                  template: "",
                },
                {
                  id: "73627b04-da29-49c6-bce1-1078443c756b",
                  code: "NO_LINES",
                  name: "NoLinesError",
                  description: "An invoice needs at least one line",
                  template: "",
                },
                {
                  id: "10ef17cb-4327-44d0-a299-a0ebd4ef1a06",
                  code: "INVALID_NUMBER",
                  name: "InvalidNumberError",
                  description: "An issued invoice needs a number",
                  template: "",
                },
              ],
              examples: [],
              scope: "global",
            },
            {
              id: "6707a5f5-86df-4d23-8501-1a0aced60d18",
              name: "RECORD_PAYMENT",
              description:
                "Records a payment; the invoice is paid once payments cover the total",
              schema:
                "input RecordPaymentInput {\n  id: OID!\n  paidAt: DateTime!\n  amount: Float!\n  method: PaymentMethod!\n  transactionId: String\n}",
              template: "",
              reducer:
                'const i = action.input;\nif (state.status !== "OPEN")\n  throw new InvoiceNotOpenError("Payments apply to open invoices only");\nif (!Number.isFinite(i.amount) || i.amount <= 0)\n  throw new InvalidPaymentError("A payment must be positive");\nif (state.payments.some((p) => p.id === i.id))\n  throw new InvalidPaymentError("The payment id is already used");\nstate.payments.push({\n  id: i.id,\n  paidAt: i.paidAt,\n  amount: i.amount,\n  method: i.method,\n  transactionId: i.transactionId?.trim() || null,\n});\nif (settled(computeTotals(state).due)) state.status = "PAID";',
              errors: [
                {
                  id: "75231611-26f2-4618-bb72-eb5095bad32e",
                  code: "INVOICE_NOT_OPEN",
                  name: "InvoiceNotOpenError",
                  description: "Payments apply to open invoices only",
                  template: "",
                },
                {
                  id: "772d5d0d-3549-439d-8861-3d2f164d9722",
                  code: "INVALID_PAYMENT",
                  name: "InvalidPaymentError",
                  description: "A payment must be positive with a unique id",
                  template: "",
                },
              ],
              examples: [],
              scope: "global",
            },
            {
              id: "98c6a810-c814-4d32-a912-f7d183defd64",
              name: "REMOVE_PAYMENT",
              description:
                "Removes a payment recorded by mistake; a paid invoice opens again",
              schema: "input RemovePaymentInput {\n  id: OID!\n}",
              template: "",
              reducer:
                'if (state.status === "VOID")\n  throw new InvoiceVoidError("The invoice is void");\nconst index = state.payments.findIndex((p) => p.id === action.input.id);\nif (index < 0) throw new PaymentNotFoundError("No such payment");\nstate.payments.splice(index, 1);\nif (state.status === "PAID" && !settled(computeTotals(state).due))\n  state.status = "OPEN";',
              errors: [
                {
                  id: "3facc476-5b23-49ce-964a-4abfdf49e256",
                  code: "PAYMENT_NOT_FOUND",
                  name: "PaymentNotFoundError",
                  description: "No such payment",
                  template: "",
                },
                {
                  id: "c336a810-fcad-4dca-9a28-8841849568b4",
                  code: "INVOICE_VOID",
                  name: "InvoiceVoidError",
                  description: "The invoice is void",
                  template: "",
                },
              ],
              examples: [],
              scope: "global",
            },
            {
              id: "efa2c14f-ac6f-4a7e-bd80-5ee903502031",
              name: "VOID_INVOICE",
              description: "Voids a draft or an open invoice",
              schema: "input VoidInvoiceInput {\n  reason: String!\n}",
              template: "",
              reducer:
                'if (state.status === "PAID")\n  throw new InvoicePaidError("A paid invoice cannot be voided");\nif (state.status === "VOID")\n  throw new InvoiceVoidError("The invoice is already void");\nstate.status = "VOID";\nstate.voidReason = action.input.reason.trim() || null;',
              errors: [
                {
                  id: "b4456c90-2527-42df-8bc5-000f6c577494",
                  code: "INVOICE_PAID",
                  name: "InvoicePaidError",
                  description: "A paid invoice cannot be voided",
                  template: "",
                },
                {
                  id: "b69eb1e6-f9d5-4920-af8e-9486cac6bf98",
                  code: "INVOICE_VOID",
                  name: "InvoiceVoidError",
                  description: "The invoice is already void",
                  template: "",
                },
              ],
              examples: [],
              scope: "global",
            },
          ],
        },
      ],
    },
  ],
};
