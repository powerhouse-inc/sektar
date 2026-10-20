import {
  addAttachment,
  addDestination,
  addExtra,
  addMeal,
  addSource,
  addStay,
  addTransport,
  destinationLine,
  inTripCurrency,
  itinerary,
  reducer,
  removeAttachment,
  removeDestination,
  removeExtra,
  removeMeal,
  removeSource,
  removeStay,
  removeTransport,
  setBilling,
  setDetails,
  setStatus,
  setTraveler,
  stayNights,
  tripDays,
  tripNights,
  tripTotals,
  updateDestination,
  updateExtra,
  updateMeal,
  updateStay,
  updateTransport,
  utils,
  type TripDocument,
} from "document-models/trip/v1";
import { describe, expect, it } from "vitest";

const AT = "2026-10-20T08:00:00.000Z";
const INVOICE = "phd:invoice-2024011";

type Action = Parameters<typeof reducer>[1];
const apply = (doc: TripDocument, ...actions: Action[]) =>
  actions.reduce((d, a) => reducer(d, a), doc);
const lastError = (doc: TripDocument) => doc.operations.global.at(-1)?.error;
/** Applies one action that must fail, and checks the state did not move. */
function rejects(doc: TripDocument, action: Action, message: RegExp) {
  const before = JSON.stringify(doc.state.global);
  const next = reducer(doc, action);
  expect(lastError(next)).toMatch(message);
  expect(JSON.stringify(next.state.global)).toBe(before);
  return next;
}

/** The Copenhagen trip of invoice 2024011, as the importer would build it. */
function copenhagen() {
  return apply(
    utils.createDocument(),
    setDetails({
      title: "Copenhagen – W3W key shard generation",
      purpose: "Wallet key shard generation duties for the Maker Funding Unit",
      purposeKind: "WORKSHOP",
      startDate: "2024-07-11T00:00:00.000Z",
      endDate: "2024-07-12T00:00:00.000Z",
      currency: "EUR",
    }),
    setTraveler({ name: "Wouter Kampmann", email: "wouter@ksdc.be" }),
    setBilling({ billable: true, customerName: "AccountAble OPC" }),
    addDestination({ id: "cph", city: "Copenhagen", country: "DK", arriveOn: "2024-07-11T00:00:00.000Z", leaveOn: "2024-07-12T00:00:00.000Z" }),
    addTransport({
      id: "sas",
      mode: "FLIGHT",
      carrier: "SAS",
      from: "BRU",
      to: "CPH",
      departAt: "2024-07-11T06:40:00.000Z",
      amount: 361.97,
      invoiceId: INVOICE,
      invoiceLineId: "l2",
      invoiceNumber: "2024011",
    }),
    addTransport({ id: "taxi", mode: "TAXI", departAt: "2024-07-11T09:00:00.000Z", amount: 362, currency: "DKK", converted: 48.53 }),
    addStay({ id: "scandic", name: "Scandic Kødbyen", city: "Copenhagen", checkIn: "2024-07-11T00:00:00.000Z", checkOut: "2024-07-12T00:00:00.000Z", amount: 197.04, bookedVia: "Booking.com" }),
    addMeal({ id: "dinner", kind: "DINNER", venue: "Mother", at: "2024-07-11T18:30:00.000Z", attendees: "The signers", amount: 300, currency: "DKK" }),
    addExtra({ id: "esim", kind: "CONNECTIVITY", description: "eSIM" }),
  );
}

describe("a trip from start to end", () => {
  it("records why, when, where and what it cost", () => {
    const doc = copenhagen();
    const s = doc.state.global;
    expect(doc.operations.global.every((o) => !o.error)).toBe(true);
    expect(s.title).toMatch(/Copenhagen/);
    expect(s.status).toBe("PLANNED");
    expect(s.traveler).toEqual({ name: "Wouter Kampmann", email: "wouter@ksdc.be" });
    expect(s.billing).toEqual({ billable: true, customerId: null, customerName: "AccountAble OPC" });
    expect(s.transport[0].cost).toEqual({ amount: 361.97, currency: "EUR", converted: null });
    expect(s.transport[0].invoice).toEqual({ invoiceId: INVOICE, lineId: "l2", number: "2024011" });
    expect(s.transport[1].cost).toEqual({ amount: 362, currency: "DKK", converted: 48.53 });
    expect(s.extras[0].cost).toBeNull();
    expect(s.extras[0].invoice).toBeNull();

    const t = tripTotals(s);
    expect(t).toEqual({ transport: 410.5, stays: 197.04, meals: 0, extras: 0, total: 607.54, unconverted: 1, billed: 361.97 });
    expect(tripDays(s)).toBe(2);
    expect(tripNights(s)).toBe(1);
    expect(destinationLine(s)).toBe("Copenhagen");
    expect(itinerary(s).map((e) => e.item.id)).toEqual(["scandic", "sas", "taxi", "dinner", "esim"]);
  });

  it("updates, attaches, traces and removes", () => {
    let doc = apply(
      copenhagen(),
      setStatus({ status: "COMPLETED" }),
      setDetails({ notes: "Signed on the 11th", endDate: null }),
      updateDestination({ id: "cph", city: "København", country: null, arriveOn: null, leaveOn: null }),
      updateDestination({ id: "cph" }),
      updateTransport({ id: "taxi", mode: "RIDE_HAIL", carrier: "Uber", converted: 48.6 }),
      updateTransport({ id: "sas", amount: null, invoiceId: null, note: "Refunded" }),
      updateStay({ id: "scandic", name: "Scandic", checkOut: "2024-07-13T00:00:00.000Z", currency: "EUR" }),
      updateStay({ id: "scandic" }),
      updateMeal({ id: "dinner", kind: "LUNCH", converted: 40.2, invoiceId: INVOICE }),
      updateExtra({ id: "esim", kind: "OTHER", description: "Airalo eSIM", amount: 9 }),
      addAttachment({ id: "a1", itemId: "scandic", role: "BOOKING", fileName: "booking.pdf", addedAt: AT }),
      addAttachment({ id: "a2", role: "ITINERARY", fileName: "trip.ics", mimeType: "text/calendar", ref: "attachment://x", sizeBytes: 10, documentId: "phd:mail", addedAt: AT }),
      addSource({ id: "s1", kind: "INVOICE_LINE", documentId: INVOICE, lineId: "l2", label: "2024011 · Travel - Flight SAS", at: AT }),
      addSource({ id: "s2", kind: "MANUAL" }),
      setTraveler({}),
      setBilling({ billable: false }),
    );
    expect(doc.operations.global.every((o) => !o.error)).toBe(true);
    let s = doc.state.global;
    expect(s.status).toBe("COMPLETED");
    expect(s.endDate).toBeNull();
    expect(tripDays(s)).toBeNull();
    expect(s.destinations[0]).toEqual({ id: "cph", city: "København", country: null, arriveOn: null, leaveOn: null });
    expect(s.transport[1]).toMatchObject({ mode: "RIDE_HAIL", carrier: "Uber", cost: { amount: 362, currency: "DKK", converted: 48.6 } });
    expect(s.transport[0]).toMatchObject({ cost: null, invoice: null, note: "Refunded" });
    expect(s.stays[0]).toMatchObject({ name: "Scandic", checkOut: "2024-07-13T00:00:00.000Z", cost: { amount: 197.04, currency: "EUR", converted: null } });
    expect(stayNights(s.stays[0])).toBe(2);
    expect(s.meals[0]).toMatchObject({ kind: "LUNCH", cost: { amount: 300, currency: "DKK", converted: 40.2 }, invoice: { invoiceId: INVOICE, lineId: null, number: null } });
    expect(s.extras[0]).toMatchObject({ kind: "OTHER", description: "Airalo eSIM", cost: { amount: 9, currency: "EUR" } });
    expect(s.attachments.map((a) => a.itemId)).toEqual(["scandic", null]);
    expect(s.sources[1]).toEqual({ id: "s2", kind: "MANUAL", documentId: null, lineId: null, label: null, at: null });
    expect(s.traveler).toBeNull();
    expect(s.billing).toEqual({ billable: false, customerId: null, customerName: null });
    expect(tripTotals(s).billed).toBe(40.2);

    doc = apply(
      doc,
      removeStay({ id: "scandic" }),
      removeTransport({ id: "taxi" }),
      removeMeal({ id: "dinner" }),
      removeExtra({ id: "esim" }),
      removeAttachment({ id: "a2" }),
      removeSource({ id: "s1" }),
      removeDestination({ id: "cph" }),
    );
    expect(doc.operations.global.every((o) => !o.error)).toBe(true);
    s = doc.state.global;
    expect(s.stays).toEqual([]);
    expect(s.attachments).toEqual([]); // the stay's booking went with it
    expect(s.sources.map((x) => x.id)).toEqual(["s2"]);
    expect(s.destinations).toEqual([]);
    expect(itinerary(s).map((e) => e.kind)).toEqual(["transport"]);
  });

  it("refuses what makes no sense", () => {
    let doc = copenhagen();
    doc = rejects(doc, setDetails({ endDate: "2024-07-01T00:00:00.000Z" }), /before/);
    doc = rejects(doc, setDetails({ startDate: "2024-08-01T00:00:00.000Z" }), /before/);
    doc = rejects(doc, addDestination({ id: "cph", city: "Again" }), /exists/);
    doc = rejects(doc, addDestination({ id: "x", city: "X", arriveOn: "2024-07-12T00:00:00.000Z", leaveOn: "2024-07-11T00:00:00.000Z" }), /before/);
    doc = rejects(doc, updateDestination({ id: "nope" }), /No destination/);
    doc = rejects(doc, removeDestination({ id: "nope" }), /No destination/);
    doc = rejects(doc, addTransport({ id: "sas", mode: "TRAIN" }), /exists/);
    doc = rejects(doc, updateTransport({ id: "nope" }), /No transport leg/);
    doc = rejects(doc, removeTransport({ id: "nope" }), /No transport leg/);
    doc = rejects(doc, addStay({ id: "scandic", name: "Again" }), /exists/);
    doc = rejects(doc, addStay({ id: "y", name: "Y", checkIn: "2024-07-12T00:00:00.000Z", checkOut: "2024-07-11T00:00:00.000Z" }), /before/);
    doc = rejects(doc, updateStay({ id: "scandic", checkIn: "2024-07-20T00:00:00.000Z" }), /before/);
    doc = rejects(doc, updateStay({ id: "nope" }), /No stay/);
    doc = rejects(doc, removeStay({ id: "nope" }), /No stay/);
    doc = rejects(doc, addMeal({ id: "dinner", kind: "LUNCH" }), /exists/);
    doc = rejects(doc, updateMeal({ id: "nope" }), /No meal/);
    doc = rejects(doc, removeMeal({ id: "nope" }), /No meal/);
    doc = rejects(doc, addExtra({ id: "esim", kind: "OTHER", description: "Again" }), /exists/);
    doc = rejects(doc, updateExtra({ id: "nope" }), /No extra/);
    doc = rejects(doc, removeExtra({ id: "nope" }), /No extra/);
    doc = apply(doc, addAttachment({ id: "a", role: "RECEIPT", fileName: "r.pdf", addedAt: AT }));
    doc = rejects(doc, addAttachment({ id: "a", role: "RECEIPT", fileName: "r.pdf", addedAt: AT }), /exists/);
    doc = rejects(doc, addAttachment({ id: "b", itemId: "nope", role: "RECEIPT", fileName: "r.pdf", addedAt: AT }), /No item/);
    doc = rejects(doc, removeAttachment({ id: "nope" }), /No attachment/);
    doc = apply(doc, addSource({ id: "s", kind: "EMAIL" }));
    doc = rejects(doc, addSource({ id: "s", kind: "EMAIL" }), /exists/);
    rejects(doc, removeSource({ id: "nope" }), /No source/);
  });

  it("attaches to every kind of item", () => {
    const doc = apply(
      copenhagen(),
      ...["sas", "scandic", "dinner", "esim"].map((itemId) => addAttachment({ id: `a-${itemId}`, itemId, role: "RECEIPT", fileName: `${itemId}.pdf`, addedAt: AT })),
    );
    expect(doc.operations.global.every((o) => !o.error)).toBe(true);
    expect(doc.state.global.attachments).toHaveLength(4);
  });
});

describe("every field", () => {
  const D = "2024-07-11T00:00:00.000Z";
  const T = "2024-07-11T10:00:00.000Z";
  const money = { amount: 10, currency: "DKK", converted: 1.34, invoiceId: INVOICE, invoiceLineId: "l1", invoiceNumber: "2024011", note: "n" };
  const cleared = { amount: null, currency: null, converted: null, invoiceId: null, invoiceLineId: null, invoiceNumber: null, note: null };
  const kinds = [
    {
      list: "transport" as const,
      add: addTransport({ id: "x", mode: "FLIGHT", carrier: "SAS", number: "SK1", from: "BRU", to: "CPH", departAt: T, arriveAt: T, bookingReference: "ABC", seat: "1A", ...money }),
      bare: addTransport({ id: "y", mode: "BUS" }),
      set: updateTransport({ id: "x", mode: "TRAIN", carrier: "DSB", number: "IC", from: "CPH", to: "AAR", departAt: T, arriveAt: T, bookingReference: "D", seat: "2B", ...money }),
      clear: updateTransport({ id: "x", carrier: null, number: null, from: null, to: null, departAt: null, arriveAt: null, bookingReference: null, seat: null, ...cleared }),
    },
    {
      list: "stays" as const,
      add: addStay({ id: "x", name: "Hotel", address: "Street 1", city: "CPH", checkIn: D, checkOut: D, bookingReference: "B", bookedVia: "Booking.com", ...money }),
      bare: addStay({ id: "y", name: "Airbnb" }),
      set: updateStay({ id: "x", name: "Other", address: "Street 2", city: "AAR", checkIn: D, checkOut: D, bookingReference: "C", bookedVia: "Hotel", ...money }),
      clear: updateStay({ id: "x", address: null, city: null, checkIn: null, checkOut: null, bookingReference: null, bookedVia: null, ...cleared }),
    },
    {
      list: "meals" as const,
      add: addMeal({ id: "x", kind: "DINNER", venue: "Noma", at: T, attendees: "Team", ...money }),
      bare: addMeal({ id: "y", kind: "DRINKS" }),
      set: updateMeal({ id: "x", kind: "LUNCH", venue: "Mother", at: T, attendees: "Client", ...money }),
      clear: updateMeal({ id: "x", venue: null, at: null, attendees: null, ...cleared }),
    },
    {
      list: "extras" as const,
      add: addExtra({ id: "x", kind: "EVENT_TICKET", description: "Conference", at: T, ...money }),
      bare: addExtra({ id: "y", kind: "VISA", description: "eVisa" }),
      set: updateExtra({ id: "x", kind: "COWORKING", description: "WeWork", at: T, ...money }),
      clear: updateExtra({ id: "x", at: null, ...cleared }),
    },
  ];
  for (const k of kinds) {
    it(`of ${k.list} can be set and cleared`, () => {
      let doc = apply(utils.createDocument(), k.add, k.bare, k.set);
      expect(doc.operations.global.every((o) => !o.error)).toBe(true);
      const set = doc.state.global[k.list][0];
      expect(set.cost).toEqual({ amount: 10, currency: "DKK", converted: 1.34 });
      expect(set.invoice).toEqual({ invoiceId: INVOICE, lineId: "l1", number: "2024011" });
      expect(doc.state.global[k.list][1].cost).toBeNull();
      doc = apply(doc, k.clear);
      expect(lastError(doc)).toBeUndefined();
      const gone = doc.state.global[k.list][0] as Record<string, unknown>;
      expect(gone.cost).toBeNull();
      expect(gone.invoice).toBeNull();
      expect(gone.note).toBeNull();
    });
  }

  it("of the trip can be set and cleared", () => {
    const doc = apply(
      utils.createDocument(),
      setDetails({ title: "T", purpose: "P", purposeKind: "CONFERENCE", startDate: D, endDate: D, currency: "USD", notes: "N" }),
      addDestination({ id: "d", city: "A" }),
      updateDestination({ id: "d", city: "B", country: "DK", arriveOn: D, leaveOn: D }),
      setTraveler({ email: "w@ksdc.be" }),
      setTraveler({ name: "W" }),
      setBilling({ billable: true, customerId: "phd:c", customerName: "C" }),
      setDetails({ title: null, purpose: null, purposeKind: null, startDate: null, notes: null }),
      // a currency the cost names is kept; the trip's own needs no conversion
      addMeal({ id: "m", kind: "LUNCH", amount: 5, converted: 9 }),
    );
    expect(doc.operations.global.every((o) => !o.error)).toBe(true);
    const s = doc.state.global;
    expect(s).toMatchObject({ title: null, purpose: null, purposeKind: null, startDate: null, endDate: D, currency: "USD", notes: null });
    expect(s.destinations[0]).toEqual({ id: "d", city: "B", country: "DK", arriveOn: D, leaveOn: D });
    expect(s.traveler).toEqual({ name: "W", email: null });
    expect(s.billing).toEqual({ billable: true, customerId: "phd:c", customerName: "C" });
    expect(s.meals[0].cost).toEqual({ amount: 5, currency: "USD", converted: null });
  });
});

describe("the derived figures", () => {
  it("handle the edges", () => {
    expect(inTripCurrency(null, "EUR")).toBeNull();
    expect(inTripCurrency({ amount: 5, currency: "USD", converted: null }, "EUR")).toBeNull();
    expect(stayNights({ checkIn: null, checkOut: "2024-01-02T00:00:00.000Z" })).toBeNull();
    expect(stayNights({ checkIn: "2024-01-03T00:00:00.000Z", checkOut: "2024-01-02T00:00:00.000Z" })).toBe(0);
    const empty = utils.createDocument().state.global;
    expect(tripTotals(empty).total).toBe(0);
    expect(tripNights(empty)).toBe(0);
    expect(itinerary(empty)).toEqual([]);
    // a leg known only by its arrival; two untimed items keep their order
    const doc = apply(
      utils.createDocument(),
      addTransport({ id: "t", mode: "TRAIN", arriveAt: "2024-01-01T10:00:00.000Z" }),
      addMeal({ id: "m1", kind: "COFFEE" }),
      addMeal({ id: "m2", kind: "SNACK" }),
      addMeal({ id: "m0", kind: "BREAKFAST", at: "2024-01-01T07:00:00.000Z" }),
    );
    expect(itinerary(doc.state.global).map((e) => e.item.id)).toEqual(["m0", "t", "m1", "m2"]);
  });
});
