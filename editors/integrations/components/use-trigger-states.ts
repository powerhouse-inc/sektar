import { useEffect, useState } from "react";
import {
  triggerStates,
  useWorkflowRuntimeUrl,
  type TriggerState,
} from "../../sektar/kit/workflow-runtime.js";

const EVERY_MS = 30_000;

/**
 * The runtime's trigger states by workflow id, read once for the whole page
 * and again every 30 s (which also keeps "4 min ago" current). Empty while
 * the switchboard does not answer: the cards then say how often they check.
 */
export function useTriggerStates(): ReadonlyMap<string, TriggerState> {
  const url = useWorkflowRuntimeUrl();
  const [states, setStates] = useState<ReadonlyMap<string, TriggerState>>(
    () => new Map(),
  );
  useEffect(() => {
    let stopped = false;
    const load = async () => {
      try {
        const list = await triggerStates(url);
        if (!stopped) setStates(new Map(list.map((t) => [t.workflowId, t])));
      } catch {
        // the switchboard is restarting or this person may not read it: keep what we had
      }
    };
    void load();
    const timer = window.setInterval(() => void load(), EVERY_MS);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [url]);
  return states;
}
