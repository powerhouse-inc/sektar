import { useDrives } from "@powerhousedao/reactor-browser";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import artDark from "../../../../editors/sektar/design/shapes/sektar-composition-rise-dark.svg";
import artLight from "../../../../editors/sektar/design/shapes/sektar-composition-rise-light.svg";
import { money, plural, relativeDays } from "../../../../editors/sektar/kit/format.js";
import { Glyph, GlyphTile, TripSprite } from "../../../../editors/sektar/kit/trip-glyphs.js";
import { useTripList, useTripPlaces, useTripYears, type TripPlace, type TripRow, type TripYear } from "../../../../editors/sektar/kit/trip-index.js";
import { dateRange, flag, modeOf, PHASE, purposeOf } from "../../../../editors/sektar/kit/trips.js";
import { Badge, Bars, Button, Card, EmptyState, IconTile, Legend, ListItem, PageHeader, Segmented, Stat } from "../../../../editors/sektar/kit/ui.js";
import { driveFor, PRODUCTS } from "../-shared/products.js";

export const Route = createFileRoute("/_app/travel")({
  head: () => ({ meta: [{ title: "Business Travel · Sektar" }] }),
  component: TravelOverview,
});

const product = PRODUCTS.find((p) => p.id === "travel")!;
const NO_YEARS: TripYear[] = [];
const NO_PLACES: TripPlace[] = [];

/** Business Travel's front page: where you are going next, and where you have been. */
function TravelOverview() {
  const drives = useDrives();
  const navigate = useNavigate();
  const found = driveFor(drives, product);
  const [year, setYear] = useState<number | "all">("all");
  const [now] = useState(() => Date.now());
  // Rows and per-year figures come from the trip index; a trip document is
  // loaded only when it is opened.
  const yearsAnswer = useTripYears(found?.drive);
  const years = yearsAnswer ?? NO_YEARS;
  const ongoing = useTripList(found?.drive, { year, phases: ["ongoing"], query: "", now });
  const upcoming = useTripList(found?.drive, { year, phases: ["upcoming"], query: "", now });
  const places = useTripPlaces(found?.drive, year) ?? NO_PLACES;
  const completed = useTripList(found?.drive, { year, phases: ["completed"], query: "", now });

  const openTrip = (t?: TripRow) => {
    if (!found) return;
    void navigate({ to: "/d/$driveSlug/{-$nodeSlug}", params: { driveSlug: found.param, nodeSlug: t?.id } });
  };

  // The index lists newest start first, so the soonest trip is the last upcoming row.
  const { ensure: ensureUpcoming } = upcoming;
  useEffect(() => {
    if (upcoming.total > 0) ensureUpcoming(upcoming.total - 1, upcoming.total);
  }, [upcoming.total, ensureUpcoming]);
  const recent = useMemo(
    () => Array.from({ length: Math.min(6, completed.total) }, (_, i) => completed.rowAt(i)).filter((t): t is TripRow => !!t),
    // version bumps when the rows behind rowAt change
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [completed.total, completed.version],
  );
  const next = ongoing.rowAt(ongoing.total - 1) ?? upcoming.rowAt(upcoming.total - 1) ?? recent.at(0);
  const scope = useMemo(() => (year === "all" ? years : years.filter((y) => y.year === year)), [years, year]);
  const stats = useMemo(() => {
    const sum = { trips: 0, spend: 0, billed: 0, transport: 0, stays: 0, meals: 0, extras: 0, days: 0, nights: 0, legs: 0, flights: 0 };
    for (const y of scope) {
      sum.trips += y.trips;
      sum.spend += y.cost;
      sum.billed += y.billed;
      sum.days += y.days;
      sum.nights += y.nights;
      sum.flights += y.flights;
      sum.legs += y.legs;
      sum.transport += y.costByKind.transport;
      sum.stays += y.costByKind.stays;
      sum.meals += y.costByKind.meals;
      sum.extras += y.costByKind.extras;
    }
    return sum;
  }, [scope]);
  const chart = [...years].reverse().slice(-8);
  const loaded = completed.loaded && upcoming.loaded && ongoing.loaded;
  const empty = loaded && yearsAnswer !== null && !years.length && !completed.total && !upcoming.total && !ongoing.total;

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

      {empty ? (
        <EmptyState icon="calendar" title="No trips yet" action={<Button variant="primary" onClick={() => openTrip()}>Open the Trips drive</Button>}>
          Trips are filled in from the sales invoices that billed them on and from the booking mails.
        </EmptyState>
      ) : (
        <div className="sk-dash-grid">
          <div className="c3">
            <Stat icon="calendar" label="Trips" value={stats.trips} foot={`${plural(stats.days, "day")} away · ${plural(stats.nights, "night")}`} spark={chart.length > 1 ? chart.map((y) => y.trips) : undefined} />
          </div>
          <div className="c3">
            <Stat icon="wallet" label="Spent on travel" value={money(stats.spend, "EUR", { compact: true })} foot={stats.trips ? `${money(stats.spend / stats.trips, "EUR", { compact: true })} a trip` : undefined} spark={chart.length > 1 ? chart.map((y) => Math.round(y.cost)) : undefined} />
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
            {next ? (
              <NextTrip trip={next} onOpen={() => openTrip(next)} now={now} />
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
              <Bars axis ticks={4} height={180} format={(v) => money(v, "EUR", { compact: true })} groups={chart.map((y) => ({ label: String(y.year), values: [Math.round(y.cost), Math.round(y.billed)] }))} />
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
                  const purpose = purposeOf(t.purposeKind);
                  return (
                    <li key={t.id}>
                      <ListItem
                        onClick={() => openTrip(t)}
                        icon={purpose ? <IconTile name={purpose.icon} size="sm" /> : <GlyphTile name="pin" size="sm" />}
                        title={t.title ?? "Untitled trip"}
                        meta={dateRange(t.startDate, t.endDate)}
                        value={money(t.costTotal, t.currency, { compact: true })}
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

function NextTrip({ trip, onOpen, now }: { trip: TripRow; onOpen: () => void; now: number }) {
  const phase = trip.phase;
  const first = trip.firstLeg;
  const mode = modeOf(first?.mode);
  return (
    <div className="sk-card sk-card--forest sk-travel-next">
      <div className="sk-travel-next__top">
        <span className="sk-eyebrow">{phase === "ongoing" ? "Under way" : phase === "upcoming" ? `Next trip · ${relativeDays(trip.startDate, now)}` : `Last trip · ${relativeDays(trip.endDate ?? trip.startDate, now)}`}</span>
        <Badge tone={PHASE[phase].tone} pill>
          {PHASE[phase].label}
        </Badge>
      </div>
      <h2 className="sk-travel-next__title">{trip.title ?? "Untitled trip"}</h2>
      <p className="sk-travel-next__where">
        {trip.destinations.map((d) => `${flag(d.country)} ${d.city}`.trim()).join(" · ") || "Destination to come"} · {dateRange(trip.startDate, trip.endDate)}
      </p>
      {first && mode && (
        <p className="sk-travel-next__leg">
          <Glyph name={mode.glyph} size={20} className="sk-icon--inverse" />
          {[mode.label, first.carrier, first.number, first.from && first.to ? `${first.from} → ${first.to}` : null].filter(Boolean).join(" · ")}
        </p>
      )}
      <Button variant="inverse" size="sm" onClick={onOpen}>
        Open the trip
      </Button>
    </div>
  );
}
