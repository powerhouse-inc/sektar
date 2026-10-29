/**
 * The finance index subgraph declares access for every query field: the
 * definition throws where it is written when one is missing, so importing it
 * is the check.
 *
 * `.spec.ts` so codegen never claims the filename.
 */
import { describe, expect, it } from "vitest";

describe("the finance index subgraph", () => {
  it("is fully declared", async () => {
    const { FinanceIndexSubgraph } = await import("./index.js");
    expect(typeof FinanceIndexSubgraph).toBe("function");
  });
});
