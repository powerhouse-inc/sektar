import {
  useIntegrationDocumentsInSelectedDrive,
  type IntegrationDocument,
} from "document-models/integration";
import growthDark from "../../sektar/design/shapes/sektar-growth-four-column-combined-dark.svg";
import growthLight from "../../sektar/design/shapes/sektar-growth-four-column-combined-light.svg";
import { EndMark } from "../../sektar/kit/endmark.js";
import { KINDS } from "../../sektar/kit/integrations.js";
import {
  PullHeader,
  pullResult,
  usePullToRefresh,
} from "../../sektar/kit/pull-to-refresh.js";
import {
  syncRow,
  syncSummary,
  type SyncRow,
} from "../../sektar/kit/sync-status.js";
import { Button, EmptyState, PageHeader } from "../../sektar/kit/ui.js";
import { useSyncNow, useTriggerStates } from "../../sektar/kit/use-sync.js";
import { useCallback, useState } from "react";
import { CreateFlow, firstStep, STEPS, type CreateStep } from "./CreateFlow.js";
import { IntegrationCard } from "./IntegrationCard.js";
import { IntegrationDetail } from "./IntegrationDetail.js";
import { useHashStep } from "./use-hash-step.js";

/**
 * The Integrations page (design system: Patterns · Integrations): the cards,
 * grouped by kind, and the create flow behind "Add integration". The flow's
 * step lives in the hash, so the phone's back button walks it back. While the
 * page is empty, the empty state carries the only Add button; the header gets
 * it once cards exist.
 */
export function IntegrationsPage() {
  const [hash, setHash] = useHashStep();
  const docs = useIntegrationDocumentsInSelectedDrive() ?? [];
  const triggers = useTriggerStates();
  const step = STEPS.find((s) => s === hash);
  // An open integration: #i/<document id>
  const openId = hash?.startsWith("i/") ? hash.slice(2) : null;
  const opened = openId ? docs.find((d) => d.header.id === openId) : undefined;
  const open = useCallback((id: string) => setHash(`i/${id}`), [setHash]);
  // Sync now: every live update on the page (a pull, or Sync all now); never a backfill
  const { syncing, sync } = useSyncNow();
  const rows = docs
    .map((d) =>
      syncRow(
        d.header.id,
        d.header.name,
        d.state.global,
        d.state.global.resources.liveWorkflowId
          ? triggers.get(d.state.global.resources.liveWorkflowId)
          : undefined,
      ),
    )
    .filter((r): r is SyncRow => r !== null);
  const live = rows
    .map((r) => r.workflowId)
    .filter((id): id is string => Boolean(id));
  const busy = live.some((id) => syncing.has(id));
  const summary = syncSummary(rows, triggers, busy);
  const [scroller, setScroller] = useState<HTMLElement | null>(null);
  // Touches bubble up from the page; whatever scrolls it (the shell or
  // Connect's frame) must be at its top for a pull to start
  const pageRef = useCallback((el: HTMLElement | null) => setScroller(el), []);
  const ptr = usePullToRefresh(scroller, async () =>
    pullResult(await sync(live)),
  );

  if (opened) {
    return (
      <div className="sk-page">
        <IntegrationDetail doc={opened} onBack={() => setHash(null)} />
        <EndMark margin />
      </div>
    );
  }

  if (step) {
    return (
      <div className="sk-page">
        <div className="sk-stack sk-stack--6">
          <nav className="sk-breadcrumb" aria-label="Breadcrumb">
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                setHash(null);
              }}
            >
              Integrations
            </a>{" "}
            <span aria-hidden="true">/</span> <span>New</span>
          </nav>
          <CreateFlow
            step={step}
            go={(next: CreateStep) => setHash(next)}
            onDone={() => setHash(null, { replace: true })}
            onCancel={() => setHash(null)}
          />
        </div>
        <EndMark margin />
      </div>
    );
  }

  const add = (
    <Button variant="primary" icon="plus" onClick={() => setHash(firstStep())}>
      Add integration
    </Button>
  );
  const syncAll = (
    <Button
      icon="sync"
      disabled={live.length === 0 || busy}
      onClick={() => void sync(live)}
    >
      {busy ? "Syncing…" : "Sync all now"}
    </Button>
  );
  const groups = KINDS.map((k) => ({
    info: k,
    docs: docs
      .filter((d) => d.state.global.kind === k.kind)
      .sort((a, b) => (a.header.name || "").localeCompare(b.header.name || "")),
  })).filter((g) => g.docs.length > 0);
  const unset = docs.filter((d: IntegrationDocument) => !d.state.global.kind);

  return (
    <div className="sk-page" ref={pageRef}>
      <PullHeader
        {...ptr}
        words={{
          idle: `Everything · ${summary?.label.toLowerCase() ?? "nothing connected"}`,
          busy: "Checking for changes…",
          busySub: "Every integration",
        }}
      />
      <div className="sk-stack sk-stack--8">
        <PageHeader
          title="Integrations"
          lead="Your mail, bank accounts and calendars, kept up to date in Sektar."
          art={{ light: growthLight, dark: growthDark }}
          actions={
            docs.length > 0 ? (
              <>
                {syncAll}
                {add}
              </>
            ) : undefined
          }
        />
        {docs.length === 0 ? (
          <EmptyState icon="sync" title="Nothing connected yet" action={add}>
            Pick an account and how far back to go. Sektar brings in what is
            there and keeps it up to date.
          </EmptyState>
        ) : (
          <div className="sk-stack sk-stack--8">
            {groups.map((g) => (
              <section key={g.info.kind} className="sk-integration-group">
                <h2
                  className="sk-h4"
                  style={{ margin: "0 0 var(--sk-space-4)" }}
                >
                  {g.info.label}{" "}
                  <span className="sk-text-muted sk-weight-regular">
                    {g.docs.length}
                  </span>
                </h2>
                <div className="sk-integration-grid">
                  {g.docs.map((d) => (
                    <IntegrationCard
                      key={d.header.id}
                      doc={d}
                      triggers={triggers}
                      onOpen={open}
                    />
                  ))}
                </div>
              </section>
            ))}
            {unset.length > 0 && (
              <section className="sk-integration-group">
                <h2
                  className="sk-h4"
                  style={{ margin: "0 0 var(--sk-space-4)" }}
                >
                  Not set up
                </h2>
                <div className="sk-integration-grid">
                  {unset.map((d) => (
                    <IntegrationCard
                      key={d.header.id}
                      doc={d}
                      triggers={triggers}
                      onOpen={open}
                    />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
      <EndMark margin />
    </div>
  );
}
