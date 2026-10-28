// What the sync status reads, shared by the top bar's chip, the
// Integrations page and pull to refresh: the runtime's trigger states (one
// poll for the whole app), the integrations in the Integrations drive, and
// "sync now".
import { useDocumentsByIds, useDrives } from "@powerhousedao/reactor-browser";
import {
  isIntegrationDocument,
  type IntegrationDocument,
} from "document-models/integration/v1";
import { useCallback, useMemo, useSyncExternalStore } from "react";
import {
  pollNow,
  triggerStates,
  useWorkflowRuntimeUrl,
  type TriggerState,
} from "./workflow-runtime.js";

const EVERY_MS = 30_000;
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
  ): Promise<{ synced: string[]; skipped: string[]; failed: string[] }> {
    const started = new Date().toISOString();
    const synced: string[] = [];
    const skipped: string[] = [];
    const failed: string[] = [];
    await Promise.all(
      workflowIds.map(async (id) => {
        try {
          (await pollNow(this.url, id) ? synced : skipped).push(id);
        } catch {
          failed.push(id);
        }
      }),
    );
    if (synced.length === 0) return { synced, skipped, failed };
    this.setSyncing(new Set([...this.syncing, ...synced]));
    const deadline = Date.now() + SETTLE_FOR_MS;
    try {
      for (;;) {
        await new Promise((r) => window.setTimeout(r, SETTLE_EVERY_MS));
        const states = await this.load();
        const waiting = synced.filter((id) => {
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
    return { synced, skipped, failed };
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
  const sync = useCallback(
    (ids: readonly string[]) => store.syncNow(ids),
    [store],
  );
  return { syncing, sync };
}

/** The Integrations drive (hosts/switchboard: slug "integrations"). */
const INTEGRATIONS_DRIVE = "integrations";

/** The integrations in the Integrations drive, wherever the app is. */
export function useIntegrations(): IntegrationDocument[] {
  const drives = useDrives();
  const drive = drives?.find(
    (d) =>
      d.header.id === INTEGRATIONS_DRIVE ||
      d.header.slug === INTEGRATIONS_DRIVE,
  );
  const nodes = drive?.state.global.nodes;
  const ids = useMemo(
    () =>
      (nodes ?? [])
        .filter(
          (n) => "documentType" in n && n.documentType === "sektar/integration",
        )
        .map((n) => n.id),
    [nodes],
  );
  const docs = useDocumentsByIds(ids);
  return useMemo(() => docs.filter(isIntegrationDocument), [docs]);
}
