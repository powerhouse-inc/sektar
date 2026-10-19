/**
 * The scratchpad a workflow keeps between iterations.
 *
 * Read only here. These slots are written by the flow that owns the walk — a
 * page token, a running tally — and a person editing them by hand mid-run
 * would be changing the flow's own working state from underneath it. Shown
 * because seeing what the flow believes is often how a stuck backfill gets
 * diagnosed.
 */
import type { OsqMemoryEntry } from "document-models/original-source-queue";
import { CARD, str } from "./lib.js";

export function Memory({ memory }: { memory: OsqMemoryEntry[] }) {
  if (memory.length === 0) {
    return (
      <section className={CARD}>
        <h2 className="text-sm font-semibold text-foreground">Memory</h2>
        <p className="mt-2 text-xs text-muted-foreground">
          Empty. A workflow writes named slots here to carry state across
          iterations — a page token, a count, the id it stopped at.
        </p>
      </section>
    );
  }

  return (
    <section className={CARD}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold text-foreground">Memory</h2>
        <span className="text-xs text-muted-foreground">
          written by the workflow
        </span>
      </div>
      <table className="mt-2 w-full text-xs">
        <tbody>
          {memory.map((entry) => (
            <tr key={entry.key} className="border-t border-border">
              <td className="py-1 pr-3 align-top font-medium text-foreground">
                {entry.key}
              </td>
              <td className="py-1 break-all text-muted-foreground">
                {str(entry.value)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
