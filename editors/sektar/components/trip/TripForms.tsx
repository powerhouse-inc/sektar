// The trip's forms: its details, and one form per kind of item (a transport
// leg, a stay, a meal, an extra). Each is a modal that says what it will do
// in its button, dispatches one action and closes.
import { generateId } from "document-model";
import {
  actions,
  type TripAction,
  type TripExtra,
  type TripExtraKind,
  type TripMeal,
  type TripMealKind,
  type TripPurposeKind,
  type TripState,
  type TripStay,
  type TripTransport,
  type TripTransportMode,
} from "document-models/trip";
import { useState, type ReactNode } from "react";
import {
  dateValue,
  EXTRA,
  EXTRA_ORDER,
  instantValue,
  MEAL,
  MEAL_ORDER,
  MODE,
  MODE_ORDER,
  PURPOSE,
  PURPOSE_ORDER,
  STATUS,
  toInstantInput,
} from "../../kit/trips.js";
import { Button, Field, Input, Modal, Select, Switch, Textarea } from "../../kit/ui.js";

export type Dispatch = (actions: TripAction | TripAction[]) => void;

const day = (iso: string | null | undefined) => (iso ? iso.slice(0, 10) : "");
const text = (v: string) => (v.trim() ? v.trim() : null);
const num = (v: string): number | null => {
  const n = Number(v.replace(",", "."));
  return v.trim() && Number.isFinite(n) ? n : null;
};

function Footer({ onClose, label, disabled, onSave, onDelete }: { onClose: () => void; label: string; disabled?: boolean; onSave: () => void; onDelete?: () => void }) {
  return (
    <>
      {onDelete && (
        <Button variant="ghost" className="sk-text-danger" onClick={onDelete} style={{ marginRight: "auto" }}>
          Remove
        </Button>
      )}
      <Button variant="ghost" onClick={onClose}>
        Cancel
      </Button>
      <Button variant="primary" disabled={disabled} onClick={onSave}>
        {label}
      </Button>
    </>
  );
}

const Grid = ({ children }: { children: ReactNode }) => <div className="sk-trip-form">{children}</div>;

/* --------------------------------------------------------------- details */

export function DetailsForm({ state, dispatch, onClose }: { state: TripState; dispatch: Dispatch; onClose: () => void }) {
  const [title, setTitle] = useState(state.title ?? "");
  const [purpose, setPurpose] = useState(state.purpose ?? "");
  const [kind, setKind] = useState<TripPurposeKind | "">(state.purposeKind ?? "");
  const [start, setStart] = useState(day(state.startDate));
  const [end, setEnd] = useState(day(state.endDate));
  const [status, setStatus] = useState(state.status);
  const [currency, setCurrency] = useState(state.currency);
  const [traveler, setTraveler] = useState(state.traveler?.name ?? "");
  const [email, setEmail] = useState(state.traveler?.email ?? "");
  const [billable, setBillable] = useState(state.billing?.billable ?? false);
  const [customer, setCustomer] = useState(state.billing?.customerName ?? "");
  const [notes, setNotes] = useState(state.notes ?? "");
  const bad = !!start && !!end && end < start;
  const save = () => {
    const ops: TripAction[] = [
      actions.setDetails({ title: text(title), purpose: text(purpose), purposeKind: kind || null, startDate: dateValue(start), endDate: dateValue(end), currency: currency.trim().toUpperCase() || "EUR", notes: text(notes) }),
      actions.setTraveler({ name: text(traveler), email: text(email) }),
      actions.setBilling({ billable, customerId: state.billing?.customerId ?? null, customerName: text(customer) }),
    ];
    if (status !== state.status) ops.push(actions.setStatus({ status }));
    dispatch(ops);
    onClose();
  };
  return (
    <Modal title="Trip details" onClose={onClose} footer={<Footer onClose={onClose} label="Save details" disabled={!title.trim() || bad} onSave={save} />}>
      <Grid>
        <Field label="Title" required className="sk-trip-form__wide">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Copenhagen – key ceremony" autoFocus />
        </Field>
        <Field label="Why" hint="The meeting, the event, the client" className="sk-trip-form__wide">
          <Textarea value={purpose} onChange={(e) => setPurpose(e.target.value)} rows={2} />
        </Field>
        <Field label="Kind of trip">
          <Select value={kind} onChange={(e) => setKind(e.target.value as TripPurposeKind | "")}>
            <option value="">—</option>
            {PURPOSE_ORDER.map((k) => (
              <option key={k} value={k}>
                {PURPOSE[k].label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Status">
          <Select value={status} onChange={(e) => setStatus(e.target.value as TripState["status"])}>
            {Object.entries(STATUS).map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Leaving">
          <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
        </Field>
        <Field label="Back" error={bad ? "Before the day you leave" : undefined}>
          <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
        </Field>
        <Field label="Traveller">
          <Input value={traveler} onChange={(e) => setTraveler(e.target.value)} />
        </Field>
        <Field label="Their email">
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Reported in" hint="The currency the totals are in">
          <Input value={currency} onChange={(e) => setCurrency(e.target.value)} maxLength={3} />
        </Field>
        <Field label="Billed on to a customer">
          <div className="sk-row sk-row--2">
            <Switch checked={billable} onChange={setBillable} label="Billable" />
            <Input value={customer} onChange={(e) => setCustomer(e.target.value)} placeholder="Customer" disabled={!billable} />
          </div>
        </Field>
        <Field label="Notes" className="sk-trip-form__wide">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        </Field>
      </Grid>
    </Modal>
  );
}

/* --------------------------------------------------------------- items */

export type ItemKind = "transport" | "stay" | "meal" | "extra";
type Item = TripTransport | TripStay | TripMeal | TripExtra;

const TITLES: Record<ItemKind, [string, string]> = {
  transport: ["Add a leg", "Edit the leg"],
  stay: ["Add a stay", "Edit the stay"],
  meal: ["Add a meal", "Edit the meal"],
  extra: ["Add a cost", "Edit the cost"],
};

/** The fields of an item as form strings. */
function initial(kind: ItemKind, item: Item | undefined, state: TripState): Record<string, string> {
  const it = (item ?? {}) as Record<string, unknown>;
  const s = (k: string) => (typeof it[k] === "string" ? it[k] : "");
  const cost = item?.cost;
  const base = {
    amount: cost ? String(cost.amount) : "",
    currency: cost?.currency ?? state.currency,
    converted: cost?.converted != null ? String(cost.converted) : "",
    note: s("note"),
  };
  if (kind === "transport")
    return { ...base, mode: s("mode") || "FLIGHT", carrier: s("carrier"), number: s("number"), from: s("from"), to: s("to"), departAt: toInstantInput(s("departAt")), arriveAt: toInstantInput(s("arriveAt")), bookingReference: s("bookingReference"), seat: s("seat") };
  if (kind === "stay")
    return { ...base, name: s("name"), address: s("address"), city: s("city") || (state.destinations[0]?.city ?? ""), checkIn: day(s("checkIn") || state.startDate), checkOut: day(s("checkOut") || state.endDate), bookingReference: s("bookingReference"), bookedVia: s("bookedVia") };
  if (kind === "meal") return { ...base, kind: s("kind") || "DINNER", venue: s("venue"), at: toInstantInput(s("at")), attendees: s("attendees") };
  return { ...base, kind: s("kind") || "OTHER", description: s("description"), at: toInstantInput(s("at")) };
}

export function ItemForm({ kind, item, state, dispatch, onClose }: { kind: ItemKind; item?: Item; state: TripState; dispatch: Dispatch; onClose: () => void }) {
  const [f, setF] = useState(() => initial(kind, item, state));
  const set = (k: string) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));
  const foreign = f.currency.trim().toUpperCase() !== state.currency;
  const money = {
    amount: num(f.amount),
    currency: f.currency.trim().toUpperCase() || state.currency,
    converted: foreign ? num(f.converted) : null,
    note: text(f.note),
  };
  const ok =
    kind === "stay" ? !!f.name.trim() && !(f.checkIn && f.checkOut && f.checkOut < f.checkIn) : kind === "extra" ? !!f.description.trim() : true;
  const id = item?.id ?? generateId();
  const save = () => {
    let op: TripAction;
    if (kind === "transport") {
      const input = { id, mode: f.mode as TripTransportMode, carrier: text(f.carrier), number: text(f.number), from: text(f.from), to: text(f.to), departAt: instantValue(f.departAt), arriveAt: instantValue(f.arriveAt), bookingReference: text(f.bookingReference), seat: text(f.seat), ...money };
      op = item ? actions.updateTransport(input) : actions.addTransport(input);
    } else if (kind === "stay") {
      const input = { id, name: f.name.trim(), address: text(f.address), city: text(f.city), checkIn: dateValue(f.checkIn), checkOut: dateValue(f.checkOut), bookingReference: text(f.bookingReference), bookedVia: text(f.bookedVia), ...money };
      op = item ? actions.updateStay(input) : actions.addStay(input);
    } else if (kind === "meal") {
      const input = { id, kind: f.kind as TripMealKind, venue: text(f.venue), at: instantValue(f.at), attendees: text(f.attendees), ...money };
      op = item ? actions.updateMeal(input) : actions.addMeal(input);
    } else {
      const input = { id, kind: f.kind as TripExtraKind, description: f.description.trim(), at: instantValue(f.at), ...money };
      op = item ? actions.updateExtra(input) : actions.addExtra(input);
    }
    dispatch(op);
    onClose();
  };
  const remove = item
    ? () => {
        dispatch(
          kind === "transport"
            ? actions.removeTransport({ id: item.id })
            : kind === "stay"
              ? actions.removeStay({ id: item.id })
              : kind === "meal"
                ? actions.removeMeal({ id: item.id })
                : actions.removeExtra({ id: item.id }),
        );
        onClose();
      }
    : undefined;
  const [addTitle, editTitle] = TITLES[kind];
  return (
    <Modal title={item ? editTitle : addTitle} onClose={onClose} footer={<Footer onClose={onClose} label={item ? "Save" : addTitle} disabled={!ok} onSave={save} onDelete={remove} />}>
      <Grid>
        {kind === "transport" && (
          <>
            <Field label="How">
              <Select value={f.mode} onChange={set("mode")}>
                {MODE_ORDER.map((m) => (
                  <option key={m} value={m}>
                    {MODE[m].label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="With" hint="Airline, railway, taxi company">
              <Input value={f.carrier} onChange={set("carrier")} />
            </Field>
            <Field label="From">
              <Input value={f.from} onChange={set("from")} placeholder="BRU" />
            </Field>
            <Field label="To">
              <Input value={f.to} onChange={set("to")} placeholder="CPH" />
            </Field>
            <Field label="Departs">
              <Input type="datetime-local" value={f.departAt} onChange={set("departAt")} />
            </Field>
            <Field label="Arrives">
              <Input type="datetime-local" value={f.arriveAt} onChange={set("arriveAt")} />
            </Field>
            <Field label="Flight or train number">
              <Input value={f.number} onChange={set("number")} />
            </Field>
            <Field label="Booking reference">
              <Input value={f.bookingReference} onChange={set("bookingReference")} />
            </Field>
          </>
        )}
        {kind === "stay" && (
          <>
            <Field label="Where" required className="sk-trip-form__wide">
              <Input value={f.name} onChange={set("name")} placeholder="Scandic Kødbyen" autoFocus />
            </Field>
            <Field label="Address">
              <Input value={f.address} onChange={set("address")} />
            </Field>
            <Field label="City">
              <Input value={f.city} onChange={set("city")} />
            </Field>
            <Field label="Check-in">
              <Input type="date" value={f.checkIn} onChange={set("checkIn")} />
            </Field>
            <Field label="Check-out" error={f.checkIn && f.checkOut && f.checkOut < f.checkIn ? "Before check-in" : undefined}>
              <Input type="date" value={f.checkOut} onChange={set("checkOut")} />
            </Field>
            <Field label="Booked through">
              <Input value={f.bookedVia} onChange={set("bookedVia")} placeholder="Booking.com" />
            </Field>
            <Field label="Confirmation">
              <Input value={f.bookingReference} onChange={set("bookingReference")} />
            </Field>
          </>
        )}
        {kind === "meal" && (
          <>
            <Field label="Meal">
              <Select value={f.kind} onChange={set("kind")}>
                {MEAL_ORDER.map((m) => (
                  <option key={m} value={m}>
                    {MEAL[m].label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Where">
              <Input value={f.venue} onChange={set("venue")} autoFocus />
            </Field>
            <Field label="When">
              <Input type="datetime-local" value={f.at} onChange={set("at")} />
            </Field>
            <Field label="With">
              <Input value={f.attendees} onChange={set("attendees")} placeholder="The client, the team" />
            </Field>
          </>
        )}
        {kind === "extra" && (
          <>
            <Field label="What" required className="sk-trip-form__wide">
              <Input value={f.description} onChange={set("description")} placeholder="Conference ticket" autoFocus />
            </Field>
            <Field label="Kind">
              <Select value={f.kind} onChange={set("kind")}>
                {EXTRA_ORDER.map((m) => (
                  <option key={m} value={m}>
                    {EXTRA[m].label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="When">
              <Input type="datetime-local" value={f.at} onChange={set("at")} />
            </Field>
          </>
        )}
        <Field label="Cost">
          <Input inputMode="decimal" value={f.amount} onChange={set("amount")} placeholder="0.00" />
        </Field>
        <Field label="Paid in">
          <Input value={f.currency} onChange={set("currency")} maxLength={3} />
        </Field>
        {foreign && (
          <Field label={`In ${state.currency}`} hint="What it came to, for the totals">
            <Input inputMode="decimal" value={f.converted} onChange={set("converted")} />
          </Field>
        )}
        <Field label="Note" className="sk-trip-form__wide">
          <Input value={f.note} onChange={set("note")} />
        </Field>
      </Grid>
    </Modal>
  );
}

/* --------------------------------------------------------------- places */

export function DestinationForm({ state, dispatch, onClose }: { state: TripState; dispatch: Dispatch; onClose: () => void }) {
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const save = () => {
    dispatch(actions.addDestination({ id: generateId(), city: city.trim(), country: country.trim().toUpperCase() || null, arriveOn: state.startDate ?? null, leaveOn: state.endDate ?? null }));
    onClose();
  };
  return (
    <Modal title="Add a destination" onClose={onClose} footer={<Footer onClose={onClose} label="Add destination" disabled={!city.trim()} onSave={save} />}>
      <Grid>
        <Field label="City" required>
          <Input value={city} onChange={(e) => setCity(e.target.value)} autoFocus />
        </Field>
        <Field label="Country" hint="Two letters: DK, PT, US">
          <Input value={country} onChange={(e) => setCountry(e.target.value)} maxLength={2} />
        </Field>
      </Grid>
    </Modal>
  );
}
