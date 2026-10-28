import type { IntegrationDocument } from "document-models/integration";
import {
  cardView,
  kindInfo,
  providerInfo,
} from "../../sektar/kit/integrations.js";
import { Badge, Icon } from "../../sektar/kit/ui.js";

/**
 * One integration on the page (design system: Patterns · Integrations ·
 * card). While it waits for the sign-in on the runner there is nothing to
 * switch yet, so the card shows the state and what to do; the Live updates
 * and Backfill rows come with the workflows (pilot steps 4 and 5).
 */
export function IntegrationCard({ doc }: { doc: IntegrationDocument }) {
  const s = doc.state.global;
  const view = cardView(s);
  const kind = kindInfo(s.kind);
  const provider = providerInfo(s.provider);
  const account =
    [provider?.lead, kind?.label].filter(Boolean)[0] ?? "Not set up";
  return (
    <article
      className={
        view.state === "attention"
          ? "sk-card sk-integration sk-integration--attention"
          : "sk-card sk-integration"
      }
    >
      <header className="sk-integration__head">
        <span className="sk-icon-tile">
          <Icon name={kind?.icon ?? "sync"} />
        </span>
        <div style={{ minWidth: 0 }}>
          <div className="sk-integration__name">
            {doc.header.name || kind?.label}
          </div>
          <div className="sk-integration__account">{account}</div>
        </div>
        <Badge tone={view.badge.tone} dot={view.badge.dot}>
          {view.badge.label}
        </Badge>
      </header>
      <div className="sk-integration__row">
        <div>
          <div className="sk-integration__label">
            {view.state === "waiting-for-sign-in" ? "Next" : "Status"}
          </div>
          <div className="sk-integration__meta">{view.line}</div>
        </div>
      </div>
    </article>
  );
}
