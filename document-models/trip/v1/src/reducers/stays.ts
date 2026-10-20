import type { TripStaysOperations } from "document-models/trip/v1";
import {
  DuplicateItemIdError,
  InvalidDatesError,
  ItemNotFoundError,
} from "../../gen/stays/error.js";
import { costFrom, invoiceFrom, mergeCost } from "../items.js";

export const tripStaysOperations: TripStaysOperations = {
  addStayOperation(state, action) {
    const i = action.input;
    if (i.checkIn && i.checkOut && i.checkOut < i.checkIn)
      throw new InvalidDatesError(`${i.checkOut} is before ${i.checkIn}`);
    if (state.stays.some((x) => x.id === i.id))
      throw new DuplicateItemIdError(`Stay ${i.id} exists`);
    const cost = costFrom(i, state.currency);
    state.stays.push({
      id: i.id,
      name: i.name,
      address: i.address ?? null,
      city: i.city ?? null,
      checkIn: i.checkIn ?? null,
      checkOut: i.checkOut ?? null,
      bookingReference: i.bookingReference ?? null,
      bookedVia: i.bookedVia ?? null,
      cost,
      invoice: invoiceFrom(i),
      note: i.note ?? null,
    });
  },
  updateStayOperation(state, action) {
    const i = action.input;
    const item = state.stays.find((x) => x.id === i.id);
    if (!item) throw new ItemNotFoundError(`No stay ${i.id}`);
    const checkIn =
      i.checkIn !== undefined ? (i.checkIn ?? null) : item.checkIn;
    const checkOut =
      i.checkOut !== undefined ? (i.checkOut ?? null) : item.checkOut;
    if (checkIn && checkOut && checkOut < checkIn)
      throw new InvalidDatesError(`${checkOut} is before ${checkIn}`);
    if (i.name) item.name = i.name;
    if (i.address !== undefined) item.address = i.address ?? null;
    if (i.city !== undefined) item.city = i.city ?? null;
    if (i.checkIn !== undefined) item.checkIn = i.checkIn ?? null;
    if (i.checkOut !== undefined) item.checkOut = i.checkOut ?? null;
    if (i.bookingReference !== undefined)
      item.bookingReference = i.bookingReference ?? null;
    if (i.bookedVia !== undefined) item.bookedVia = i.bookedVia ?? null;
    if (i.note !== undefined) item.note = i.note ?? null;
    if (
      i.amount !== undefined ||
      i.currency !== undefined ||
      i.converted !== undefined
    )
      item.cost = mergeCost(item.cost, i, state.currency);
    if (i.invoiceId !== undefined) item.invoice = invoiceFrom(i);
  },
  removeStayOperation(state, action) {
    const i = action.input;
    const at = state.stays.findIndex((x) => x.id === i.id);
    if (at < 0) throw new ItemNotFoundError(`No stay ${i.id}`);
    state.stays.splice(at, 1);
    state.attachments = state.attachments.filter((a) => a.itemId !== i.id);
  },
};
