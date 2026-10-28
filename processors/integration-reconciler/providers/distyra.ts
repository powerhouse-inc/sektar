/**
 * Distyra, the bank aggregator, as the transaction workflows that predate
 * integrations run it (relocated, not redesigned): on a schedule (banks
 * allow about four unattended fetches a day), pull the latest transactions
 * of one bank connection, then import each account's onto its Sektar bank
 * account; import skips references the account already holds. Distyra
 * keeps its own history, so there is no backfill. The connection is an API
 * key the integration is given, shared with others.
 */
import type { IntegrationState } from "document-models/integration";
import { DISTYRA_PIECE, DISTYRA_PIECE_VERSION } from "../pieces.js";
import type { StepSpec } from "../workflow-spec.js";
import { scheduleTrigger, scheduleWords } from "./schedule.js";
import type { ProviderAdapter, ProviderContext } from "./types.js";

type TransactionsSource = {
  bankConnectionId: string;
  accounts: { accountId: string; accountKey: string; bankAccountId: string }[];
};

function source(state: IntegrationState): TransactionsSource {
  const s = state.intent.source as Partial<TransactionsSource> | null;
  return {
    bankConnectionId: s?.bankConnectionId ?? "",
    accounts: s?.accounts ?? [],
  };
}

export const distyra: ProviderAdapter = {
  id: "distyra",
  label: "Distyra",
  auth: "apiKey",

  connection() {
    return null;
  },

  live(ctx: ProviderContext) {
    const { bankConnectionId, accounts } = source(ctx.state);
    const imports: StepSpec[] = accounts.map((account, i) => ({
      key: `import_${i + 1}`,
      name: `Import to bank account ${i + 1}`,
      pieceName: DISTYRA_PIECE,
      pieceVersion: DISTYRA_PIECE_VERSION,
      actionName: "import-to-bank-account",
      reactorConnectionId: ctx.reactorConnectionId,
      config: {
        accountId: account.accountId,
        accountKey: account.accountKey,
        transactions: "{{steps.pull.output.transactions}}",
        bankAccountId: account.bankAccountId,
      },
    }));
    return {
      name: `${ctx.name} · transactions`,
      trigger: scheduleTrigger(ctx.state),
      steps: [
        {
          key: "pull",
          name: "Get Latest Transactions",
          pieceName: DISTYRA_PIECE,
          pieceVersion: DISTYRA_PIECE_VERSION,
          actionName: "get-latest-transactions",
          connectionId: ctx.connectionId,
          config: {
            enrich: false,
            history: "automatic",
            connectionId: bankConnectionId,
          },
        },
        ...imports,
      ],
      config: scheduleWords,
    };
  },

  backfillSteps() {
    return [];
  },
};
