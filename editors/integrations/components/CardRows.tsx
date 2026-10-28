import {
  dispatchActions,
  useDocumentsByIds,
} from "@powerhousedao/reactor-browser";
import { actions, type IntegrationDocument } from "document-models/integration";
import { isOriginalSourceQueueDocument } from "document-models/original-source-queue";
import { Component, Suspense, useMemo, type ReactNode } from "react";
import { queueProgress, type QueueProgress } from "../../backfills/progress.js";
import { historyView, intervalLabel } from "../../sektar/kit/integrations.js";
import { Switch } from "../../sektar/kit/ui.js";

/**
 * The card's two rows (design system: Patterns · Integrations · card): Live
 * updates and Backfill, each with its switch. A switch writes the wish; the
 * reconciler on the runner turns the workflow on or off. The Backfill row
 * reads its queues from the Backfills drive.
 */
export function CardRows({ doc }: { doc: IntegrationDocument }) {
  const s = doc.state.global;
  const set = (action: Parameters<typeof dispatchActions>[0]) => {
    void dispatchActions(action, doc.header.id);
  };
  const ids = useMemo(
    () =>
      s.intent.backfill.items
        .map((item) => item.documentId)
        .filter((id): id is string => Boolean(id)),
    [s.intent.backfill.items],
  );
  const switchBackfill = (
    <Switch
      label="Backfill"
      checked={s.intent.backfill.enabled}
      onChange={(enabled) => set([actions.setBackfillEnabled({ enabled })])}
    />
  );
  return (
    <>
      <div className="sk-integration__row">
        <div>
          <div className="sk-integration__label">Live updates</div>
          <div className="sk-integration__meta">
            {s.intent.live.enabled
              ? `Checks for changes ${intervalLabel(s.intent.live.every)}`
              : "Off"}
          </div>
        </div>
        <Switch
          label="Live updates"
          checked={s.intent.live.enabled}
          onChange={(enabled) => set([actions.setLiveEnabled({ enabled })])}
        />
      </div>
      {s.intent.backfill.items.length > 0 && (
        <LoadBoundary
          key={ids.join(",")}
          fallback={<BackfillRow line="Starting" control={switchBackfill} />}
        >
          <Suspense
            fallback={<BackfillRow line="…" control={switchBackfill} />}
          >
            <BackfillProgress doc={doc} ids={ids} control={switchBackfill} />
          </Suspense>
        </LoadBoundary>
      )}
    </>
  );
}

function BackfillProgress({
  doc,
  ids,
  control,
}: {
  doc: IntegrationDocument;
  ids: string[];
  control: ReactNode;
}) {
  const queues = useDocumentsByIds(ids);
  const progress = new Map<string, QueueProgress>();
  for (const q of queues) {
    if (isOriginalSourceQueueDocument(q)) {
      progress.set(q.header.id, queueProgress(q.state.global));
    }
  }
  const view = historyView(doc.state.global, progress);
  if (!view) return null;
  return (
    <BackfillRow line={view.line} control={control} percent={view.percent} />
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
 * Calendar"), from its connection's label; the fallback until there is one.
 */
export function AccountLabel({
  connectionId,
  fallback,
}: {
  connectionId: string;
  fallback: string;
}) {
  return (
    <LoadBoundary fallback={fallback}>
      <ConnectionLabel connectionId={connectionId} fallback={fallback} />
    </LoadBoundary>
  );
}

function ConnectionLabel({
  connectionId,
  fallback,
}: {
  connectionId: string;
  fallback: string;
}) {
  const ids = useMemo(() => [connectionId], [connectionId]);
  const [connection] = useDocumentsByIds(ids);
  const label = (
    connection?.state as
      | { global?: { accountLabel?: string | null } }
      | undefined
  )?.global?.accountLabel;
  return <>{label ? `${label} · ${fallback}` : fallback}</>;
}

/** A queue that cannot be read (just deleted, not synced yet) shows the row without numbers. */
class LoadBoundary extends Component<
  { fallback: ReactNode; children: ReactNode },
  { failed: boolean }
> {
  override state = { failed: false };
  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }
  override render(): ReactNode {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
