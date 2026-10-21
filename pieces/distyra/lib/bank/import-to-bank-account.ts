/**
 * Import into Bank Account — the step after a pull: file the pulled rows of
 * one account onto its Sektar bank-account document.
 *
 * It reads the account first and sends only rows it does not hold yet, so a
 * backfill window that overlaps an earlier one, or a rerun, adds nothing
 * twice. Nothing to add is a success with nothing sent: the model refuses an
 * empty import, and an empty window is an ordinary answer from the bank.
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
    "File one account's pulled transactions onto a Sektar bank account. Booked entries only; each gets a stable reference, and rows the account already holds are skipped, so overlapping windows and reruns never import twice.",
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
    const state = (doc.state as { global?: { transactions?: { reference: string | null }[] } }).global;
    const knownReferences = new Set(
      (state?.transactions ?? [])
        .map((t) => t.reference)
        .filter((r): r is string => typeof r === "string"),
    );
    const plan = planImport(p.transactions, {
      accountId: p.accountId.trim(),
      accountKey: text(p.accountKey),
      knownReferences,
      newId: () => crypto.randomUUID(),
    });
    if (plan.rows.length > 0) {
      const importedAt = new Date().toISOString();
      await context.reactor.execute(bankAccountId, "main", [
        toGlobalAction({
          type: "IMPORT_TRANSACTIONS",
          input: {
            batchId: `distyra-${importedAt}`,
            importedAt,
            transactions: plan.rows,
          },
        }),
      ]);
    }
    return {
      bankAccountId,
      imported: plan.rows.length,
      counts: plan.counts,
      span: plan.span,
      held: knownReferences.size + plan.rows.length,
    };
  },
});
