/**
 * The search index's rows: one per (document, entity), even when the
 * document names an entity twice.
 *
 * `.spec.ts` so codegen never claims the filename.
 */
import { describe, expect, it } from "vitest";
import { rowsFromState } from "./index-rows.js";
import { uniqueEntries } from "./processor.js";

describe("search rows", () => {
  it("keep one row per transaction id, the last one winning", () => {
    const rows = rowsFromState("acc-1", "sektar/bank-account", {
      name: "Current account",
      transactions: [
        { id: "t1", counterparty: "Acme", amount: 10 },
        { id: "t2", counterparty: "Bright", amount: 20 },
        // the same id twice, as a re-import produced it
        { id: "t1", counterparty: "Acme Ltd", amount: 12 },
      ],
    });
    expect(rows).toHaveLength(4);
    const unique = uniqueEntries(rows);
    expect(unique.map((r) => r.entity_id)).toEqual(["doc", "t1", "t2"]);
    expect(unique.find((r) => r.entity_id === "t1")?.title).toBe("Acme Ltd");
    expect(unique.find((r) => r.entity_id === "t1")?.amount).toBe(12);
  });

  it("leave distinct rows alone", () => {
    const rows = rowsFromState("c-1", "sektar/contact", { name: "Ann" });
    expect(uniqueEntries(rows)).toEqual(rows);
  });
});
