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
import { useTripDocumentById, type TripAction } from "document-models/trip";
import { useEffect, useMemo, useRef, useState } from "react";
import { useFillHeight, useNarrow } from "../../backfills/components/measure.js";
import { TripOverview } from "../../sektar/components/trip/TripOverview.js";
import { TripSide } from "../../sektar/components/trip/TripSide.js";
import { money } from "../../sektar/kit/format.js";
import { useSearch } from "../../sektar/kit/search-context.js";
import { GlyphTile } from "../../sektar/kit/trip-glyphs.js";
import { useTripList, useTripYears, type TripPhase, type TripRow } from "../../sektar/kit/trip-index.js";
import { createTrip, dateRange, flag, PHASE, purposeOf, TRIP_TYPE } from "../../sektar/kit/trips.js";
import { Badge, Button, EmptyState, Field, IconTile, Input, ListItem, Modal, Pills } from "../../sektar/kit/ui.js";
import { Pane, Workspace } from "../../sektar/kit/workspace.js";

type Filter = "all" | "upcoming" | "completed";

/** What each pill asks the index for: upcoming covers trips under way and without dates. */
const PHASES: Record<Filter, readonly TripPhase[] | "all"> = {
  all: "all",
  upcoming: ["upcoming", "ongoing", "undated"],
  completed: ["completed"],
};

/** Rows are asked for a page at a time; the list grows by a page on request. */
const PAGE = 50;

export function TripsWorkspace() {
  const [drive] = useSelectedDrive();
  const node = useSelectedNode();
  const { query } = useSearch();
  const [filter, setFilter] = useState<Filter>("all");
  const [now] = useState(() => Date.now());
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

  // The list reads the trip index: filters and search are query arguments, and
  // a trip document is loaded only for the one that is open.
  const list = useTripList(drive, { year: "all", phases: PHASES[filter], query, now });
  const years = useTripYears(drive);
  const [shownCount, setShownCount] = useState(PAGE);
  useEffect(() => setShownCount(PAGE), [filter, query]);
  const count = Math.min(shownCount, list.total);
  const { ensure, rowAt, version } = list;
  useEffect(() => {
    if (count > 0) ensure(0, count);
  }, [count, ensure, version]);
  const rows = useMemo(
    () => Array.from({ length: count }, (_, i) => rowAt(i)).filter((t): t is TripRow => !!t),
    // version bumps when the rows behind rowAt change
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [count, rowAt, version],
  );
  // grouped by the year the trip starts in, in the index's order (newest first, undated last)
  const groups = useMemo(() => {
    const out: { year: string; trips: TripRow[] }[] = [];
    for (const t of rows) {
      const y = t.startDate ? t.startDate.slice(0, 4) : "No dates";
      const last = out.at(-1);
      if (last && last.year === y) last.trips.push(t);
      else out.push({ year: y, trips: [t] });
    }
    return out;
  }, [rows]);
  const yearFigures = useMemo(() => new Map((years ?? []).map((y) => [String(y.year), y])), [years]);
  const whole = filter === "all" && !query.trim();

  const effectiveId = selectedId ?? rows[0]?.id ?? null;
  const [selected] = useTripDocumentById(effectiveId);
  const selectedRow = rows.find((t) => t.id === effectiveId);
  const dispatch = (a: TripAction | TripAction[]) => {
    if (selected) void dispatchActions(a, selected.header.id);
  };
  const open = (t: TripRow) => {
    setSelectedId(t.id);
    setLevel(2);
  };

  if (list.loaded && !list.total && whole && !creating)
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
          count={list.total}
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
                { value: "all", label: "All", count: filter === "all" ? list.total : undefined },
                { value: "upcoming", label: "Upcoming", count: filter === "upcoming" ? list.total : undefined },
                { value: "completed", label: "Past", count: filter === "completed" ? list.total : undefined },
              ]}
            />
          </div>
          {groups.map((g) => (
            <section key={g.year} className="sk-trips__year">
              <header className="sk-trips__year-head">
                <span className="sk-eyebrow">{g.year}</span>
                <span className="sk-small sk-text-muted">
                  {whole && yearFigures.get(g.year)
                    ? `${yearFigures.get(g.year)?.trips ?? 0} · ${money(yearFigures.get(g.year)?.cost ?? 0, "EUR", { compact: true })}`
                    : `${g.trips.length} · ${money(g.trips.reduce((n, t) => n + t.costTotal, 0), "EUR", { compact: true })}`}
                </span>
              </header>
              <ul className="sk-list sk-list--rich">
                {g.trips.map((t) => {
                  const p = t.phase;
                  const purpose = purposeOf(t.purposeKind);
                  return (
                    <li key={t.id}>
                      <ListItem
                        rich
                        selected={effectiveId === t.id}
                        onClick={() => open(t)}
                        drill={2}
                        icon={purpose ? <IconTile name={purpose.icon} size="sm" /> : <GlyphTile name="pin" size="sm" />}
                        title={t.title ?? "Untitled trip"}
                        sub={[t.destinations.map((d) => `${flag(d.country)} ${d.city}`.trim()).join(", ") || "—", dateRange(t.startDate, t.endDate)]}
                        aside={
                          <>
                            <span className="sk-tabular sk-small">{money(t.costTotal, t.currency, { compact: true })}</span>
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
          {count < list.total && (
            <div className="sk-trips__none">
              <Button size="sm" variant="ghost" onClick={() => setShownCount((n) => n + PAGE)}>
                Show more ({list.total - count} left)
              </Button>
            </div>
          )}
          {list.loaded && !list.total && <p className="sk-small sk-text-muted sk-trips__none">No trips match.</p>}
        </Pane>

        <Pane title={selected?.state.global.title ?? selectedRow?.title ?? "Trip"} grow={2} onBack={() => setLevel(1)} backLabel="Trips" className="sk-trips__detail">
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
            list.refreshSoon();
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
