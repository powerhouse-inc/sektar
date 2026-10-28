import { dispatchActions } from "@powerhousedao/reactor-browser";
import { actions as workflowActions } from "@powerhousedao/workflow/document-models/workflow";
import { generateId } from "document-model";
import { actions, type IntegrationDocument } from "document-models/integration";
import { useState } from "react";
import {
  rerunLastFailed,
  useWorkflowRuntimeUrl,
} from "../../sektar/kit/workflow-runtime.js";
import { Button } from "../../sektar/kit/ui.js";

/**
 * "Try again" for a workflow the runtime parked after a failed run: run the
 * failed run again (a backfill's slice included), and when it goes through,
 * switch the workflow off and on, which lifts the park; then ask the
 * reconciler to look again so the card catches up. A rerun that fails again
 * leaves it parked and says why.
 */
export function TryAgain({
  doc,
  workflowId,
}: {
  doc: IntegrationDocument;
  workflowId: string;
}) {
  const url = useWorkflowRuntimeUrl();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const retry = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await rerunLastFailed(url, workflowId);
      if (result && result.status !== "SUCCEEDED") {
        setError(
          result.error ?? `The run ended ${result.status.toLowerCase()}`,
        );
        return;
      }
      await dispatchActions(
        [
          workflowActions.setWorkflowStatus({ status: "DISABLED" }),
          workflowActions.setWorkflowStatus({ status: "ENABLED" }),
        ],
        workflowId,
      );
      await dispatchActions(
        [
          actions.requestCheck({
            id: generateId(),
            requestedAt: new Date().toISOString(),
          }),
        ],
        doc.header.id,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="sk-stack sk-stack--2">
      <div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => void retry()}
          disabled={busy}
        >
          {busy ? "Trying again…" : "Try again"}
        </Button>
      </div>
      {error && (
        <p className="sk-small sk-text-danger" style={{ margin: 0 }}>
          Still failing: {error}
        </p>
      )}
    </div>
  );
}
