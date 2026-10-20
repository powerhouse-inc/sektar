// The Trips drive app: every trip in the drive as the design system's panes
// workspace — the trips (filtered, searched, grouped by year) on the left, the
// picked trip's overview in the middle, what to do with it on the right.
// Stacked under 800px it becomes a push navigation. A trip opened by URL
// (/d/trips/<node>) is the selection; the overview already is its editor.
import {
  dispatchActions,
  isFileNodeKind,
  setSelectedNode,
  useSelectedDrive,
  useSelectedNode,
} from "@powerhousedao/reactor-browser";
import { tripTotals, type TripAction, type TripDocument } from "document-models/trip";
import { useEffect, useMemo, useRef, useState } from "react";
import { useFillHeight, useNarrow } from "../../backfills/components/measure.js";
import { TripOverview } from "../../sektar/components/trip/TripOverview.js";
import { TripSide } from "../../sektar/components/trip/TripSide.js";
import { money } from "../../sektar/kit/format.js";
import { useSearch } from "../../sektar/kit/search-context.js";
import { GlyphTile } from "../../sektar/kit/trip-glyphs.js";
import { createTrip, dateRange, flag, PHASE, phaseOf, PURPOSE, TRIP_TYPE, useTrips, yearOf, type TripPhase } from "../../sektar/kit/trips.js";
import { Badge, Button, EmptyState, Field, IconTile, Input, ListItem, Modal, Pills } from "../../sektar/kit/ui.js";
import { Pane, Workspace } from "../../sektar/kit/workspace.js";

type Filter = "all" | "upcoming" | "completed";

function matches(t: TripDocument, q: string): boolean {
  if (!q) return true;
  const s = t.state.global;
  const hay = [s.title, s.purpose, s.billing?.customerName, ...s.destinations.map((d) => d.city), ...s.stays.map((x) => x.name), ...s.transport.map((x) => x.carrier)]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return q
    .toLowerCase()
    .split(/\s+/)
    .every((w) => hay.includes(w));
}

const inFilter = (p: TripPhase, f: Filter) => f === "all" || (f === "upcoming" ? p === "upcoming" || p === "ongoing" || p === "undated" : p === "completed");

export function TripsWorkspace() {
  const [drive] = useSelectedDrive();
  const node = useSelectedNode();
  const trips = useTrips(drive);
  const { query } = useSearch();
  const [filter, setFilter] = useState<Filter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [level, setLevel] = useState(1);
  const [creating, setCreating] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const height = useFillHeight(root, true);
  const narrow = useNarrow(root, 1200, true);

  // A trip opened by URL is the selection.
  useEffect(() => {
    if (node && isFileNodeKind(node) && node.documentType === TRIP_TYPE) {
      setSelectedId(node.id);
      setLevel(2);
    }
  }, [node]);

  const phases = useMemo(() => new Map(trips.map((t) => [t.header.id, phaseOf(t.state.global)])), [trips]);
  const shown = useMemo(() => trips.filter((t) => inFilter(phases.get(t.header.id) ?? "undated", filter) && matches(t, query)), [trips, phases, filter, query]);
  const counts = useMemo(() => {
    const c = { all: trips.length, upcoming: 0, completed: 0 };
    for (const t of trips) {
      const p = phases.get(t.header.id) ?? "undated";
      if (inFilter(p, "upcoming")) c.upcoming++;
      if (p === "completed") c.completed++;
    }
    return c;
  }, [trips, phases]);
  // grouped by the year the trip starts in; upcoming first within the list's order
  const groups = useMemo(() => {
    const out: { year: string; trips: TripDocument[] }[] = [];
    for (const t of shown) {
      const y = String(yearOf(t.state.global) ?? "No dates");
      const last = out.at(-1);
      if (last && last.year === y) last.trips.push(t);
      else out.push({ year: y, trips: [t] });
    }
    return out;
  }, [shown]);

  const selected = trips.find((t) => t.header.id === selectedId) ?? (selectedId ? undefined : shown[0]);
  const dispatch = (a: TripAction | TripAction[]) => {
    if (selected) void dispatchActions(a, selected.header.id);
  };
  const open = (t: TripDocument) => {
    setSelectedId(t.header.id);
    setLevel(2);
  };

  if (!trips.length && !creating)
    return (
      <div className="sk-page" style={{ padding: "var(--sk-space-12) var(--sk-space-6)" }}>
        <EmptyState
          icon="calendar"
          title="No trips yet"
          action={
            <Button variant="primary" icon="plus" onClick={() => setCreating(true)}>
              Plan a trip
            </Button>
          }
        >
          Every business trip gets its own page here: why it was made, how you got there, where you stayed and what it cost.
        </EmptyState>
      </div>
    );

  return (
    <div ref={root} className="sk-trips" style={{ height: height ? `${height}px` : undefined }}>
      <Workspace level={level}>
        <Pane
          side="start"
          title="Trips"
          count={shown.length}
          trailing={
            <Button size="sm" variant="primary" icon="plus" onClick={() => setCreating(true)}>
              New
            </Button>
          }
          flush
        >
          <div className="sk-trips__filters">
            <Pills
              value={filter}
              onChange={setFilter}
              label="Show"
              options={[
                { value: "all", label: "All", count: counts.all },
                { value: "upcoming", label: "Upcoming", count: counts.upcoming },
                { value: "completed", label: "Past", count: counts.completed },
              ]}
            />
          </div>
          {groups.map((g) => (
            <section key={g.year} className="sk-trips__year">
              <header className="sk-trips__year-head">
                <span className="sk-eyebrow">{g.year}</span>
                <span className="sk-small sk-text-muted">
                  {g.trips.length} · {money(g.trips.reduce((s, t) => s + tripTotals(t.state.global).total, 0), "EUR", { compact: true })}
                </span>
              </header>
              <ul className="sk-list sk-list--rich">
                {g.trips.map((t) => {
                  const s = t.state.global;
                  const p = phases.get(t.header.id) ?? "undated";
                  const purpose = s.purposeKind ? PURPOSE[s.purposeKind] : null;
                  return (
                    <li key={t.header.id}>
                      <ListItem
                        rich
                        selected={selected?.header.id === t.header.id}
                        onClick={() => open(t)}
                        drill={2}
                        icon={purpose ? <IconTile name={purpose.icon} size="sm" /> : <GlyphTile name="pin" size="sm" />}
                        title={s.title ?? "Untitled trip"}
                        sub={[s.destinations.map((d) => `${flag(d.country)} ${d.city}`.trim()).join(", ") || "—", dateRange(s.startDate, s.endDate)]}
                        aside={
                          <>
                            <span className="sk-tabular sk-small">{money(tripTotals(s).total, s.currency, { compact: true })}</span>
                            {p !== "completed" && (
                              <Badge tone={PHASE[p].tone} pill>
                                {PHASE[p].label}
                              </Badge>
                            )}
                          </>
                        }
                      />
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
          {!shown.length && <p className="sk-small sk-text-muted sk-trips__none">No trips match.</p>}
        </Pane>

        <Pane title={selected?.state.global.title ?? "Trip"} grow={2} onBack={() => setLevel(1)} backLabel="Trips" className="sk-trips__detail">
          {selected ? (
            <TripOverview key={selected.header.id} doc={selected} dispatch={dispatch} />
          ) : (
            <EmptyState icon="calendar" title="Pick a trip" />
          )}
        </Pane>

        {selected && !narrow && (
          <Pane title="Next" side="end" className="sk-trips__side">
            <TripSide doc={selected} dispatch={dispatch} />
          </Pane>
        )}
      </Workspace>
      {creating && (
        <NewTrip
          onClose={() => setCreating(false)}
          onCreate={async (input) => {
            const id = await createTrip(drive, input);
            setSelectedId(id);
            setLevel(2);
            setSelectedNode(id);
          }}
        />
      )}
    </div>
  );
}

function NewTrip({ onClose, onCreate }: { onClose: () => void; onCreate: (input: Parameters<typeof createTrip>[1]) => Promise<void> }) {
  const [title, setTitle] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [busy, setBusy] = useState(false);
  const bad = !!start && !!end && end < start;
  return (
    <Modal
      title="Plan a trip"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={!title.trim() || bad || busy}
            onClick={() => {
              setBusy(true);
              void onCreate({
                title: title.trim(),
                city: city.trim() || null,
                country: country.trim().toUpperCase() || null,
                startDate: start ? `${start}T00:00:00.000Z` : null,
                endDate: end ? `${end}T00:00:00.000Z` : null,
              }).finally(onClose);
            }}
          >
            Create trip
          </Button>
        </>
      }
    >
      <div className="sk-trip-form">
        <Field label="Title" required className="sk-trip-form__wide">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Lisbon – Powerhouse offsite" autoFocus />
        </Field>
        <Field label="To">
          <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Lisbon" />
        </Field>
        <Field label="Country" hint="Two letters">
          <Input value={country} onChange={(e) => setCountry(e.target.value)} maxLength={2} placeholder="PT" />
        </Field>
        <Field label="Leaving">
          <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
        </Field>
        <Field label="Back" error={bad ? "Before the day you leave" : undefined}>
          <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}
