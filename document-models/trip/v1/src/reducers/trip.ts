import type { TripTripOperations } from "document-models/trip/v1";
import {
  DuplicateItemIdError,
  InvalidDatesError,
  ItemNotFoundError,
} from "../../gen/trip/error.js";

export const tripTripOperations: TripTripOperations = {
  setDetailsOperation(state, action) {
    const i = action.input;
    const start =
      i.startDate !== undefined ? (i.startDate ?? null) : state.startDate;
    const end = i.endDate !== undefined ? (i.endDate ?? null) : state.endDate;
    if (start && end && end < start)
      throw new InvalidDatesError(`${end} is before ${start}`);
    if (i.title !== undefined) state.title = i.title ?? null;
    if (i.purpose !== undefined) state.purpose = i.purpose ?? null;
    if (i.purposeKind !== undefined) state.purposeKind = i.purposeKind ?? null;
    state.startDate = start;
    state.endDate = end;
    if (i.currency) state.currency = i.currency;
    if (i.notes !== undefined) state.notes = i.notes ?? null;
  },
  setStatusOperation(state, action) {
    state.status = action.input.status;
  },
  setTravelerOperation(state, action) {
    const i = action.input;
    state.traveler =
      i.name || i.email
        ? { name: i.name ?? null, email: i.email ?? null }
        : null;
  },
  setBillingOperation(state, action) {
    const i = action.input;
    state.billing = {
      billable: i.billable,
      customerId: i.customerId ?? null,
      customerName: i.customerName ?? null,
    };
  },
  addDestinationOperation(state, action) {
    const i = action.input;
    if (state.destinations.some((d) => d.id === i.id))
      throw new DuplicateItemIdError(`Destination ${i.id} exists`);
    if (i.arriveOn && i.leaveOn && i.leaveOn < i.arriveOn)
      throw new InvalidDatesError(`${i.leaveOn} is before ${i.arriveOn}`);
    state.destinations.push({
      id: i.id,
      city: i.city,
      country: i.country ?? null,
      arriveOn: i.arriveOn ?? null,
      leaveOn: i.leaveOn ?? null,
    });
  },
  updateDestinationOperation(state, action) {
    const i = action.input;
    const d = state.destinations.find((x) => x.id === i.id);
    if (!d) throw new ItemNotFoundError(`No destination ${i.id}`);
    if (i.city) d.city = i.city;
    if (i.country !== undefined) d.country = i.country ?? null;
    if (i.arriveOn !== undefined) d.arriveOn = i.arriveOn ?? null;
    if (i.leaveOn !== undefined) d.leaveOn = i.leaveOn ?? null;
  },
  removeDestinationOperation(state, action) {
    const at = state.destinations.findIndex((x) => x.id === action.input.id);
    if (at < 0)
      throw new ItemNotFoundError(`No destination ${action.input.id}`);
    state.destinations.splice(at, 1);
  },
};
