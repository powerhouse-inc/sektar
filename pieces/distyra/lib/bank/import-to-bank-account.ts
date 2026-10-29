/**
 * Import into Bank Account — the step after a pull: file the pulled rows of
 * one account onto its Sektar bank-account document.
 *
 * It reads the account first and sends only rows it does not hold yet, so a
 * backfill window that overlaps an earlier one, or a rerun, adds nothing
 * twice. Nothing to add is a success with nothing sent: the model refuses an
 * empty import, and an empty window is an ordinary answer from the bank.
 *
 * Pending entries are kept in step with the bank: the ones it reports now and
 * the account lacks are added as PENDING, and the account's pending rows it
 * no longer reports (booked since, or cancelled) are removed. Only a change is
 * written, so a quiet pull sends nothing.
 */
import { createAction, Property } from "@powerhousedao/pieces-framework";
import { toGlobalAction } from "../osc/client.js";
import { planImport } from "./import-rows.js";

export const BANK_ACCOUNT_TYPE = "sektar/bank-account";

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
}

export const distyraImportToBankAccountAction = createAction({
  // Saved workflows refer to the action by name: don't rename it once published
  name: "import-to-bank-account",
  // Reaches the reactor, not Distyra: filing rows needs no bank connection.
  requireAuth: false,
  requireReactor: "write",
  displayName: "Import into Bank Account",
  description:
    "File one account's pulled transactions onto a Sektar bank account. Booked entries are posted once each (a stable reference skips rows the account already holds, so overlapping windows and reruns never import twice); pending entries are shown as pending until the bank books them.",
  props: {
    transactions: Property.Json({
      displayName: "Transactions",
      description: "The pull's transactions, e.g. {{steps.pull.output.transactions}}.",
      required: true,
    }),
    accountId: Property.ShortText({
      displayName: "Distyra account ID",
      description:
        "The account_id the rows are tagged with. Rows for any other account are ignored.",
      required: true,
    }),
    accountKey: Property.ShortText({
      displayName: "Distyra account key",
      description:
        "The stable account_key. Used in each row's reference so the references survive the holder re-authorizing; falls back to the account ID.",
      required: false,
    }),
    bankAccountId: Property.ShortText({
      displayName: "Bank account document",
      description: "The sektar/bank-account document to file onto.",
      required: true,
    }),
  },
  async run(context) {
    const p = context.propsValue;
    const bankAccountId = p.bankAccountId.trim();
    const doc = await context.reactor.get(bankAccountId);
    if (doc.header.documentType !== BANK_ACCOUNT_TYPE) {
      throw new Error(
        `Document ${bankAccountId} is a ${doc.header.documentType}, not a ${BANK_ACCOUNT_TYPE}.`,
      );
    }
    const state = (
      doc.state as {
        global?: { transactions?: { id: string; reference: string | null; status?: string }[] };
      }
    ).global;
    const held = state?.transactions ?? [];
    const knownReferences = new Set(
      held
        .filter((t) => t.status !== "PENDING")
        .map((t) => t.reference)
        .filter((r): r is string => typeof r === "string"),
    );
    const heldPending = held.filter((t) => t.status === "PENDING");
    const plan = planImport(p.transactions, {
      accountId: p.accountId.trim(),
      accountKey: text(p.accountKey),
      knownReferences,
      newId: () => crypto.randomUUID(),
    });
    // Pending rows: drop the ones the bank stopped reporting, add the new ones
    const reported = new Set(plan.pending.map((r) => r.reference));
    const stale = heldPending.filter((t) => !t.reference || !reported.has(t.reference)).map((t) => t.id);
    const heldPendingRefs = new Set(heldPending.map((t) => t.reference));
    const freshPending = plan.pending.filter((r) => !heldPendingRefs.has(r.reference));
    const actions = [];
    if (stale.length > 0) {
      actions.push(toGlobalAction({ type: "REMOVE_PENDING_TRANSACTIONS", input: { ids: stale } }));
    }
    const incoming = [...plan.rows, ...freshPending.map((r) => ({ ...r, pending: true }))];
    if (incoming.length > 0) {
      const importedAt = new Date().toISOString();
      actions.push(
        toGlobalAction({
          type: "IMPORT_TRANSACTIONS",
          input: { batchId: `distyra-${importedAt}`, importedAt, transactions: incoming },
        }),
      );
    }
    if (actions.length > 0) await context.reactor.execute(bankAccountId, "main", actions);
    return {
      bankAccountId,
      imported: plan.rows.length,
      pending: { reported: plan.pending.length, added: freshPending.length, removed: stale.length },
      counts: plan.counts,
      span: plan.span,
      held: knownReferences.size + plan.rows.length,
    };
  },
});
