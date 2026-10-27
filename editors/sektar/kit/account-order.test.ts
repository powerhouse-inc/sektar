import { describe, expect, it } from "vitest";
import {
  accountsByName,
  accountsWithBalance,
  isZeroBalance,
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

  it("drops empty accounts and sorts the rest by name, unnamed last", () => {
    expect(accountsWithBalance(accounts).map((a) => a.name)).toEqual([
      "Account 9",
      "Account 10",
      "bnp Paribas Fortis",
      "KBC Business PRO",
      null,
    ]);
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
    accountsWithBalance(accounts);
    expect(accounts.map((a) => a.name)).toEqual(before);
  });
});
