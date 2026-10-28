import { describe, expect, it } from "vitest";
import { statelessWarning } from "./stateless-warning.js";

describe("statelessWarning", () => {
  it("says nothing when every operation had a state", () => {
    expect(statelessWarning("x", new Map())).toBeNull();
  });

  it("counts operations and names the documents with the most first", () => {
    const m = new Map([
      ["a", 1],
      ["b", 7],
      ["c", 3],
    ]);
    expect(statelessWarning("finance-index", m)).toBe(
      "[finance-index] 11 operation(s) of 3 document(s) without a resulting state left their rows unchanged: b (7), c (3), a (1)",
    );
  });

  it("names five and counts the rest", () => {
    const m = new Map(
      ["a", "b", "c", "d", "e", "f", "g"].map((id) => [id, 1] as const),
    );
    expect(statelessWarning("trip-index", m)).toMatch(
      /: a \(1\), b \(1\), c \(1\), d \(1\), e \(1\), \+2 more$/,
    );
  });
});
