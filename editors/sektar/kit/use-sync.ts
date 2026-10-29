// What the sync status reads, shared by the top bar's chip, the
// Integrations page and pull to refresh: the runtime's trigger states (one
// poll for the whole app), the integrations in the Integrations drive (from
// the integration index), and "sync now".
import { useCallback, useSyncExternalStore } from "react";
import {
  useIntegrationItems,
  type IntegrationItem,
  type OnScreen,
  useOnScreen,
} from "./integration-index.js";
import {
  fireWorkflow,
  pollNow,
  triggerStates,
  useWorkflowRuntimeUrl,
  type TriggerState,
} from "./workflow-runtime.js";

const EVERY_MS = 30_000;
/** The bank aggregator's provider id (processors/integration-reconciler/providers/distyra.ts) */
const BANK_PROVIDER = "distyra";
/** How often a sync now looks whether its polls have landed, and for how long */
const SETTLE_EVERY_MS = 2_000;
const SETTLE_FOR_MS = 90_000;

type TriggerMap = ReadonlyMap<string, TriggerState>;
const EMPTY: TriggerMap = new Map();

/**
 * One store per runtime: the trigger states, read while anything shows them
 * (every 30 s, which also keeps "4 min ago" current) and again on demand.
 * Empty while the switchboard does not answer.
 */
class TriggerStore {
  states: TriggerMap = EMPTY;
  /** Workflows a sync now is waiting on */
  syncing: ReadonlySet<string> = new Set();
  private listeners = new Set<() => void>();
  private timer: number | undefined;

  constructor(private readonly url: string) {}

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    if (this.listeners.size === 1) {
      void this.load();
      this.timer = window.setInterval(() => void this.load(), EVERY_MS);
    }
    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0) window.clearInterval(this.timer);
    };
  };

  private emit() {
    for (const l of this.listeners) l();
  }

  async load(): Promise<TriggerMap> {
    try {
      const list = await triggerStates(this.url);
      this.states = new Map(list.map((t) => [t.workflowId, t]));
      this.emit();
    } catch {
      // the switchboard is restarting or this person may not read it: keep what we had
    }
    return this.states;
  }

  private setSyncing(next: ReadonlySet<string>) {
    this.syncing = next;
    this.emit();
  }

  /**
   * Runs each live workflow's trigger now and waits until each has polled
   * (or 90 s pass). Which of them had no armed trigger (live updates off,
   * stopped) comes back as `skipped`, which the switchboard refused as
   * `failed`; a pull never starts a backfill.
   */
  async syncNow(
    workflowIds: readonly string[],
    /**
     * Bank pulls among them: fired with the person on screen, so the bank
     * counts the fetch as theirs, not as one of the four unattended a day.
     * Where nobody is known (no public address) they are polled as usual.
     */
    attended?: {
      ids: ReadonlySet<string>;
      onScreen: () => Promise<OnScreen | null>;
    },
  ): Promise<{
    synced: string[];
    skipped: string[];
    failed: string[];
    /** What the switchboard said when it refused one */
    error?: string;
  }> {
    const started = new Date().toISOString();
    const synced: string[] = [];
    const skipped: string[] = [];
    const failed: string[] = [];
    let error: string | undefined;
    const banks = workflowIds.filter((id) => attended?.ids.has(id));
    const who = banks.length > 0 && attended ? await attended.onScreen() : null;
    // A fired pull has ended when its call returns: nothing to wait for after
    const fired = new Set<string>();
    await Promise.all(
      workflowIds.map(async (id) => {
        try {
          if (who && banks.includes(id)) {
            this.setSyncing(new Set([...this.syncing, id]));
            try {
              const ok = await fireWorkflow(this.url, id, { psu: who });
              fired.add(id);
              if (ok) synced.push(id);
              else {
                failed.push(id);
                error ??= "The bank refresh did not finish; its run says why";
              }
            } finally {
              const left = new Set(this.syncing);
              left.delete(id);
              this.setSyncing(left);
            }
            return;
          }
          (await pollNow(this.url, id) ? synced : skipped).push(id);
        } catch (e) {
          failed.push(id);
          error ??= e instanceof Error ? e.message : String(e);
        }
      }),
    );
    if (synced.length === 0) return { synced, skipped, failed, error };
    this.setSyncing(new Set([...this.syncing, ...synced]));
    const deadline = Date.now() + SETTLE_FOR_MS;
    try {
      for (;;) {
        await new Promise((r) => window.setTimeout(r, SETTLE_EVERY_MS));
        const states = await this.load();
        const waiting = synced.filter((id) => {
          if (fired.has(id)) return false;
          const t = states.get(id);
          return t?.status === "ENABLED" && !((t.lastPollAt ?? "") >= started);
        });
        if (waiting.length === 0 || Date.now() > deadline) break;
      }
    } finally {
      const left = new Set(this.syncing);
      for (const id of synced) left.delete(id);
      this.setSyncing(left);
    }
    return { synced, skipped, failed, error };
  }
}

const stores = new Map<string, TriggerStore>();
function storeFor(url: string): TriggerStore {
  let store = stores.get(url);
  if (!store) {
    store = new TriggerStore(url);
    stores.set(url, store);
  }
  return store;
}

/** The runtime's trigger states by workflow id (one shared poll). */
export function useTriggerStates(): TriggerMap {
  const store = storeFor(useWorkflowRuntimeUrl());
  return useSyncExternalStore(store.subscribe, () => store.states);
}

/**
 * Sync now for a set of workflows: `syncing` while any of this runtime's
 * syncs are in flight, `sync` to start one.
 */
export function useSyncNow(): {
  syncing: ReadonlySet<string>;
  sync: (workflowIds: readonly string[]) => ReturnType<TriggerStore["syncNow"]>;
} {
  const store = storeFor(useWorkflowRuntimeUrl());
  const syncing = useSyncExternalStore(store.subscribe, () => store.syncing);
  // The bank integrations' live workflows: refreshed as the person on screen
  const items = useIntegrations();
  const bankKey = items
    .filter((i) => i.state.provider === BANK_PROVIDER)
    .map((i) => i.state.resources.liveWorkflowId)
    .filter((id): id is string => !!id)
    .join(",");
  const onScreen = useOnScreen();
  const sync = useCallback(
    (ids: readonly string[]) =>
      store.syncNow(ids, {
        ids: new Set(bankKey ? bankKey.split(",") : []),
        onScreen,
      }),
    [store, bankKey, onScreen],
  );
  return { syncing, sync };
}

/**
 * The integrations in the Integrations drive (slug "integrations"), wherever
 * the app is: index rows (kit/integration-index), never the documents.
 * Empty until the index has answered.
 */
export function useIntegrations(): IntegrationItem[] {
  const items = useIntegrationItems();
  return items ?? NO_ITEMS;
}

const NO_ITEMS: IntegrationItem[] = [];
