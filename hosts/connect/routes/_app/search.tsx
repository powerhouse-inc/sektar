import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  EXPENSE_STATUS,
  fmtShortDate,
  INVOICE_STATUS,
  money,
  TX_STATUS,
  plural,
} from "../../../../editors/sektar/kit/format.js";
import {
  hitTarget,
  KIND_LABEL,
  useGlobalSearch,
  type SearchHit,
} from "../../../../editors/sektar/kit/search.js";
import {
  Badge,
  EmptyState,
  IconTile,
  ListItem,
  PageHeader,
  type IconName,
} from "../../../../editors/sektar/kit/ui.js";
import { useSearch } from "../-shared/search.js";

export const Route = createFileRoute("/_app/search")({
  head: () => ({ meta: [{ title: "Search · Sektar" }] }),
  component: SearchPage,
});

const ICON: Record<string, IconName> = {
  invoice: "invoice",
  contact: "customers",
  expense: "wallet",
  account: "bank",
  transaction: "transactions",
};

export function hitMeta(h: SearchHit): string {
  const parts: string[] = [];
  if (h.subtitle) parts.push(h.subtitle);
  if (h.at) parts.push(fmtShortDate(h.at));
  return parts.join(" · ");
}

export function hitStatus(h: SearchHit) {
  if (!h.status) return null;
  if (h.kind === "invoice" && h.status in INVOICE_STATUS) {
    const s = INVOICE_STATUS[h.status as keyof typeof INVOICE_STATUS];
    return <Badge tone={s.tone}>{s.label}</Badge>;
  }
  if (h.kind === "expense" && h.status in EXPENSE_STATUS) {
    const s = EXPENSE_STATUS[h.status as keyof typeof EXPENSE_STATUS];
    return <Badge tone={s.tone}>{s.label}</Badge>;
  }
  if (h.kind === "transaction" && h.status in TX_STATUS) {
    const s = TX_STATUS[h.status as keyof typeof TX_STATUS];
    return <Badge tone={s.tone}>{s.label}</Badge>;
  }
  return (
    <Badge tone="outline">{h.status.toLowerCase().replace(/_/g, " ")}</Badge>
  );
}

function SearchPage() {
  const { query } = useSearch();
  const { grouped, hits, active, isLoading } = useGlobalSearch(query, 100);
  const navigate = useNavigate();
  return (
    <div className="sk-page sk-stack sk-stack--6">
      <PageHeader
        eyebrow="Search"
        title={active ? `Results for “${query}”` : "Search"}
        lead={
          active
            ? `${plural(hits.length, "match", "matches")} across invoices, contacts, claims and the bank feed.`
            : "Type in the search box above: numbers, names, references, amounts."
        }
      />
      {!active ? (
        <EmptyState icon="search" title="Nothing to search for yet">
          Try an invoice number, a supplier, a merchant on a receipt, or an
          amount like 2450.
        </EmptyState>
      ) : hits.length === 0 && !isLoading ? (
        <EmptyState icon="search" title="No matches">
          Nothing in the books mentions “{query}”.
        </EmptyState>
      ) : (
        <div className="sk-grid sk-grid--2">
          {grouped.map(([kind, list]) => (
            <section key={kind} className="sk-card sk-stack sk-stack--3">
              <div className="sk-row sk-row--between">
                <h3 className="sk-card__title">{KIND_LABEL[kind] ?? kind}</h3>
                <Badge tone="outline" pill>
                  {list.length}
                </Badge>
              </div>
              <ul className="sk-list sk-list--divided">
                {list.map((h) => (
                  <li key={`${h.document_id}:${h.entity_id}`}>
                    <ListItem
                      icon={
                        <IconTile name={ICON[h.kind] ?? "folder"} size="sm" />
                      }
                      title={
                        <span className="sk-row sk-row--2 sk-row--wrap">
                          {h.title}
                          {hitStatus(h)}
                        </span>
                      }
                      meta={hitMeta(h)}
                      value={
                        h.amount !== null ? (
                          <span
                            className={
                              h.kind === "transaction" && h.amount > 0
                                ? "sk-amount--in"
                                : ""
                            }
                          >
                            {money(h.amount, "EUR", {
                              signed: h.kind === "transaction",
                            })}
                          </span>
                        ) : undefined
                      }
                      chevron
                      onClick={() => {
                        const t = hitTarget(h);
                        void navigate({ to: t.to, search: t.search } as never);
                      }}
                    />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
