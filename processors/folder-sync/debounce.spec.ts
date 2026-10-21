import { describe, expect, it } from "vitest";
import { Debouncer, type DebounceTimers } from "./debounce.js";

/** A clock the test moves by hand. */
function fakeTimers() {
  let now = 0;
  let next = 1;
  const timers = new Map<number, { at: number; fn: () => void }>();
  const api: DebounceTimers = {
    set: (fn, ms) => {
      const id = next++;
      timers.set(id, { at: now + ms, fn });
      return id;
    },
    clear: (handle) => {
      timers.delete(handle as number);
    },
    now: () => now,
  };
  const advance = (ms: number) => {
    const until = now + ms;
    const nextDue = () => [...timers.entries()].filter(([, t]) => t.at <= until).sort((a, b) => a[1].at - b[1].at).at(0);
    for (let due = nextDue(); due; due = nextDue()) {
      now = due[1].at;
      timers.delete(due[0]);
      due[1].fn();
    }
    now = until;
  };
  return { api, advance };
}

describe("a debounce with a ceiling", () => {
  it("fires once, a quiet spell after the last event", () => {
    const t = fakeTimers();
    const d = new Debouncer(5_000, 60_000, t.api);
    const fired: number[] = [];
    d.touch("m", () => fired.push(t.api.now()));
    t.advance(3_000);
    d.touch("m", () => fired.push(t.api.now()));
    t.advance(4_000);
    expect(fired).toEqual([]);
    t.advance(1_000);
    expect(fired).toEqual([8_000]);
    expect(d.size).toBe(0);
  });

  it("fires no later than the ceiling while events keep coming", () => {
    const t = fakeTimers();
    const d = new Debouncer(5_000, 12_000, t.api);
    const fired: number[] = [];
    for (let i = 0; i < 10; i++) {
      d.touch("m", () => fired.push(t.api.now()));
      t.advance(2_000);
    }
    expect(fired).toEqual([12_000]);
  });

  it("keeps keys apart, and can be cancelled", () => {
    const t = fakeTimers();
    const d = new Debouncer(5_000, 60_000, t.api);
    const fired: string[] = [];
    d.touch("a", () => fired.push("a"));
    d.touch("b", () => fired.push("b"));
    d.cancel("a");
    d.cancel("nothing");
    t.advance(5_000);
    expect(fired).toEqual(["b"]);
    d.touch("c", () => fired.push("c"));
    d.cancelAll();
    t.advance(60_000);
    expect(fired).toEqual(["b"]);
  });

  it("runs on real timers by default", async () => {
    const d = new Debouncer(5, 50);
    const done = new Promise<void>((resolve) => d.touch("m", resolve));
    await expect(done).resolves.toBeUndefined();
  });
});
