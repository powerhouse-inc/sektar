// One trip, read first: why and where, the figures, the itinerary day by day,
// what it cost per kind (and what was billed on), and the documents behind
// it. Every row opens its form; the forms dispatch to the trip.
import { useAttachments } from "@powerhousedao/reactor-browser";
import {
  destinationLine,
  itinerary,
  stayNights,
  tripDays,
  tripNights,
  tripTotals,
  type ItineraryEntry,
  type TripAttachment,
  type TripCost,
  type TripDocument,
  type TripState,
} from "document-models/trip";
import { useMemo, useState, type ReactNode } from "react";
import { money, plural } from "../../kit/format.js";
import { Glyph, GlyphTile } from "../../kit/trip-glyphs.js";
import {
  dateRange,
  dayLabel,
  EXTRA,
  flag,
  MEAL,
  MODE,
  PHASE,
  phaseOf,
  PURPOSE,
  timeOf,
  type TripGlyph,
} from "../../kit/trips.js";
import { Badge, Button, Card, Chip, Donut, EmptyState, IconTile, Legend, MetaStrip, Tabs } from "../../kit/ui.js";
import { DestinationForm, DetailsForm, ItemForm, type Dispatch, type ItemKind } from "./TripForms.js";

type Tab = "overview" | "itinerary" | "costs" | "documents";
type Editing = { kind: "details" } | { kind: "destination" } | { kind: ItemKind; id?: string } | null;

const KIND_COLOR: Record<"transport" | "stays" | "meals" | "extras", string> = {
  transport: "var(--sk-chart-1)",
  stays: "var(--sk-chart-2)",
  meals: "var(--sk-chart-3)",
  extras: "var(--sk-chart-4)",
};

export function costText(cost: TripCost | null | undefined, tripCurrency: string): ReactNode {
  if (!cost) return <span className="sk-text-muted">—</span>;
  const own = money(cost.amount, cost.currency);
  if (cost.currency === tripCurrency) return own;
  return (
    <span className="sk-trip-cost">
      {cost.converted != null ? money(cost.converted, tripCurrency) : <span className="sk-text-muted">not converted</span>}
      <span className="sk-trip-cost__orig">{own}</span>
    </span>
  );
}

/** What an itinerary entry says: its glyph, its line, its detail, its time. */
export function describe(e: ItineraryEntry): { glyph: TripGlyph; title: string; sub: string | null; time: string | null } {
  if (e.kind === "transport") {
    const t = e.item;
    const route = t.from || t.to ? `${t.from ?? "?"} → ${t.to ?? "?"}` : null;
    const title = [MODE[t.mode].label, t.carrier, t.number].filter(Boolean).join(" · ");
    const span = [timeOf(t.departAt), timeOf(t.arriveAt)].filter(Boolean).join(" – ");
    return { glyph: MODE[t.mode].glyph, title: route ? `${route}` : title, sub: route ? title : t.note ?? null, time: span || null };
  }
  if (e.kind === "stay") {
    const s = e.item;
    const n = stayNights(s);
    return { glyph: "bed", title: s.name, sub: [s.city, n !== null ? plural(n, "night") : null, s.bookedVia].filter(Boolean).join(" · ") || null, time: null };
  }
  if (e.kind === "meal") {
    const m = e.item;
    return { glyph: MEAL[m.kind].glyph, title: m.venue ?? MEAL[m.kind].label, sub: [m.venue ? MEAL[m.kind].label : null, m.attendees].filter(Boolean).join(" · ") || null, time: timeOf(m.at) };
  }
  const x = e.item;
  return { glyph: EXTRA[x.kind].glyph, title: x.description, sub: EXTRA[x.kind].label, time: timeOf(x.at) };
}

const kindOf = (e: ItineraryEntry): ItemKind => e.kind;

/** The itinerary in days: what has a date under its day, the rest at the end. */
function days(entries: ItineraryEntry[]) {
  const out: { day: string | null; entries: ItineraryEntry[] }[] = [];
  for (const e of entries) {
    const d = e.at ? e.at.slice(0, 10) : null;
    const last = out.at(-1);
    if (last && last.day === d) last.entries.push(e);
    else out.push({ day: d, entries: [e] });
  }
  return out;
}

export function TripOverview({ doc, dispatch, compact }: { doc: TripDocument; dispatch: Dispatch; compact?: boolean }) {
  const s = doc.state.global;
  const [tab, setTab] = useState<Tab>("overview");
  const [editing, setEditing] = useState<Editing>(null);
  const totals = useMemo(() => tripTotals(s), [s]);
  const entries = useMemo(() => itinerary(s), [s]);
  const phase = phaseOf(s);
  const purpose = s.purposeKind ? PURPOSE[s.purposeKind] : null;
  const nDays = tripDays(s);
  const nights = tripNights(s);
  const docsCount = s.attachments.length;

  const item = (kind: ItemKind, id?: string) => {
    if (!id) return undefined;
    const list = kind === "transport" ? s.transport : kind === "stay" ? s.stays : kind === "meal" ? s.meals : s.extras;
    return list.find((x) => x.id === id);
  };

  return (
    <div className={compact ? "sk-trip sk-trip--compact" : "sk-trip"}>
      <header className="sk-trip__head">
        {purpose ? <IconTile name={purpose.icon} size="lg" /> : <GlyphTile name="pin" size="lg" />}
        <div className="sk-trip__heading">
          <h2 className="sk-trip__title">{s.title ?? "Untitled trip"}</h2>
          <div className="sk-trip__where">
            {s.destinations.length ? (
              s.destinations.map((d) => (
                <span key={d.id} className="sk-trip__place">
                  {flag(d.country) && <span aria-hidden="true">{flag(d.country)}</span>} {d.city}
                </span>
              ))
            ) : (
              <button type="button" className="sk-btn sk-btn--link sk-btn--sm" onClick={() => setEditing({ kind: "destination" })}>
                Add where to
              </button>
            )}
          </div>
          <div className="sk-trip__tags">
            <Badge tone={PHASE[phase].tone} dot>
              {PHASE[phase].label}
            </Badge>
            {purpose && <Badge tone="mint">{purpose.label}</Badge>}
            {s.billing?.billable && <Badge tone="forest">Billed to {s.billing.customerName ?? "the customer"}</Badge>}
          </div>
        </div>
        <div className="sk-trip__actions">
          <Button size="sm" icon="settings" onClick={() => setEditing({ kind: "details" })}>
            Edit
          </Button>
        </div>
      </header>

      {s.purpose && <p className="sk-trip__purpose">{s.purpose}</p>}

      <MetaStrip
        items={[
          { label: "When", value: dateRange(s.startDate, s.endDate), icon: "calendar" },
          { label: nights ? `Away · ${plural(nights, "night")}` : "Away", value: nDays ? plural(nDays, "day") : "—", icon: "sun" },
          { label: "Traveller", value: s.traveler?.name ?? "—", icon: "customers" },
          { label: "Where", value: destinationLine(s) || "—", icon: "folder" },
        ]}
      />

      <div className="sk-trip__figures">
        <div className="sk-card sk-trip__figure">
          <div className="sk-stat__label">Total cost</div>
          <div className="sk-trip__figure-row">
            <Donut
              size={92}
              value={<span className="sk-trip__donut-value">{money(totals.total, s.currency, { compact: true })}</span>}
              slices={[
                { value: totals.transport, color: KIND_COLOR.transport },
                { value: totals.stays, color: KIND_COLOR.stays },
                { value: totals.meals, color: KIND_COLOR.meals },
                { value: totals.extras, color: KIND_COLOR.extras },
              ]}
            />
            <Legend
              items={[
                { label: "Transport", value: money(totals.transport, s.currency), color: KIND_COLOR.transport },
                { label: "Stays", value: money(totals.stays, s.currency), color: KIND_COLOR.stays },
                { label: "Meals", value: money(totals.meals, s.currency), color: KIND_COLOR.meals },
                { label: "Other", value: money(totals.extras, s.currency), color: KIND_COLOR.extras },
              ]}
            />
          </div>
          {totals.unconverted > 0 && (
            <div className="sk-stat__foot">{plural(totals.unconverted, "cost")} in another currency not counted</div>
          )}
        </div>
        <div className="sk-card sk-trip__figure">
          <div className="sk-stat__label">Getting there</div>
          <div className="sk-trip__figure-value">
            <GlyphTile name={s.transport.some((t) => t.mode === "FLIGHT") ? "plane" : s.transport.some((t) => t.mode === "TRAIN") ? "train" : "car"} size="sm" />
            {plural(s.transport.length, "leg")}
          </div>
          <div className="sk-stat__foot">{[...new Set(s.transport.map((t) => MODE[t.mode].label.toLowerCase()))].join(", ") || "nothing booked yet"}</div>
        </div>
        <div className="sk-card sk-trip__figure">
          <div className="sk-stat__label">Billed on</div>
          <div className="sk-trip__figure-value">
            <IconTile name="invoice" size="sm" />
            {money(totals.billed, s.currency, { compact: true })}
          </div>
          <div className="sk-stat__foot">
            {totals.total > 0 ? `${Math.round((totals.billed / totals.total) * 100)}% of the cost` : "no costs yet"}
          </div>
        </div>
      </div>

      <Tabs
        value={tab}
        onChange={setTab}
        options={[
          { value: "overview", label: "Overview" },
          { value: "itinerary", label: "Itinerary", count: entries.length },
          { value: "costs", label: "Costs" },
          { value: "documents", label: "Documents", count: docsCount },
        ]}
      />

      {tab === "overview" && (
        <div className="sk-trip__grid">
          <Card
            title="Itinerary"
            actions={
              <Button variant="link" size="sm" onClick={() => setTab("itinerary")}>
                View all
              </Button>
            }
          >
            <Itinerary entries={entries.slice(0, 7)} trip={s} onOpen={(e) => setEditing({ kind: kindOf(e), id: e.item.id })} />
          </Card>
          <div className="sk-trip__col">
            <Card title="Stays" actions={<Button variant="link" size="sm" icon="plus" onClick={() => setEditing({ kind: "stay" })}>Add</Button>}>
              {s.stays.length ? (
                <ul className="sk-trip-cards">
                  {s.stays.map((st) => (
                    <li key={st.id}>
                      <button type="button" className="sk-trip-stay" onClick={() => setEditing({ kind: "stay", id: st.id })}>
                        <GlyphTile name="bed" size="sm" />
                        <span className="sk-trip-stay__body">
                          <span className="sk-trip-stay__name">{st.name}</span>
                          <span className="sk-trip-stay__meta">
                            {dateRange(st.checkIn, st.checkOut)}
                            {stayNights(st) ? ` · ${plural(stayNights(st) ?? 0, "night")}` : ""}
                          </span>
                        </span>
                        <span className="sk-trip-stay__cost">{costText(st.cost, s.currency)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="sk-text-muted sk-small">No stays yet.</p>
              )}
            </Card>
            <Card title="Meals" actions={<Button variant="link" size="sm" icon="plus" onClick={() => setEditing({ kind: "meal" })}>Add</Button>}>
              {s.meals.length ? (
                <ul className="sk-trip-meals">
                  {s.meals.map((m) => (
                    <li key={m.id}>
                      <button type="button" onClick={() => setEditing({ kind: "meal", id: m.id })}>
                        <Glyph name={MEAL[m.kind].glyph} size={20} />
                        <span className="sk-trip-meals__name">{m.venue ?? MEAL[m.kind].label}</span>
                        <span className="sk-trip-meals__cost">{costText(m.cost, s.currency)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="sk-text-muted sk-small">No meals yet.</p>
              )}
            </Card>
          </div>
        </div>
      )}

      {tab === "itinerary" && (
        <Card
          title="Day by day"
          actions={
            <div className="sk-row sk-row--2">
              <Button size="sm" icon="plus" onClick={() => setEditing({ kind: "transport" })}>Leg</Button>
              <Button size="sm" icon="plus" onClick={() => setEditing({ kind: "stay" })}>Stay</Button>
              <Button size="sm" icon="plus" onClick={() => setEditing({ kind: "meal" })}>Meal</Button>
              <Button size="sm" icon="plus" onClick={() => setEditing({ kind: "extra" })}>Other</Button>
            </div>
          }
        >
          <Itinerary entries={entries} trip={s} onOpen={(e) => setEditing({ kind: kindOf(e), id: e.item.id })} />
        </Card>
      )}

      {tab === "costs" && <Costs trip={s} totals={totals} onOpen={(kind, id) => setEditing({ kind, id })} />}

      {tab === "documents" && <Documents doc={doc} />}

      {editing?.kind === "details" && <DetailsForm state={s} dispatch={dispatch} onClose={() => setEditing(null)} />}
      {editing?.kind === "destination" && <DestinationForm state={s} dispatch={dispatch} onClose={() => setEditing(null)} />}
      {editing && editing.kind !== "details" && editing.kind !== "destination" && (
        <ItemForm kind={editing.kind} item={item(editing.kind, editing.id)} state={s} dispatch={dispatch} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}

function Itinerary({ entries, trip, onOpen }: { entries: ItineraryEntry[]; trip: TripState; onOpen: (e: ItineraryEntry) => void }) {
  if (!entries.length)
    return (
      <EmptyState icon="calendar" title="Nothing planned yet">
        Add the flights, the hotel and the dinners, or let the mail fill them in.
      </EmptyState>
    );
  return (
    <ol className="sk-trip-days">
      {days(entries).map((d, i) => (
        <li key={`${d.day ?? "undated"}-${i}`} className="sk-trip-day">
          <div className="sk-trip-day__label">{d.day ? dayLabel(d.day) : "Any time"}</div>
          <ul className="sk-trip-day__items">
            {d.entries.map((e) => {
              const x = describe(e);
              return (
                <li key={`${e.kind}-${e.item.id}`}>
                  <button type="button" className="sk-trip-entry" onClick={() => onOpen(e)}>
                    <span className="sk-trip-entry__dot">
                      <Glyph name={x.glyph} size={20} />
                    </span>
                    <span className="sk-trip-entry__body">
                      <span className="sk-trip-entry__title">{x.title}</span>
                      {x.sub && <span className="sk-trip-entry__sub">{x.sub}</span>}
                    </span>
                    {x.time && <span className="sk-trip-entry__time">{x.time}</span>}
                    <span className="sk-trip-entry__cost">{costText(e.item.cost, trip.currency)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </li>
      ))}
    </ol>
  );
}

function Costs({ trip, totals, onOpen }: { trip: TripState; totals: ReturnType<typeof tripTotals>; onOpen: (kind: ItemKind, id: string) => void }) {
  const groups: { kind: ItemKind; label: string; total: number; rows: { id: string; glyph: TripGlyph; what: string; cost: TripCost | null | undefined; billed: string | null }[] }[] = [
    { kind: "transport", label: "Transport", total: totals.transport, rows: trip.transport.map((t) => ({ id: t.id, glyph: MODE[t.mode].glyph, what: [MODE[t.mode].label, t.carrier, t.from && t.to ? `${t.from} → ${t.to}` : null].filter(Boolean).join(" · "), cost: t.cost, billed: t.invoice?.number ?? (t.invoice ? "invoiced" : null) })) },
    { kind: "stay", label: "Stays", total: totals.stays, rows: trip.stays.map((t) => ({ id: t.id, glyph: "bed" as const, what: t.name, cost: t.cost, billed: t.invoice?.number ?? (t.invoice ? "invoiced" : null) })) },
    { kind: "meal", label: "Meals", total: totals.meals, rows: trip.meals.map((t) => ({ id: t.id, glyph: MEAL[t.kind].glyph, what: t.venue ?? MEAL[t.kind].label, cost: t.cost, billed: t.invoice?.number ?? (t.invoice ? "invoiced" : null) })) },
    { kind: "extra", label: "Other", total: totals.extras, rows: trip.extras.map((t) => ({ id: t.id, glyph: EXTRA[t.kind].glyph, what: t.description, cost: t.cost, billed: t.invoice?.number ?? (t.invoice ? "invoiced" : null) })) },
  ];
  return (
    <Card title="What it cost" actions={<span className="sk-trip__total">{money(totals.total, trip.currency)}</span>}>
      <div className="sk-trip-costs">
        {groups.map((g) => (
          <section key={g.kind} className="sk-trip-costs__group">
            <header className="sk-trip-costs__head">
              <span className="sk-eyebrow">{g.label}</span>
              <span className="sk-tabular">{money(g.total, trip.currency)}</span>
            </header>
            {g.rows.length ? (
              <ul>
                {g.rows.map((r) => (
                  <li key={r.id}>
                    <button type="button" className="sk-trip-costs__row" onClick={() => onOpen(g.kind, r.id)}>
                      <Glyph name={r.glyph} size={20} />
                      <span className="sk-trip-costs__what">{r.what}</span>
                      {r.billed && <Badge tone="forest">Billed · {r.billed}</Badge>}
                      <span className="sk-trip-costs__amount">{costText(r.cost, trip.currency)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="sk-text-muted sk-small">Nothing yet.</p>
            )}
          </section>
        ))}
      </div>
      {totals.billed > 0 && (
        <p className="sk-small sk-text-muted sk-mt-3">
          {money(totals.billed, trip.currency)} of it was billed on to {trip.billing?.customerName ?? "the customer"}.
        </p>
      )}
    </Card>
  );
}

function kindOfFile(a: TripAttachment): "pdf" | "img" | "doc" | undefined {
  const t = `${a.mimeType ?? ""} ${a.fileName}`.toLowerCase();
  if (t.includes("pdf")) return "pdf";
  if (/image|\.png|\.jpe?g|\.gif|\.webp/.test(t)) return "img";
  if (/word|\.docx?|text|\.eml|\.ics/.test(t)) return "doc";
  return undefined;
}

const ROLE: Record<TripAttachment["role"], string> = {
  BOOKING: "Bookings",
  TICKET: "Tickets",
  RECEIPT: "Receipts",
  INVOICE: "Invoices",
  ITINERARY: "Itineraries",
  OTHER: "Other",
};

function Documents({ doc }: { doc: TripDocument }) {
  const s = doc.state.global;
  const client = useAttachments();
  const [error, setError] = useState<string | null>(null);
  const open = (a: TripAttachment) => {
    if (!client || !a.ref) return;
    setError(null);
    // a document's own attachment, or one kept in the mail or file it came from
    client
      .downloadBlob({ documentId: a.documentId ?? doc.header.id, ref: a.ref as `attachment://v${number}:${string}` })
      .catch(() => client.downloadBlob({ documentId: doc.header.id, ref: a.ref as `attachment://v${number}:${string}` }))
      .then(({ blob }) => {
        const url = URL.createObjectURL(blob);
        window.open(url, "_blank", "noopener");
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  };
  const owner = (id: string | null | undefined) => {
    if (!id) return null;
    const t = s.transport.find((x) => x.id === id);
    if (t) return [MODE[t.mode].label, t.from && t.to ? `${t.from} → ${t.to}` : t.carrier].filter(Boolean).join(" ");
    return s.stays.find((x) => x.id === id)?.name ?? s.meals.find((x) => x.id === id)?.venue ?? s.extras.find((x) => x.id === id)?.description ?? null;
  };
  const groups = Object.entries(ROLE)
    .map(([role, label]) => ({ label, files: s.attachments.filter((a) => a.role === role) }))
    .filter((g) => g.files.length);
  return (
    <Card title="Documents">
      {groups.length ? (
        <div className="sk-trip-docs">
          {groups.map((g) => (
            <section key={g.label}>
              <div className="sk-eyebrow sk-mb-2">{g.label}</div>
              <div className="sk-trip-docs__chips">
                {g.files.map((a) => (
                  <Chip key={a.id} name={a.fileName} meta={owner(a.itemId) ?? undefined} kind={kindOfFile(a)} onClick={a.ref ? () => open(a) : undefined} />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <EmptyState icon="folder" title="No documents yet">
          Bookings, tickets and receipts show here once they are attached.
        </EmptyState>
      )}
      {error && <p className="sk-small sk-text-danger sk-mt-2">{error}</p>}
    </Card>
  );
}
