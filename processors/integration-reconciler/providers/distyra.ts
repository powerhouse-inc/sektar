/**
 * Distyra, the bank aggregator, as the transaction workflows that predate
 * integrations run it (relocated, not redesigned): on a schedule (banks
 * allow about four unattended fetches a day), pull the latest transactions
 * of one bank connection, then import each account's onto its Sektar bank
 * account; import skips references the account already holds. Distyra
 * keeps its own history, so there is no backfill. The connection is an API
 * key the integration is given, shared with others.
 *
 * The transactions a bank hands over rarely reach back to the day an account
 * was opened, so their sum is short of the balance. After the imports the
 * workflow reads the bank's own balances and brings each account to its one
 * (the piece's Read Balances decides whether a run can afford the fetch:
 * always on Sync now, otherwise once a day when the schedule leaves one).
 *
 * A scheduled run is unattended and uses one of the connection's four daily
 * fetches. A manual refresh fires the workflow with the person on screen
 * (`trigger.payload.psu`: their public address and browser), which the pull
 * sends to the bank as Psu-Ip-Address and Psu-User-Agent: such a fetch is the
 * person's own and does not count (200 a day). The `?` makes both null on a
 * scheduled run, which carries no payload.
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

/** The live interval in hours, as Read Balances weighs it against the bank's daily fetches. */
export function everyHours(state: IntegrationState): number {
  const every = state.intent.live.every;
  const hours = { MINUTES: 1 / 60, HOURS: 1, DAYS: 24 }[every.unit];
  return Math.round(every.value * hours * 100) / 100;
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
    const balances: StepSpec[] = accounts.map((account, i) => ({
      key: `balance_${i + 1}`,
      name: `Record bank balance ${i + 1}`,
      pieceName: DISTYRA_PIECE,
      pieceVersion: DISTYRA_PIECE_VERSION,
      actionName: "record-bank-balance",
      reactorConnectionId: ctx.reactorConnectionId,
      config: {
        balances: "{{steps.balances.output}}",
        accountId: account.accountId,
        accountKey: account.accountKey,
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
            psuIpAddress: "{{trigger.payload.psu.ipAddress?}}",
            psuUserAgent: "{{trigger.payload.psu.userAgent?}}",
          },
        },
        ...imports,
        // After the imports: the balance is recorded against the
        // transactions this run brought in.
        {
          key: "balances",
          name: "Read Balances",
          pieceName: DISTYRA_PIECE,
          pieceVersion: DISTYRA_PIECE_VERSION,
          actionName: "read-balances",
          connectionId: ctx.connectionId,
          config: {
            connectionId: bankConnectionId,
            everyHours: everyHours(ctx.state),
            psuIpAddress: "{{trigger.payload.psu.ipAddress?}}",
            psuUserAgent: "{{trigger.payload.psu.userAgent?}}",
          },
        },
        ...balances,
      ],
      config: scheduleWords,
      // A workflow published before the balance steps existed gains them: an
      // integration's accounts are set once, so they are always its tail.
      addMissingSteps: true,
    };
  },

  backfillSteps() {
    return [];
  },
};
