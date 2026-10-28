import { describe, expect, it } from "vitest";
import { runsToRetry, type RunSummary } from "./workflow-runtime.js";

const slice = (day: number) => ({ ranges: { day: { from: `2017-01-${day}`, to: `2017-01-${day + 1}` } } });
const run = (id: string, status: string, day: number, patch: Partial<RunSummary> = {}): RunSummary => ({
  id,
  status,
  error: null,
  triggerKind: "piece:for-every",
  triggerPayload: slice(day),
  ...patch,
});
const skipped = (id: string, day: number) =>
  run(id, "CANCELLED", day, { error: "Skipped: this workflow is PARKED (Parked after a failed run …)" });
const ids = (r: ReturnType<typeof runsToRetry>) =>
  r && { failed: r.failed?.id ?? null, skipped: r.skipped.map((x) => x.id) };

describe("runsToRetry", () => {
  it("is the failed run, then the firings refused while parked, oldest first", () => {
    expect(
      ids(runsToRetry([skipped("s23", 23), skipped("s22", 22), skipped("s21", 21), run("f", "FAILED", 20), run("ok", "SUCCEEDED", 19)])),
    ).toEqual({ failed: "f", skipped: ["s21", "s22", "s23"] });
    expect(ids(runsToRetry([run("f", "FAILED", 20)]))).toEqual({ failed: "f", skipped: [] });
  });

  it("looks past an earlier Try again and leaves out what it brought in", () => {
    expect(
      ids(
        runsToRetry([
          run("m21", "SUCCEEDED", 21, { triggerKind: "manual" }),
          run("r20", "SUCCEEDED", 20, { triggerKind: "rerun" }),
          skipped("s22", 22),
          skipped("s21", 21),
          run("f", "FAILED", 20),
        ]),
      ),
    ).toEqual({ failed: null, skipped: ["s22"] });
  });

  it("is nothing when the trigger's newest outcome is not a failure", () => {
    expect(runsToRetry([run("ok", "SUCCEEDED", 21), run("f", "FAILED", 20)])).toBeNull();
    expect(runsToRetry([run("c", "CANCELLED", 21, { error: "Cancelled by the user" }), run("f", "FAILED", 20)])).toBeNull();
    expect(runsToRetry([skipped("s1", 21)])).toBeNull();
    expect(runsToRetry([])).toBeNull();
  });
});
