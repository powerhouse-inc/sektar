import {
  deleteNode,
  dispatchActions,
  useSelectedDrive,
} from "@powerhousedao/reactor-browser";
import { actions, type IntegrationDocument } from "document-models/integration";
import { Suspense, useState } from "react";
import {
  cardView,
  kindInfo,
  providerInfo,
  removalPlan,
} from "../../sektar/kit/integrations.js";
import { Menu } from "../../sektar/kit/menu.js";
import { Alert, Badge, Button, Icon, Modal } from "../../sektar/kit/ui.js";
import { AccountLabel, CardRows } from "./CardRows.js";
import type { TriggerState } from "../../sektar/kit/workflow-runtime.js";
import { SignIn } from "./SignIn.js";

/**
 * One integration on the page (design system: Patterns · Integrations ·
 * card). While it waits for the sign-in on the runner there is nothing to
 * switch yet, so the card shows the state and what to do; once it is set up,
 * the Live updates and Backfill rows follow (CardRows). Its menu
 * removes it, through a confirmation that says what removing does.
 */
export function IntegrationCard({
  doc,
  triggers,
}: {
  doc: IntegrationDocument;
  /** The runtime's trigger states by workflow id (useTriggerStates) */
  triggers?: ReadonlyMap<string, TriggerState>;
}) {
  const s = doc.state.global;
  const view = cardView(s);
  const kind = kindInfo(s.kind);
  const provider = providerInfo(s.provider);
  const account =
    [provider?.lead, kind?.label].filter(Boolean)[0] ?? "Not set up";
  const [removing, setRemoving] = useState(false);
  const name = doc.header.name || kind?.label || "Integration";
  // All well (Live, Paused): the rows below say it, and the badge sits in
  // the head as in the design system; otherwise a Status row says what is up.
  const quiet = view.state === "live" || view.state === "paused";
  return (
    <article
      className={
        view.state === "attention"
          ? "sk-card sk-integration sk-integration--attention"
          : "sk-card sk-integration"
      }
    >
      <header
        className={
          quiet
            ? "sk-integration__head sk-integration__head--menu sk-integration__head--badge"
            : "sk-integration__head sk-integration__head--menu"
        }
      >
        <span className="sk-icon-tile">
          <Icon name={kind?.icon ?? "sync"} />
        </span>
        <div style={{ minWidth: 0 }}>
          <div className="sk-integration__name">{name}</div>
          <div className="sk-integration__account">
            {s.resources.connectionId ? (
              <Suspense fallback={account}>
                <AccountLabel
                  connectionId={s.resources.connectionId}
                  fallback={account}
                />
              </Suspense>
            ) : (
              account
            )}
          </div>
        </div>
        {quiet && (
          <Badge tone={view.badge.tone} dot={view.badge.dot}>
            {view.badge.label}
          </Badge>
        )}
        <Menu
          label={`${name}: more`}
          items={[
            {
              label: "Remove…",
              icon: "close",
              danger: true,
              disabled: view.state === "removing",
              onSelect: () => setRemoving(true),
            },
          ]}
          trigger={(open, toggle) => (
            <button
              type="button"
              className="sk-more"
              aria-label={`${name}: more`}
              aria-expanded={open}
              onClick={toggle}
            />
          )}
        />
      </header>
      {!quiet && (
        <div className="sk-integration__row">
          <div>
            <div className="sk-integration__label">
              {view.state === "waiting-for-sign-in" ||
              view.state === "incomplete"
                ? "Next"
                : "Status"}
            </div>
            <div className="sk-integration__meta">{view.line}</div>
          </div>
          <Badge tone={view.badge.tone} dot={view.badge.dot}>
            {view.badge.label}
          </Badge>
        </div>
      )}
      {view.state === "waiting-for-sign-in" && <SignIn doc={doc} />}
      {(view.state === "live" ||
        view.state === "paused" ||
        view.state === "applying" ||
        view.state === "attention") && (
        <CardRows
          doc={doc}
          liveTrigger={
            s.resources.liveWorkflowId
              ? triggers?.get(s.resources.liveWorkflowId)
              : undefined
          }
        />
      )}
      {removing && (
        <RemoveDialog
          doc={doc}
          name={name}
          onClose={() => setRemoving(false)}
        />
      )}
    </article>
  );
}

/**
 * Confirms a removal and says what it does. Something built (a sign-in,
 * workflows, backfills) is taken down by the reconciler on the runner first,
 * so the app records the wish (ARCHIVE) and the card shows Removing; an
 * integration that never built anything is deleted right away.
 */
function RemoveDialog({
  doc,
  name,
  onClose,
}: {
  doc: IntegrationDocument;
  name: string;
  onClose: () => void;
}) {
  const [drive] = useSelectedDrive();
  const plan = removalPlan(doc.state.global);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remove = async () => {
    setBusy(true);
    setError(null);
    try {
      if (plan.immediate) {
        if (!drive) throw new Error("The Integrations drive is not open");
        await deleteNode(drive.header.id, doc.header.id);
      } else {
        await dispatchActions([actions.archive({})], doc.header.id);
      }
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  return (
    <Modal
      title={`Remove ${name}?`}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={() => void remove()}
            disabled={busy}
          >
            {busy ? "Removing…" : "Remove"}
          </Button>
        </>
      }
    >
      <div className="sk-stack sk-stack--3">
        {plan.steps.length === 1 ? (
          <p>{plan.steps[0]}</p>
        ) : (
          <ol className="sk-intg-remove-steps">
            {plan.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        )}
        <p className="sk-small sk-text-muted">{plan.keeps}</p>
        {error && (
          <Alert tone="danger" title="Could not remove it">
            {error}
          </Alert>
        )}
      </div>
    </Modal>
  );
}
