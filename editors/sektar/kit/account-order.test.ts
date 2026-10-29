import { describe, expect, it } from "vitest";
import {
  accountsByName,
  isZeroBalance,
  recentAccountsWithBalance,
} from "./account-order.js";

const accounts = [
  { name: "Revolut Personal USD", balance: 0 },
  { name: "KBC Business PRO", balance: 1250.5 },
  { name: "bnp Paribas Fortis", balance: -320.22 },
  { name: "Revolut Personal EUR", balance: 0.004 },
  { name: "Account 10", balance: 5 },
  { name: "Account 9", balance: 5 },
  { name: null, balance: 12 },
];

describe("account order", () => {
  it("treats a balance under half a cent as empty", () => {
    expect(isZeroBalance({ balance: 0 })).toBe(true);
    expect(isZeroBalance({ balance: 0.004 })).toBe(true);
    expect(isZeroBalance({ balance: -0.004 })).toBe(true);
    expect(isZeroBalance({ balance: 0.01 })).toBe(false);
    expect(isZeroBalance({ balance: -320.22 })).toBe(false);
  });

  it("drops empty accounts and lists the most recently used first, at most six", () => {
    const used = [
      { name: "Old", balance: 10, lastBookedAt: "2025-01-02" },
      { name: "Empty but busy", balance: 0, lastBookedAt: "2026-10-29" },
      { name: "Latest", balance: 10, lastBookedAt: "2026-10-28" },
      { name: "Never", balance: 10, lastBookedAt: null },
      { name: "B same day", balance: 10, lastBookedAt: "2026-10-27" },
      { name: "A same day", balance: 10, lastBookedAt: "2026-10-27" },
      { name: "Mid", balance: 10, lastBookedAt: "2026-06-01" },
      { name: "Older", balance: 10, lastBookedAt: "2024-12-31" },
    ];
    expect(recentAccountsWithBalance(used).map((a) => a.name)).toEqual([
      "Latest",
      "A same day",
      "B same day",
      "Mid",
      "Old",
      "Older",
    ]);
    expect(recentAccountsWithBalance(used, 2).map((a) => a.name)).toEqual(["Latest", "A same day"]);
  });

  it("keeps every account, by name, with the empty ones last", () => {
    expect(accountsByName(accounts).map((a) => a.name)).toEqual([
      "Account 9",
      "Account 10",
      "bnp Paribas Fortis",
      "KBC Business PRO",
      null,
      "Revolut Personal EUR",
      "Revolut Personal USD",
    ]);
  });

  it("does not reorder the list it was given", () => {
    const before = accounts.map((a) => a.name);
    accountsByName(accounts);
    expect(accounts.map((a) => a.name)).toEqual(before);
    const dated = accounts.map((a, i) => ({ ...a, lastBookedAt: `2026-01-0${i + 1}` }));
    const datedBefore = dated.map((a) => a.name);
    recentAccountsWithBalance(dated);
    expect(dated.map((a) => a.name)).toEqual(datedBefore);
  });
});
