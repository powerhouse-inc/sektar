import { useDrives } from "@powerhousedao/reactor-browser";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { tripTotals, type TripDocument } from "document-models/trip";
import { useMemo, useState } from "react";
import artDark from "../../../../editors/sektar/design/shapes/sektar-composition-rise-dark.svg";
import artLight from "../../../../editors/sektar/design/shapes/sektar-composition-rise-light.svg";
import { money, plural, relativeDays } from "../../../../editors/sektar/kit/format.js";
import { Glyph, GlyphTile, TripSprite } from "../../../../editors/sektar/kit/trip-glyphs.js";
import {
  dateRange,
  flag,
  MODE,
  PHASE,
  phaseOf,
  PURPOSE,
  topDestinations,
  useTrips,
  yearsOf,
} from "../../../../editors/sektar/kit/trips.js";
import { Badge, Bars, Button, Card, EmptyState, IconTile, Legend, ListItem, PageHeader, Segmented, Stat } from "../../../../editors/sektar/kit/ui.js";
import { driveFor, PRODUCTS } from "../-shared/products.js";

export const Route = createFileRoute("/_app/travel")({
  head: () => ({ meta: [{ title: "Business Travel · Sektar" }] }),
  component: TravelOverview,
});

const product = PRODUCTS.find((p) => p.id === "travel")!;

/** Business Travel's front page: where you are going next, and where you have been. */
function TravelOverview() {
  const drives = useDrives();
  const navigate = useNavigate();
  const found = driveFor(drives, product);
  const trips = useTrips(found?.drive);
  const years = useMemo(() => yearsOf(trips), [trips]);
  const [year, setYear] = useState<number | "all">("all");
  const now = Date.now();

  const openTrip = (t?: TripDocument) => {
    if (!found) return;
    void navigate({ to: "/d/$driveSlug/{-$nodeSlug}", params: { driveSlug: found.param, nodeSlug: t?.header.id } });
  };

  const scope = year === "all" ? trips : trips.filter((t) => t.state.global.startDate?.startsWith(String(year)));
  const live = scope.filter((t) => t.state.global.status !== "CANCELLED");
  const next = useMemo(
    () =>
      [...trips]
        .filter((t) => ["upcoming", "ongoing"].includes(phaseOf(t.state.global, now)))
        .sort((a, b) => (a.state.global.startDate ?? "").localeCompare(b.state.global.startDate ?? ""))
        .at(0),
    [trips, now],
  );
  const stats = useMemo(() => {
    const sum = { spend: 0, billed: 0, transport: 0, stays: 0, meals: 0, extras: 0, days: 0, nights: 0, legs: 0, flights: 0 };
    for (const t of live) {
      const s = t.state.global;
      const x = tripTotals(s);
      sum.spend += x.total;
      sum.billed += x.billed;
      sum.transport += x.transport;
      sum.stays += x.stays;
      sum.meals += x.meals;
      sum.extras += x.extras;
      sum.legs += s.transport.length;
      sum.flights += s.transport.filter((l) => l.mode === "FLIGHT").length;
    }
    const ys = year === "all" ? years : years.filter((y) => y.year === year);
    sum.days = ys.reduce((n, y) => n + y.days, 0);
    sum.nights = ys.reduce((n, y) => n + y.nights, 0);
    return sum;
  }, [live, years, year]);
  const places = useMemo(() => topDestinations(live), [live]);
  const recent = live.filter((t) => phaseOf(t.state.global, now) === "completed").slice(0, 6);
  const chart = [...years].reverse().slice(-8);

  if (!found)
    return (
      <div className="sk-page">
        <EmptyState icon="calendar" title="The Trips drive is on its way">
          It is attached from the switchboard when Sektar starts.
        </EmptyState>
      </div>
    );

  return (
    <div className="sk-page sk-stack sk-stack--6 sk-travel">
      <TripSprite />
      <PageHeader
        eyebrow="Business Travel"
        title="Trips"
        lead="Why you went, how you got there, where you stayed and what it cost — and what was billed on."
        art={{ light: artLight, dark: artDark }}
        actions={
          <Button variant="primary" icon="plus" onClick={() => openTrip()}>
            Plan a trip
          </Button>
        }
      />

      {years.length > 1 && (
        <div className="sk-travel-years">
          <Segmented
            value={String(year)}
            onChange={(v) => setYear(v === "all" ? "all" : Number(v))}
            options={[{ value: "all", label: "All" }, ...years.slice(0, 6).map((y) => ({ value: String(y.year), label: String(y.year) }))]}
          />
        </div>
      )}

      {!trips.length ? (
        <EmptyState icon="calendar" title="No trips yet" action={<Button variant="primary" onClick={() => openTrip()}>Open the Trips drive</Button>}>
          Trips are filled in from the sales invoices that billed them on and from the booking mails.
        </EmptyState>
      ) : (
        <div className="sk-dash-grid">
          <div className="c3">
            <Stat icon="calendar" label="Trips" value={live.length} foot={`${plural(stats.days, "day")} away · ${plural(stats.nights, "night")}`} spark={chart.length > 1 ? chart.map((y) => y.trips) : undefined} />
          </div>
          <div className="c3">
            <Stat icon="wallet" label="Spent on travel" value={money(stats.spend, "EUR", { compact: true })} foot={live.length ? `${money(stats.spend / live.length, "EUR", { compact: true })} a trip` : undefined} spark={chart.length > 1 ? chart.map((y) => Math.round(y.spend)) : undefined} />
          </div>
          <div className="c3">
            <Stat icon="invoice" label="Billed on to customers" value={money(stats.billed, "EUR", { compact: true })} foot={stats.spend ? `${Math.round((stats.billed / stats.spend) * 100)}% of the spend` : "nothing yet"} />
          </div>
          <div className="c3">
            <div className="sk-card sk-stat">
              <GlyphTile name="plane" />
              <div style={{ minWidth: 0 }}>
                <div className="sk-stat__label">Legs travelled</div>
                <div className="sk-stat__value">{stats.legs}</div>
              </div>
              <div className="sk-stat__foot">{plural(stats.flights, "flight")}</div>
            </div>
          </div>

          <div className="c6">
            {(next ?? live.at(0)) ? (
              <NextTrip trip={(next ?? live.at(0))!} onOpen={() => openTrip(next ?? live.at(0))} now={now} />
            ) : (
              <Card title="Next trip">
                <EmptyState icon="sun" title="Nothing planned">
                  The next trip shows here as soon as it has dates.
                </EmptyState>
              </Card>
            )}
          </div>
          <div className="c6">
            <Card title="Spend by year" actions={<Legend items={[{ label: "Spent" }, { label: "Billed on", color: "var(--sk-chart-3)" }]} />}>
              <Bars axis ticks={4} height={180} format={(v) => money(v, "EUR", { compact: true })} groups={chart.map((y) => ({ label: String(y.year), values: [Math.round(y.spend), Math.round(y.billed)] }))} />
            </Card>
          </div>

          <div className="c4">
            <Card title="Where the money goes">
              <ul className="sk-travel-split">
                {[
                  { label: "Transport", value: stats.transport, glyph: "plane" as const },
                  { label: "Stays", value: stats.stays, glyph: "bed" as const },
                  { label: "Meals", value: stats.meals, glyph: "meal" as const },
                  { label: "Other", value: stats.extras, glyph: "ticket" as const },
                ].map((r) => (
                  <li key={r.label}>
                    <Glyph name={r.glyph} size={20} />
                    <span>{r.label}</span>
                    <span className="sk-travel-split__bar">
                      <span style={{ width: `${stats.spend ? (r.value / stats.spend) * 100 : 0}%` }} />
                    </span>
                    <span className="sk-tabular">{money(r.value, "EUR", { compact: true })}</span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
          <div className="c4">
            <Card title="Most visited">
              <ul className="sk-list sk-list--divided">
                {places.map((p) => (
                  <li key={p.city}>
                    <ListItem
                      icon={<span className="sk-travel-flag" aria-hidden="true">{flag(p.country) || "•"}</span>}
                      title={p.city}
                      meta={p.last ? `last ${dateRange(p.last, null)}` : undefined}
                      value={plural(p.visits, "visit")}
                    />
                  </li>
                ))}
              </ul>
            </Card>
          </div>
          <div className="c4">
            <Card title="Recent trips" actions={<Button variant="link" size="sm" onClick={() => openTrip()}>View all</Button>}>
              <ul className="sk-list sk-list--divided">
                {recent.map((t) => {
                  const s = t.state.global;
                  const purpose = s.purposeKind ? PURPOSE[s.purposeKind] : null;
                  return (
                    <li key={t.header.id}>
                      <ListItem
                        onClick={() => openTrip(t)}
                        icon={purpose ? <IconTile name={purpose.icon} size="sm" /> : <GlyphTile name="pin" size="sm" />}
                        title={s.title ?? "Untitled trip"}
                        meta={dateRange(s.startDate, s.endDate)}
                        value={money(tripTotals(s).total, s.currency, { compact: true })}
                      />
                    </li>
                  );
                })}
              </ul>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

function NextTrip({ trip, onOpen, now }: { trip: TripDocument; onOpen: () => void; now: number }) {
  const s = trip.state.global;
  const phase = phaseOf(s, now);
  const first = [...s.transport].sort((a, b) => (a.departAt ?? "").localeCompare(b.departAt ?? ""))
    .at(0);
  return (
    <div className="sk-card sk-card--forest sk-travel-next">
      <div className="sk-travel-next__top">
        <span className="sk-eyebrow">{phase === "ongoing" ? "Under way" : phase === "upcoming" ? `Next trip · ${relativeDays(s.startDate, now)}` : `Last trip · ${relativeDays(s.endDate ?? s.startDate, now)}`}</span>
        <Badge tone={PHASE[phase].tone} pill>
          {PHASE[phase].label}
        </Badge>
      </div>
      <h2 className="sk-travel-next__title">{s.title ?? "Untitled trip"}</h2>
      <p className="sk-travel-next__where">
        {s.destinations.map((d) => `${flag(d.country)} ${d.city}`.trim()).join(" · ") || "Destination to come"} · {dateRange(s.startDate, s.endDate)}
      </p>
      {first && (
        <p className="sk-travel-next__leg">
          <Glyph name={MODE[first.mode].glyph} size={20} className="sk-icon--inverse" />
          {[MODE[first.mode].label, first.carrier, first.number, first.from && first.to ? `${first.from} → ${first.to}` : null].filter(Boolean).join(" · ")}
        </p>
      )}
      <Button variant="inverse" size="sm" onClick={onOpen}>
        Open the trip
      </Button>
    </div>
  );
}
