// A trailing debounce per key, with a ceiling: every new event restarts the
// wait, the action runs once things have been quiet for `quietMs`, and never
// later than `maxWaitMs` after the first event of the burst (lodash calls
// it maxWait). An automatic folder sync runs this way after changes in the
// drive or on disk.

export interface DebounceTimers {
  set(fn: () => void, ms: number): unknown;
  clear(handle: unknown): void;
  now(): number;
}

const realTimers: DebounceTimers = {
  set: (fn, ms) => setTimeout(fn, ms),
  clear: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
  now: () => Date.now(),
};

export class Debouncer {
  private readonly pending = new Map<string, { timer: unknown; firstAt: number }>();

  constructor(
    private readonly quietMs: number,
    private readonly maxWaitMs: number,
    private readonly timers: DebounceTimers = realTimers,
  ) {}

  /** Notes an event for `key`; `fire` runs once the burst is over. */
  touch(key: string, fire: () => void): void {
    const now = this.timers.now();
    const current = this.pending.get(key);
    if (current) this.timers.clear(current.timer);
    const firstAt = current?.firstAt ?? now;
    const wait = Math.max(0, Math.min(this.quietMs, firstAt + this.maxWaitMs - now));
    const timer = this.timers.set(() => {
      this.pending.delete(key);
      fire();
    }, wait);
    this.pending.set(key, { timer, firstAt });
  }

  cancel(key: string): void {
    const current = this.pending.get(key);
    if (!current) return;
    this.timers.clear(current.timer);
    this.pending.delete(key);
  }

  cancelAll(): void {
    for (const key of [...this.pending.keys()]) this.cancel(key);
  }

  get size(): number {
    return this.pending.size;
  }
}
