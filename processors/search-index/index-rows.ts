// Turns a document's state into search rows. Pure, shared by the processor
// (which runs in the switchboard and in the tab's in-process reactor) and by
// its tests. When an operation carries no resulting state, `applyAction`
// patches the rows from the action input instead.
import type { SearchEntry } from "./schema.js";

type Json = Record<string, unknown>;

const str = (v: unknown): string | null =>
  typeof v === "string" && v.trim() ? v.trim() : null;
const num = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;
const text = (...parts: unknown[]) =>
  parts
    .flat()
    .map((p) => (typeof p === "number" ? String(p) : str(p)))
    .filter((p): p is string => !!p)
    .join(" ")
    .toLowerCase();

export const KIND_BY_TYPE: Record<string, string> = {
  "sektar/invoice": "invoice",
  "sektar/contact": "contact",
  "sektar/expense-report": "expense",
  "sektar/bank-account": "account",
};

function base(
  documentId: string,
  documentType: string,
  entityId = "doc",
): SearchEntry {
  return {
    document_id: documentId,
    entity_id: entityId,
    document_type: documentType,
    kind: KIND_BY_TYPE[documentType] ?? "document",
    title: "",
    subtitle: null,
    body: "",
    amount: null,
    status: null,
    at: null,
  };
}

/** Rows for a whole document from its global state. */
export function rowsFromState(
  documentId: string,
  documentType: string,
  state: Json,
): SearchEntry[] {
  const row = base(documentId, documentType);
  switch (documentType) {
    case "sektar/invoice": {
      // v1 has one counterparty; v2 a seller and a buyer, the other party
      // being the buyer of a sales invoice and the seller of a bill.
      const party = (state.counterparty ??
        (state.direction === "INCOMING" ? state.seller : state.buyer) ??
        {}) as Json;
      const refs = (state.references ?? {}) as Json;
      const lines = (state.lines ?? []) as Json[];
      const gross = lines.reduce(
        (s, l) =>
          s +
          (num(l.quantity) ?? 0) *
            (num(l.unitPrice) ?? 0) *
            (1 + (num(l.vatRate) ?? 0) / 100),
        0,
      );
      row.title = str(state.number) ?? "Draft invoice";
      row.subtitle = str(party.name);
      row.amount = Math.round(gross * 100) / 100;
      row.status = str(state.status);
      row.at = str(state.issuedAt) ?? str(state.dueAt);
      row.body = text(
        state.number,
        party.name,
        party.email,
        party.vatId,
        state.reference,
        state.subject,
        refs.buyerReference,
        refs.orderReference,
        state.notes,
        state.direction,
        state.status,
        lines.map((l) => l.description),
        row.amount,
      );
      return [row];
    }
    case "sektar/contact": {
      const address = (state.address ?? {}) as Json;
      const people = (state.people ?? []) as Json[];
      row.title = str(state.name) ?? "Contact";
      row.subtitle =
        [str(address.city), str(address.country)].filter(Boolean).join(", ") ||
        str(state.email);
      row.status = str(state.kind);
      row.body = text(
        state.name,
        state.kind,
        state.email,
        state.phone,
        state.website,
        state.vatId,
        address.city,
        address.country,
        address.street,
        state.tags,
        people.map((p) => [p.name, p.role, p.email]),
        state.notes,
      );
      return [row];
    }
    case "sektar/expense-report": {
      const submitter = (state.submitter ?? {}) as Json;
      const items = (state.items ?? []) as Json[];
      row.title = str(state.title) ?? "Expense claim";
      row.subtitle = str(submitter.name);
      row.amount =
        Math.round(items.reduce((s, i) => s + (num(i.amount) ?? 0), 0) * 100) /
        100;
      row.status = str(state.status);
      row.at = str(state.submittedAt) ?? str(items[0]?.spentAt);
      row.body = text(
        state.title,
        submitter.name,
        submitter.email,
        state.status,
        items.map((i) => [i.merchant, i.note, i.category, i.amount]),
      );
      return [row];
    }
    case "sektar/bank-account": {
      row.title = str(state.name) ?? "Account";
      row.subtitle =
        [str(state.institution), str(state.iban)].filter(Boolean).join(" · ") ||
        null;
      row.status = str(state.kind);
      row.body = text(state.name, state.institution, state.iban, state.kind);
      const txRows = ((state.transactions ?? []) as Json[]).map((t) => {
        const r = base(documentId, documentType, String(t.id));
        r.kind = "transaction";
        r.title = str(t.counterparty) ?? "Transaction";
        r.subtitle = str(t.description) ?? str(state.name);
        r.amount = num(t.amount);
        r.status = str(t.status);
        r.at = str(t.bookedAt);
        r.body = text(
          t.counterparty,
          t.description,
          t.reference,
          t.category,
          t.amount,
          state.name,
        );
        return r;
      });
      return [row, ...txRows];
    }
    default:
      return [];
  }
}

/** Without a resulting state: patch the known rows from the action input. */
export function applyAction(
  rows: SearchEntry[],
  documentId: string,
  documentType: string,
  type: string,
  input: Json,
): SearchEntry[] {
  const doc =
    rows.find((r) => r.entity_id === "doc") ?? base(documentId, documentType);
  const others = rows.filter((r) => r.entity_id !== "doc");
  const touch = (patch: Partial<SearchEntry>, extraBody: unknown[] = []) => {
    Object.assign(doc, patch);
    doc.body = text(doc.body, ...extraBody);
  };
  switch (type) {
    case "SET_INVOICE_DETAILS":
      touch(
        {
          title: str(input.number) ?? (doc.title || "Draft invoice"),
          subtitle: str(input.counterpartyName) ?? doc.subtitle,
        },
        [
          input.number,
          input.counterpartyName,
          input.email,
          input.reference,
          input.notes,
        ],
      );
      break;
    case "SET_BUYER":
    case "SET_SELLER":
      // Which party is the other one depends on the direction, which the
      // action does not carry: index the text, leave the subtitle.
      touch({}, [input.name, input.email, input.vatId]);
      break;
    case "SET_HEADER":
      touch({}, [input.subject, input.buyerReference, input.notes]);
      break;
    case "ISSUE_INVOICE":
      touch(
        {
          title: str(input.number) ?? doc.title,
          status: "OPEN",
          at: str(input.issuedAt),
        },
        [input.number],
      );
      break;
    case "RECORD_PAYMENT":
      touch({}, [input.amount]);
      break;
    case "VOID_INVOICE":
      touch({ status: "VOID" }, [input.reason]);
      break;
    case "ADD_LINE":
    case "UPDATE_LINE":
      touch({}, [input.description]);
      break;
    case "SET_PROFILE":
      touch(
        {
          title: str(input.name) ?? doc.title,
          status: str(input.kind) ?? doc.status,
          subtitle: str(input.email) ?? doc.subtitle,
        },
        [
          input.name,
          input.email,
          input.phone,
          input.website,
          input.vatId,
          input.notes,
        ],
      );
      break;
    case "SET_ADDRESS":
      touch(
        {
          subtitle:
            [str(input.city), str(input.country)].filter(Boolean).join(", ") ||
            doc.subtitle,
        },
        [input.city, input.country, input.street],
      );
      break;
    case "ADD_TAG":
    case "ADD_PERSON":
    case "UPDATE_PERSON":
      touch({}, [input.tag, input.name, input.role, input.email]);
      break;
    case "ARCHIVE_CONTACT":
      touch({ status: input.archived ? "ARCHIVED" : doc.status });
      break;
    case "SET_REPORT_DETAILS":
      touch(
        {
          title: str(input.title) ?? doc.title,
          subtitle: str(input.submitterName) ?? doc.subtitle,
        },
        [input.title, input.submitterName, input.submitterEmail],
      );
      break;
    case "ADD_ITEM":
    case "UPDATE_ITEM":
      touch(
        {
          amount:
            (doc.amount ?? 0) +
            (type === "ADD_ITEM" ? (num(input.amount) ?? 0) : 0),
        },
        [input.merchant, input.note, input.category, input.amount],
      );
      break;
    case "SUBMIT_REPORT":
      touch({ status: "SUBMITTED", at: str(input.submittedAt) });
      break;
    case "APPROVE_REPORT":
      touch({ status: "APPROVED" });
      break;
    case "REJECT_REPORT":
      touch({ status: "REJECTED" });
      break;
    case "REIMBURSE_REPORT":
      touch({ status: "REIMBURSED" });
      break;
    case "SET_ACCOUNT_DETAILS":
      touch(
        {
          title: str(input.name) ?? doc.title,
          subtitle:
            [str(input.institution), str(input.iban)]
              .filter(Boolean)
              .join(" · ") || doc.subtitle,
          status: str(input.kind) ?? doc.status,
        },
        [input.name, input.institution, input.iban],
      );
      break;
    case "IMPORT_TRANSACTIONS": {
      const txs = (input.transactions ?? []) as Json[];
      for (const t of txs) {
        const r = base(documentId, documentType, String(t.id));
        r.kind = "transaction";
        r.title = str(t.counterparty) ?? "Transaction";
        r.subtitle = str(t.description) ?? doc.title;
        r.amount = num(t.amount);
        r.status = t.pending === true ? "PENDING" : "NEW";
        r.at = str(t.bookedAt);
        r.body = text(
          t.counterparty,
          t.description,
          t.reference,
          t.amount,
          doc.title,
        );
        others.push(r);
      }
      break;
    }
    case "REMOVE_PENDING_TRANSACTIONS": {
      const gone = new Set(((input.ids ?? []) as unknown[]).map(String));
      for (let i = others.length - 1; i >= 0; i--) {
        if (gone.has(others[i].entity_id)) others.splice(i, 1);
      }
      break;
    }
    case "CATEGORIZE_TRANSACTION":
    case "MATCH_TRANSACTION":
    case "UNMATCH_TRANSACTION":
    case "EXCLUDE_TRANSACTION": {
      const r = others.find((o) => o.entity_id === String(input.id));
      if (r) {
        if (type === "CATEGORIZE_TRANSACTION") {
          r.status = r.status === "NEW" ? "CATEGORIZED" : r.status;
          r.body = text(r.body, input.category);
        }
        if (type === "MATCH_TRANSACTION") r.status = "MATCHED";
        if (type === "UNMATCH_TRANSACTION") r.status = "CATEGORIZED";
        if (type === "EXCLUDE_TRANSACTION")
          r.status = input.excluded ? "EXCLUDED" : "CATEGORIZED";
      }
      break;
    }
    default:
      break;
  }
  if (!doc.title) doc.title = KIND_BY_TYPE[documentType] ?? "Document";
  return [doc, ...others];
}
