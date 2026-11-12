/**
 * The rate keeper: on the reactor that owns the books, keeps a currency pair
 * for every currency the books hold amounts in, and each pair's daily rates
 * up to today (keeper.ts). It is what makes a bank account in another
 * currency show in the totals without anyone doing anything.
 *
 * It runs wherever the drive's own reactor runs: in the browser tab for
 * Sektar on the web (its in-process reactor, so it works offline and catches
 * up when the network is back), and on the switchboard for the desktop app
 * and a deployment (a tab is then a remote client and runs no processors, so
 * there is exactly one writer).
 *
 * Passes run shortly after the books change (a new account, the main
 * currency, a rate entered by hand), at startup, and on a timer: the rates
 * change once a working day, and the app can stay open across days. A pass
 * acts on what the finance index says now, never on an operation's payload,
 * so a history replay fetches nothing twice.
 */
import type {
  IProcessor,
  IProcessorHostModule,
  OperationWithContext,
} from "@powerhousedao/reactor-browser";
import {
  actions as pairActions,
  utils as pairUtils,
} from "document-models/currency-pair";
import { generateId } from "document-model";
import type {
  CurrencyInUse,
  FinanceQueryBuilder,
} from "../finance-index/queries.js";
import {
  loadCurrenciesInUse,
  loadPairs,
  loadSettings,
} from "../finance-index/queries.js";
import { keepRates, newMemory, RETRY_MS, type KeeperIO } from "./keeper.js";
import { fetchRates } from "./rates.js";

/** The documents whose changes can change what the books need rates for. */
export const RATE_KEEPER_DOCUMENT_TYPES = [
  "sektar/bank-account",
  "sektar/invoice",
  "sektar/expense-report",
  "sektar/books-settings",
  "sektar/currency-pair",
] as const;

/** After a change, long enough for the finance index to have it. */
const SETTLE_MS = 2_000;
const STARTUP_MS = 5_000;
/** The rates change once a working day; an hour finds the new one soon enough. */
const SWEEP_MS = 3_600_000;
/** How long one answer from the rate service may take. */
const FETCH_TIMEOUT_MS = 20_000;

type Module = Pick<IProcessorHostModule, "dispatch">;

/**
 * Currencies in use outside the books' own documents (Business Travel's
 * trips, which live in a drive of their own), with the first day each needs
 * a rate for. Their totals are converted with the books' rates too.
 */
export type MoreCurrencies = () => Promise<readonly CurrencyInUse[]>;

/** One list of currencies in use from two: each currency once, with its earliest day. */
export function mergeCurrencies(
  ...lists: readonly (readonly CurrencyInUse[])[]
): CurrencyInUse[] {
  const since = new Map<string, string | null>();
  for (const { currency, since: day } of lists.flat()) {
    if (!currency) continue;
    const known = since.get(currency);
    if (known === undefined) since.set(currency, day);
    else if (day && (!known || day < known)) since.set(currency, day);
  }
  return [...since]
    .map(([currency, day]) => ({ currency, since: day }))
    .sort((a, b) => a.currency.localeCompare(b.currency));
}

export class RateKeeper implements IProcessor {
  private readonly memory = newMemory();
  private timers: ReturnType<typeof setTimeout>[] = [];
  private settle: ReturnType<typeof setTimeout> | undefined;
  private running: Promise<void> | undefined;
  private again = false;
  private stopped = false;
  private retry: ReturnType<typeof setTimeout> | undefined;
  /** In a browser: the network is back, so what failed offline is tried now. */
  private readonly online = () => this.request({ force: true });

  constructor(
    private readonly driveId: string,
    private readonly module: Module,
    /** The finance index of this drive: where the books' currencies are read. */
    private readonly index: () => FinanceQueryBuilder,
    private readonly more: MoreCurrencies = () => Promise.resolve([]),
  ) {}

  /** Something outside the books changed what they need rates for (a trip). */
  poke(): void {
    this.requestSoon();
  }

  /** Starts the startup pass and the hourly sweep. */
  start(): void {
    const startup = setTimeout(() => this.request(), STARTUP_MS);
    const sweep = setInterval(() => this.request(), SWEEP_MS);
    // a timer must not keep a server process alive; a browser has no unref
    (startup as { unref?: () => void }).unref?.();
    (sweep as { unref?: () => void }).unref?.();
    this.timers = [startup, sweep];
    // A tab that was offline (a laptop reopened, the desktop app without a
    // network) catches up the moment it is back; a server has no such event.
    const target = globalThis as {
      addEventListener?: (type: string, listener: () => void) => void;
    };
    target.addEventListener?.("online", this.online);
  }

  onOperations(operations: OperationWithContext[]): Promise<void> {
    if (operations.length > 0) this.requestSoon();
    return Promise.resolve();
  }

  onDisconnect(): Promise<void> {
    this.stopped = true;
    for (const t of this.timers) clearTimeout(t);
    if (this.settle) clearTimeout(this.settle);
    if (this.retry) clearTimeout(this.retry);
    const target = globalThis as {
      removeEventListener?: (type: string, listener: () => void) => void;
    };
    target.removeEventListener?.("online", this.online);
    return Promise.resolve();
  }

  /** A pass once the changes have settled: a burst of operations is one pass. */
  private requestSoon(): void {
    if (this.stopped) return;
    if (this.settle) clearTimeout(this.settle);
    this.settle = setTimeout(() => this.request(), SETTLE_MS);
    (this.settle as { unref?: () => void }).unref?.();
  }

  /** One pass at a time; a request during a pass runs one more after it. */
  private request(options: { force?: boolean } = {}): void {
    if (this.stopped) return;
    if (this.running) {
      this.again = true;
      return;
    }
    this.running = this.pass(options).finally(() => {
      this.running = undefined;
      if (this.again) {
        this.again = false;
        this.request();
      }
    });
  }

  /** Never rejects: a failed pass is logged and the next one tries again. */
  async pass(options: { force?: boolean } = {}): Promise<void> {
    try {
      const result = await keepRates(this.io(), this.memory, options);
      // What failed (no network, the service down) is tried again by itself,
      // not only when the books next change.
      if (result.failed.some((f) => f.retry) && !this.stopped) {
        if (this.retry) clearTimeout(this.retry);
        this.retry = setTimeout(() => this.request(), RETRY_MS + 1_000);
        (this.retry as { unref?: () => void }).unref?.();
      }
      for (const pair of result.updated) {
        console.info(`[rate-keeper] ${pair}: rates updated`);
      }
      for (const f of result.failed) {
        console.warn(`[rate-keeper] ${f.pair}: ${f.error}`);
      }
    } catch (error) {
      // the finance index not there yet, say: the next pass reads it again
      console.warn(
        `[rate-keeper] pass failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private io(): KeeperIO {
    const { dispatch } = this.module;
    return {
      now: () => Date.now(),
      facts: async () => {
        const db = this.index();
        const [settings, inUse, pairs, more] = await Promise.all([
          loadSettings(db),
          loadCurrenciesInUse(db),
          loadPairs(db),
          // never the reason the books' own currencies go without rates
          this.more().catch(() => []),
        ]);
        return {
          bookCurrency: settings.bookCurrency,
          inUse: mergeCurrencies(inUse, more),
          pairs,
        };
      },
      createPair: async (base, quote) => {
        const document = pairUtils.createDocument();
        document.header.name = `${base} to ${quote}`;
        const created = await dispatch.createInDrive(this.driveId, document);
        const id = created.documentId || document.header.id;
        await dispatch.execute(id, "main", [pairActions.setPair({ base, quote })]);
        return id;
      },
      fetchRates: (base, quote, window) =>
        fetchRates(base, quote, window, (input, init) =>
          fetch(input, { ...init, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) }),
        ),
      recordRates: async (pairId, source, rates) => {
        await dispatch.execute(pairId, "main", [
          pairActions.recordRates({
            source,
            fetchedAt: new Date().toISOString(),
            rates: rates.map((r) => ({ id: generateId(), date: r.date, rate: r.rate })),
          }),
        ]);
      },
    };
  }
}
