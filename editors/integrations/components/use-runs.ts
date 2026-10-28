import { useCallback, useEffect, useState } from "react";
import type { RunRecord } from "../../sektar/kit/integration-detail.js";
import { useWorkflowRuntimeUrl } from "../../sektar/kit/workflow-runtime.js";

/**
 * A workflow's runs from the runtime, read now and again every `everyMs`
 * while the page is open; `reload` reads them at once (after Sync now or Try
 * again). Null until the first read answers.
 */
export function useRuns(
  workflowId: string | null | undefined,
  load: (url: string, workflowId: string) => Promise<RunRecord[]>,
  everyMs = 30_000,
): { runs: RunRecord[] | null; error: string | null; reload: () => void } {
  const url = useWorkflowRuntimeUrl();
  const [runs, setRuns] = useState<RunRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const reload = useCallback(() => setTick((n) => n + 1), []);

  useEffect(() => {
    if (!workflowId) {
      setRuns([]);
      return;
    }
    let live = true;
    const read = () =>
      load(url, workflowId).then(
        (next) => {
          if (!live) return;
          setRuns(next);
          setError(null);
        },
        (e: unknown) => {
          if (live) setError(e instanceof Error ? e.message : String(e));
        },
      );
    void read();
    const timer = window.setInterval(() => void read(), everyMs);
    return () => {
      live = false;
      window.clearInterval(timer);
    };
  }, [url, workflowId, load, everyMs, tick]);

  return { runs, error, reload };
}
