import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type * as Client from "../common/client.js";
import type { DistyraBalancesResult as Result } from "./read-balances.js";

const sent = vi.hoisted(() => ({
  calls: [] as { path: string; headers?: Record<string, string> }[],
  fail: null as Error | null,
}));

vi.mock("../common/client.js", async (original) => ({
  ...(await original<typeof Client>()),
  distyraRequest: (params: { path: string; headers?: Record<string, string> }) => {
    sent.calls.push({ path: params.path, headers: params.headers });
    return sent.fail
      ? Promise.reject(sent.fail)
      : Promise.resolve({ accounts: [{ account_id: "acc-1", balance_known: true }] });
  },
}));

const { distyraReadBalancesAction } = await import("./read-balances.js");

const run = (props: Record<string, unknown>) =>
  distyraReadBalancesAction.run({
    auth: { props: { apiKey: "key" } },
    propsValue: { connectionId: "conn 1", ...props },
  } as never) as Promise<Result>;

beforeEach(() => {
  sent.calls = [];
  sent.fail = null;
});

afterEach(() => {
  vi.useRealTimers();
});

describe("Read Balances", () => {
  it("reads with the person on screen, whatever the schedule, as their own fetch", async () => {
    vi.useFakeTimers({ now: Date.parse("2026-11-12T22:30:00.000Z") });
    const result = await run({ everyHours: 6, psuIpAddress: " 203.0.113.7 ", psuUserAgent: "Firefox" });
    expect(result).toEqual({
      read: true,
      reason: null,
      readAt: "2026-11-12T22:30:00.000Z",
      accounts: [{ account_id: "acc-1", balance_known: true }],
    });
    expect(sent.calls).toEqual([
      {
        path: "/v1/connect/connections/conn%201/accounts",
        headers: { "psu-ip-address": "203.0.113.7", "psu-user-agent": "Firefox" },
      },
    ]);
  });

  it("leaves the balances alone on a scheduled run that cannot afford the fetch", async () => {
    vi.useFakeTimers({ now: Date.parse("2026-11-12T00:10:00.000Z") });
    // a scheduled run: the expressions for the person on screen resolve to nothing
    const result = await run({ everyHours: 6, psuIpAddress: "null", psuUserAgent: "undefined" });
    expect(result).toEqual({
      read: false,
      reason: "Not this run: the balances are read once a day, or on Sync now",
      readAt: null,
      accounts: [],
    });
    expect(sent.calls).toEqual([]);
    // half a person is nobody
    expect((await run({ everyHours: 6, psuIpAddress: "203.0.113.7" })).read).toBe(false);
    expect((await run({})).read).toBe(false);
  });

  it("reads once a day on a schedule that leaves a fetch, unattended", async () => {
    vi.useFakeTimers({ now: Date.parse("2026-11-12T03:00:00.000Z") });
    expect((await run({ everyHours: 8 })).read).toBe(true);
    expect(sent.calls[0].headers).toBeUndefined();
    vi.setSystemTime(Date.parse("2026-11-12T11:00:00.000Z"));
    expect((await run({ everyHours: 8 })).read).toBe(false);
    expect(sent.calls).toHaveLength(1);
  });

  it("never fails the sync when the bank cannot be read", async () => {
    vi.useFakeTimers({ now: Date.parse("2026-11-12T03:00:00.000Z") });
    sent.fail = new Error("Distyra: the connection's daily bank fetches are used up");
    expect(await run({ everyHours: 12 })).toEqual({
      read: false,
      reason: "Distyra: the connection's daily bank fetches are used up",
      readAt: null,
      accounts: [],
    });
    sent.fail = "offline" as unknown as Error;
    expect((await run({ everyHours: 12 })).reason).toBe("offline");
  });
});
