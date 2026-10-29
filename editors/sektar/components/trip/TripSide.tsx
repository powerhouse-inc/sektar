// Beside a trip: what to add next, the trip's key facts, and where Sektar
// found what it knows (the mails, the invoice lines, the files), newest first.
import { useDocumentsByIds } from "@powerhousedao/reactor-browser";
import type { TripDocument, TripSource } from "document-models/trip";
import { useMemo, useState } from "react";
import { fmtDate, money } from "../../kit/format.js";
import { GlyphTile } from "../../kit/trip-glyphs.js";
import { STATUS } from "../../kit/trips.js";
import { Card, Dl, Feed, type IconName } from "../../kit/ui.js";
import { ItemForm, type Dispatch, type ItemKind } from "./TripForms.js";

const SOURCE_ICON: Record<TripSource["kind"], IconName> = {
  EMAIL: "mail",
  INVOICE_LINE: "invoice",
  FILE: "folder",
  CALENDAR: "calendar",
  MANUAL: "settings",
};

/** How many sources the side lists, newest first. */
const SOURCES_SHOWN = 12;

const ADD: { kind: ItemKind; label: string; glyph: "plane" | "bed" | "meal" | "ticket" }[] = [
  { kind: "transport", label: "Add a leg", glyph: "plane" },
  { kind: "stay", label: "Add a stay", glyph: "bed" },
  { kind: "meal", label: "Add a meal", glyph: "meal" },
  { kind: "extra", label: "Add a cost", glyph: "ticket" },
];

export function TripSide({ doc, dispatch }: { doc: TripDocument; dispatch: Dispatch }) {
  const s = doc.state.global;
  const [adding, setAdding] = useState<ItemKind | null>(null);
  const sources = useMemo(() => [...s.sources].sort((a, b) => (b.at ?? "").localeCompare(a.at ?? "")), [s.sources]);
  // The names of the sources shown that carry no label of their own: at most
  // a dozen documents, not every source the trip ever collected.
  const ids = useMemo(
    () => [
      ...new Set(
        sources
          .slice(0, SOURCES_SHOWN)
          .filter((x) => !x.label)
          .map((x) => x.documentId)
          .filter((x): x is string => !!x),
      ),
    ],
    [sources],
  );
  const named = useDocumentsByIds(ids);
  const nameOf = (id: string | null | undefined) => (id ? named.find((d) => d.header.id === id)?.header.name : undefined);

  return (
    <div className="sk-trip-side">
      <Card title="Quick actions" compact>
        <div className="sk-action-grid sk-trip-side__actions">
          {ADD.map((a) => (
            <button key={a.kind} type="button" className="sk-action-tile" onClick={() => setAdding(a.kind)}>
              <GlyphTile name={a.glyph} size="sm" />
              <span className="sk-weight-medium">{a.label}</span>
            </button>
          ))}
        </div>
      </Card>

      <Card title="The trip" compact>
        <Dl
          tight
          rows={[
            { label: "Status", value: STATUS[s.status] },
            { label: "Reported in", value: s.currency },
            { label: "Billable", value: s.billing?.billable ? (s.billing.customerName ?? "Yes") : "No" },
            { label: "Documents", value: String(s.attachments.length) },
            ...(s.notes ? [{ label: "Notes", value: s.notes }] : []),
          ]}
        />
      </Card>

      <Card title="Found in" compact>
        {sources.length ? (
          <Feed
            items={sources.slice(0, SOURCES_SHOWN).map((x) => ({
              key: x.id,
              icon: SOURCE_ICON[x.kind],
              text: x.label ?? nameOf(x.documentId) ?? x.kind.toLowerCase().replace("_", " "),
              sub: x.kind === "INVOICE_LINE" ? "Sales invoice" : x.kind === "EMAIL" ? "Mail" : x.kind === "FILE" ? "Files" : undefined,
              time: x.at ? fmtDate(x.at) : undefined,
            }))}
          />
        ) : (
          <p className="sk-small sk-text-muted">Entered by hand.</p>
        )}
      </Card>

      {adding && <ItemForm kind={adding} state={s} dispatch={dispatch} onClose={() => setAdding(null)} />}
    </div>
  );
}

/** A trip's cost as a short line: "€607.54 · 4 legs". */
export function tripLine(total: number, currency: string, legs: number): string {
  return `${money(total, currency)}${legs ? ` · ${legs} ${legs === 1 ? "leg" : "legs"}` : ""}`;
}
