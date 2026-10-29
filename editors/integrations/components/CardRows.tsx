import { dispatchActions } from "@powerhousedao/reactor-browser";
import { actions, type IntegrationState } from "document-models/integration";
import type { ReactNode } from "react";
import type { QueueProgress } from "../../backfills/progress.js";
import {
  patchIntegration,
  type ConnectionListRow,
  type IntegrationItem,
} from "../../sektar/kit/integration-index.js";
import { historyView, liveLine } from "../../sektar/kit/integrations.js";
import type { TriggerState } from "../../sektar/kit/workflow-runtime.js";
import { Switch } from "../../sektar/kit/ui.js";

/**
 * Flips a switch: the wish goes to the document by id, and the card shows
 * it at once (the index follows a beat later).
 */
export function setSwitch(
  integration: IntegrationItem,
  action: Parameters<typeof dispatchActions>[0],
  apply: (s: IntegrationState) => IntegrationState,
): void {
  patchIntegration(integration, apply);
  void dispatchActions(action, integration.id);
}

/**
 * The card's two rows (design system: Patterns · Integrations · card): Live
 * updates and Backfill, each with its switch. A switch writes the wish; the
 * reconciler on the runner turns the workflow on or off. The Backfill row
 * reads its queues' progress from the integration index (the Backfills
 * drive's queues), passed in by the page.
 */
export function CardRows({
  integration,
  liveTrigger,
  progress,
}: {
  integration: IntegrationItem;
  /** The runtime's state of the live workflow's trigger, once read */
  liveTrigger?: TriggerState;
  /** The queues' progress by queue id; undefined while the index is read */
  progress?: ReadonlyMap<string, QueueProgress>;
}) {
  const s = integration.state;
  const live = liveLine(s, liveTrigger);
  const switchBackfill = (
    <Switch
      label="Backfill"
      checked={s.intent.backfill.enabled}
      onChange={(enabled) =>
        setSwitch(integration, [actions.setBackfillEnabled({ enabled })], (x) => ({
          ...x,
          intent: { ...x.intent, backfill: { ...x.intent.backfill, enabled } },
        }))
      }
    />
  );
  const view = progress ? historyView(s, progress) : null;
  return (
    <>
      <div className="sk-integration__row">
        <div>
          <div className="sk-integration__label">Live updates</div>
          <div className="sk-integration__meta">
            {live.dot && (
              <span className={`sk-sync-dot sk-sync-dot--${live.dot}`} />
            )}
            {live.line}
          </div>
        </div>
        <Switch
          label="Live updates"
          checked={s.intent.live.enabled}
          onChange={(enabled) =>
            setSwitch(integration, [actions.setLiveEnabled({ enabled })], (x) => ({
              ...x,
              intent: { ...x.intent, live: { ...x.intent.live, enabled } },
            }))
          }
        />
      </div>
      {s.intent.backfill.items.length > 0 &&
        (!progress ? (
          <BackfillRow line="…" control={switchBackfill} />
        ) : (
          view && (
            <BackfillRow
              line={view.line}
              control={switchBackfill}
              percent={view.percent}
            />
          )
        ))}
    </>
  );
}

function BackfillRow({
  line,
  control,
  percent,
}: {
  line: string;
  control: ReactNode;
  percent?: number | null;
}) {
  return (
    <div className="sk-integration__row">
      <div>
        <div className="sk-integration__label">Backfill</div>
        <div className="sk-integration__meta">{line}</div>
      </div>
      {control}
      {percent !== undefined && percent !== null && (
        <div className="sk-progress-row">
          <div className="sk-progress">
            <div
              className="sk-progress__bar"
              style={{ width: `${percent}%` }}
            />
          </div>
          <span className="sk-progress-row__value">{percent}%</span>
        </div>
      )}
    </div>
  );
}

/**
 * The account the integration signed in as ("wouter@powerhouse.inc · Google
 * Calendar"), from its connection's label in the index; the fallback until
 * there is one.
 */
export function AccountLabel({
  connection,
  fallback,
}: {
  connection: ConnectionListRow | undefined;
  fallback: string;
}) {
  const label = connection?.accountLabel;
  return <>{label ? `${label} · ${fallback}` : fallback}</>;
}
